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
import { ESTIMATE_USE_LIMIT, type EstimateUses } from '../../src/server/repositories/estimate-use';
import type { EstimateUse } from '../../src/lib/errors';

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
  /** Unique ignoring letter case over every customer, a deleted one's included (CR-01 item 6). */
  shortName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  /** Set by story 02.07's delete; the fake lists no deleted customer. */
  deleted: boolean;
  /** The Draft and Prepared estimates that have this customer, in the order of their task code (STORY-02.07). A test pushes to it to make the customer "in use". */
  readonly openEstimates: EstimateUse[];
  readonly values: Map<string, string>;
}

const duplicate = (): MasterConstraintError => new MasterConstraintError('customer-name', { cause: new Error('duplicate') });
const duplicateShortName = (): MasterConstraintError => new MasterConstraintError('customer-short-name', { cause: new Error('duplicate') });

let shortNameCounter = 0;
/** A short name no other fake customer has: the fakes of one test file never repeat one, so a test that does not care about it needs not pass one. */
const nextShortName = (): string => `FK${String((shortNameCounter += 1))}`;

const sameId = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** A customer the test sets up: every Process Master item at its default, as a new customer would have it, then the `values` given by item ID. */
export function fakeCustomer(
  records: ReadonlyArray<ProcessItemRecord>,
  name: string,
  values: Readonly<Record<string, string>> = {},
  contact: Partial<Pick<FakeCustomer, 'phone' | 'email' | 'address' | 'shortName'>> = {},
): FakeCustomer {
  const own = new Map(records.map((record) => [record.id, record.defaultValue]));
  for (const [itemId, value] of Object.entries(values)) own.set(itemId, value);
  return { id: randomUUID(), name, shortName: contact.shortName ?? nextShortName(), phone: contact.phone ?? null, email: contact.email ?? null, address: contact.address ?? null, deleted: false, openEstimates: [], values: own };
}

export function createFakeCustomerMethods(records: ReadonlyArray<ProcessItemRecord>, customers: FakeCustomer[]): CustomerMethods {
  const listed = (): FakeCustomer[] => customers.filter((customer) => !customer.deleted);
  const find = (id: string): FakeCustomer | undefined => listed().find((customer) => sameId(customer.id, id));
  const taken = (name: string, exceptId?: string): boolean =>
    customers.some((customer) => customer.name.toLowerCase() === name.toLowerCase() && (exceptId === undefined || !sameId(customer.id, exceptId)));
  const shortNameTaken = (shortName: string, exceptId?: string): boolean =>
    customers.some((customer) => customer.shortName.toLowerCase() === shortName.toLowerCase() && (exceptId === undefined || !sameId(customer.id, exceptId)));
  const ratesOf = (customer: FakeCustomer): CustomerRateRecord[] =>
    records.flatMap((record) => {
      const value = customer.values.get(record.id);
      return value === undefined ? [] : [{ processItemId: record.id, name: record.name, unit: record.unit, defaultValue: record.defaultValue, value }];
    });
  const record = (customer: FakeCustomer): CustomerRecord => ({
    id: customer.id,
    name: customer.name,
    shortName: customer.shortName,
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
    // A calculation finds a deleted customer too, and says so (STORY-05.09): the row stays under the soft delete.
    findCustomerForCalculation(id: string) {
      const found = customers.find((customer) => sameId(customer.id, id));
      if (found === undefined) return Promise.resolve(null);
      return Promise.resolve(found.deleted ? { deleted: true as const, id: found.id, name: found.name } : { deleted: false as const, customer: detail(found) });
    },

    createCustomer(input: NewCustomer) {
      if (taken(input.name)) return Promise.reject(duplicate());
      if (shortNameTaken(input.shortName)) return Promise.reject(duplicateShortName());
      const created = fakeCustomer(records, input.name, {}, input);
      customers.push(created);
      return Promise.resolve(detail(created));
    },

    updateCustomerDetails(id: string, changes: CustomerDetailChanges) {
      const found = find(id);
      if (found === undefined) return Promise.resolve(false);
      if (changes.name !== undefined && taken(changes.name, found.id)) return Promise.reject(duplicate());
      if (changes.shortName !== undefined && shortNameTaken(changes.shortName, found.id)) return Promise.reject(duplicateShortName());
      if (changes.name !== undefined) found.name = changes.name;
      if (changes.shortName !== undefined) found.shortName = changes.shortName;
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

    findOpenEstimatesOfCustomer(customerId: string): Promise<EstimateUses> {
      const found = customers.find((customer) => sameId(customer.id, customerId));
      const open = found?.openEstimates ?? [];
      return Promise.resolve({ total: open.length, estimates: open.slice(0, ESTIMATE_USE_LIMIT).map((use) => ({ ...use })) });
    },

    softDeleteCustomer(id: string) {
      const found = find(id);
      if (found === undefined) return Promise.resolve(false);
      found.deleted = true;
      return Promise.resolve(true);
    },
  };
}
