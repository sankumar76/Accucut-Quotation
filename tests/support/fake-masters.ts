import { randomUUID } from 'node:crypto';

import {
  MasterConstraintError,
  type MasterRepository,
  type NewProcessItem,
  type ProcessItemChanges,
  type ProcessItemRecord,
} from '../../src/server/repositories/master-repository';

import { SEED_PROCESS_ITEMS } from './seed-config';

/**
 * An in-memory stand-in for the master repository, for unit tests of the rules (no database). It keeps the behaviour the service
 * relies on: the order of the list, a name unique ignoring letter case (the database's `uq_process_items_name_lower`), a row lock
 * that is only a record that it was asked for. The real repository, its locking and its constraints are tested against PostgreSQL in
 * `tests/integration/masters`. Every name and number is invented (`n.37`, ADR-014).
 */

/** A rate the test may change in place. */
export type MutableProcessItem = { -readonly [K in keyof ProcessItemRecord]: ProcessItemRecord[K] };

export interface FakeMasterRepository extends MasterRepository {
  /** Mutable, so a test can set a state up the way the Admin would have. */
  readonly records: MutableProcessItem[];
  /** How many times the table lock was taken: a change to the set of names takes it first. */
  lockCount(): number;
}

/** The 15 seed items with their fixed IDs, units and a default of 0.00: what a fresh install holds (architecture section 5.6). */
export function seedRecords(): MutableProcessItem[] {
  return SEED_PROCESS_ITEMS.map((item) => ({ id: item.id, name: item.name, unit: item.unit, defaultValue: '0.00' }));
}

export function createFakeMasterRepository(initial: ReadonlyArray<ProcessItemRecord> = seedRecords()): FakeMasterRepository {
  const records: MutableProcessItem[] = initial.map((record) => ({ ...record }));
  let locks = 0;
  const taken = (name: string, exceptId?: string): boolean =>
    records.some((record) => record.name.toLowerCase() === name.toLowerCase() && record.id.toLowerCase() !== exceptId?.toLowerCase());

  return {
    records,
    lockCount: () => locks,

    listProcessItems: () => Promise.resolve(records.map((record) => ({ ...record }))),

    lockProcessItems() {
      locks += 1;
      return Promise.resolve();
    },

    listProcessItemNames: () => Promise.resolve(records.map(({ id, name }) => ({ id, name }))),

    findProcessItemForUpdate: (id) => Promise.resolve(records.find((record) => record.id.toLowerCase() === id.toLowerCase()) ?? null).then((found) => (found === null ? null : { ...found })),

    createProcessItem(item: NewProcessItem) {
      if (taken(item.name)) return Promise.reject(new MasterConstraintError('process-item-name', { cause: new Error('duplicate') }));
      const record: MutableProcessItem = { id: randomUUID(), name: item.name, unit: item.unit, defaultValue: item.defaultValue };
      records.push(record);
      return Promise.resolve({ ...record });
    },

    updateProcessItem(id: string, changes: ProcessItemChanges) {
      const index = records.findIndex((record) => record.id.toLowerCase() === id.toLowerCase());
      const current = records[index];
      if (current === undefined) return Promise.resolve(null);
      if (changes.name !== undefined && taken(changes.name, current.id)) {
        return Promise.reject(new MasterConstraintError('process-item-name', { cause: new Error('duplicate') }));
      }
      const next: MutableProcessItem = {
        id: current.id,
        name: changes.name ?? current.name,
        unit: changes.unit ?? current.unit,
        defaultValue: changes.defaultValue ?? current.defaultValue,
      };
      records[index] = next;
      return Promise.resolve({ ...next });
    },

    deleteProcessItem(id: string) {
      const index = records.findIndex((record) => record.id.toLowerCase() === id.toLowerCase());
      if (index === -1) return Promise.resolve(false);
      records.splice(index, 1);
      return Promise.resolve(true);
    },
  };
}
