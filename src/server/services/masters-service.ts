import {
  FieldValidationError,
  MasterInUseError,
  MATERIAL_IN_USE_CODE,
  NAME_TAKEN_CODE,
  NotFoundError,
  ProcessItemInUseError,
  type FormulaUse,
} from '../../lib/errors';
import { rateUsesOf } from '../../lib/fields/rate-usage';
import type { ConfigDocument } from '../../lib/fields/schema';
import type { RateReference } from '../../lib/formula';
import { normaliseDecimalText } from '../../lib/masters/master-rules';
import {
  MATERIAL_NAME_TAKEN_MESSAGE,
  materialChangesFrom,
  normaliseMaterialNumber,
  specificGravityProblem,
} from '../../lib/masters/materials';
import { changesFrom, NAME_TAKEN_MESSAGE } from '../../lib/masters/process-items';
import type { Clock } from '../../lib/time';
import {
  MasterConstraintError,
  type MasterRepository,
  type MaterialChanges,
  type MaterialOptionRecord,
  type MaterialRecord,
  type NewMaterial,
  type NewProcessItem,
  type ProcessItemChanges,
  type ProcessItemRecord,
} from '../repositories/master-repository';
import type { Transaction, TransactionRunner } from '../repositories/transaction';

import type { AuditContext, AuditService } from './audit-service';
import { createCustomerOperations, type CustomerOperations } from './customer-service';
import { createExchangeRateOperations, type ExchangeRateOperations } from './exchange-rate-service';
import { assertNameUsable } from './rate-name-rules';
import { createTreatmentOperations, type TreatmentOperations } from './treatment-service';

/**
 * The Process Master (STORY-02.01; FR-011, FR-012; architecture sections 4.1, 5.1 and 6): the Admin adds, changes and deletes
 * the named rates the calculation uses. Who may call it is decided before it is reached (`withRoute`, the manifest); this file
 * holds the rules that stay true whoever asks:
 *
 *   - **A name is unique ignoring letter case** (AC-2), and **safe in a formula**: it cannot read as column letters, numbers,
 *     operators or other rate names, and it must not change how a stored formula reads back from display form (DEF-006, QLT-01,
 *     QLT-15). Those rules are `rate-name-rules.ts`: the whole set of names a change would leave is judged, and every formula of the
 *     current configuration must still round-trip, so the order in which rates are added or renamed does not matter. A name that is
 *     not changed is not judged again, so editing a rate's unit or value is never blocked by its own name.
 *   - **A rate a formula uses cannot be deleted** (AC-4): the answer is a 409 that lists the formulas, and nothing changes. The
 *     formulas are read from the current configuration version, where a rate is `{{rate:<id>}}`.
 *   - **A rename never breaks a formula** (AC-3), because a formula holds the ID.
 *
 * Each change is one method here and **one transaction** (STORY-01.07; architecture section 6, DEF-017): the change and its audit
 * entry are written together with the same `tx`, so the entry exists exactly when the change does, and a refused change writes
 * none (AC-5). Every change takes the table lock first (`lockProcessItems`) and then the row, in that order everywhere, so two
 * changes cannot wait for each other (QLT-03). The configuration is read before the transaction opens, so a failure to read it
 * happens before anything is written (QLT-05).
 *
 * **The Material Master** (STORY-02.03; FR-015) follows the same rules with fewer of them: a material name is unique ignoring letter case
 * (the database's index is the judge, so two requests that race for one name cannot both win) and a specific gravity is above 0 on the
 * server as well as on the screen (UX-37; the route's schema, this service and a CHECK of the table all say so). A material is not named in a
 * formula (a formula holds `{{mat:<key>}}`, a column and not a row), so no check reads the configuration. Each change takes the table
 * lock and then the row, as the rates do, and writes its audit entry in its own transaction: `master.created` / `master.edited` with
 * `object_type` `material` (architecture section 8).
 *
 * **The Exchange Rate Master** (STORY-02.04; FR-016) is `exchange-rate-service.ts`: the pair of rates is saved together, in one transaction with
 * one `master.edited` entry of `object_type` `exchange_rate`.
 *
 * **The Treatment / Color list** (STORY-02.05; FR-017) is `treatment-service.ts`: a name (unique ignoring letter case, never one the system keeps), the locked
 * "Other" entry, and one audit entry per change with `object_type` `treatment`.
 *
 * **The Customer Master** (STORY-02.02; FR-013) is `customer-service.ts`. What this file adds for it is the synchronisation of SPEC section 4.2 rules 3 and 5
 * (AC-4): a rate added gets a row for every customer at its default, and a rate deleted loses its row on every customer, each in the **same transaction** as the
 * change to the rate and writing no entry of its own (the rate's entry stands for it).
 */

