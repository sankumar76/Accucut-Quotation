import {
  ConflictError,
  CUSTOMER_IN_USE_CODE,
  FieldValidationError,
  MasterInUseError,
  NAME_TAKEN_CODE,
  NotFoundError,
  type FieldProblem,
} from '../../lib/errors';
import {
  canonicalCustomerName,
  changedContactFields,
  CONTACT_FIELD_NAMES,
  contactValue,
  CUSTOMER_FIELD_NAMES,
  CUSTOMER_NAME_TAKEN_MESSAGE,
  customerFieldProblem,
  detailChangesFrom,
  differsFromDefault,
  rateProblem,
  rateText,
  type ContactFieldName,
  type CustomerDetails,
  type CustomerFields,
} from '../../lib/masters/customers';
import {
  MasterConstraintError,
  type CustomerDetailRecord,
  type CustomerOptionRecord,
  type CustomerRateRecord,
  type CustomerRateValue,
  type CustomerSummaryRecord,
  type MasterRepository,
  type NewCustomer,
} from '../repositories/master-repository';
import type { Transaction, TransactionRunner } from '../repositories/transaction';

import type { AuditContext, AuditService } from './audit-service';

/**
 * The Customer Master (STORY-02.02; FR-011, FR-012, FR-013; architecture sections 4.1, 5.1, 6 and 8): the Admin keeps the customers and each customer's
 * own value for every Process Master item. Who may call it is decided before it is reached (`withRoute`, the manifest, BR-004); this file holds the
 * rules that stay true whoever asks:
 *
 *   - **A name is required and unique ignoring letter case** (AC-1), stored in one canonical form (compatibility forms folded, surrounding spaces removed,
 *     runs of spaces made one). The database's index is the judge of uniqueness, so two requests that race for one name cannot both win. The phone, the
 *     e-mail address and the address are optional; an e-mail address, if given, must look like one.
 *   - **A new customer copies the Process Master's current defaults** (SPEC section 4.2 rule 1, AC-1): one rate row per item, in the same transaction.
 *   - **A rate is a number of 0 or more with up to 2 decimals, a percent rate included** (AC-2 as amended, SPEC D-24). A rate that is not one of the customer's
 *     (an item deleted since the page was read) is a 409; nothing is written.
 *   - **Reset to defaults** (AC-3) sets every rate that differs back to the item's current default and answers with the count; a customer that already
 *     has every default is a count of 0 and writes nothing. It is idempotent.
 *   - **A save or a reset that changes nothing writes no change and no entry** (AC-2, AC-6).
 *   - **Delete is soft and guarded** (STORY-02.07; A-13, BR-053): a customer that a Draft or Submitted estimate has is refused with a 409 that names those estimates
 *     (the first ten and the count), and nothing changes. An Approved estimate does not count: it keeps the customer's name and its own figures (NFR-026). The
 *     customer's row is locked `FOR UPDATE` and **then** the estimates are read, so a request that is choosing this very customer (it holds the row `FOR SHARE`,
 *     `estimate-repository.ts`) and the delete serialise: either the delete waits and then sees the estimate, or the choice waits and then finds no customer. Both
 *     orders hold the customer's row last and take no estimate or task row here, so there is no cycle with the estimate service's lock order (AC-5).
 *
 * Each change is one method here and **one transaction** (STORY-01.07; architecture section 6, DEF-017): the change and its audit entry are written
 * together with the same `tx`, so the entry exists exactly when the change does, and a refused change writes none. The entries are `master.created`,
 * `master.edited` and `master.deleted` with `object_type` `customer` (architecture section 8, the AQP-142 ruling: a reset is `master.edited` too). The state is
 * `{ name, contact, rates }`: the names of the contact fields (never their values) and the rates that changed, all of them on a create. Every change
 * takes the Process Master's table lock first and then the customer's row, in that order everywhere (PRF-01), so a customer's change cannot wait on the
 * add or the delete of a Process Master item (AC-4), which takes the same lock first, and a customer added while an item is added cannot miss its rate.
 */

