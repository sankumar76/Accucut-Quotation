import { deriveBackupStatus } from '../../lib/settings/backup-status';
import type { Clock } from '../../lib/time';
import type { JobRunRepository } from '../repositories/job-run-repository';

/**
 * The Settings page's reading of the backups and the server disk (STORY-02.09; FR-105, NFR-013). It asks `job_runs` two questions (the newest good backup, the newest free-space
 * reading of either job) and lets `deriveBackupStatus` decide "late", "nearly full" and "stale" against the clock it was given, so a test sets the time. It answers with times as ISO
 * text, the shape the API sends and the page draws.
 *
 * It reads nothing else of a row: no path, volume name or other key a writer put in `result` can reach a caller. Admin only, and the routes and the page that call it are in the
 * manifest for the Admin alone; it is listed as a service an Engineer view may not import (`tests/security/engineer-import-rule.test.ts`).
 */

export interface DiskReadingView {
  /** Whole percent of the disk that is free, rounded down. */
  readonly freePercent: number;
  readonly readAt: string;
  readonly ageSeconds: number;
  readonly stale: boolean;
}

export interface BackupStatusView {
  /** When the newest good backup finished, or null when none has finished yet. */
  readonly lastGoodBackupAt: string | null;
  readonly backupLate: boolean;
  readonly diskReading: DiskReadingView | null;
  readonly diskNearlyFull: boolean;
}

export interface SettingsService {
  getBackupStatus(): Promise<BackupStatusView>;
}

export interface SettingsServiceDependencies {
  readonly jobRuns: JobRunRepository;
  readonly clock: Clock;
}

export function createSettingsService({ jobRuns, clock }: SettingsServiceDependencies): SettingsService {
  return {
    async getBackupStatus() {
      const [lastGoodBackupAt, diskReading] = await Promise.all([jobRuns.latestGoodBackupAt(), jobRuns.latestDiskReading()]);
      const status = deriveBackupStatus({ lastGoodBackupAt, diskReading }, clock.now());
      return {
        lastGoodBackupAt: status.lastGoodBackupAt === null ? null : status.lastGoodBackupAt.toISOString(),
        backupLate: status.backupLate,
        diskReading:
          status.diskReading === null
            ? null
            : { freePercent: status.diskReading.freePercent, readAt: status.diskReading.readAt.toISOString(), ageSeconds: status.diskReading.ageSeconds, stale: status.diskReading.stale },
        diskNearlyFull: status.diskNearlyFull,
      };
    },
  };
}
