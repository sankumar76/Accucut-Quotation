import { z } from 'zod';

import type { AuditCategoryId } from '../../lib/audit/categories';
import { roleLabel } from '../../lib/auth/roles';
import { describeDeleteAfter, describeDeleteBefore } from '../../lib/config/field-delete-audit';
import { describeInsertAudit, describeInsertBefore } from '../../lib/config/field-insert-audit';
import { describeRevertAfter, describeRevertBefore } from '../../lib/config/revert';
import { MAX_REASON_LENGTH } from '../../lib/estimate/approve-price';
import { IGNORE_REMARKS_MAX_LENGTH } from '../../lib/estimate/ignore-words';
import { MAX_ENTRY_FIELDS } from '../../lib/estimate/input-change';
import { NODE_KIND_NAMES, NODE_KINDS } from '../../lib/estimate/node-kinds';
import { ESTIMATE_STATUSES, type EstimateStatus } from '../../lib/estimate/state-machine';
import { taskStatusOf } from '../../lib/estimate/task-status';
import { QTY_ZERO_CODE } from '../../lib/estimate/warning-copy';
import { FIELD_KINDS } from '../../lib/fields/types';
import { formatRupees } from '../../lib/money';
import { CONTACT_FIELD_NAMES, type ContactFieldName } from '../../lib/masters/customers';
import { EXCHANGE_RATE_FIELDS, EXCHANGE_RATE_LABELS } from '../../lib/masters/exchange-rates';
import { RUPEE } from '../../lib/masters/master-rules';
import { MATERIAL_FIELD_LABELS } from '../../lib/masters/materials';
import { formatDefaultValue, PERCENT_UNIT, unitLabel } from '../../lib/masters/process-items';
import { formatIst } from '../../lib/time';
import { USER_ROLE_VALUES } from '../../lib/users/validation';
import type { JsonValue } from '../repositories/audit-repository';

/**
 * The registry of audit events (STORY-01.07 AC-3, assumption A-2; architecture sections 4.1 and 8). It is one TypeScript module
 * so that an event cannot be raised without a name, a subject, a category and the shape of what it keeps before and after:
 * `AuditService.record` takes only a name from `AUDIT_EVENTS`, and checks `before` and `after` against that event's schemas.
 *
 * Each entry says
 *   - `objectType`: what the entry is about ("user"), shown nowhere but kept for the day a screen wants it;
 *   - `category`: the choice of the Event filter it appears under (`src/lib/audit/categories.ts`);
 *   - `before` and `after`: the zod schemas of the two stored JSON values. They name the fields, so a password, a hash or a
 *     token has no place to go (AC-4); `AuditService` refuses a secret-looking key or value besides (`audit-secrets.ts`);
 *   - `describe`: the words the screen shows for "Before to after", written from the stored values;
 *   - `status`: `wired` events are raised by code that exists and are tested, one test each (the integration test pins the
 *     set); `reserved` events are declared for a later story, which adds the call, its schemas and its test.
 *
 * Who, when, the object's ID, its label at the time and the request ID are not per-event: they are the same for every event and
 * `AuditService.record` takes them as arguments.
 */

export interface AuditChangeText {
  readonly before: string;
  readonly after: string;
}

/** What the screen shows when an entry cannot be described: a reserved event, or stored values that do not fit their schema. */
export const NO_DETAIL: AuditChangeText = { before: '—', after: '—' };

/** The `objectType` of the generic master events (`master.*`): the entry's own object type is then the master the caller names. */
const GENERIC_MASTER_TYPE = 'master';

/** A schema of a stored value: what it accepts is JSON, so the writer can hand what it parsed to the repository. */
type StoredShape = z.ZodType<JsonValue>;

interface EventDefinition<Before extends StoredShape, After extends StoredShape> {
  readonly objectType: string;
  readonly category: AuditCategoryId;
  readonly status: 'wired' | 'reserved';
  /**
   * The Event column's words for an entry of this event, when the category is too wide to tell the kinds apart (STORY-08.07 AC-2: "Formula edit", "Field insert", "Field delete", "Checkpoint revert"). Every event
   * of the `config_change` category has one (`tests/unit/config-history.test.ts` fails a configuration event without it); elsewhere the column shows the category.
   */
  readonly kindLabel?: string;
  readonly before: Before;
  readonly after: After;
  /**
   * The schemas a **stored** entry is read through, when they differ from the write schemas above (default: the same). The log is immutable, so an entry written under
   * an older vocabulary must stay readable while the writer accepts only today's: a read schema may map an old value to its new word (`approval.cancelled`, below).
   */
  readonly readBefore?: z.ZodType<z.output<Before>, unknown>;
  readonly readAfter?: z.ZodType<z.output<After>, unknown>;
  /** `objectType` is the entry's own (`process_item`, `material`): a generic master event chooses its words by it. */
  describe(before: z.output<Before>, after: z.output<After>, objectType: string): AuditChangeText;
  /**
   * Only the generic master events (`master.*`) have it: the same two schemas, but for the shape of one master (`MASTER_SHAPES`) where
   * `before` and `after` above accept the union of every master's shape. The writer uses it, so a state is checked against the
   * entry's own `object_type` (QLT-11).
   */
  forMasterShape?(shape: StoredShape): { readonly before: StoredShape; readonly after: StoredShape };
}

interface RegisteredEvent<Before extends StoredShape, After extends StoredShape> extends EventDefinition<Before, After> {
  /** The words for stored JSON, or null if the stored values do not fit the schemas (they are then shown as `NO_DETAIL`). */
  describeStored(before: unknown, after: unknown, objectType?: string): AuditChangeText | null;
  /**
   * The schemas the writer checks `before` and `after` against for an entry of this `object_type`. For a generic master event it is the
   * shape of that master, or null if `objectType` is no master the log has a shape for (deny by default: the entry is refused).
   */
  schemasFor(objectType: string): { readonly before: StoredShape; readonly after: StoredShape } | null;
}

function defineEvent<Before extends StoredShape, After extends StoredShape>(
  definition: EventDefinition<Before, After>,
): RegisteredEvent<Before, After> {
  return {
    ...definition,
    schemasFor(objectType) {
      if (definition.forMasterShape === undefined) {
        // Deny by default (QLT-02): a generic master event declared without `forMasterShape` must not fall back to its union schemas.
        return definition.objectType === GENERIC_MASTER_TYPE ? null : { before: definition.before, after: definition.after };
      }
      const shape = masterShapeOf(objectType);
      return shape === undefined ? null : definition.forMasterShape(shape);
    },
    describeStored(before, after, objectType) {
      const parsedBefore = (definition.readBefore ?? definition.before).safeParse(before);
      const parsedAfter = (definition.readAfter ?? definition.after).safeParse(after);
      return parsedBefore.success && parsedAfter.success ? definition.describe(parsedBefore.data, parsedAfter.data, objectType ?? definition.objectType) : null;
    },
  };
}

