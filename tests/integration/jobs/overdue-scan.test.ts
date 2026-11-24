import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { idempotencyKeys } from '@/lib/mail/events';
import { MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE } from '@/lib/time';
import { runOverdueScan } from '@/server/jobs/overdue-scan';

import { defined } from '../../support/defined';
import {
  addressOf,
  adminId,
  ago,
  clock,
  closeWorld,
  db,
  engineerId,
  jobRuns,
  leadId,
  messagesFor,
  minute,
  minuteMarkAfter,
  NOW,
  openWorld,
  otherEngineerId,
  ownOutboxRows,
  plantLeftover,
  plantUser,
  resetWorld,
  restartWorker,
  scan,
  scanDependencies,
  seed,
  send,
  setActive,
  setDeadline,
  setIgnored,
  setStatus,
  store,
} from '../../support/overdue-world';

/**
 * STORY-09.04 AC-1 to AC-5 against real PostgreSQL in a throwaway database, as the runtime role, with the real scan, the real outbox, the real `outbox-send` job and a capturing mail server
 * (Mailpit when the run has one, an in-process stub otherwise: `tests/support/mail-capture.ts`; the world is `tests/support/overdue-world.ts`). The clock is controlled, so "within 5 minutes"
 * is a bound on clock time, not on a cron timer.
 *   AC-1 one row per task and deadline: event, key, To the Engineer, Cc the assigner, by user ID.
 *   AC-2 the message is in the capture server within 5 minutes of the deadline.
 *   AC-3 ten scans, a restarted worker and two scans at once: one row and one message.
 *   AC-4 a changed deadline that also passes is reported once more.
 *   AC-5 closed and deactivated cases; an unlocked task and a reassigned task are not reported twice.
 * AC-6 to AC-9 are in `overdue-scan-rules.test.ts`. Every name, address, path and date is invented.
 */

beforeAll(() => openWorld(0));
afterAll(closeWorld);
beforeEach(resetWorld);

describe('AC-1: one outbox row per task and deadline, by user ID', () => {
  it('writes task-overdue:<taskId>:<deadlineAtUtc>, To the Engineer and Cc the Lead, and no address', async () => {
    const task = await seed({ deadline: ago(5 * MILLISECONDS_PER_MINUTE) });
    await scan();
    const rows = await ownOutboxRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      idempotency_key: `task-overdue:${task.id}:${ago(5 * MILLISECONDS_PER_MINUTE).toISOString()}`,
      event: 'task-overdue',
      to_user_id: engineerId,
      cc_user_ids: [leadId],
      status: 'pending',
      subject: `Task overdue: ${task.code}`,
    });
    for (const address of Object.values(addressOf)) expect(JSON.stringify(rows), address).not.toContain(address);
  });

  it('copies the Admin when the Admin assigned the task', async () => {
    // DEF-071: a row left by an earlier case (older than this case's rows, the Lead as its Cc) is in the world, and this case reads only its own.
    await plantLeftover();
    await seed({ deadline: ago(MILLISECONDS_PER_MINUTE), assigner: adminId });
    await scan();
    expect((await ownOutboxRows())[0]?.cc_user_ids).toEqual([adminId]);
  });

  it('"overdue" is the queue rule: due exactly now is not overdue, one millisecond later it is (the SQL and isOverdue agree)', async () => {
    const atNow = await seed({ deadline: NOW });
    await scan();
    expect(await ownOutboxRows()).toHaveLength(0);
    clock.advance(1);
    await scan();
    const rows = await ownOutboxRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.idempotency_key).toBe(idempotencyKeys.taskOverdue(atNow.id, NOW));
  });

  it('does not write a row for a task that is not yet due', async () => {
    await seed({ deadline: new Date(NOW.getTime() + MILLISECONDS_PER_MINUTE) });
    await scan();
    expect(await ownOutboxRows()).toHaveLength(0);
  });
});

