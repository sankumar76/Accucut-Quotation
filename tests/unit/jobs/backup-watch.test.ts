import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deriveBackupStatus } from '@/lib/settings/backup-status';
import {
  BACKUP_WATCH_CRON,
  BACKUP_WATCH_TIMEZONE,
  checkVolumes,
  describeBackupWatch,
  isBackupLate,
  nodeStatfs,
  performBackupWatch,
  runBackupWatch,
  scheduleBackupWatch,
  type BackupWatchDependencies,
  type BackupWatchOutcome,
  type BackupWatchRun,
  type BackupWatchStore,
  type StatfsFigures,
} from '@/server/jobs/backup-watch';

const cron = vi.hoisted(() => ({ schedule: vi.fn() }));
vi.mock('node-cron', () => ({ schedule: cron.schedule }));
const fsMock = vi.hoisted(() => ({ statfs: vi.fn() }));
vi.mock('node:fs/promises', () => ({ statfs: fsMock.statfs }));

/**
 * STORY-10.05 AC-5 and AC-9 (ADR-011, ADR-015 Amendment 3 point 5): the worker's daily `backup-watch` job reads the free space of the volumes that hold the data folder and the
 * backup folder with `fs.statfs`, flags a week without a good backup, and writes its own `job_runs` row in the shape that STORY-02.09 reads. The clock is fixed and `statfs` and the
 * database store are stubs, so no disk, database or timer is involved.
 */

const DAY = 86_400_000;
const NOW = new Date('2026-11-16T03:30:00Z');

/** A volume of 1000 bytes in blocks of 10: `free` is the number of free blocks times 10. */
function volume(freeBlocks: number, totalBlocks = 100): StatfsFigures {
  return { bsize: 10, blocks: totalBlocks, bavail: freeBlocks };
}

interface Harness {
  readonly dependencies: BackupWatchDependencies;
  readonly statfs: ReturnType<typeof vi.fn<(path: string) => Promise<StatfsFigures>>>;
  readonly recorded: BackupWatchRun[];
  readonly store: BackupWatchStore & { latest: Date | null; failLookup: boolean; failWrite: boolean };
}

function harness(volumes: Record<string, StatfsFigures>, latestGoodBackup: Date | null = new Date(NOW.getTime() - 2 * DAY)): Harness {
  const recorded: BackupWatchRun[] = [];
  const store = {
    latest: latestGoodBackup,
    failLookup: false,
    failWrite: false,
    latestGoodBackupAt(): Promise<Date | null> {
      return this.failLookup ? Promise.reject(new Error('connection to server at "10.1.2.3" failed')) : Promise.resolve(this.latest);
    },
    recordRun(run: BackupWatchRun): Promise<void> {
      if (this.failWrite) return Promise.reject(new Error('permission denied for table job_runs'));
      recorded.push(run);
      return Promise.resolve();
    },
  };
  const statfs = vi.fn((path: string): Promise<StatfsFigures> => {
    const found = volumes[path];
    return found === undefined ? Promise.reject(new Error(`ENOENT: no such file or directory, statfs '${path}'`)) : Promise.resolve(found);
  });
  return { dependencies: { statfs, store, now: () => NOW }, statfs, recorded, store };
}

function ran(outcome: BackupWatchOutcome | { readonly skipped: string }): BackupWatchOutcome {
  if ('skipped' in outcome) throw new Error(`skipped: ${outcome.skipped}`);
  return outcome;
}

beforeEach(() => {
  cron.schedule.mockReset();
  fsMock.statfs.mockReset();
});

describe('checkVolumes: which volumes are measured (AC-5)', () => {
  it('measures nothing, and says why, when neither variable is set or both are blank', () => {
    expect(checkVolumes({})).toEqual({ reason: 'neither PG_DATA_VOLUME nor BACKUP_VOLUME is set' });
    expect(checkVolumes({ dataVolume: '  ', backupVolume: '' })).toEqual({ reason: 'neither PG_DATA_VOLUME nor BACKUP_VOLUME is set' });
  });

  it.each(['C:', 'C:/x', 'C:\\Accucut', '/var', '\\\\server\\share\\', 'CC:/', '1:/', 'C:/ ; DROP', 'file:///C:/'])('refuses %j: only a drive root is measured', (value) => {
    expect(checkVolumes({ backupVolume: value })).toEqual({ reason: 'BACKUP_VOLUME is not a drive root such as C:/' });
    expect(checkVolumes({ dataVolume: value })).toEqual({ reason: 'PG_DATA_VOLUME is not a drive root such as C:/' });
  });

  it('accepts a drive root with a forward or a back slash, and writes it the way fs.statfs takes it', () => {
    expect(checkVolumes({ backupVolume: 'c:\\' })).toEqual({ volumes: [{ role: 'backup', root: 'C:/' }] });
    expect(checkVolumes({ dataVolume: 'D:/' })).toEqual({ volumes: [{ role: 'data', root: 'D:/' }] });
  });

  it('takes one reading when the data folder and the backups are on the same volume, however the drive is written, and two when they are not', () => {
    expect(checkVolumes({ dataVolume: 'C:/', backupVolume: 'c:\\' })).toEqual({ volumes: [{ role: 'data and backup', root: 'C:/' }] });
    expect(checkVolumes({ dataVolume: 'D:/', backupVolume: 'C:/' })).toEqual({
      volumes: [
        { role: 'data', root: 'D:/' },
        { role: 'backup', root: 'C:/' },
      ],
    });
  });

  it('measures the volume that is named when only one is (the install could not find the data folder)', () => {
    expect(checkVolumes({ backupVolume: 'C:/' })).toEqual({ volumes: [{ role: 'backup', root: 'C:/' }] });
  });
});

