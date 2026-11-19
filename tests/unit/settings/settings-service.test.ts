import { describe, expect, it, vi } from 'vitest';

import { createFixedClock, MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR } from '@/lib/time';
import type { DiskReadingRow } from '@/lib/settings/backup-status';
import type { JobRunRepository } from '@/server/repositories/job-run-repository';
import { createSettingsService } from '@/server/services/settings-service';

import { fakeSettingsDependencies } from '../../support/fake-settings';

/**
 * STORY-02.09 AC-1 to AC-4 and AC-8 at the service: it asks the repository for the newest good backup and the newest free-space reading, takes "now" from the clock it was given,
 * and answers with times as ISO text and nothing of `result` beyond the figures. The repository is a fake with fixed answers; the SQL behind it is tested against PostgreSQL in
 * `tests/integration/settings/settings.test.ts`. Every figure is invented.
 */

const NOW = new Date('2026-11-15T10:00:00.000Z');
const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * MILLISECONDS_PER_DAY);

function fakeRepository(good: Date | null, reading: DiskReadingRow | null): JobRunRepository & { readonly good: ReturnType<typeof vi.fn>; readonly disk: ReturnType<typeof vi.fn> } {
  const goodSpy = vi.fn(() => Promise.resolve(good));
  const diskSpy = vi.fn(() => Promise.resolve(reading));
  return { latestGoodBackupAt: goodSpy, latestDiskReading: diskSpy, good: goodSpy, disk: diskSpy };
}

describe('AC-1: a good backup 7 days ago', () => {
  it('is passed on as ISO text, not late, with no disk reading when there is none', async () => {
    const service = createSettingsService({ ...fakeSettingsDependencies(), jobRuns: fakeRepository(daysAgo(7), null), clock: createFixedClock(NOW) });
    expect(await service.getBackupStatus()).toEqual({ lastGoodBackupAt: daysAgo(7).toISOString(), backupLate: false, diskReading: null, diskNearlyFull: false });
  });
});

describe('AC-2: late after more than 8 days', () => {
  it.each([
    [8, false],
    [9, true],
  ] as const)('a good backup %s days ago: late is %s', async (days, late) => {
    const service = createSettingsService({ ...fakeSettingsDependencies(), jobRuns: fakeRepository(daysAgo(days), null), clock: createFixedClock(NOW) });
    expect((await service.getBackupStatus()).backupLate).toBe(late);
  });

  it('follows the clock it was given: the same row is late once the clock has moved a day', async () => {
    const clock = createFixedClock(NOW);
    const service = createSettingsService({ ...fakeSettingsDependencies(), jobRuns: fakeRepository(daysAgo(8), null), clock });
    expect((await service.getBackupStatus()).backupLate).toBe(false);
    clock.advance(MILLISECONDS_PER_DAY);
    expect((await service.getBackupStatus()).backupLate).toBe(true);
  });
});

describe('STORY-10.05 AC-10 (replaces 02.09 AC-3): no good backup ever', () => {
  it('has no time and is late', async () => {
    const service = createSettingsService({ ...fakeSettingsDependencies(), jobRuns: fakeRepository(null, null), clock: createFixedClock(NOW) });
    expect(await service.getBackupStatus()).toEqual({ lastGoodBackupAt: null, backupLate: true, diskReading: null, diskNearlyFull: false });
  });
});

describe('AC-4: the disk reading', () => {
  const readAt = new Date(NOW.getTime() - 2 * MILLISECONDS_PER_HOUR);

  it('is the free percentage, the time it was read, its age in seconds and whether it is stale', async () => {
    const service = createSettingsService({ ...fakeSettingsDependencies(), jobRuns: fakeRepository(null, { readAt, freeBytes: 250, totalBytes: 1000 }), clock: createFixedClock(NOW) });
    expect(await service.getBackupStatus()).toEqual({
      lastGoodBackupAt: null,
      backupLate: true,
      diskReading: { freePercent: 25, readAt: readAt.toISOString(), ageSeconds: 7200, stale: false },
      diskNearlyFull: false,
    });
  });

  it.each([
    [200, false],
    [199, true],
  ] as const)('%s of 1000 bytes free: nearly full is %s', async (free, nearlyFull) => {
    const service = createSettingsService({ ...fakeSettingsDependencies(), jobRuns: fakeRepository(null, { readAt, freeBytes: free, totalBytes: 1000 }), clock: createFixedClock(NOW) });
    expect((await service.getBackupStatus()).diskNearlyFull).toBe(nearlyFull);
  });

  it('asks the repository once for each question', async () => {
    const repository = fakeRepository(daysAgo(1), { readAt, freeBytes: 500, totalBytes: 1000 });
    await createSettingsService({ ...fakeSettingsDependencies(), jobRuns: repository, clock: createFixedClock(NOW) }).getBackupStatus();
    expect(repository.good).toHaveBeenCalledTimes(1);
    expect(repository.disk).toHaveBeenCalledTimes(1);
  });

  it('lets a failure of the repository through, so the page shows its error state and not a made-up answer', async () => {
    const repository: JobRunRepository = { latestGoodBackupAt: () => Promise.reject(new Error('invented failure')), latestDiskReading: () => Promise.resolve(null) };
    await expect(createSettingsService({ ...fakeSettingsDependencies(), jobRuns: repository, clock: createFixedClock(NOW) }).getBackupStatus()).rejects.toThrow('invented failure');
  });
});
