import { randomUUID } from 'node:crypto';

import {
  MasterConstraintError,
  TreatmentNameTakenError,
  type ExchangeRateStamp,
  type ExchangeRatesRecord,
  type MasterRepository,
  type MaterialChanges,
  type MaterialRecord,
  type NewMaterial,
  type NewProcessItem,
  type ProcessItemChanges,
  type ProcessItemRecord,
  type TreatmentRecord,
} from '../../src/server/repositories/master-repository';

import { createFakeCustomerMethods, type FakeCustomer } from './fake-customers';
import { SEED_PROCESS_ITEMS } from './seed-config';
import { FRESH_TREATMENTS } from './treatment-canary';

/**
 * An in-memory stand-in for the master repository, for unit tests of the rules (no database). It keeps the behaviour the service
 * relies on: the order of the list, a name unique ignoring letter case (the database's `uq_process_items_name_lower`), a row lock
 * that is only a record that it was asked for. The real repository, its locking and its constraints are tested against PostgreSQL in
 * `tests/integration/masters`. Every name and number is invented (`n.37`, ADR-014).
 */

/** A rate the test may change in place. */
export type MutableProcessItem = { -readonly [K in keyof ProcessItemRecord]: ProcessItemRecord[K] };

/** The exchange rates the test may change in place: the two rates (null while never set) and the stamp of the pair. */
export type MutableExchangeRates = { -readonly [K in keyof ExchangeRatesRecord]: ExchangeRatesRecord[K] };

/** A material the test may change in place. */
export type MutableMaterial = { -readonly [K in keyof MaterialRecord]: MaterialRecord[K] };

/** A treatment the test may change in place. */
export type MutableTreatment = { -readonly [K in keyof TreatmentRecord]: TreatmentRecord[K] };

