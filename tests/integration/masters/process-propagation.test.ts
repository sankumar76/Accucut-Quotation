import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTransactionRunner } from '@/server/repositories/transaction';

import { contextOf, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';
import { createLateFailingRunner } from '../../support/late-failure-runner';
import { SEED_PROCESS_ITEMS } from '../../support/seed-config';

import { itemIds, openCustomerDefaults, resetCustomerTables } from './customers-support';

/**
 * STORY-02.08 AC-1 to AC-4, AC-6, AC-9 against real PostgreSQL in a throwaway database: a changed default reaches the customers that held the old one
 * in the same transaction as the rate's change, lists the customers who hold another value without changing them, and Save choices applies what the Admin
 * chose to the customers whose value is still the one shown. Every customer that changes has one `master.edited` entry of its own, after the rate's. Every
 * name and number is invented (`n.37`, ADR-014).
 *
 * The seed item 1 holds 1.37; the tests move it to 1.52. A customer's value is set by the owner, so no entry of the set-up gets in the way.
 */

const LATE_FAILURE = 'a failure after the entries were written';
const OLD = '1.37';
const NEW = '1.52';

let db: AuditDatabase;
let adminId: string;

const ITEM = defined(itemIds()[0]);
const ITEM_NAME = defined(SEED_PROCESS_ITEMS[0]).name;
const by = (requestId = 'req-propagation-0001') => ({ ...contextOf(adminId), requestId });

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await openCustomerDefaults(db);
  // A test that renames the rate or changes its unit leaves that behind; the next one starts from the seed's.
  await db.owner.query('UPDATE process_items SET name = $2, unit = $3 WHERE id = $1::uuid', [ITEM, ITEM_NAME, defined(SEED_PROCESS_ITEMS[0]).unit]);
});
afterEach(() => resetCustomerTables(db));

/** A customer at the item's default (1.37), then at `value` when one is given. The owner writes it, so no entry is made. */
async function customer(name: string, value?: string): Promise<string> {
  const { id } = await db.mastersService.createCustomer(by(), { name, phone: null, email: null, address: null });
  if (value !== undefined) await setValue(id, value);
  return id;
}

async function setValue(customerId: string, value: string, itemId: string = ITEM): Promise<void> {
  await db.owner.query('UPDATE customer_rates SET value = $3::numeric WHERE customer_id = $1::uuid AND process_item_id = $2::uuid', [customerId, itemId, value]);
}

async function valueOf(customerId: string, itemId: string = ITEM): Promise<string> {
  const { rows } = await db.owner.query<{ value: string }>('SELECT value::text AS value FROM customer_rates WHERE customer_id = $1::uuid AND process_item_id = $2::uuid', [customerId, itemId]);
  return Number(defined(rows[0]).value).toFixed(2);
}

async function defaultOf(itemId: string = ITEM): Promise<string> {
  const { rows } = await db.owner.query<{ value: string }>('SELECT default_value::text AS value FROM process_items WHERE id = $1::uuid', [itemId]);
  return Number(defined(rows[0]).value).toFixed(2);
}

interface EntryRow {
  readonly event: string;
  readonly object_type: string;
  readonly object_id: string;
  readonly object_label: string;
  readonly before: { rates: ReadonlyArray<{ processItemId: string; name: string; value: string }> };
  readonly after: { rates: ReadonlyArray<{ processItemId: string; name: string; value: string }> };
  readonly request_id: string;
}

/** The entries written after the first `skip` of the log, in the order they were written. */
async function entriesAfter(skip: number): Promise<ReadonlyArray<EntryRow>> {
  const { rows } = await db.owner.query<EntryRow>(
    'SELECT event, object_type, object_id, object_label, before, after, request_id FROM audit_log ORDER BY created_at, id OFFSET $1',
    [skip],
  );
  return rows;
}