describe('isBackupLate: a missed week is more than 8 days without a good backup (AC-5)', () => {
  it('is false at exactly 8 days and true one millisecond later; true when there is no good backup at all', () => {
    expect(isBackupLate(new Date(NOW.getTime() - 8 * DAY), NOW)).toBe(false);
    expect(isBackupLate(new Date(NOW.getTime() - 8 * DAY - 1), NOW)).toBe(true);
    expect(isBackupLate(new Date(NOW.getTime() - 1 * DAY), NOW)).toBe(false);
    expect(isBackupLate(null, NOW)).toBe(true);
  });
});

describe('runBackupWatch: the row (AC-5, AC-9)', () => {
  it('reads the free space with statfs on the drive roots, never on a folder, and builds an ok row in the shape that 02.09 reads', async () => {
    const test = harness({ 'C:/': volume(30) });
    const { run } = ran(await runBackupWatch({ dataVolume: 'C:/', backupVolume: 'C:\\' }, test.dependencies));
    expect(test.statfs.mock.calls).toEqual([['C:/']]);
    expect(run.job).toBe('backup-watch');
    expect(run.startedAt).toEqual(NOW);
    expect(run.finishedAt).toEqual(NOW);
    expect(run.result).toEqual({ status: 'ok', freeBytes: 300, totalBytes: 1000, backupLate: false, volumes: [{ role: 'data and backup', freeBytes: 300, totalBytes: 1000 }] });
  });

  it('uses the space available to the process (bavail), not the free blocks (bfree)', async () => {
    const test = harness({ 'C:/': { bsize: 4096, blocks: 1000, bavail: 250, bfree: 900 } as StatfsFigures });
    const { run } = ran(await runBackupWatch({ backupVolume: 'C:/' }, test.dependencies));
    expect(run.result).toMatchObject({ freeBytes: 250 * 4096, totalBytes: 1000 * 4096 });
  });

  it('with two volumes, records the figures of the one nearest to full, and per volume only a role and two figures', async () => {
    const test = harness({ 'D:/': volume(80), 'C:/': volume(15) });
    const { run } = ran(await runBackupWatch({ dataVolume: 'D:/', backupVolume: 'C:/' }, test.dependencies));
    expect(run.result).toEqual({
      status: 'ok',
      freeBytes: 150,
      totalBytes: 1000,
      backupLate: false,
      volumes: [
        { role: 'data', freeBytes: 800, totalBytes: 1000 },
        { role: 'backup', freeBytes: 150, totalBytes: 1000 },
      ],
    });
  });

  it('writes no path, no drive letter and no volume name into the row', async () => {
    const test = harness({ 'D:/': volume(80), 'C:/': volume(15) });
    const { run } = ran(await runBackupWatch({ dataVolume: 'D:/', backupVolume: 'C:/' }, test.dependencies));
    const text = JSON.stringify(run);
    expect(text).not.toMatch(/[A-Za-z]:[\\/]|\\\\|accucut|Program Files/i);
  });

  it('is exactly the contract of STORY-02.09: the Settings page derives "Disk nearly full" from the figures of this row', async () => {
    const test = harness({ 'C:/': volume(19) });
    const { run } = ran(await runBackupWatch({ backupVolume: 'C:/' }, test.dependencies));
    if (run.result.status !== 'ok') throw new Error('expected an ok row');
    const status = deriveBackupStatus({ lastGoodBackupAt: null, diskReading: { readAt: run.finishedAt, freeBytes: run.result.freeBytes, totalBytes: run.result.totalBytes } }, NOW);
    expect(status.diskReading?.freePercent).toBe(19);
    expect(status.diskNearlyFull).toBe(true);
    const roomy = harness({ 'C:/': volume(20) });
    const second = ran(await runBackupWatch({ backupVolume: 'C:/' }, roomy.dependencies)).run;
    if (second.result.status !== 'ok') throw new Error('expected an ok row');
    expect(deriveBackupStatus({ lastGoodBackupAt: null, diskReading: { readAt: second.finishedAt, freeBytes: second.result.freeBytes, totalBytes: second.result.totalBytes } }, NOW).diskNearlyFull).toBe(false);
  });

  it('flags a missed week in the row: late with a 9-day-old backup, not late with a 2-day-old one, late when there is none', async () => {
    const late = harness({ 'C:/': volume(50) }, new Date(NOW.getTime() - 9 * DAY));
    expect(ran(await runBackupWatch({ backupVolume: 'C:/' }, late.dependencies)).run.result.backupLate).toBe(true);
    const fine = harness({ 'C:/': volume(50) }, new Date(NOW.getTime() - 2 * DAY));
    expect(ran(await runBackupWatch({ backupVolume: 'C:/' }, fine.dependencies)).run.result.backupLate).toBe(false);
    const none = harness({ 'C:/': volume(50) }, null);
    expect(ran(await runBackupWatch({ backupVolume: 'C:/' }, none.dependencies)).backupLate).toBe(true);
  });

  it('a volume that cannot be read makes a failed row with a reason that names the role only (never the path or the error) and no figures, and still flags a missed week', async () => {
    const test = harness({}, new Date(NOW.getTime() - 10 * DAY));
    const { run } = ran(await runBackupWatch({ dataVolume: 'D:/', backupVolume: 'C:/' }, test.dependencies));
    expect(run.result).toEqual({ status: 'failed', message: 'the free space of the data volume could not be read', backupLate: true });
    expect(JSON.stringify(run)).not.toMatch(/ENOENT|D:|C:/);
  });

  it.each([
    ['more free than total', { bsize: 10, blocks: 10, bavail: 20 }],
    ['an empty disk', { bsize: 10, blocks: 0, bavail: 0 }],
    ['a negative figure', { bsize: 10, blocks: 10, bavail: -1 }],
    ['not a number', { bsize: Number.NaN, blocks: 10, bavail: 5 }],
  ])('refuses figures that are not a disk (%s): a failed row, so the page never shows a number that was not measured', async (_name, figures) => {
    const test = harness({ 'C:/': figures });
    const { run } = ran(await runBackupWatch({ backupVolume: 'C:/' }, test.dependencies));
    expect(run.result).toEqual({ status: 'failed', message: 'the free space of the backup volume gave no usable figures', backupLate: false });
  });

  it('is skipped, writing nothing, when no volume is configured', async () => {
    const test = harness({});
    expect(await runBackupWatch({}, test.dependencies)).toEqual({ skipped: 'neither PG_DATA_VOLUME nor BACKUP_VOLUME is set' });
    expect(test.statfs).not.toHaveBeenCalled();
    expect(test.recorded).toHaveLength(0);
  });
});