// ---- Shape of the estimate's customer change (SCR-16 "Task change"; CR-01 item 6) --------------------------------------------------
/** The customer an estimate was for or is for: the name and the short name, or null for an estimate that had none. Names only: no contact detail and no rate. */
const estimateCustomerState = z.strictObject({ customer: z.strictObject({ name: z.string().min(1), shortName: z.string().min(1) }).nullable() });

// ---- The shapes of a Lead's or an Admin's changes of inputs, pictures and the tree (DEF-131 stage 2; architecture note lead-admin-input-edit-2026-11-27, sections 3.4 and 3.9) ----------------------------------
// Every state is strict, so no figure, rate, formula or input value of a deleted row has a key to sit in (NFR-002, NFR-007). The actor's role is kept in the after state (an entry has no role column and a role can change
// later), and it can only be a Lead or an Admin: the Engineer's own writes are not audited.
const inputActorRole = z.enum(['LEAD', 'ADMIN']);
/** The most rows a delete entry lists; a bigger delete says so (`truncated`) and keeps the count. */
export const DELETED_ROWS_LISTED = 100;
const inputField = z.strictObject({ letter: z.string().min(1).max(10), label: z.string().min(1).max(200), value: z.string().max(2_000).nullable() });
const inputPart = z.strictObject({ slNo: z.string().min(1).max(60), name: z.string().max(200) });
const inputsBefore = z.strictObject({ part: inputPart, fields: z.array(inputField).min(1).max(MAX_ENTRY_FIELDS) });
const inputsAfter = z.strictObject({ actorRole: inputActorRole, part: inputPart, fields: z.array(inputField).min(1).max(MAX_ENTRY_FIELDS) });
const treeKind = z.enum(NODE_KINDS);
const treeRow = z.strictObject({ slNo: z.string().min(1).max(60), name: z.string().max(200), kind: treeKind });
const partAddedAfter = z.strictObject({ actorRole: inputActorRole, part: z.strictObject({ slNo: z.string().min(1).max(60), kind: treeKind }), parent: inputPart.nullable() });
const partMovedBefore = z.strictObject({ part: treeRow });
const partMovedAfter = z.strictObject({ actorRole: inputActorRole, part: treeRow });
// Two shapes and no optional key (an optional key is not JSON): the whole list, or the first rows of it with `truncated: true`.
const deletedList = { part: treeRow, rows: z.number().int().min(1), list: z.array(treeRow).max(DELETED_ROWS_LISTED) };
const partDeletedBefore = z.union([z.strictObject(deletedList), z.strictObject({ ...deletedList, truncated: z.literal(true) })]);
const partDeletedAfter = z.strictObject({ actorRole: inputActorRole });

const describeRow = (row: { readonly slNo: string; readonly name: string }): string => (row.name === '' ? row.slNo : `${row.slNo} ${row.name}`);
/** "1.4 Top cover: Length 450; Width Not entered": the part, then each changed field with its text (a blank is "Not entered"). */
const describeInputFields = (state: z.output<typeof inputsBefore>): string => `${describeRow(state.part)}: ${state.fields.map((field) => `${field.label} ${field.value ?? 'Not entered'}`).join('; ')}`;
function describeRowsDeleted(before: z.output<typeof partDeletedBefore>): string {
  const under = before.rows - 1;
  return under === 0 ? describeRow(before.part) : `${describeRow(before.part)} and ${String(under)} ${under === 1 ? 'row' : 'rows'} under it`;
}

/** "Brightwater Controls (BWC)", or "No customer" for an estimate that had none. */
function describeEstimateCustomer(state: z.output<typeof estimateCustomerState>): string {
  return state.customer === null ? 'No customer' : `${state.customer.name} (${state.customer.shortName})`;
}

// ---- Shapes of the user events (SCR-16 "User change") ----------------------------------------------------------------------
// A name and an e-mail address are not kept here: the entry's label is the person's name at that moment, the object ID says which
// person, and an e-mail address is personal data the log has no use for (data minimisation).

const userRole = z.enum(USER_ROLE_VALUES);
const roleState = z.strictObject({ role: userRole });
/** A person's name, which is not a secret and is already the entry's label; the rename event keeps the old and the new one. */
const nameState = z.strictObject({ name: z.string().min(1) });
/** Who holds the Admin role, as the hand-over entry keeps it on each side (STORY-01.09 AC-4): the person's ID and their name at that moment. */
const adminState = z.strictObject({ adminId: z.uuid(), adminName: z.string().min(1) });

// ---- Shape of the quantity-warning event (SCR-16 "Quantity warning"; STORY-05.12) ---------------------------------------------------
/** A row that was warned: the code, the part, its Sl. No and its name as typed. Text only: no number from a calculation has a place here. */
const warnedRow = z.strictObject({ code: z.literal(QTY_ZERO_CODE), nodeId: z.string().min(1), slNo: z.string().min(1), label: z.string() });

// ---- Shape of the approval event (SCR-16 "Approval"; STORY-06.06) ----------------------------------------------------------
/** A price or a total as decimal text ("12600.00", "12629.9876"); never a JavaScript number (ADR-005). */
const rupeesText = z.string().regex(/^\d+(\.\d+)?$/);
/**
 * What an approval keeps: the price set (BO), the calculated total it was set against (BL), the approver's name at that moment, and (STORY-06.07 AC-2) whether the price is an override. No rate, formula or master
 * value has a key to sit in (NFR-002). The reason is not here: it is the price-override entry's.
 */
const approvedState = z.strictObject({ approvedPrice: rupeesText, calculatedTotal: rupeesText, approver: z.string().min(1), isOverride: z.boolean() });

/**
 * The two sides of the price-override entry (STORY-06.07 AC-2, AC-3; SCR-16 "Price override"). Before: the calculated total the price was set against. After: the price and the reason the Lead gave for it, the
 * text they typed (trimmed, at most 500 characters, no control or invisible character, as the column holds it), or `null` when they gave none (UX-31). Nothing else has a key to sit in: no rate, formula or master
 * value (NFR-002), and no contact data. Who set it and when are the entry's own columns.
 */
const overriddenBefore = z.strictObject({ calculatedTotal: rupeesText });
// The limit counts code points, as the column's CHECK and the rule that wrote the reason do: zod's `max` counts UTF-16 units, so 500 emoji would be refused here after the column had taken them.
const reasonText = z
  .string()
  .min(1)
  .refine((text) => Array.from(text).length <= MAX_REASON_LENGTH, { message: `Use ${MAX_REASON_LENGTH} characters or fewer.` });