describe('AC-1, AC-2: a save that changes the default', () => {
  it('moves the customers that hold the old default, lists the ones that hold another value, and leaves those untouched', async () => {
    const equal = await Promise.all(Array.from({ length: 17 }, (_, index) => customer(`Equal ${String(index).padStart(2, '0')} Works`)));
    const [marlow, orchid, ridge] = await Promise.all([customer('Marlow Agro', '1.50'), customer('Orchid Rail', '1.45'), customer('Ridgeline Pumps', '1.55')]);
    const answer = await db.mastersService.updateProcessItem(by(), ITEM, { defaultValue: NEW });
    expect(answer).toMatchObject({ id: ITEM, defaultValue: NEW });
    expect(answer.propagation).toEqual({
      previousDefault: OLD,
      moved: 17,
      differing: [
        { customerId: marlow, name: 'Marlow Agro', value: '1.50' },
        { customerId: orchid, name: 'Orchid Rail', value: '1.45' },
        { customerId: ridge, name: 'Ridgeline Pumps', value: '1.55' },
      ],
    });
    expect(answer.customersWithOwnValue).toBe(3);
    for (const id of equal) expect(await valueOf(id)).toBe(NEW);
    expect([await valueOf(marlow), await valueOf(orchid), await valueOf(ridge)]).toEqual(['1.50', '1.45', '1.55']);
  });

  it('does not list a customer that already holds the new default, and counts it in neither group', async () => {
    const equal = await customer('Alpha Works');
    const already = await customer('Bravo Works', NEW);
    const other = await customer('Charlie Works', '1.40');
    const answer = await db.mastersService.updateProcessItem(by(), ITEM, { defaultValue: NEW });
    expect(answer.propagation).toEqual({ previousDefault: OLD, moved: 1, differing: [{ customerId: other, name: 'Charlie Works', value: '1.40' }] });
    expect([await valueOf(equal), await valueOf(already), await valueOf(other)]).toEqual([NEW, NEW, '1.40']);
  });

  it('neither updates nor lists a customer that was deleted (A-3)', async () => {
    const gone = await customer('Gone Works');
    const goneOther = await customer('Gone Other Works', '1.40');
    await db.owner.query('UPDATE customers SET deleted_at = now() WHERE id = ANY($1::uuid[])', [[gone, goneOther]]);
    const answer = await db.mastersService.updateProcessItem(by(), ITEM, { defaultValue: NEW });
    expect(answer.propagation).toEqual({ previousDefault: OLD, moved: 0, differing: [] });
    expect([await valueOf(gone), await valueOf(goneOther)]).toEqual([OLD, '1.40']);
  });

  it('moves a percent rate the same way (12 means 12 %)', async () => {
    const percent = defined(SEED_PROCESS_ITEMS.find((item) => item.unit === '%'));
    const before = await defaultOf(percent.id);
    const id = await customer('Percent Works');
    const answer = await db.mastersService.updateProcessItem(by(), percent.id, { defaultValue: '17.50' });
    expect(answer.propagation).toEqual({ previousDefault: before, moved: 1, differing: [] });
    expect(await valueOf(id, percent.id)).toBe('17.50');
  });

  it('is a plain save when no customer holds the old value or another: nothing moves, nothing is listed, one entry', async () => {
    const entries = await entryCount(db);
    const answer = await db.mastersService.updateProcessItem(by(), ITEM, { defaultValue: NEW });
    expect(answer.propagation).toEqual({ previousDefault: OLD, moved: 0, differing: [] });
    expect(answer.customersWithOwnValue).toBe(0);
    expect(await entryCount(db)).toBe(entries + 1);
  });
});

describe('AC-6: a save that changes no default touches no customer', () => {
  it.each([
    ['only the name', { name: 'Invented-renamed-rate' }],
    ['only the unit', { unit: 'per kg' }],
    ['the default to what it was', { defaultValue: '1.37' }],
    ['the default to what it was, written with a leading zero', { defaultValue: '01.37' }],
  ])('%s: no rate row is written, no dialog is asked for and propagation is null', async (_what, changes) => {
    const [alpha, bravo] = await Promise.all([customer('Alpha Works'), customer('Bravo Works', '1.40')]);
    const stamp = async () => (await db.owner.query('SELECT customer_id::text, process_item_id::text, value::text, updated_at FROM customer_rates ORDER BY 1, 2')).rows;
    const before = await stamp();
    const answer = await db.mastersService.updateProcessItem(by(), ITEM, changes);
    expect(answer.propagation).toBeNull();
    expect(await stamp()).toEqual(before);
    expect([await valueOf(alpha), await valueOf(bravo)]).toEqual([OLD, '1.40']);
  });

  it('a save that changes nothing at all writes no entry, as before', async () => {
    const entries = await entryCount(db);
    expect((await db.mastersService.updateProcessItem(by(), ITEM, { name: ITEM_NAME })).propagation).toBeNull();
    expect(await entryCount(db)).toBe(entries);
  });
});

