import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { idempotencyKeys } from '@/lib/mail/events';
import { MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE } from '@/lib/time';
import {
  catchUpNeeded,
  DAILY_DIGEST_JOB,
  performDailyDigest,
  runDailyDigest,
  scheduleDailyDigest,
  type DailyDigestDependencies,
  type DailyDigestStore,
} from '@/server/jobs/daily-digest';
import { createDailyDigestStore } from '@/server/repositories/overdue-repository';

import { forbiddenStrings } from '../../support/canary-masters';
import {
  addressOf,
  adminId,
  capture,
  clock,
  closeWorld,
  db,
  engineerId,
  leadId,
  openWorld,
  ORIGIN,
  otherEngineerId,
  outboxRows,
  plantUser,
  resetWorld,
  seed,
  send,
  setActive,
  setAlerts,
  setIgnored,
  setStatus,
} from '../../support/overdue-world';

/**
 * STORY-09.05 AC-1 to AC-9 against real PostgreSQL in a throwaway database, as the runtime role, with the real digest job, the real outbox, the real `outbox-send` job and a capturing mail
 * server (Mailpit when the run has one, an in-process stub otherwise). The world is the one of the overdue scan (`tests/support/overdue-world.ts`), with its own database (file index 2). The clock is
 * controlled: 11:00 IST on 20 November 2026 is 05:30 UTC.
 *   AC-1, AC-2, AC-4 one row and one message per Engineer with an open overdue task: To, Cc (the distinct active assigners, Lead or Admin), the rows sorted by deadline.
 *   AC-3 none when nothing is overdue.
 *   AC-5 the catch-up at start-up, with the real \`job_runs\` rows.
 *   AC-6 two runs of one date: no new row and no second message; a new date, a new digest.
 *   AC-7 alerts OFF: no row, and a recorded run.
 *   AC-8 a deactivated Engineer or assigner.
 *   AC-9 a row for every run; one Engineer's failure does not stop the others.
 * Every name, address, path and date is invented.
 */

/** 11:00 IST on 20 November 2026. */
const AT_ELEVEN = new Date('2026-11-20T05:30:00.000Z');
const ISO_DATE = '2026-11-20';
const SUBJECT = 'Your overdue tasks, 20 Nov 2026';
const hoursBefore = (hours: number, from: Date = AT_ELEVEN): Date => new Date(from.getTime() - hours * MILLISECONDS_PER_HOUR);

let deps: DailyDigestDependencies;

beforeAll(() => openWorld(2));
afterAll(closeWorld);
beforeEach(async () => {
  await resetWorld();
  clock.set(AT_ELEVEN);
  deps = { store: createDailyDigestStore(db.prisma), clock, appOrigin: () => ORIGIN };
});

const digestRows = async (): Promise<Awaited<ReturnType<typeof outboxRows>>> => (await outboxRows()).filter((row) => row.event === 'daily-digest');
const runs = async (): Promise<Array<{ result: Record<string, unknown> }>> => {
  const { rows } = await db.owner.query<{ result: Record<string, unknown> }>("SELECT result FROM job_runs WHERE job = 'daily-digest' ORDER BY finished_at, id");
  return rows;
};
const mailsWith = async (code: string): Promise<Awaited<ReturnType<typeof capture.list>>> => (await capture.list()).filter((mail) => mail.subject.startsWith('Your overdue tasks') && mail.text.includes(code));
const insertRun = (result: Record<string, unknown>): Promise<unknown> =>
  db.owner.query("INSERT INTO job_runs (job, started_at, finished_at, result) VALUES ('daily-digest', $1, $1, $2::jsonb)", [AT_ELEVEN, JSON.stringify(result)]);