const overriddenAfter = z.strictObject({ approvedPrice: rupeesText, reason: reasonText.nullable() });

/** "Calculated ₹ 12,629.99 to Approved ₹ 12,600.00. Reason: …", or "… No reason given." (SCR-16). The reason is shown as typed: the screen draws text, never markup. */
const describeOverride = (before: z.output<typeof overriddenBefore>, after: z.output<typeof overriddenAfter>): AuditChangeText => ({
  before: `Calculated ${formatRupees(before.calculatedTotal)}`,
  after: `Approved ${formatRupees(after.approvedPrice)}. ${after.reason === null ? 'No reason given.' : `Reason: ${after.reason}`}`,
});

// ---- Shape of the unlock event (SCR-16 "Unlock"; STORY-06.08) --------------------------------------------------------------------
/** The status an unlock leaves: only a locked estimate can be unlocked, Approved or Quoted (FR-110; QLT-C-03 of the final review). */
const unlockedFromStatus = z.enum(['APPROVED', 'QUOTED']);
/** What an unlock keeps before: the price the approval stood at (BO), which stays on record, and the status the estimate left, as the cancel entry keeps it. */
const unlockedBeforeState = z.strictObject({ approvedPrice: rupeesText, status: unlockedFromStatus });
/**
 * LEGACY READ (QLT-C-03). Entries written before the status was kept hold the price alone. They read as Approved: that is true of every entry written before a Quoted estimate could be unlocked (PR 624, 2026-11-22).
 * The window since then (an unlock of a Quoted estimate stored without a status) holds development, CI and demo data only, no production data, so no entry can read wrongly. The audit log is immutable,
 * so the **read** schema reads a missing status as Approved; the write schema above requires it.
 */
const unlockedBeforeRead = z.strictObject({ approvedPrice: rupeesText, status: unlockedFromStatus.default('APPROVED') });
/** "Approved at ₹ 4,750.00", or "Quoted at ₹ 4,750.00" for an estimate that had been marked as quoted: a quote taken back reads differently from an approval taken back. */
const describeUnlockedFrom = (before: z.output<typeof unlockedBeforeState>): string => `${before.status === 'QUOTED' ? 'Quoted' : 'Approved'} at ${formatRupees(before.approvedPrice)}`;
/** What an unlock keeps after: the Lead's reason, as stored (1 to 500 characters, trimmed). Who and when are the entry's own columns. */
const unlockedAfterState = z.strictObject({ reason: z.string().min(1).max(500) });

// ---- Shape of the Ignore and Restore events (CR-01 item 7D, AQP-401; SCR-16 "Task change") ------------------------------------------
/** The status underneath the Ignored layer: a Draft, a Prepared or an Approved estimate (a Quoted one cannot be ignored, `ck_estimates_quoted_not_ignored`). */
const ignoredStatusState = z.strictObject({ status: z.enum(['DRAFT', 'PREPARED', 'APPROVED']) });
/** The status and the Lead's remarks as stored (trimmed, 1 to `IGNORE_REMARKS_MAX_LENGTH` code points). The limit counts code points, as the column's CHECK does. */
const ignoredRemarksState = z.strictObject({
  status: z.enum(['DRAFT', 'PREPARED', 'APPROVED']),
  remarks: z
    .string()
    .min(1)
    .refine((text) => Array.from(text).length <= IGNORE_REMARKS_MAX_LENGTH, { message: `Use ${IGNORE_REMARKS_MAX_LENGTH} characters or fewer.` }),
});
const describeStatus = (status: EstimateStatus): string => taskStatusOf(status).label;

// ---- Shape of the cancel event (SCR-16 "Approval cancelled"; STORY-06.12) ---------------------------------------------------------
/** The status of the estimate, before and after the cancel. Equal when the cancel did not move it (an approval kept through an unlock, on a Draft or a Prepared estimate: AC-10), so the entry shows that nothing moved. */
const estimateStatus = z.enum(ESTIMATE_STATUSES);
/** What a cancel keeps before: the price the approval stood at (BO), which stays on record, and the status the estimate was in. */
const cancelledBeforeState = z.strictObject({ approvedPrice: rupeesText, status: estimateStatus });
/** What a cancel keeps after: the Admin's reason, as stored (1 to 500 characters, trimmed), and the status the estimate is in now. Who cancelled and when are the entry's own columns. The password is in no shape here. */
const cancelledAfterState = z.strictObject({ reason: reasonText, status: estimateStatus });

/**
 * LEGACY READ (AQP-398, CR-01 item 7; the one place the old status value survives in `src/`). Until then the stored status of a not-yet-approved estimate was `SUBMITTED`. The audit log is
 * immutable, so `approval.cancelled` entries written before the rename still hold it. The **read** schemas turn it into `PREPARED`; the write schemas above accept only today's values.
 */
const LEGACY_SUBMITTED = 'SUBMITTED';
const readEstimateStatus = z.preprocess((value) => (value === LEGACY_SUBMITTED ? 'PREPARED' : value), estimateStatus);
const cancelledBeforeRead = z.strictObject({ approvedPrice: rupeesText, status: readEstimateStatus });
const cancelledAfterRead = z.strictObject({ reason: reasonText, status: readEstimateStatus });

const STATUS_WORDS: Readonly<Record<EstimateStatus, string>> = { DRAFT: 'a Draft', PREPARED: 'Prepared', APPROVED: 'Approved', QUOTED: 'Quoted' };

/**
 * "Approved at ₹ 4,750.00 to Cancelled. Reason: …" (SCR-16, UX-64). When the cancel did not move the estimate the entry says so, before the reason: "Cancelled, the estimate stayed a Draft. Reason: …" (an assumption of
 * STORY-06.12 AC-10: the spec gives the first form only).
 */
const describeCancelled = (before: z.output<typeof cancelledBeforeState>, after: z.output<typeof cancelledAfterState>): AuditChangeText => ({
  before: `Approved at ${formatRupees(before.approvedPrice)}`,
  after: before.status === after.status ? `Cancelled, the estimate stayed ${STATUS_WORDS[after.status]}. Reason: ${after.reason}` : `Cancelled. Reason: ${after.reason}`,
});

// ---- Shape of the remove-price event (SCR-16 "Price removed"; STORY-06.13) ---------------------------------------------------------
/** What a removal keeps before: **the price that was removed**. The portal serves it nowhere else; this entry is the one place it can be read, and only the Admin reads the log (architecture sections 4.10 and 5.3). */
const removedBeforeState = z.strictObject({ approvedPrice: rupeesText });
/** The price is gone from the estimate: nothing is kept after. Who removed it and when are the entry's own columns. The password is in no shape here. */
const removedAfterState = z.null();

