import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FieldValidationError, NAME_TAKEN_CODE, NotFoundError } from '@/lib/errors';
import { MasterConstraintError } from '@/server/repositories/master-repository';

import { contextOf, entriesFor, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { customerSide } from '../../support/customer-audit-side';
import { defined } from '../../support/defined';
import { refusal } from '../../support/user-service-fixture';

import { itemIds, openCustomerDefaults, resetCustomerTables, seedDefaultValue, type CustomerRateRow } from './customers-support';

/**
 * STORY-02.02 T1, T2 and T3 (AC-1, AC-2, AC-3, AC-5, AC-6) against real PostgreSQL in a throwaway database: the rules the two tables keep
 * (a name unique ignoring letter case and never blank, one rate per customer and item, a rate 0 or more, no DELETE or TRUNCATE on `customers`, no
 * cascade), the Customer service over the real repositories (a new customer copies the current defaults in one statement; an edit and a reset write
 * exactly one entry with the state of architecture section 8 "Customers", contact field names and never their values; a save or a reset that changes
 * nothing writes none), and the safe options list. The item sync (AC-4), the late-failure tests (DEF-017) and two requests at once are in
 * `customers-sync.test.ts`. Every name, e-mail address, phone number and rate is invented.
 */

let db: AuditDatabase;
let adminId: string;

const by = () => contextOf(adminId);

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

async function rateRows(customerId: string): Promise<CustomerRateRow[]> {
  const { rows } = await db.owner.query<CustomerRateRow>(
    `SELECT cr.process_item_id::text AS "processItemId", cr.value::text AS "value" FROM customer_rates cr JOIN process_items pi ON pi.id = cr.process_item_id
     WHERE cr.customer_id = $1::uuid ORDER BY pi.created_at, pi.id`,
    [customerId],
  );
  return rows;
}

const ids = itemIds();
const FIRST_ITEM = defined(ids[0]);
const SECOND_ITEM = defined(ids[1]);
const PERCENT_ITEM = defined(ids[12]);

describe('AC-1 (T1): what the tables keep, whoever writes to them', () => {
  const insert = 'INSERT INTO customers (name) VALUES ($1) RETURNING id::text';

  it('refuses a name another customer has ignoring letter case, even to the owner (the unique index), and a blank name (the CHECK)', async () => {
    await db.owner.query(insert, ['Invented Works']);
    await expect(db.owner.query(insert, ['INVENTED WORKS'])).rejects.toMatchObject({ constraint: 'uq_customers_name_lower' });
    await expect(db.owner.query(insert, ['Invented Works'])).rejects.toMatchObject({ constraint: expect.stringMatching(/^uq_customers_name/) });
    await expect(db.owner.query(insert, ['   '])).rejects.toMatchObject({ constraint: 'ck_customers_name_not_blank' });
  });

  it('holds one rate per customer and item, never negative, and no rate for an item or a customer that is not there', async () => {
    const { rows } = await db.owner.query<{ id: string }>(insert, ['Invented Works']);
    const customerId = defined(rows[0]).id;
    const add = 'INSERT INTO customer_rates (customer_id, process_item_id, value) VALUES ($1::uuid, $2::uuid, $3)';
    await db.owner.query(add, [customerId, FIRST_ITEM, '1.37']);
    await expect(db.owner.query(add, [customerId, FIRST_ITEM, '2.37'])).rejects.toMatchObject({ constraint: 'uq_customer_rates_customer_id_process_item_id' });
    await expect(db.owner.query(add, [customerId, SECOND_ITEM, '-0.01'])).rejects.toMatchObject({ constraint: 'ck_customer_rates_value_not_negative' });
    await expect(db.owner.query(add, [customerId, '00000000-0000-4000-8000-0ccc00000009', '1.37'])).rejects.toMatchObject({ constraint: 'fk_customer_rates_process_item_id' });
    await expect(db.owner.query(add, ['00000000-0000-4000-8000-0ccc00000009', SECOND_ITEM, '1.37'])).rejects.toMatchObject({ constraint: 'fk_customer_rates_customer_id' });
  });

  it('refuses to delete a Process Master item that a customer still has a rate for: no cascade hides a forgotten sync (AC-4)', async () => {
    const created = await db.mastersService.createCustomer(by(), { name: 'Invented Works', phone: null, email: null, address: null });
    expect(created.rates).toHaveLength(15);
    await expect(db.owner.query('DELETE FROM process_items WHERE id = $1::uuid', [FIRST_ITEM])).rejects.toMatchObject({ constraint: 'fk_customer_rates_process_item_id' });
  });

  it('gives the runtime role no DELETE and no TRUNCATE on customers, and DELETE but no TRUNCATE on customer_rates', async () => {
    const privileges = await db.owner.query<{ tableName: string; privilege: string; granted: boolean }>(
      `SELECT t AS "tableName", p AS privilege, has_table_privilege('accucut_app', t, p) AS granted
       FROM unnest(ARRAY['customers', 'customer_rates']) AS t, unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) AS p`,
    );
    const granted = (table: string) => Object.fromEntries(privileges.rows.filter((row) => row.tableName === table).map((row) => [row.privilege, row.granted]));
    expect(granted('customers')).toEqual({ SELECT: true, INSERT: true, UPDATE: true, DELETE: false, TRUNCATE: false });
    expect(granted('customer_rates')).toEqual({ SELECT: true, INSERT: true, UPDATE: true, DELETE: true, TRUNCATE: false });
  });

  it('reports a repeated name as the customers rule, whatever the spelling: the exact twin and the lower-case twin both map to customer-name', async () => {
    await db.transactions.run((tx) => db.masterRepository.createCustomer({ name: 'Invented Works', phone: null, email: null, address: null }, tx));
    for (const name of ['Invented Works', 'INVENTED WORKS']) {
      const error = await refusal(db.transactions.run((tx) => db.masterRepository.createCustomer({ name, phone: null, email: null, address: null }, tx)));
      expect(error).toBeInstanceOf(MasterConstraintError);
      expect(error).toMatchObject({ constraint: 'customer-name' });
    }
  });
});

describe('AC-1, AC-6 (T2): adding a customer', () => {
  it('stores a customer with a name only, copies every current default into 15 rate rows, and writes exactly one master.created entry', async () => {
    const entries = await entryCount(db);
    const created = await db.mastersService.createCustomer(by(), { name: '  Invented   Works ', phone: null, email: null, address: null });
    expect(created).toMatchObject({ name: 'Invented Works', phone: null, email: null, address: null });
    const defaults = await seedDefaultValue(db);
    expect(created.rates).toHaveLength(15);
    expect(created.rates.map((rate) => [rate.processItemId, rate.value, rate.defaultValue])).toEqual(ids.map((id) => [id, defaults.get(id), defaults.get(id)]));
    expect((await rateRows(created.id)).map((row) => row.processItemId)).toEqual(ids);
    expect(await entryCount(db)).toBe(entries + 1);
    const [entry, ...others] = await entriesFor(db, created.id);
    expect(others).toEqual([]);
    expect(entry).toMatchObject({ event: 'master.created', actor_id: adminId, object_type: 'customer', object_id: created.id, object_label: 'Invented Works', before: null });
    expect(entry?.after).toMatchObject({ name: 'Invented Works', contact: [] });
    expect(customerSide(entry?.after).rates).toHaveLength(15);
  });

  it('keeps the contact details given and names only the fields given in the entry, never their values', async () => {
    const created = await db.mastersService.createCustomer(by(), { name: 'Invented Works', phone: ' +99 555 0142 ', email: 'buying@invented.example.test', address: null });
    expect(created).toMatchObject({ phone: '+99 555 0142', email: 'buying@invented.example.test', address: null });
    const entry = defined((await entriesFor(db, created.id))[0]);
    expect(entry.after).toMatchObject({ contact: ['phone', 'email'] });
    expect(entry.after_text).not.toContain('invented.example.test');
    expect(entry.after_text).not.toContain('555 0142');
  });

  it('refuses a blank name, a name that is taken ignoring letter case, and an e-mail address that does not look like one, and stores and writes nothing', async () => {
    await db.mastersService.createCustomer(by(), { name: 'Invented Works', phone: null, email: null, address: null });
    const entries = await entryCount(db);
    const blank = await refusal(db.mastersService.createCustomer(by(), { name: '   ', phone: null, email: null, address: null }));
    expect(blank).toMatchObject({ fields: [{ field: 'name', message: 'Enter the customer name.' }] });
    const taken = await refusal(db.mastersService.createCustomer(by(), { name: 'invented WORKS', phone: null, email: null, address: null }));
    expect(taken).toBeInstanceOf(FieldValidationError);
    expect(taken).toMatchObject({ code: NAME_TAKEN_CODE, fields: [{ field: 'name', message: 'A customer with this name already exists.' }] });
    const email = await refusal(db.mastersService.createCustomer(by(), { name: 'Other Works', phone: null, email: 'not-an-address', address: null }));
    expect(email).toMatchObject({ fields: [{ field: 'email', message: 'Enter an e-mail address like name@company.com.' }] });
    expect(await entryCount(db)).toBe(entries);
    expect((await db.mastersService.listCustomers()).map((customer) => customer.name)).toEqual(['Invented Works']);
  });
});

describe('AC-2, AC-6 (T2): editing a customer', () => {
  async function created(name = 'Invented Works') {
    return db.mastersService.createCustomer(by(), { name, phone: '+99 555 0142', email: null, address: null });
  }

  it('sets a rate and writes one master.edited entry holding the name, no contact field and only the rate that changed, old value before and new value after', async () => {
    const customer = await created();
    const updated = await db.mastersService.updateCustomer(by(), customer.id, { rates: [{ processItemId: FIRST_ITEM, value: '7.5' }] });
    expect(updated.rates.find((rate) => rate.processItemId === FIRST_ITEM)?.value).toBe('7.50');
    expect((await rateRows(customer.id)).find((row) => row.processItemId === FIRST_ITEM)?.value).toBe('7.5000');
    const entry = defined((await entriesFor(db, customer.id)).at(-1));
    const old = defined(customer.rates.find((rate) => rate.processItemId === FIRST_ITEM));
    expect(entry).toMatchObject({ event: 'master.edited', object_type: 'customer', object_label: 'Invented Works' });
    expect(entry.before).toEqual({ name: 'Invented Works', contact: [], rates: [{ processItemId: FIRST_ITEM, name: old.name, unit: old.unit, value: old.value }] });
    expect(entry.after).toEqual({ name: 'Invented Works', contact: [], rates: [{ processItemId: FIRST_ITEM, name: old.name, unit: old.unit, value: '7.50' }] });
  });

  it('lists the same items on both sides, in the order of the table, when several rates change', async () => {
    const customer = await created();
    await db.mastersService.updateCustomer(by(), customer.id, {
      rates: [
        { processItemId: PERCENT_ITEM, value: '19' },
        { processItemId: FIRST_ITEM, value: '8.25' },
      ],
    });
    const entry = defined((await entriesFor(db, customer.id)).at(-1));
    const sides = [entry.before, entry.after].map((side) => customerSide(side).rates.map((rate) => rate.processItemId));
    expect(sides[0]).toEqual([FIRST_ITEM, PERCENT_ITEM]);
    expect(sides[1]).toEqual(sides[0]);
  });

  it('changes the name and the contact fields, names the contact fields that changed on both sides and never keeps their values', async () => {
    const customer = await created();
    const updated = await db.mastersService.updateCustomer(by(), customer.id, { name: 'Renamed Works', phone: null, email: 'new@invented.example.test', address: '1 Invented Road' });
    expect(updated).toMatchObject({ name: 'Renamed Works', phone: null, email: 'new@invented.example.test', address: '1 Invented Road' });
    const entry = defined((await entriesFor(db, customer.id)).at(-1));
    expect(entry).toMatchObject({ event: 'master.edited', object_label: 'Renamed Works' });
    expect(entry.before).toEqual({ name: 'Invented Works', contact: ['phone', 'email', 'address'], rates: [] });
    expect(entry.after).toEqual({ name: 'Renamed Works', contact: ['phone', 'email', 'address'], rates: [] });
    expect(`${entry.before_text}${entry.after_text}`).not.toMatch(/invented\.example|Invented Road|555 0142/);
  });

  it('writes no change and no entry for a save that changes nothing: the same name, the same contact, rates typed as they are stored', async () => {
    const customer = await created();
    const entries = await entryCount(db);
    const again = await db.mastersService.updateCustomer(by(), customer.id, {
      name: ' Invented  Works ',
      phone: '+99 555 0142',
      email: '',
      rates: customer.rates.map((rate) => ({ processItemId: rate.processItemId, value: String(Number(rate.value)) })),
    });
    expect(again).toEqual(customer);
    expect(await entryCount(db)).toBe(entries);
  });

  it('refuses a rate with three decimals and a percent rate with three decimals, naming the rate, and writes nothing', async () => {
    const customer = await created();
    const entries = await entryCount(db);
    const bad = await refusal(
      db.mastersService.updateCustomer(by(), customer.id, {
        rates: [
          { processItemId: FIRST_ITEM, value: '1.234' },
          { processItemId: SECOND_ITEM, value: '2.5' },
          { processItemId: PERCENT_ITEM, value: '11.555' },
        ],
      }),
    );
    expect(bad).toBeInstanceOf(FieldValidationError);
    expect(bad).toMatchObject({
      fields: [
        { field: 'rates.0.value', message: 'Enter a number, 0 or more, with up to 2 decimals.' },
        { field: 'rates.2.value', message: 'Enter a number, 0 or more, with up to 2 decimals.' },
      ],
    });
    expect((await rateRows(customer.id)).find((row) => row.processItemId === SECOND_ITEM)?.value).not.toBe('2.5000');
    expect(await entryCount(db)).toBe(entries);
  });

  it('answers not found for an unknown ID and for text that is not an ID, and 409 for a rate the customer does not have', async () => {
    const customer = await created();
    const entries = await entryCount(db);
    expect(await refusal(db.mastersService.updateCustomer(by(), '00000000-0000-4000-8000-0ccc00000009', { name: 'Anything' }))).toBeInstanceOf(NotFoundError);
    expect(await refusal(db.mastersService.updateCustomer(by(), 'not-an-id', { name: 'Anything' }))).toBeInstanceOf(NotFoundError);
    const gone = await refusal(db.mastersService.updateCustomer(by(), customer.id, { rates: [{ processItemId: '00000000-0000-4000-8000-0ccc00000009', value: '1.00' }] }));
    expect(gone).toMatchObject({ httpStatus: 409, code: 'RATES_CHANGED' });
    expect(await entryCount(db)).toBe(entries);
  });

  it('refuses a rename onto another customer, ignoring letter case, and changes nothing', async () => {
    await created('Invented Works');
    const second = await created('Second Works');
    const entries = await entryCount(db);
    expect(await refusal(db.mastersService.updateCustomer(by(), second.id, { name: 'INVENTED WORKS' }))).toMatchObject({ code: NAME_TAKEN_CODE });
    expect((await db.mastersService.getCustomer(second.id)).name).toBe('Second Works');
    expect(await entryCount(db)).toBe(entries);
  });
});

describe('AC-3, AC-6 (T3): reset to defaults', () => {
  it('sets every rate that differs back to the current default, answers with the count and writes one master.edited entry with no contact and only those rates', async () => {
    const customer = await db.mastersService.createCustomer(by(), { name: 'Invented Works', phone: null, email: null, address: null });
    await db.mastersService.updateCustomer(by(), customer.id, {
      rates: [
        { processItemId: FIRST_ITEM, value: '9.5' },
        { processItemId: PERCENT_ITEM, value: '30' },
      ],
    });
    const entries = await entryCount(db);
    const result = await db.mastersService.resetCustomerRates(by(), customer.id);
    expect(result.count).toBe(2);
    expect(result.customer.rates.every((rate) => rate.value === rate.defaultValue)).toBe(true);
    const defaults = await seedDefaultValue(db);
    expect((await rateRows(customer.id)).map((row) => Number(row.value))).toEqual(ids.map((id) => Number(defaults.get(id))));
    expect(await entryCount(db)).toBe(entries + 1);
    const entry = defined((await entriesFor(db, customer.id)).at(-1));
    expect(entry).toMatchObject({ event: 'master.edited', object_type: 'customer' });
    expect(customerSide(entry.before).contact).toEqual([]);
    expect(customerSide(entry.after).contact).toEqual([]);
    expect(customerSide(entry.before).rates.map((rate) => [rate.processItemId, rate.value])).toEqual([
      [FIRST_ITEM, '9.50'],
      [PERCENT_ITEM, '30.00'],
    ]);
    expect(customerSide(entry.after).rates.map((rate) => rate.processItemId)).toEqual([FIRST_ITEM, PERCENT_ITEM]);
  });

  it('follows a changed default: a reset after the Admin changed an item\'s default sets the rate to the new default', async () => {
    const customer = await db.mastersService.createCustomer(by(), { name: 'Invented Works', phone: null, email: null, address: null });
    await db.owner.query('UPDATE process_items SET default_value = 41.37 WHERE id = $1::uuid', [FIRST_ITEM]);
    const result = await db.mastersService.resetCustomerRates(by(), customer.id);
    expect(result.count).toBe(1);
    expect(defined(result.customer.rates[0]).value).toBe('41.37');
  });

  it('is idempotent: a customer with every default is a count of 0, and a second reset writes no entry', async () => {
    const customer = await db.mastersService.createCustomer(by(), { name: 'Invented Works', phone: null, email: null, address: null });
    const entries = await entryCount(db);
    expect((await db.mastersService.resetCustomerRates(by(), customer.id)).count).toBe(0);
    await db.mastersService.updateCustomer(by(), customer.id, { rates: [{ processItemId: FIRST_ITEM, value: '3.5' }] });
    expect((await db.mastersService.resetCustomerRates(by(), customer.id)).count).toBe(1);
    expect((await db.mastersService.resetCustomerRates(by(), customer.id)).count).toBe(0);
    expect(await entryCount(db)).toBe(entries + 2);
  });

  it('answers not found for an unknown customer and writes nothing', async () => {
    const entries = await entryCount(db);
    expect(await refusal(db.mastersService.resetCustomerRates(by(), '00000000-0000-4000-8000-0ccc00000009'))).toBeInstanceOf(NotFoundError);
    expect(await entryCount(db)).toBe(entries);
  });
});

describe('AC-1, AC-5 (T1): the lists', () => {
  it('lists customers by name ignoring letter case with how many rates differ, in one read, and offers the same as options with an ID and a name only', async () => {
    const bravo = await db.mastersService.createCustomer(by(), { name: 'bravo Works', phone: null, email: null, address: null });
    await db.mastersService.createCustomer(by(), { name: 'Alpha Works', phone: '+99 555 0142', email: null, address: null });
    await db.mastersService.updateCustomer(by(), bravo.id, { rates: [{ processItemId: FIRST_ITEM, value: '5.5' }, { processItemId: SECOND_ITEM, value: '6.5' }] });
    const list = await db.mastersService.listCustomers();
    expect(list.map((customer) => [customer.name, customer.differ])).toEqual([['Alpha Works', 0], ['bravo Works', 2]]);
    const options = await db.mastersService.listCustomerOptions();
    expect(options.map((option) => option.name)).toEqual(['Alpha Works', 'bravo Works']);
    for (const option of options) expect(Object.keys(option).sort()).toEqual(['id', 'name']);
  });

  it('never lists a deleted customer and never finds one by ID (A-13)', async () => {
    const customer = await db.mastersService.createCustomer(by(), { name: 'Invented Works', phone: null, email: null, address: null });
    await db.owner.query('UPDATE customers SET deleted_at = now() WHERE id = $1::uuid', [customer.id]);
    expect(await db.mastersService.listCustomers()).toEqual([]);
    expect(await db.mastersService.listCustomerOptions()).toEqual([]);
    expect(await refusal(db.mastersService.getCustomer(customer.id))).toBeInstanceOf(NotFoundError);
    expect(await refusal(db.mastersService.updateCustomer(by(), customer.id, { name: 'Anything' }))).toBeInstanceOf(NotFoundError);
    expect(await refusal(db.mastersService.resetCustomerRates(by(), customer.id))).toBeInstanceOf(NotFoundError);
  });
});