describe('AC-1, AC-2, AC-4: one row and one message per Engineer with an open overdue task', () => {
  it('queues digest:<engineerId>:<istDate>, To the Engineer, Cc the distinct active assigners (Lead and Admin), by user ID, and nothing for a task that is not open and overdue', async () => {
    const oldestByAdmin = await seed({ deadline: hoursBefore(30), assigner: adminId, title: 'Gearbox lid' });
    const byLeadOlder = await seed({ deadline: hoursBefore(10) });
    const byLeadNewer = await seed({ deadline: hoursBefore(3), title: 'Pump base' });
    const meeras = await seed({ deadline: hoursBefore(1), engineer: otherEngineerId });
    const notYet = await seed({ deadline: new Date(AT_ELEVEN.getTime() + MILLISECONDS_PER_MINUTE) });
    const exactlyNow = await seed({ deadline: AT_ELEVEN });
    const approved = await seed({ deadline: hoursBefore(5), status: 'APPROVED' });

    expect(await performDailyDigest(deps)).toMatchObject({ level: 'info' });
    const rows = await digestRows();
    expect(rows).toHaveLength(2);
    const byTo = new Map(rows.map((row) => [row.to_user_id, row]));
    expect(byTo.get(engineerId)).toMatchObject({
      idempotency_key: `digest:${engineerId}:${ISO_DATE}`,
      event: 'daily-digest',
      cc_user_ids: [adminId, leadId],
      status: 'pending',
      subject: SUBJECT,
    });
    expect(byTo.get(otherEngineerId)).toMatchObject({ idempotency_key: `digest:${otherEngineerId}:${ISO_DATE}`, cc_user_ids: [leadId] });
    for (const address of Object.values(addressOf)) expect(JSON.stringify(rows), address).not.toContain(address);

    await send();
    const [arjuns] = await mailsWith(oldestByAdmin.code);
    expect(await mailsWith(oldestByAdmin.code)).toHaveLength(1);
    expect(arjuns?.subject).toBe(SUBJECT);
    expect(arjuns?.to).toEqual([addressOf[engineerId]]);
    expect([...(arjuns?.cc ?? [])].sort()).toEqual([addressOf[adminId], addressOf[leadId]].sort());
    for (const body of [arjuns?.text ?? '', arjuns?.html ?? '']) {
      const positions = [oldestByAdmin.code, byLeadOlder.code, byLeadNewer.code].map((code) => body.indexOf(code));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      for (const absent of [meeras.code, notYet.code, exactlyNow.code, approved.code]) expect(body).not.toContain(absent);
    }
    expect(arjuns?.text).toContain('You have 3 overdue tasks as of 11:00 IST today.');
    expect(arjuns?.text).toContain('Gearbox lid');
    expect(arjuns?.text).toContain('Invented admin');
    expect(arjuns?.text).toContain(`${ORIGIN}/estimates/${oldestByAdmin.code}`);
    expect(arjuns?.html).toContain(`href="${ORIGIN}/estimates/${oldestByAdmin.code}"`);
    expect(arjuns?.text).toContain(`Open my tasks: ${ORIGIN}/queue?tab=overdue`);

    const [meera] = await mailsWith(meeras.code);
    expect(meera?.to).toEqual([addressOf[otherEngineerId]]);
    expect(meera?.cc).toEqual([addressOf[leadId]]);
    expect(meera?.text).not.toContain(oldestByAdmin.code);
  });

  it('"overdue" is the queue rule in SQL and in code: a task due exactly now is not listed, one a millisecond earlier is; PREPARED is open; an old task is listed whatever its age', async () => {
    const atDeadline = await seed({ deadline: AT_ELEVEN });
    expect(await deps.store.findOverdue(AT_ELEVEN, ISO_DATE)).toEqual([]);
    const justLate = await seed({ deadline: new Date(AT_ELEVEN.getTime() - 1), status: 'PREPARED' });
    const tenDays = await seed({ deadline: hoursBefore(240) });
    const found = await deps.store.findOverdue(AT_ELEVEN, ISO_DATE);
    expect(found.map((task) => task.code)).toEqual([tenDays.code, justLate.code]);
    expect(found.map((task) => task.code)).not.toContain(atDeadline.code);
    expect(found[0]).toMatchObject({ taskId: tenDays.id, engineerId, assigner: { id: leadId, name: 'Invented lead', isActive: true } });
    // The task that was approved after it went overdue is no longer open.
    await setStatus(justLate.id, 'APPROVED');
    expect((await deps.store.findOverdue(AT_ELEVEN, ISO_DATE)).map((task) => task.code)).toEqual([tenDays.code]);
  });

  it('AQP-399 AC-6: a QUOTED task and an ignored task are never overdue, however late: only an open task that is not ignored is listed, and Restore puts it back', async () => {
    const open = await seed({ deadline: hoursBefore(5) });
    await seed({ deadline: hoursBefore(6), status: 'QUOTED' });
    await seed({ deadline: hoursBefore(7), status: 'APPROVED' });
    const ignoredDraft = await seed({ deadline: hoursBefore(8), ignored: true });
    const ignoredPrepared = await seed({ deadline: hoursBefore(9), status: 'PREPARED', ignored: true });
    expect((await deps.store.findOverdue(AT_ELEVEN, ISO_DATE)).map((task) => task.code)).toEqual([open.code]);
    await setIgnored(ignoredDraft.id, false);
    await setIgnored(ignoredPrepared.id, false);
    expect((await deps.store.findOverdue(AT_ELEVEN, ISO_DATE)).map((task) => task.code)).toEqual([ignoredPrepared.code, ignoredDraft.code, open.code]);
  });

  it('the two tasks of one Engineer with the same deadline are listed by code', async () => {
    const deadline = hoursBefore(4);
    const first = await seed({ deadline });
    const second = await seed({ deadline });
    expect((await deps.store.findOverdue(AT_ELEVEN, ISO_DATE)).map((task) => task.code)).toEqual([first.code, second.code].sort());
  });

  it('shows hostile markup in a title or a name as text', async () => {
    const hostile = '<script>alert(1)</script> & <b>x</b>';
    const task = await seed({ deadline: hoursBefore(2), title: hostile });
    await performDailyDigest(deps);
    await send();
    const [mail] = await mailsWith(task.code);
    expect(mail?.html).not.toContain('<script>');
    expect(mail?.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &lt;b&gt;x&lt;/b&gt;');
    expect(mail?.text).toContain(hostile);
  });

  it('writes a 23:30 IST deadline as 23:30 IST on its own day', async () => {
    const task = await seed({ deadline: new Date('2026-11-19T18:00:00.000Z') });
    await performDailyDigest(deps);
    await send();
    expect((await mailsWith(task.code))[0]?.text).toContain('19 Nov 2026, 23:30 IST');
  });

  it('finds none of the forbidden canary strings of the masters, the rate names or the formula markers in any captured message or outbox row', async () => {
    const codes = [(await seed({ deadline: hoursBefore(1) })).code, (await seed({ deadline: hoursBefore(2), title: 'Shaft guard', engineer: otherEngineerId })).code];
    await performDailyDigest(deps);
    await send();
    const forbidden = forbiddenStrings();
    expect(forbidden.length).toBeGreaterThan(0);
    const rowText = JSON.stringify(await outboxRows());
    for (const code of codes) {
      const [mail] = await mailsWith(code);
      expect(mail, code).toBeDefined();
      const everything = [mail?.subject, mail?.html, mail?.text, rowText].join('\n');
      for (const { text, reason } of forbidden) expect(everything, `${reason}: ${text}`).not.toContain(text);
    }
  });
});

describe('AC-3: none when nothing is overdue', () => {
  it('an Engineer with no overdue task gets no row and no message, while another does', async () => {
    const late = await seed({ deadline: hoursBefore(2) });
    await seed({ deadline: new Date(AT_ELEVEN.getTime() + MILLISECONDS_PER_HOUR), engineer: otherEngineerId });
    await performDailyDigest(deps);
    await send();
    expect((await digestRows()).map((row) => row.to_user_id)).toEqual([engineerId]);
    expect(await mailsWith(late.code)).toHaveLength(1);
  });

  it('a day with no overdue task at all ends cleanly: no row, no message, and the run is recorded', async () => {
    expect(await performDailyDigest(deps)).toMatchObject({ level: 'info' });
    expect(await digestRows()).toEqual([]);
    expect(await runs()).toEqual([{ result: { status: 'ok', istDate: ISO_DATE, queued: 0, failed: 0 } }]);
  });
});

describe('AC-5: the catch-up at start-up, with the real job_runs rows', () => {
  const at = (hhmm: string): Date => new Date(`2026-11-20T${hhmm}:00.000Z`);

  it('a worker stopped over 11:00 that starts at 14:00 IST sends the digest once; a second start the same day sends nothing more; a start before 11:00 does nothing', async () => {
    const task = await seed({ deadline: hoursBefore(2) });
    clock.set(at('05:29'));
    expect(await catchUpNeeded(deps, clock.now())).toBe(false);

    clock.set(at('08:30'));
    expect(await catchUpNeeded(deps, clock.now())).toBe(true);
    const started = scheduleDailyDigest(true, () => deps, () => undefined);
    await started?.catchUp;
    started?.task.stop();
    await send();
    expect(await mailsWith(task.code)).toHaveLength(1);
    expect(await runs()).toEqual([{ result: { status: 'ok', istDate: ISO_DATE, queued: 1, failed: 0 } }]);

    // The second start the same day, after a good run.
    expect(await catchUpNeeded(deps, clock.now())).toBe(false);
    const again = scheduleDailyDigest(true, () => deps, () => undefined);
    await again?.catchUp;
    again?.task.stop();
    await send();
    expect(await mailsWith(task.code)).toHaveLength(1);
    expect(await digestRows()).toHaveLength(1);
    expect(await runs()).toHaveLength(1);
  });

  it('the job name the store looks for is the job name the job writes', async () => {
    await performDailyDigest(deps);
    const { rows } = await db.owner.query<{ job: string }>('SELECT job FROM job_runs');
    expect(rows).toEqual([{ job: DAILY_DIGEST_JOB }]);
    expect(await deps.store.hasRunFor(ISO_DATE)).toBe(true);
  });

  it('a run that ended failed does not count as recorded: the wrapper\'s row (no date) and a row of a run in which a message was not queued both leave the next start-up to repeat it', async () => {
    clock.set(at('08:30'));
    await insertRun({ status: 'failed', message: 'the run failed' });
    expect(await deps.store.hasRunFor(ISO_DATE)).toBe(false);
    await insertRun({ status: 'failed', istDate: ISO_DATE, queued: 1, failed: 1 });
    expect(await deps.store.hasRunFor(ISO_DATE)).toBe(false);
    expect(await catchUpNeeded(deps, clock.now())).toBe(true);
  });

  it('a skipped run (alerts OFF) counts as recorded, and so does an ok run; a run of another IST date does not count', async () => {
    clock.set(at('08:30'));
    await insertRun({ status: 'ok', istDate: '2026-11-19', queued: 3, failed: 0 });
    expect(await deps.store.hasRunFor(ISO_DATE)).toBe(false);
    await insertRun({ status: 'skipped', istDate: ISO_DATE, queued: 0, failed: 0 });
    expect(await deps.store.hasRunFor(ISO_DATE)).toBe(true);
    expect(await catchUpNeeded(deps, clock.now())).toBe(false);
  });

  it('after a failed run, the next start-up repeats the digest and sends it once (the unique key keeps the repeat safe)', async () => {
    const first = await seed({ deadline: hoursBefore(2) });
    const second = await seed({ deadline: hoursBefore(3), engineer: otherEngineerId });
    clock.set(at('08:30'));
    // The first Engineer's message cannot be queued (a planted failure on top of the real store); the second's can.
    const flaky: DailyDigestStore = { ...deps.store, enqueue: (message, now) => (message.toUserId === engineerId ? Promise.reject(new Error('planted')) : deps.store.enqueue(message, now)) };
    expect(await performDailyDigest({ ...deps, store: flaky })).toMatchObject({ level: 'error' });
    expect(await runs()).toEqual([{ result: { status: 'failed', istDate: ISO_DATE, queued: 1, failed: 1 } }]);
    expect((await digestRows()).map((row) => row.to_user_id)).toEqual([otherEngineerId]);

    expect(await catchUpNeeded(deps, clock.now())).toBe(true);
    const restarted = scheduleDailyDigest(true, () => deps, () => undefined);
    await restarted?.catchUp;
    restarted?.task.stop();
    await send();
    expect(await mailsWith(first.code)).toHaveLength(1);
    expect(await mailsWith(second.code)).toHaveLength(1);
    expect(await digestRows()).toHaveLength(2);
    expect(await catchUpNeeded(deps, clock.now())).toBe(false);
  });
});

describe('AC-6: no duplicates', () => {
  it('runs twice for one IST date (the cron, then a catch-up or a restart): 0 new rows and 0 extra messages, and the repeat does not even read the Engineer again', async () => {
    const task = await seed({ deadline: hoursBefore(2) });
    expect(await runDailyDigest(deps, AT_ELEVEN)).toEqual({ status: 'ok', istDate: ISO_DATE, queued: 1, failed: 0 });
    await send();
    expect(await deps.store.findOverdue(AT_ELEVEN, ISO_DATE)).toEqual([]);
    clock.set(new Date(AT_ELEVEN.getTime() + 3 * MILLISECONDS_PER_HOUR));
    expect(await runDailyDigest(deps, clock.now())).toEqual({ status: 'ok', istDate: ISO_DATE, queued: 0, failed: 0 });
    await send();
    expect(await digestRows()).toHaveLength(1);
    expect(await mailsWith(task.code)).toHaveLength(1);
  });

  it('two runs at once queue one row, and exactly one of them says it queued (the unique key)', async () => {
    await seed({ deadline: hoursBefore(2) });
    const outcomes = await Promise.all([runDailyDigest(deps, AT_ELEVEN), runDailyDigest(deps, AT_ELEVEN)]);
    expect(await digestRows()).toHaveLength(1);
    expect(outcomes.map((outcome) => outcome.queued).sort()).toEqual([0, 1]);
  });

  it('a row already queued for the key, by anything, is left alone', async () => {
    await seed({ deadline: hoursBefore(2) });
    await db.owner.query(
      "INSERT INTO email_outbox (idempotency_key, event, to_user_id, cc_user_ids, subject, body_html, body_text, next_attempt_at) VALUES ($1, 'daily-digest', $2::uuid, '{}', 'planted', 'x', 'x', now())",
      [idempotencyKeys.dailyDigest(engineerId, ISO_DATE), engineerId],
    );
    await performDailyDigest(deps);
    const rows = await digestRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.subject).toBe('planted');
  });

  it('a new IST date gets a new digest, and the date is the IST one: 23:59 IST and 00:01 IST are different days', async () => {
    const task = await seed({ deadline: hoursBefore(24) });
    // 23:59 IST on the 20th is 18:29 UTC; 00:01 IST on the 21st is 18:31 UTC the same evening.
    for (const instant of ['2026-11-20T18:29:00.000Z', '2026-11-20T18:31:00.000Z']) {
      clock.set(new Date(instant));
      await performDailyDigest(deps);
    }
    expect((await digestRows()).map((row) => row.idempotency_key).sort()).toEqual([idempotencyKeys.dailyDigest(engineerId, '2026-11-20'), idempotencyKeys.dailyDigest(engineerId, '2026-11-21')].sort());
    expect((await runs()).map((run) => run.result.istDate)).toEqual(['2026-11-20', '2026-11-21']);
    clock.set(new Date('2026-11-20T18:31:00.000Z'));
    await send();
    expect(await mailsWith(task.code)).toHaveLength(2);
    expect((await capture.list()).filter((mail) => mail.text.includes(task.code)).map((mail) => mail.subject).sort()).toEqual(['Your overdue tasks, 20 Nov 2026', 'Your overdue tasks, 21 Nov 2026']);
  });
});

