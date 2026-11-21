import { ConflictError, FieldValidationError, NotFoundError, type FieldProblem } from '../../lib/errors';
import { logger } from '../../lib/logger';
import {
  DEFAULT_CHANGED_CODE,
  DEFAULT_CHANGED_MESSAGE,
  REPEATED_CUSTOMER_MESSAGE,
  UNKNOWN_CUSTOMER_MESSAGE,
  type PropagationChoice,
  type PropagationCounts,
} from '../../lib/masters/default-propagation';
import { normaliseDecimalText } from '../../lib/masters/master-rules';
import { trimDecimalText } from '../repositories/decimal-text';
import type { ChangedCustomer, CustomerWithOwnValue, MasterRepository, ProcessItemRecord } from '../repositories/master-repository';
import type { Transaction, TransactionRunner } from '../repositories/transaction';

import type { AuditContext, AuditService } from './audit-service';

/**
 * A changed Process Master default reaching the customers (STORY-02.08; FR-014, FR-011; architecture sections 4.9 and 8 "Customers"). Two steps, each in
 * **one transaction** with the change and its audit entries (STORY-01.07; DEF-017), and each holding the Process Master's table lock first (PRF-01), the
 * same lock every customer change takes, so a propagation and a customer's save serialise and cannot wait on each other:
 *
 *   - **The save** (`propagateChangedDefault`, called from the rate's own change in `masters-service.ts`): every listed customer that held exactly the old
 *     default now holds the new one (AC-1). The customers that hold neither the old default nor the new one are **listed and not changed** (AC-2): the
 *     Admin chooses for them. A customer already at the new default is in neither group.
 *   - **Save choices** (`applyPropagation`): the Admin's answer for those customers (AC-3). A customer set to Apply gets the new default **only if its value
 *     is still the one the Admin was shown** (`shownValue`); one edited or deleted since is skipped and nothing of it is overwritten (AC-4). If the rate's
 *     default is no longer the one chosen for, the whole request is a 409 and nothing changes. An unknown customer ID or a repeated one is a 422.
 *
 * **The audit log** (AC-9, ruling of the architect 2026-11-19): one `master.edited` per customer whose rate changed, `object_type` `customer`, one rate with the
 * old and the new value as decimal text, as Reset to Defaults writes it, written through `audit.record` in a loop in the same transaction; the rate's own entry
 * comes first, and all entries of a step share the request's ID. A customer that was kept, skipped or already at the new default gets none. The counts are not
 * in the log: they are in the page notice and in one `info` line with no name and no value.
 */

const NOT_FOUND_MESSAGE = 'Rate not found.';
const CUSTOMER_OBJECT_TYPE = 'customer';
const CHOICES_FIELD = 'choices';

/** What the save tells the page: the old default, how many customers moved to the new one, and the customers that hold another value (and were left alone). */
export interface DefaultPropagation {
  readonly previousDefault: string;
  readonly moved: number;
  readonly differing: ReadonlyArray<CustomerWithOwnValue>;
}

/** The Admin's answer for one customer; `shownValue` is its value as it was listed. */
export interface PropagationChoiceInput {
  readonly customerId: string;
  readonly choice: PropagationChoice;
  readonly shownValue: string;
}

export interface PropagationInput {
  readonly newDefault: string;
  readonly choices: ReadonlyArray<PropagationChoiceInput>;
}

export interface PropagationOperations {
  /**
   * Save choices (AC-3, AC-4): sets the rate's current default on the customers chosen for Apply whose value is still the one shown, in one transaction with one
   * `master.edited` per customer changed. 404 for an unknown rate; 409 `DEFAULT_CHANGED` when the default is no longer `newDefault`; 422 for an unknown or repeated customer.
   */
  applyPropagation(context: AuditContext, id: string, input: PropagationInput): Promise<PropagationCounts>;
}

export interface PropagationDependencies {
  readonly masters: MasterRepository;
  readonly transactions: TransactionRunner;
  readonly audit: AuditService;
}

type EntryDependencies = Pick<PropagationDependencies, 'masters' | 'audit'>;

/** A customer whose rate changed, and the value it held before. */
interface RateChange extends ChangedCustomer {
  readonly previous: string;
}

/** What an audit entry keeps of a customer: its name, no contact field, and the one rate with the item's name and unit as they are after the save. */
function customerState(name: string, item: ProcessItemRecord, value: string) {
  return { name, contact: [], rates: [{ processItemId: item.id, name: item.name, unit: item.unit, value }] };
}

