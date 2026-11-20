import { lstat, readdir, unlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { schedule, type ScheduledTask } from 'node-cron';

import { runJob, type JobLogger } from './run-job';

/**
 * The daily `log-prune` job of the worker (STORY-10.04, ADR-015 Amendment 2.1; architecture section 9.9): it deletes the service logs and the install and
 * update logs that are older than 30 days from the Windows log folder, so that no scheduled task and no second account is needed for it. It runs as
 * `AccucutWorker`, which already has Modify on that folder and nothing else.
 *
 * What it is allowed to touch, and nothing more:
 *   - only when `LOG_DIRECTORY` is set (the install writes `<Root>\logs` into `.env`), is an absolute path, and is a real folder (not a link);
 *   - only regular files that sit directly in that folder, found with `lstat` (a link is skipped, a sub-folder is never entered, nothing is recursive);
 *   - only names the portal itself writes: WinSW's `AccucutApp...log` and `AccucutWorker...log`, and the install and update logs
 *     `install-<yyyyMMdd>-<HHmmss>[-<8 hex>].log` and `update-...`;
 *   - only when the file was last written more than 30 days ago.
 * It writes no `job_runs` row, and its log lines hold counts and reasons only: never a file name's contents, never a file's contents.
 */

/** The job's name in the log and in the worker's schedule. It writes no `job_runs` row. */
export const LOG_PRUNE_JOB = 'log-prune';

/** How long a log is kept (NFR-024). */
export const LOG_RETENTION_DAYS = 30;

/** 03:30 every day, in Indian Standard Time (the cron expression, and the zone it is read in). */
export const LOG_PRUNE_CRON = '30 3 * * *';
export const LOG_PRUNE_TIMEZONE = 'Asia/Kolkata';

const DAY_MILLISECONDS = 86_400_000;

/**
 * The names of the files that are pruned. WinSW writes `AccucutApp.wrapper.log` and `AccucutApp_<yyyyMMdd>.err.log` (a dot or an underscore after the
 * service name); the install and update scripts write a time stamp and, since the review of 2026-11-14, 8 random hex characters.
 */
const PRUNABLE_NAME = /^(?:(?:AccucutApp|AccucutWorker)[._].*\.log|(?:install|update)-\d{8}-\d{6}(?:-[0-9a-f]{8})?\.log)$/;

/** The part of `fs.Stats` the job reads, so a test can describe a link without making one (a Windows account may not create file links). */
export interface PruneStat {
  isSymbolicLink(): boolean;
  isFile(): boolean;
  isDirectory(): boolean;
  readonly mtimeMs: number;
}

/** The three file system calls the job makes. */
export interface PruneFileSystem {
  lstat(path: string): Promise<PruneStat>;
  readdir(path: string): Promise<string[]>;
  unlink(path: string): Promise<void>;
}

const nodeFileSystem: PruneFileSystem = {
  lstat: (path) => lstat(path),
  readdir: (path) => readdir(path),
  unlink: (path) => unlink(path),
};

export type PruneResult =
  | { readonly status: 'skipped'; readonly reason: string }
  | { readonly status: 'pruned'; readonly removed: number; readonly failed: number };

/** `LOG_DIRECTORY` as a usable folder name (set, absolute, not a network path): the folder, or the reason it is refused. */
function checkDirectory(directory: string | undefined): { readonly folder: string } | { readonly reason: string } {
  if (directory === undefined || directory.trim() === '') return { reason: 'LOG_DIRECTORY is not set' };
  // The network path first: on a POSIX machine (the unit tests) `\\server\share` is not "absolute", and the reason must be the same everywhere.
  if (/^[\\/]{2}/.test(directory)) return { reason: 'LOG_DIRECTORY is a network path' };
  if (!isAbsolute(directory)) return { reason: 'LOG_DIRECTORY is not an absolute path' };
  return { folder: directory };
}

/**
 * Deletes the prunable logs older than {@link LOG_RETENTION_DAYS} days from `directory`. Never throws for a file system problem: a folder it cannot use is
 * a skipped run with a reason, and a file it cannot delete is counted and left.
 */
export async function pruneLogs(configured: string | undefined, now: Date, fs: PruneFileSystem = nodeFileSystem): Promise<PruneResult> {
  const checked = checkDirectory(configured);
  if ('reason' in checked) return { status: 'skipped', reason: checked.reason };
  const directory = checked.folder;

  let names: string[];
  try {
    const folder = await fs.lstat(directory);
    if (folder.isSymbolicLink()) return { status: 'skipped', reason: 'LOG_DIRECTORY is a link' };
    if (!folder.isDirectory()) return { status: 'skipped', reason: 'LOG_DIRECTORY is not a folder' };
    names = await fs.readdir(directory);
  } catch {
    return { status: 'skipped', reason: 'LOG_DIRECTORY cannot be read' };
  }

  const limit = now.getTime() - LOG_RETENTION_DAYS * DAY_MILLISECONDS;
  let removed = 0;
  let failed = 0;
  for (const name of names) {
    if (!PRUNABLE_NAME.test(name)) continue;
    const path = join(directory, name);
    try {
      const entry = await fs.lstat(path);
      if (entry.isSymbolicLink() || !entry.isFile() || entry.mtimeMs >= limit) continue;
      await fs.unlink(path);
      removed += 1;
    } catch {
      failed += 1;
    }
  }
  return { status: 'pruned', removed, failed };
}

/** One line for the worker's log: a count or a reason, nothing from any file. */
export function describePrune(result: PruneResult): string {
  if (result.status === 'skipped') return `log-prune skipped: ${result.reason}`;
  return `log-prune removed ${result.removed} file(s)${result.failed > 0 ? `, ${result.failed} could not be removed` : ''}`;
}

/**
 * Schedules the daily run, or returns `undefined` (and says why) when `LOG_DIRECTORY` is missing or not an absolute path. The folder is checked again at
 * every run, because it may change between runs.
 */
export function scheduleLogPrune(configured: string | undefined, log: JobLogger): ScheduledTask | undefined {
  const checked = checkDirectory(configured);
  if ('reason' in checked) {
    log(`log-prune is off: ${checked.reason}`);
    return undefined;
  }
  const directory = checked.folder;
  const task = schedule(
    LOG_PRUNE_CRON,
    () => runJob({ name: LOG_PRUNE_JOB, log, now: () => new Date() }, async () => ({ summary: describePrune(await pruneLogs(directory, new Date())) })),
    { name: LOG_PRUNE_JOB, timezone: LOG_PRUNE_TIMEZONE, noOverlap: true },
  );
  log('log-prune scheduled daily at 03:30 IST');
  return task;
}
