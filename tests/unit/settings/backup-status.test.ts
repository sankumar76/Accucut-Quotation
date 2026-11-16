import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createFixedClock, MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR } from '@/lib/time';
import {
  BACKUP_LATE_AFTER_DAYS,
  deriveBackupStatus,
  DISK_NEARLY_FULL_BELOW_PERCENT,
  isBackupLate,
  DISK_READING_STALE_AFTER_DAYS,
  type DiskReadingRow,
} from '@/lib/settings/backup-status';

/**
 * STORY-02.09 (AQP-307) AC-1 to AC-4 and AC-8, the rules that turn what `job_runs` holds into what the Settings page says, with a controlled clock. Nothing here reads a
 * database: the repository hands over the newest good backup and the newest free-space reading, and `deriveBackupStatus` decides "late", "nearly full" and "stale". The newest-wins
 * choice between a weekly `backup` row and a daily `backup-watch` row, and the failed-run rule, are SQL and are tested against PostgreSQL in
 * `tests/integration/settings/settings.test.ts`. Every figure is invented.
 */

const NOW = new Date('2026-11-15T10:00:00.000Z');
const clock = createFixedClock(NOW);
const daysAgo = (days: number): Date => new Date(clock.now().getTime() - days * MILLISECONDS_PER_DAY);
const hoursAgo = (hours: number): Date => new Date(clock.now().getTime() - hours * MILLISECONDS_PER_HOUR);

const TOTAL = 1_000_000_000_000;
const reading = (freePercentOfTotal: number, readAt: Date = hoursAgo(1)): DiskReadingRow => ({ readAt, freeBytes: (TOTAL / 100) * freePercentOfTotal, totalBytes: TOTAL });

describe('the thresholds are named constants (the story names them)', () => {
  it('are 8 days, 20 percent and 3 days', () => {
    expect(BACKUP_LATE_AFTER_DAYS).toBe(8);
    expect(DISK_NEARLY_FULL_BELOW_PERCENT).toBe(20);
    expect(DISK_READING_STALE_AFTER_DAYS).toBe(3);
  });
});

describe('AC-1, AC-2: "Backup late" after more than 8 days, and not before', () => {
  it('a good backup 7 days ago: its time is passed on, and the backup is not late', () => {
    const status = deriveBackupStatus({ lastGoodBackupAt: daysAgo(7), diskReading: null }, clock.now());
    expect(status.lastGoodBackupAt).toEqual(daysAgo(7));
    expect(status.backupLate).toBe(false);
  });

  it('exactly 8 days ago is not late', () => {
    expect(deriveBackupStatus({ lastGoodBackupAt: daysAgo(8), diskReading: null }, clock.now()).backupLate).toBe(false);
  });

  it('one millisecond over 8 days is late', () => {
    const justOver = new Date(daysAgo(8).getTime() - 1);
    expect(deriveBackupStatus({ lastGoodBackupAt: justOver, diskReading: null }, clock.now()).backupLate).toBe(true);
  });

  it('9 days ago is late', () => {
    expect(deriveBackupStatus({ lastGoodBackupAt: daysAgo(9), diskReading: null }, clock.now()).backupLate).toBe(true);
  });

  it('a time in the future (a host clock a little ahead) is not late', () => {
    expect(deriveBackupStatus({ lastGoodBackupAt: new Date(NOW.getTime() + MILLISECONDS_PER_HOUR), diskReading: null }, clock.now()).backupLate).toBe(false);
  });
});

describe('STORY-10.05 AC-10 (replaces 02.09 AC-3): no good backup yet IS late', () => {
  it('has no time, and the backup is late', () => {
    const status = deriveBackupStatus({ lastGoodBackupAt: null, diskReading: null }, clock.now());
    expect(status.lastGoodBackupAt).toBeNull();
    expect(status.backupLate).toBe(true);
  });

  it('isBackupLate: no row at all and only failed rows (the repository then answers null) are late; 7 and 8 days are not; 8 days and a millisecond, and 9 days, are', () => {
    expect(isBackupLate(null, clock.now())).toBe(true);
    expect(isBackupLate(daysAgo(7), clock.now())).toBe(false);
    expect(isBackupLate(daysAgo(8), clock.now())).toBe(false);
    expect(isBackupLate(new Date(daysAgo(8).getTime() - 1), clock.now())).toBe(true);
    expect(isBackupLate(daysAgo(9), clock.now())).toBe(true);
  });

  it('a later failed run cannot reset the clock: the function takes the newest GOOD backup only, so a 9-day-old good one stays late whatever ran since', () => {
    expect(isBackupLate(daysAgo(9), clock.now())).toBe(true);
  });

  it('the worker job and the Settings service both take the rule from this module, so they cannot drift', () => {
    const watch = readFileSync(fileURLToPath(new URL('../../../src/server/jobs/backup-watch.ts', import.meta.url)), 'utf8');
    const service = readFileSync(fileURLToPath(new URL('../../../src/server/services/settings-service.ts', import.meta.url)), 'utf8');
    const rule = readFileSync(fileURLToPath(new URL('../../../src/lib/settings/backup-status.ts', import.meta.url)), 'utf8');
    expect(watch).toMatch(/import \{[^}]*\bisBackupLate\b[^}]*\} from '\.\.\/\.\.\/lib\/settings\/backup-status'/);
    expect(watch).not.toMatch(/BACKUP_LATE_AFTER_DAYS \*/);
    expect(service).toMatch(/import \{ deriveBackupStatus \} from '\.\.\/\.\.\/lib\/settings\/backup-status'/);
    expect(rule).toContain('const backupLate = isBackupLate(lastGoodBackupAt, now);');
    expect(service).not.toMatch(/BACKUP_LATE_AFTER_DAYS|MILLISECONDS_PER_DAY/);
  });
});

