import { z } from 'zod';

import type { AuditCategoryId } from '../../lib/audit/categories';
import { roleLabel } from '../../lib/auth/roles';
import { EXCHANGE_RATE_FIELDS, EXCHANGE_RATE_LABELS } from '../../lib/masters/exchange-rates';
import { MATERIAL_FIELD_LABELS } from '../../lib/masters/materials';
import { formatDefaultValue, RUPEE, unitLabel } from '../../lib/masters/process-items';
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
  readonly before: Before;
  readonly after: After;
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
      const parsedBefore = definition.before.safeParse(before);
      const parsedAfter = definition.after.safeParse(after);
      return parsedBefore.success && parsedAfter.success ? definition.describe(parsedBefore.data, parsedAfter.data, objectType ?? definition.objectType) : null;
    },
  };
}

// ---- Shapes of the user events (SCR-16 "User change") ----------------------------------------------------------------------
// A name and an e-mail address are not kept here: the entry's label is the person's name at that moment, the object ID says which
// person, and an e-mail address is personal data the log has no use for (data minimisation).

const userRole = z.enum(USER_ROLE_VALUES);
const roleState = z.strictObject({ role: userRole });
/** A person's name, which is not a secret and is already the entry's label; the rename event keeps the old and the new one. */
const nameState = z.strictObject({ name: z.string().min(1) });

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
const masterState = z.union([processItemState, materialState, exchangeRateState, treatmentState]);

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

/** An event declared for a later story. Any JSON is accepted until that story gives the event its own shapes. */
const reservedShape = z.json();

function reserved(objectType: string, category: AuditCategoryId) {
  return defineEvent({
    objectType,
    category,
    status: 'reserved',
    before: reservedShape,
    after: reservedShape,
    describe: () => NO_DETAIL,
  });
}

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

  // ---- Declared for later stories: each adds the call, the shapes, the words and the test --------------------------------
  'approval.approved': reserved('estimate', 'approval'),
  'approval.unlocked': reserved('estimate', 'unlock'),
  'approval.price_overridden': reserved('estimate', 'price_override'),
  'calculation.warning_acknowledged': reserved('estimate', 'quantity_warning'),
  'approval.cancelled': reserved('estimate', 'approval_cancelled'),
  'approval.price_removed': reserved('estimate', 'price_removed'),
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

// Reviewer plant Q6 (QLT, AQP-237, round 2): never merged. A Zod record schema, no audit entry. Expected: not visited, no finding.
export const plantedQ6 = z.record(z.string(), z.string());
