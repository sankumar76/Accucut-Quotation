import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { displayStoredValue, storeRowOutputs, type StoredRowOutputs } from '@/lib/estimate/row-outputs';
import { createCalculationService, type CalculationService } from '@/server/services/calculation-service';

import { insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';
import { EXCHANGE, MATERIAL, ROW, TYPED_RATES, WORKED_2DP } from '../../support/row-oracle';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-03.03 (AC-1, AC-3, AC-5; architecture section 4.2) against real PostgreSQL in a throwaway database: the calculation service reads a
 * customer's rates, a material (the hidden "Not applicable" row too) and the exchange rates through the real repositories, and returns the
 * row's outputs M to BK. The expected figures are the hand-worked ones of `tests/support/row-oracle.ts`. Every name and number is invented
 * (ADR-014, NFR-006).
 */

const VERSION = { id: '00000000-0000-4000-8000-0aaa00000001', document: seedConfig };
const idOf = (letter: string): string => seedFieldAt(letter).id;

let db: AuditDatabase;
let adminId: string;
let service: CalculationService;

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  service = createCalculationService({ masters: db.masterRepository, currentConfiguration: () => Promise.resolve(VERSION) });
});

afterAll(async () => {
  await db.close();
});

/** The customers, materials and exchange rates a test adds; the owner clears them because the runtime role cannot delete them. */
afterEach(async () => {
  await db.owner.query('DELETE FROM customer_rates');
  await db.owner.query('DELETE FROM customers');
  await db.owner.query('DELETE FROM materials');
  await db.owner.query('DELETE FROM exchange_rates');
});

/** A customer with the invented rates (the Process Master's own defaults are left alone, so a default read instead of a rate would show). */
async function addCustomer(): Promise<string> {
  const { rows } = await db.owner.query<{ id: string }>("INSERT INTO customers (name) VALUES ('Invented calculation customer') RETURNING id::text");
  const customerId = defined(rows[0]).id;
  for (const item of SEED_PROCESS_ITEMS) {
    await db.owner.query('INSERT INTO customer_rates (customer_id, process_item_id, value) VALUES ($1::uuid, $2::uuid, $3)', [
      customerId,
      item.id,
      defined(TYPED_RATES[item.name], item.name),
    ]);
  }
  return customerId;
}

async function addMaterial(values: { pricePerKg: string; specificGravity: string; scrapRate: string } = MATERIAL): Promise<string> {
  const { rows } = await db.owner.query<{ id: string }>(
    `INSERT INTO materials (material_in_drawing, material_considered, price_per_kg, specific_gravity, scrap_rate)
     VALUES ('Invented-plate-grade', 'Invented steel', $1, $2, $3) RETURNING id::text`,
    [values.pricePerKg, values.specificGravity, values.scrapRate],
  );
  return defined(rows[0]).id;
}

async function addExchangeRates(usd: string, eur: string): Promise<void> {
  await db.owner.query("INSERT INTO exchange_rates (currency, inr_value, updated_by) VALUES ('USD', $1, $3::uuid), ('EUR', $2, $3::uuid)", [usd, eur, adminId]);
}

const typedRow = (): Record<string, string> => Object.fromEntries(Object.entries(ROW).map(([letter, text]) => [idOf(letter), text]));

const storedAt = (outputs: StoredRowOutputs, letter: string): string | null => {
  const value = outputs[idOf(letter)];
  if (value === undefined) throw new Error(`The row has no output for ${letter}.`);
  return value;
};

describe('AC-1: the row is calculated from the stored customer rates, material and exchange rates', () => {
  it.each(WORKED_2DP)('%s is %s', async (letter, expected) => {
    const customerId = await addCustomer();
    const materialId = await addMaterial();
    await addExchangeRates(EXCHANGE.usd, EXCHANGE.eur);
    const outputs = storeRowOutputs(await service.calculateRow({ customerId, materialId, inputs: typedRow() }));
    expect(displayStoredValue(storedAt(outputs, letter))).toBe(expected);
  });
});

describe('AC-5: the hidden "Not applicable" material is calculated, with O and AK at 0', () => {
  it('finds the hidden row, which the other finders never do, and reads its three numbers as 0', async () => {
    const { rows } = await db.owner.query<{ id: string }>(
      "INSERT INTO materials (material_in_drawing, material_considered, is_hidden) VALUES ('Hidden-entry-for-test', NULL, true) RETURNING id::text",
    );
    const hiddenId = defined(rows[0]).id;
    expect(await db.masterRepository.findMaterialForCalculation(hiddenId)).toEqual({ id: hiddenId, pricePerKg: '0.00', specificGravity: '0.00', scrapRate: '0.00' });

    const customerId = await addCustomer();
    await addExchangeRates(EXCHANGE.usd, EXCHANGE.eur);
    const outputs = storeRowOutputs(await service.calculateRow({ customerId, materialId: hiddenId, inputs: typedRow() }));
    expect(storedAt(outputs, 'M')).toBe('0');
    expect(storedAt(outputs, 'O')).toBe('0');
    expect(storedAt(outputs, 'AK')).toBe('0');
  });
});

describe('findMaterialForCalculation', () => {
  it('gives the three numbers as decimal text with at least two decimals', async () => {
    const id = await addMaterial({ pricePerKg: '60', specificGravity: '7.8512', scrapRate: '25.5' });
    expect(await db.masterRepository.findMaterialForCalculation(id)).toEqual({ id, pricePerKg: '60.00', specificGravity: '7.8512', scrapRate: '25.50' });
  });

  it('finds neither a deleted material, nor an unknown one, nor an ID that is not a UUID', async () => {
    const { rows } = await db.owner.query<{ id: string }>(
      `INSERT INTO materials (material_in_drawing, material_considered, price_per_kg, specific_gravity, scrap_rate, deleted_at)
       VALUES ('Deleted-entry-for-test', 'Invented gone', 1.37, 2.37, 3.37, now()) RETURNING id::text`,
    );
    expect(await db.masterRepository.findMaterialForCalculation(defined(rows[0]).id)).toBeNull();
    expect(await db.masterRepository.findMaterialForCalculation('00000000-0000-4000-8000-0ddd00000009')).toBeNull();
    expect(await db.masterRepository.findMaterialForCalculation('not-an-id')).toBeNull();
  });
});

describe('AC-3 (A-07, CE-8): an exchange rate of 0, or none saved, leaves the price in that currency without a figure', () => {
  it('a USD rate of 0 makes BJ null, and BG and BK are as they were', async () => {
    const customerId = await addCustomer();
    const materialId = await addMaterial();
    await addExchangeRates('0', EXCHANGE.eur);
    const outputs = storeRowOutputs(await service.calculateRow({ customerId, materialId, inputs: typedRow() }));
    expect(outputs[idOf('BJ')]).toBeNull();
    expect(displayStoredValue(storedAt(outputs, 'BG'))).toBe('451.40');
    expect(displayStoredValue(storedAt(outputs, 'BK'))).toBe('5.02');
  });

  it('with no exchange rate saved at all, BJ and BK are null and the rupee figures are unaffected', async () => {
    const customerId = await addCustomer();
    const materialId = await addMaterial();
    const outputs = storeRowOutputs(await service.calculateRow({ customerId, materialId, inputs: typedRow() }));
    expect(outputs[idOf('BJ')]).toBeNull();
    expect(outputs[idOf('BK')]).toBeNull();
    expect(displayStoredValue(storedAt(outputs, 'BG'))).toBe('451.40');
  });
});