/** One `master.edited` per customer whose rate changed, in the order given, in the caller's transaction. */
async function recordRateChanges(audit: AuditService, tx: Transaction, context: AuditContext, item: ProcessItemRecord, changes: ReadonlyArray<RateChange>): Promise<void> {
  for (const change of changes) {
    await audit.record(tx, {
      event: 'master.edited',
      ...context,
      objectType: CUSTOMER_OBJECT_TYPE,
      object: { id: change.customerId, label: change.name },
      before: customerState(change.name, item, change.previous),
      after: customerState(change.name, item, item.defaultValue),
    });
  }
}

/**
 * The save's half (AC-1, AC-2, AC-9), after the rate's own entry has been written: moves the customers that held `before`'s default, writes their entries, and
 * lists the customers that hold neither. `after` is the rate as saved, so a rename in the same save is the name the entries carry.
 */
export async function propagateChangedDefault(
  { masters, audit }: EntryDependencies,
  tx: Transaction,
  context: AuditContext,
  before: ProcessItemRecord,
  after: ProcessItemRecord,
): Promise<DefaultPropagation> {
  const moved = await masters.moveCustomersToDefault(after.id, before.defaultValue, after.defaultValue, tx);
  await recordRateChanges(audit, tx, context, after, moved.map((customer) => ({ ...customer, previous: before.defaultValue })));
  const differing = await masters.listCustomersWithOwnValue(after.id, tx);
  logger.info({ requestId: context.requestId, processItemId: after.id, moved: moved.length, differing: differing.length }, 'default propagated: customers moved');
  return { previousDefault: before.defaultValue, moved: moved.length, differing };
}

/** The server's own refusal of what the schema would have refused for a repeated customer; the ID is the lower-case form. */
function repeatedProblems(choices: ReadonlyArray<PropagationChoiceInput>): ReadonlyArray<FieldProblem> {
  const seen = new Set<string>();
  return choices.flatMap((entry, index) => {
    const id = entry.customerId.toLowerCase();
    const repeated = seen.has(id);
    seen.add(id);
    return repeated ? [{ field: `${CHOICES_FIELD}.${index}.customerId`, message: REPEATED_CUSTOMER_MESSAGE }] : [];
  });
}

/** 422 for a customer ID that exists nowhere or is given twice. A deleted customer exists: it is skipped later, not refused. */
async function assertChoicesUsable(masters: MasterRepository, tx: Transaction, choices: ReadonlyArray<PropagationChoiceInput>): Promise<void> {
  const known = await masters.findExistingCustomerIds(choices.map((entry) => entry.customerId), tx);
  const unknown = choices.flatMap((entry, index) => (known.has(entry.customerId.toLowerCase()) ? [] : [{ field: `${CHOICES_FIELD}.${index}.customerId`, message: UNKNOWN_CUSTOMER_MESSAGE }]));
  const problems = [...unknown, ...repeatedProblems(choices)];
  if (problems.length > 0) throw new FieldValidationError(problems);
}

/** Save choices in the caller's transaction: lock, the rate, the checks, the guarded change, one entry per customer changed, and the counts. */
async function applyChoices(
  { masters, audit }: EntryDependencies,
  tx: Transaction,
  context: AuditContext,
  id: string,
  input: PropagationInput,
): Promise<PropagationCounts> {
  await masters.lockProcessItems(tx);
  const item = await masters.findProcessItemForUpdate(id, tx);
  if (item === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
  if (normaliseDecimalText(input.newDefault) !== item.defaultValue) throw new ConflictError(DEFAULT_CHANGED_MESSAGE, { code: DEFAULT_CHANGED_CODE });
  await assertChoicesUsable(masters, tx, input.choices);
  const applying = input.choices.filter((entry) => entry.choice === 'apply');
  const changed = await masters.applyDefaultToCustomers(item.id, item.defaultValue, applying.map(({ customerId, shownValue }) => ({ customerId, shownValue })), tx);
  const shown = new Map(applying.map((entry) => [entry.customerId.toLowerCase(), entry.shownValue]));
  await recordRateChanges(audit, tx, context, item, changed.map((customer) => ({ ...customer, previous: trimDecimalText(shown.get(customer.customerId.toLowerCase()) ?? item.defaultValue) })));
  const counts: PropagationCounts = { applied: changed.length, kept: input.choices.length - applying.length, skipped: applying.length - changed.length };
  logger.info({ requestId: context.requestId, processItemId: item.id, ...counts }, 'default propagated: choices saved');
  return counts;
}

/** The Save choices method of the masters service. Nothing is read before the transaction opens, because no check needs the configuration. */
export function createPropagationOperations(dependencies: PropagationDependencies): PropagationOperations {
  const { transactions } = dependencies;
  return {
    applyPropagation: (context, id, input) => transactions.run((tx) => applyChoices(dependencies, tx, context, id, input)),
  };
}