describe('performBackupWatch: one scheduled run never throws, and says what matters (AC-5)', () => {
  it('writes its own row and logs the free percentage at info when all is well', async () => {
    const test = harness({ 'C:/': volume(42) });
    const lines: Array<[string, string | undefined]> = [];
    await performBackupWatch({ backupVolume: 'C:/' }, test.dependencies, (message, level) => lines.push([message, level]));
    expect(test.recorded).toHaveLength(1);
    expect(lines).toEqual([['backup-watch: 42 % of the disk is free', 'info']]);
  });

  it('logs at error, and still writes the row, when there has been no good backup for more than 8 days', async () => {
    const test = harness({ 'C:/': volume(42) }, new Date(NOW.getTime() - 9 * DAY));
    const lines: Array<[string, string | undefined]> = [];
    await performBackupWatch({ backupVolume: 'C:/' }, test.dependencies, (message, level) => lines.push([message, level]));
    expect(lines).toEqual([['backup-watch: 42 % of the disk is free; NO GOOD BACKUP in the last 8 days', 'error']]);
    expect(test.recorded[0]?.result.backupLate).toBe(true);
  });

  it('logs a failed reading at error and writes the failed row', async () => {
    const test = harness({});
    const lines: Array<[string, string | undefined]> = [];
    await performBackupWatch({ backupVolume: 'C:/' }, test.dependencies, (message, level) => lines.push([message, level]));
    expect(lines).toEqual([['backup-watch failed: the free space of the backup volume could not be read', 'error']]);
    expect(test.recorded[0]?.result.status).toBe('failed');
  });

  it('says it is skipped, and writes nothing, when no volume is configured', async () => {
    const test = harness({});
    const lines: Array<[string, string | undefined]> = [];
    await performBackupWatch({}, test.dependencies, (message, level) => lines.push([message, level]));
    expect(lines).toEqual([['backup-watch skipped: neither PG_DATA_VOLUME nor BACKUP_VOLUME is set', undefined]]);
    expect(test.recorded).toHaveLength(0);
  });

  it('does not throw, and does not repeat the database error, when the database cannot be read or written', async () => {
    const readFails = harness({ 'C:/': volume(42) });
    readFails.store.failLookup = true;
    const writeFails = harness({ 'C:/': volume(42) });
    writeFails.store.failWrite = true;
    for (const test of [readFails, writeFails]) {
      const lines: string[] = [];
      await expect(performBackupWatch({ backupVolume: 'C:/' }, test.dependencies, (message) => lines.push(message))).resolves.toBeUndefined();
      expect(lines.at(-1)).toBe('backup-watch could not read or write the job record');
      expect(lines.join('\n')).not.toMatch(/10\.1\.2\.3|permission denied|job_runs/);
    }
  });
});

