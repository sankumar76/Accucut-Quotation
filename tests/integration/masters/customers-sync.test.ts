import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { NAME_TAKEN_CODE } from '@/lib/errors';
import { createTransactionRunner, type TransactionRunner } from '@/server/repositories/transaction';

import { contextOf, entriesFor, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';
import { createLateFailingRunner } from '../../support/late-failure-runner';

import { itemIds, openCustomerDefaults, resetCustomerTables } from './customers-support';

/**
 * STORY-02.02 T3, T6 (AC-4, AC-6) against real PostgreSQL in a throwaway database: the synchronisation of SPEC section 4.2 rules 3 and 5 (a Process
 * Master item added reaches every customer at its default; one deleted leaves every customer; each in the transaction of the item's own change, with
 * the item's own entry and none per customer), an entry that commits with its change or not at all (DEF-017), and two requests at once. Every name and
 * number is invented.
 *
 * The audit entry commits with its change or not at all: the late-failure tests use the shared runner of tech-debt #130
 * (`tests/support/late-failure-runner.ts`), which fails only the outermost transaction, so an entry written in a second transaction inside the change
 * would stay behind and fail the test. Plants A3 (such an entry on a create) and A4 (on an edit and a reset) each fail this file.
 */

const LATE_FAILURE = 'a failure after the entry was written';
const NEW_RATE = { name: 'Invented-sync-rate-per-sqin', unit: 'per sq in', defaultValue: '4.37' } as const;

let db: AuditDatabase;
let adminId: string;

const by = () => contextOf(adminId);
const ids = itemIds();
const FIRST_ITEM = defined(ids[0]);

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

beforeEach(() => openCustomerDefaults(db));
afterEach(() => resetCustomerTables(db));

async function customerNamed(name: string) {
  return db.mastersService.createCustomer(by(), { name, phone: null, email: null, address: null });
}

async function ratesCount(customerId: string): Promise<number> {
  const { rows } = await db.owner.query<{ count: string }>('SELECT count(*) FROM customer_rates WHERE customer_id = $1::uuid', [customerId]);
  return Number(defined(rows[0]).count);
}

/** The outermost transaction fails after its work; one opened inside it commits (tests/support/late-failure-runner.ts, #130). */
function failingAfterTheLastStep(): TransactionRunner {
  return createLateFailingRunner(createTransactionRunner(db.prisma), new Error(LATE_FAILURE));
}

describe('AC-4 (T3): a Process Master item added or deleted reaches every customer, in the same transaction', () => {
  it('gives an added item a rate row on every customer at its default, and writes only the item\'s own master.created entry, none per customer', async () => {
    const alpha = await customerNamed('Alpha Works');
    const bravo = await customerNamed('Bravo Works');
    const entries = await entryCount(db);
    const item = await db.mastersService.createProcessItem(by(), NEW_RATE);
    for (const customer of [alpha, bravo]) {
      const detail = await db.mastersService.getCustomer(customer.id);
      expect(detail.rates).toHaveLength(16);
      expect(detail.rates.at(-1)).toMatchObject({ processItemId: item.id, name: NEW_RATE.name, defaultValue: '4.37', value: '4.37' });
    }
    expect(await entryCount(db)).toBe(entries + 1);
    expect((await entriesFor(db, item.id)).map((entry) => [entry.event, entry.object_type])).toEqual([['master.created', 'process_item']]);
    for (const customer of [alpha, bravo]) expect(await entriesFor(db, customer.id)).toHaveLength(1);
  });

  it('removes a deleted item from every customer, and writes only the item\'s own master.deleted entry', async () => {
    const item = await db.mastersService.createProcessItem(by(), NEW_RATE);
    const alpha = await customerNamed('Alpha Works');
    const bravo = await customerNamed('Bravo Works');
    expect(await ratesCount(alpha.id)).toBe(16);
    const entries = await entryCount(db);
    await db.mastersService.deleteProcessItem(by(), item.id);
    for (const customer of [alpha, bravo]) {
      expect((await db.mastersService.getCustomer(customer.id)).rates.map((rate) => rate.processItemId)).toEqual(ids);
      expect(await ratesCount(customer.id)).toBe(15);
    }
    expect(await entryCount(db)).toBe(entries + 1);
    expect(defined((await entriesFor(db, item.id)).at(-1)).event).toBe('master.deleted');
  });

  it('adds the rate for 100 customers with one statement: 100 rows at the default, in a read that does not grow with the customers', async () => {
    await db.owner.query(`INSERT INTO customers (name) SELECT 'Invented bulk customer ' || n FROM generate_series(1, 100) AS n`);
    await db.owner.query('INSERT INTO customer_rates (customer_id, process_item_id, value) SELECT c.id, pi.id, pi.default_value FROM customers c CROSS JOIN process_items pi');
    const item = await db.mastersService.createProcessItem(by(), NEW_RATE);
    const { rows } = await db.owner.query<{ count: string; distinct: string }>(
      `SELECT count(*) AS count, count(DISTINCT value) AS distinct FROM customer_rates WHERE process_item_id = $1::uuid`,
      [item.id],
    );
    expect(rows[0]).toEqual({ count: '100', distinct: '1' });
    expect((await db.mastersService.listCustomers()).length).toBe(100);
  });

  it('also reaches a customer that is soft-deleted, so no rate is missing if the customer is ever listed again', async () => {
    const gone = await customerNamed('Gone Works');
    await db.owner.query('UPDATE customers SET deleted_at = now() WHERE id = $1::uuid', [gone.id]);
    await db.mastersService.createProcessItem(by(), NEW_RATE);
    expect(await ratesCount(gone.id)).toBe(16);
  });
});

describe('AC-4, AC-6 (DEF-017): an item\'s change and its sync commit together or not at all', () => {
  it('add: no item, no rate row on any customer and no entry is left when the transaction fails after its last step', async () => {
    const customer = await customerNamed('Alpha Works');
    const entries = await entryCount(db);
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });
    await expect(service.createProcessItem(by(), NEW_RATE)).rejects.toThrow(LATE_FAILURE);
    expect(await ratesCount(customer.id)).toBe(15);
    const { rows } = await db.owner.query('SELECT 1 FROM process_items WHERE name = $1', [NEW_RATE.name]);
    expect(rows).toEqual([]);
    expect(await entryCount(db)).toBe(entries);
  });

  it('delete: the item and every customer\'s rate for it are still there, and no entry is left', async () => {
    const item = await db.mastersService.createProcessItem(by(), NEW_RATE);
    const customer = await customerNamed('Alpha Works');
    const entries = await entryCount(db);
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });
    await expect(service.deleteProcessItem(by(), item.id)).rejects.toThrow(LATE_FAILURE);
    expect(await ratesCount(customer.id)).toBe(16);
    expect(await entryCount(db)).toBe(entries);
  });

  it('create: no customer, no rate row and no entry is left', async () => {
    const entries = await entryCount(db);
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });
    await expect(service.createCustomer(by(), { name: 'Late-failure-create', phone: null, email: null, address: null })).rejects.toThrow(LATE_FAILURE);
    expect((await db.mastersService.listCustomers()).map((customer) => customer.name)).toEqual([]);
    const { rows } = await db.owner.query('SELECT 1 FROM customer_rates');
    expect(rows).toEqual([]);
    expect(await entryCount(db)).toBe(entries);
  });

  it('edit: the customer\'s rates and details are as they were and no entry is left', async () => {
    const customer = await customerNamed('Late-failure-edit');
    const entries = await entryCount(db);
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });
    await expect(service.updateCustomer(by(), customer.id, { name: 'Late-failure-edited', rates: [{ processItemId: FIRST_ITEM, value: '9.5' }] })).rejects.toThrow(LATE_FAILURE);
    expect(await db.mastersService.getCustomer(customer.id)).toEqual(customer);
    expect(await entryCount(db)).toBe(entries);
  });

  it('reset: the rates are as they were and no entry is left', async () => {
    const customer = await customerNamed('Late-failure-reset');
    await db.mastersService.updateCustomer(by(), customer.id, { rates: [{ processItemId: FIRST_ITEM, value: '9.5' }] });
    const before = await db.mastersService.getCustomer(customer.id);
    const entries = await entryCount(db);
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });
    await expect(service.resetCustomerRates(by(), customer.id)).rejects.toThrow(LATE_FAILURE);
    expect(await db.mastersService.getCustomer(customer.id)).toEqual(before);
    expect(await entryCount(db)).toBe(entries);
  });

  it('an entry the audit service refuses takes the create, the edit and the reset back (a change is never saved without its record, NFR-007)', async () => {
    const customer = await customerNamed('Refused-entry');
    await db.mastersService.updateCustomer(by(), customer.id, { rates: [{ processItemId: FIRST_ITEM, value: '9.5' }] });
    const before = await db.mastersService.getCustomer(customer.id);
    const entries = await entryCount(db);
    const unrecorded = { ...by(), actorLabel: '' };
    await expect(db.mastersService.createCustomer(unrecorded, { name: 'Refused-create', phone: null, email: null, address: null })).rejects.toMatchObject({ reason: 'shape' });
    await expect(db.mastersService.updateCustomer(unrecorded, customer.id, { name: 'Refused-edit' })).rejects.toMatchObject({ reason: 'shape' });
    await expect(db.mastersService.resetCustomerRates(unrecorded, customer.id)).rejects.toMatchObject({ reason: 'shape' });
    expect(await db.mastersService.getCustomer(customer.id)).toEqual(before);
    expect((await db.mastersService.listCustomers()).map((entry) => entry.name)).toEqual(['Refused-entry']);
    expect(await entryCount(db)).toBe(entries);
  });
});

