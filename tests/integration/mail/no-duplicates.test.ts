import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { idempotencyKeys } from '@/lib/mail/events';
import { MILLISECONDS_PER_HOUR } from '@/lib/time';
import { performDailyDigest } from '@/server/jobs/daily-digest';
import { runOutboxSend } from '@/server/jobs/outbox-send';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createDailyDigestStore } from '@/server/repositories/overdue-repository';

import {
  ago,
  capture,
  clock,
  closeWorld,
  db,
  engineerId,
  keyOf,
  leadId,
  openWorld,
  ORIGIN,
  outbox,
  outboxRows,
  resetWorld,
  scan,
  seed,
  sendDependencies,
} from '../../support/overdue-world';
import { plantMessage, flakyTransport, sendWith } from '../../support/mail-queue';

/**
 * STORY-09.06 AC-3 against real PostgreSQL and a capturing mail server: for each of the three producers (assignment 09.03, overdue 09.04, digest 09.05) one row and one message per idempotency
 * key when the producer runs twice AND two `outbox-send` loops run at once, and a crowd of loops over many rows sends each row once. The producers of the overdue scan and the digest are the real
 * jobs; the assignment e-mail is written through the same key builder and the same outbox door as the assignment service (its own producer is tested in `tests/integration/tasks/assign-email.test.ts`).
 * The contract of the key builders themselves is `tests/unit/mail/idempotency-contract.test.ts`. Every value is invented.
 */

// Many messages go through SMTP to a shared capture server: a busy machine needs more than Vitest's 5 s.
vi.setConfig({ testTimeout: 30_000 });

beforeAll(() => openWorld(5));
afterAll(closeWorld);
beforeEach(resetWorld);

/** Two loops at once, as two worker processes over one database would run them. */
const twoLoopsAtOnce = (): Promise<unknown> => Promise.all([runOutboxSend(sendDependencies), runOutboxSend(sendDependencies)]);

describe('AC-3: assignment, overdue and digest each give one row and one message per key', () => {
  it('AC-3 overdue: the scan runs twice and two send loops run at once: one row, one message', async () => {
    const task = await seed({ deadline: ago(2 * 60_000) });
    await scan();
    await scan();
    const rows = (await outboxRows()).filter((row) => row.idempotency_key === keyOf(task.id, ago(2 * 60_000)));
    expect(rows).toHaveLength(1);
    await twoLoopsAtOnce();
    const mails = (await capture.list()).filter((mail) => mail.subject === `Task overdue: ${task.code}`);
    expect(mails).toHaveLength(1);
    expect((await outboxRows()).filter((row) => row.event === 'task-overdue')).toMatchObject([{ status: 'sent' }]);
  });

  it('AC-3 digest: the digest runs twice for one date and two send loops run at once: one row and one message per Engineer', async () => {
    const atEleven = new Date('2026-11-20T05:30:00.000Z');
    clock.set(atEleven);
    const task = await seed({ deadline: new Date(atEleven.getTime() - 5 * MILLISECONDS_PER_HOUR), title: 'Digest dedupe' });
    const deps = { store: createDailyDigestStore(db.prisma), clock, appOrigin: () => ORIGIN };
    await performDailyDigest(deps);
    await performDailyDigest(deps);
    const rows = (await outboxRows()).filter((row) => row.idempotency_key === idempotencyKeys.dailyDigest(engineerId, '2026-11-20'));
    expect(rows).toHaveLength(1);
    await twoLoopsAtOnce();
    const mails = (await capture.list()).filter((mail) => mail.subject.startsWith('Your overdue tasks') && mail.text.includes(task.code));
    expect(mails).toHaveLength(1);
  });

  it('AC-3 assignment: the same assignment queued twice and two send loops at once: one row, one message; a new revision is a new message', async () => {
    const transactions = createTransactionRunner(db.prisma);
    const taskId = '33333333-3333-4333-8333-333333333333';
    const assigned = (revision: number) => plantMessage({ event: 'task-assigned', idempotencyKey: idempotencyKeys.taskAssigned(taskId, revision), toUserId: engineerId, ccUserIds: [leadId] });
    const first = assigned(1);
    expect(await transactions.run((tx) => outbox.enqueue(tx, first, clock.now()))).toBe('queued');
    expect(await transactions.run((tx) => outbox.enqueue(tx, { ...first, subject: `${first.subject} (again)` }, clock.now()))).toBe('already-queued');
    await twoLoopsAtOnce();
    expect((await capture.list()).filter((mail) => mail.subject.startsWith(first.subject))).toHaveLength(1);

    const second = assigned(2);
    await transactions.run((tx) => outbox.enqueue(tx, second, clock.now()));
    await twoLoopsAtOnce();
    expect((await capture.list()).filter((mail) => mail.subject === second.subject)).toHaveLength(1);
    expect((await outboxRows()).filter((row) => row.event === 'task-assigned')).toHaveLength(2);
  });
});

describe('AC-3: many loops at once over many rows', () => {
  it('AC-3: 40 rows and six loops started together, three times over: every message arrives once, no row is sent twice, and every row is sent', async () => {
    const transactions = createTransactionRunner(db.prisma);
    const planted = Array.from({ length: 40 }, () => plantMessage());
    for (const message of planted) await transactions.run((tx) => outbox.enqueue(tx, message, clock.now()));

    const world = sendWith(flakyTransport(0), clock.now());
    const loop = async (): Promise<number> => {
      let claimed = 0;
      for (let round = 0; round < 3; round += 1) claimed += (await runOutboxSend(world.dependencies)).claimed;
      return claimed;
    };
    const claimedByLoop = await Promise.all(Array.from({ length: 6 }, loop));
    // Every row was claimed exactly once across all the loops: 40 rows, 40 claims.
    expect(claimedByLoop.reduce((sum, count) => sum + count, 0)).toBe(40);

    const subjects = new Set(planted.map((message) => message.subject));
    const arrived = (await capture.list()).filter((mail) => subjects.has(mail.subject));
    expect(arrived).toHaveLength(40);
    expect(new Set(arrived.map((mail) => mail.subject)).size).toBe(40);
    const { rows } = await db.owner.query<{ status: string; attempts: number }>("SELECT status, attempts FROM email_outbox WHERE event = 'backup-missed'");
    expect(rows.every((row) => row.status === 'sent' && row.attempts === 1)).toBe(true);
  });
});
