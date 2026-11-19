import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  describePrune,
  LOG_PRUNE_CRON,
  LOG_PRUNE_TIMEZONE,
  LOG_RETENTION_DAYS,
  pruneLogs,
  scheduleLogPrune,
  type PruneFileSystem,
  type PruneStat,
} from '@/server/jobs/log-prune';

const cron = vi.hoisted(() => ({ schedule: vi.fn() }));
vi.mock('node-cron', () => ({ schedule: cron.schedule }));

/**
 * STORY-10.04 (ADR-015 Amendment 2.1): the worker's daily `log-prune` job deletes only the portal's own logs that are older than 30 days, directly in
 * LOG_DIRECTORY, and nothing else. Real files in a temporary folder; links are described with a fake file system where a real link could not be made.
 */

const DAY = 86_400_000;
const NOW = new Date('2026-11-14T12:00:00Z');

let folder: string;

function makeFile(name: string, ageInDays: number, directory = folder): string {
  const path = join(directory, name);
  writeFileSync(path, 'a log line, never read by the job\n');
  const when = new Date(NOW.getTime() - ageInDays * DAY);
  utimesSync(path, when, when);
  return path;
}

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'accucut-log-prune-'));
  cron.schedule.mockReset();
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe('pruneLogs deletes the portal logs older than 30 days (AC-6, NFR-024)', () => {
  it('deletes a matching file that is 31 days old and keeps one that is 29 days old', async () => {
    const old = makeFile('AccucutApp.wrapper.log', LOG_RETENTION_DAYS + 1);
    const recent = makeFile('AccucutWorker.wrapper.log', LOG_RETENTION_DAYS - 1);
    expect(await pruneLogs(folder, NOW)).toEqual({ status: 'pruned', removed: 1, failed: 0 });
    expect(existsSync(old)).toBe(false);
    expect(existsSync(recent)).toBe(true);
  });

  it.each([
    'AccucutApp.wrapper.log',
    'AccucutApp_20261014.err.log',
    'AccucutApp_20261014.out.log',
    'AccucutWorker.wrapper.log',
    'AccucutWorker_20261014.err.log',
    'install-20261014-093000.log',
    'install-20261014-093000-0a1b2c3d.log',
    'update-20261014-093000.log',
    'update-20261014-093000-0a1b2c3d.log',
  ])('deletes %s when it is old', async (name) => {
    const path = makeFile(name, 40);
    await pruneLogs(folder, NOW);
    expect(existsSync(path)).toBe(false);
  });

  it.each([
    'notes.txt',
    'AccucutApp',
    'XAccucutApp.wrapper.log',
    'AccucutApp-20261014.log',
    'AccucutAppx.log',
    'accucut.log',
    'install-2026.log',
    'install-20261014-093000-XYZ.log',
    'install-20261014-093000.log.bak',
    'update-20261014-093000-0A1B2C3D.log',
    'backup-20261014.log',
    '.env',
  ])('keeps %s even though it is very old (not a name the portal writes)', async (name) => {
    const path = makeFile(name, 400);
    expect(await pruneLogs(folder, NOW)).toEqual({ status: 'pruned', removed: 0, failed: 0 });
    expect(existsSync(path)).toBe(true);
  });

  it('keeps a file that is exactly 30 days old (older than, not as old as)', async () => {
    const path = makeFile('AccucutApp.wrapper.log', LOG_RETENTION_DAYS);
    await pruneLogs(folder, NOW);
    expect(existsSync(path)).toBe(true);
  });

  it('does not enter a sub-folder, and does not delete a folder that has a log name', async () => {
    const lookalike = join(folder, 'AccucutApp_20260101.err.log');
    mkdirSync(lookalike);
    const inner = makeFile('AccucutApp.wrapper.log', 90, lookalike);
    const innerFolder = join(folder, 'archive');
    mkdirSync(innerFolder);
    const archived = makeFile('AccucutWorker.wrapper.log', 90, innerFolder);
    const old = makeFile('install-20260101-000000.log', 90);
    const when = new Date(NOW.getTime() - 90 * DAY);
    utimesSync(lookalike, when, when);
    expect(await pruneLogs(folder, NOW)).toEqual({ status: 'pruned', removed: 1, failed: 0 });
    expect(existsSync(old)).toBe(false);
    expect(existsSync(lookalike)).toBe(true);
    expect(existsSync(inner)).toBe(true);
    expect(existsSync(archived)).toBe(true);
  });

  it('counts a file it cannot delete and goes on with the others', async () => {
    const root = process.platform === 'win32' ? 'C:\\logs' : '/logs';
    const calls: string[] = [];
    const old = NOW.getTime() - 90 * DAY;
    const fake: PruneFileSystem = {
      lstat: (path) => {
        const isFolder = path === root;
        return Promise.resolve({ isSymbolicLink: () => false, isFile: () => !isFolder, isDirectory: () => isFolder, mtimeMs: old });
      },
      readdir: () => Promise.resolve(['AccucutApp.a.log', 'AccucutApp.b.log']),
      unlink: (path) => {
        calls.push(path);
        return path.endsWith('a.log') ? Promise.reject(new Error('in use')) : Promise.resolve();
      },
    };
    expect(await pruneLogs(root, NOW, fake)).toEqual({ status: 'pruned', removed: 1, failed: 1 });
    expect(calls).toHaveLength(2);
  });
});

