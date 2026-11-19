import { statfs } from 'node:fs/promises';

import { schedule, type ScheduledTask } from 'node-cron';

import { BACKUP_WATCH_JOB, isBackupLate, RUN_STATUS_OK } from '../../lib/settings/backup-status';

import { runJob, type FailedJobRun, type JobLogger, type JobOutcome } from './run-job';

/**
 * The daily `backup-watch` job of the worker (STORY-10.05 AC-5, AC-9; ADR-011; ADR-015 Amendment 3 point 5; architecture sections 4.7, 9.5 and 9.9).
 *
 * Once a day it does two things and writes one `job_runs` row (`job = 'backup-watch'`), as `accucut_app`, under the worker's own service account:
 *
 *   1. It reads the free space of the volumes that hold the PostgreSQL data folder and the backup folder, with `fs.statfs` on their drive roots. The worker cannot open
 *      either folder (both are protected), but a drive root can always be measured. `PG_DATA_VOLUME` and `BACKUP_VOLUME` come from `.env`, where the install wrote them
 *      (`X:/`); when both name the same volume, one reading is taken. The row holds the figures of the volume that is nearest to full, and, per volume, only a role
 *      (`data`, `backup` or `data and backup`) and its two figures: never a path, a drive letter or any other volume's name.
 *   2. It flags a missed week: no good backup (`job = 'backup'`, `result.status = 'ok'`) in the last 8 days, or none at all (STORY-10.05 AC-10: one rule, `isBackupLate` in
 *      `src/lib/settings/backup-status.ts`, which the Settings service uses too). That is logged at `error` (e-mail follows with the alerts
 *      story) and stored as `result.backupLate`.
 *
 * The row is the contract with STORY-02.09 (`src/lib/settings/backup-status.ts`): `job`, `started_at`, `finished_at`, and `result` with `status`, `freeBytes`, `totalBytes`.
 * A reading that could not be made is a `failed` row with a reason and no figures, so the Settings page never shows a number that was not measured.
 *
 * The job takes its database store and its file system call as parameters (it imports no repository, service or driver: `tests/security/engineer-import-rule.test.ts` classes
 * it), so a test fixes the clock and stubs `statfs`. The worker (`src/worker/main.ts`) supplies the real ones.
 */

/** 09:00 every day, in Indian Standard Time (architecture section 4.7): after the 02:00 Sunday backup, and at an hour when someone may read the log. */
export const BACKUP_WATCH_CRON = '0 9 * * *';
export const BACKUP_WATCH_TIMEZONE = 'Asia/Kolkata';

/** A volume as the install writes it: a drive letter and a root, with a back slash or a forward slash (`C:/`). Nothing else is measured. */
const DRIVE_ROOT = /^[A-Za-z]:[\\/]$/;

/** What `fs.statfs` returns, as far as the job reads it. */
export interface StatfsFigures {
  readonly bsize: number;
  readonly blocks: number;
  readonly bavail: number;
}

/** The one file system call the job makes. */
export type StatfsFunction = (path: string) => Promise<StatfsFigures>;

/** What the job needs from the database: the newest good backup, and a way to write its own row. */
export interface BackupWatchStore {
  latestGoodBackupAt(): Promise<Date | null>;
  /** Writes the row of a run. The wrapper (`run-job.ts`) also uses it for the `failed` row of a run that threw. */
  recordRun(run: BackupWatchRun | FailedJobRun): Promise<void>;
}

export interface VolumeRole {
  readonly role: 'data' | 'backup' | 'data and backup';
}

export interface VolumeFigures extends VolumeRole {
  readonly freeBytes: number;
  readonly totalBytes: number;
}

/** The `result` of a `backup-watch` row. Figures only, and a reason when there are none. */
export type BackupWatchResult =
  | {
      readonly status: typeof RUN_STATUS_OK;
      readonly freeBytes: number;
      readonly totalBytes: number;
      readonly backupLate: boolean;
      readonly volumes: ReadonlyArray<VolumeFigures>;
    }
  | { readonly status: 'failed'; readonly message: string; readonly backupLate: boolean };

export interface BackupWatchRun {
  readonly job: typeof BACKUP_WATCH_JOB;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly result: BackupWatchResult;
}

/** The two variables of `.env` that name the volumes. Both are optional: the job measures what is named, and is off when nothing is. */
export interface BackupWatchVolumes {
  readonly dataVolume?: string | undefined;
  readonly backupVolume?: string | undefined;
}

export interface BackupWatchDependencies {
  readonly statfs: StatfsFunction;
  readonly store: BackupWatchStore;
  readonly now: () => Date;
}

type Checked = { readonly volumes: ReadonlyArray<{ readonly role: VolumeRole['role']; readonly root: string }> } | { readonly reason: string };

function normalise(root: string): string {
  return root.slice(0, 1).toUpperCase() + ':/';
}

/** The volumes to measure, or the reason that none can be: a variable that is set must be a drive root, and one reading is taken when both name the same volume. */
export function checkVolumes(settings: BackupWatchVolumes): Checked {
  const named: Array<{ readonly name: string; readonly value: string; readonly role: 'data' | 'backup' }> = [];
  if (settings.dataVolume !== undefined && settings.dataVolume.trim() !== '') named.push({ name: 'PG_DATA_VOLUME', value: settings.dataVolume.trim(), role: 'data' });
  if (settings.backupVolume !== undefined && settings.backupVolume.trim() !== '') named.push({ name: 'BACKUP_VOLUME', value: settings.backupVolume.trim(), role: 'backup' });
  if (named.length === 0) return { reason: 'neither PG_DATA_VOLUME nor BACKUP_VOLUME is set' };
  for (const entry of named) {
    if (!DRIVE_ROOT.test(entry.value)) return { reason: `${entry.name} is not a drive root such as C:/` };
  }
  const roots = named.map((entry) => ({ role: entry.role, root: normalise(entry.value) }));
  const first = roots[0];
  const second = roots[1];
  if (first !== undefined && second !== undefined && first.root === second.root) return { volumes: [{ role: 'data and backup', root: first.root }] };
  return { volumes: roots };
}