describe('AC-9: the audit log names every customer that changed, in the save', () => {
  it('writes the rate\'s own entry first, then one master.edited per moved customer in name order, all with one request ID, and none for the others', async () => {
    const [bravo, alpha] = await Promise.all([customer('Bravo Works'), customer('alpha works')]);
    const [other, already, gone] = await Promise.all([customer('Charlie Works', '1.40'), customer('Delta Works', NEW), customer('Echo Works')]);
    await db.owner.query('UPDATE customers SET deleted_at = now() WHERE id = $1::uuid', [gone]);
    const skip = await entryCount(db);
    await db.mastersService.updateProcessItem(by('req-save-0001'), ITEM, { name: 'Invented-renamed-rate', defaultValue: NEW });
    const written = await entriesAfter(skip);
    expect(written.map((entry) => [entry.event, entry.object_type, entry.object_id])).toEqual([
      ['master.edited', 'process_item', ITEM],
      ['master.edited', 'customer', alpha],
      ['master.edited', 'customer', bravo],
    ]);
    expect(new Set(written.map((entry) => entry.request_id))).toEqual(new Set(['req-save-0001']));
    expect(written.map((entry) => entry.object_label)).toEqual(['Invented-renamed-rate', 'alpha works', 'Bravo Works']);
    for (const entry of written.slice(1)) {
      expect(entry.before).toEqual({ name: entry.object_label, contact: [], rates: [{ processItemId: ITEM, name: 'Invented-renamed-rate', unit: expect.any(String), value: OLD }] });
      expect(entry.after).toEqual({ name: entry.object_label, contact: [], rates: [{ processItemId: ITEM, name: 'Invented-renamed-rate', unit: expect.any(String), value: NEW }] });
    }
    for (const silent of [other, already, gone]) expect(written.some((entry) => entry.object_id === silent)).toBe(false);
  });

  it('commits the rate, every customer and every entry together or not at all (a failure after the last step)', async () => {
    const ids = await Promise.all([customer('Alpha Works'), customer('Bravo Works')]);
    const entries = await entryCount(db);
    const service = db.buildMastersService({ transactions: createLateFailingRunner(createTransactionRunner(db.prisma), new Error(LATE_FAILURE)) });
    await expect(service.updateProcessItem(by(), ITEM, { defaultValue: NEW })).rejects.toThrow(LATE_FAILURE);
    expect(await defaultOf()).toBe(OLD);
    for (const id of ids) expect(await valueOf(id)).toBe(OLD);
    expect(await entryCount(db)).toBe(entries);
  });

  it('an entry the audit service refuses takes the rate and every customer back (a change is never saved without its record)', async () => {
    const id = await customer('Alpha Works');
    const entries = await entryCount(db);
    await expect(db.mastersService.updateProcessItem({ ...by(), actorLabel: '' }, ITEM, { defaultValue: NEW })).rejects.toMatchObject({ reason: 'shape' });
    expect([await defaultOf(), await valueOf(id), await entryCount(db)]).toEqual([OLD, OLD, entries]);
  });
});

