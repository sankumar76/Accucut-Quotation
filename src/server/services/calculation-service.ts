import { z } from 'zod';

import { Decimal } from '../../lib/decimal';
import { CalculateBlockedError, ConflictError, FieldValidationError, NotFoundError, type FieldProblem } from '../../lib/errors';
import {
  CALCULATE_MESSAGE,
  CALCULATE_SUBMITTED_STATUS,
  CUSTOMER_NOT_CHOSEN_CODE,
  CUSTOMER_NOT_CHOSEN_MESSAGE,
  NO_PARTS_CODE,
  NO_PARTS_MESSAGE,
} from '../../lib/estimate/calculate-words';
import { CalculateAckRequiredError } from '../../lib/estimate/calculate-ack-required-error';
import { calculateProductTotals, type ProductTotals } from '../../lib/estimate/product-totals';
import { quantityFieldIdOf, quantityWarnings, type QuantityWarning } from '../../lib/estimate/quantity-warnings';
import { QTY_ZERO_CODE } from '../../lib/estimate/warning-copy';
import { calculateRowOutputs } from '../../lib/estimate/row-calculator';
import { storeRowOutputs, type RowOutputs } from '../../lib/estimate/row-outputs';
import { TRANSITION_REFUSALS } from '../../lib/estimate/state-machine';
import { buildTree } from '../../lib/estimate/tree';
import { validateForCalculate, type CheckedPart } from '../../lib/estimate/calculate-check';
import { findFieldById, findFieldByKey } from '../../lib/fields/registry';
import type { ConfigDocument } from '../../lib/fields/schema';
import { MATERIAL_CONSIDERED_KEY, MATERIAL_IN_DRAWING_KEY } from '../../lib/fields/types';
import { createPlanCache, type PlanCache } from '../../lib/formula';
import type { CalculationRepository, NewCalculationRow, StoredValues } from '../repositories/calculation-repository';
import type { EstimateNodeRepository } from '../repositories/estimate-node-repository';
import type { EstimateCalculationStorage } from '../repositories/estimate-repository';
import type { MaterialValuesRecord } from '../repositories/master-repository';
import type { TransactionRunner, Transaction } from '../repositories/transaction';

import type { AuditContext, AuditService } from './audit-service';
import { readMasters, type CalculationMasters } from './calculation-masters';
import type { EstimateService, EstimateViewer } from './estimate-service';

const NOT_FOUND_MESSAGE = 'The customer or the material was not found.';

/**
 * The calculation service (STORY-03.03 and 03.04; FR-024, FR-028 to FR-030; architecture sections 4.1 and 4.2). It holds the one thing the
 * rest is built on: `calculateRow` works out one node's calculated fields, M to BK, and `calculateEstimate` works out every row of an
 * estimate and then its product totals (BL, BN and the total Tool Cost), from the masters as they are now. `calculate` (STORY-05.09) is the Engineer's whole Calculate in one transaction.
 *
 * `storeCalculation` (STORY-03.05; FR-031, NFR-026; ADR-007; architecture section 4.2) is the write half: it works the estimate out as above and stores
 * an immutable record of it, in one transaction with the estimate's new status and its link to that record. The record holds the configuration version,
 * every master value used (with names as they were then), the product figures and a full copy of the tree with each row's inputs (the words for E, F and G
 * resolved) and outputs. It returns the record's ID and time and **no figure**: a caller reads a figure only through `figure-state` (architecture section 4.8).
 * Who may call it is decided before it is reached (`withRoute`, the manifest): the result is **Restricted** (ADR-008, NFR-002) and is never
 * returned to an Engineer. The file is on neither allow-list of the Engineer views, so the lint refuses it there (`eslint.config.mjs`).
 *
 * Everything it reads is a master's current value, as decimal text, and nothing is rounded on the way in. The numbers are `Decimal` from the
 * first operation to the stored text (ADR-005; FR-027): no JavaScript number takes part.
 */

/** The version of the registry to calculate with: its ID (a plan is cached by it) and its parsed document. */
export interface CalculationConfiguration {
  readonly id: string;
  readonly document: ConfigDocument;
}

/** One row of an estimate: which material and what was typed. */
export interface EstimateRowRequest {
  /** The Material Master row for the part's Material in Drawing (E). The hidden "Not applicable" row is allowed. */
  readonly materialId: string;
  /** The typed numbers and flags by field ID, as plain decimal text. One that is absent counts as 0 (see `row-calculator.ts`). */
  readonly inputs: Readonly<Record<string, string>>;
}

