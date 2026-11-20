import { MILLISECONDS_PER_MINUTE } from '../time';

/**
 * The worker's heartbeat and what `GET /api/health` makes of it (STORY-10.09a AC-4, AC-6; NFR-012; architecture sections 4.7 and 9.4).
 *
 * The worker writes one `job_runs` row a minute with `job = 'heartbeat'`. The health check is green only while the newest such row finished less than
 * {@link HEARTBEAT_MAX_AGE_MINUTES} minutes ago: a worker that has stopped, hung or lost its database turns it red within three minutes. Pure: the clock is a parameter,
 * so a test sets "now" to 2 min 59 s and to 3 min 1 s after a row.
 */

/** The job name of the worker's heartbeat row. */
export const HEARTBEAT_JOB = 'heartbeat';

/** The heartbeat is written every minute (the worker's cron). */
export const HEARTBEAT_CRON = '* * * * *';

/** A heartbeat older than this is a dead worker (architecture section 9.4: "under 3 minutes old"). */
export const HEARTBEAT_MAX_AGE_MINUTES = 3;

/** Heartbeat rows are kept for this many days, then removed by `prune_heartbeat_runs()` (architecture section 5.1: about 10,100 rows at rest). */
export const HEARTBEAT_RETENTION_DAYS = 7;

/**
 * True while the newest heartbeat is less than 3 minutes old: at 2 min 59 s the worker is alive, at exactly 3 min 0 s and after it is not, and no heartbeat at all
 * (`null`) is not. A heartbeat stamped in the future is clock skew and counts as fresh: the worker wrote it a moment ago.
 */
export function isHeartbeatFresh(latestFinishedAt: Date | null, now: Date): boolean {
  if (latestFinishedAt === null) return false;
  return now.getTime() - latestFinishedAt.getTime() < HEARTBEAT_MAX_AGE_MINUTES * MILLISECONDS_PER_MINUTE;
}