const NOT_FOUND_MESSAGE = 'Rate not found.';
const MATERIAL_NOT_FOUND_MESSAGE = 'Material not found.';
const PROCESS_ITEM_OBJECT_TYPE = 'process_item';
const MATERIAL_OBJECT_TYPE = 'material';

/** A rate as SCR-11 shows it: its values, and the formulas that use it (empty when none does). */
export interface ProcessItemView extends ProcessItemRecord {
  readonly usedBy: ReadonlyArray<FormulaUse>;
}

export interface MastersServiceDependencies {
  readonly masters: MasterRepository;
  /** Opens the transaction that a change and its audit entry share. */
  readonly transactions: TransactionRunner;
  readonly audit: AuditService;
  /** The document of the current configuration version, where the formulas that use a rate are read. Fails if there is none. */
  currentConfiguration(): Promise<ConfigDocument>;
  /** The clock that stamps an exchange-rate save (STORY-02.04). The system clock when none is given. */
  readonly clock?: Clock | undefined;
}

/**
 * Every change takes the `AuditContext` first: `actorId` is the Admin making the change and `requestId` the request it came in
 * on. Both go into the audit entry.
 */
export interface MastersService extends CustomerOperations, ExchangeRateOperations, TreatmentOperations {
  listProcessItems(): Promise<ReadonlyArray<ProcessItemView>>;
  createProcessItem(context: AuditContext, input: NewProcessItem): Promise<ProcessItemView>;
  /** `changes` has at least one field (the route's schema sees to that). A save that changes nothing writes no entry. */
  updateProcessItem(context: AuditContext, id: string, changes: ProcessItemChanges): Promise<ProcessItemView>;
  /** Refused with `ProcessItemInUseError` (409, naming the formulas) while a formula of the current configuration uses the rate. */
  deleteProcessItem(context: AuditContext, id: string): Promise<void>;

  /** The listed materials for SCR-13, with their numbers. Hidden and deleted materials are never in it. Admin only (the route says so). */
  listMaterials(): Promise<ReadonlyArray<MaterialRecord>>;
  /** The materials as a choice, for every role: ID, name and Material Considered, and no number of any kind (AC-4). */
  listMaterialOptions(): Promise<ReadonlyArray<MaterialOptionRecord>>;
  /** Refused with a 422 naming the field for a name that is taken or a specific gravity of 0 or below; nothing is stored. */
  createMaterial(context: AuditContext, input: NewMaterial): Promise<MaterialRecord>;
  /** `changes` has at least one field (the route's schema sees to that). A save that changes nothing writes no entry. 404 for an unknown or hidden ID. */
  updateMaterial(context: AuditContext, id: string, changes: MaterialChanges): Promise<MaterialRecord>;
  /**
   * Soft-deletes the material and writes one `master.deleted` entry in the same transaction (STORY-02.07 AC-3). Refused with `MasterInUseError` (409, naming the
   * estimates) while a Draft or Submitted estimate has the material in a part; 404 for an unknown, already deleted or hidden ID (the "Not applicable" row). Nothing
   * is written when it is refused.
   */
  deleteMaterial(context: AuditContext, id: string): Promise<void>;
}

/** What an audit entry keeps of a rate (`processItemState` in `audit-events.ts`). */
function auditState(item: ProcessItemRecord) {
  return { name: item.name, unit: item.unit, defaultValue: item.defaultValue };
}

/** The part of an audit entry that every change of a rate shares: who, which request, and what the object is called. */
function entryFor(context: AuditContext, item: ProcessItemRecord) {
  return { ...context, objectType: PROCESS_ITEM_OBJECT_TYPE, object: { id: item.id, label: item.name } };
}

function nameTaken(): FieldValidationError {
  return new FieldValidationError([{ field: 'name', message: NAME_TAKEN_MESSAGE }], { code: NAME_TAKEN_CODE });
}

// ---- The Material Master (STORY-02.03) -----------------------------------------------------------------------------------------

/** What an audit entry keeps of a material (`materialState` in `audit-events.ts`). */
function materialAuditState(material: MaterialRecord) {
  return {
    materialInDrawing: material.materialInDrawing,
    materialConsidered: material.materialConsidered,
    pricePerKg: material.pricePerKg,
    specificGravity: material.specificGravity,
    scrapRate: material.scrapRate,
  };
}

function materialEntryFor(context: AuditContext, material: MaterialRecord) {
  return { ...context, objectType: MATERIAL_OBJECT_TYPE, object: { id: material.id, label: material.materialInDrawing } };
}

function materialNameTaken(): FieldValidationError {
  return new FieldValidationError([{ field: 'materialInDrawing', message: MATERIAL_NAME_TAKEN_MESSAGE }], { code: NAME_TAKEN_CODE });
}

