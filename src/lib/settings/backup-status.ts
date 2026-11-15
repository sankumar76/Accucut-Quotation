import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_SECOND } from '../time';

/**
 * What the Settings page says about the backups and the server disk (STORY-02.09 AC-1 to AC-4, AC-8; FR-105, NFR-013; architecture sections 5.1 and 9.9).
 *
 * The rows it reads are in `job_runs`, written by the weekly backup (`job = 'backup'`) and by the daily worker job (`job = 'backup-watch'`, STORY-10.05). This file is the
 * contract between the two stories, in code:
 *
 *   job_runs row:  job, started_at, finished_at, result (JSONB object)
 *   result:        { "status": "ok" | "failed", "sizeBytes": number, "freeBytes": number, "totalBytes": number }
 *
 * "Good" is `result.status = 'ok'` on a `backup` row. A free-space reading is `freeBytes` and `totalBytes` on a row of either job, whatever its status (a backup refused
 * for lack of room still read the disk). The page shows only the time, the word good or late, the free percentage and the age of the reading: nothing else of `result` leaves
 * the server, so a path or a volume name a writer put there is never shown.
 *
 * Pure: the clock is a parameter, so a test sets "now" to 7, 8 and 9 days after a backup.
 */

/** The job name the weekly backup writes (`backup.ps1`, STORY-10.05). */
export const BACKUP_JOB = 'backup';

/** The job name the daily free-space reading of the worker writes (STORY-10.05, `fs.statfs`). */
export const BACKUP_WATCH_JOB = 'backup-watch';

/** The `result.status` of a run that finished without errors. Any other value is not a good run. */
export const RUN_STATUS_OK = 'ok';

/** "Backup late" shows once the newest good backup is MORE than this many days old: at exactly 8 days there is no notice (AC-2; the architect's threshold). */
export const BACKUP_LATE_AFTER_DAYS = 8;

/** "Disk nearly full" shows when LESS than this percentage of the disk is free: at exactly 20 % there is no notice (AC-4; proposed by the architect). */
export const DISK_NEARLY_FULL_BELOW_PERCENT = 20;

/** A reading older than this many days is shown with its date and no claim that it is current (AC-4). The daily job should make it at most a day old. */
export const DISK_READING_STALE_AFTER_DAYS = 3;

const PERCENT = 100;

/** The newest free-space figures a repository found, already limited to the two jobs above. */
export interface DiskReadingRow {
  readonly readAt: Date;
  readonly freeBytes: number;
  readonly totalBytes: number;
}

/** What the repository hands over: the newest good backup, and the newest free-space reading of either job. Either can be absent. */
export interface BackupStatusInput {
  readonly lastGoodBackupAt: Date | null;
  readonly diskReading: DiskReadingRow | null;
}

export interface DiskReadingStatus {
  /** Whole percent of the disk that is free, rounded DOWN, so "20 %" is never shown beside a notice that says "less than 20 %". */
  readonly freePercent: number;
  readonly readAt: Date;
  /** Seconds between the reading and now; never negative. */
  readonly ageSeconds: number;
  /** True once the reading is more than `DISK_READING_STALE_AFTER_DAYS` old. */
  readonly stale: boolean;
}

export interface BackupStatus {
  /** The finish time of the newest good backup, or null when none has finished yet. */
  readonly lastGoodBackupAt: Date | null;
  /** True only when a good backup exists and is more than 8 days old. With none at all it is false: the portal cannot know the install date (assumption A-1). */
  readonly backupLate: boolean;
  readonly diskReading: DiskReadingStatus | null;
  /** True when the newest reading has less than 20 % free. */
  readonly diskNearlyFull: boolean;
}

/** A reading the arithmetic can use: finite, a disk with a size, and free space between nothing and the whole. */
function isUsable(reading: DiskReadingRow): boolean {
  const { freeBytes, totalBytes } = reading;
  return Number.isFinite(freeBytes) && Number.isFinite(totalBytes) && totalBytes > 0 && freeBytes >= 0 && freeBytes <= totalBytes;
}

export function deriveBackupStatus(input: BackupStatusInput, now: Date): BackupStatus {
  const { lastGoodBackupAt, diskReading } = input;
  const backupLate = lastGoodBackupAt !== null && now.getTime() - lastGoodBackupAt.getTime() > BACKUP_LATE_AFTER_DAYS * MILLISECONDS_PER_DAY;

  if (diskReading === null || !isUsable(diskReading)) {
    return { lastGoodBackupAt, backupLate, diskReading: null, diskNearlyFull: false };
  }
  const ageMilliseconds = Math.max(0, now.getTime() - diskReading.readAt.getTime());
  return {
    lastGoodBackupAt,
    backupLate,
    diskReading: {
      freePercent: Math.floor((diskReading.freeBytes * PERCENT) / diskReading.totalBytes),
      readAt: diskReading.readAt,
      ageSeconds: Math.floor(ageMilliseconds / MILLISECONDS_PER_SECOND),
      stale: ageMilliseconds > DISK_READING_STALE_AFTER_DAYS * MILLISECONDS_PER_DAY,
    },
    // 20 % is one fifth: free < total / 5 is free * 5 < total, with whole bytes, so the edge is exact and no division rounds it.
    diskNearlyFull: diskReading.freeBytes * (PERCENT / DISK_NEARLY_FULL_BELOW_PERCENT) < diskReading.totalBytes,
  };
}