describe('AC-2 (NFR-014): the message is in the capture server within 5 minutes of the deadline', () => {
  it('moves a controlled clock to T + 1 ms, then runs outbox-send and the scan at their minute marks, and finds the message by T + 5 minutes', async () => {
    const T = new Date('2026-11-20T10:00:20.000Z');
    const task = await seed({ deadline: T });
    clock.set(T);
    await minute();
    expect(await ownOutboxRows()).toHaveLength(0);

    clock.set(new Date(T.getTime() + 1));
    let arrivedAt: Date | null = null;
    for (let mark = minuteMarkAfter(clock.now()); mark.getTime() <= T.getTime() + 5 * MILLISECONDS_PER_MINUTE; mark = new Date(mark.getTime() + MILLISECONDS_PER_MINUTE)) {
      clock.set(mark);
      // The worst order of the two jobs at one mark: the send first, so a row the scan writes at this mark waits for the next one.
      await send();
      if ((await messagesFor(task.code)).length > 0) {
        arrivedAt = mark;
        break;
      }
      await scan();
    }
    expect(arrivedAt).not.toBeNull();
    const late = defined(arrivedAt).getTime() - T.getTime();
    expect(await messagesFor(task.code)).toHaveLength(1);
    expect(late).toBeLessThanOrEqual(5 * MILLISECONDS_PER_MINUTE);
    // The design gives T + 2 minutes at most (the scan's mark, then the send's).
    expect(late).toBeLessThanOrEqual(2 * MILLISECONDS_PER_MINUTE);
  });
});

describe('AC-3 (NFR-014): once per event', () => {
  it('scans ten times: one row, one message, and one job_runs row', async () => {
    const task = await seed({ deadline: ago(MILLISECONDS_PER_MINUTE) });
    for (let run = 0; run < 10; run += 1) {
      await minute();
      clock.advance(MILLISECONDS_PER_MINUTE);
    }
    expect(await ownOutboxRows()).toHaveLength(1);
    expect(await messagesFor(task.code)).toHaveLength(1);
    expect(await jobRuns()).toHaveLength(1);
    // The store's SQL builds the same key as `idempotencyKeys.taskOverdue`, so a task with a row is not even read again.
    expect(await store.findCandidates(clock.now(), new Date(clock.now().getTime() - 24 * MILLISECONDS_PER_HOUR))).toEqual([]);
  });

  it('a restarted worker (a new store and a new job) does not queue it again', async () => {
    const task = await seed({ deadline: ago(MILLISECONDS_PER_MINUTE) });
    await minute();
    restartWorker();
    clock.advance(MILLISECONDS_PER_MINUTE);
    await minute();
    expect(await ownOutboxRows()).toHaveLength(1);
    expect(await messagesFor(task.code)).toHaveLength(1);
  });

  it('two scans at once queue one row, and exactly one of them says it queued', async () => {
    await seed({ deadline: ago(MILLISECONDS_PER_MINUTE) });
    const outcomes = await Promise.all([runOverdueScan(scanDependencies, NOW), runOverdueScan(scanDependencies, NOW)]);
    expect(await ownOutboxRows()).toHaveLength(1);
    expect(outcomes.map((outcome) => (outcome.status === 'ok' ? outcome.queued : -1)).sort()).toEqual([0, 1]);
  });

  it('a row already queued for the key, by anything, is left alone: the scan neither reads the task again nor queues it', async () => {
    const task = await seed({ deadline: ago(MILLISECONDS_PER_MINUTE) });
    const deadline = ago(MILLISECONDS_PER_MINUTE);
    await db.owner.query(
      "INSERT INTO email_outbox (idempotency_key, event, to_user_id, cc_user_ids, subject, body_html, body_text, next_attempt_at) VALUES ($1, 'task-overdue', $2::uuid, '{}', 'planted', 'x', 'x', now())",
      [idempotencyKeys.taskOverdue(task.id, deadline), engineerId],
    );
    await scan();
    const rows = await ownOutboxRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.subject).toBe('planted');
    expect(await jobRuns()).toEqual([]);
  });
});

describe('AC-4 (A-09): a changed deadline is reported again, once', () => {
  it('reports the new deadline when it also passes, and not before', async () => {
    const task = await seed({ deadline: ago(5 * MILLISECONDS_PER_MINUTE) });
    await minute();
    expect(await messagesFor(task.code)).toHaveLength(1);

    const moved = new Date(NOW.getTime() + 3 * MILLISECONDS_PER_MINUTE);
    await setDeadline(task.id, moved);
    await minute();
    expect(await messagesFor(task.code)).toHaveLength(1);

    clock.set(new Date(moved.getTime() + MILLISECONDS_PER_MINUTE));
    await minute();
    await minute();
    expect(await messagesFor(task.code)).toHaveLength(2);
    const keys = (await ownOutboxRows()).map((row) => row.idempotency_key).sort();
    expect(keys).toEqual([idempotencyKeys.taskOverdue(task.id, ago(5 * MILLISECONDS_PER_MINUTE)), idempotencyKeys.taskOverdue(task.id, moved)].sort());
  });
});