const OBJECT_TYPE = 'customer';
const NOT_FOUND_MESSAGE = 'Customer not found.';
const RATES_CHANGED_MESSAGE = 'The rates changed while this page was open. Reload the page and try again.';
const RATES_CHANGED_CODE = 'RATES_CHANGED';

/** What a request may ask to change: the details, and the rates to set. */
export interface CustomerChanges extends CustomerFields {
  readonly rates?: ReadonlyArray<CustomerRateValue> | undefined;
}

/** The answer of a reset: the customer as it is now, and how many rates were replaced. */
export interface CustomerResetResult {
  readonly customer: CustomerDetailRecord;
  readonly count: number;
}

export interface CustomerOperations {
  /** The listed customers for SCR-12, with how many rates differ from the default. Admin only (the route says so). */
  listCustomers(): Promise<ReadonlyArray<CustomerSummaryRecord>>;
  /** The customers as a choice, for every role: ID and name, and no contact detail or rate (AC-5). */
  listCustomerOptions(): Promise<ReadonlyArray<CustomerOptionRecord>>;
  /** One listed customer with its rates, for SCR-12's edit page. 404 for an unknown or deleted ID. */
  getCustomer(id: string): Promise<CustomerDetailRecord>;
  /** Refused with a 422 naming the field for a name that is blank, too long or taken, or an e-mail address that does not look like one; nothing is stored. */
  createCustomer(context: AuditContext, input: NewCustomer): Promise<CustomerDetailRecord>;
  /** `changes` has at least one field (the route's schema sees to that). A save that changes nothing writes no entry. 404 for an unknown or deleted ID. */
  updateCustomer(context: AuditContext, id: string, changes: CustomerChanges): Promise<CustomerDetailRecord>;
  /** Every rate back to the current default; the count of the rates replaced (0 writes no entry). 404 for an unknown or deleted ID. */
  resetCustomerRates(context: AuditContext, id: string): Promise<CustomerResetResult>;
  /**
   * Soft-deletes the customer and writes one `master.deleted` entry in the same transaction. Refused with `MasterInUseError` (409, naming the estimates) while a
   * Draft or Submitted estimate has the customer; 404 for an unknown or already deleted ID. Nothing is written when it is refused.
   */
  deleteCustomer(context: AuditContext, id: string): Promise<void>;
}

export interface CustomerDependencies {
  readonly masters: MasterRepository;
  readonly transactions: TransactionRunner;
  readonly audit: AuditService;
}

/** The rates an audit entry lists, with the value each has in the state it describes. */
function ratesState(rates: ReadonlyArray<CustomerRateRecord>, valueOf: (rate: CustomerRateRecord) => string) {
  return rates.map((rate) => ({ processItemId: rate.processItemId, name: rate.name, unit: rate.unit, value: valueOf(rate) }));
}

/** What an audit entry keeps of a customer (`customerState` in `audit-events.ts`). */
function auditState(name: string, contact: ReadonlyArray<ContactFieldName>, rates: ReturnType<typeof ratesState>) {
  return { name, contact: [...contact], rates };
}

/** The part of an audit entry that every change shares: who, which request, and what the object is called. */
function entryFor(context: AuditContext, customer: CustomerDetailRecord) {
  return { ...context, objectType: OBJECT_TYPE, object: { id: customer.id, label: customer.name } };
}

function nameTaken(): FieldValidationError {
  return new FieldValidationError([{ field: 'name', message: CUSTOMER_NAME_TAKEN_MESSAGE }], { code: NAME_TAKEN_CODE });
}

/** Runs a write and gives the database's rule for names its words. Any other failure passes on untouched. */
async function withNameRule<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof MasterConstraintError && error.constraint === 'customer-name') throw nameTaken();
    throw error;
  }
}

/** The server's own refusal of the details the screen or the schema would have refused; only the fields given are judged. */
function assertDetails(given: CustomerFields): void {
  const found: FieldProblem[] = CUSTOMER_FIELD_NAMES.flatMap((field) => {
    const value = given[field];
    const message = value === undefined ? null : customerFieldProblem(field, value ?? '');
    return message === null ? [] : [{ field, message }];
  });
  if (found.length > 0) throw new FieldValidationError(found);
}

