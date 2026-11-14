import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CalculationDatabase, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';

/**
 * STORY-03.05 AC-3 (ADR-007, NFR-026, negative): `calculations` and `calculation_rows` cannot be changed or removed, by the runtime role (no grant, so it is
 * refused before a trigger is reached) or by the owner (the trigger, for every role). The runtime role can still read and add, which is how a Calculate stores a
 * record. Real PostgreSQL, in a throwaway database, because an immutable table cannot be cleaned up afterwards. Every name and number is invented.
 */

let db: CalculationDatabase;
let calculationId: string;
let estimateId: string;

beforeAll(async () => {
  db = await openCalculationDatabase();
  estimateId = await db.addEstimate();
  const stored = await db.service.storeCalculation({ estimateId, createdById: db.personId, inputsRevision: 3, nodes: [db.node(), db.node({ slNo: '2', sortIndex: 1 })] });
  calculationId = stored.id;
}, 120_000);

afterAll(async () => {
  await db.close();
});

const TABLES = ['calculations', 'calculation_rows'] as const;

/** What the tables hold, read as the owner: the whole of both, so "unchanged" means every column of every row. */
async function snapshotOfTables(): Promise<unknown> {
  const calculations = await db.owner.query('SELECT * FROM calculations ORDER BY id');
  const rows = await db.owner.query('SELECT * FROM calculation_rows ORDER BY id');
  return { calculations: calculations.rows, rows: rows.rows };
}

describe('the runtime role holds SELECT and INSERT and nothing else (AC-3)', () => {
  it.each(TABLES)('%s: SELECT and INSERT are granted, UPDATE, DELETE and TRUNCATE are not', async (table) => {
    const { rows } = await db.owner.query(
      `SELECT privilege, has_table_privilege('accucut_app', $1::text, privilege) AS granted
       FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) AS privilege`,
      [table],
    );
    expect(Object.fromEntries(rows.map((row) => [row.privilege, row.granted]))).toEqual({ SELECT: true, INSERT: true, UPDATE: false, DELETE: false, TRUNCATE: false });
  });

  it.each(TABLES)('%s: no column can be updated by the runtime role either (a column grant would still allow it)', async (table) => {
    const { rows } = await db.owner.query<{ granted: boolean }>(
      `SELECT has_column_privilege('accucut_app', $1::text, a.attname::text, 'UPDATE') AS granted
       FROM pg_attribute a WHERE a.attrelid = to_regclass($1::text) AND a.attnum > 0 AND NOT a.attisdropped`,
      [table],
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.granted === false)).toBe(true);
  });
});

describe('a direct change as the runtime role is refused by the missing grant (AC-3)', () => {
  const statements: ReadonlyArray<[string, string]> = [
    ['UPDATE of a calculation', `UPDATE calculations SET inputs_revision = inputs_revision + 1`],
    ['UPDATE of its product figures', `UPDATE calculations SET product_values = '{}'::jsonb`],
    ['UPDATE of its snapshot', `UPDATE calculations SET master_snapshot = '{}'::jsonb`],
    ['UPDATE of its warnings', `UPDATE calculations SET warnings = '[1]'::jsonb`],
    ['DELETE of a calculation', 'DELETE FROM calculations'],
    ['TRUNCATE of the calculations', 'TRUNCATE calculations'],
    ['UPDATE of a row\'s outputs', `UPDATE calculation_rows SET outputs = '{}'::jsonb`],
    ['UPDATE of a row\'s inputs', `UPDATE calculation_rows SET inputs = '{}'::jsonb`],
    ['UPDATE of a row\'s Sl. No', `UPDATE calculation_rows SET sl_no = 'x'`],
    ['DELETE of a row', 'DELETE FROM calculation_rows'],
    ['TRUNCATE of the rows', 'TRUNCATE calculation_rows'],
  ];

  it.each(statements)('%s', async (_name, statement) => {
    const before = await snapshotOfTables();
    await expect(db.runtime.query(statement)).rejects.toMatchObject({ code: '42501' });
    expect(await snapshotOfTables()).toEqual(before);
  });
});

