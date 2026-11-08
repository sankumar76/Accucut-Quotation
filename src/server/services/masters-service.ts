import { FieldValidationError, NAME_TAKEN_CODE, NotFoundError, ProcessItemInUseError, type FormulaUse } from '../../lib/errors';
import { rateUsesOf } from '../../lib/fields/rate-usage';
import type { ConfigDocument } from '../../lib/fields/schema';
import type { RateReference } from '../../lib/formula';
import { changesFrom, NAME_TAKEN_MESSAGE, normaliseDefaultValue } from '../../lib/masters/process-items';
import {
  MasterConstraintError,
  type MasterRepository,
  type NewProcessItem,
  type ProcessItemChanges,
  type ProcessItemRecord,
} from '../repositories/master-repository';
import type { Transaction, TransactionRunner } from '../repositories/transaction';

import type { AuditContext, AuditService } from './audit-service';
import { assertNameUsable } from './rate-name-rules';

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
 */

const NOT_FOUND_MESSAGE = 'Rate not found.';
const PROCESS_ITEM_OBJECT_TYPE = 'process_item';

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
}

/**
 * Every change takes the `AuditContext` first: `actorId` is the Admin making the change and `requestId` the request it came in
 * on. Both go into the audit entry.
 */
export interface MastersService {
  listProcessItems(): Promise<ReadonlyArray<ProcessItemView>>;
  createProcessItem(context: AuditContext, input: NewProcessItem): Promise<ProcessItemView>;
  /** `changes` has at least one field (the route's schema sees to that). A save that changes nothing writes no entry. */
  updateProcessItem(context: AuditContext, id: string, changes: ProcessItemChanges): Promise<ProcessItemView>;
  /** Refused with `ProcessItemInUseError` (409, naming the formulas) while a formula of the current configuration uses the rate. */
  deleteProcessItem(context: AuditContext, id: string): Promise<void>;
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

// Over 40 lines on purpose (coding standards section 1): a factory whose parts are small named functions of 10 to 15 lines each.
export function createMastersService({ masters, transactions, audit, currentConfiguration }: MastersServiceDependencies): MastersService {
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
    if (!(await masters.deleteProcessItem(before.id, tx))) throw new NotFoundError(NOT_FOUND_MESSAGE);
    await audit.record(tx, { event: 'master.deleted', ...entryFor(context, before), before: auditState(before), after: null });
  }

  return {
    async listProcessItems() {
      const [items, document] = await Promise.all([masters.listProcessItems(), currentConfiguration()]);
      const uses = rateUsesOf(document);
      return items.map((item) => withUses(item, uses));
    },

    async createProcessItem(context, input) {
      const item: NewProcessItem = { name: input.name, unit: input.unit, defaultValue: normaliseDefaultValue(input.defaultValue) };
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