/** The server's own refusal of a specific gravity of 0 or below (UX-37): the same words as the schema, for a caller that did not go through it. */
function assertSpecificGravity(value: string | undefined): void {
  const problem = value === undefined ? null : specificGravityProblem(value);
  if (problem !== null) throw new FieldValidationError([{ field: 'specificGravity', message: problem }]);
}

/** Runs a write and gives the database's rule for names its words. Any other failure passes on untouched. */
async function withMaterialNameRule<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof MasterConstraintError && error.constraint === 'material-name') throw materialNameTaken();
    throw error;
  }
}

type MaterialOperations = Pick<MastersService, 'listMaterials' | 'listMaterialOptions' | 'createMaterial' | 'updateMaterial' | 'deleteMaterial'>;
type MaterialDependencies = Pick<MastersServiceDependencies, 'masters' | 'transactions' | 'audit'>;

/** A new material as it is stored: every number written to two decimals. */
function normalisedMaterial(input: NewMaterial): NewMaterial {
  return {
    ...input,
    pricePerKg: normaliseMaterialNumber(input.pricePerKg),
    specificGravity: normaliseMaterialNumber(input.specificGravity),
    scrapRate: normaliseMaterialNumber(input.scrapRate),
  };
}

/** Takes the table lock, adds the material, and writes its entry, all in the caller's transaction. */
async function addMaterial({ masters, audit }: MaterialDependencies, tx: Transaction, context: AuditContext, material: NewMaterial): Promise<MaterialRecord> {
  await masters.lockMaterials(tx);
  const record = await masters.createMaterial(material, tx);
  await audit.record(tx, { event: 'master.created', ...materialEntryFor(context, record), before: null, after: materialAuditState(record) });
  return record;
}

/** Table lock first, then the row (PRF-01); a save that changes nothing writes no change and no entry. */
async function changeMaterial(
  { masters, audit }: MaterialDependencies,
  tx: Transaction,
  context: AuditContext,
  id: string,
  wanted: MaterialChanges,
): Promise<MaterialRecord> {
  await masters.lockMaterials(tx);
  const before = await masters.findMaterialForUpdate(id, tx);
  if (before === null) throw new NotFoundError(MATERIAL_NOT_FOUND_MESSAGE);
  const next = materialChangesFrom(before, wanted);
  if (Object.keys(next).length === 0) return before;
  const after = await masters.updateMaterial(before.id, next, tx);
  if (after === null) throw new NotFoundError(MATERIAL_NOT_FOUND_MESSAGE);
  const entry = materialEntryFor(context, after);
  await audit.record(tx, { event: 'master.edited', ...entry, before: materialAuditState(before), after: materialAuditState(after) });
  return after;
}

/**
 * Delete (STORY-02.07 AC-3). The table lock, then the material's row `FOR UPDATE` (PRF-01, the same order as every material change), **then** the estimates that
 * have the material: the plain read runs after the lock, so a writer of a part's Material in Drawing (it holds the row `FOR SHARE` under the estimate's row lock,
 * `lockMaterialForUse`) and this delete serialise. Either the delete waits and then sees the part (409), or the write waits and then finds no material. The
 * delete takes no estimate or task row lock, so there is no cycle with that writer's order (estimate, task, material). `findMaterialForUpdate` skips the hidden
 * "Not applicable" row, so it is a 404 here like an unknown ID.
 */
async function removeMaterial({ masters, audit }: MaterialDependencies, tx: Transaction, context: AuditContext, id: string): Promise<void> {
  await masters.lockMaterials(tx);
  const before = await masters.findMaterialForUpdate(id, tx);
  if (before === null) throw new NotFoundError(MATERIAL_NOT_FOUND_MESSAGE);
  const open = await masters.findOpenEstimatesOfMaterial(before.id, tx);
  if (open.total > 0) throw new MasterInUseError(MATERIAL_IN_USE_CODE, before.materialInDrawing, open.estimates, open.total);
  if (!(await masters.softDeleteMaterial(before.id, tx))) throw new NotFoundError(MATERIAL_NOT_FOUND_MESSAGE);
  await audit.record(tx, { event: 'master.deleted', ...materialEntryFor(context, before), before: materialAuditState(before), after: null });
}

/**
 * The material methods of the service. Table lock first, then the row, in that order everywhere (PRF-01); nothing is read before the
 * transaction opens, because no check needs the configuration.
 */
function createMaterialOperations(dependencies: MaterialDependencies): MaterialOperations {
  const { masters, transactions } = dependencies;
  return {
    listMaterials: () => masters.listMaterials(),
    listMaterialOptions: () => masters.listMaterialOptions(),

    async createMaterial(context, input) {
      assertSpecificGravity(input.specificGravity);
      const material = normalisedMaterial(input);
      return withMaterialNameRule(() => transactions.run((tx) => addMaterial(dependencies, tx, context, material)));
    },

    async updateMaterial(context, id, changes) {
      assertSpecificGravity(changes.specificGravity);
      return withMaterialNameRule(() => transactions.run((tx) => changeMaterial(dependencies, tx, context, id, changes)));
    },

    deleteMaterial: (context, id) => transactions.run((tx) => removeMaterial(dependencies, tx, context, id)),
  };
}

