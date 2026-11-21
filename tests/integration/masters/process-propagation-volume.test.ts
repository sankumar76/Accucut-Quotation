import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuditRepository } from '@/server/repositories/audit-repository';
import { createAuditService } from '@/server/services/audit-service';

import { contextOf, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';

import { itemIds, openCustomerDefaults, resetCustomerTables } from './customers-support';

/**
 * STORY-02.08 NFR-011 and the story's one measurement: at the planning volume (500 customers) a save that changes a default moves every customer on the old one and writes 501
 * entries (the rate's, then one per customer) in one transaction, and Save choices applies 500 customers' choices with 500 entries. Each is timed once and the figure printed,
 * with a sentence when it is over the 500 ms of the architect's estimate (architecture section 8 "Customers"; ADR-018 made the customers' entries one multi-row statement, GitHub #568, after
 * 500 single inserts took 1.5 to 1.8 s). The test fails only for a result that is wrong or absurdly slow (30 s); a slow machine is not a defect, so the 500 ms is reported and not asserted
 * (DL-057). What is asserted is how the entries were written: one `appendMany` for the customers of a step, and no `append` for them. Every name and number is invented.
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
  const verdict = milliseconds > PLANNING_LIMIT_MS ? `OVER the ${String(PLANNING_LIMIT_MS)} ms of the architect's estimate: report the split to the architect (ADR-018)` : `within ${String(PLANNING_LIMIT_MS)} ms`;
  process.stdout.write(`\nSTORY-02.08 ${what} at ${String(CUSTOMERS)} customers: ${milliseconds.toFixed(0)} ms, ${verdict}.\n`);
}

/** The real repository, counting how the entries reach it: the `append` calls (one row each) and the size of each `appendMany` call. */
function countingAudit() {
  const calls = { single: 0, batches: [] as number[] };
  const repository: AuditRepository = {
    ...db.auditRepository,
    append(row, tx) {
      calls.single += 1;
      return db.auditRepository.append(row, tx);
    },
    appendMany(rows, tx) {
      calls.batches.push(rows.length);
      return db.auditRepository.appendMany(rows, tx);
    },
  };
  return { calls, service: createAuditService({ audit: repository }) };
}

describe(`NFR-011: ${String(CUSTOMERS)} customers`, () => {
  it('the save moves all of them and writes 501 entries, in one request', async () => {
    const skip = await entryCount(db);
    const { calls, service } = countingAudit();
    const started = performance.now();
    const answer = await db.buildMastersService({ audit: service }).updateProcessItem(contextOf(adminId), ITEM, { defaultValue: '2.52' });
    const elapsed = performance.now() - started;
    report('PATCH of a default (the rate and its 500 customer entries)', elapsed);
    expect(answer.propagation).toMatchObject({ moved: CUSTOMERS, differing: [] });
    expect(await entryCount(db)).toBe(skip + 1 + CUSTOMERS);
    // The rate's entry is one append, the 500 customers' entries are one statement (ADR-018).
    expect(calls).toEqual({ single: 1, batches: [CUSTOMERS] });
    expect(elapsed).toBeLessThan(ABSURD_MS);
  });

  it('Save choices applies 500 choices and writes 500 entries, in one request', async () => {
    await db.owner.query('UPDATE customer_rates SET value = 3.10 WHERE process_item_id = $1::uuid', [ITEM]);
    const shown = (await db.owner.query<{ id: string }>('SELECT id::text AS id FROM customers ORDER BY name')).rows.map((row) => ({ customerId: row.id, choice: 'apply' as const, shownValue: '3.10' }));
    expect(shown).toHaveLength(CUSTOMERS);
    const skip = await entryCount(db);
    const { calls, service } = countingAudit();
    const started = performance.now();
    const counts = await db.buildMastersService({ audit: service }).applyPropagation(contextOf(adminId), ITEM, { newDefault: '2.52', choices: shown });
    const elapsed = performance.now() - started;
    report('POST of 500 choices (500 customer entries)', elapsed);
    expect(counts).toEqual({ applied: CUSTOMERS, kept: 0, skipped: 0 });
    expect(await entryCount(db)).toBe(skip + CUSTOMERS);
    expect(calls).toEqual({ single: 0, batches: [CUSTOMERS] });
    expect(elapsed).toBeLessThan(ABSURD_MS);
  });
});
