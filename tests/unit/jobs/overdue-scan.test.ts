import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { idempotencyKeys } from '@/lib/mail/events';
import { createFixedClock, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE, type FixedClock } from '@/lib/time';
import {
  OVERDUE_SCAN_CRON,
  OVERDUE_SCAN_JOB,
  OVERDUE_SCAN_TIMEZONE,
  OVERDUE_SCAN_WINDOW_MS,
  performOverdueScan,
  runOverdueScan,
  scheduleOverdueScan,
  type OverdueCandidate,
  type OverdueMail,
  type OverdueScanDependencies,
  type OverdueScanRun,
  type OverdueScanStore,
} from '@/server/jobs/overdue-scan';
import { LOGO_CONTENT_ID } from '@/server/mail/layout';
import type { FailedJobRun, JobLogFields, JobLogLevel } from '@/server/jobs/run-job';

const cron = vi.hoisted(() => ({ schedule: vi.fn() }));
vi.mock('node-cron', () => ({ schedule: cron.schedule }));

/**
 * STORY-09.04 (FR-082; NFR-010, NFR-014, NFR-024; architecture section 4.7): the worker's `overdue-scan` job. The clock is fixed, and the database is a stub store that counts what the job
 * asks of it, so no database, timer or mail server is involved (the database and the mail server are `tests/integration/jobs/overdue-scan.test.ts`'s).
 *   AC-1 one outbox message per candidate: the key, the event, the To, the Cc (the assigner, if active), and no address.
 *   AC-6 alerts OFF: the store is not even asked for candidates; the 24-hour window is the one constant handed to the store.
 *   AC-8 a run that queued something writes a `job_runs` row; a run that found nothing writes none; a failed run is logged by the class of its error and recorded by the wrapper.
 *   AC-9 one read for the candidates and one write call for the whole batch, however many tasks there are.
 * Every name, path and value is invented.
 */

const NOW = new Date('2026-11-20T10:00:30.000Z');
const ORIGIN = 'https://portal.example.com';
const ENGINEER_ID = '11111111-1111-4111-8111-111111111111';
const ASSIGNER_ID = '22222222-2222-4222-8222-222222222222';

let counter = 0;
function candidate(overrides: Partial<OverdueCandidate> = {}): OverdueCandidate {
  counter += 1;
  return {
    taskId: `33333333-3333-4333-8333-${String(counter).padStart(12, '0')}`,
    code: `Q-2026-${String(counter).padStart(4, '0')}`,
    title: 'Hopper cover',
    folderPath: '\\\\invented-server\\invented-share\\RFQ 123',
    deadlineAt: new Date(NOW.getTime() - 5 * MILLISECONDS_PER_MINUTE),
    engineerId: ENGINEER_ID,
    assigner: { id: ASSIGNER_ID, name: 'Invented Boss', isActive: true },
    ...overrides,
  };
}

interface FakeStore extends OverdueScanStore {
  alertsOn: boolean;
  candidates: OverdueCandidate[];
  readonly calls: { alertsEnabled: number; findCandidates: Array<{ now: Date; since: Date }>; enqueueAll: OverdueMail[][]; recorded: Array<OverdueScanRun | FailedJobRun> };
  failFind: boolean;
  queuedPerCall: number | null;
}

