import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { defined } from '../../support/defined';
import { createMigratedScratchDatabase, type ScratchDatabase } from '../../support/scratch-database';

/**
 * CR-01 item 7B (AQP-399, architecture section 4.12 b, ADR-019; AC-1, AC-7): the two migrations that add QUOTED and the Ignored layer, against real PostgreSQL. Direct INSERTs and UPDATEs of invalid rows
 * hit each CHECK by its name, so a CHECK that is dropped or loosened fails here. The rollback note written in the second file's own header is run from the file, not copied. Every name is invented.
 */

const migrationDirectory = (name: string): string => fileURLToPath(new URL(`../../../prisma/migrations/${name}/migration.sql`, import.meta.url));
const addValue = readFileSync(migrationDirectory('20261123110000_estimate_status_quoted'), 'utf8');
const columns = readFileSync(migrationDirectory('20261123120000_estimate_quoted_ignored'), 'utf8');
/** The statements a header gives as its rollback note (the lines that begin with three spaces after the comment mark), read from the file and never copied. */
const statementsOf = (sql: string): string[] =>
  sql
    .split(/\r?\n/)
    .filter((line) => /^--   (?:ALTER|UPDATE) .*;$/.test(line))
    .map((line) => line.slice('--   '.length));
const ROLLBACK_STATEMENTS = statementsOf(columns);
/** File 1's rollback step: QUOTED back to APPROVED, run before file 2 is rolled back. */
const QUOTED_TO_APPROVED = statementsOf(addValue);

let scratch: ScratchDatabase;
let owner: Client;
let userId = '';
/** Stands for the person in a table built before the person exists (an it.each table is read when the file is collected); insertEstimate swaps it for the real ID. */
const PERSON = 'the-person';
let counter = 0;

