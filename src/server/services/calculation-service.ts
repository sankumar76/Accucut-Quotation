import { z } from 'zod';

import { Decimal } from '../../lib/decimal';
import { ConflictError, FieldValidationError, NotFoundError, type FieldProblem } from '../../lib/errors';
import { calculateProductTotals, type ProductTotals } from '../../lib/estimate/product-totals';
import { calculateRowOutputs, type ExchangeValues, type MaterialValues } from '../../lib/estimate/row-calculator';
import { storeRowOutputs, type RowOutputs } from '../../lib/estimate/row-outputs';
import { findFieldById, findFieldByKey } from '../../lib/fields/registry';
import type { ConfigDocument } from '../../lib/fields/schema';
import { MATERIAL_CONSIDERED_KEY, MATERIAL_IN_DRAWING_KEY } from '../../lib/fields/types';
import { createPlanCache, type PlanCache, type RateValue } from '../../lib/formula';
import type { CalculationRepository, MasterSnapshot, NewCalculationRow, StoredValues } from '../repositories/calculation-repository';
import type { EstimateRepository } from '../repositories/estimate-repository';
import type { MasterRepository, MaterialValuesRecord } from '../repositories/master-repository';
import type { TransactionRunner, Transaction } from '../repositories/transaction';

/**
 * The calculation service (STORY-03.03 and 03.04; FR-024, FR-028 to FR-030; architecture sections 4.1 and 4.2). It holds the one thing the
 * rest is built on: `calculateRow` works out one node's calculated fields, M to BK, and `calculateEstimate` works out every row of an
 * estimate and then its product totals (BL, BN and the total Tool Cost), from the masters as they are now. The full Calculate flow (a
 * transaction, a locked estimate, the stored record) is STORY-05.09 and its neighbours.
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
}

export interface CalculationServiceDependencies {
  readonly masters: Pick<MasterRepository, 'findCustomer' | 'findMaterialForCalculation' | 'readExchangeRates'>;
  /** The registry version in force, read on each calculation. */
  readonly currentConfiguration: () => Promise<CalculationConfiguration>;
  /** Compiled plans by version. A test passes its own to count compiles; the default is one cache for the service. */
  readonly plans?: PlanCache;
  /**
   * Where a record is stored (STORY-03.05). Optional so the calculation alone (`calculateRow`, `calculateEstimate`) needs no database; `storeCalculation` on a
   * service built without it fails at once with a plain `Error`, a programming fault and never a user's, so it cannot be mistaken for a refusal.
   */
  readonly storage?: {
    readonly calculations: CalculationRepository;
    /** The estimate is locked, read and linked through its own repository (STORY-05.01's), so there is one lock on one row for every writer. */
    readonly estimates: Pick<EstimateRepository, 'lockEstimate' | 'linkCalculation'>;
    readonly transactions: TransactionRunner;
  };
}

/** Digits, then optionally a point and digits: no sign, no exponent, no separator (architecture section 8, "the API accepts plain decimals only"). */
const TYPED_NUMBER_PATTERN = /^\d{1,12}(?:\.\d+)?$/;
const NOT_A_NUMBER_MESSAGE = 'Enter a number with digits only, for example 12.5.';
const NOT_A_NUMBER_FIELD_MESSAGE = 'This field does not take a typed number.';
const NOT_FOUND_MESSAGE = 'The customer or the material was not found.';

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

/** The masters one calculation reads, once: the customer's rates, each distinct material, and the two exchange rates, as numbers and as the text they were stored as. */
interface MasterValues {
  readonly rates: ReadonlyArray<RateValue>;
  readonly materials: ReadonlyMap<string, MaterialValues>;
  readonly exchange: ExchangeValues;
  /** The same values as stored text, with the names then: the master snapshot of a stored record is built from these, so it is what the calculation used. */
  readonly snapshot: MasterSnapshot;
  /** Each material's record, for the words of E and F. */
  readonly materialRecords: ReadonlyMap<string, MaterialValuesRecord>;
}

const decimalOrNull = (text: string | null): Decimal | null => (text === null ? null : new Decimal(text));