describe('a direct change as the owner is refused by the trigger (AC-3)', () => {
  const statements: ReadonlyArray<[string, string, string]> = [
    ['UPDATE of a calculation', `UPDATE calculations SET inputs_revision = inputs_revision + 1`, 'calculations'],
    ['UPDATE of its product figures', `UPDATE calculations SET product_values = '{}'::jsonb`, 'calculations'],
    ['DELETE of a calculation', 'DELETE FROM calculations', 'calculations'],
    ['UPDATE of a row\'s outputs', `UPDATE calculation_rows SET outputs = '{}'::jsonb`, 'calculation_rows'],
    ['UPDATE of a row\'s inputs', `UPDATE calculation_rows SET inputs = '{}'::jsonb`, 'calculation_rows'],
    ['DELETE of a row', 'DELETE FROM calculation_rows', 'calculation_rows'],
    ['TRUNCATE of the rows', 'TRUNCATE calculation_rows', 'calculation_rows'],
  ];

  it.each(statements)('%s', async (_name, statement, table) => {
    const before = await snapshotOfTables();
    await expect(db.owner.query(statement)).rejects.toMatchObject({ code: '23000', message: expect.stringContaining(`Table "${table}" is immutable`) });
    expect(await snapshotOfTables()).toEqual(before);
  });

  it('TRUNCATE of the calculations is refused too, plain and with CASCADE', async () => {
    const before = await snapshotOfTables();
    // Plain: refused whichever check PostgreSQL makes first (the trigger, or the foreign keys that point at the table).
    await expect(db.owner.query('TRUNCATE calculations')).rejects.toBeInstanceOf(Error);
    // CASCADE reaches past the foreign keys, so the trigger is what stops it.
    await expect(db.owner.query('TRUNCATE calculations CASCADE')).rejects.toMatchObject({ code: '23000', message: expect.stringContaining('is immutable: TRUNCATE is not allowed') });
    expect(await snapshotOfTables()).toEqual(before);
  });

  it('the refusal does not echo a stored value', async () => {
    await expect(db.owner.query(`UPDATE calculation_rows SET outputs = '{}'::jsonb`)).rejects.toThrow(/^Table "calculation_rows" is immutable: UPDATE is not allowed\.$/);
  });

  it('an estimate that has a calculation cannot be deleted either: no cascade reaches the record', async () => {
    const before = await snapshotOfTables();
    await expect(db.owner.query('DELETE FROM estimates WHERE id = $1::uuid', [estimateId])).rejects.toMatchObject({ code: '23503' });
    expect(await snapshotOfTables()).toEqual(before);
  });
});

describe('the runtime role can still read and add, which is how a Calculate stores a record (AC-3)', () => {
  it('reads the record and its rows', async () => {
    const calculations = await db.runtime.query('SELECT id::text FROM calculations WHERE id = $1::uuid', [calculationId]);
    expect(calculations.rows).toEqual([{ id: calculationId }]);
    const rows = await db.runtime.query('SELECT count(*) AS n FROM calculation_rows WHERE calculation_id = $1::uuid', [calculationId]);
    expect(Number(defined(rows.rows[0]).n)).toBe(2);
  });

  it('adds a second record for the estimate, and the first is as it was', async () => {
    const before = await db.calculations.findCalculation(calculationId);
    await db.service.storeCalculation({ estimateId, createdById: db.personId, inputsRevision: 3, nodes: [db.node()] });
    const count = await db.owner.query('SELECT count(*) AS n FROM calculations WHERE estimate_id = $1::uuid', [estimateId]);
    expect(Number(defined(count.rows[0]).n)).toBe(2);
    expect(await db.calculations.findCalculation(calculationId)).toEqual(before);
  });
});
