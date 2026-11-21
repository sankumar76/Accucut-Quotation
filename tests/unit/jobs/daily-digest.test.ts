import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { idempotencyKeys } from '@/lib/mail/events';
import { createFixedClock, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE, type FixedClock } from '@/lib/time';
import {
  catchUpNeeded,
  DAILY_DIGEST_CRON,
  DAILY_DIGEST_JOB,
  DAILY_DIGEST_TIMEZONE,
  MAX_DIGEST_CC,
  performDailyDigest,
  runDailyDigest,
  scheduleDailyDigest,
  type DailyDigestDependencies,
  type DailyDigestRun,
  type DailyDigestStore,
  type DigestMail,
  type DigestTask,
} from '@/server/jobs/daily-digest';
import { LOGO_CONTENT_ID } from '@/server/mail/layout';
import { MAX_CC_USERS } from '@/server/repositories/email-outbox-repository';
import type { FailedJobRun, JobLogFields, JobLogLevel } from '@/server/jobs/run-job';

const cron = vi.hoisted(() => ({ schedule: vi.fn() }));
vi.mock('node-cron', () => ({ schedule: cron.schedule }));

/**
 * STORY-09.05 (FR-083; NFR-014, NFR-024; architecture section 4.7): the worker's `daily-digest` job. The clock is fixed, and the database is a stub store, so no database, timer or mail server is
 * involved (the database and the mail server are `tests/integration/jobs/daily-digest.test.ts`'s).
 *   AC-1 one message per Engineer with an open overdue task: the event, the key `digest:<engineerId>:<istDate>`, the To.
 *   AC-2 the Cc is the distinct active assigners, once each, Lead or Admin.
 *   AC-3 none for an Engineer with nothing overdue, and a clean run when nobody has.
 *   AC-4 the content is the template's (its own test); here the rows are sorted and the links come from the origin.
 *   AC-5 the catch-up: after 11:00 IST, when no run of today's IST date other than a failed one is recorded.
 *   AC-6 two runs, one date: the same key; a new date, a new key.
 *   AC-7 alerts OFF: nothing is read or queued, and the run is recorded with its status.
 *   AC-9 a row for every run; one Engineer's failure does not stop the others.
 * Every name and value is invented.
 */

const ORIGIN = 'https://portal.example.com';
/** 11:00 IST on 20 November 2026. */
const AT_ELEVEN = new Date('2026-11-20T05:30:00.000Z');
const ISO_DATE = '2026-11-20';
const ARJUN = '11111111-1111-4111-8111-111111111111';
const MEERA = '11111111-1111-4111-8111-222222222222';
const LEAD = '22222222-2222-4222-8222-111111111111';
const OTHER_LEAD = '22222222-2222-4222-8222-222222222222';
const ADMIN = '22222222-2222-4222-8222-333333333333';

let counter = 0;
function task(overrides: Partial<DigestTask> = {}): DigestTask {
  counter += 1;
  return {
    taskId: `33333333-3333-4333-8333-${String(counter).padStart(12, '0')}`,
    code: `Q-2026-${String(counter).padStart(4, '0')}`,
    title: 'Hopper cover',
    deadlineAt: new Date(AT_ELEVEN.getTime() - counter * MILLISECONDS_PER_HOUR),
    engineerId: ARJUN,
    assigner: { id: LEAD, name: 'Invented Lead', isActive: true },
    ...overrides,
  };
}

interface FakeStore extends DailyDigestStore {
  alertsOn: boolean;
  tasks: DigestTask[];
  /** The dates a good run is recorded for. */
  recordedDates: Set<string>;
  /** Engineers whose enqueue throws. */
  failFor: Set<string>;
  failFind: boolean;
  failHasRun: boolean;
  /** The keys already queued. */
  keys: Set<string>;
  readonly calls: { alertsEnabled: number; findOverdue: Array<{ now: Date; istDate: string }>; enqueued: DigestMail[]; recorded: Array<DailyDigestRun | FailedJobRun>; hasRunFor: string[] };
}