export interface FakeMasterRepository extends MasterRepository {
  /** Mutable, so a test can set a state up the way the Admin would have. */
  readonly records: MutableProcessItem[];
  /** The listed treatments, mutable in the same way. Starts with the locked "Other" row of the migration. There is no hidden row here: that is story 02.06's. */
  readonly treatments: MutableTreatment[];
  /** The listed customers, mutable in the same way (STORY-02.02). Starts empty. */
  readonly customers: FakeCustomer[];
  /** How many times the treatments' table lock was taken. */
  treatmentLockCount(): number;
  /** The listed materials, mutable in the same way. There is no hidden row here: that is story 02.06's. */
  readonly materials: MutableMaterial[];
  /** The Exchange Rate Master, mutable in the same way (STORY-02.04). Starts with no rate set. */
  readonly exchange: MutableExchangeRates;
  /** How many times the exchange rates' table lock was taken. */
  exchangeLockCount(): number;
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
    findMaterialForCalculation(id: string) {
      const found = materials[indexOf(id)];
      return Promise.resolve(found === undefined ? null : { id: found.id, materialInDrawing: found.materialInDrawing, materialConsidered: found.materialConsidered, pricePerKg: found.pricePerKg, specificGravity: found.specificGravity, scrapRate: found.scrapRate });
    },
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

/** The name a stamp shows for a person; the fake has no user table, so every actor is this one unless a test sets a name. */
const FAKE_ACTOR_NAME = 'Invented Admin';

/** The exchange-rate half of the fake: the pair is kept together, and a save replaces both rates and the stamp. */
function createFakeExchangeMethods(state: MutableExchangeRates, onLock: () => void): Pick<MasterRepository, ExchangeMethod> {
  const copy = (): ExchangeRatesRecord => ({ usd: state.usd, eur: state.eur, stamp: state.stamp === null ? null : { ...state.stamp } });
  return {
    readExchangeRates: () => Promise.resolve(copy()),
    lockExchangeRates() {
      onLock();
      return Promise.resolve();
    },
    findExchangeRatesForUpdate: () => Promise.resolve(copy()),
    saveExchangeRates(values, stamp) {
      const written: ExchangeRateStamp = { updatedById: stamp.updatedById, updatedByName: FAKE_ACTOR_NAME, updatedAt: stamp.updatedAt };
      state.usd = values.usd;
      state.eur = values.eur;
      state.stamp = written;
      return Promise.resolve(copy());
    },
  };
}

type ExchangeMethod = 'readExchangeRates' | 'lockExchangeRates' | 'findExchangeRatesForUpdate' | 'saveExchangeRates';

type MaterialMethod = 'listMaterials' | 'listMaterialOptions' | 'findMaterialForCalculation' | 'lockMaterials' | 'findMaterialForUpdate' | 'createMaterial' | 'updateMaterial';

type TreatmentMethod =
  | 'listTreatments'
  | 'listTreatmentOptions'
  | 'lockTreatments'
  | 'findTreatmentForUpdate'
  | 'createTreatment'
  | 'renameTreatment'
  | 'deleteTreatment';

/**
 * The treatment half of the fake: the same behaviour the service relies on (the locked row first, then the order added; a name unique ignoring letter case;
 * a lock that is a record). Like the real repository, a rename and a delete skip a locked row.
 */
function createFakeTreatmentMethods(treatments: MutableTreatment[], onLock: () => void): Pick<MasterRepository, TreatmentMethod> {
  const indexOf = (id: string): number => treatments.findIndex((treatment) => treatment.id.toLowerCase() === id.toLowerCase());
  const taken = (name: string, exceptId?: string): boolean =>
    treatments.some((treatment) => treatment.name.toLowerCase() === name.toLowerCase() && treatment.id.toLowerCase() !== exceptId?.toLowerCase());
  const ordered = (): TreatmentRecord[] => [...treatments.filter((treatment) => treatment.locked), ...treatments.filter((treatment) => !treatment.locked)].map((treatment) => ({ ...treatment }));

  return {
    listTreatments: () => Promise.resolve(ordered()),
    listTreatmentOptions: () => Promise.resolve(ordered().map(({ id, name }) => ({ id, name }))),
    lockTreatments() {
      onLock();
      return Promise.resolve();
    },
    findTreatmentForUpdate(id: string) {
      const found = treatments[indexOf(id)];
      return Promise.resolve(found === undefined ? null : { ...found });
    },
    createTreatment(name: string) {
      if (taken(name)) return Promise.reject(new TreatmentNameTakenError({ cause: new Error('duplicate') }));
      const record: MutableTreatment = { id: randomUUID(), name, locked: false };
      treatments.push(record);
      return Promise.resolve({ ...record });
    },
    renameTreatment(id: string, name: string) {
      const index = indexOf(id);
      const current = treatments[index];
      if (current === undefined || current.locked) return Promise.resolve(null);
      if (taken(name, current.id)) return Promise.reject(new TreatmentNameTakenError({ cause: new Error('duplicate') }));
      const next: MutableTreatment = { id: current.id, name, locked: false };
      treatments[index] = next;
      return Promise.resolve({ ...next });
    },
    deleteTreatment(id: string) {
      const index = indexOf(id);
      if (index === -1 || treatments[index]?.locked === true) return Promise.resolve(false);
      treatments.splice(index, 1);
      return Promise.resolve(true);
    },
  };
}

// Over 40 lines on purpose (coding standards section 1): the process-item methods are written out here, and each master's methods are spread in from a helper (`createFakeTreatmentMethods`).
export function createFakeMasterRepository(
  initial: ReadonlyArray<ProcessItemRecord> = seedRecords(),
  initialMaterials: ReadonlyArray<MaterialRecord> = [],
  initialTreatments: ReadonlyArray<TreatmentRecord> = FRESH_TREATMENTS,
): FakeMasterRepository {
  const records: MutableProcessItem[] = initial.map((record) => ({ ...record }));
  const customers: FakeCustomer[] = [];
  const materials: MutableMaterial[] = initialMaterials.map((material) => ({ ...material }));
  const treatments: MutableTreatment[] = initialTreatments.map((treatment) => ({ ...treatment }));
  let locks = 0;
  let materialLocks = 0;
  let treatmentLocks = 0;
  let exchangeLocks = 0;
  const exchange: MutableExchangeRates = { usd: null, eur: null, stamp: null };
  const taken = (name: string, exceptId?: string): boolean =>
    records.some((record) => record.name.toLowerCase() === name.toLowerCase() && record.id.toLowerCase() !== exceptId?.toLowerCase());

  return {
    records,
    materials,
    treatments,
    customers,
    exchange,
    lockCount: () => locks,
    materialLockCount: () => materialLocks,
    treatmentLockCount: () => treatmentLocks,
    exchangeLockCount: () => exchangeLocks,
    ...createFakeCustomerMethods(records, customers),
    ...createFakeTreatmentMethods(treatments, () => {
      treatmentLocks += 1;
    }),
    ...createFakeExchangeMethods(exchange, () => {
      exchangeLocks += 1;
    }),
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