/** What one row's calculation needs from the caller: whose rates, which material, and what was typed. */
export interface RowCalculationRequest extends EstimateRowRequest {
  readonly customerId: string;
}

/** An estimate: the customer whose rates apply, and every row of it, in any order. */
export interface EstimateCalculationRequest {
  readonly customerId: string;
  readonly rows: ReadonlyArray<EstimateRowRequest>;
}

/** The outputs of each row, in the order the rows were given, and the totals of the estimate. */
export interface EstimateCalculation {
  readonly rows: ReadonlyArray<RowOutputs>;
  readonly totals: ProductTotals;
}

/** One node of the tree to store: what `calculateRow` needs, and the position and words the record keeps with it. */
export interface CalculationNodeRequest extends EstimateRowRequest {
  /** The node's ID. Kept as a plain UUID in the record, with no foreign key: a node deleted later must not break it (assumption A-1 of the story). */
  readonly nodeId: string;
  readonly parentId: string | null;
  /** The position among its siblings. */
  readonly sortIndex: number;
  /** The derived Sl. No as text, for example `1.2`. */
  readonly slNo: string;
  readonly imageId: string | null;
  /**
   * The words of the other typed fields by field ID: the text of Treatment / Color (G), Remarks. Kept as they are. Material in Drawing (E) and Material
   * Considered (F) are not given here: the service writes them from the Material Master row it reads, so no caller can store words that differ from it.
   */
  readonly texts: Readonly<Record<string, string>>;
}

export interface StoreCalculationRequest {
  readonly estimateId: string;
  /** The person who pressed Calculate. */
  readonly createdById: string;
  /** The estimate's `inputs_revision` at the moment its nodes were read. The record is refused if the estimate has moved on since (409). */
  readonly inputsRevision: number;
  readonly nodes: ReadonlyArray<CalculationNodeRequest>;
  /** The warnings the person acknowledged for this calculation (STORY-05.12), kept on the record as text. Absent is none. */
  readonly warnings?: ReadonlyArray<QuantityWarning>;
}

/** What a store gives back: which record and when. No figure (the Engineer's Calculate answers with a status and a message only, STORY-05.09). */
export interface StoredCalculation {
  readonly id: string;
  readonly createdAt: Date;
}

export interface CalculationService {
  /** One node's outputs M to BK. Throws `FieldValidationError` for a typed value that is not a number, `NotFoundError` for an unknown customer or material. */
  calculateRow(request: RowCalculationRequest): Promise<RowOutputs>;
  /** Every row's outputs, then BL, BN and the total Tool Cost. The same errors; a typed value is named with its row, `rows[1].<field ID>`. */
  calculateEstimate(request: EstimateCalculationRequest): Promise<EstimateCalculation>;
  /**
   * Works the estimate out from the masters as they are now and stores the record, the estimate's status (DRAFT becomes SUBMITTED) and its link to the record,
   * all or nothing. Every press writes a new record (history is kept). Pass `tx` to run in the caller's transaction (STORY-05.09 locks, validates and stores
   * in one); without it the service opens its own. Throws `NotFoundError` (unknown estimate, customer or material), `ConflictError` (approved estimate,
   * no customer, or `inputsRevision` out of date) and `FieldValidationError` (a value that is not valid), each before anything is written.
   */
  storeCalculation(request: StoreCalculationRequest, tx?: Transaction): Promise<StoredCalculation>;
  /**
   * The Engineer's Calculate (`POST /api/v1/estimates/{id}/calculate`, STORY-05.09; architecture section 4.2), in **one transaction** under the estimate's row lock: the state machine decides
   * (`transition(viewer, id, 'CALCULATE', tx)`: 404 for another Engineer's estimate, 403 for a Lead or an Admin (the route's role list refuses them first), 409 for a status that is not DRAFT), every part is checked for missing inputs
   * (422 `CALCULATE_BLOCKED`, which lists parts and fields and writes nothing), the customer must be chosen (409), the masters are read, the record is stored (`storeCalculation`'s work, with the
   * configuration read once for the check and the calculation) and the status is SUBMITTED, all or nothing. It answers `{status, message}`: **no number from the calculation leaves it** (NFR-002).
   *
   * **The quantity warning (STORY-05.12; architecture section 4.3).** After the 422 and the customer check, and before any master is read, every row with 0 in QTY per Assy is listed. With one or more, the
   * request must carry `options.acknowledge.inputsRevision` equal to the estimate's revision under the lock; otherwise it is the 409 `CALCULATE_ACK_REQUIRED` (`CalculateAckRequiredError`, the current
   * revision and list), and **nothing is written**. A good acknowledgement stores the list on the calculation (`calculations.warnings`) and writes one audit entry, `calculation.warning_acknowledged`,
   * in the same transaction, naming the rows and holding no figure. With nothing to warn, `acknowledge` is ignored.
   */
  calculate(viewer: EstimateViewer, estimateId: string, options?: CalculateOptions): Promise<CalculateAnswer>;
  /**
   * A Lead's or an Admin's Recalculate (`POST /api/v1/estimates/{id}/recalculate`, STORY-06.04; FR-061; architecture sections 4.2, 4.4 and 4.8): **the same work as `calculate`, not a second path**, in one
   * transaction under the estimate's row lock, with the state machine's `RECALCULATE` event in place of `CALCULATE`. It makes a new immutable record from the masters as they are now, in the person's name, and links
   * it, so the figures are `current` again. A DRAFT (unlocked) estimate becomes SUBMITTED, a SUBMITTED one stays so (the machine decides), an APPROVED one is the 409 `ESTIMATE_APPROVED_IS_LOCKED` and
   * nothing is written. The checks and their order, the 422 `CALCULATE_BLOCKED`, the 409 for a customer not chosen, the quantity warning and its acknowledgement are `calculate`'s own. It answers nothing: the
   * route reads the costs view afterwards, through the figure state, so no figure leaves this service (NFR-002). A role the machine does not allow is refused before the estimate's status is looked at.
   */
  recalculate(viewer: EstimateViewer, estimateId: string, options?: CalculateOptions): Promise<void>;
}

