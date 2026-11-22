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
    // The fixture is approved at a price that is not the calculated total, so its flag is already true (STORY-06.07): the statement flips it, so it is a change whichever way the fixture is.
    ['the override flag', 'UPDATE approvals SET is_override = NOT is_override'],
    ['the override reason', "UPDATE approvals SET override_reason = 'Another reason.'"],
  ])('UPDATE of %s', async (_name, statement) => {
    const before = await snapshotOfTable();
    await expect(db.owner.query(statement)).rejects.toThrow('The approved values of an approval cannot be changed.');
    expect(await snapshotOfTable()).toEqual(before);
  });

  // `estimate_downloads` (STORY-CR01.7E) has a foreign key to `approvals`, so PostgreSQL refuses a TRUNCATE of `approvals` alone for that reason, before any trigger runs. The statement names both tables, so the check of the
  // foreign key passes and the triggers of the two append-only tables are what refuse it: whichever table's trigger is reached first, the answer is the same immutable-table refusal.
  it.each([
    ['DELETE', 'DELETE FROM approvals', 'approvals'],
    ['TRUNCATE', 'TRUNCATE approvals, estimate_downloads', '(approvals|estimate_downloads)'],
  ])('%s', async (operation, statement, table) => {
    const before = await snapshotOfTable();
    await expect(db.owner.query(statement)).rejects.toMatchObject({ code: '23000', message: expect.stringMatching(new RegExp(`Table "${table}" is immutable: ${operation} is not allowed`)) });
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

/**
 * SQR-02 of the review of AQP-323: the unlock, cancel and remove columns are write-once. Each is null until its story sets it (the runtime role may, by column), and then it can neither be
 * rewritten nor cleared, by the runtime role or by the owner: clearing `removed_at` would bring a removed price back, and clearing `unlocked_at` would make a second live approval possible.
 */
describe('the unlock, cancel and remove columns are write-once (SQR-02)', () => {
  const COLUMNS: ReadonlyArray<readonly [act: string, column: string, kind: 'person' | 'time' | 'text']> = [
    ['unlock', 'unlocked_by', 'person'],
    ['unlock', 'unlocked_at', 'time'],
    ['unlock', 'unlock_reason', 'text'],
    ['cancel', 'cancelled_by', 'person'],
    ['cancel', 'cancelled_at', 'time'],
    ['cancel', 'cancel_reason', 'text'],
    ['remove', 'removed_by', 'person'],
    ['remove', 'removed_at', 'time'],
  ];
  let approvalId: string;

  beforeAll(async () => {
    const calculated = await calculatedEstimate(db);
    const seen = await currentCalculationOf(db, calculated.estimateId);
    await db.approvalService.approve(leadOf(db), calculated.estimateId, requestFor(db, seen, '2000.00'));
    approvalId = defined((await db.owner.query<{ id: string }>('SELECT id::text FROM approvals WHERE estimate_id = $1::uuid', [calculated.estimateId])).rows[0]).id;
    // Each act is set once, the way its story will: person, time and (not for a removal) reason together. The runtime role holds the column grants.
    await db.runtime.query(
      `UPDATE approvals SET unlocked_by = $2::uuid, unlocked_at = '2026-11-16T06:00:00Z', unlock_reason = 'First unlock',
              cancelled_by = $2::uuid, cancelled_at = '2026-11-16T06:01:00Z', cancel_reason = 'First cancel',
              removed_by = $2::uuid, removed_at = '2026-11-16T06:02:00Z' WHERE id = $1::uuid`,
      [approvalId, db.personId],
    );
  }, 120_000);

  const rowOf = async (): Promise<unknown> => (await db.owner.query('SELECT * FROM approvals WHERE id = $1::uuid', [approvalId])).rows;
  /** Another value of the column's own type, built inside the test (the IDs exist only after `beforeAll`). */
  const otherValue = (kind: 'person' | 'time' | 'text'): string => (kind === 'person' ? db.engineerId : kind === 'time' ? '2030-01-01T00:00:00Z' : 'Second text');
  const cast = (kind: 'person' | 'time' | 'text'): string => (kind === 'person' ? '::uuid' : kind === 'time' ? '::timestamptz' : '');
  const WRITE_ONCE = { code: '23000', message: expect.stringContaining('cannot be changed once it is set') };

  it.each(COLUMNS)('%s: %s cannot be rewritten once set, by the runtime role or by the owner', async (_act, column, kind) => {
    const before = await rowOf();
    await expect(db.runtime.query(`UPDATE approvals SET ${column} = $2${cast(kind)} WHERE id = $1::uuid`, [approvalId, otherValue(kind)])).rejects.toMatchObject(WRITE_ONCE);
    await expect(db.owner.query(`UPDATE approvals SET ${column} = $2${cast(kind)} WHERE id = $1::uuid`, [approvalId, otherValue(kind)])).rejects.toMatchObject(WRITE_ONCE);
    expect(await rowOf()).toEqual(before);
  });

  it.each(COLUMNS)('%s: %s cannot be cleared once set, so a removed price or an unlock cannot be undone', async (_act, column) => {
    const before = await rowOf();
    await expect(db.runtime.query(`UPDATE approvals SET ${column} = NULL WHERE id = $1::uuid`, [approvalId])).rejects.toMatchObject(WRITE_ONCE);
    await expect(db.owner.query(`UPDATE approvals SET ${column} = NULL WHERE id = $1::uuid`, [approvalId])).rejects.toMatchObject(WRITE_ONCE);
    expect(await rowOf()).toEqual(before);
  });

  it.each(COLUMNS)('%s: %s is untouched when the same value is written again (an update that changes nothing is allowed)', async (_act, column) => {
    const updated = await db.runtime.query(`UPDATE approvals SET ${column} = ${column} WHERE id = $1::uuid`, [approvalId]);
    expect(updated.rowCount).toBe(1);
  });
});

/**
 * SQR-12 of the review of AQP-323 (AQP-325 precondition): an act is stored once, **whole**. Once the time of an unlock or of a cancel is set, the reason cannot be added, changed or cleared either: a reason that was
 * null when the act was stored stays null, by the runtime role and by the owner. A reason cannot be put on a row before its time, because the trigger leaves an act open until its time is set.
 */
describe('an unlock and a cancel freeze whole once their time is set (SQR-12)', () => {
  const FROZEN = { code: '23000', message: expect.stringContaining('cannot be changed once it is set') };
  const ACTS = [
    { act: 'unlock', by: 'unlocked_by', at: 'unlocked_at', reason: 'unlock_reason', constraint: 'ck_approvals_unlock_reason_needs_unlock' },
    { act: 'cancel', by: 'cancelled_by', at: 'cancelled_at', reason: 'cancel_reason', constraint: 'ck_approvals_cancel_reason_needs_cancel' },
  ] as const;

  /** A new approved estimate's approval row, as the runtime role would find it. */
  async function freshApproval(): Promise<string> {
    const calculated = await calculatedEstimate(db);
    await db.approvalService.approve(leadOf(db), calculated.estimateId, requestFor(db, await currentCalculationOf(db, calculated.estimateId), '3000.00'));
    return defined((await db.owner.query<{ id: string }>('SELECT id::text FROM approvals WHERE estimate_id = $1::uuid', [calculated.estimateId])).rows[0]).id;
  }
  const rowOf = async (id: string): Promise<unknown> => (await db.owner.query('SELECT * FROM approvals WHERE id = $1::uuid', [id])).rows;

  it.each(ACTS)('$act: a reason that was null when the act was stored cannot be added afterwards, by the runtime role or by the owner', async ({ by, at, reason }) => {
    const approvalId = await freshApproval();
    // The act is stored with no reason (the whole act at once, as its story writes it, here with the reason left out).
    await db.runtime.query(`UPDATE approvals SET ${by} = $2::uuid, ${at} = now() WHERE id = $1::uuid`, [approvalId, db.personId]);
    const before = await rowOf(approvalId);
    await expect(db.runtime.query(`UPDATE approvals SET ${reason} = 'Added later' WHERE id = $1::uuid`, [approvalId])).rejects.toMatchObject(FROZEN);
    await expect(db.owner.query(`UPDATE approvals SET ${reason} = 'Added later' WHERE id = $1::uuid`, [approvalId])).rejects.toMatchObject(FROZEN);
    expect(await rowOf(approvalId)).toEqual(before);
  });

  it.each(ACTS)('$act: a reason stored with the act still cannot be changed or cleared', async ({ by, at, reason }) => {
    const approvalId = await freshApproval();
    await db.runtime.query(`UPDATE approvals SET ${by} = $2::uuid, ${at} = now(), ${reason} = 'Stored with the act' WHERE id = $1::uuid`, [approvalId, db.personId]);
    const before = await rowOf(approvalId);
    await expect(db.runtime.query(`UPDATE approvals SET ${reason} = 'Changed' WHERE id = $1::uuid`, [approvalId])).rejects.toMatchObject(FROZEN);
    await expect(db.owner.query(`UPDATE approvals SET ${reason} = NULL WHERE id = $1::uuid`, [approvalId])).rejects.toMatchObject(FROZEN);
    expect(await rowOf(approvalId)).toEqual(before);
  });

  it.each(ACTS)('$act: a reason cannot be put on a row that has no act yet, as the runtime role or as the owner', async ({ reason, constraint }) => {
    const approvalId = await freshApproval();
    const before = await rowOf(approvalId);
    await expect(db.runtime.query(`UPDATE approvals SET ${reason} = 'Early' WHERE id = $1::uuid`, [approvalId])).rejects.toMatchObject({ code: '23514', constraint });
    await expect(db.owner.query(`UPDATE approvals SET ${reason} = 'Early' WHERE id = $1::uuid`, [approvalId])).rejects.toMatchObject({ code: '23514', constraint });
    expect(await rowOf(approvalId)).toEqual(before);
  });

  it('an act that has not been stored is still open: the unlock can be stored whole on a row whose cancel was stored first', async () => {
    const approvalId = await freshApproval();
    await db.runtime.query("UPDATE approvals SET cancelled_by = $2::uuid, cancelled_at = now(), cancel_reason = 'Cancelled first' WHERE id = $1::uuid", [approvalId, db.personId]);
    const updated = await db.runtime.query("UPDATE approvals SET unlocked_by = $2::uuid, unlocked_at = now(), unlock_reason = 'Unlocked after' WHERE id = $1::uuid", [approvalId, db.personId]);
    expect(updated.rowCount).toBe(1);
  });
});
