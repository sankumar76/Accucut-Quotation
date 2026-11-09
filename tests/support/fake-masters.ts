import { randomUUID } from 'node:crypto';

import {
  MasterConstraintError,
  type MasterRepository,
  type MaterialChanges,
  type MaterialRecord,
  type NewMaterial,
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

/** A material the test may change in place. */
export type MutableMaterial = { -readonly [K in keyof MaterialRecord]: MaterialRecord[K] };

export interface FakeMasterRepository extends MasterRepository {
  /** Mutable, so a test can set a state up the way the Admin would have. */
  readonly records: MutableProcessItem[];
  /** The listed materials, mutable in the same way. There is no hidden row here: that is story 02.06's. */
  readonly materials: MutableMaterial[];
  /** How many times the table lock was taken: a change to the set of names takes it first. */
  lockCount(): number;
  /** How many times the materials' table lock was taken. */
  materialLockCount(): number;
}

/** The 15 seed items with their fixed IDs, units and a default of 0.00: what a fresh install holds (architecture section 5.6). */
export function seedRecords(): MutableProcessItem[] {
  return SEED_PROCESS_ITEMS.map((item) => ({ id: item.id, name: item.name, unit: item.unit, defaultValue: '0.00' }));
}

const duplicateMaterial = (): MasterConstraintError => new MasterConstraintError('material-name', { cause: new Error('duplicate') });

/** The material half of the fake: the same behaviour the service relies on (order, a name unique ignoring letter case, a lock that is a record). */
function createFakeMaterialMethods(materials: MutableMaterial[], onLock: () => void): Pick<MasterRepository, MaterialMethod> {
  const indexOf = (id: string): number => materials.findIndex((material) => material.id.toLowerCase() === id.toLowerCase());
  const taken = (name: string, exceptId?: string): boolean =>
    materials.some((material) => material.materialInDrawing.toLowerCase() === name.toLowerCase() && material.id.toLowerCase() !== exceptId?.toLowerCase());

  return {
    listMaterials: () => Promise.resolve(materials.map((material) => ({ ...material }))),
    listMaterialOptions: () => Promise.resolve(materials.map((material) => ({ id: material.id, name: material.materialInDrawing, materialConsidered: material.materialConsidered }))),
    lockMaterials() {
      onLock();
      return Promise.resolve();
    },
    findMaterialForUpdate(id: string) {
      const found = materials[indexOf(id)];
      return Promise.resolve(found === undefined ? null : { ...found });
    },
    createMaterial(material: NewMaterial) {
      if (taken(material.materialInDrawing)) return Promise.reject(duplicateMaterial());
      const record: MutableMaterial = { id: randomUUID(), ...material };
      materials.push(record);
      return Promise.resolve({ ...record });
    },
    updateMaterial(id: string, changes: MaterialChanges) {
      const index = indexOf(id);
      const current = materials[index];
      if (current === undefined) return Promise.resolve(null);
      if (changes.materialInDrawing !== undefined && taken(changes.materialInDrawing, current.id)) return Promise.reject(duplicateMaterial());
      const next: MutableMaterial = {
        id: current.id,
        materialInDrawing: changes.materialInDrawing ?? current.materialInDrawing,
        materialConsidered: changes.materialConsidered ?? current.materialConsidered,
        pricePerKg: changes.pricePerKg ?? current.pricePerKg,
        specificGravity: changes.specificGravity ?? current.specificGravity,
        scrapRate: changes.scrapRate ?? current.scrapRate,
      };
      materials[index] = next;
      return Promise.resolve({ ...next });
    },
  };
}

type MaterialMethod = 'listMaterials' | 'listMaterialOptions' | 'lockMaterials' | 'findMaterialForUpdate' | 'createMaterial' | 'updateMaterial';

export function createFakeMasterRepository(
  initial: ReadonlyArray<ProcessItemRecord> = seedRecords(),
  initialMaterials: ReadonlyArray<MaterialRecord> = [],
): FakeMasterRepository {
  const records: MutableProcessItem[] = initial.map((record) => ({ ...record }));
  const materials: MutableMaterial[] = initialMaterials.map((material) => ({ ...material }));
  let locks = 0;
  let materialLocks = 0;
  const taken = (name: string, exceptId?: string): boolean =>
    records.some((record) => record.name.toLowerCase() === name.toLowerCase() && record.id.toLowerCase() !== exceptId?.toLowerCase());

  return {
    records,
    materials,
    lockCount: () => locks,
    materialLockCount: () => materialLocks,
    ...createFakeMaterialMethods(materials, () => {
      materialLocks += 1;
    }),

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