/** Inserts a task and its estimate with the given estimate columns, as the owner, and answers the estimate's ID. Rejects with the database error when a CHECK refuses the row. */
async function insertEstimate(columnsAndValues: Readonly<Record<string, unknown>> = {}): Promise<string> {
  counter += 1;
  const code = `Q-2026-${String(9100 + counter)}`;
  const { rows: tasks } = await owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject)
     VALUES ($1, $2::uuid, $2::uuid, '\\\\invented-server\\share\\' || $1, '2026-12-01T10:00:00Z', $1, 'Invented subject') RETURNING id::text`,
    [code, userId],
  );
  const names = ['task_id', ...Object.keys(columnsAndValues)];
  const placeholders = names.map((_, index) => `$${String(index + 1)}`);
  const { rows } = await owner.query<{ id: string }>(`INSERT INTO estimates (${names.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id::text`, [tasks[0]?.id, ...Object.values(columnsAndValues).map((value) => (value === PERSON ? userId : value))]);
  return rows[0]?.id ?? '';
}

const update = (id: string, set: string, values: ReadonlyArray<unknown> = []): Promise<unknown> => owner.query(`UPDATE estimates SET ${set} WHERE id = $1::uuid`, [id, ...values]);
const NOW = '2026-11-23T10:00:00Z';

beforeAll(async () => {
  scratch = await createMigratedScratchDatabase();
  owner = new Client({ connectionString: scratch.ownerUrl });
  await owner.connect();
  const { rows } = await owner.query<{ id: string }>(
    "INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Invented Lead', 'lead.status-checks@example.com', 'invented-hash', 'LEAD', true) RETURNING id::text",
  );
  userId = rows[0]?.id ?? '';
});

afterAll(async () => {
  await owner.end();
  await scratch.drop();
});

describe('AC-1: the two migration files', () => {
  it('runs each as one transaction: no BEGIN;, COMMIT; or ROLLBACK; statement of its own, so Prisma wraps it', () => {
    for (const sql of [addValue, columns]) expect(sql).not.toMatch(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im);
  });

  it('adds QUOTED in a file of its own: its only statement is ADD VALUE, and no CHECK, default or index in it names the value', () => {
    const statements = addValue.split(/\r?\n/).filter((line) => !line.startsWith('--') && line.trim() !== '');
    // Comment lines are dropped above; what is left is the whole file, so a CHECK, a default or an index that names QUOTED cannot be in it.
    expect(statements).toEqual(['ALTER TYPE "estimate_status" ADD VALUE \'QUOTED\';']);
  });

  it('puts the CHECKs that name QUOTED in the later file, which is the one that comes after in the migration order', () => {
    expect(columns).toMatch(/CHECK \(.*'QUOTED'/);
    expect('20261123110000_estimate_status_quoted' < '20261123120000_estimate_quoted_ignored').toBe(true);
  });

  it('has the enum labels DRAFT, PREPARED, APPROVED and QUOTED, in that order, and the five columns, all nullable', async () => {
    const { rows: labels } = await owner.query<{ enumlabel: string }>("SELECT enumlabel FROM pg_enum WHERE enumtypid = 'estimate_status'::regtype ORDER BY enumsortorder");
    expect(labels.map((row) => row.enumlabel)).toEqual(['DRAFT', 'PREPARED', 'APPROVED', 'QUOTED']);
    const { rows } = await owner.query<{ column_name: string; is_nullable: string; data_type: string }>(
      "SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'estimates' AND column_name IN ('quoted_at', 'quoted_by', 'ignored_at', 'ignored_by', 'ignore_remarks') ORDER BY column_name",
    );
    expect(rows).toEqual([
      { column_name: 'ignore_remarks', is_nullable: 'YES', data_type: 'text' },
      { column_name: 'ignored_at', is_nullable: 'YES', data_type: 'timestamp with time zone' },
      { column_name: 'ignored_by', is_nullable: 'YES', data_type: 'uuid' },
      { column_name: 'quoted_at', is_nullable: 'YES', data_type: 'timestamp with time zone' },
      { column_name: 'quoted_by', is_nullable: 'YES', data_type: 'uuid' },
    ]);
  });
});

describe('AC-7: each CHECK refuses its row, by name', () => {
  it('accepts every valid shape: a Draft, a Prepared and an Approved estimate, ignored or not, and a Quoted one that is not ignored', async () => {
    for (const status of ['DRAFT', 'PREPARED', 'APPROVED']) {
      await insertEstimate({ status });
      await insertEstimate({ status, ignored_at: NOW, ignored_by: userId, ignore_remarks: 'Duplicate of another request.' });
    }
    await insertEstimate({ status: 'QUOTED', quoted_at: NOW, quoted_by: userId });
  });

  describe('ck_estimates_quoted', () => {
    it('refuses a QUOTED estimate with no quote columns', async () => {
      await expect(insertEstimate({ status: 'QUOTED' })).rejects.toMatchObject({ code: '23514', constraint: 'ck_estimates_quoted' });
    });

    it('refuses a QUOTED estimate with only one of the two quote columns', async () => {
      await expect(insertEstimate({ status: 'QUOTED', quoted_at: NOW })).rejects.toMatchObject({ code: '23514', constraint: 'ck_estimates_quoted' });
      await expect(insertEstimate({ status: 'QUOTED', quoted_by: userId })).rejects.toMatchObject({ code: '23514', constraint: 'ck_estimates_quoted' });
    });

    it('refuses a row that is not QUOTED but holds the quote columns, whole or half', async () => {
      for (const status of ['DRAFT', 'PREPARED', 'APPROVED']) {
        await expect(insertEstimate({ status, quoted_at: NOW, quoted_by: userId }), status).rejects.toMatchObject({ code: '23514', constraint: 'ck_estimates_quoted' });
        await expect(insertEstimate({ status, quoted_at: NOW }), status).rejects.toMatchObject({ code: '23514', constraint: 'ck_estimates_quoted' });
        await expect(insertEstimate({ status, quoted_by: userId }), status).rejects.toMatchObject({ code: '23514', constraint: 'ck_estimates_quoted' });
      }
    });

    it('lets an Unlock or a Cancel leave QUOTED only in one UPDATE: the status alone, or the columns alone, is refused', async () => {
      const id = await insertEstimate({ status: 'QUOTED', quoted_at: NOW, quoted_by: userId });
      await expect(update(id, "status = 'DRAFT'")).rejects.toMatchObject({ code: '23514', constraint: 'ck_estimates_quoted' });
      await expect(update(id, 'quoted_at = NULL, quoted_by = NULL')).rejects.toMatchObject({ code: '23514', constraint: 'ck_estimates_quoted' });
      await update(id, "status = 'DRAFT', quoted_at = NULL, quoted_by = NULL");
      const { rows } = await owner.query<{ status: string; quoted_at: Date | null }>('SELECT status::text, quoted_at FROM estimates WHERE id = $1::uuid', [id]);
      expect(rows[0]).toEqual({ status: 'DRAFT', quoted_at: null });
    });

    it('refuses a person who does not exist as the one who quoted (foreign key fk_estimates_quoted_by)', async () => {
      await expect(insertEstimate({ status: 'QUOTED', quoted_at: NOW, quoted_by: '00000000-0000-4000-8000-0000000000ff' })).rejects.toMatchObject({ code: '23503', constraint: 'fk_estimates_quoted_by' });
    });
  });

  describe('ck_estimates_ignored_all_or_none', () => {
    it.each([
      ['only the time', { ignored_at: NOW }],
      ['only the person', { ignored_by: PERSON }],
      ['only the remarks', { ignore_remarks: 'Remarks alone.' }],
      ['the time and the person, no remarks', { ignored_at: NOW, ignored_by: PERSON }],
      ['the time and the remarks, no person', { ignored_at: NOW, ignore_remarks: 'No person.' }],
      ['the person and the remarks, no time', { ignored_by: PERSON, ignore_remarks: 'No time.' }],
    ])('refuses %s', async (_name, ignoredColumns) => {
      await expect(insertEstimate({ status: 'DRAFT', ...ignoredColumns })).rejects.toMatchObject({ code: '23514', constraint: 'ck_estimates_ignored_all_or_none' });
    });

    it('refuses a Restore that clears the time and the person but leaves the remarks, and accepts the one that clears all three', async () => {
      const id = await insertEstimate({ status: 'PREPARED', ignored_at: NOW, ignored_by: userId, ignore_remarks: 'To be restored.' });
      await expect(update(id, 'ignored_at = NULL, ignored_by = NULL')).rejects.toMatchObject({ code: '23514', constraint: 'ck_estimates_ignored_all_or_none' });
      await update(id, 'ignored_at = NULL, ignored_by = NULL, ignore_remarks = NULL');
    });

    it('refuses a person who does not exist as the one who ignored (foreign key fk_estimates_ignored_by)', async () => {
      await expect(insertEstimate({ status: 'DRAFT', ignored_at: NOW, ignored_by: '00000000-0000-4000-8000-0000000000fe', ignore_remarks: 'Nobody.' })).rejects.toMatchObject({
        code: '23503',
        constraint: 'fk_estimates_ignored_by',
      });
    });
  });

  describe('ck_estimates_ignore_remarks_not_blank', () => {
    it.each([['empty', ''], ['spaces', '   '], ['a tab and a line feed', '\t\n']])('refuses remarks that are %s', async (_name, remarks) => {
      await expect(insertEstimate({ status: 'DRAFT', ignored_at: NOW, ignored_by: userId, ignore_remarks: remarks })).rejects.toMatchObject({ code: '23514', constraint: 'ck_estimates_ignore_remarks_not_blank' });
    });
  });

  describe('ck_estimates_ignore_remarks_length', () => {
    it('accepts remarks of exactly 2000 characters, counted as characters and not bytes, and refuses 2001', async () => {
      await insertEstimate({ status: 'DRAFT', ignored_at: NOW, ignored_by: userId, ignore_remarks: 'x'.repeat(2000) });
      await insertEstimate({ status: 'DRAFT', ignored_at: NOW, ignored_by: userId, ignore_remarks: '\u{1F600}'.repeat(2000) });
      await expect(insertEstimate({ status: 'DRAFT', ignored_at: NOW, ignored_by: userId, ignore_remarks: 'x'.repeat(2001) })).rejects.toMatchObject({
        code: '23514',
        constraint: 'ck_estimates_ignore_remarks_length',
      });
    });
  });

  describe('ck_estimates_quoted_not_ignored', () => {
    it('refuses a QUOTED estimate that is ignored, at insert and by ignoring one that is quoted', async () => {
      await expect(insertEstimate({ status: 'QUOTED', quoted_at: NOW, quoted_by: userId, ignored_at: NOW, ignored_by: userId, ignore_remarks: 'Too late.' })).rejects.toMatchObject({
        code: '23514',
        constraint: 'ck_estimates_quoted_not_ignored',
      });
      const id = await insertEstimate({ status: 'QUOTED', quoted_at: NOW, quoted_by: userId });
      await expect(update(id, "ignored_at = now(), ignored_by = $2::uuid, ignore_remarks = 'Too late.'", [userId])).rejects.toMatchObject({ code: '23514', constraint: 'ck_estimates_quoted_not_ignored' });
    });

    it('refuses marking an ignored Approved estimate as quoted, so Restore comes first', async () => {
      const id = await insertEstimate({ status: 'APPROVED', ignored_at: NOW, ignored_by: userId, ignore_remarks: 'Ignored while approved.' });
      await expect(update(id, "status = 'QUOTED', quoted_at = now(), quoted_by = $2::uuid", [userId])).rejects.toMatchObject({ code: '23514', constraint: 'ck_estimates_quoted_not_ignored' });
    });
  });
});

describe('the rollback note in the header of the second file', () => {
  it('has the Restore in SQL first (the layer cleared, the status never touched), then, in reverse order, the CHECKs, the foreign keys and the columns; file 1 has the QUOTED step that clears the quote columns', () => {
    expect(QUOTED_TO_APPROVED).toEqual(['UPDATE "estimates" SET "status" = \'APPROVED\', "quoted_at" = NULL, "quoted_by" = NULL WHERE "status" = \'QUOTED\';']);
    expect(ROLLBACK_STATEMENTS).toHaveLength(4);
    expect(ROLLBACK_STATEMENTS[0]).toBe('UPDATE "estimates" SET "ignored_at" = NULL, "ignored_by" = NULL, "ignore_remarks" = NULL WHERE "ignored_at" IS NOT NULL;');
    expect(ROLLBACK_STATEMENTS[0]).not.toMatch(/"status"/);
    expect(ROLLBACK_STATEMENTS[1]).toMatch(/^ALTER TABLE "estimates" DROP CONSTRAINT "ck_estimates_quoted_not_ignored", .*DROP CONSTRAINT "ck_estimates_quoted";$/);
    expect(ROLLBACK_STATEMENTS[2]).toBe('ALTER TABLE "estimates" DROP CONSTRAINT "fk_estimates_ignored_by", DROP CONSTRAINT "fk_estimates_quoted_by";');
    expect(ROLLBACK_STATEMENTS[3]).toMatch(/^ALTER TABLE "estimates" DROP COLUMN "ignore_remarks", .*DROP COLUMN "quoted_at";$/);
  });

  it('gives back the schema as it was once the header steps are run, with an ignored Draft still a Draft and an ignored Prepared still Prepared, and the file then runs again over the same rows', async () => {
    const ignoredDraft = await insertEstimate({ status: 'DRAFT', ignored_at: NOW, ignored_by: PERSON, ignore_remarks: 'Rolled back while ignored.' });
    const ignoredPrepared = await insertEstimate({ status: 'PREPARED', ignored_at: NOW, ignored_by: PERSON, ignore_remarks: 'Rolled back while ignored.' });
    const quoted = await insertEstimate({ status: 'QUOTED', quoted_at: NOW, quoted_by: PERSON });
    // The steps of the two headers, in the order the notes give them. The first would be refused by ck_estimates_quoted if it did not clear the quote columns.
    for (const statement of QUOTED_TO_APPROVED) await owner.query(statement);
    const statusOf = async (id: string): Promise<string | undefined> => (await owner.query<{ status: string }>('SELECT status::text FROM estimates WHERE id = $1::uuid', [id])).rows[0]?.status;
    expect(await statusOf(quoted)).toBe('APPROVED');
    await owner.query(defined(ROLLBACK_STATEMENTS[0]));
    expect(await statusOf(ignoredDraft)).toBe('DRAFT');
    expect(await statusOf(ignoredPrepared)).toBe('PREPARED');
    const { rows: before } = await owner.query<{ id: string; status: string }>('SELECT id::text, status::text FROM estimates ORDER BY id');
    for (const statement of ROLLBACK_STATEMENTS.slice(1)) await owner.query(statement);
    const { rows: gone } = await owner.query("SELECT 1 FROM information_schema.columns WHERE table_name = 'estimates' AND column_name IN ('quoted_at', 'quoted_by', 'ignored_at', 'ignored_by', 'ignore_remarks')");
    expect(gone).toHaveLength(0);
    const { rows: checks } = await owner.query("SELECT 1 FROM pg_constraint WHERE conname LIKE 'ck_estimates_quoted%' OR conname LIKE 'ck_estimates_ignore%'");
    expect(checks).toHaveLength(0);
    await owner.query(columns);
    const { rows: after } = await owner.query<{ id: string; status: string }>('SELECT id::text, status::text FROM estimates ORDER BY id');
    expect(after).toEqual(before);
  });
});