/** "Price ₹ 4,750.00 removed from the estimate. The audit log keeps it" (SCR-16, UX-64), split at the arrow of "Before to after". */
const describeRemoved = (before: z.output<typeof removedBeforeState>): AuditChangeText => ({
  before: `Price ${formatRupees(before.approvedPrice)}`,
  after: 'Removed from the estimate. The audit log keeps it',
});

/** "1.4 Top cover": the Sl. No and the name, or the Sl. No alone for a part with no name. */
const describeWarnedRow = (row: z.output<typeof warnedRow>): string => (row.label === '' ? row.slNo : `${row.slNo} ${row.label}`);

// ---- Shape of the task-change event (SCR-16 "Task change"; STORY-04.07) -------------------------------------------------------
/**
 * The assignment of a task as it stood: the Engineer (ID and name at that moment) and the deadline as a UTC instant. Nothing else about the task has a key to sit in: no folder path, notes, title,
 * customer or cost (NFR-002), and no e-mail address (data minimisation). The object of the entry is the task code.
 */
const assignmentState = z.strictObject({ engineer: z.strictObject({ id: z.string().min(1), name: z.string().min(1) }), deadlineAt: z.iso.datetime() });

/**
 * "Arjun Rao to Meera Nair" for an Engineer and "03 Nov 2026, 17:00 IST to 04 Nov 2026, 12:00 IST" for a deadline (SCR-16, AC-4), split at the arrow of "Before to after". A change of both gives both on each side,
 * the Engineer first: one entry for one save (decision D-g). An entry whose two sides are equal (a save that changed nothing writes none) shows both, so the words are never empty.
 */
function describeReassigned(before: z.output<typeof assignmentState>, after: z.output<typeof assignmentState>): AuditChangeText {
  const engineerChanged = before.engineer.id !== after.engineer.id;
  const deadlineChanged = before.deadlineAt !== after.deadlineAt;
  const neither = !engineerChanged && !deadlineChanged;
  const sides: Array<readonly [string, string]> = [];
  if (engineerChanged || neither) sides.push([before.engineer.name, after.engineer.name]);
  if (deadlineChanged || neither) sides.push([formatIst(new Date(before.deadlineAt)), formatIst(new Date(after.deadlineAt))]);
  return { before: sides.map(([old]) => old).join(', '), after: sides.map(([, current]) => current).join(', ') };
}

// ---- Shape of the Process Master events (SCR-16 "Master data edit") ------------------------------------------------------------
/** A rate as the log keeps it: its name, unit and default value as decimal text ("0.37"). The ID and the name label the entry. */
const processItemState = z.strictObject({
  name: z.string().min(1),
  unit: z.string().min(1),
  defaultValue: z.string().regex(/^\d+\.\d{2,4}$/),
});

/** "Foam Cost, ₹ per sq ft, 21.37": the whole rate, so a reader sees what it was and what it is without a legend. */
function describeProcessItem(state: z.output<typeof processItemState>): string {
  return `${state.name}, ${unitLabel(state.unit)}, ${formatDefaultValue(state.defaultValue, state.unit)}`;
}

// ---- Shape of the Material Master events (SCR-16 "Master data edit"; STORY-02.03) ----------------------------------------------
/** A decimal as the log keeps it: text with two to four decimals ("7.37"). */
const decimalText = z.string().regex(/^\d+\.\d{2,4}$/);

/** A material as the log keeps it: its name, Material Considered, and the three numbers. The ID and the name label the entry. */
const materialState = z.strictObject({
  materialInDrawing: z.string().min(1),
  materialConsidered: z.string().min(1),
  pricePerKg: decimalText,
  specificGravity: decimalText,
  scrapRate: decimalText,
});

/** "Invented sheet, Invented steel, Price per kg ₹ 58.37, Specific gravity 7.37, Material-Scrap-Rate (per kg) ₹ 22.37": the whole material. */
function describeMaterial(state: z.output<typeof materialState>): string {
  return [
    state.materialInDrawing,
    state.materialConsidered,
    `${MATERIAL_FIELD_LABELS.pricePerKg} ${RUPEE} ${state.pricePerKg}`,
    `${MATERIAL_FIELD_LABELS.specificGravity} ${state.specificGravity}`,
    `${MATERIAL_FIELD_LABELS.scrapRate} ${RUPEE} ${state.scrapRate}`,
  ].join(', ');
}

// ---- Shape of the Treatment / Color events (SCR-16 "Master data edit"; STORY-02.05) ---------------------------------------------
/** A treatment as the log keeps it: its name. The ID and the name label the entry. */
const treatmentState = z.strictObject({ name: z.string().min(1) });

// ---- Shape of the Customer Master events (SCR-16 "Master data edit"; STORY-02.02, architecture section 8 "Customers") -----------------------
/**
 * One rate of a customer as the log keeps it: the Process Master item's ID, its name and unit at that moment (items are renamed, D-39) and the customer's
 * value as decimal text. A create lists every rate as created; an edit or a reset lists only the rates that changed, `before` with the old values and
 * `after` with the new ones, for the same items in the order of the SCR-12 table.
 */
const customerRateState = z.strictObject({
  processItemId: z.uuid(),
  name: z.string().min(1),
  unit: z.string().min(1),
  value: decimalText,
});

/**
 * A customer as the log keeps it. `contact` names the contact fields that were given (a create) or changed (an edit), the same list on both sides, and
 * **never their values**: the log is append-only, a phone number or an address is personal data, and erasure waits on Q-26 (data minimisation, as for the
 * user events). The ID and the name label the entry; `name` is kept in the state as well, so an edit shows the old name and the new one. `shortName` (CR-01 item 6, AQP-390) is kept beside it: it is
 * class Internal and not contact data, so its value may be logged. It reads as null from an entry written before CR-01 (the key is absent there), so such an entry still reads; every entry written now has it.
 */
const customerState = z.strictObject({
  name: z.string().min(1),
  shortName: z.string().min(1).nullable().default(null),
  contact: z.array(z.enum(CONTACT_FIELD_NAMES)),
  rates: z.array(customerRateState),
});

const CONTACT_WORDS: Readonly<Record<ContactFieldName, string>> = { phone: 'Phone', email: 'E-mail', address: 'Address' };

/** "Cutting-Rate-per-Sec ₹ 0.50" and "OH Profit % 11.00 %": the rate and its value in the unit's own form. */
function describeCustomerRate(rate: z.output<typeof customerRateState>): string {
  return `${rate.name} ${rate.unit === PERCENT_UNIT ? formatDefaultValue(rate.value, rate.unit) : `${RUPEE} ${rate.value}`}`;
}

