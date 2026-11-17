import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createFixedClock, MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR } from '@/lib/time';
import { createJobRunRepository, type JobRunRepository } from '@/server/repositories/job-run-repository';
import { createSettingsService, type SettingsService } from '@/server/services/settings-service';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';

/**
 * STORY-02.09 (AQP-307) against real PostgreSQL, in a throwaway database with every migration applied, as the runtime role the web process uses:
 *   - the table, its grants and its checks (AC-1 of the contract with STORY-10.05: SELECT and INSERT for the runtime role, nothing that changes or removes a row);
 *   - the two questions of the repository: the newest GOOD backup (a failed run after a good one does not move it, AC-8) and the newest free-space reading of EITHER job (AC-4: the
 *     newest wins, a weekly row older than a daily one loses, a row whose figures are not numbers is skipped, nothing else of `result` comes back);
 *   - the service over the real repository with a controlled clock: 7, 8 and 9 days; 25, 20 and 19 percent; no rows.
 *   - the migration's own rollback note works, and the migration runs again over the result.
 * Rows are written as the runtime role, which is how the worker and the backup write them (the owner is used only to look and to tidy). Every figure is invented.
 */

const MIGRATION_SQL = fileURLToPath(new URL('../../../prisma/migrations/20261115090000_job_runs/migration.sql', import.meta.url));
const migration = readFileSync(MIGRATION_SQL, 'utf8');

/** PostgreSQL's code for a statement refused for lack of a privilege, and for a CHECK and a NOT NULL that a row breaks. */
const PERMISSION_DENIED = '42501';
const CHECK_VIOLATION = '23514';
const NOT_NULL_VIOLATION = '23502';

const NOW = new Date('2026-11-15T10:00:00.000Z');
const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * MILLISECONDS_PER_DAY);
const hoursAgo = (hours: number): Date => new Date(NOW.getTime() - hours * MILLISECONDS_PER_HOUR);

const TOTAL = 1_000_000;

let db: AuthDatabase;
let repository: JobRunRepository;
let service: SettingsService;
const clock = createFixedClock(NOW);

interface Row {
  readonly job: string;
  readonly finishedAt: Date;
  readonly result: Readonly<Record<string, unknown>>;
}

/** Adds a row as the runtime role. The run began a minute before it finished. */
async function insert({ job, finishedAt, result }: Row): Promise<void> {
  await db.runtime.query('INSERT INTO job_runs (job, started_at, finished_at, result) VALUES ($1, $2, $3, $4::jsonb)', [job, new Date(finishedAt.getTime() - 60_000), finishedAt, JSON.stringify(result)]);
}

const good = (finishedAt: Date, extra: Record<string, unknown> = {}): Row => ({ job: 'backup', finishedAt, result: { status: 'ok', sizeBytes: 5_000, ...extra } });
const reading = (job: string, finishedAt: Date, freeBytes: number, status = 'ok'): Row => ({ job, finishedAt, result: { status, freeBytes, totalBytes: TOTAL } });

async function failureOf(run: () => Promise<unknown>): Promise<{ readonly code?: string }> {
  try {
    await run();
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') return { code: error.code };
    return {};
  }
  throw new Error('The statement was expected to be refused, and was not.');
}

beforeAll(async () => {
  db = await openAuthDatabase();
  repository = createJobRunRepository(db.prisma);
  service = createSettingsService({ jobRuns: repository, clock });
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.owner.query('DELETE FROM job_runs');
});

