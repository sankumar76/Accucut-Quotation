import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HEARTBEAT_CRON, HEARTBEAT_JOB, HEARTBEAT_MAX_AGE_MINUTES, HEARTBEAT_RETENTION_DAYS, isHeartbeatFresh } from '@/lib/health/heartbeat';
import { HEARTBEAT_TIMEZONE, performHeartbeat, scheduleHeartbeat, type HeartbeatStore } from '@/server/jobs/heartbeat';
import type { JobLogFields, JobLogLevel } from '@/server/jobs/run-job';

const cron = vi.hoisted(() => ({ schedule: vi.fn() }));
vi.mock('node-cron', () => ({ schedule: cron.schedule }));

/**
 * STORY-10.09a AC-4 (the heartbeat, v0.56) and the rule behind AC-6 (NFR-012): the worker writes one `heartbeat` row a minute, first at start, then calls
 * `prune_heartbeat_runs()`; `GET /api/health` is green only while the newest row is less than 3 minutes old. The clock is controlled, and the store and `node-cron` are stubs.
 */

const NOW = new Date('2026-11-19T10:00:00.000Z');
const SECOND = 1000;
const ago = (seconds: number): Date => new Date(NOW.getTime() - seconds * SECOND);

describe('isHeartbeatFresh: the 3-minute rule (AC-6)', () => {
  it('[AC-6] is true at 2 min 59 s and false at 3 min 1 s, and false at exactly 3 min 0 s', () => {
    expect(isHeartbeatFresh(ago(179), NOW)).toBe(true);
    expect(isHeartbeatFresh(ago(181), NOW)).toBe(false);
    expect(isHeartbeatFresh(ago(180), NOW)).toBe(false);
  });

  it('[AC-6] is false when there is no heartbeat at all', () => {
    expect(isHeartbeatFresh(null, NOW)).toBe(false);
  });

  it('[AC-6] is true for a heartbeat stamped a moment in the future (clock skew: the worker wrote it just now)', () => {
    expect(isHeartbeatFresh(new Date(NOW.getTime() + 2 * SECOND), NOW)).toBe(true);
  });

  it('[AC-4] names the job, the every-minute schedule, the 3 minutes and the 7 days the story states', () => {
    expect(HEARTBEAT_JOB).toBe('heartbeat');
    expect(HEARTBEAT_CRON).toBe('* * * * *');
    expect(HEARTBEAT_MAX_AGE_MINUTES).toBe(3);
    expect(HEARTBEAT_RETENTION_DAYS).toBe(7);
  });
});

function store(): HeartbeatStore & { readonly events: string[]; readonly recorded: Array<Parameters<HeartbeatStore['recordRun']>[0]>; removed: number; failPrune: boolean; failWrite: boolean } {
  const events: string[] = [];
  const recorded: Array<Parameters<HeartbeatStore['recordRun']>[0]> = [];
  return {
    events,
    recorded,
    removed: 0,
    failPrune: false,
    failWrite: false,
    recordRun(run) {
      if (this.failWrite) return Promise.reject(new Error('connection to server at "10.1.2.3" failed'));
      events.push('write');
      recorded.push(run);
      return Promise.resolve();
    },
    pruneHeartbeatRuns() {
      events.push('prune');
      return this.failPrune ? Promise.reject(new Error('permission denied for function prune_heartbeat_runs')) : Promise.resolve(this.removed);
    },
  };
}