// Over 40 lines on purpose (coding standards section 1): a factory whose parts are small named functions of 10 to 15 lines each.
export function createMastersService({ masters, transactions, audit, currentConfiguration, clock }: MastersServiceDependencies): MastersService {
  const withUses = (item: ProcessItemRecord, uses: ReadonlyMap<string, ReadonlyArray<FormulaUse>>): ProcessItemView => ({
    ...item,
    usedBy: uses.get(item.id.toLowerCase()) ?? [],
  });

  /** The other rates (their IDs and names), read in the transaction after the table lock. */
  async function ratesOtherThan(excludedId: string | null, tx: Transaction): Promise<ReadonlyArray<RateReference>> {
    const all = await masters.listProcessItemNames(tx);
    return all.filter((other) => excludedId === null || other.id.toLowerCase() !== excludedId.toLowerCase());
  }

  /** Runs a write and gives the database's rule for names its words. Any other failure passes on untouched. */
  async function withNameRule<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof MasterConstraintError) throw nameTaken();
      throw error;
    }
  }

  async function addInTransaction(tx: Transaction, context: AuditContext, item: NewProcessItem, document: ConfigDocument): Promise<ProcessItemRecord> {
    await masters.lockProcessItems(tx);
    assertNameUsable({ name: item.name, others: await ratesOtherThan(null, tx), renamed: null, document });
    const record = await masters.createProcessItem(item, tx);
    await masters.addProcessItemToCustomers(record.id, tx);
    await audit.record(tx, { event: 'master.created', ...entryFor(context, record), before: null, after: auditState(record) });
    return record;
  }

  async function changeInTransaction(
    tx: Transaction,
    context: AuditContext,
    id: string,
    wanted: ProcessItemChanges,
    document: ConfigDocument,
  ): Promise<ProcessItemRecord> {
    await masters.lockProcessItems(tx);
    const before = await masters.findProcessItemForUpdate(id, tx);
    if (before === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
    const next = changesFrom(before, wanted);
    if (Object.keys(next).length === 0) return before;
    if (next.name !== undefined) assertNameUsable({ name: next.name, others: await ratesOtherThan(before.id, tx), renamed: before, document });
    const after = await masters.updateProcessItem(before.id, next, tx);
    if (after === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
    await audit.record(tx, { event: 'master.edited', ...entryFor(context, after), before: auditState(before), after: auditState(after) });
    return after;
  }

  async function removeInTransaction(tx: Transaction, context: AuditContext, id: string, document: ConfigDocument): Promise<void> {
    await masters.lockProcessItems(tx);
    const before = await masters.findProcessItemForUpdate(id, tx);
    if (before === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
    const usedBy = rateUsesOf(document).get(before.id.toLowerCase()) ?? [];
    if (usedBy.length > 0) throw new ProcessItemInUseError(before.name, usedBy);
    await masters.removeProcessItemFromCustomers(before.id, tx);
    if (!(await masters.deleteProcessItem(before.id, tx))) throw new NotFoundError(NOT_FOUND_MESSAGE);
    await audit.record(tx, { event: 'master.deleted', ...entryFor(context, before), before: auditState(before), after: null });
  }

  return {
    ...createMaterialOperations({ masters, transactions, audit }),
    ...createExchangeRateOperations({ masters, transactions, audit, currentConfiguration, clock }),
    ...createTreatmentOperations({ masters, transactions, audit }),
    ...createCustomerOperations({ masters, transactions, audit }),

    async listProcessItems() {
      const [items, document] = await Promise.all([masters.listProcessItems(), currentConfiguration()]);
      const uses = rateUsesOf(document);
      return items.map((item) => withUses(item, uses));
    },

    async createProcessItem(context, input) {
      const item: NewProcessItem = { name: input.name, unit: input.unit, defaultValue: normaliseDecimalText(input.defaultValue) };
      const document = await currentConfiguration();
      const created = await withNameRule(() => transactions.run((tx) => addInTransaction(tx, context, item, document)));
      return withUses(created, rateUsesOf(document));
    },

    async updateProcessItem(context, id, changes) {
      const document = await currentConfiguration();
      const updated = await withNameRule(() => transactions.run((tx) => changeInTransaction(tx, context, id, changes, document)));
      return withUses(updated, rateUsesOf(document));
    },

    async deleteProcessItem(context, id) {
      const document = await currentConfiguration();
      await transactions.run((tx) => removeInTransaction(tx, context, id, document));
    },
  };
}
