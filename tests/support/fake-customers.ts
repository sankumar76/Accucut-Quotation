import { randomUUID } from 'node:crypto';

import {
  MasterConstraintError,
  type CustomerDetailChanges,
  type CustomerDetailRecord,
  type CustomerMethods,
  type CustomerRateRecord,
  type CustomerRateValue,
  type CustomerRecord,
  type CustomerSummaryRecord,
  type NewCustomer,
  type ProcessItemRecord,
} from '../../src/server/repositories/master-repository';

/**
 * The customer half of the in-memory master repository (`fake-masters.ts`), for unit tests of the rules (no database). It keeps the behaviour the
 * service relies on: a name unique ignoring letter case, the order of the list, a customer's rates in the order of the Process Master items, a new
 * customer that copies the current defaults, and the sync of a Process Master item added or deleted. The real repository and its constraints are tested
 * against PostgreSQL in `tests/integration/masters/customers.test.ts`. Every name and number is invented (`n.37`, ADR-014).
 */

/** A customer the test may change in place. `values` holds the customer's rate for each Process Master item ID. */
export interface FakeCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  /** Set by story 02.07's delete; the fake lists no deleted customer. */
  deleted: boolean;
  readonly values: Map<string, string>;
}

const duplicate = (): MasterConstraintError => new MasterConstraintError('customer-name', { cause: new Error('duplicate') });

const sameId = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** A customer the test sets up: every Process Master item at its default, as a new customer would have it, then the `values` given by item ID. */
export function fakeCustomer(
  records: ReadonlyArray<ProcessItemRecord>,
  name: string,
  values: Readonly<Record<string, string>> = {},
  contact: Partial<Pick<FakeCustomer, 'phone' | 'email' | 'address'>> = {},
): FakeCustomer {
  const own = new Map(records.map((record) => [record.id, record.defaultValue]));
  for (const [itemId, value] of Object.entries(values)) own.set(itemId, value);
  return { id: randomUUID(), name, phone: contact.phone ?? null, email: contact.email ?? null, address: contact.address ?? null, deleted: false, values: own };
}

export function createFakeCustomerMethods(records: ReadonlyArray<ProcessItemRecord>, customers: FakeCustomer[]): CustomerMethods {
  const listed = (): FakeCustomer[] => customers.filter((customer) => !customer.deleted);
  const find = (id: string): FakeCustomer | undefined => listed().find((customer) => sameId(customer.id, id));
  const taken = (name: string, exceptId?: string): boolean =>
    customers.some((customer) => customer.name.toLowerCase() === name.toLowerCase() && (exceptId === undefined || !sameId(customer.id, exceptId)));
  const ratesOf = (customer: FakeCustomer): CustomerRateRecord[] =>
    records.flatMap((record) => {
      const value = customer.values.get(record.id);
      return value === undefined ? [] : [{ processItemId: record.id, name: record.name, unit: record.unit, defaultValue: record.defaultValue, value }];
    });
  const record = (customer: FakeCustomer): CustomerRecord => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
  });
  const detail = (customer: FakeCustomer): CustomerDetailRecord => ({ ...record(customer), rates: ratesOf(customer) });
  const byName = (a: FakeCustomer, b: FakeCustomer): number => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.name.localeCompare(b.name);

  return {
    listCustomers: () =>
      Promise.resolve(
        [...listed()].sort(byName).map((customer): CustomerSummaryRecord => ({ ...record(customer), differ: ratesOf(customer).filter((rate) => rate.value !== rate.defaultValue).length })),
      ),
    listCustomerOptions: () => Promise.resolve([...listed()].sort(byName).map(({ id, name }) => ({ id, name }))),
    findCustomer: (id) => Promise.resolve(((found) => (found === undefined ? null : detail(found)))(find(id))),
    findCustomerForUpdate: (id) => Promise.resolve(((found) => (found === undefined ? null : detail(found)))(find(id))),

    createCustomer(input: NewCustomer) {
      if (taken(input.name)) return Promise.reject(duplicate());
      const created = fakeCustomer(records, input.name, {}, input);
      customers.push(created);
      return Promise.resolve(detail(created));
    },

    updateCustomerDetails(id: string, changes: CustomerDetailChanges) {
      const found = find(id);
      if (found === undefined) return Promise.resolve(false);
      if (changes.name !== undefined && taken(changes.name, found.id)) return Promise.reject(duplicate());
      if (changes.name !== undefined) found.name = changes.name;
      if (changes.phone !== undefined) found.phone = changes.phone;
      if (changes.email !== undefined) found.email = changes.email;
      if (changes.address !== undefined) found.address = changes.address;
      return Promise.resolve(true);
    },

    setCustomerRates(customerId: string, values: ReadonlyArray<CustomerRateValue>) {
      const found = find(customerId);
      if (found === undefined || !values.every((entry) => found.values.has(entry.processItemId))) return Promise.resolve(false);
      for (const entry of values) found.values.set(entry.processItemId, entry.value);
      return Promise.resolve(true);
    },

    addProcessItemToCustomers(processItemId: string) {
      const item = records.find((candidate) => sameId(candidate.id, processItemId));
      if (item === undefined) return Promise.resolve(0);
      for (const customer of customers) customer.values.set(item.id, item.defaultValue);
      return Promise.resolve(customers.length);
    },

    removeProcessItemFromCustomers(processItemId: string) {
      const removed = customers.filter((customer) => customer.values.delete(processItemId));
      return Promise.resolve(removed.length);
    },
  };
}