describe('performHeartbeat (AC-4)', () => {
  it('[AC-4] writes one heartbeat row with both times and an ok status, and then prunes, in that order', async () => {
    const test = store();
    const outcome = await performHeartbeat({ store: test, now: () => NOW });
    expect(test.events).toEqual(['write', 'prune']);
    expect(test.recorded).toEqual([{ job: 'heartbeat', startedAt: NOW, finishedAt: NOW, result: { status: 'ok' } }]);
    expect(outcome).toEqual({});
  });

  it('[AC-4] says how many old rows went when the prune removed some', async () => {
    const test = store();
    test.removed = 3;
    expect(await performHeartbeat({ store: test, now: () => NOW })).toEqual({ summary: 'removed 3 old heartbeat row(s)' });
  });

  it('[AC-4] leaves the new row in place and reports the failure at error when the prune fails, without the reason', async () => {
    const test = store();
    test.failPrune = true;
    const outcome = await performHeartbeat({ store: test, now: () => NOW });
    expect(test.recorded).toHaveLength(1);
    expect(outcome.level).toBe('error');
    expect(outcome.summary).toBe('the row was written, but the old rows could not be removed');
    expect(JSON.stringify(outcome)).not.toMatch(/permission denied|prune_heartbeat_runs\b.*function/);
  });

  it('[AC-4] tries the prune again at the next heartbeat after one that failed', async () => {
    const test = store();
    test.failPrune = true;
    await performHeartbeat({ store: test, now: () => NOW });
    test.failPrune = false;
    test.removed = 1;
    expect((await performHeartbeat({ store: test, now: () => NOW })).summary).toBe('removed 1 old heartbeat row(s)');
    expect(test.events).toEqual(['write', 'prune', 'write', 'prune']);
  });

  it('[AC-4] throws, and does not prune, when the row cannot be written (the wrapper logs it)', async () => {
    const test = store();
    test.failWrite = true;
    await expect(performHeartbeat({ store: test, now: () => NOW })).rejects.toThrow();
    expect(test.events).toEqual([]);
  });
});

describe('scheduleHeartbeat (AC-4)', () => {
  beforeEach(() => {
    cron.schedule.mockReset();
  });

  interface Line {
    readonly message: string;
    readonly level: JobLogLevel | undefined;
    readonly fields: JobLogFields | undefined;
  }

  const logTo = (lines: Line[]) => (message: string, level?: JobLogLevel, fields?: JobLogFields) => void lines.push({ message, level, fields });

  it('[AC-4] schedules every minute in Asia/Kolkata with no overlap, and writes the first row at once, so health is green as soon as the worker is up', async () => {
    const task = { stop: vi.fn() };
    cron.schedule.mockReturnValue(task);
    const test = store();
    const lines: Line[] = [];
    expect(scheduleHeartbeat(test, logTo(lines), () => NOW)).toBe(task);
    expect(HEARTBEAT_TIMEZONE).toBe('Asia/Kolkata');
    expect(cron.schedule).toHaveBeenCalledWith('* * * * *', expect.any(Function), { name: 'heartbeat', timezone: 'Asia/Kolkata', noOverlap: true });
    await vi.waitFor(() => expect(test.recorded).toHaveLength(1));
    expect(lines[0]).toEqual({ message: 'heartbeat started', level: 'debug', fields: { job: 'heartbeat' } });
  });

  it('[AC-4] every run writes one row and one info line (and a debug start line), and a run that fails writes no row and no failed row', async () => {
    cron.schedule.mockReturnValue({ stop: vi.fn() });
    const test = store();
    const lines: Line[] = [];
    scheduleHeartbeat(test, logTo(lines), () => NOW);
    await vi.waitFor(() => expect(test.recorded).toHaveLength(1));
    const callback = cron.schedule.mock.calls[0]?.[1] as () => Promise<void>;
    await callback();
    expect(test.recorded).toHaveLength(2);
    expect(lines.filter((line) => line.level === 'info' && line.fields?.job === 'heartbeat' && line.fields.durationMs !== undefined)).toHaveLength(2);

    test.failWrite = true;
    await expect(callback()).resolves.toBeUndefined();
    expect(test.recorded).toHaveLength(2);
    const failures = lines.filter((line) => line.level === 'error');
    expect(failures).toHaveLength(1);
    expect(failures[0]?.fields).toMatchObject({ job: 'heartbeat', errorName: 'Error' });
    expect(JSON.stringify(failures)).not.toContain('10.1.2.3');
  });
});
