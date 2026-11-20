import { z } from 'zod';

import { HEARTBEAT_JOB } from '../../lib/health/heartbeat';
import { BACKUP_JOB, BACKUP_WATCH_JOB, RUN_STATUS_OK, type DiskReadingRow } from '../../lib/settings/backup-status';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';

/**
 * Reads of `job_runs` for the Settings page (STORY-02.09, architecture section 5.1). The runtime role has SELECT and INSERT on the table and nothing else; this repository only
 * reads, because the rows are written by the weekly backup and by the worker's `backup-watch` job (STORY-10.05), which only write: see `createJobRunWriter` below.
 *
 * Both questions are answered in SQL and return one row at most, so the table can grow for years without the page reading more than it needs (the index
 * `idx_job_runs_job_finished_at` serves the first; the second reads the rows of two jobs, a handful a week, newest first). The repository returns the figures the page needs and
 * nothing else of `result`: a path or a volume name a writer put there never leaves this file.
 */

export interface JobRunRepository {
  /** When the newest backup that finished without errors finished, or null when there is none. A failed run never counts, and so never moves the clock (AC-8). */
  latestGoodBackupAt(): Promise<Date | null>;
  /** The newest free-space figures of a `backup` row or a `backup-watch` row, whichever is newer and whatever its status; null when no row holds them. */
  latestDiskReading(): Promise<DiskReadingRow | null>;
}

interface FinishedAtRow {
  readonly finished_at: Date;
}

interface DiskReadingSqlRow {
  readonly finished_at: Date;
  readonly free_bytes: number;
  readonly total_bytes: number;
}

/** One row of `job_runs`. A run is recorded once, at its end, with both times, and is never changed afterwards (the runtime role cannot UPDATE it). */
export interface JobRunRecord {
  readonly job: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  /** A JSON object with `status`, and for a disk reading `freeBytes` and `totalBytes` (src/lib/settings/backup-status.ts). Figures and a reason, never a path. */
  readonly result: Readonly<Record<string, unknown>>;
}

/** The one write the worker makes to `job_runs` (STORY-10.05): its daily `backup-watch` row. */
export interface JobRunWriter {
  recordRun(run: JobRunRecord): Promise<void>;
}

export function createJobRunWriter(db: PrismaClient): JobRunWriter {
  return {
    recordRun: (run) =>
      withDatabaseErrors(async () => {
        await db.$executeRaw`
          INSERT INTO job_runs (job, started_at, finished_at, result)
          VALUES (${run.job}, ${run.startedAt}, ${run.finishedAt}, ${JSON.stringify(run.result)}::jsonb)`;
      }),
  };
}

export function createJobRunRepository(db: PrismaClient): JobRunRepository {
  return {
    latestGoodBackupAt: () =>
      withDatabaseErrors(async () => {
        const rows = await db.$queryRaw<FinishedAtRow[]>`
          SELECT finished_at
          FROM job_runs
          WHERE job = ${BACKUP_JOB} AND result ->> 'status' = ${RUN_STATUS_OK}
          ORDER BY finished_at DESC, id DESC
          LIMIT 1`;
        return rows[0]?.finished_at ?? null;
      }),

    latestDiskReading: () =>
      withDatabaseErrors(async () => {
        // The casts sit inside CASE so that a row whose figure is not a JSON number is skipped and never makes the cast fail: PostgreSQL does not promise the order in which
        // the conditions of a WHERE are tried. The checks on the figures (a disk with a size, free space within it) are made on the derived columns, in the outer query.
        const rows = await db.$queryRaw<DiskReadingSqlRow[]>`
          SELECT finished_at, free_bytes, total_bytes
          FROM (
            SELECT id, finished_at,
              CASE WHEN jsonb_typeof(result -> 'freeBytes') = 'number' THEN (result ->> 'freeBytes')::double precision END AS free_bytes,
              CASE WHEN jsonb_typeof(result -> 'totalBytes') = 'number' THEN (result ->> 'totalBytes')::double precision END AS total_bytes
            FROM job_runs
            WHERE job IN (${BACKUP_JOB}, ${BACKUP_WATCH_JOB})
          ) AS readings
          WHERE free_bytes IS NOT NULL AND total_bytes > 0 AND free_bytes >= 0 AND free_bytes <= total_bytes
          ORDER BY finished_at DESC, id DESC
          LIMIT 1`;
        const row = rows[0];
        return row === undefined ? null : { readAt: row.finished_at, freeBytes: row.free_bytes, totalBytes: row.total_bytes };
      }),
  };
}

/**
 * The worker's heartbeat and what reads it (STORY-10.09a AC-4, AC-5, AC-6; architecture sections 4.7 and 5.1). Two questions, both in SQL:
 *
 *   - `latestHeartbeatAt`: when the newest `heartbeat` row finished, for `GET /api/health`. One index descent (`idx_job_runs_job_finished_at`), `finished_at` only.
 *   - `pruneHeartbeatRuns`: removes the heartbeat rows older than 7 days by calling `prune_heartbeat_runs()`, a SECURITY DEFINER function of the owner role
 *     (migration `20261119120000_prune_heartbeat_runs`). The runtime role has no DELETE on `job_runs`; the function is the only way it removes anything, it takes no argument and its
 *     predicate is fixed in the function, so nothing here can widen it. It answers how many rows it removed.
 */
export interface HeartbeatRepository {
  /** When the newest `heartbeat` row finished, or null when there is none. */
  latestHeartbeatAt(): Promise<Date | null>;
  /** Removes the heartbeat rows older than 7 days and returns how many went. */
  pruneHeartbeatRuns(): Promise<number>;
}

const prunedRowsSchema = z.array(z.object({ removed: z.number().int().nonnegative() })).length(1);

export function createHeartbeatRepository(db: PrismaClient): HeartbeatRepository {
  return {
    latestHeartbeatAt: () =>
      withDatabaseErrors(async () => {
        const rows = await db.$queryRaw<FinishedAtRow[]>`
          SELECT finished_at
          FROM job_runs
          WHERE job = ${HEARTBEAT_JOB}
          ORDER BY finished_at DESC
          LIMIT 1`;
        return rows[0]?.finished_at ?? null;
      }),

    pruneHeartbeatRuns: () =>
      withDatabaseErrors(async () => {
        const rows = await db.$queryRaw`SELECT public.prune_heartbeat_runs() AS removed`;
        return prunedRowsSchema.parse(rows)[0]?.removed ?? 0;
      }),
  };
}
