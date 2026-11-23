import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMigratedScratchDatabase, type ScratchDatabase } from '../../support/scratch-database';

/**
 * CR-01 item 7A (AQP-398, architecture section 4.12 b, ADR-019 Option A; AC-2): the migration `20261123100000_estimate_status_prepared` against real PostgreSQL, over a database that already holds
 * Submitted estimates. The scratch database has every migration applied, so the test first runs the **rollback note written in the migration's own header** (the statement is read from the file,
 * not copied), which gives back the enum as it was before: `SUBMITTED`, no `PREPARED`. It then plants the estimates an existing install could hold, one in each status, and runs the migration file
 * again, as `prisma migrate deploy` does. Every name and address is invented.
 */

const migration = readFileSync(fileURLToPath(new URL('../../../prisma/migrations/20261123100000_estimate_status_prepared/migration.sql', import.meta.url)), 'utf8');
const ROLLBACK_STATEMENTS = migration
  .split(/\r?\n/)
  .filter((line) => /^--   ALTER TYPE .*;$/.test(line))
  .map((line) => line.slice('--   '.length));

/** The label the migration renames, written as the earlier migration created it. It is the one place besides the legacy audit read where the old word is allowed in a test. */
const OLD_LABEL = 'SUBMITTED';

let scratch: ScratchDatabase;
let owner: Client;

type PlantedRow = {
  readonly id: string;
  readonly status: string;
  readonly xmin: string;
  readonly ctid: string;
};

async function rows<T extends Record<string, unknown>>(sql: string, values: ReadonlyArray<unknown> = []): Promise<T[]> {
  return (await owner.query<T>(sql, [...values])).rows;
}

const labels = async (): Promise<string[]> => (await rows<{ enumlabel: string }>("SELECT enumlabel FROM pg_enum WHERE enumtypid = 'estimate_status'::regtype ORDER BY enumsortorder")).map((row) => row.enumlabel);
const estimates = (): Promise<PlantedRow[]> => rows<PlantedRow>('SELECT id::text, status::text, xmin::text, ctid::text FROM estimates ORDER BY id');

beforeAll(async () => {
  scratch = await createMigratedScratchDatabase();
  owner = new Client({ connectionString: scratch.ownerUrl });
  await owner.connect();
});

afterAll(async () => {
  await owner.end();
  await scratch.drop();
});

describe('the migration file', () => {
  it('runs as one transaction: it holds no BEGIN;, COMMIT; or ROLLBACK; statement, so Prisma wraps it', () => {
    expect(migration).not.toMatch(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im);
  });

  it('has a rollback note of one statement that gives the old label back', () => {
    expect(ROLLBACK_STATEMENTS).toEqual([`ALTER TYPE "estimate_status" RENAME VALUE 'PREPARED' TO '${OLD_LABEL}';`]);
  });
});

describe('AC-2: the rename over existing estimates (run in order, in one database)', () => {
  it('has the labels DRAFT, PREPARED and APPROVED once every migration is applied', async () => {
    expect(await labels()).toEqual(['DRAFT', 'PREPARED', 'APPROVED']);
  });

  it('the rollback note gives back the enum as it was: DRAFT, SUBMITTED and APPROVED', async () => {
    for (const statement of ROLLBACK_STATEMENTS) await owner.query(statement);
    expect(await labels()).toEqual(['DRAFT', OLD_LABEL, 'APPROVED']);
  });

  it('plants the estimates of an existing install: a Draft, two Submitted and an Approved', async () => {
    const { rows: users } = await owner.query<{ id: string }>(
      "INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Invented Engineer', 'engineer.status-migration@example.com', 'invented-hash', 'ENGINEER', true) RETURNING id::text",
    );
    const engineerId = users[0]?.id ?? '';
    const planted: ReadonlyArray<readonly [string, string]> = [
      ['Q-2026-9001', 'DRAFT'],
      ['Q-2026-9002', OLD_LABEL],
      ['Q-2026-9003', OLD_LABEL],
      ['Q-2026-9004', 'APPROVED'],
    ];
    for (const [code, status] of planted) {
      const { rows: tasks } = await owner.query<{ id: string }>(
        `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject)
         VALUES ($1, $2::uuid, $2::uuid, '\\\\invented-server\\share\\' || $1, '2026-12-01T10:00:00Z', $1, 'Invented subject') RETURNING id::text`,
        [code, engineerId],
      );
      await owner.query('INSERT INTO estimates (task_id, status) VALUES ($1::uuid, $2::estimate_status)', [tasks[0]?.id, status]);
    }
    expect((await estimates()).map((row) => row.status).sort()).toEqual(['APPROVED', 'DRAFT', OLD_LABEL, OLD_LABEL]);
  });

  it('reads every Submitted row as PREPARED after the migration, with no row rewritten, none lost and the other statuses as they were', async () => {
    const before = await estimates();
    await owner.query(migration);
    const after = await estimates();
    expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id));
    expect(after.map((row) => row.status).sort()).toEqual(['APPROVED', 'DRAFT', 'PREPARED', 'PREPARED']);
    // "No row is rewritten": a rewrite would give the row a new transaction ID (xmin) and often a new place on the page (ctid); a catalogue-only rename gives neither.
    expect(after.map(({ xmin, ctid }) => ({ xmin, ctid }))).toEqual(before.map(({ xmin, ctid }) => ({ xmin, ctid })));
    expect(await labels()).toEqual(['DRAFT', 'PREPARED', 'APPROVED']);
  });

  it('accepts PREPARED on a write and refuses the old label, so nothing can store it again', async () => {
    const { rows: draft } = await owner.query<{ id: string }>("SELECT id::text FROM estimates WHERE status = 'DRAFT'");
    await owner.query("UPDATE estimates SET status = 'PREPARED' WHERE id = $1::uuid", [draft[0]?.id]);
    await expect(owner.query(`UPDATE estimates SET status = '${OLD_LABEL}' WHERE id = $1::uuid`, [draft[0]?.id])).rejects.toMatchObject({ code: '22P02' });
  });
});