/** "Brightwater Controls (BWC); Contact: Phone, E-mail; Cutting-Rate-per-Sec ₹ 0.50": the name and short name, the contact fields, and the rates the entry lists. */
function describeCustomer(state: z.output<typeof customerState>): string {
  const contact = state.contact.length === 0 ? [] : [`Contact: ${state.contact.map((field) => CONTACT_WORDS[field]).join(', ')}`];
  const label = state.shortName === null ? state.name : `${state.name} (${state.shortName})`;
  return [label, ...contact, ...state.rates.map(describeCustomerRate)].join('; ');
}

// ---- Shape of the Exchange Rate Master events (SCR-16 "Master data edit"; STORY-02.04) ------------------------------------------
/**
 * The exchange rates as the log keeps them: each of the two rates as decimal text, or null while it was never set. One entry covers the pair
 * (they are saved together), so `before` and `after` hold both rates; the one that did not change is the same in each.
 */
const exchangeRateState = z.strictObject({ usd: decimalText.nullable(), eur: decimalText.nullable() });

const NOT_SET_WORDS = 'Not set yet';

/** "1 USD in ₹ 81.37, 1 EUR in ₹ Not set yet": both rates, so a reader sees what they were and what they are without a legend. */
function describeExchangeRates(state: z.output<typeof exchangeRateState>): string {
  return EXCHANGE_RATE_FIELDS.map((field) => `${EXCHANGE_RATE_LABELS[field]} ${state[field] ?? NOT_SET_WORDS}`).join(', ');
}

/**
 * The shape of the state each master keeps, by the `object_type` of its entries. It is the one table both sides read: `AuditService.record`
 * checks `before` and `after` of a generic master event against the shape of the entry's own `object_type` (`schemasFor`), so a
 * state that fits another master, or only part of this one, is refused (QLT-11, NFR-007: the log is append-only, a wrong entry cannot be
 * corrected); and `MASTER_WORDS` below describes a stored state by the same shape. A type that is not here is refused. A new master adds its
 * shape here, to `masterState` (for the types of a caller's payload) and its describer to `MASTER_WORDS`; the `satisfies` on `MASTER_WORDS` makes a master with no words a compile error, and a test pins the rest.
 */
export const MASTER_SHAPES = {
  process_item: processItemState,
  material: materialState,
  exchange_rate: exchangeRateState,
  treatment: treatmentState,
  customer: customerState,
} as const satisfies Readonly<Record<string, StoredShape>>;

/** The same table as a Map, so a type such as "constructor" finds nothing: a Map has no inherited members to find (deny by default). */
const MASTER_SHAPES_BY_TYPE: ReadonlyMap<string, StoredShape> = new Map(Object.entries(MASTER_SHAPES));

/** The shape of the master an entry's `object_type` names, or undefined for a type the log has no shape for. */
function masterShapeOf(objectType: string): StoredShape | undefined {
  return MASTER_SHAPES_BY_TYPE.get(objectType);
}

/**
 * What a generic master event keeps, as a caller may give it: the state of any of the masters. This union types the payload and is what
 * `describeStored` reads; it is **not** what the writer stores by: the writer checks the state against `MASTER_SHAPES[object_type]`, and the
 * **words** are chosen by the entry's object type, never by guessing from the keys (a material state under `process_item` is not
 * described as a rate; the screen shows a dash).
 */
const masterState = z.union([processItemState, materialState, exchangeRateState, treatmentState, customerState]);

function wordsOf<T extends z.ZodType>(shape: T, describe: (state: z.output<T>) => string): (state: unknown) => string | null {
  return (state) => {
    const parsed = shape.safeParse(state);
    return parsed.success ? describe(parsed.data) : null;
  };
}

/**
 * The words of each master, one per key of `MASTER_SHAPES`. `satisfies` makes the two key sets one: a master with a shape and no words,
 * and words for a master with no shape, are both compile errors (QLT-01).
 */
const MASTER_WORDS = {
  process_item: wordsOf(MASTER_SHAPES.process_item, describeProcessItem),
  material: wordsOf(MASTER_SHAPES.material, describeMaterial),
  exchange_rate: wordsOf(MASTER_SHAPES.exchange_rate, describeExchangeRates),
  treatment: wordsOf(MASTER_SHAPES.treatment, (state) => state.name),
  customer: wordsOf(MASTER_SHAPES.customer, describeCustomer),
} as const satisfies { readonly [K in keyof typeof MASTER_SHAPES]: (state: unknown) => string | null };

/** The same table as a Map, so a stored object type such as "toString" finds nothing: a Map has no inherited members (deny by default). */
const MASTER_WORDS_BY_TYPE: ReadonlyMap<string, (state: unknown) => string | null> = new Map(Object.entries(MASTER_WORDS));

/** "Not added", the master's words, or "Deleted" for one entry; `NO_DETAIL` when the object type is unknown or the state does not fit it. */
function describeMasterChange(objectType: string, before: unknown, after: unknown): AuditChangeText {
  const words = MASTER_WORDS_BY_TYPE.get(objectType);
  if (words === undefined) return NO_DETAIL;
  const beforeWords = before === null ? 'Not added' : words(before);
  const afterWords = after === null ? 'Deleted' : words(after);
  return beforeWords === null || afterWords === null ? NO_DETAIL : { before: beforeWords, after: afterWords };
}

// With STORY-06.13 no event of Release 1 is left declared and unwired. A story that declares one for a later story adds an entry with `status: 'reserved'`, schemas that accept any JSON (`z.json()`) and
// `describe: () => NO_DETAIL`, and the story that wires it gives it its own shapes, words and test.

/** STORY-08.03: what an insert keeps (`config.field_inserted`). Letters are the ones of the finished worksheet; `moved` is runs of OLD letters with the number of places they moved. */
const insertedColumn = z.strictObject({
  letter: z.string().min(1).max(10),
  label: z.string().min(1).max(200),
  kind: z.enum(['input', 'output']),
  follows: z.string().min(1).max(10).nullable(),
  // No upper bound, as `config.formula_changed` has none: the entry keeps the formula in display form, which is longer than the stored form when it names rates (review SQR-02).
  formula: z.string().min(1).nullable(),
});
const insertedAfterState = z.strictObject({
  fields: z.array(insertedColumn).min(1).max(2),
  moved: z.array(z.strictObject({ from: z.string().min(1).max(10), to: z.string().min(1).max(10), by: z.number().int().positive() })),
  version: z.number().int().positive(),
  // STORY-08.08: the section an insert added and the number of choices of a choice input, `null` when none. They default to null, so an entry stored before this story still reads (the log is never rewritten).
  section: z.strictObject({ number: z.number().int().positive(), name: z.string().min(1).max(200) }).nullable().default(null),
  choices: z.number().int().positive().nullable().default(null),
});