describe('describeBackupWatch', () => {
  it('rounds the free percentage down, so a notice never reads "20 %" beside "less than 20 %"', () => {
    expect(describeBackupWatch({ status: 'ok', freeBytes: 199, totalBytes: 1000, backupLate: false, volumes: [] })).toBe('backup-watch: 19 % of the disk is free');
  });
});

describe('scheduleBackupWatch: daily at 09:00 IST, only when a volume is named (AC-5)', () => {
  const store: BackupWatchStore = { latestGoodBackupAt: () => Promise.resolve(null), recordRun: () => Promise.resolve() };

  it('is off, and says why, with no volume or a volume that is not a drive root; nothing is scheduled', () => {
    const lines: string[] = [];
    expect(scheduleBackupWatch({}, store, (message) => lines.push(message))).toBeUndefined();
    expect(scheduleBackupWatch({ backupVolume: 'C:/Accucut/backups' }, store, (message) => lines.push(message))).toBeUndefined();
    expect(lines).toEqual(['backup-watch is off: neither PG_DATA_VOLUME nor BACKUP_VOLUME is set', 'backup-watch is off: BACKUP_VOLUME is not a drive root such as C:/']);
    expect(cron.schedule).not.toHaveBeenCalled();
  });

  it('schedules the run at 09:00 Asia/Kolkata with no overlap, and says so', () => {
    const task = { stop: vi.fn() };
    cron.schedule.mockReturnValue(task);
    const lines: string[] = [];
    expect(scheduleBackupWatch({ dataVolume: 'C:/', backupVolume: 'C:/' }, store, (message) => lines.push(message))).toBe(task);
    expect(BACKUP_WATCH_CRON).toBe('0 9 * * *');
    expect(BACKUP_WATCH_TIMEZONE).toBe('Asia/Kolkata');
    expect(cron.schedule).toHaveBeenCalledWith('0 9 * * *', expect.any(Function), { name: 'backup-watch', timezone: 'Asia/Kolkata', noOverlap: true });
    expect(lines).toEqual(['backup-watch scheduled daily at 09:00 IST']);
  });

  it('the scheduled run reads the volume with the real statfs (BigInt figures become numbers), and writes the row through the store', async () => {
    cron.schedule.mockReturnValue({ stop: vi.fn() });
    fsMock.statfs.mockResolvedValue({ bsize: 4096n, blocks: 1000n, bavail: 400n });
    const recorded: BackupWatchRun[] = [];
    const recordingStore: BackupWatchStore = { latestGoodBackupAt: () => Promise.resolve(new Date(NOW.getTime() - DAY)), recordRun: (run) => Promise.resolve(void recorded.push(run)) };
    scheduleBackupWatch({ backupVolume: 'c:\\' }, recordingStore, () => undefined, () => NOW);
    const callback = cron.schedule.mock.calls[0]?.[1] as () => Promise<void>;
    await callback();
    expect(fsMock.statfs).toHaveBeenCalledWith('C:/');
    expect(recorded[0]?.result).toMatchObject({ status: 'ok', freeBytes: 400 * 4096, totalBytes: 1000 * 4096, backupLate: false });
  });

  it('nodeStatfs hands the three figures over as numbers', async () => {
    fsMock.statfs.mockResolvedValue({ bsize: 4096, blocks: 10, bavail: 5, bfree: 6, files: 0, ffree: 0, type: 0 });
    expect(await nodeStatfs('C:/')).toEqual({ bsize: 4096, blocks: 10, bavail: 5 });
  });
});