/** The customer's details with these changes applied (a contact field given as `null` is cleared). */
function withDetails(before: CustomerDetails, details: CustomerFields): CustomerDetails {
  return {
    name: details.name ?? before.name,
    phone: details.phone === undefined ? before.phone : details.phone,
    email: details.email === undefined ? before.email : details.email,
    address: details.address === undefined ? before.address : details.address,
  };
}

/** The rates to write: those whose typed value differs from the customer's, judged against the item's unit. Refuses a bad value (422) or a rate the customer lacks (409). */
function ratesToWrite(current: ReadonlyArray<CustomerRateRecord>, wanted: ReadonlyArray<CustomerRateValue> | undefined): ReadonlyArray<CustomerRateValue> {
  const byItem = new Map(current.map((rate) => [rate.processItemId.toLowerCase(), rate]));
  const problems: FieldProblem[] = [];
  const writes: CustomerRateValue[] = [];
  (wanted ?? []).forEach((entry, index) => {
    const rate = byItem.get(entry.processItemId.toLowerCase());
    if (rate === undefined) throw new ConflictError(RATES_CHANGED_MESSAGE, { code: RATES_CHANGED_CODE });
    const problem = rateProblem(entry.value);
    if (problem !== null) problems.push({ field: `rates.${index}.value`, message: problem });
    else if (rateText(entry.value) !== rateText(rate.value)) writes.push({ processItemId: rate.processItemId, value: rateText(entry.value) });
  });
  if (problems.length > 0) throw new FieldValidationError(problems);
  return writes;
}

/** The customer's rates with these values set. */
function withRates(rates: ReadonlyArray<CustomerRateRecord>, writes: ReadonlyArray<CustomerRateValue>): ReadonlyArray<CustomerRateRecord> {
  const values = new Map(writes.map((write) => [write.processItemId.toLowerCase(), write.value]));
  return rates.map((rate) => ({ ...rate, value: values.get(rate.processItemId.toLowerCase()) ?? rate.value }));
}

/** The rates an edit or a reset changed, from the state before and the state after. */
function changedRates(before: ReadonlyArray<CustomerRateRecord>, after: ReadonlyArray<CustomerRateRecord>) {
  const changed = before.flatMap((rate, index) => {
    const next = after[index];
    return next !== undefined && rateText(next.value) !== rateText(rate.value) ? [{ before: rate, after: next }] : [];
  });
  return {
    before: ratesState(changed.map((pair) => pair.before), (rate) => rate.value),
    after: ratesState(changed.map((pair) => pair.after), (rate) => rate.value),
  };
}

/** Takes the Process Master's lock (a customer added while an item is added cannot miss its rate), adds the customer with its rates, and writes its entry. */
async function add({ masters, audit }: CustomerDependencies, tx: Transaction, context: AuditContext, input: NewCustomer): Promise<CustomerDetailRecord> {
  await masters.lockProcessItems(tx);
  const created = await masters.createCustomer(input, tx);
  const given = CONTACT_FIELD_NAMES.filter((field) => created[field] !== null);
  const after = auditState(created.name, given, ratesState(created.rates, (rate) => rate.value));
  await audit.record(tx, { event: 'master.created', ...entryFor(context, created), before: null, after });
  return created;
}