/** The two events that make a calculation: the Engineer's first Calculate and a Lead's or an Admin's Recalculate (`state-machine.ts`). */
type CalculateEvent = 'CALCULATE' | 'RECALCULATE';

/** What a press of Calculate may carry besides who pressed: the acknowledgement of a warning, and who and which request the audit entry of it names. */
export interface CalculateOptions {
  /** The `inputsRevision` of the 409 the person saw and chose to go ahead past. Read for a number by the route's schema; compared with the estimate's under its lock. */
  readonly acknowledge?: { readonly inputsRevision: number } | undefined;
  /** Who pressed and on which request, for the audit entry of an acknowledged warning (`actorLabel` is their name now). Always given by the route. */
  readonly audit?: AuditContext | undefined;
}

/** The whole of an Engineer's good Calculate: the estimate's new status and the fixed sentence (FR-056). Nothing else, whatever the estimate costs. */
export interface CalculateAnswer {
  readonly status: typeof CALCULATE_SUBMITTED_STATUS;
  readonly message: typeof CALCULATE_MESSAGE;
}

export interface CalculationServiceDependencies {
  readonly masters: CalculationMasters;
  /** The registry version in force, read on each calculation. Takes the caller's transaction, so a read under the estimate's lock takes no second connection (review SQR-01 of AQP-293). */
  readonly currentConfiguration: (tx?: Transaction) => Promise<CalculationConfiguration>;
  /** Compiled plans by version. A test passes its own to count compiles; the default is one cache for the service. */
  readonly plans?: PlanCache;
  /**
   * Where a record is stored (STORY-03.05). Optional so the calculation alone (`calculateRow`, `calculateEstimate`) needs no database; `storeCalculation` on a
   * service built without it fails at once with a plain `Error`, a programming fault and never a user's, so it cannot be mistaken for a refusal.
   */
  readonly storage?: {
    readonly calculations: CalculationRepository;
    /** The estimate is locked, read and linked through its own repository (STORY-05.01's), so there is one lock on one row for every writer. */
    readonly estimates: EstimateCalculationStorage;
    readonly transactions: TransactionRunner;
  };
  /**
   * What `calculate` needs besides storage (STORY-05.09): the parts of the estimate, and the estimate service's `transition`, which decides role, ownership and status in the caller's transaction
   * (review of STORY-06.01), so the check is the state machine's and written once. Optional for the same reason as `storage`.
   */
  readonly workflow?: {
    readonly nodes: Pick<EstimateNodeRepository, 'listNodes'>;
    readonly transition: EstimateService['transition'];
    /** Where an acknowledged warning is recorded, in the calculation's own transaction (STORY-05.12). */
    readonly audit: AuditService;
  };
}