describe('the table and its grants', () => {
  it('has exactly the columns of architecture section 5.1: id, job, started_at, finished_at, result', async () => {
    const { rows } = await db.owner.query<{ column_name: string; data_type: string; is_nullable: string }>(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'job_runs' ORDER BY ordinal_position",
    );
    expect(rows).toEqual([
      { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
      { column_name: 'job', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'started_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
      { column_name: 'finished_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
      { column_name: 'result', data_type: 'jsonb', is_nullable: 'NO' },
    ]);
  });

  it('gives the runtime role SELECT and INSERT and nothing that changes or removes a row', async () => {
    const { rows } = await db.owner.query<{ privilege: string; allowed: boolean }>(
      `SELECT p AS privilege, has_table_privilege('accucut_app', 'job_runs', p) AS allowed
       FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS p`,
    );
    expect(Object.fromEntries(rows.map((row) => [row.privilege, row.allowed]))).toEqual({
      SELECT: true,
      INSERT: true,
      UPDATE: false,
      DELETE: false,
      TRUNCATE: false,
      REFERENCES: false,
      TRIGGER: false,
    });
  });

  it('grants the table to the runtime role, to the owner (which holds it) and, since STORY-10.05, to the backup role for INSERT only, and to no one else', async () => {
    const { rows } = await db.owner.query<{ grantee: string }>("SELECT DISTINCT grantee FROM information_schema.table_privileges WHERE table_name = 'job_runs' ORDER BY grantee");
    expect(rows.map((row) => row.grantee)).toEqual(['accucut_app', 'accucut_backup', 'accucut_owner']);
    const backup = await db.owner.query<{ privilege_type: string }>("SELECT privilege_type FROM information_schema.table_privileges WHERE table_name = 'job_runs' AND grantee = 'accucut_backup'");
    expect(backup.rows.map((row) => row.privilege_type)).toEqual(['INSERT']);
  });

  it('lets the runtime role add a row and read it back, and refuses an UPDATE, a DELETE and a TRUNCATE for lack of a grant', async () => {
    await insert(good(daysAgo(1)));
    const { rows } = await db.runtime.query<{ job: string }>('SELECT job FROM job_runs');
    expect(rows).toEqual([{ job: 'backup' }]);
    expect((await failureOf(() => db.runtime.query("UPDATE job_runs SET job = 'other'"))).code).toBe(PERMISSION_DENIED);
    expect((await failureOf(() => db.runtime.query('DELETE FROM job_runs'))).code).toBe(PERMISSION_DENIED);
    expect((await failureOf(() => db.runtime.query('TRUNCATE job_runs'))).code).toBe(PERMISSION_DENIED);
    expect((await db.owner.query('SELECT 1 FROM job_runs')).rowCount).toBe(1);
  });

  it('refuses a blank job, a result that is not an object, and a missing time or result', async () => {
    const stamp = daysAgo(1);
    expect((await failureOf(() => db.runtime.query("INSERT INTO job_runs (job, started_at, finished_at, result) VALUES ('  ', $1, $1, '{}')", [stamp]))).code).toBe(CHECK_VIOLATION);
    expect((await failureOf(() => db.runtime.query("INSERT INTO job_runs (job, started_at, finished_at, result) VALUES ('backup', $1, $1, '[]')", [stamp]))).code).toBe(CHECK_VIOLATION);
    expect((await failureOf(() => db.runtime.query("INSERT INTO job_runs (job, started_at, finished_at, result) VALUES ('backup', $1, $1, '\"ok\"')", [stamp]))).code).toBe(CHECK_VIOLATION);
    expect((await failureOf(() => db.runtime.query("INSERT INTO job_runs (job, started_at, result) VALUES ('backup', $1, '{}')", [stamp]))).code).toBe(NOT_NULL_VIOLATION);
    expect((await failureOf(() => db.runtime.query("INSERT INTO job_runs (job, started_at, finished_at) VALUES ('backup', $1, $1)", [stamp]))).code).toBe(NOT_NULL_VIOLATION);
  });
});

describe('AC-1, AC-8: the newest GOOD backup', () => {
  it('is null when there is no row at all (AC-3)', async () => {
    expect(await repository.latestGoodBackupAt()).toBeNull();
  });

  it('is the finish time of the newest backup row whose status is ok', async () => {
    await insert(good(daysAgo(14)));
    await insert(good(daysAgo(7)));
    expect(await repository.latestGoodBackupAt()).toEqual(daysAgo(7));
  });

  it('AC-8: a failed run after a good one does not move it, and a failed run alone gives null', async () => {
    await insert({ job: 'backup', finishedAt: daysAgo(1), result: { status: 'failed', freeBytes: 10, totalBytes: TOTAL } });
    expect(await repository.latestGoodBackupAt()).toBeNull();
    await insert(good(daysAgo(3)));
    await insert({ job: 'backup', finishedAt: daysAgo(0.5), result: { status: 'failed' } });
    expect(await repository.latestGoodBackupAt()).toEqual(daysAgo(3));
  });

  it('counts only the weekly backup: an ok row of the daily check or of another job is not a backup', async () => {
    await insert({ job: 'backup-watch', finishedAt: daysAgo(1), result: { status: 'ok' } });
    await insert({ job: 'heartbeat', finishedAt: daysAgo(1), result: { status: 'ok' } });
    await insert({ job: 'backup-clear', finishedAt: daysAgo(1), result: { status: 'ok' } });
    expect(await repository.latestGoodBackupAt()).toBeNull();
  });

  it('a row with no status, or a status that is not the text ok, is not good', async () => {
    await insert({ job: 'backup', finishedAt: daysAgo(1), result: { sizeBytes: 5 } });
    await insert({ job: 'backup', finishedAt: daysAgo(1), result: { status: 'OK ' } });
    await insert({ job: 'backup', finishedAt: daysAgo(1), result: { status: true } });
    expect(await repository.latestGoodBackupAt()).toBeNull();
  });
});

describe('AC-4: the newest free-space reading of either job', () => {
  it('is null when there is no row, and when no row holds figures', async () => {
    expect(await repository.latestDiskReading()).toBeNull();
    await insert(good(daysAgo(1)));
    expect(await repository.latestDiskReading()).toBeNull();
  });

  it('the newest wins even when the weekly row is the older one: a daily row of the watch is newer than the weekly backup', async () => {
    await insert(reading('backup', daysAgo(5), 900_000));
    await insert(reading('backup-watch', hoursAgo(3), 150_000));
    expect(await repository.latestDiskReading()).toEqual({ readAt: hoursAgo(3), freeBytes: 150_000, totalBytes: TOTAL });
  });

  it('and the weekly row wins when it is the newer one', async () => {
    await insert(reading('backup-watch', daysAgo(2), 900_000));
    await insert(reading('backup', hoursAgo(1), 250_000));
    expect(await repository.latestDiskReading()).toEqual({ readAt: hoursAgo(1), freeBytes: 250_000, totalBytes: TOTAL });
  });

  it('a failed run that read the disk still counts (a backup refused for lack of room read it)', async () => {
    await insert(reading('backup', hoursAgo(1), 50_000, 'failed'));
    expect(await repository.latestDiskReading()).toEqual({ readAt: hoursAgo(1), freeBytes: 50_000, totalBytes: TOTAL });
  });

  it('ignores another job whose result happens to hold the same keys', async () => {
    await insert(reading('heartbeat', hoursAgo(1), 1));
    await insert(reading('backup-watch', daysAgo(1), 700_000));
    expect(await repository.latestDiskReading()).toEqual({ readAt: daysAgo(1), freeBytes: 700_000, totalBytes: TOTAL });
  });

  it('skips a newer row whose figures are not numbers or not a disk, and takes the older row that is', async () => {
    await insert(reading('backup-watch', daysAgo(2), 400_000));
    await insert({ job: 'backup-watch', finishedAt: daysAgo(1.5), result: { status: 'ok', freeBytes: '100', totalBytes: '1000' } });
    await insert({ job: 'backup-watch', finishedAt: daysAgo(1.4), result: { status: 'ok', freeBytes: null, totalBytes: 1000 } });
    await insert({ job: 'backup-watch', finishedAt: daysAgo(1.3), result: { status: 'ok', freeBytes: 5 } });
    await insert({ job: 'backup-watch', finishedAt: daysAgo(1.2), result: { status: 'ok', freeBytes: 0, totalBytes: 0 } });
    await insert({ job: 'backup-watch', finishedAt: daysAgo(1.1), result: { status: 'ok', freeBytes: 2_000, totalBytes: 1_000 } });
    await insert({ job: 'backup-watch', finishedAt: daysAgo(1.0), result: { status: 'ok', freeBytes: -1, totalBytes: 1_000 } });
    expect(await repository.latestDiskReading()).toEqual({ readAt: daysAgo(2), freeBytes: 400_000, totalBytes: TOTAL });
  });

  it('returns the three figures and nothing else of the row: a path and a volume name in the result stay in the database', async () => {
    await insert({ job: 'backup', finishedAt: hoursAgo(1), result: { status: 'ok', freeBytes: 300_000, totalBytes: TOTAL, path: 'D:\\InventedBackupFolder\\copy-0001.age', volume: 'InventedVolumeLabel' } });
    const found = await repository.latestDiskReading();
    expect(Object.keys(found ?? {}).sort()).toEqual(['freeBytes', 'readAt', 'totalBytes']);
    expect(JSON.stringify(await service.getBackupStatus())).not.toMatch(/Invented/);
  });
});

describe('the service over the real repository, with a controlled clock (AC-1 to AC-4)', () => {
  it.each([
    [7, false],
    [8, false],
    [9, true],
  ] as const)('a good backup %s days ago: late is %s', async (days, late) => {
    await insert(good(daysAgo(days)));
    const status = await service.getBackupStatus();
    expect(status.lastGoodBackupAt).toBe(daysAgo(days).toISOString());
    expect(status.backupLate).toBe(late);
  });

  it.each([
    [250_000, 25, false],
    [200_000, 20, false],
    [190_000, 19, true],
  ] as const)('%s of 1,000,000 bytes free from a weekly row, then the same from a newer daily row: %s %% and nearly full is %s', async (free, percent, nearlyFull) => {
    await insert(reading('backup', daysAgo(6), free));
    expect((await service.getBackupStatus()).diskReading).toMatchObject({ freePercent: percent, stale: true });
    // A newer daily row with the other figure wins, and a fresh reading is not stale.
    await insert(reading('backup-watch', hoursAgo(2), TOTAL - free));
    expect((await service.getBackupStatus()).diskReading).toMatchObject({ freePercent: 100 - percent, ageSeconds: 7_200, stale: false });
    await db.owner.query('DELETE FROM job_runs WHERE job = $1', ['backup-watch']);
    expect((await service.getBackupStatus()).diskNearlyFull).toBe(nearlyFull);
  });

  it('no rows: no date, late, no reading, no disk notice (STORY-10.05 AC-10, which replaces AC-3)', async () => {
    expect(await service.getBackupStatus()).toEqual({ lastGoodBackupAt: null, backupLate: true, diskReading: null, diskNearlyFull: false });
  });

  it('only failed backup rows: still no good backup, so no date and late (STORY-10.05 AC-10)', async () => {
    await insert({ job: 'backup', finishedAt: daysAgo(1), result: { status: 'failed' } });
    await insert({ job: 'backup', finishedAt: daysAgo(2), result: { status: 'failed' } });
    expect(await service.getBackupStatus()).toMatchObject({ lastGoodBackupAt: null, backupLate: true });
  });

  it('AC-8: a failed latest run after a good one shows the last good backup, and the clock keeps running from it', async () => {
    await insert(good(daysAgo(9)));
    await insert({ job: 'backup', finishedAt: daysAgo(1), result: { status: 'failed' } });
    const status = await service.getBackupStatus();
    expect(status.lastGoodBackupAt).toBe(daysAgo(9).toISOString());
    expect(status.backupLate).toBe(true);
  });
});

describe('the migration: the rollback note in its header, and the migration over the result', () => {
  // One test, because the table is gone between the two steps and the tidy-up before each test needs it.
  it('the header holds one rollback statement that removes the table with its rows, and the migration then runs again, as `prisma migrate deploy` would, with its grants', async () => {
    await insert(good(daysAgo(1)));
    const statements = migration
      .split(/\r?\n/)
      .filter((line) => /^--   DROP TABLE .*;/.test(line))
      .map((line) => line.slice('--   '.length).replace(/\s*--.*$/, ''));
    expect(statements).toEqual(['DROP TABLE "job_runs";']);
    for (const statement of statements) await db.owner.query(statement);
    expect((await db.owner.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'job_runs'")).rowCount).toBe(0);

    await db.owner.query(migration);
    const { rows } = await db.owner.query<{ allowed: boolean }>("SELECT has_table_privilege('accucut_app', 'job_runs', 'UPDATE') AS allowed");
    expect(rows[0]?.allowed).toBe(false);
    await insert(good(daysAgo(2)));
    expect(await repository.latestGoodBackupAt()).toEqual(daysAgo(2));
  });
});