/** STORY-08.04: what a delete keeps (`config.field_deleted`). Before is the column as it was; after is runs of OLD letters with the number of places they moved to the left. */
const deletedBeforeState = z.strictObject({
  letter: z.string().min(1).max(10),
  label: z.string().min(1).max(200),
  kind: z.enum(FIELD_KINDS),
  // No upper bound, as `config.formula_changed` has none: the entry keeps the formula in display form (review SQR-02 of AQP-358).
  formula: z.string().min(1).nullable(),
});
const deletedAfterState = z.strictObject({
  moved: z.array(z.strictObject({ from: z.string().min(1).max(10), to: z.string().min(1).max(10), by: z.number().int().positive() })),
  version: z.number().int().positive(),
});

/** STORY-08.06: what a revert keeps (`config.reverted`). Before is the version that was current; after is the version the revert made and the one it copied. Numbers only. */
const revertedBeforeState = z.strictObject({ version: z.number().int().positive() });
const revertedAfterState = z.strictObject({ version: z.number().int().positive(), copiedFrom: z.number().int().positive() });

export const AUDIT_EVENTS = {
  // ---- Wired in this story: the six user events of the Users screen (STORY-01.04) -----------------------------------------
  'user.created': defineEvent({
    objectType: 'user',
    category: 'user_change',
    status: 'wired',
    before: z.null(),
    after: z.strictObject({ role: userRole, isActive: z.literal(true) }),
    describe: (_before, after) => ({ before: 'Not added', after: `Added as ${roleLabel(after.role)}` }),
  }),
  // A name changed on its own or with a role: one event for each attribute that changed (PM decision, AQP-74 comment 11077).
  // The entry's Object is the name after the change; this entry says "old name to new name" (ux-spec v0.16).
  'user.renamed': defineEvent({
    objectType: 'user',
    category: 'user_change',
    status: 'wired',
    before: nameState,
    after: nameState,
    describe: (before, after) => ({ before: before.name, after: after.name }),
  }),
  'user.role_changed': defineEvent({
    objectType: 'user',
    category: 'user_change',
    status: 'wired',
    before: roleState,
    after: roleState,
    describe: (before, after) => ({ before: roleLabel(before.role), after: roleLabel(after.role) }),
  }),
  'user.deactivated': defineEvent({
    objectType: 'user',
    category: 'user_change',
    status: 'wired',
    before: z.strictObject({ isActive: z.literal(true) }),
    after: z.strictObject({ isActive: z.literal(false) }),
    describe: () => ({ before: 'Active', after: 'Deactivated' }),
  }),
  'user.activated': defineEvent({
    objectType: 'user',
    category: 'user_change',
    status: 'wired',
    before: z.strictObject({ isActive: z.literal(false) }),
    after: z.strictObject({ isActive: z.literal(true) }),
    describe: () => ({ before: 'Deactivated', after: 'Active' }),
  }),
  'user.password_reset': defineEvent({
    objectType: 'user',
    category: 'user_change',
    status: 'wired',
    // Whether the person had still to change a password already set for them. The password and its hash are never kept.
    before: z.strictObject({ mustChangePassword: z.boolean() }),
    after: z.strictObject({ mustChangePassword: z.literal(true) }),
    describe: () => ({ before: 'Earlier password', after: 'Temporary password set' }),
  }),
  // STORY-01.09: the Admin role handed to another person. One entry for the one act (decision D-h), not a `user.role_changed` for each person. The entry's actor is the old Admin and its object the new one.
  // Each side names the Admin: their ID and their name at the time (the names are the entry's only text; no e-mail address, password, hash or token has a key to sit in).
  'user.admin_handed_over': defineEvent({
    objectType: 'user',
    category: 'user_change',
    status: 'wired',
    before: adminState,
    after: adminState,
    describe: (before, after) => ({ before: `Admin was ${before.adminName}`, after: `Admin is now ${after.adminName}` }),
  }),

  // ---- Wired in STORY-02.01: the three events of the Process Master (AC-5) ------------------------------------------------------
  // Architecture section 8 (AQP-74 ruling): `master.edited`, and a masters story may add `master.created` and `master.deleted` under
  // the same rule. `object_type` then names the master (`process_item`; `material` from STORY-02.03, whose AC-5 says `master.material.*`
  // and is read with this ruling), which the caller gives (`AuditEntryInput.objectType`).
  // Each save is one entry, whatever number of attributes it changes (AC-5). A rate's value is Restricted, and the log is
  // Admin-only (architecture section 5.3), so the entry may keep it.
  'master.created': defineEvent({
    objectType: GENERIC_MASTER_TYPE,
    category: 'master_data',
    status: 'wired',
    before: z.null(),
    after: masterState,
    forMasterShape: (shape) => ({ before: z.null(), after: shape }),
    describe: (before, after, objectType) => describeMasterChange(objectType, before, after),
  }),
  'master.edited': defineEvent({
    objectType: GENERIC_MASTER_TYPE,
    category: 'master_data',
    status: 'wired',
    before: masterState,
    after: masterState,
    forMasterShape: (shape) => ({ before: shape, after: shape }),
    describe: (before, after, objectType) => describeMasterChange(objectType, before, after),
  }),
  'master.deleted': defineEvent({
    objectType: GENERIC_MASTER_TYPE,
    category: 'master_data',
    status: 'wired',
    before: masterState,
    after: z.null(),
    forMasterShape: (shape) => ({ before: shape, after: z.null() }),
    describe: (before, after, objectType) => describeMasterChange(objectType, before, after),
  }),

  // ---- Wired in STORY-06.06: an estimate approved and locked -------------------------------------------------------------------
  // One entry, in the approval's own transaction (under the estimate's row lock): the price the Lead set, the calculated total (BL) it was set against, the approver's name and whether the price is an
  // override (STORY-06.07 AC-2). The log is Admin-only (architecture section 5.3), so it may keep the price. The reason is the override entry's, below.
  'approval.approved': defineEvent({
    objectType: 'estimate',
    category: 'approval',
    status: 'wired',
    before: z.null(),
    after: approvedState,
    describe: (_before, after) => ({
      before: 'Not approved',
      after: `Approved at ${formatRupees(after.approvedPrice)}, the calculated total was ${formatRupees(after.calculatedTotal)}, by ${after.approver}`,
    }),
  }),
  // A price that differs from the calculated total (STORY-06.07 AC-2, AC-3; FR-103, D-18): a second entry in the approval's own transaction, so an override cannot be written without its approval and an approval
  // cannot be an override without this entry. It holds the reason the Lead gave, if any, and it is the one the "Price override" filter finds.
  'approval.price_overridden': defineEvent({
    objectType: 'estimate',
    category: 'price_override',
    status: 'wired',
    before: overriddenBefore,
    after: overriddenAfter,
    describe: describeOverride,
  }),

  // ---- Wired in STORY-06.08: an approved estimate unlocked --------------------------------------------------------------------
  // One entry, in the unlock's own transaction (under the estimate's row lock): the price the approval stood at, the status the estimate left (Approved or Quoted) and the reason. The price stays on record after the unlock (it is "approved earlier" until a new approval
  // replaces it). Who unlocked and when are the entry's own columns. The words follow the "Approval cancelled" entry of SCR-16 ("Approved at ₹ 4,750.00 to Cancelled. Reason: …"; assumption of STORY-06.08).
  'approval.unlocked': defineEvent({
    objectType: 'estimate',
    category: 'unlock',
    status: 'wired',
    before: unlockedBeforeState,
    after: unlockedAfterState,
    readBefore: unlockedBeforeRead,
    describe: (before, after) => ({ before: describeUnlockedFrom(before), after: `Unlocked. Reason: ${after.reason}` }),
  }),

  // ---- Wired in STORY-06.12: an approval cancelled by the Admin ---------------------------------------------------------------
  // One entry, in the cancel's own transaction (under the estimate's row lock): the price the approval stood at, the Admin's reason and the status before and after (equal for an approval kept through an unlock,
  // AC-10). The price stays on record even after the Admin removes it from the screens (STORY-06.13). The log is Admin-only (architecture section 5.3).
  'approval.cancelled': defineEvent({
    objectType: 'estimate',
    category: 'approval_cancelled',
    status: 'wired',
    before: cancelledBeforeState,
    after: cancelledAfterState,
    readBefore: cancelledBeforeRead,
    readAfter: cancelledAfterRead,
    describe: describeCancelled,
  }),

  // ---- Wired in STORY-06.13: the price of a cancelled approval removed by the Admin -------------------------------------------
  // One entry, in the removal's own transaction (under the estimate's row lock): **the price that was removed**, which this entry alone keeps once it is off every screen and out of the file (FR-108; architecture
  // section 4.10: erasing it here would break NFR-007). The log is Admin-only (architecture section 5.3). Who removed it and when are the entry's own columns.
  'approval.price_removed': defineEvent({
    objectType: 'estimate',
    category: 'price_removed',
    status: 'wired',
    before: removedBeforeState,
    after: removedAfterState,
    describe: describeRemoved,
  }),

  // ---- Wired in STORY-08.02: a formula of the field registry changed --------------------------------------------------------------
  // One entry, in the transaction that stores the new configuration version: the formula as the Admin read it before and after (display form, column letters and rate names) and the number of the version it made.
  // The Object is the field ("AL Cutting Cost"). A formula is Restricted data and the audit log is read by the Admin alone (NFR-002); no figure, rate value or password has a key to sit in.
  'config.formula_changed': defineEvent({
    objectType: 'field',
    category: 'config_change',
    status: 'wired',
    kindLabel: 'Formula edit',
    before: z.strictObject({ formula: z.string().min(1) }),
    after: z.strictObject({ formula: z.string().min(1), version: z.number().int().positive() }),
    describe: (before, after) => ({ before: before.formula, after: `${after.formula} (configuration version ${String(after.version)})` }),
  }),

  // ---- Wired in STORY-08.03: a field or a pair inserted into the field registry --------------------------------------------------
  // One entry per insert, in the transaction that stores the new configuration version: the new column or columns (letter, label, kind, the column each follows), the formula typed for an output, and which
  // columns moved, as runs of their old letters. The Object is the first new field ("AY Notch Cost"). The log is read by the Admin alone (NFR-002); no password (an insert asks for none, FR-080), figure or rate
  // value has a key to sit in. Before is empty: the field did not exist.
  'config.field_inserted': defineEvent({
    objectType: 'field',
    category: 'config_change',
    status: 'wired',
    kindLabel: 'Field insert',
    before: z.null(),
    after: insertedAfterState,
    describe: (_before, after) => ({ before: describeInsertBefore(after), after: describeInsertAudit(after) }),
  }),

  // ---- Wired in STORY-08.04: a field deleted from the field registry --------------------------------------------------------------
  // One entry per delete, in the transaction that stores the new configuration version: the column as it was (letter, label, kind, and the formula of an output in display form), and which columns moved to
  // the left, as runs of their old letters. The Object is the deleted field ("AY Cutting Cost"). The log is read by the Admin alone (NFR-002); no password (the step-up reaches `verifyStepUp` and nowhere
  // else, NFR-004), figure or rate value has a key to sit in.
  'config.field_deleted': defineEvent({
    objectType: 'field',
    category: 'config_change',
    status: 'wired',
    kindLabel: 'Field delete',
    before: deletedBeforeState,
    after: deletedAfterState,
    describe: (before, after) => ({ before: describeDeleteBefore(before), after: describeDeleteAfter(after) }),
  }),

  // ---- Wired in STORY-08.06: the configuration reverted to an earlier version ---------------------------------------------------
  // One entry per revert, in the transaction that stores the new version (a copy of the target's snapshot). The Object is the checkpoint the Admin reverted to ("Checkpoint "Before AY insert""), or the
  // version when the target has no checkpoint name (an undo). Before is the version that was current and after the version it made and the one it copied (UX-19: "Version 8 to Version 9 (from version 7)").
  // The version numbers are all it keeps: no formula, figure or password has a key to sit in (NFR-002, NFR-004). Saving a checkpoint is not an event (decision D-1 of the story): nothing changed.
  'config.reverted': defineEvent({
    objectType: 'config_version',
    category: 'config_change',
    kindLabel: 'Checkpoint revert',
    status: 'wired',
    before: revertedBeforeState,
    after: revertedAfterState,
    describe: (before, after) => ({ before: describeRevertBefore(before), after: describeRevertAfter(after) }),
  }),

  // ---- Declared for later stories: each adds the call, the shapes, the words and the test --------------------------------
  // ---- Wired in STORY-05.12: a Calculate that went ahead past a warning ------------------------------------------------------------
  // The Engineer pressed "Calculate anyway" for rows with a 0 in QTY per Assy. One entry per acknowledged calculation, in the calculation's own transaction, naming each row (code, part, Sl. No and
  // the part's name as typed) and holding no figure: nothing here depends on a master or on a calculated value (NFR-002, architecture sections 4.3 and 8). The actor is the person who pressed.
  'calculation.warning_acknowledged': defineEvent({
    objectType: 'estimate',
    category: 'quantity_warning',
    status: 'wired',
    before: z.null(),
    after: z.strictObject({ warnings: z.array(warnedRow).min(1) }),
    describe: (_before, after) => ({ before: 'No warning', after: `Went ahead with QTY per Assy 0 on ${after.warnings.map(describeWarnedRow).join(', ')}` }),
  }),

  // ---- Wired in CR-01 item 6 (AQP-390): the customer of an estimate changed by a Lead or an Admin ---------------------------------------
  // One entry for one change, in the change's own transaction under the estimate's row lock: the customer (name and short name, company names and not personal data) before and after, null before for an
  // estimate made before CR-01 that had none. The object is the task's code, the actor the Lead or the Admin who changed it. The same customer again writes no entry. No figure and no rate has a key to sit in (NFR-002).
  'estimate.customer_changed': defineEvent({
    objectType: 'estimate',
    category: 'task_change',
    status: 'wired',
    before: estimateCustomerState,
    after: estimateCustomerState,
    describe: (before, after) => ({ before: describeEstimateCustomer(before), after: describeEstimateCustomer(after) }),
  }),

  // ---- Wired in CR-01 item 7C (AQP-400): an approved estimate marked as quoted by a Lead or an Admin -----------------------------------
  // One entry for one mark, in the mark's own transaction under the estimate's row lock: the status before (APPROVED, the only status the machine marks from) and after (QUOTED), and nothing else. The object is the
  // task's code and the actor the Lead or the Admin who pressed. A refusal (a second press, a Draft, a Prepared or an ignored estimate) writes no entry. No figure has a key to sit in (NFR-002, NFR-007).
  'estimate.quoted': defineEvent({
    objectType: 'estimate',
    category: 'task_change',
    status: 'wired',
    before: z.strictObject({ status: z.literal('APPROVED') }),
    after: z.strictObject({ status: z.literal('QUOTED') }),
    describe: () => ({ before: 'Approved', after: 'Quoted' }),
  }),

  // ---- Wired in CR-01 item 7D (AQP-401): an estimate ignored, and restored ------------------------------------------------------------
  // One entry for each, in the change's own transaction under the estimate's row lock. Ignore keeps the status underneath (the layer does not change it) before, and the status with the Lead's remarks after. Restore
  // keeps the Ignore remarks before (they stay on record after the layer is cleared) and the status after: Restore has no remarks of its own (the product-manager, FR-109). The object is the task's code and the actor
  // the Lead or the Admin who pressed. A refusal writes no entry. No figure has a key to sit in (NFR-002, NFR-007).
  'estimate.ignored': defineEvent({
    objectType: 'estimate',
    category: 'task_change',
    status: 'wired',
    before: ignoredStatusState,
    after: ignoredRemarksState,
    describe: (before, after) => ({ before: describeStatus(before.status), after: `Ignored. Remarks: ${after.remarks}` }),
  }),
  'estimate.restored': defineEvent({
    objectType: 'estimate',
    category: 'task_change',
    status: 'wired',
    before: ignoredRemarksState,
    after: ignoredStatusState,
    describe: (before, after) => ({ before: `Ignored. Remarks: ${before.remarks}`, after: describeStatus(after.status) }),
  }),

  // ---- Wired in STORY-04.07: a task given to another Engineer, a new deadline, or both ----------------------------------------------
  // One entry for one save (decision D-g), in the change's own transaction under the task's and the estimate's row locks: the Engineer (ID and name) and the deadline before and after. The actor is the Lead or
  // the Admin who saved; the object is the task code. A save that changed nothing writes no entry.
  'task.reassigned': defineEvent({
    objectType: 'task',
    category: 'task_change',
    status: 'wired',
    before: assignmentState,
    after: assignmentState,
    describe: describeReassigned,
  }),

  // ---- Wired in DEF-131 stage 2: a Lead or an Admin changes a part's inputs or picture, or the tree --------------------------------------------
  // Written only when the person who writes is a Lead or an Admin (an Engineer's own writes are not audited), in the write's own transaction under the estimate's row lock, so the write fails when the entry cannot be
  // written. The object is the estimate, labelled with the task code. A write that changes nothing writes no entry. The picture goes through `estimate.inputs_changed` as the Part Model field, with the words
  // "Picture added", "Picture replaced" or "Picture removed" and never its bytes or its file name.
  'estimate.inputs_changed': defineEvent({
    objectType: 'estimate',
    category: 'input_change',
    status: 'wired',
    before: inputsBefore,
    after: inputsAfter,
    describe: (before, after) => ({ before: describeInputFields(before), after: describeInputFields(after) }),
  }),
  'estimate.part_added': defineEvent({
    objectType: 'estimate',
    category: 'input_change',
    status: 'wired',
    before: z.strictObject({}),
    after: partAddedAfter,
    describe: (_before, after) => ({
      before: NO_DETAIL.before,
      after: `Added ${NODE_KIND_NAMES[after.part.kind]} ${after.part.slNo} ${after.parent === null ? 'at the top' : `under ${describeRow(after.parent)}`}`,
    }),
  }),
  'estimate.part_moved': defineEvent({
    objectType: 'estimate',
    category: 'input_change',
    status: 'wired',
    before: partMovedBefore,
    after: partMovedAfter,
    describe: (before, after) => ({ before: describeRow(before.part), after: `Moved ${describeRow(before.part)} to ${after.part.slNo}` }),
  }),
  'estimate.part_deleted': defineEvent({
    objectType: 'estimate',
    category: 'input_change',
    status: 'wired',
    before: partDeletedBefore,
    after: partDeletedAfter,
    describe: (before) => ({ before: describeRowsDeleted(before), after: `Deleted ${describeRowsDeleted(before)}` }),
  }),
} as const;

export type AuditEventName = keyof typeof AUDIT_EVENTS;

/** What a caller must give for an event: the two values, in the form its schemas accept. */
export interface AuditEventPayload<E extends AuditEventName> {
  readonly before: z.input<(typeof AUDIT_EVENTS)[E]['before']>;
  readonly after: z.input<(typeof AUDIT_EVENTS)[E]['after']>;
}

const EVENT_NAMES: ReadonlyArray<string> = Object.keys(AUDIT_EVENTS);

export function isAuditEventName(value: string): value is AuditEventName {
  return EVENT_NAMES.includes(value);
}

/** Every registered event name, in registry order. */
export function auditEventNames(): ReadonlyArray<AuditEventName> {
  return EVENT_NAMES.filter(isAuditEventName);
}

/** The registered events of a category, for the Event filter. */
export function eventsInCategory(category: AuditCategoryId): ReadonlyArray<AuditEventName> {
  return auditEventNames().filter((name) => AUDIT_EVENTS[name].category === category);
}

/** The events that have code behind them and a test, in registry order. */
export function wiredEvents(): ReadonlyArray<AuditEventName> {
  return auditEventNames().filter((name) => AUDIT_EVENTS[name].status === 'wired');
}