/** Digits, then optionally a point and digits: no sign, no exponent, no separator (architecture section 8, "the API accepts plain decimals only"). */
const TYPED_NUMBER_PATTERN = /^\d{1,12}(?:\.\d+)?$/;
const NOT_A_NUMBER_MESSAGE = 'Enter a number with digits only, for example 12.5.';
const NOT_A_NUMBER_FIELD_MESSAGE = 'This field does not take a typed number.';

/** True for the fields a person types a number or a flag into: the only ones a row calculation reads from the request. */
function takesTypedNumber(document: ConfigDocument, fieldId: string): boolean {
  const field = findFieldById(document, fieldId);
  return field?.kind === 'input' && (field.dataType === 'number' || field.dataType === 'flag');
}

/** The typed values as `Decimal`, or the 422 that names every value that is not a number. Checked before anything is read. */
function parseInputs(document: ConfigDocument, inputs: Readonly<Record<string, string>>, prefix: string): Map<string, Decimal> {
  const problems: FieldProblem[] = [];
  const parsed = new Map<string, Decimal>();
  for (const [fieldId, text] of Object.entries(inputs)) {
    if (!takesTypedNumber(document, fieldId)) problems.push({ field: `${prefix}${fieldId}`, message: NOT_A_NUMBER_FIELD_MESSAGE });
    else if (!TYPED_NUMBER_PATTERN.test(text)) problems.push({ field: `${prefix}${fieldId}`, message: NOT_A_NUMBER_MESSAGE });
    else parsed.set(fieldId, new Decimal(text));
  }
  if (problems.length > 0) throw new FieldValidationError(problems);
  return parsed;
}

const ESTIMATE_NOT_FOUND_MESSAGE = 'The estimate was not found.';
const NOT_VALID_MESSAGE = 'This value is not valid.';
const TEXT_NOT_ALLOWED_MESSAGE = 'This field does not take typed text.';
const INPUTS_CHANGED_MESSAGE = 'The estimate changed while it was being calculated. Calculate again.';

/** Longest typed text a record keeps for one field. A generous bound (Remarks is the longest), so a record cannot be made enormous by one value. */
const MAX_TEXT_LENGTH = 5_000;
const MAX_SL_NO_LENGTH = 100;

/** The shape of a request, before the configuration is read. Strict, so a key that is not part of the request is refused, not stored. */
const STORE_REQUEST = z.strictObject({
  estimateId: z.uuid(),
  createdById: z.uuid(),
  inputsRevision: z.number().int().min(0),
  nodes: z.array(
    z.strictObject({
      nodeId: z.uuid(),
      parentId: z.uuid().nullable(),
      sortIndex: z.number().int().min(0),
      slNo: z.string().regex(/\S/).max(MAX_SL_NO_LENGTH),
      imageId: z.uuid().nullable(),
      materialId: z.string(),
      inputs: z.record(z.string(), z.string()),
      texts: z.record(z.string(), z.string().max(MAX_TEXT_LENGTH)),
    }),
  ),
  warnings: z.array(z.strictObject({ code: z.literal(QTY_ZERO_CODE), nodeId: z.uuid(), slNo: z.string().regex(/\S/).max(MAX_SL_NO_LENGTH), label: z.string().max(MAX_TEXT_LENGTH) })).optional(),
});

/** A path as the API names a field: `nodes[2].slNo`. */
const pathOf = (path: ReadonlyArray<PropertyKey>): string =>
  path.reduce<string>((text, part) => (typeof part === 'number' ? `${text}[${part}]` : text === '' ? String(part) : `${text}.${String(part)}`), '');

/** The 422 for a request that is malformed, naming each field at fault and never echoing a value. Also refuses two nodes with the same ID. */
function checkStoreRequest(request: StoreCalculationRequest): void {
  const parsed = STORE_REQUEST.safeParse(request);
  const problems: FieldProblem[] = parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({ field: pathOf(issue.path), message: NOT_VALID_MESSAGE }));
  const seen = new Set<string>();
  request.nodes.forEach((node, index) => {
    if (seen.has(node.nodeId)) problems.push({ field: `nodes[${index}].nodeId`, message: NOT_VALID_MESSAGE });
    seen.add(node.nodeId);
  });
  if (problems.length > 0) throw new FieldValidationError(problems);
}

