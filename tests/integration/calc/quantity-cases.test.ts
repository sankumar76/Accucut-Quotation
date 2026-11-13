import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { storeRowOutputs } from '@/lib/estimate/row-outputs';
import { createCalculationService, type CalculationService, type EstimateRowRequest } from '@/server/services/calculation-service';

import { insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';
import { MATERIAL } from '../../support/row-oracle';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';
import { CE_11_REORDERED, QUANTITY_CASES, type CaseRow } from '../../unit/quantity/quantity-cases';

/**
 * STORY-03.04 AC-1 and AC-2 (test strategy section 5.3, second level): each constructed quantity case of `tests/unit/quantity/quantity-cases.ts`
 * run through the calculation service with the seed configuration, against real PostgreSQL. Machining Cost (AP) carries the per-piece cost, every
 * other input is 0 and every rate is 0 (the percent rates too), so AY = AP, BA = AP, BB = AP x H, BG = BB: a per-piece cost travels through every
 * stage. The service reads the customer, the material and the exchange rates, calculates each row and then the totals, and the expected figures
 * are the hand-worked ones of the cases. The read from `calculations` and `calculation_rows`, the export and the screen data wait for the
 * stories that store a calculation (03.05) and show it (06.02, EPIC-07). Invented numbers only.
 */

const VERSION = { id: '00000000-0000-4000-8000-0aaa00000001', document: seedConfig };
const idOf = (letter: string): string => seedFieldAt(letter).id;

let db: AuditDatabase;
let service: CalculationService;
let customerId: string;
let materialId: string;
let adminId: string;

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  service = createCalculationService({ masters: db.masterRepository, currentConfiguration: () => Promise.resolve(VERSION) });
});

afterAll(async () => {
  await db.close();
});

/** A customer whose 15 rates are all 0, and a material (the row's dimensions are 0, so the material cost is 0 too). */
beforeEach(async () => {
  const { rows } = await db.owner.query<{ id: string }>("INSERT INTO customers (name) VALUES ('Invented quantity customer') RETURNING id::text");
  customerId = defined(rows[0]).id;
  for (const item of SEED_PROCESS_ITEMS) {
    await db.owner.query('INSERT INTO customer_rates (customer_id, process_item_id, value) VALUES ($1::uuid, $2::uuid, 0)', [customerId, item.id]);
  }
  const material = await db.owner.query<{ id: string }>(
    `INSERT INTO materials (material_in_drawing, material_considered, price_per_kg, specific_gravity, scrap_rate)
     VALUES ('Invented-quantity-plate', 'Invented steel', $1, $2, $3) RETURNING id::text`,
    [MATERIAL.pricePerKg, MATERIAL.specificGravity, MATERIAL.scrapRate],
  );
  materialId = defined(material.rows[0]).id;
});

afterEach(async () => {
  await db.owner.query('DELETE FROM customer_rates');
  await db.owner.query('DELETE FROM customers');
  await db.owner.query('DELETE FROM materials');
});

/** The row as an Engineer would type it: the count for the whole order (H), the per-piece cost as Machining Cost (AP), and a Tool Cost if any. */
function requestOf(row: CaseRow): EstimateRowRequest {
  const inputs: Record<string, string> = { [idOf('H')]: row.h, [idOf('AP')]: row.cost };
  if (row.toolCost !== undefined) inputs[idOf('BM')] = row.toolCost;
  return { materialId, inputs };
}

const estimateOf = (rows: ReadonlyArray<CaseRow>) => service.calculateEstimate({ customerId, rows: rows.map(requestOf) });

describe('AC-1: each case through the calculation service gives the hand-worked BL, and each row the hand-worked BG', () => {
  it.each(QUANTITY_CASES.map((quantityCase) => [quantityCase.id, quantityCase.title, quantityCase] as const))('%s: %s', async (_id, _title, quantityCase) => {
    const estimate = await estimateOf(quantityCase.rows);
    for (const wrong of quantityCase.wrong ?? []) {
      expect(estimate.totals.totalPrice?.toString(), `BL of ${wrong.bl} would mean ${wrong.means}`).not.toBe(wrong.bl);
    }
    expect(estimate.totals.totalPrice?.toString()).toBe(quantityCase.bl);
    const bgs = estimate.rows.map((row) => storeRowOutputs(row)[idOf('BG')]);
    expect(bgs).toEqual(quantityCase.rows.map((row) => row.bg));
  });

  it('CE-11: the CE-1 rows in another order, as after a reorder or a move, give the same BL of 30', async () => {
    expect((await estimateOf(CE_11_REORDERED)).totals.totalPrice?.toString()).toBe('30');
  });

  it('a row of the same estimate that has an exchange rate of 0 still adds its BG: BJ is null, BL is unaffected (CE-8)', async () => {
    await db.owner.query("INSERT INTO exchange_rates (currency, inr_value, updated_by) VALUES ('USD', 0, $1::uuid), ('EUR', 90, $1::uuid)", [adminId]);
    try {
      const estimate = await estimateOf(defined(QUANTITY_CASES.find((quantityCase) => quantityCase.id === 'CE-1')).rows);
      expect(estimate.totals.totalPrice?.toString()).toBe('30');
      for (const row of estimate.rows) expect(storeRowOutputs(row)[idOf('BJ')]).toBeNull();
    } finally {
      await db.owner.query('DELETE FROM exchange_rates');
    }
  });
});

describe('AC-2 (CE-7, D-05): BN is BL over the total Tool Cost', () => {
  it('Tool Cost 2 and 3 give a total of 5 and BN = 30 / 5 = 6', async () => {
    const ce7 = defined(QUANTITY_CASES.find((quantityCase) => quantityCase.id === 'CE-7'));
    const { totals } = await estimateOf(ce7.rows);
    expect(totals.toolCostTotal?.toString()).toBe('5');
    expect(totals.pricePerToolCost?.toString()).toBe('6');
  });

  it('with no Tool Cost, BN has no figure and the total shows 0', async () => {
    const ce1 = defined(QUANTITY_CASES.find((quantityCase) => quantityCase.id === 'CE-1'));
    const { totals } = await estimateOf(ce1.rows);
    expect(totals.toolCostTotal?.toString()).toBe('0');
    expect(totals.pricePerToolCost).toBeNull();
    expect(totals.totalPrice?.toString()).toBe('30');
  });
});