describe('AC-4: the free percentage and "Disk nearly full" below 20 percent', () => {
  it.each([
    [25, 25, false],
    [20, 20, false],
    [19, 19, true],
    [100, 100, false],
    [0, 0, true],
  ] as const)('%s percent free reads %s percent and nearly-full is %s', (free, shown, nearlyFull) => {
    const status = deriveBackupStatus({ lastGoodBackupAt: null, diskReading: reading(free) }, clock.now());
    expect(status.diskReading?.freePercent).toBe(shown);
    expect(status.diskNearlyFull).toBe(nearlyFull);
  });

  it('exactly 20 percent in bytes is not nearly full, and one byte less is', () => {
    const exact = deriveBackupStatus({ lastGoodBackupAt: null, diskReading: { readAt: hoursAgo(1), freeBytes: 200, totalBytes: 1000 } }, clock.now());
    expect(exact.diskNearlyFull).toBe(false);
    expect(exact.diskReading?.freePercent).toBe(20);
    const oneLess = deriveBackupStatus({ lastGoodBackupAt: null, diskReading: { readAt: hoursAgo(1), freeBytes: 199, totalBytes: 1000 } }, clock.now());
    expect(oneLess.diskNearlyFull).toBe(true);
    // The figure is never rounded up to 20 beside a notice that says "less than 20 %".
    expect(oneLess.diskReading?.freePercent).toBe(19);
  });

  it('shows a whole percentage that never rounds up (29 percent stays 29 despite binary fractions)', () => {
    const status = deriveBackupStatus({ lastGoodBackupAt: null, diskReading: { readAt: hoursAgo(1), freeBytes: 29, totalBytes: 100 } }, clock.now());
    expect(status.diskReading?.freePercent).toBe(29);
  });

  it('no reading at all: no figure and no notice', () => {
    const status = deriveBackupStatus({ lastGoodBackupAt: daysAgo(1), diskReading: null }, clock.now());
    expect(status.diskReading).toBeNull();
    expect(status.diskNearlyFull).toBe(false);
  });

  it.each([
    ['a total of zero', { freeBytes: 0, totalBytes: 0 }],
    ['free space above the total', { freeBytes: 11, totalBytes: 10 }],
    ['negative free space', { freeBytes: -1, totalBytes: 10 }],
    ['a figure that is not a number', { freeBytes: Number.NaN, totalBytes: 10 }],
    ['a figure that is infinite', { freeBytes: 1, totalBytes: Number.POSITIVE_INFINITY }],
  ])('%s is not a reading: no figure and no notice', (_name, bytes) => {
    const status = deriveBackupStatus({ lastGoodBackupAt: null, diskReading: { readAt: hoursAgo(1), ...bytes } }, clock.now());
    expect(status.diskReading).toBeNull();
    expect(status.diskNearlyFull).toBe(false);
  });
});

describe('AC-4: the age of the reading, and a reading more than 3 days old', () => {
  it('a reading 2 hours old: its age in seconds, not stale', () => {
    const status = deriveBackupStatus({ lastGoodBackupAt: null, diskReading: reading(50, hoursAgo(2)) }, clock.now());
    expect(status.diskReading).toMatchObject({ ageSeconds: 7200, stale: false, readAt: hoursAgo(2) });
  });

  it('exactly 3 days old is not stale; over 3 days is', () => {
    expect(deriveBackupStatus({ lastGoodBackupAt: null, diskReading: reading(50, daysAgo(3)) }, clock.now()).diskReading?.stale).toBe(false);
    expect(deriveBackupStatus({ lastGoodBackupAt: null, diskReading: reading(50, new Date(daysAgo(3).getTime() - 1)) }, clock.now()).diskReading?.stale).toBe(true);
  });

  it('a stale reading still says whether the disk was nearly full when it was read', () => {
    const status = deriveBackupStatus({ lastGoodBackupAt: null, diskReading: reading(10, daysAgo(5)) }, clock.now());
    expect(status.diskReading?.stale).toBe(true);
    expect(status.diskNearlyFull).toBe(true);
  });

  it('a reading time in the future has an age of 0 seconds', () => {
    const status = deriveBackupStatus({ lastGoodBackupAt: null, diskReading: reading(50, new Date(NOW.getTime() + 5000)) }, clock.now());
    expect(status.diskReading?.ageSeconds).toBe(0);
    expect(status.diskReading?.stale).toBe(false);
  });
});