/**
 * The field IDs a node's words may be given for: an input that is neither a number nor a flag (those are typed numbers) and is not Material in Drawing (E),
 * which the service writes from the master. Anything else is a 422 under the field, so a stored record holds only fields the registry has.
 */
function checkTexts(document: ConfigDocument, texts: Readonly<Record<string, string>>, prefix: string): void {
  const materialField = findFieldByKey(document, MATERIAL_IN_DRAWING_KEY);
  const problems = Object.keys(texts)
    .filter((fieldId) => {
      const field = findFieldById(document, fieldId);
      return field?.kind !== 'input' || takesTypedNumber(document, fieldId) || field.dataType === 'image' || field.id === materialField?.id;
    })
    .map((fieldId): FieldProblem => ({ field: `${prefix}${fieldId}`, message: TEXT_NOT_ALLOWED_MESSAGE }));
  if (problems.length > 0) throw new FieldValidationError(problems);
}

/** A row's `inputs` as stored: the typed numbers and flags as typed, the words given, and the words of E and F from the material read (resolved text, NFR-026). */
function storedInputs(document: ConfigDocument, node: CalculationNodeRequest, material: MaterialValuesRecord): StoredValues {
  const resolved: Record<string, string | null> = {};
  const materialField = findFieldByKey(document, MATERIAL_IN_DRAWING_KEY);
  const consideredField = findFieldByKey(document, MATERIAL_CONSIDERED_KEY);
  if (materialField !== undefined) resolved[materialField.id] = material.materialInDrawing;
  if (consideredField !== undefined) resolved[consideredField.id] = material.materialConsidered;
  return { ...node.inputs, ...node.texts, ...resolved };
}