describe('AC-7: alerts OFF', () => {
  it('queues no row and no message, records the run with its status, and switching ON later the same day does not send that day\'s digest; the next 11:00 does', async () => {
    const task = await seed({ deadline: hoursBefore(2) });
    await setAlerts(false);
    expect(await performDailyDigest(deps)).toMatchObject({ summary: 'daily-digest 2026-11-20 skipped: alerts are off' });
    expect(await digestRows()).toEqual([]);
    expect(await runs()).toEqual([{ result: { status: 'skipped', istDate: ISO_DATE, queued: 0, failed: 0 } }]);

    // 13:00 IST: switched ON. Nothing sends by itself, and a worker that starts now finds today's run recorded.
    await setAlerts(true);
    clock.set(new Date('2026-11-20T07:30:00.000Z'));
    expect(await catchUpNeeded(deps, clock.now())).toBe(false);
    const started = scheduleDailyDigest(true, () => deps, () => undefined);
    await started?.catchUp;
    started?.task.stop();
    expect(await digestRows()).toEqual([]);

    // The next 11:00 IST.
    clock.set(new Date(AT_ELEVEN.getTime() + 24 * MILLISECONDS_PER_HOUR));
    await performDailyDigest(deps);
    await send();
    expect(await digestRows()).toHaveLength(1);
    expect(await mailsWith(task.code)).toHaveLength(1);
  });
});