/** A save that changes nothing writes no change and no entry and answers with the customer as it is. */
async function change(
  { masters, audit }: CustomerDependencies,
  tx: Transaction,
  context: AuditContext,
  id: string,
  wanted: CustomerChanges,
): Promise<CustomerDetailRecord> {
  await masters.lockProcessItems(tx);
  const before = await masters.findCustomerForUpdate(id, tx);
  if (before === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
  const details = detailChangesFrom(before, wanted);
  const writes = ratesToWrite(before.rates, wanted.rates);
  if (Object.keys(details).length === 0 && writes.length === 0) return before;
  if (Object.keys(details).length > 0 && !(await masters.updateCustomerDetails(before.id, details, tx))) throw new NotFoundError(NOT_FOUND_MESSAGE);
  if (!(await masters.setCustomerRates(before.id, writes, tx))) throw new ConflictError(RATES_CHANGED_MESSAGE, { code: RATES_CHANGED_CODE });
  const after: CustomerDetailRecord = { ...before, ...withDetails(before, details), rates: withRates(before.rates, writes) };
  const contact = changedContactFields(details);
  const rates = changedRates(before.rates, after.rates);
  await audit.record(tx, {
    event: 'master.edited',
    ...entryFor(context, after),
    before: auditState(before.name, contact, rates.before),
    after: auditState(after.name, contact, rates.after),
  });
  return after;
}

/** Every rate that differs goes back to the current default; a customer with none that differ is a count of 0, with no change and no entry. */
async function reset(
  { masters, audit }: CustomerDependencies,
  tx: Transaction,
  context: AuditContext,
  id: string,
): Promise<CustomerResetResult> {
  await masters.lockProcessItems(tx);
  const before = await masters.findCustomerForUpdate(id, tx);
  if (before === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
  const writes = before.rates.filter(differsFromDefault).map((rate) => ({ processItemId: rate.processItemId, value: rate.defaultValue }));
  if (writes.length === 0) return { customer: before, count: 0 };
  if (!(await masters.setCustomerRates(before.id, writes, tx))) throw new NotFoundError(NOT_FOUND_MESSAGE);
  const after: CustomerDetailRecord = { ...before, rates: withRates(before.rates, writes) };
  const rates = changedRates(before.rates, after.rates);
  await audit.record(tx, {
    event: 'master.edited',
    ...entryFor(context, after),
    before: auditState(before.name, [], rates.before),
    after: auditState(after.name, [], rates.after),
  });
  return { customer: after, count: writes.length };
}

/**
 * The Process Master's lock first and the customer's row second (PRF-01, the same order as every other change), then the estimates that use the customer, then the
 * delete and its entry. The entry keeps what a create's does: the name, the names of the contact fields given (never their values) and every rate.
 */
async function remove({ masters, audit }: CustomerDependencies, tx: Transaction, context: AuditContext, id: string): Promise<void> {
  await masters.lockProcessItems(tx);
  const before = await masters.findCustomerForUpdate(id, tx);
  if (before === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
  const open = await masters.findOpenEstimatesOfCustomer(before.id, tx);
  if (open.total > 0) throw new MasterInUseError(CUSTOMER_IN_USE_CODE, before.name, open.estimates, open.total);
  if (!(await masters.softDeleteCustomer(before.id, tx))) throw new NotFoundError(NOT_FOUND_MESSAGE);
  const given = CONTACT_FIELD_NAMES.filter((field) => before[field] !== null);
  const state = auditState(before.name, given, ratesState(before.rates, (rate) => rate.value));
  await audit.record(tx, { event: 'master.deleted', ...entryFor(context, before), before: state, after: null });
}

/** The customer methods of the masters service. Nothing is read before the transaction opens, because no check needs the configuration. */
export function createCustomerOperations(dependencies: CustomerDependencies): CustomerOperations {
  const { masters, transactions } = dependencies;
  return {
    listCustomers: () => masters.listCustomers(),
    listCustomerOptions: () => masters.listCustomerOptions(),

    async getCustomer(id) {
      const customer = await masters.findCustomer(id);
      if (customer === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
      return customer;
    },

    async createCustomer(context, input) {
      assertDetails(input);
      const customer: NewCustomer = {
        name: canonicalCustomerName(input.name),
        phone: contactValue(input.phone),
        email: contactValue(input.email),
        address: contactValue(input.address),
      };
      return withNameRule(() => transactions.run((tx) => add(dependencies, tx, context, customer)));
    },

    async updateCustomer(context, id, changes) {
      assertDetails(changes);
      return withNameRule(() => transactions.run((tx) => change(dependencies, tx, context, id, changes)));
    },

    resetCustomerRates: (context, id) => transactions.run((tx) => reset(dependencies, tx, context, id)),

    deleteCustomer: (context, id) => transactions.run((tx) => remove(dependencies, tx, context, id)),
  };
}