async function readMasters(
  masters: CalculationServiceDependencies['masters'],
  customerId: string,
  materialIds: ReadonlyArray<string>,
): Promise<MasterValues> {
  const materials = new Map<string, MaterialValues>();
  const materialRecords = new Map<string, MaterialValuesRecord>();
  const loadMaterials = Promise.all(
    materialIds.map(async (id) => {
      const material = await masters.findMaterialForCalculation(id);
      if (material === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
      materialRecords.set(id, material);
      materials.set(id, {
        pricePerKg: new Decimal(material.pricePerKg),
        specificGravity: new Decimal(material.specificGravity),
        scrapRate: new Decimal(material.scrapRate),
      });
    }),
  );
  const [customer, exchange] = await Promise.all([masters.findCustomer(customerId), masters.readExchangeRates(), loadMaterials]);
  if (customer === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
  return {
    rates: customer.rates.map((rate) => ({ id: rate.processItemId, name: rate.name, value: new Decimal(rate.value) })),
    materials,
    exchange: { usd: decimalOrNull(exchange.usd), eur: decimalOrNull(exchange.eur) },
    materialRecords,
    snapshot: {
      customer: { id: customer.id, name: customer.name },
      rates: customer.rates.map((rate) => ({ id: rate.processItemId, name: rate.name, value: rate.value })),
      // In the order the materials were first used, so the same tree gives the same snapshot.
      materials: materialIds.map((id) => {
        const record = materialRecords.get(id);
        if (record === undefined) throw new NotFoundError(NOT_FOUND_MESSAGE);
        return {
          id: record.id,
          materialInDrawing: record.materialInDrawing,
          materialConsidered: record.materialConsidered,
          pricePerKg: record.pricePerKg,
          specificGravity: record.specificGravity,
          scrapRate: record.scrapRate,
        };
      }),
      exchangeRates: { usd: exchange.usd, eur: exchange.eur },
    },
  };
}

const ESTIMATE_NOT_FOUND_MESSAGE = 'The estimate was not found.';
const NOT_VALID_MESSAGE = 'This value is not valid.';
const TEXT_NOT_ALLOWED_MESSAGE = 'This field does not take typed text.';
const ESTIMATE_APPROVED_MESSAGE = 'The estimate is approved and cannot be calculated again until it is unlocked.';
const CUSTOMER_NOT_CHOSEN_MESSAGE = 'Choose the customer before calculating.';
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
  const { masters, currentConfiguration, plans = createPlanCache(), storage } = dependencies;

  /**
   * Every row, then the totals, from one configuration version (the caller's, or the one in force now). `prefixOf` names a row in a validation problem:
   * nothing for a single row, `rows[n].` for an estimate. Also returns what was read, because a stored record is made from the very values used.
   */
  async function run(request: EstimateCalculationRequest, prefixOf: (index: number) => string, configuration?: CalculationConfiguration) {
    const { id, document } = configuration ?? (await currentConfiguration());
    const typed = request.rows.map((row, index) => ({ materialId: row.materialId, inputs: parseInputs(document, row.inputs, prefixOf(index)) }));
    const values = await readMasters(masters, request.customerId, [...new Set(typed.map((row) => row.materialId))]);
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
  ): Promise<StoredCalculation> {
    const estimate = await estimates.lockEstimate(request.estimateId, tx);
    if (estimate === null) throw new NotFoundError(ESTIMATE_NOT_FOUND_MESSAGE);
    if (estimate.status === 'APPROVED') throw new ConflictError(ESTIMATE_APPROVED_MESSAGE, { code: 'ESTIMATE_APPROVED' });
    if (estimate.customerId === null) throw new ConflictError(CUSTOMER_NOT_CHOSEN_MESSAGE, { code: 'CUSTOMER_NOT_CHOSEN' });
    if (estimate.inputsRevision !== request.inputsRevision) throw new ConflictError(INPUTS_CHANGED_MESSAGE, { code: 'INPUTS_CHANGED' });

    // One configuration for the checks and the calculation: a version published in between must not split them.
    const configuration = await currentConfiguration();
    request.nodes.forEach((node, index) => checkTexts(configuration.document, node.texts, `nodes[${index}].texts.`));
    const { values, calculated, totals } = await run({ customerId: estimate.customerId, rows: request.nodes }, (index) => `nodes[${index}].inputs.`, configuration);

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
        createdById: request.createdById,
      },
      rows,
      tx,
    );
    // A first Calculate submits the estimate; a later one leaves the status as it is (architecture section 4.4).
    await estimates.linkCalculation(estimate.id, stored.id, estimate.status === 'DRAFT' ? 'SUBMITTED' : estimate.status, tx);
    return stored;
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
  };
}