describe('AC-3, AC-4: Save choices', () => {
  /** Changes the default with the three customers that differ listed, and returns what the dialog would send for them. */
  async function openDialog() {
    const [marlow, orchid, ridge] = await Promise.all([customer('Marlow Agro', '1.50'), customer('Orchid Rail', '1.45'), customer('Ridgeline Pumps', '1.55')]);
    await db.mastersService.updateProcessItem(by(), ITEM, { defaultValue: NEW });
    const shown = [
      { customerId: marlow, shownValue: '1.50' },
      { customerId: orchid, shownValue: '1.45' },
      { customerId: ridge, shownValue: '1.55' },
    ] as const;
    return { shown, marlow, orchid, ridge };
  }

  const answers = (shown: ReadonlyArray<{ customerId: string; shownValue: string }>, choice: 'apply' | 'keep' | ReadonlyArray<'apply' | 'keep'>) =>
    shown.map((entry, index) => ({ ...entry, choice: typeof choice === 'string' ? choice : defined(choice[index]) }));

  it('applies the new default to every customer on Apply and writes one entry for each, old value before and new after', async () => {
    const { shown } = await openDialog();
    const skip = await entryCount(db);
    const result = await db.mastersService.applyPropagation(by('req-choices-0001'), ITEM, { newDefault: NEW, choices: answers(shown, 'apply') });
    expect(result).toEqual({ applied: 3, kept: 0, skipped: 0 });
    for (const entry of shown) expect(await valueOf(entry.customerId)).toBe(NEW);
    const written = await entriesAfter(skip);
    expect(written.map((entry) => [entry.event, entry.object_type, entry.object_label])).toEqual([
      ['master.edited', 'customer', 'Marlow Agro'],
      ['master.edited', 'customer', 'Orchid Rail'],
      ['master.edited', 'customer', 'Ridgeline Pumps'],
    ]);
    expect(new Set(written.map((entry) => entry.request_id))).toEqual(new Set(['req-choices-0001']));
    expect(written.map((entry) => [defined(entry.before.rates[0]).value, defined(entry.after.rates[0]).value])).toEqual([
      ['1.50', NEW],
      ['1.45', NEW],
      ['1.55', NEW],
    ]);
  });

  it('leaves every customer on Keep, writes no entry and counts them as kept', async () => {
    const { shown } = await openDialog();
    const skip = await entryCount(db);
    expect(await db.mastersService.applyPropagation(by(), ITEM, { newDefault: NEW, choices: answers(shown, 'keep') })).toEqual({ applied: 0, kept: 3, skipped: 0 });
    expect([await valueOf(shown[0].customerId), await valueOf(shown[1].customerId), await valueOf(shown[2].customerId)]).toEqual(['1.50', '1.45', '1.55']);
    expect(await entriesAfter(skip)).toEqual([]);
  });

  it('applies a mix: Apply changes its customer, Keep leaves its own, and only the changed one has an entry', async () => {
    const { shown } = await openDialog();
    const skip = await entryCount(db);
    expect(await db.mastersService.applyPropagation(by(), ITEM, { newDefault: NEW, choices: answers(shown, ['keep', 'apply', 'keep']) })).toEqual({ applied: 1, kept: 2, skipped: 0 });
    expect([await valueOf(shown[0].customerId), await valueOf(shown[1].customerId), await valueOf(shown[2].customerId)]).toEqual(['1.50', NEW, '1.55']);
    expect((await entriesAfter(skip)).map((entry) => entry.object_label)).toEqual(['Orchid Rail']);
  });

  it('skips a customer whose value changed since it was listed, and overwrites nothing (AC-4)', async () => {
    const { shown, orchid } = await openDialog();
    await setValue(orchid, '1.99');
    const skip = await entryCount(db);
    expect(await db.mastersService.applyPropagation(by(), ITEM, { newDefault: NEW, choices: answers(shown, 'apply') })).toEqual({ applied: 2, kept: 0, skipped: 1 });
    expect(await valueOf(orchid)).toBe('1.99');
    expect((await entriesAfter(skip)).map((entry) => entry.object_label)).toEqual(['Marlow Agro', 'Ridgeline Pumps']);
  });

  it('skips a customer that was deleted since, and one that already holds the new default', async () => {
    const { shown, marlow, orchid } = await openDialog();
    await db.owner.query('UPDATE customers SET deleted_at = now() WHERE id = $1::uuid', [marlow]);
    await setValue(orchid, NEW);
    const skip = await entryCount(db);
    expect(await db.mastersService.applyPropagation(by(), ITEM, { newDefault: NEW, choices: answers(shown, 'apply') })).toEqual({ applied: 1, kept: 0, skipped: 2 });
    expect([await valueOf(marlow), await valueOf(orchid)]).toEqual(['1.50', NEW]);
    expect((await entriesAfter(skip)).map((entry) => entry.object_label)).toEqual(['Ridgeline Pumps']);
  });

  it('answers 409 DEFAULT_CHANGED when the default is no longer the one chosen for, and changes nothing', async () => {
    const { shown } = await openDialog();
    await db.mastersService.updateProcessItem(by(), ITEM, { defaultValue: '1.60' });
    const skip = await entryCount(db);
    await expect(db.mastersService.applyPropagation(by(), ITEM, { newDefault: NEW, choices: answers(shown, 'apply') })).rejects.toMatchObject({ httpStatus: 409, code: 'DEFAULT_CHANGED' });
    expect([await valueOf(shown[0].customerId), await valueOf(shown[1].customerId)]).toEqual(['1.50', '1.45']);
    expect(await entriesAfter(skip)).toEqual([]);
  });

  it('refuses an unknown customer ID and a repeated one with 422, and changes nothing', async () => {
    const { shown } = await openDialog();
    const skip = await entryCount(db);
    const unknown = { customerId: '00000000-0000-4000-8000-0000000000aa', shownValue: '1.50', choice: 'apply' as const };
    await expect(db.mastersService.applyPropagation(by(), ITEM, { newDefault: NEW, choices: [...answers(shown, 'apply'), unknown] })).rejects.toMatchObject({ httpStatus: 422 });
    const repeated = [...answers(shown, 'apply'), defined(answers(shown, 'apply')[0])];
    await expect(db.mastersService.applyPropagation(by(), ITEM, { newDefault: NEW, choices: repeated })).rejects.toMatchObject({ httpStatus: 422 });
    expect([await valueOf(shown[0].customerId), await entriesAfter(skip)]).toEqual(['1.50', []]);
  });

  it('answers 404 for a rate that does not exist', async () => {
    await expect(db.mastersService.applyPropagation(by(), '00000000-0000-4000-8000-0000000000bb', { newDefault: NEW, choices: [] })).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('takes every choice and its entries back when the transaction fails after the last step', async () => {
    const { shown } = await openDialog();
    const skip = await entryCount(db);
    const service = db.buildMastersService({ transactions: createLateFailingRunner(createTransactionRunner(db.prisma), new Error(LATE_FAILURE)) });
    await expect(service.applyPropagation(by(), ITEM, { newDefault: NEW, choices: answers(shown, 'apply') })).rejects.toThrow(LATE_FAILURE);
    expect(await valueOf(shown[0].customerId)).toBe('1.50');
    expect(await entriesAfter(skip)).toEqual([]);
  });

  it('is applied once when two Save choices arrive at once: the second finds the values changed and skips them, with no deadlock', async () => {
    const { shown } = await openDialog();
    const skip = await entryCount(db);
    const results = await Promise.all([
      db.mastersService.applyPropagation(by('req-a'), ITEM, { newDefault: NEW, choices: answers(shown, 'apply') }),
      db.mastersService.applyPropagation(by('req-b'), ITEM, { newDefault: NEW, choices: answers(shown, 'apply') }),
    ]);
    expect(results.map((result) => result.applied).sort()).toEqual([0, 3]);
    expect(results.map((result) => result.skipped).sort()).toEqual([0, 3]);
    expect(await entriesAfter(skip)).toHaveLength(3);
  });

  it('does not deadlock with a customer being saved or a default being changed at the same time', async () => {
    const { shown, ridge } = await openDialog();
    const settled = await Promise.allSettled([
      db.mastersService.applyPropagation(by(), ITEM, { newDefault: NEW, choices: answers(shown, 'apply') }),
      db.mastersService.updateCustomer(by(), ridge, { rates: [{ processItemId: ITEM, value: '1.20' }] }),
      db.mastersService.updateProcessItem(by(), itemIds()[1] ?? ITEM, { defaultValue: '2.52' }),
    ]);
    expect(settled.map((entry) => entry.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(['1.20', NEW]).toContain(await valueOf(ridge));
  });

  it('leaves Reset to Defaults working after a propagation: a kept customer goes back to the new default', async () => {
    const { shown, marlow } = await openDialog();
    await db.mastersService.applyPropagation(by(), ITEM, { newDefault: NEW, choices: answers(shown, 'keep') });
    expect(await db.mastersService.resetCustomerRates(by(), marlow)).toMatchObject({ count: 1 });
    expect(await valueOf(marlow)).toBe(NEW);
  });
});

describe('AC-1: the list says how many customers hold their own value', () => {
  it('counts per rate the listed customers whose value differs from the default, a deleted customer not counted, and 0 as 0 (A-4)', async () => {
    const [a, b] = await Promise.all([customer('Alpha Works', '1.40'), customer('Bravo Works', '1.41')]);
    const gone = await customer('Gone Works', '1.42');
    await db.owner.query('UPDATE customers SET deleted_at = now() WHERE id = $1::uuid', [gone]);
    const items = await db.mastersService.listProcessItems();
    expect(items.find((item) => item.id === ITEM)?.customersWithOwnValue).toBe(2);
    expect(items.filter((item) => item.id !== ITEM).map((item) => item.customersWithOwnValue)).toEqual(Array(14).fill(0));
    await setValue(a, OLD);
    await setValue(b, OLD);
    expect(defined((await db.mastersService.listProcessItems()).find((item) => item.id === ITEM)).customersWithOwnValue).toBe(0);
  });
});
