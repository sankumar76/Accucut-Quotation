import { Decimal } from '../../src/lib/decimal';
import { trimDecimalText } from '../../src/server/repositories/decimal-text';
import type { ChangedCustomer, CustomerWithOwnValue, PropagationMethods, ShownRate } from '../../src/server/repositories/default-propagation-repository';
import type { ProcessItemRecord } from '../../src/server/repositories/master-repository';

import type { FakeCustomer } from './fake-customers';

/**
 * The changed-default half of the in-memory master repository (`fake-masters.ts`), for unit tests of the rules and the routes (no database): the same
 * rules as `default-propagation-repository.ts`, which is tested against PostgreSQL in `tests/integration/masters/process-propagation.test.ts`. A value is
 * compared as a number (`Decimal`), a deleted customer is never moved, listed, counted or applied to, and the customers come back in name order.
 * Every name and number is invented.
 */

const sameId = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
const equal = (a: string, b: string): boolean => new Decimal(a).eq(b);
const byName = (a: ChangedCustomer, b: ChangedCustomer): number => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.name.localeCompare(b.name) || a.customerId.localeCompare(b.customerId);

export function createFakePropagationMethods(records: ReadonlyArray<ProcessItemRecord>, customers: FakeCustomer[]): PropagationMethods {
  const listed = (): FakeCustomer[] => customers.filter((customer) => !customer.deleted);
  const asChanged = (customer: FakeCustomer): ChangedCustomer => ({ customerId: customer.id, name: customer.name });
  const itemOf = (id: string): ProcessItemRecord | undefined => records.find((record) => sameId(record.id, id));
  const move = (itemId: string, next: string, wanted: (customer: FakeCustomer, value: string) => boolean): ChangedCustomer[] => {
    const moved = listed().filter((customer) => {
      const value = customer.values.get(itemId);
      return value !== undefined && wanted(customer, value);
    });
    for (const customer of moved) customer.values.set(itemId, trimDecimalText(new Decimal(next).toFixed(4)));
    return moved.map(asChanged).sort(byName);
  };

  return {
    countCustomersWithOwnValue() {
      const counts = new Map<string, number>();
      for (const record of records) {
        const differing = listed().filter((customer) => {
          const value = customer.values.get(record.id);
          return value !== undefined && !equal(value, record.defaultValue);
        });
        if (differing.length > 0) counts.set(record.id, differing.length);
      }
      return Promise.resolve(counts);
    },

    moveCustomersToDefault: (processItemId, previous, next) => Promise.resolve(move(processItemId, next, (_customer, value) => equal(value, previous))),

    listCustomersWithOwnValue(processItemId) {
      const item = itemOf(processItemId);
      if (item === undefined) return Promise.resolve([]);
      const rows: CustomerWithOwnValue[] = listed().flatMap((customer) => {
        const value = customer.values.get(item.id);
        return value === undefined || equal(value, item.defaultValue) ? [] : [{ ...asChanged(customer), value: trimDecimalText(value) }];
      });
      return Promise.resolve(rows.sort(byName));
    },

    findExistingCustomerIds: (ids) => Promise.resolve(new Set(customers.filter((customer) => ids.some((id) => sameId(id, customer.id))).map((customer) => customer.id.toLowerCase()))),

    applyDefaultToCustomers(processItemId: string, next: string, shown: ReadonlyArray<ShownRate>) {
      const sees = (customer: FakeCustomer, value: string): boolean =>
        !equal(value, next) && shown.some((entry) => sameId(entry.customerId, customer.id) && equal(entry.shownValue, value));
      return Promise.resolve(move(processItemId, next, sees));
    },
  };
}