describe('two requests at once', () => {
  it('let exactly one of several simultaneous additions of one name (in different letter case) win; the others are told the name is taken', async () => {
    const attempts = await Promise.allSettled(['Race-Works', 'RACE-WORKS', 'race-works', 'Race-works'].map((name) => customerNamed(name)));
    const winners = attempts.flatMap((attempt) => (attempt.status === 'fulfilled' ? [attempt.value] : []));
    expect(winners).toHaveLength(1);
    for (const attempt of attempts) {
      if (attempt.status === 'rejected') expect(attempt.reason).toMatchObject({ code: NAME_TAKEN_CODE });
    }
    expect(await entriesFor(db, defined(winners[0]).id)).toHaveLength(1);
  });

  it('give every customer every item when a customer is added while an item is added: none misses the new rate, whichever commits first', async () => {
    await customerNamed('Existing Works');
    const [item, added] = await Promise.all([db.mastersService.createProcessItem(by(), NEW_RATE), customerNamed('Concurrent Works')]);
    const { rows } = await db.owner.query<{ name: string; count: string }>(
      `SELECT c.name, count(cr.id) AS count FROM customers c LEFT JOIN customer_rates cr ON cr.customer_id = c.id GROUP BY c.name ORDER BY c.name`,
    );
    expect(rows).toEqual([
      { name: 'Concurrent Works', count: '16' },
      { name: 'Existing Works', count: '16' },
    ]);
    expect((await db.mastersService.getCustomer(added.id)).rates.some((rate) => rate.processItemId === item.id)).toBe(true);
  });

  it('serialise an edit of a customer and the delete of an item it holds: the edit either lands first or is told the rate changed, and never leaves a stray row', async () => {
    const item = await db.mastersService.createProcessItem(by(), NEW_RATE);
    const customer = await customerNamed('Racing Works');
    const settled = await Promise.allSettled([
      db.mastersService.updateCustomer(by(), customer.id, { rates: [{ processItemId: item.id, value: '8.5' }] }),
      db.mastersService.deleteProcessItem(by(), item.id),
    ]);
    expect(settled[1]?.status).toBe('fulfilled');
    if (settled[0]?.status === 'rejected') expect(settled[0].reason).toMatchObject({ code: 'RATES_CHANGED' });
    expect(await ratesCount(customer.id)).toBe(15);
    const { rows } = await db.owner.query('SELECT 1 FROM customer_rates WHERE process_item_id = $1::uuid', [item.id]);
    expect(rows).toEqual([]);
  });
});