function fakeStore(): FakeStore {
  const calls: FakeStore['calls'] = { alertsEnabled: 0, findOverdue: [], enqueued: [], recorded: [], hasRunFor: [] };
  const store: FakeStore = {
    alertsOn: true,
    tasks: [],
    recordedDates: new Set(),
    failFor: new Set(),
    failFind: false,
    failHasRun: false,
    keys: new Set(),
    calls,
    alertsEnabled() {
      calls.alertsEnabled += 1;
      return Promise.resolve(store.alertsOn);
    },
    findOverdue(now, istDate) {
      calls.findOverdue.push({ now, istDate });
      if (store.failFind) return Promise.reject(new Error('connection to server at "10.1.2.3" failed: password authentication failed for user "planted-user"'));
      // As the real store: engineers with no message for the date yet, the oldest deadline first, then by code.
      const open = store.tasks.filter((candidate) => !store.keys.has(idempotencyKeys.dailyDigest(candidate.engineerId, istDate)));
      return Promise.resolve([...open].sort((a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime() || a.code.localeCompare(b.code)));
    },
    enqueue(message) {
      if (store.failFor.has(message.toUserId)) return Promise.reject(new Error('insert failed for planted-address@example.com'));
      calls.enqueued.push(message);
      if (store.keys.has(message.idempotencyKey)) return Promise.resolve('already-queued');
      store.keys.add(message.idempotencyKey);
      return Promise.resolve('queued');
    },
    hasRunFor(istDate) {
      calls.hasRunFor.push(istDate);
      return store.failHasRun ? Promise.reject(new Error('planted failure')) : Promise.resolve(store.recordedDates.has(istDate));
    },
    recordRun(run) {
      calls.recorded.push(run);
      return Promise.resolve();
    },
  };
  return store;
}

let clock: FixedClock;
let store: FakeStore;
let dependencies: DailyDigestDependencies;

beforeEach(() => {
  clock = createFixedClock(AT_ELEVEN);
  store = fakeStore();
  dependencies = { store, clock, appOrigin: () => ORIGIN };
  cron.schedule.mockReset();
});

const messageTo = (engineerId: string): DigestMail => {
  const found = store.calls.enqueued.find((message) => message.toUserId === engineerId);
  if (found === undefined) throw new Error('No message for that Engineer.');
  return found;
};

describe('AC-1: one outbox message per Engineer with an open overdue task', () => {
  it('queues event daily-digest, the key digest:<engineerId>:<istDate> and the Engineer as To, with the rows of that Engineer only', async () => {
    store.tasks = [task({ code: 'Q-ARJUN-1' }), task({ code: 'Q-MEERA-1', engineerId: MEERA }), task({ code: 'Q-ARJUN-2' })];
    const outcome = await runDailyDigest(dependencies, AT_ELEVEN);
    expect(outcome).toEqual({ status: 'ok', istDate: ISO_DATE, queued: 2, failed: 0 });
    expect(store.calls.enqueued).toHaveLength(2);
    expect(messageTo(ARJUN)).toMatchObject({ idempotencyKey: `digest:${ARJUN}:${ISO_DATE}`, event: 'daily-digest', toUserId: ARJUN, subject: 'Your overdue tasks, 20 Nov 2026' });
    expect(messageTo(ARJUN).idempotencyKey).toBe(idempotencyKeys.dailyDigest(ARJUN, ISO_DATE));
    expect(messageTo(ARJUN).bodyText).toContain('Q-ARJUN-1');
    expect(messageTo(ARJUN).bodyText).toContain('Q-ARJUN-2');
    expect(messageTo(ARJUN).bodyText).not.toContain('Q-MEERA-1');
    expect(messageTo(MEERA).bodyText).toContain('Q-MEERA-1');
    expect(messageTo(MEERA).bodyText).not.toContain('Q-ARJUN');
  });

  it('puts the origin in every link and writes no e-mail address anywhere: recipients are user IDs', async () => {
    store.tasks = [task({ code: 'Q-ARJUN-1' })];
    await runDailyDigest(dependencies, AT_ELEVEN);
    const message = messageTo(ARJUN);
    expect(message.bodyText).toContain(`${ORIGIN}/estimates/Q-ARJUN-1`);
    expect(message.bodyText).toContain(`${ORIGIN}/queue?tab=overdue`);
    // The only "@" is the logo's content ID, which is not an address of a person.
    expect(JSON.stringify(message).replaceAll(LOGO_CONTENT_ID, '')).not.toContain('@');
  });

  it('judges each task strictly: a task due exactly now is not listed, one a millisecond earlier is (the queue rule)', async () => {
    store.tasks = [task({ code: 'Q-AT-DEADLINE', deadlineAt: AT_ELEVEN }), task({ code: 'Q-JUST-LATE', deadlineAt: new Date(AT_ELEVEN.getTime() - 1) })];
    await runDailyDigest(dependencies, AT_ELEVEN);
    expect(messageTo(ARJUN).bodyText).toContain('Q-JUST-LATE');
    expect(messageTo(ARJUN).bodyText).not.toContain('Q-AT-DEADLINE');
  });

  it('writes "Overdue by" at the time the row is written, from the run\'s clock', async () => {
    store.tasks = [task({ code: 'Q-LATE', deadlineAt: new Date(AT_ELEVEN.getTime() - 3 * MILLISECONDS_PER_HOUR) })];
    await runDailyDigest(dependencies, AT_ELEVEN);
    expect(messageTo(ARJUN).bodyText).toContain('| 3 h |');
  });
});

describe('AC-2: the Cc is the distinct active assigners of the listed tasks, Lead or Admin, once each', () => {
  it('copies the Lead and the Admin who assigned the listed tasks, each once, in the order of the oldest task', async () => {
    store.tasks = [
      task({ assigner: { id: LEAD, name: 'Invented Lead', isActive: true } }),
      task({ assigner: { id: ADMIN, name: 'Invented Admin', isActive: true } }),
      task({ assigner: { id: LEAD, name: 'Invented Lead', isActive: true } }),
    ];
    await runDailyDigest(dependencies, AT_ELEVEN);
    // The tasks are listed oldest first, and the fixture makes each later task older: so the third (the Lead) comes first, then the Admin, and the Lead's first task adds nothing.
    expect(messageTo(ARJUN).ccUserIds).toEqual([LEAD, ADMIN]);
  });

  it('leaves a deactivated assigner off the Cc but keeps their task in the table (AC-8)', async () => {
    store.tasks = [task({ code: 'Q-BY-LEFT', assigner: { id: OTHER_LEAD, name: 'Invented Left', isActive: false } }), task({ assigner: { id: LEAD, name: 'Invented Lead', isActive: true } })];
    await runDailyDigest(dependencies, AT_ELEVEN);
    expect(messageTo(ARJUN).ccUserIds).toEqual([LEAD]);
    expect(messageTo(ARJUN).bodyText).toContain('Q-BY-LEFT');
  });

  it('has an empty Cc when every assigner is deactivated', async () => {
    store.tasks = [task({ assigner: { id: LEAD, name: 'Invented Lead', isActive: false } })];
    await runDailyDigest(dependencies, AT_ELEVEN);
    expect(messageTo(ARJUN).ccUserIds).toEqual([]);
  });

  it('copies only the assigners of this Engineer\'s tasks, not those of another Engineer', async () => {
    store.tasks = [task({ assigner: { id: LEAD, name: 'Invented Lead', isActive: true } }), task({ engineerId: MEERA, assigner: { id: OTHER_LEAD, name: 'Invented Other', isActive: true } })];
    await runDailyDigest(dependencies, AT_ELEVEN);
    expect(messageTo(ARJUN).ccUserIds).toEqual([LEAD]);
    expect(messageTo(MEERA).ccUserIds).toEqual([OTHER_LEAD]);
  });

  it('never names more Cc users than the outbox accepts, so one busy Engineer\'s digest is still queued', async () => {
    expect(MAX_DIGEST_CC).toBe(MAX_CC_USERS);
    store.tasks = Array.from({ length: MAX_DIGEST_CC + 3 }, (_, index) => task({ assigner: { id: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`, name: `Invented ${index}`, isActive: true } }));
    await runDailyDigest(dependencies, AT_ELEVEN);
    expect(messageTo(ARJUN).ccUserIds).toHaveLength(MAX_DIGEST_CC);
  });
});

describe('AC-3: none when nothing is overdue, and a clean run', () => {
  it('queues nothing and ends cleanly when no Engineer has an overdue task, and still records the run', async () => {
    const outcome = await runDailyDigest(dependencies, AT_ELEVEN);
    expect(outcome).toEqual({ status: 'ok', istDate: ISO_DATE, queued: 0, failed: 0 });
    expect(store.calls.enqueued).toEqual([]);
  });

  it('writes nothing for a task the store returned that is not overdue (the rule is also in code)', async () => {
    store.tasks = [task({ deadlineAt: new Date(AT_ELEVEN.getTime() + 1) })];
    expect(await runDailyDigest(dependencies, AT_ELEVEN)).toMatchObject({ status: 'ok', queued: 0 });
    expect(store.calls.enqueued).toEqual([]);
  });
});

describe('AC-6: the same IST date gives the same key, a new date a new one', () => {
  it('queues nothing new when the job runs twice for one date', async () => {
    store.tasks = [task()];
    expect(await runDailyDigest(dependencies, AT_ELEVEN)).toMatchObject({ queued: 1 });
    expect(await runDailyDigest(dependencies, new Date(AT_ELEVEN.getTime() + 3 * MILLISECONDS_PER_HOUR))).toMatchObject({ status: 'ok', queued: 0 });
    expect(store.keys.size).toBe(1);
  });

  it('counts a message the outbox already holds as not queued (a key queued between the read and the write)', async () => {
    store.tasks = [task()];
    store.keys.add(idempotencyKeys.dailyDigest(ARJUN, ISO_DATE));
    const racing = { ...store, findOverdue: () => Promise.resolve(store.tasks) } as DailyDigestStore;
    expect(await runDailyDigest({ ...dependencies, store: racing }, AT_ELEVEN)).toMatchObject({ status: 'ok', queued: 0, failed: 0 });
  });

  it('a new IST date is a new key, and the date is the IST one: 23:59 IST and 00:01 IST are different days', async () => {
    store.tasks = [task()];
    const lateEvening = new Date('2026-11-20T18:29:00.000Z');
    const afterMidnight = new Date('2026-11-20T18:31:00.000Z');
    expect((await runDailyDigest(dependencies, lateEvening)).istDate).toBe('2026-11-20');
    expect((await runDailyDigest(dependencies, afterMidnight)).istDate).toBe('2026-11-21');
    expect(store.calls.enqueued.map((message) => message.idempotencyKey)).toEqual([`digest:${ARJUN}:2026-11-20`, `digest:${ARJUN}:2026-11-21`]);
  });

  it('takes the IST date, never the server\'s: 11:00 IST is 05:30 UTC on the same date', async () => {
    expect((await runDailyDigest(dependencies, AT_ELEVEN)).istDate).toBe('2026-11-20');
  });
});

describe('AC-7: alerts OFF', () => {
  it('reads nothing and queues nothing, and the outcome says skipped', async () => {
    store.alertsOn = false;
    store.tasks = [task()];
    expect(await runDailyDigest(dependencies, AT_ELEVEN)).toEqual({ status: 'skipped', istDate: ISO_DATE, queued: 0, failed: 0 });
    expect(store.calls.findOverdue).toEqual([]);
    expect(store.calls.enqueued).toEqual([]);
  });
});

describe('AC-9: a job_runs row for every run, and one Engineer\'s failure does not stop the others', () => {
  it('records status, istDate and the number queued for a run that queued messages', async () => {
    store.tasks = [task(), task({ engineerId: MEERA })];
    const outcome = await performDailyDigest(dependencies);
    expect(store.calls.recorded).toEqual([{ job: 'daily-digest', startedAt: AT_ELEVEN, finishedAt: AT_ELEVEN, result: { status: 'ok', istDate: ISO_DATE, queued: 2, failed: 0 } }]);
    expect(outcome).toEqual({ summary: 'daily-digest 2026-11-20: queued 2, failed 0', level: 'info' });
  });

  it('records a row for a run that queued nothing (it is one row a day, and the catch-up reads it)', async () => {
    await performDailyDigest(dependencies);
    expect(store.calls.recorded).toEqual([{ job: 'daily-digest', startedAt: AT_ELEVEN, finishedAt: AT_ELEVEN, result: { status: 'ok', istDate: ISO_DATE, queued: 0, failed: 0 } }]);
  });

  it('records a row for a run with alerts OFF, with the status skipped (AC-7)', async () => {
    store.alertsOn = false;
    const outcome = await performDailyDigest(dependencies);
    expect(store.calls.recorded).toEqual([{ job: 'daily-digest', startedAt: AT_ELEVEN, finishedAt: AT_ELEVEN, result: { status: 'skipped', istDate: ISO_DATE, queued: 0, failed: 0 } }]);
    expect(outcome).toEqual({ summary: 'daily-digest 2026-11-20 skipped: alerts are off', level: 'info' });
  });

  it('keeps going when one Engineer\'s message cannot be queued: the others are queued, the run says how many failed, and the row is failed so the next start-up repeats it', async () => {
    store.tasks = [task({ engineerId: ARJUN }), task({ engineerId: MEERA })];
    store.failFor.add(ARJUN);
    const outcome = await performDailyDigest(dependencies);
    expect(store.calls.enqueued.map((message) => message.toUserId)).toEqual([MEERA]);
    expect(store.calls.recorded).toEqual([{ job: 'daily-digest', startedAt: AT_ELEVEN, finishedAt: AT_ELEVEN, result: { status: 'failed', istDate: ISO_DATE, queued: 1, failed: 1 } }]);
    expect(outcome).toEqual({ summary: 'daily-digest 2026-11-20: queued 1, failed 1', level: 'error' });
    expect(JSON.stringify(outcome)).not.toMatch(/planted|@example/);
  });

  it('stamps the row with the clock at the start and at the end of the run', async () => {
    let ticks = 0;
    const stepping = { now: () => new Date(AT_ELEVEN.getTime() + 1500 * ticks++) };
    await performDailyDigest({ ...dependencies, clock: stepping });
    expect(store.calls.recorded[0]).toMatchObject({ startedAt: AT_ELEVEN, finishedAt: new Date(AT_ELEVEN.getTime() + 1500) });
  });

  it('a store that cannot answer makes the run throw, so the wrapper logs the class of the error and writes the failed row, and the error text never reaches either', async () => {
    store.failFind = true;
    cron.schedule.mockReturnValue({ stop: vi.fn() });
    const lines: Array<{ message: string; level: JobLogLevel | undefined; fields: JobLogFields | undefined }> = [];
    // Started at 09:30 IST, before the digest is due, so there is no catch-up to add a run of its own.
    clock.set(new Date('2026-11-20T04:00:00.000Z'));
    scheduleDailyDigest(true, () => dependencies, (message, level, fields) => void lines.push({ message, level, fields }));
    clock.set(AT_ELEVEN);
    const callback = cron.schedule.mock.calls[0]?.[1];
    if (typeof callback !== 'function') throw new Error('The job was not scheduled.');
    await expect(callback()).resolves.toBeUndefined();
    const failure = lines.find((line) => line.level === 'error');
    expect(failure?.fields).toMatchObject({ job: 'daily-digest', errorName: 'Error' });
    expect(JSON.stringify(lines)).not.toMatch(/10\.1\.2\.3|planted-user|password/);
    expect(store.calls.recorded).toEqual([{ job: 'daily-digest', startedAt: AT_ELEVEN, finishedAt: AT_ELEVEN, result: { status: 'failed', message: 'the run failed' } }]);
  });
});

describe('AC-5: the catch-up at start-up', () => {
  const at = (hhmm: string): Date => new Date(`2026-11-20T${hhmm}:00.000Z`);

  it('does nothing before 11:00 IST: 10:59 is not due, 11:00 is', async () => {
    // 10:59 IST is 05:29 UTC.
    expect(await catchUpNeeded(dependencies, at('05:29'))).toBe(false);
    expect(store.calls.hasRunFor).toEqual([]);
    expect(await catchUpNeeded(dependencies, at('05:30'))).toBe(true);
  });

  it('is needed at 14:00 IST when no run is recorded for today\'s IST date, and not when one is', async () => {
    const afternoon = at('08:30');
    expect(await catchUpNeeded(dependencies, afternoon)).toBe(true);
    expect(store.calls.hasRunFor).toEqual([ISO_DATE]);
    store.recordedDates.add(ISO_DATE);
    expect(await catchUpNeeded(dependencies, afternoon)).toBe(false);
  });

  it('asks about the IST date: at 00:30 IST the run of the evening before does not count', async () => {
    store.recordedDates.add('2026-11-19');
    // 00:30 IST on the 20th is 19:00 UTC on the 19th: before 11:00 IST of the 20th, so nothing is due, whatever is recorded.
    expect(await catchUpNeeded(dependencies, new Date('2026-11-19T19:00:00.000Z'))).toBe(false);
    // 23:59 IST on the 19th: after 11:00, and a run is recorded for the 19th.
    expect(await catchUpNeeded(dependencies, new Date('2026-11-19T18:29:00.000Z'))).toBe(false);
    // 23:59 IST on the 20th: no run for the 20th.
    expect(await catchUpNeeded(dependencies, new Date('2026-11-20T18:29:00.000Z'))).toBe(true);
  });

  async function startUpAt(instant: Date): Promise<Array<{ message: string; level: JobLogLevel | undefined }>> {
    clock.set(instant);
    cron.schedule.mockReturnValue({ stop: vi.fn() });
    const lines: Array<{ message: string; level: JobLogLevel | undefined }> = [];
    const scheduled = scheduleDailyDigest(true, () => dependencies, (message, level) => void lines.push({ message, level }));
    await scheduled?.catchUp;
    return lines;
  }

  it('a worker that starts at 14:00 IST with no run recorded sends the digest once; a second start the same day sends nothing more', async () => {
    store.tasks = [task()];
    await startUpAt(new Date('2026-11-20T08:30:00.000Z'));
    expect(store.calls.enqueued).toHaveLength(1);
    expect(store.calls.recorded).toHaveLength(1);
    // The row the first start wrote is now what the next start-up reads.
    store.recordedDates.add(ISO_DATE);
    await startUpAt(new Date('2026-11-20T09:00:00.000Z'));
    expect(store.calls.enqueued).toHaveLength(1);
    expect(store.calls.recorded).toHaveLength(1);
  });

  it('a start before 11:00 IST does nothing, and the cron is still scheduled for 11:00', async () => {
    store.tasks = [task()];
    await startUpAt(new Date('2026-11-20T05:29:00.000Z'));
    expect(store.calls.enqueued).toEqual([]);
    expect(store.calls.recorded).toEqual([]);
    expect(cron.schedule).toHaveBeenCalledTimes(1);
  });

  it('a catch-up that cannot read the store is logged by the class of its error, never ends the worker, and writes the failed row', async () => {
    store.failHasRun = true;
    const lines: Array<{ message: string; level: JobLogLevel | undefined; fields: JobLogFields | undefined }> = [];
    clock.set(new Date('2026-11-20T08:30:00.000Z'));
    cron.schedule.mockReturnValue({ stop: vi.fn() });
    const scheduled = scheduleDailyDigest(true, () => dependencies, (message, level, fields) => void lines.push({ message, level, fields }));
    await expect(scheduled?.catchUp).resolves.toBeUndefined();
    expect(lines.find((line) => line.level === 'error')?.fields).toMatchObject({ job: 'daily-digest', errorName: 'Error' });
    expect(JSON.stringify(lines)).not.toMatch(/planted failure/);
    expect(store.calls.recorded).toEqual([{ job: 'daily-digest', startedAt: new Date('2026-11-20T08:30:00.000Z'), finishedAt: new Date('2026-11-20T08:30:00.000Z'), result: { status: 'failed', message: 'the run failed' } }]);
  });
});

describe('scheduleDailyDigest: 11:00 in IST, only when FEATURE_EMAIL is on (AC-1)', () => {
  it('is off, and says why, when the mail feature is off: nothing is built, nothing is scheduled, no catch-up', () => {
    const lines: string[] = [];
    const build = vi.fn(() => dependencies);
    expect(scheduleDailyDigest(false, build, (message) => lines.push(message))).toBeUndefined();
    expect(build).not.toHaveBeenCalled();
    expect(cron.schedule).not.toHaveBeenCalled();
    expect(lines).toEqual(['daily-digest is off: FEATURE_EMAIL is not on, so it is not scheduled']);
  });

  it('schedules 0 11 * * * at Asia/Kolkata with no overlap, and says so', () => {
    const task = { stop: vi.fn() };
    cron.schedule.mockReturnValue(task);
    const lines: string[] = [];
    clock.set(new Date('2026-11-20T04:00:00.000Z'));
    expect(scheduleDailyDigest(true, () => dependencies, (message) => lines.push(message))?.task).toBe(task);
    expect([DAILY_DIGEST_JOB, DAILY_DIGEST_CRON, DAILY_DIGEST_TIMEZONE]).toEqual(['daily-digest', '0 11 * * *', 'Asia/Kolkata']);
    expect(cron.schedule).toHaveBeenCalledWith('0 11 * * *', expect.any(Function), { name: 'daily-digest', timezone: 'Asia/Kolkata', noOverlap: true });
    expect(lines).toContain('daily-digest scheduled at 11:00 Asia/Kolkata');
  });

  it('runs the digest when the cron fires, and the next day\'s run still happens after a failed one', async () => {
    cron.schedule.mockReturnValue({ stop: vi.fn() });
    clock.set(new Date('2026-11-20T04:00:00.000Z'));
    scheduleDailyDigest(true, () => dependencies, () => undefined);
    const callback = cron.schedule.mock.calls[0]?.[1];
    if (typeof callback !== 'function') throw new Error('The job was not scheduled.');
    store.failFind = true;
    clock.set(AT_ELEVEN);
    await callback();
    store.failFind = false;
    store.tasks = [task()];
    clock.set(new Date(AT_ELEVEN.getTime() + 24 * MILLISECONDS_PER_HOUR));
    await callback();
    expect(store.calls.enqueued).toHaveLength(1);
    expect(store.calls.enqueued[0]?.idempotencyKey).toBe(`digest:${ARJUN}:2026-11-21`);
  });

  it('the log lines of a run hold the job name, a date and counts, and no name, task code or address', async () => {
    cron.schedule.mockReturnValue({ stop: vi.fn() });
    clock.set(new Date('2026-11-20T04:00:00.000Z'));
    const lines: Array<{ message: string; fields: JobLogFields | undefined }> = [];
    scheduleDailyDigest(true, () => dependencies, (message, _level, fields) => void lines.push({ message, fields }));
    store.tasks = [task({ code: 'Q-SECRET-CODE', title: 'Secret title', assigner: { id: LEAD, name: 'Secret Name', isActive: true } })];
    const callback = cron.schedule.mock.calls[0]?.[1];
    if (typeof callback !== 'function') throw new Error('The job was not scheduled.');
    clock.set(AT_ELEVEN);
    await callback();
    expect(JSON.stringify(lines)).not.toMatch(/Q-SECRET-CODE|Secret title|Secret Name|@/);
    expect(lines.some((line) => line.fields?.summary === 'daily-digest 2026-11-20: queued 1, failed 0')).toBe(true);
  });
});

describe('the job reads time from its clock alone (coding standards section 10, "Dates")', () => {
  it('names no Date.now() and no new Date() with no argument', () => {
    const source = readFileSync(fileURLToPath(new URL('../../../src/server/jobs/daily-digest.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/Date\.now\(|new Date\(\s*\)/);
  });

  it('the minute is the unit of the clock fixture (a sanity check of the constants the tests use)', () => {
    expect(MILLISECONDS_PER_MINUTE).toBe(60_000);
  });
});