describe('AC-8: deactivated people', () => {
  it('a deactivated Engineer gets no digest, and the others do', async () => {
    const gone = await plantUser('gone', 'ENGINEER', false);
    await seed({ deadline: hoursBefore(2), engineer: gone });
    const kept = await seed({ deadline: hoursBefore(2) });
    await performDailyDigest(deps);
    expect((await digestRows()).map((row) => row.to_user_id)).toEqual([engineerId]);
    await send();
    expect(await mailsWith(kept.code)).toHaveLength(1);
  });

  it('a deactivated assigner is left off the Cc, and their task stays in the table', async () => {
    const gone = await plantUser('boss-gone', 'LEAD', false);
    const byGone = await seed({ deadline: hoursBefore(3), assigner: gone });
    await seed({ deadline: hoursBefore(2) });
    await performDailyDigest(deps);
    expect((await digestRows())[0]?.cc_user_ids).toEqual([leadId]);
    await send();
    const [mail] = await mailsWith(byGone.code);
    expect(mail?.cc).toEqual([addressOf[leadId]]);
    expect(mail?.text).toContain('Invented boss-gone');
  });

  it('a person deactivated after the row was written: the Engineer gives a skipped row and no message, an assigner is left off the Cc (outbox-send reads users again, DL-262)', async () => {
    const first = await seed({ deadline: hoursBefore(3) });
    const second = await seed({ deadline: hoursBefore(2), engineer: otherEngineerId, assigner: adminId });
    await performDailyDigest(deps);
    expect(await digestRows()).toHaveLength(2);
    await setActive(engineerId, false);
    await setActive(adminId, false);
    await send();
    expect(await mailsWith(first.code)).toHaveLength(0);
    const [mail] = await mailsWith(second.code);
    expect(mail?.to).toEqual([addressOf[otherEngineerId]]);
    expect(mail?.cc).toEqual([]);
    expect((await digestRows()).find((row) => row.to_user_id === engineerId)).toMatchObject({ status: 'skipped', last_error: 'NO_RECIPIENT' });
  });
});