describe('AC-5: closed tasks, deactivated people, unlocked and reassigned tasks', () => {
  it('writes no row for a task whose estimate is APPROVED, and none for a task whose Engineer is deactivated', async () => {
    await seed({ deadline: ago(MILLISECONDS_PER_MINUTE), status: 'APPROVED' });
    const gone = await plantUser('gone', 'ENGINEER', false);
    await seed({ deadline: ago(MILLISECONDS_PER_MINUTE), engineer: gone });
    await scan();
    expect(await ownOutboxRows()).toHaveLength(0);
  });

  it('reports a PREPARED task (it is still open)', async () => {
    await seed({ deadline: ago(MILLISECONDS_PER_MINUTE), status: 'PREPARED' });
    await scan();
    expect(await ownOutboxRows()).toHaveLength(1);
  });

  it('leaves a deactivated assigner off the Cc, and the message still goes to the Engineer (DL-262)', async () => {
    const gone = await plantUser('boss-gone', 'LEAD', false);
    const task = await seed({ deadline: ago(MILLISECONDS_PER_MINUTE), assigner: gone });
    await minute();
    const rows = await ownOutboxRows();
    expect(rows[0]).toMatchObject({ to_user_id: engineerId, cc_user_ids: [], status: 'sent' });
    const [mail] = await messagesFor(task.code);
    expect(mail?.to).toEqual([addressOf[engineerId]]);
    expect(mail?.cc).toEqual([]);
    expect(mail?.text).toContain('Invented boss-gone');
  });

  it('a person deactivated after the row was written: the Engineer gives a skipped row and no message, an assigner is left off the Cc (outbox-send reads users again, DL-262)', async () => {
    const first = await seed({ deadline: ago(MILLISECONDS_PER_MINUTE) });
    const second = await seed({ deadline: ago(MILLISECONDS_PER_MINUTE), engineer: otherEngineerId, assigner: adminId });
    await scan();
    expect(await ownOutboxRows()).toHaveLength(2);
    await setActive(engineerId, false);
    await setActive(adminId, false);
    await send();
    expect(await messagesFor(first.code)).toHaveLength(0);
    const [mail] = await messagesFor(second.code);
    expect(mail?.to).toEqual([addressOf[otherEngineerId]]);
    expect(mail?.cc).toEqual([]);
    const byKey = new Map((await ownOutboxRows()).map((row) => [row.idempotency_key, row]));
    expect(byKey.get(idempotencyKeys.taskOverdue(first.id, ago(MILLISECONDS_PER_MINUTE)))).toMatchObject({ status: 'skipped', last_error: 'NO_RECIPIENT' });
  });

  it('AQP-399 AC-6: a QUOTED task and an ignored task past their deadline are not reported, and a task that is restored is', async () => {
    await seed({ deadline: ago(MILLISECONDS_PER_MINUTE), status: 'QUOTED' });
    const ignored = await seed({ deadline: ago(MILLISECONDS_PER_MINUTE), ignored: true });
    await seed({ deadline: ago(MILLISECONDS_PER_MINUTE), status: 'PREPARED', ignored: true });
    await scan();
    expect(await ownOutboxRows()).toHaveLength(0);
    await setIgnored(ignored.id, false);
    await minute();
    expect(await ownOutboxRows()).toHaveLength(1);
    expect(await messagesFor(ignored.code)).toHaveLength(1);
  });

  it('a task unlocked after approval and already past its deadline is reported at most once per deadline', async () => {
    const task = await seed({ deadline: ago(MILLISECONDS_PER_MINUTE), status: 'APPROVED' });
    await scan();
    expect(await ownOutboxRows()).toHaveLength(0);
    await setStatus(task.id, 'DRAFT');
    await minute();
    await setStatus(task.id, 'APPROVED');
    await minute();
    await setStatus(task.id, 'PREPARED');
    clock.advance(MILLISECONDS_PER_MINUTE);
    await minute();
    expect(await ownOutboxRows()).toHaveLength(1);
    expect(await messagesFor(task.code)).toHaveLength(1);
  });

  it('a task reassigned after its overdue e-mail was sent gets no second overdue e-mail for the same deadline', async () => {
    const task = await seed({ deadline: ago(MILLISECONDS_PER_MINUTE) });
    await minute();
    await db.owner.query('UPDATE tasks SET engineer_id = $2::uuid, assignment_revision = assignment_revision + 1 WHERE id = $1::uuid', [task.id, otherEngineerId]);
    clock.advance(MILLISECONDS_PER_MINUTE);
    await minute();
    expect(await ownOutboxRows()).toHaveLength(1);
    const [mail] = await messagesFor(task.code);
    expect(mail?.to).toEqual([addressOf[engineerId]]);
  });
});