function fakeStore(): FakeStore {
  const calls: FakeStore['calls'] = { alertsEnabled: 0, findCandidates: [], enqueueAll: [], recorded: [] };
  const store: FakeStore = {
    alertsOn: true,
    candidates: [],
    calls,
    failFind: false,
    queuedPerCall: null,
    alertsEnabled() {
      calls.alertsEnabled += 1;
      return Promise.resolve(store.alertsOn);
    },
    findCandidates(now, since) {
      calls.findCandidates.push({ now, since });
      return store.failFind ? Promise.reject(new Error('connection to server at "10.1.2.3" failed: password authentication failed for user "planted-user"')) : Promise.resolve(store.candidates);
    },
    enqueueAll(messages) {
      calls.enqueueAll.push([...messages]);
      return Promise.resolve({ queued: store.queuedPerCall ?? messages.length });
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
let dependencies: OverdueScanDependencies;

beforeEach(() => {
  clock = createFixedClock(NOW);
  store = fakeStore();
  dependencies = { store, clock, appOrigin: () => ORIGIN };
  cron.schedule.mockReset();
});

describe('AC-6: alerts OFF writes nothing, and the window is one constant', () => {
  it('does not ask for candidates and writes nothing when alerts are off', async () => {
    store.alertsOn = false;
    store.candidates = [candidate()];
    expect(await runOverdueScan(dependencies, NOW)).toEqual({ status: 'skipped', reason: 'alerts-off' });
    expect(store.calls.findCandidates).toEqual([]);
    expect(store.calls.enqueueAll).toEqual([]);
  });

  it('the window is 24 hours (decision D-c), and the store is asked for deadlines between now minus the window and now', async () => {
    expect(OVERDUE_SCAN_WINDOW_MS).toBe(24 * MILLISECONDS_PER_HOUR);
    await runOverdueScan(dependencies, NOW);
    expect(store.calls.findCandidates).toEqual([{ now: NOW, since: new Date(NOW.getTime() - OVERDUE_SCAN_WINDOW_MS) }]);
  });
});

describe('AC-1, AC-7: one outbox message per candidate, by user ID, with the assigner copied', () => {
  it('queues event task-overdue, the key of the task and its deadline, the Engineer as To and the assigner as Cc', async () => {
    const task = candidate();
    store.candidates = [task];
    const outcome = await runOverdueScan(dependencies, NOW);
    expect(outcome).toEqual({ status: 'ok', found: 1, queued: 1 });
    const [message] = store.calls.enqueueAll[0] ?? [];
    expect(message).toMatchObject({ idempotencyKey: idempotencyKeys.taskOverdue(task.taskId, task.deadlineAt), event: 'task-overdue', toUserId: ENGINEER_ID, ccUserIds: [ASSIGNER_ID], subject: `Task overdue: ${task.code}` });
    expect(idempotencyKeys.taskOverdue(task.taskId, task.deadlineAt)).toBe(`task-overdue:${task.taskId}:${task.deadlineAt.toISOString()}`);
    expect(message?.bodyText).toContain('This task is now overdue.');
    expect(message?.bodyText).toContain(`${ORIGIN}/estimates/${task.code}`);
    expect(message?.bodyText).toContain('Overdue by: 5 min');
    expect(message?.bodyHtml).toContain('Open the task');
  });

  it('holds user IDs only: no field of the message is an address, and no address is read from anywhere', async () => {
    store.candidates = [candidate()];
    await runOverdueScan(dependencies, NOW);
    const [message] = store.calls.enqueueAll[0] ?? [];
    expect(Object.keys(message ?? {}).sort()).toEqual(['bodyHtml', 'bodyText', 'ccUserIds', 'event', 'idempotencyKey', 'subject', 'toUserId']);
    // The one `@` a body holds is the logo's content ID, not an address.
    expect(JSON.stringify(message).replaceAll(LOGO_CONTENT_ID, '')).not.toMatch(/@/);
  });

  it('leaves a deactivated assigner off the Cc and still sends the message (decision D-5, DL-262)', async () => {
    store.candidates = [candidate({ assigner: { id: ASSIGNER_ID, name: 'Invented Gone', isActive: false } })];
    await runOverdueScan(dependencies, NOW);
    const [message] = store.calls.enqueueAll[0] ?? [];
    expect(message?.ccUserIds).toEqual([]);
    expect(message?.toUserId).toBe(ENGINEER_ID);
    expect(message?.bodyText).toContain('Invented Gone');
  });

  it('judges overdue by the queue rule: a task due exactly now is not overdue, one millisecond later it is', async () => {
    store.candidates = [candidate({ deadlineAt: NOW }), candidate({ deadlineAt: new Date(NOW.getTime() - 1) })];
    const outcome = await runOverdueScan(dependencies, NOW);
    expect(outcome).toEqual({ status: 'ok', found: 1, queued: 1 });
    expect(store.calls.enqueueAll[0]).toHaveLength(1);
  });

  it('AC-4 (A-09): the same task with a changed deadline gets a different key', async () => {
    const first = candidate();
    const moved = { ...first, deadlineAt: new Date(first.deadlineAt.getTime() + 2 * MILLISECONDS_PER_MINUTE) };
    store.candidates = [first, moved];
    await runOverdueScan(dependencies, NOW);
    const keys = (store.calls.enqueueAll[0] ?? []).map((message) => message.idempotencyKey);
    expect(new Set(keys).size).toBe(2);
  });

  it('AC-3: the same candidates twice give the same keys, which the outbox keeps once', async () => {
    const task = candidate();
    store.candidates = [task];
    await runOverdueScan(dependencies, NOW);
    await runOverdueScan(dependencies, new Date(NOW.getTime() + MILLISECONDS_PER_MINUTE));
    const [first, second] = store.calls.enqueueAll;
    expect(first?.[0]?.idempotencyKey).toBe(second?.[0]?.idempotencyKey);
  });

  it('writes a 23:30 IST deadline as 23:30 IST', async () => {
    const deadlineAt = new Date('2026-11-06T18:00:00.000Z');
    store.candidates = [candidate({ deadlineAt })];
    await runOverdueScan(dependencies, new Date(deadlineAt.getTime() + MILLISECONDS_PER_MINUTE));
    expect(store.calls.enqueueAll[0]?.[0]?.bodyText).toContain('It was due on 06 Nov 2026, 23:30 IST.');
  });
});

describe('AC-9 (NFR-010): the number of database calls does not grow with the number of tasks', () => {
  it.each([1, 200])('%i candidates: one switch read, one read of candidates, one write call for the batch', async (count) => {
    store.candidates = Array.from({ length: count }, () => candidate());
    const outcome = await runOverdueScan(dependencies, NOW);
    expect(outcome).toEqual({ status: 'ok', found: count, queued: count });
    expect(store.calls.alertsEnabled).toBe(1);
    expect(store.calls.findCandidates).toHaveLength(1);
    expect(store.calls.enqueueAll).toHaveLength(1);
    expect(store.calls.enqueueAll[0]).toHaveLength(count);
  });

  it('writes nothing, in no call, when there is no candidate', async () => {
    expect(await runOverdueScan(dependencies, NOW)).toEqual({ status: 'ok', found: 0, queued: 0 });
    expect(store.calls.enqueueAll).toEqual([]);
  });
});

describe('AC-8 (NFR-024): the row of a run, and the log line', () => {
  it('a run that queued messages writes one job_runs row with its status and the counts, and an info line', async () => {
    store.candidates = [candidate(), candidate()];
    const outcome = await performOverdueScan(dependencies);
    expect(outcome).toEqual({ summary: 'overdue-scan: found 2, queued 2', level: 'info' });
    expect(store.calls.recorded).toEqual([{ job: 'overdue-scan', startedAt: NOW, finishedAt: NOW, result: { status: 'ok', found: 2, queued: 2 } }]);
  });

  it('a run that found nothing, one that was skipped and one whose rows were all queued by another run write no row, and are debug lines', async () => {
    expect(await performOverdueScan(dependencies)).toEqual({ summary: 'overdue-scan: found 0, queued 0', level: 'debug' });
    store.alertsOn = false;
    expect(await performOverdueScan(dependencies)).toEqual({ summary: 'overdue-scan skipped: alerts are off', level: 'debug' });
    store.alertsOn = true;
    store.candidates = [candidate()];
    store.queuedPerCall = 0;
    expect(await performOverdueScan(dependencies)).toEqual({ summary: 'overdue-scan: found 1, queued 0', level: 'debug' });
    expect(store.calls.recorded).toEqual([]);
  });

  it('takes the times of its row from the clock it is given', async () => {
    store.candidates = [candidate()];
    let ticks = 0;
    const stepping = { now: () => new Date(NOW.getTime() + 1500 * ticks++) };
    await performOverdueScan({ ...dependencies, clock: stepping });
    expect(store.calls.recorded[0]).toMatchObject({ startedAt: NOW, finishedAt: new Date(NOW.getTime() + 1500) });
  });

  it('a failing store makes the run throw, so the wrapper logs the class of the error and writes the failed row, and the error text never reaches either', async () => {
    store.failFind = true;
    cron.schedule.mockReturnValue({ stop: vi.fn() });
    const lines: Array<{ message: string; level: JobLogLevel | undefined; fields: JobLogFields | undefined }> = [];
    scheduleOverdueScan(true, () => dependencies, (message, level, fields) => void lines.push({ message, level, fields }));
    const callback = cron.schedule.mock.calls[0]?.[1];
    if (typeof callback !== 'function') throw new Error('The job was not scheduled.');
    await expect(callback()).resolves.toBeUndefined();
    const failure = lines.find((line) => line.level === 'error');
    expect(failure?.fields).toMatchObject({ job: 'overdue-scan', errorName: 'Error' });
    expect(JSON.stringify(lines)).not.toMatch(/10\.1\.2\.3|planted-user|password/);
    expect(store.calls.recorded).toEqual([{ job: 'overdue-scan', startedAt: NOW, finishedAt: NOW, result: { status: 'failed', message: 'the run failed' } }]);
    // The next minute's run still happens: the same callback, and the store now answers.
    store.failFind = false;
    store.candidates = [candidate()];
    await callback();
    expect(store.calls.enqueueAll).toHaveLength(1);
  });
});

describe('scheduleOverdueScan: every minute in IST, only when FEATURE_EMAIL is on (AC-1)', () => {
  it('is off, and says why, when the mail feature is off: nothing is built and nothing is scheduled', () => {
    const lines: string[] = [];
    const build = vi.fn(() => dependencies);
    expect(scheduleOverdueScan(false, build, (message) => lines.push(message))).toBeUndefined();
    expect(build).not.toHaveBeenCalled();
    expect(cron.schedule).not.toHaveBeenCalled();
    expect(lines).toEqual(['overdue-scan is off: FEATURE_EMAIL is not on, so it is not scheduled']);
  });

  it('schedules every minute at Asia/Kolkata with no overlap, and says so', () => {
    const task = { stop: vi.fn() };
    cron.schedule.mockReturnValue(task);
    const lines: string[] = [];
    expect(scheduleOverdueScan(true, () => dependencies, (message) => lines.push(message))).toBe(task);
    expect([OVERDUE_SCAN_JOB, OVERDUE_SCAN_CRON, OVERDUE_SCAN_TIMEZONE]).toEqual(['overdue-scan', '* * * * *', 'Asia/Kolkata']);
    expect(cron.schedule).toHaveBeenCalledWith('* * * * *', expect.any(Function), { name: 'overdue-scan', timezone: 'Asia/Kolkata', noOverlap: true });
    expect(lines).toEqual(['overdue-scan scheduled every minute']);
  });

  it('the start line of an every-minute job is a debug line, and a run that did work is an info line', async () => {
    cron.schedule.mockReturnValue({ stop: vi.fn() });
    store.candidates = [candidate()];
    const lines: Array<{ message: string; level: JobLogLevel | undefined }> = [];
    scheduleOverdueScan(true, () => dependencies, (message, level) => void lines.push({ message, level }));
    const callback = cron.schedule.mock.calls[0]?.[1];
    if (typeof callback !== 'function') throw new Error('The job was not scheduled.');
    lines.length = 0;
    await callback();
    expect(lines).toEqual([
      { message: 'overdue-scan started', level: 'debug' },
      { message: 'overdue-scan finished in 0 ms', level: 'info' },
    ]);
  });
});

describe('the job reads time from its clock alone (coding standards section 10, "Dates")', () => {
  it('names no Date.now() and no new Date() with no argument', () => {
    const source = readFileSync(fileURLToPath(new URL('../../../src/server/jobs/overdue-scan.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/Date\.now\(|new Date\(\s*\)/);
  });
});