describe('links are never followed or deleted', () => {
  const root = process.platform === 'win32' ? 'C:\\logs' : '/logs';
  const folderStat: PruneStat = { isSymbolicLink: () => false, isFile: () => false, isDirectory: () => true, mtimeMs: 0 };

  it('skips a matching entry that is a link, however old, and deletes the plain one beside it', async () => {
    const unlinked: string[] = [];
    const old = NOW.getTime() - 90 * DAY;
    const fake: PruneFileSystem = {
      lstat: (path) => {
        if (path === root) return Promise.resolve(folderStat);
        const isLink = path.endsWith('AccucutApp.link.log');
        return Promise.resolve({ isSymbolicLink: () => isLink, isFile: () => !isLink, isDirectory: () => false, mtimeMs: old });
      },
      readdir: () => Promise.resolve(['AccucutApp.link.log', 'AccucutApp.plain.log']),
      unlink: (path) => {
        unlinked.push(path);
        return Promise.resolve();
      },
    };
    expect(await pruneLogs(root, NOW, fake)).toEqual({ status: 'pruned', removed: 1, failed: 0 });
    expect(unlinked).toEqual([join(root, 'AccucutApp.plain.log')]);
  });

  it('does nothing when LOG_DIRECTORY itself is a link (a fake file system)', async () => {
    const readdir = vi.fn<PruneFileSystem['readdir']>();
    const unlink = vi.fn<PruneFileSystem['unlink']>();
    const fake: PruneFileSystem = { lstat: () => Promise.resolve({ ...folderStat, isSymbolicLink: () => true }), readdir, unlink };
    expect(await pruneLogs(root, NOW, fake)).toEqual({ status: 'skipped', reason: 'LOG_DIRECTORY is a link' });
    expect(readdir).not.toHaveBeenCalled();
    expect(unlink).not.toHaveBeenCalled();
  });

  it('does nothing when LOG_DIRECTORY is a real link to a folder of old logs, and leaves the target alone', async () => {
    const target = mkdtempSync(join(tmpdir(), 'accucut-log-prune-target-'));
    const linkPath = join(folder, 'linked');
    try {
      const old = makeFile('AccucutApp.wrapper.log', 90, target);
      symlinkSync(target, linkPath, 'junction');
      expect(await pruneLogs(linkPath, NOW)).toEqual({ status: 'skipped', reason: 'LOG_DIRECTORY is a link' });
      expect(existsSync(old)).toBe(true);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });

  it('does nothing when LOG_DIRECTORY is a file, or is missing', async () => {
    const file = makeFile('plain.txt', 1);
    expect(await pruneLogs(file, NOW)).toEqual({ status: 'skipped', reason: 'LOG_DIRECTORY is not a folder' });
    expect(await pruneLogs(join(folder, 'does-not-exist'), NOW)).toEqual({ status: 'skipped', reason: 'LOG_DIRECTORY cannot be read' });
  });
});

describe('an unset, relative or network LOG_DIRECTORY does nothing, and touches no file system', () => {
  it.each([
    [undefined, 'LOG_DIRECTORY is not set'],
    ['', 'LOG_DIRECTORY is not set'],
    ['   ', 'LOG_DIRECTORY is not set'],
    ['logs', 'LOG_DIRECTORY is not an absolute path'],
    ['.\\logs', 'LOG_DIRECTORY is not an absolute path'],
    ['../logs', 'LOG_DIRECTORY is not an absolute path'],
    ['\\\\server\\share\\logs', 'LOG_DIRECTORY is a network path'],
    ['//server/share/logs', 'LOG_DIRECTORY is a network path'],
  ])('%j', async (directory, reason) => {
    const lstat = vi.fn<PruneFileSystem['lstat']>();
    const readdir = vi.fn<PruneFileSystem['readdir']>();
    const unlink = vi.fn<PruneFileSystem['unlink']>();
    expect(await pruneLogs(directory, NOW, { lstat, readdir, unlink })).toEqual({ status: 'skipped', reason });
    expect(lstat).not.toHaveBeenCalled();
    expect(readdir).not.toHaveBeenCalled();
    expect(unlink).not.toHaveBeenCalled();
  });
});

describe('the worker log line holds counts and reasons only', () => {
  it('says what was removed, how many failed, or why it was skipped', () => {
    expect(describePrune({ status: 'pruned', removed: 3, failed: 0 })).toBe('log-prune removed 3 file(s)');
    expect(describePrune({ status: 'pruned', removed: 1, failed: 2 })).toBe('log-prune removed 1 file(s), 2 could not be removed');
    expect(describePrune({ status: 'skipped', reason: 'LOG_DIRECTORY is a link' })).toBe('log-prune skipped: LOG_DIRECTORY is a link');
  });
});

describe('scheduleLogPrune', () => {
  it('schedules one daily job at 03:30 IST when LOG_DIRECTORY is an absolute path', () => {
    const task = { stop: vi.fn() };
    cron.schedule.mockReturnValue(task);
    const log = vi.fn();
    expect(scheduleLogPrune(folder, log)).toBe(task);
    expect(cron.schedule).toHaveBeenCalledTimes(1);
    const [expression, , options] = cron.schedule.mock.calls[0] as [string, unknown, Record<string, unknown>];
    expect(expression).toBe(LOG_PRUNE_CRON);
    expect(expression).toBe('30 3 * * *');
    expect(options).toMatchObject({ name: 'log-prune', timezone: LOG_PRUNE_TIMEZONE, noOverlap: true });
    expect(LOG_PRUNE_TIMEZONE).toBe('Asia/Kolkata');
    expect(log).toHaveBeenCalledWith('log-prune scheduled daily at 03:30 IST');
  });

  it('schedules nothing, and says why, when LOG_DIRECTORY is unset or relative', () => {
    const log = vi.fn();
    expect(scheduleLogPrune(undefined, log)).toBeUndefined();
    expect(scheduleLogPrune('logs', log)).toBeUndefined();
    expect(cron.schedule).not.toHaveBeenCalled();
    expect(log).toHaveBeenNthCalledWith(1, 'log-prune is off: LOG_DIRECTORY is not set');
    expect(log).toHaveBeenNthCalledWith(2, 'log-prune is off: LOG_DIRECTORY is not an absolute path');
  });

  it('a run prunes the folder and logs a count, and a skipped run logs the reason, as the outcome line of the job wrapper (the folder is checked again at every run)', async () => {
    cron.schedule.mockReturnValue({ stop: vi.fn() });
    const log = vi.fn();
    const old = makeFile('AccucutApp.wrapper.log', 1);
    scheduleLogPrune(folder, log);
    const run = (cron.schedule.mock.calls[0] as [string, () => Promise<void>])[1];
    // A run uses the real clock: make the file 45 days old by it.
    const longAgo = new Date(Date.now() - 45 * DAY);
    utimesSync(old, longAgo, longAgo);
    await run();
    expect(existsSync(old)).toBe(false);
    expect(log).toHaveBeenLastCalledWith(expect.stringMatching(/^log-prune finished in \d+ ms$/), 'info', { job: 'log-prune', durationMs: expect.any(Number), summary: 'log-prune removed 1 file(s)' });
    rmSync(folder, { recursive: true, force: true });
    await run();
    expect(log).toHaveBeenLastCalledWith(expect.stringMatching(/^log-prune finished in \d+ ms$/), 'info', { job: 'log-prune', durationMs: expect.any(Number), summary: 'log-prune skipped: LOG_DIRECTORY cannot be read' });
    mkdirSync(folder);
  });
});
