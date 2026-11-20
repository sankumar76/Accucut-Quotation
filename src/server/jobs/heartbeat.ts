import { schedule, type ScheduledTask } from 'node-cron';

import { HEARTBEAT_CRON, HEARTBEAT_JOB } from '../../lib/health/heartbeat';

import { runJob, type JobLogger, type JobOutcome } from './run-job';

/** The cron's zone: every job of the worker is read in Indian Standard Time, though a job that runs every minute does not care. */
export const HEARTBEAT_TIMEZONE = 'Asia/Kolkata';

/**
 * The worker's `heartbeat` job (STORY-10.09a AC-4; NFR-012; architecture sections 4.7 and 9.4). Every minute, and once at once when the worker starts (so `/api/health` is green as
 * soon as the worker is up), it:
 *
 *   1. writes one `job_runs` row, `job = 'heartbeat'`, which is what `GET /api/health` reads (it is red when the newest one is 3 minutes old or more);
 *   2. then calls `prune_heartbeat_runs()`, which removes the heartbeat rows older than 7 days. A prune that fails leaves the new row in place, is logged at `error` and is tried
 *      again by the next heartbeat.
 *
 * The one `info` line a minute is the wrapper's outcome line (`run-job.ts`): the job name, the duration and, when rows were pruned, how many. A heartbeat that cannot write its row
 * throws, so the wrapper logs it at `error`; it writes no `failed` row of its own, because a `failed` heartbeat row would be the newest and would make the health check green.
 *
 * Like the other jobs it imports no repository or driver: the worker passes the store in.
 */

export interface HeartbeatStore {
  recordRun(run: { readonly job: string; readonly startedAt: Date; readonly finishedAt: Date; readonly result: Readonly<Record<string, unknown>> }): Promise<void>;
  /** Removes the heartbeat rows older than 7 days (the SQL function) and returns how many went. */
  pruneHeartbeatRuns(): Promise<number>;
}

export interface HeartbeatDependencies {
  readonly store: HeartbeatStore;
  readonly now: () => Date;
}

/** One heartbeat: writes the row, then prunes. Throws only when the row cannot be written. */
export async function performHeartbeat(dependencies: HeartbeatDependencies): Promise<JobOutcome> {
  const { store, now } = dependencies;
  const startedAt = now();
  await store.recordRun({ job: HEARTBEAT_JOB, startedAt, finishedAt: now(), result: { status: 'ok' } });
  try {
    const removed = await store.pruneHeartbeatRuns();
    return removed > 0 ? { summary: `removed ${removed} old heartbeat row(s)` } : {};
  } catch {
    // The reason is not logged: a database error can carry a connection detail. The new row is already written; the next heartbeat prunes.
    return { summary: 'the row was written, but the old rows could not be removed', level: 'error' };
  }
}

/**
 * Schedules the heartbeat every minute and runs the first one now. It is always on: a worker that is up says so, whatever else is switched off.
 */
export function scheduleHeartbeat(store: HeartbeatStore, log: JobLogger, now: () => Date = () => new Date()): ScheduledTask {
  const run = (): Promise<void> => runJob({ name: HEARTBEAT_JOB, log, now, frequent: true }, () => performHeartbeat({ store, now }));
  const task = schedule(HEARTBEAT_CRON, run, { name: HEARTBEAT_JOB, timezone: HEARTBEAT_TIMEZONE, noOverlap: true });
  void run();
  log('heartbeat scheduled every minute', 'info', { job: HEARTBEAT_JOB });
  return task;
}