export function createCalculationService(dependencies: CalculationServiceDependencies): CalculationService {
  const { masters, currentConfiguration, plans = createPlanCache(), storage, workflow } = dependencies;

  /**
   * Every row, then the totals, from one configuration version (the caller's, or the one in force now). `prefixOf` names a row in a validation problem:
   * nothing for a single row, `rows[n].` for an estimate. Also returns what was read, because a stored record is made from the very values used.
   */
  async function run(request: EstimateCalculationRequest, prefixOf: (index: number) => string, configuration?: CalculationConfiguration, tx?: Transaction) {
    const { id, document } = configuration ?? (await currentConfiguration(tx));
    const typed = request.rows.map((row, index) => ({ materialId: row.materialId, inputs: parseInputs(document, row.inputs, prefixOf(index)) }));
    const values = await readMasters(masters, request.customerId, [...new Set(typed.map((row) => row.materialId))], tx);
    const plan = plans.get(id, document.fields);
    const calculated = typed.map(({ materialId, inputs }) => {
      const material = values.materials.get(materialId);
      if (material === undefined) throw new NotFoundError(NOT_FOUND_MESSAGE);
      return { inputs, outputs: calculateRowOutputs({ document, plan, inputs, rates: values.rates, material, exchange: values.exchange }) };
    });
    return { values, calculated, totals: calculateProductTotals({ document, plan, rows: calculated }) };
  }

  async function calculate(request: EstimateCalculationRequest, prefixOf: (index: number) => string): Promise<EstimateCalculation> {
    const { calculated, totals } = await run(request, prefixOf);
    return { rows: calculated.map((row) => row.outputs), totals };
  }

  /** The write, in the caller's transaction. The estimate is locked first and everything is read and checked before the first insert. */
  async function store(
    { calculations, estimates }: NonNullable<CalculationServiceDependencies['storage']>,
    request: StoreCalculationRequest,
    tx: Transaction,
    known?: CalculationConfiguration,
  ): Promise<StoredCalculation> {
    const estimate = await estimates.lockEstimate(request.estimateId, tx);
    if (estimate === null) throw new NotFoundError(ESTIMATE_NOT_FOUND_MESSAGE);
    // One code and one sentence for "approved" on this path: the state machine's (review SQR-06 of STORY-06.01), so a client and a test learn one.
    if (estimate.status === 'APPROVED') throw new ConflictError(TRANSITION_REFUSALS.APPROVED_IS_LOCKED.message, { code: TRANSITION_REFUSALS.APPROVED_IS_LOCKED.code });
    if (estimate.customerId === null) throw new ConflictError(CUSTOMER_NOT_CHOSEN_MESSAGE, { code: CUSTOMER_NOT_CHOSEN_CODE });
    if (estimate.inputsRevision !== request.inputsRevision) throw new ConflictError(INPUTS_CHANGED_MESSAGE, { code: 'INPUTS_CHANGED' });

    // One configuration for the checks and the calculation: a version published in between must not split them. A caller that already read one for its own checks passes it
    // (`calculate`), and it is read in the transaction, so it takes no second connection (review SQR-01 of AQP-293).
    const configuration = known ?? (await currentConfiguration(tx));
    request.nodes.forEach((node, index) => checkTexts(configuration.document, node.texts, `nodes[${index}].texts.`));
    const { values, calculated, totals } = await run({ customerId: estimate.customerId, rows: request.nodes }, (index) => `nodes[${index}].inputs.`, configuration, tx);

    const rows = request.nodes.map((node, index): NewCalculationRow => {
      const material = values.materialRecords.get(node.materialId);
      const outputs = calculated[index]?.outputs;
      if (material === undefined || outputs === undefined) throw new NotFoundError(NOT_FOUND_MESSAGE);
      return {
        nodeId: node.nodeId,
        parentId: node.parentId,
        sortIndex: node.sortIndex,
        slNo: node.slNo,
        inputs: storedInputs(configuration.document, node, material),
        imageId: node.imageId,
        outputs: storeRowOutputs(outputs),
      };
    });

    const stored = await calculations.insertCalculation(
      {
        estimateId: estimate.id,
        configVersionId: configuration.id,
        inputsRevision: estimate.inputsRevision,
        masterSnapshot: values.snapshot,
        productValues: {
          totalPrice: totals.totalPrice?.toString() ?? null,
          pricePerToolCost: totals.pricePerToolCost?.toString() ?? null,
          toolCostTotal: totals.toolCostTotal?.toString() ?? null,
        },
        warnings: request.warnings ?? [],
        createdById: request.createdById,
      },
      rows,
      tx,
    );
    // A first Calculate submits the estimate; a later one leaves the status as it is (architecture section 4.4).
    await estimates.linkCalculation(estimate.id, stored.id, estimate.status === 'DRAFT' ? 'SUBMITTED' : estimate.status, tx);
    return stored;
  }

  /**
   * The parts of the estimate in reading order, checked for missing inputs. A tree with no part is a 409 (`NO_PARTS`: nothing to calculate, and an immutable record of nothing must not be
   * made), a part with a missing input is the 422 that names it, and a part that cannot be reached from the top is a fault in the data (a plain `Error`, a 500 with fixed words).
   */
  async function checkedPartsOf(nodes: NonNullable<CalculationServiceDependencies['workflow']>['nodes'], estimateId: string, document: ConfigDocument, tx: Transaction) {
    const records = await nodes.listNodes(estimateId, tx);
    if (records.length === 0) throw new ConflictError(NO_PARTS_MESSAGE, { code: NO_PARTS_CODE });
    const entries = buildTree(records);
    if (entries.length !== records.length) throw new Error('A part of the estimate cannot be reached from the top of its tree.');
    const check = validateForCalculate(
      entries.map(({ node, slNo }) => ({ id: node.id, slNo, inputs: node.inputs })),
      document,
    );
    if (!check.ok) throw new CalculateBlockedError(check.parts);
    return entries.map(({ node }, index): CalculationNodeRequest => {
      const part: CheckedPart | undefined = check.parts[index];
      if (part === undefined) throw new Error('The check of the parts returned fewer parts than it was given.');
      return { nodeId: part.id, parentId: node.parentId, sortIndex: node.sortIndex, slNo: part.slNo, imageId: node.imageId, materialId: part.materialId, inputs: part.numbers, texts: part.texts };
    });
  }

  /**
   * The rows with 0 in QTY per Assy that this press must be acknowledged for (STORY-05.12). None is none, and `acknowledge` is then ignored. Some are returned only when the acknowledgement names the
   * revision the estimate has now, **read under the lock**, so an input saved after the 409 (which raised the revision) can never be passed by an acknowledgement given for the list before it; otherwise
   * it is the 409 with the current revision and list. Nothing has been read from the masters at this point, so the 409 cannot depend on one (NFR-002).
   */
  function warningsToAcknowledge(document: ConfigDocument, nodes: ReadonlyArray<CalculationNodeRequest>, revision: number, acknowledge: CalculateOptions['acknowledge']): QuantityWarning[] {
    const quantityId = quantityFieldIdOf(document);
    const warnings = quantityId === undefined ? [] : quantityWarnings(nodes.map((node) => ({ id: node.nodeId, slNo: node.slNo, inputs: { ...node.inputs, ...node.texts } })), document);
    if (quantityId !== undefined && warnings.length > 0 && acknowledge?.inputsRevision !== revision) throw new CalculateAckRequiredError(revision, quantityId, warnings);
    return warnings;
  }

  /**
   * A Calculate or a Recalculate in the caller's transaction: **one path for both** (STORY-06.04). The order is the architecture's (section 4.2): role, ownership and status, then every input, then the
   * customer, then the warning, then the masters. Only the event differs: the Engineer's `CALCULATE`, or the Lead's and the Admin's `RECALCULATE`.
   */
  async function submit(
    { storage: stored, flow }: { readonly storage: NonNullable<CalculationServiceDependencies['storage']>; readonly flow: NonNullable<CalculationServiceDependencies['workflow']> },
    event: CalculateEvent,
    viewer: EstimateViewer,
    estimateId: string,
    tx: Transaction,
    options: CalculateOptions,
  ): Promise<void> {
    // 404 (not this person's, or a role that may not apply the event), 409 (a status that does not allow it), under the estimate's row lock; it also moves the status, and the transaction puts it back if anything below refuses.
    await flow.transition(viewer, estimateId, event, tx);
    const estimate = await stored.estimates.lockEstimate(estimateId, tx);
    if (estimate === null) throw new NotFoundError(ESTIMATE_NOT_FOUND_MESSAGE);
    const configuration = await currentConfiguration(tx);
    const nodes = await checkedPartsOf(flow.nodes, estimate.id, configuration.document, tx);
    if (estimate.customerId === null) throw new ConflictError(CUSTOMER_NOT_CHOSEN_MESSAGE, { code: CUSTOMER_NOT_CHOSEN_CODE });
    const warnings = warningsToAcknowledge(configuration.document, nodes, estimate.inputsRevision, options.acknowledge);
    const request: StoreCalculationRequest = { estimateId: estimate.id, createdById: viewer.id, inputsRevision: estimate.inputsRevision, nodes, warnings };
    checkStoreRequest(request);
    await store(stored, request, tx, configuration);
    if (warnings.length > 0) {
      // The person went ahead past a warning: one entry, in this transaction, naming the rows and no figure. An entry that cannot be written takes the calculation with it.
      if (options.audit === undefined) throw new Error('A warning was acknowledged without the audit context of the request.');
      await flow.audit.record(tx, {
        event: 'calculation.warning_acknowledged',
        ...options.audit,
        object: { id: estimate.id, label: estimate.taskCode },
        before: null,
        after: { warnings: warnings.map(({ code, nodeId, slNo, label }) => ({ code, nodeId, slNo, label })) },
      });
    }
  }

  /** Both presses run the same `submit` in one transaction; they differ in the event and in what they answer. */
  function press(event: CalculateEvent, viewer: EstimateViewer, estimateId: string, options: CalculateOptions): Promise<void> {
    if (storage === undefined || workflow === undefined) throw new Error('This calculation service was built without storage or without the estimate workflow.');
    return storage.transactions.run((tx) => submit({ storage, flow: workflow }, event, viewer, estimateId, tx, options));
  }

  return {
    async calculateRow(request) {
      const [outputs] = (await calculate({ customerId: request.customerId, rows: [request] }, () => '')).rows;
      if (outputs === undefined) throw new Error('A calculation of one row returned none.');
      return outputs;
    },
    calculateEstimate: (request) => calculate(request, (index) => `rows[${index}].`),
    async storeCalculation(request, tx) {
      if (storage === undefined) throw new Error('This calculation service was built without storage.');
      checkStoreRequest(request);
      return tx === undefined ? storage.transactions.run((own) => store(storage, request, own)) : store(storage, request, tx);
    },
    async calculate(viewer, estimateId, options = {}) {
      await press('CALCULATE', viewer, estimateId, options);
      return { status: CALCULATE_SUBMITTED_STATUS, message: CALCULATE_MESSAGE };
    },
    async recalculate(viewer, estimateId, options = {}) {
      await press('RECALCULATE', viewer, estimateId, options);
    },
  };
}