describe('AC-9 (NFR-024): the record of a run', () => {
  it('a run that queued messages writes one job_runs row: status, the IST date and the counts, and nothing about a task or a person', async () => {
    await seed({ deadline: hoursBefore(2) });
    await seed({ deadline: hoursBefore(2), engineer: otherEngineerId });
    const outcome = await performDailyDigest(deps);
    expect(outcome).toEqual({ summary: 'daily-digest 2026-11-20: queued 2, failed 0', level: 'info' });
    expect(await runs()).toEqual([{ result: { status: 'ok', istDate: ISO_DATE, queued: 2, failed: 0 } }]);
  });

  it('one Engineer\'s failure to queue does not stop the others, and the row says so', async () => {
    await seed({ deadline: hoursBefore(2) });
    const others = await seed({ deadline: hoursBefore(2), engineer: otherEngineerId });
    const flaky: DailyDigestStore = { ...deps.store, enqueue: (message, now) => (message.toUserId === engineerId ? Promise.reject(new Error('planted')) : deps.store.enqueue(message, now)) };
    await performDailyDigest({ ...deps, store: flaky });
    await send();
    expect(await mailsWith(others.code)).toHaveLength(1);
    expect(await runs()).toEqual([{ result: { status: 'failed', istDate: ISO_DATE, queued: 1, failed: 1 } }]);
  });

  it('a run that throws (the database cannot answer) is recorded as failed by the wrapper, with no reason, and the next run still works', async () => {
    const task = await seed({ deadline: hoursBefore(2) });
    const broken: DailyDigestStore = { ...deps.store, findOverdue: () => Promise.reject(new Error('planted')) };
    const lines: Array<{ message: string; fields: Record<string, unknown> | undefined }> = [];
    // A worker that starts at 11:00 and cannot read the database.
    clock.set(AT_ELEVEN);
    const failing = scheduleDailyDigest(true, () => ({ ...deps, store: broken }), (message, _level, fields) => void lines.push({ message, fields }));
    await failing?.catchUp;
    failing?.task.stop();
    expect(await runs()).toEqual([{ result: { status: 'failed', message: 'the run failed' } }]);
    expect(JSON.stringify(lines)).not.toContain('planted');
    // The wrapper's row has no date, so the catch-up still owes the day, and the repeat sends it.
    expect(await catchUpNeeded(deps, clock.now())).toBe(true);
    await performDailyDigest(deps);
    await send();
    expect(await mailsWith(task.code)).toHaveLength(1);
  });
});
