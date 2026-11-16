import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { calculatedEstimate, currentCalculationOf, leadOf, requestFor } from '../../support/approval-helpers';
import { type CalculationDatabase, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';

/**
 * STORY-06.06 AC-3 (ADR-007, NFR-007, NFR-026, negative; architecture section 5.1) against real PostgreSQL in a throwaway database: `approvals` can be read and added by the runtime role, which may change only
 * the unlock, cancel and remove columns **by column**, so `approved_price` can never be changed by it, even by a fault in the service. The owner is refused a change of any approve column by a trigger, and every
 * DELETE and TRUNCATE by another; the CHECK constraints and the one-live-approval index hold whoever writes. Every statement below is run as a person and role named in its title. Every value is invented.
 */

let db: CalculationDatabase;
let estimateId: string;
let calculationId: string;

/** The columns the later stories write (unlock 06.08, cancel 06.12, remove 06.13): the only ones the runtime role may update. */
const OPEN_COLUMNS = ['unlocked_by', 'unlocked_at', 'unlock_reason', 'cancelled_by', 'cancelled_at', 'cancel_reason', 'removed_by', 'removed_at'];
/** The approve columns: written once, by INSERT. */
const CLOSED_COLUMNS = ['id', 'estimate_id', 'calculation_id', 'approved_price', 'calculated_bl', 'is_override', 'override_reason', 'approved_by', 'approved_at'];

beforeAll(async () => {
  db = await openCalculationDatabase();
  const calculated = await calculatedEstimate(db);
  estimateId = calculated.estimateId;
  calculationId = await currentCalculationOf(db, estimateId);
  await db.approvalService.approve(leadOf(db), estimateId, requestFor(db, calculationId, '1000.00'));
}, 120_000);

afterAll(async () => {
  await db.close();
});

/** The whole table as the owner reads it, so "unchanged" means every column of every row. */
async function snapshotOfTable(): Promise<unknown> {
  return (await db.owner.query('SELECT * FROM approvals ORDER BY id')).rows;
}

describe('the runtime role reads and adds, and updates only the later stories\' columns (AC-3)', () => {
  it('SELECT and INSERT are granted at table level; UPDATE, DELETE and TRUNCATE are not', async () => {
    const { rows } = await db.owner.query<{ privilege: string; granted: boolean }>(
      `SELECT privilege, has_table_privilege('accucut_app', 'approvals', privilege) AS granted FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) AS privilege`,
    );
    expect(Object.fromEntries(rows.map((row) => [row.privilege, row.granted]))).toEqual({ SELECT: true, INSERT: true, UPDATE: false, DELETE: false, TRUNCATE: false });
  });

  it('UPDATE is granted by column on exactly the unlock, cancel and remove columns, and on no approve column', async () => {
    const { rows } = await db.owner.query<{ column: string; granted: boolean }>(
      `SELECT a.attname::text AS "column", has_column_privilege('accucut_app', 'approvals', a.attname::text, 'UPDATE') AS granted
       FROM pg_attribute a WHERE a.attrelid = 'approvals'::regclass AND a.attnum > 0 AND NOT a.attisdropped`,
    );
    const granted = rows.filter((row) => row.granted).map((row) => row.column).sort();
    expect(granted).toEqual([...OPEN_COLUMNS].sort());
    expect(rows.filter((row) => !row.granted).map((row) => row.column).sort()).toEqual([...CLOSED_COLUMNS].sort());
  });

  it('reads the approval it added, as the runtime role', async () => {
    const { rows } = await db.runtime.query<{ approved_price: string }>('SELECT approved_price::text FROM approvals WHERE estimate_id = $1::uuid', [estimateId]);
    expect(rows).toEqual([{ approved_price: '1000.00' }]);
  });
});

describe('a change of an approve column as the runtime role is refused by the missing grant, and the table is as it was (AC-3)', () => {
  const statements: ReadonlyArray<readonly [string, string]> = [
    ['UPDATE of the approved price', 'UPDATE approvals SET approved_price = approved_price + 1'],
    ['UPDATE of the calculated total', 'UPDATE approvals SET calculated_bl = 1'],
    ['UPDATE of the override flag', 'UPDATE approvals SET is_override = true'],
    ['UPDATE of the override reason', "UPDATE approvals SET override_reason = 'x', is_override = true"],
    ['UPDATE of the approver', 'UPDATE approvals SET approved_by = estimate_id'],
    ['UPDATE of the time', "UPDATE approvals SET approved_at = now() + interval '1 day'"],
    ['UPDATE of the estimate', 'UPDATE approvals SET estimate_id = estimate_id'],
    ['UPDATE of the calculation', 'UPDATE approvals SET calculation_id = calculation_id'],
    ['an UPDATE of an approve column together with a column that is allowed', "UPDATE approvals SET unlock_reason = 'x', approved_price = 1"],
    ['DELETE of an approval', 'DELETE FROM approvals'],
    ['TRUNCATE of the approvals', 'TRUNCATE approvals'],
  ];

  it.each(statements)('%s', async (_name, statement) => {
    const before = await snapshotOfTable();
    await expect(db.runtime.query(statement)).rejects.toMatchObject({ code: '42501' });
    expect(await snapshotOfTable()).toEqual(before);
  });
});

describe('a change as the owner is refused by the triggers (AC-3)', () => {
  it.each([
    ['the approved price', 'UPDATE approvals SET approved_price = approved_price + 1'],
    ['the calculated total', 'UPDATE approvals SET calculated_bl = 1'],
    ['the approver', 'UPDATE approvals SET approved_by = estimate_id'],
    ['the time', "UPDATE approvals SET approved_at = now() + interval '1 day'"],
    ['the override flag', 'UPDATE approvals SET is_override = true'],
  ])('UPDATE of %s', async (_name, statement) => {
    const before = await snapshotOfTable();
    await expect(db.owner.query(statement)).rejects.toThrow('The approved values of an approval cannot be changed.');
    expect(await snapshotOfTable()).toEqual(before);
  });

  it.each([
    ['DELETE', 'DELETE FROM approvals'],
    ['TRUNCATE', 'TRUNCATE approvals'],
  ])('%s', async (operation, statement) => {
    const before = await snapshotOfTable();
    await expect(db.owner.query(statement)).rejects.toMatchObject({ code: '23000', message: expect.stringContaining(`Table "approvals" is immutable: ${operation} is not allowed`) });
    expect(await snapshotOfTable()).toEqual(before);
  });
});

describe('the table keeps what it must whoever writes (CHECK constraints and the one live approval)', () => {
  const insert = (price: string, extra = '', values = ''): string =>
    `INSERT INTO approvals (estimate_id, calculation_id, approved_price, calculated_bl, approved_by${extra}) VALUES ('${estimateId}'::uuid, '${calculationId}'::uuid, ${price}, 1, '${db.personId}'::uuid${values})`;

  it('a second approval that is still live for the estimate is refused, as the runtime role and as the owner (the backstop of AC-6)', async () => {
    const before = await snapshotOfTable();
    await expect(db.runtime.query(insert('5'))).rejects.toMatchObject({ code: '23505', constraint: 'uq_approvals_one_live_per_estimate' });
    await expect(db.owner.query(insert('5'))).rejects.toMatchObject({ code: '23505' });
    expect(await snapshotOfTable()).toEqual(before);
  });

  it.each([
    // Each statement is built inside the test: the database and the IDs exist only after `beforeAll`.
    ['a negative price', () => insert('-1'), 'ck_approvals_approved_price_not_negative'],
    ['a reason on a price that is not an override', () => insert('5', ', override_reason', ", 'because'"), 'ck_approvals_override_reason_needs_override'],
    ['a reason over 500 characters', () => insert('5', ', is_override, override_reason', `, true, '${'x'.repeat(501)}'`), 'ck_approvals_override_reason_length'],
    ['an unlock with a person and no time', () => insert('5', ', unlocked_by', `, '${db.personId}'::uuid`), 'ck_approvals_unlock_by_and_at_together'],
  ])('refuses %s', async (_name, statement, constraint) => {
    await expect(db.owner.query(statement())).rejects.toMatchObject({ code: '23514', constraint });
  });

  it('the later stories can set their columns as the runtime role, and then the approval is no longer live and a new cycle can be added', async () => {
    const before = defined((await db.owner.query<{ approved_price: string; calculated_bl: string; approved_by: string }>('SELECT approved_price::text, calculated_bl::text, approved_by::text FROM approvals WHERE estimate_id = $1::uuid', [estimateId])).rows[0]);
    const updated = await db.runtime.query("UPDATE approvals SET unlocked_by = $2::uuid, unlocked_at = now(), unlock_reason = 'Invented reason' WHERE estimate_id = $1::uuid", [estimateId, db.personId]);
    expect(updated.rowCount).toBe(1);
    // The approve columns are as they were.
    const after = defined((await db.owner.query<{ approved_price: string; calculated_bl: string; approved_by: string }>('SELECT approved_price::text, calculated_bl::text, approved_by::text FROM approvals WHERE estimate_id = $1::uuid', [estimateId])).rows[0]);
    expect(after).toEqual(before);
    // A new cycle for the same estimate is now allowed (one row per cycle, BO is the latest).
    await db.runtime.query(insert('7'));
    const count = defined((await db.owner.query<{ n: number }>('SELECT count(*)::int AS n FROM approvals WHERE estimate_id = $1::uuid', [estimateId])).rows[0]).n;
    expect(count).toBe(2);
  });
});