/** Free and total bytes as the user running the process can use them (`bavail`, not `bfree`). */
function figuresOf(raw: StatfsFigures): { readonly freeBytes: number; readonly totalBytes: number } | undefined {
  const freeBytes = raw.bsize * raw.bavail;
  const totalBytes = raw.bsize * raw.blocks;
  if (!Number.isFinite(freeBytes) || !Number.isFinite(totalBytes) || totalBytes <= 0 || freeBytes < 0 || freeBytes > totalBytes) return undefined;
  return { freeBytes, totalBytes };
}

export interface BackupWatchOutcome {
  readonly run: BackupWatchRun;
  readonly backupLate: boolean;
}

/**
 * One run: measures the volumes, looks for a good backup, and builds the row. It writes nothing and throws only when the store cannot answer the backup question
 * (the caller logs that); a volume it cannot measure becomes a `failed` row.
 */
export async function runBackupWatch(settings: BackupWatchVolumes, dependencies: BackupWatchDependencies): Promise<BackupWatchOutcome | { readonly skipped: string }> {
  const checked = checkVolumes(settings);
  if ('reason' in checked) return { skipped: checked.reason };

  const startedAt = dependencies.now();
  const backupLate = isBackupLate(await dependencies.store.latestGoodBackupAt(), startedAt);

  const volumes: VolumeFigures[] = [];
  let failure: string | undefined;
  for (const volume of checked.volumes) {
    try {
      const figures = figuresOf(await dependencies.statfs(volume.root));
      if (figures === undefined) {
        failure = `the free space of the ${volume.role} volume gave no usable figures`;
        break;
      }
      volumes.push({ role: volume.role, ...figures });
    } catch {
      // The message names the role of the volume, never its path, and never the error (it could hold a path).
      failure = `the free space of the ${volume.role} volume could not be read`;
      break;
    }
  }

  const tightest = [...volumes].sort((a, b) => a.freeBytes / a.totalBytes - b.freeBytes / b.totalBytes)[0];
  const result: BackupWatchResult =
    failure !== undefined || tightest === undefined
      ? { status: 'failed', message: failure ?? 'no volume was measured', backupLate }
      : { status: RUN_STATUS_OK, freeBytes: tightest.freeBytes, totalBytes: tightest.totalBytes, backupLate, volumes };
  return { run: { job: BACKUP_WATCH_JOB, startedAt, finishedAt: dependencies.now(), result }, backupLate };
}

/** One line for the worker's log: a status, a percentage and the late flag. Never a path, a drive letter or a figure of anything but the disk. */
export function describeBackupWatch(result: BackupWatchResult): string {
  const late = result.backupLate ? '; NO GOOD BACKUP in the last 8 days' : '';
  if (result.status === 'failed') return `backup-watch failed: ${result.message}${late}`;
  const percent = Math.floor((result.freeBytes * 100) / result.totalBytes);
  return `backup-watch: ${percent} % of the disk is free${late}`;
}

/**
 * One scheduled run: what it found, for the wrapper's log line (`run-job.ts`), and its row written. It throws when the database cannot be read or written; the wrapper then logs
 * the failure by the class of the error only (a database error can carry a connection detail) and writes a `failed` row if it can.
 */
export async function performBackupWatch(settings: BackupWatchVolumes, dependencies: BackupWatchDependencies): Promise<JobOutcome> {
  const outcome = await runBackupWatch(settings, dependencies);
  if ('skipped' in outcome) return { summary: `backup-watch skipped: ${outcome.skipped}` };
  await dependencies.store.recordRun(outcome.run);
  return { summary: describeBackupWatch(outcome.run.result), level: outcome.backupLate || outcome.run.result.status === 'failed' ? 'error' : 'info' };
}

/** The real `fs.statfs`. */
export const nodeStatfs: StatfsFunction = async (path) => {
  const figures = await statfs(path);
  return { bsize: Number(figures.bsize), blocks: Number(figures.blocks), bavail: Number(figures.bavail) };
};

/**
 * Schedules the daily run, or returns `undefined` (and says why) when neither volume is set or one is not a drive root. The volumes are read from `.env` once, at
 * start-up: the install writes them, and a change is a restart.
 */
export function scheduleBackupWatch(settings: BackupWatchVolumes, store: BackupWatchStore, log: JobLogger, now: () => Date = () => new Date()): ScheduledTask | undefined {
  const checked = checkVolumes(settings);
  if ('reason' in checked) {
    log(`backup-watch is off: ${checked.reason}`);
    return undefined;
  }
  const task = schedule(
    BACKUP_WATCH_CRON,
    () =>
      runJob({ name: BACKUP_WATCH_JOB, log, now, recordFailure: (run) => store.recordRun(run) }, () =>
        performBackupWatch(settings, { statfs: nodeStatfs, store, now }),
      ),
    { name: 'backup-watch', timezone: BACKUP_WATCH_TIMEZONE, noOverlap: true },
  );
  log('backup-watch scheduled daily at 09:00 IST');
  return task;
}
