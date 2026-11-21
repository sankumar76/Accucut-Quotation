import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { contextOf, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';

import { itemIds, openCustomerDefaults, resetCustomerTables } from './customers-support';

/**
 * STORY-02.08 NFR-011 and the story's one measurement: at the planning volume (500 customers) a save that changes a default moves every customer on the old one and writes 501
 * entries (the rate's, then one per customer) in one transaction, and Save choices applies 500 customers' choices with 500 entries. Each is timed once and the figure printed,
 * with a sentence when it is over the 500 ms of the architect's estimate (architecture section 8 "Customers": above that, the remedy is a validated `recordMany`, reported to the
 * architect). The test fails only for a result that is wrong or absurdly slow (30 s); a slow machine is not a defect, so the 500 ms is reported and not asserted. Every name and number is invented.
 */

const CUSTOMERS = 500;
const PLANNING_LIMIT_MS = 500;
const ABSURD_MS = 30_000;
const ITEM = defined(itemIds()[0]);

let db: AuditDatabase;
let adminId: string;

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  await db.users.list();
  await openCustomerDefaults(db);
  await db.owner.query(`INSERT INTO customers (name) SELECT 'Invented volume customer ' || lpad(n::text, 4, '0') FROM generate_series(1, ${String(CUSTOMERS)}) AS n`);
  await db.owner.query('INSERT INTO customer_rates (customer_id, process_item_id, value) SELECT c.id, pi.id, pi.default_value FROM customers c CROSS JOIN process_items pi');
}, 120_000);

afterAll(async () => {
  await resetCustomerTables(db);
  await db.close();
});

function report(what: string, milliseconds: number): void {
  const verdict = milliseconds > PLANNING_LIMIT_MS ? `OVER the ${String(PLANNING_LIMIT_MS)} ms of the architect's estimate: report it to the architect (recordMany)` : `within ${String(PLANNING_LIMIT_MS)} ms`;
  process.stdout.write(`\nSTORY-02.08 ${what} at ${String(CUSTOMERS)} customers: ${milliseconds.toFixed(0)} ms, ${verdict}.\n`);
}

describe(`NFR-011: ${String(CUSTOMERS)} customers`, () => {
  it('the save moves all of them and writes 501 entries, in one request', async () => {
    const skip = await entryCount(db);
    const started = performance.now();
    const answer = await db.mastersService.updateProcessItem(contextOf(adminId), ITEM, { defaultValue: '2.52' });
    const elapsed = performance.now() - started;
    report('PATCH of a default (the rate and its 500 customer entries)', elapsed);
    expect(answer.propagation).toMatchObject({ moved: CUSTOMERS, differing: [] });
    expect(await entryCount(db)).toBe(skip + 1 + CUSTOMERS);
    expect(elapsed).toBeLessThan(ABSURD_MS);
  });

  it('Save choices applies 500 choices and writes 500 entries, in one request', async () => {
    await db.owner.query('UPDATE customer_rates SET value = 3.10 WHERE process_item_id = $1::uuid', [ITEM]);
    const shown = (await db.owner.query<{ id: string }>('SELECT id::text AS id FROM customers ORDER BY name')).rows.map((row) => ({ customerId: row.id, choice: 'apply' as const, shownValue: '3.10' }));
    expect(shown).toHaveLength(CUSTOMERS);
    const skip = await entryCount(db);
    const started = performance.now();
    const counts = await db.mastersService.applyPropagation(contextOf(adminId), ITEM, { newDefault: '2.52', choices: shown });
    const elapsed = performance.now() - started;
    report('POST of 500 choices (500 customer entries)', elapsed);
    expect(counts).toEqual({ applied: CUSTOMERS, kept: 0, skipped: 0 });
    expect(await entryCount(db)).toBe(skip + CUSTOMERS);
    expect(elapsed).toBeLessThan(ABSURD_MS);
  });
});
