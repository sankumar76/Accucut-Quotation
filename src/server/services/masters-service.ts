import { FieldValidationError, NotFoundError, ProcessItemInUseError, type FormulaUse } from '../../lib/errors';
import type { ConfigDocument } from '../../lib/fields/schema';
import { rateUsesOf } from '../../lib/fields/rate-usage';
import { rateNameIssues } from '../../lib/formula';
import { NAME_TAKEN_MESSAGE, normaliseDefaultValue } from '../../lib/masters/process-items';
import {
  MasterConstraintError,
  type MasterRepository,
  type NewProcessItem,
  type ProcessItemChanges,
  type ProcessItemRecord,
} from '../repositories/master-repository';
import type { TransactionRunner } from '../repositories/transaction';

import type { AuditContext, AuditService } from './audit-service';

/**
 * The Process Master (STORY-02.01; FR-011, FR-012; architecture sections 4.1, 5.1 and 6): the Admin adds, changes and deletes
 * the named rates the calculation uses. Who may call it is decided before it is reached (`withRoute`, the manifest); this file
 * holds the rules that stay true whoever asks:
 *
 *   - **A name is unique ignoring letter case** (AC-2), and **safe in a formula**: it cannot read as column letters, numbers,
 *     operators or other rate names (`rateNameIssues`, DEF-006), because letters move and the list of rates changes. A name
 *     that is not changed is not judged again, so editing a rate's unit or value is never blocked by its own name.
 *   - **A rate a formula uses cannot be deleted** (AC-4): the answer is a 409 that lists the formulas, and nothing changes. The
 *     formulas are read from the current configuration version, where a rate is `{{rate:<id>}}`.
 *   - **A rename never breaks a formula** (AC-3), because a formula holds the ID.
 *
 * Each change is one method here and **one transaction** (STORY-01.07; architecture section 6, DEF-017): the change and its audit
 * entry are written together with the same `tx`, so the entry exists exactly when the change does, and a refused change writes
 * none (AC-5). The state an entry calls "before" is read with the rate's row locked. Changes to the set of names also hold the
 * table lock of `lockProcessItems`, so the check of a new name judges the set it is made against.
 */

export const NAME_TAKEN_CODE = 'NAME_TAKEN';
export const NAME_REFUSED_CODE = 'RATE_NAME_REFUSED';
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

function nameRefusal(message: string, code: string): FieldValidationError {
  return new FieldValidationError([{ field: 'name', message }], { code });
}

/**
 * Why a name cannot be used, or nothing. `otherNames` are the names of the **other** rates. Letter case is ignored first (AC-2,
 * in the Admin's words), then the formula engine's rule for what a formula could read another way (DEF-006).
 */
function assertNameUsable(name: string, otherNames: ReadonlyArray<string>): void {
  const lower = name.toLowerCase();
  if (otherNames.some((other) => other.toLowerCase() === lower)) throw nameRefusal(NAME_TAKEN_MESSAGE, NAME_TAKEN_CODE);
  const [issue] = rateNameIssues(name, otherNames);
  if (issue !== undefined) throw nameRefusal(issue.message, NAME_REFUSED_CODE);
}

export function createMastersService({ masters, transactions, audit, currentConfiguration }: MastersServiceDependencies): MastersService {
  /** The formulas that use each rate, from the current configuration. */
  async function usesByRate(): Promise<ReadonlyMap<string, ReadonlyArray<FormulaUse>>> {
    return rateUsesOf(await currentConfiguration());
  }

  const withUses = (item: ProcessItemRecord, uses: ReadonlyMap<string, ReadonlyArray<FormulaUse>>): ProcessItemView => ({
    ...item,
    usedBy: uses.get(item.id.toLowerCase()) ?? [],
  });

  /** Runs a write and gives the database's rule for names its words. Any other failure passes on untouched. */
  async function withNameRule<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof MasterConstraintError) throw nameRefusal(NAME_TAKEN_MESSAGE, NAME_TAKEN_CODE);
      throw error;
    }
  }

  return {
    async listProcessItems() {
      const [items, uses] = await Promise.all([masters.listProcessItems(), usesByRate()]);
      return items.map((item) => withUses(item, uses));
    },

    async createProcessItem(context, input) {
      const item: NewProcessItem = { name: input.name, unit: input.unit, defaultValue: normaliseDefaultValue(input.defaultValue) };
      const created = await withNameRule(() =>
        transactions.run(async (tx) => {
          await masters.lockProcessItems(tx);
          assertNameUsable(item.name, (await masters.listProcessItemNames(tx)).map((other) => other.name));
          const record = await masters.createProcessItem(item, tx);
          await audit.record(tx, {
            event: 'master.created',
            ...context,
            objectType: PROCESS_ITEM_OBJECT_TYPE,
            object: { id: record.id, label: record.name },
            before: null,
            after: auditState(record),
          });
          return record;
        }),
      );
      return withUses(created, await usesByRate());
    },

    async updateProcessItem(context, id, changes) {
      const updated = await withNameRule(() =>
        transactions.run(async (tx) => {
          await masters.lockProcessItems(tx);
          const before = await masters.findProcessItemForUpdate(id, tx);
          if (before === null) throw new NotFoundError(NOT_FOUND_MESSAGE);

          // Only what really changes is written, and a request that sets a value to what it already is changes nothing.
          const next: ProcessItemChanges = {
            ...(changes.name !== undefined && changes.name !== before.name ? { name: changes.name } : {}),
            ...(changes.unit !== undefined && changes.unit !== before.unit ? { unit: changes.unit } : {}),
            ...(changes.defaultValue !== undefined && normaliseDefaultValue(changes.defaultValue) !== before.defaultValue
              ? { defaultValue: normaliseDefaultValue(changes.defaultValue) }
              : {}),
          };
          if (Object.keys(next).length === 0) return before;

          if (next.name !== undefined) {
            const others = (await masters.listProcessItemNames(tx)).filter((other) => other.id.toLowerCase() !== before.id.toLowerCase());
            assertNameUsable(next.name, others.map((other) => other.name));
          }
          const after = await masters.updateProcessItem(before.id, next, tx);
          if (after === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
          await audit.record(tx, {
            event: 'master.edited',
            ...context,
            objectType: PROCESS_ITEM_OBJECT_TYPE,
            object: { id: after.id, label: after.name },
            before: auditState(before),
            after: auditState(after),
          });
          return after;
        }),
      );
      return withUses(updated, await usesByRate());
    },

    async deleteProcessItem(context, id) {
      // The configuration is read first, outside the transaction: it is immutable per version and may be cached.
      const uses = await usesByRate();
      await transactions.run(async (tx) => {
        const before = await masters.findProcessItemForUpdate(id, tx);
        if (before === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
        const usedBy = uses.get(before.id.toLowerCase()) ?? [];
        if (usedBy.length > 0) throw new ProcessItemInUseError(before.name, usedBy);
        if (!(await masters.deleteProcessItem(before.id, tx))) throw new NotFoundError(NOT_FOUND_MESSAGE);
        await audit.record(tx, {
          event: 'master.deleted',
          ...context,
          objectType: PROCESS_ITEM_OBJECT_TYPE,
          object: { id: before.id, label: before.name },
          before: auditState(before),
          after: null,
        });
      });
    },
  };
}
