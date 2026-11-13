import { Decimal } from '../../lib/decimal';
import { FieldValidationError, NotFoundError, type FieldProblem } from '../../lib/errors';
import { calculateProductTotals, type ProductTotals } from '../../lib/estimate/product-totals';
import { calculateRowOutputs, type ExchangeValues, type MaterialValues } from '../../lib/estimate/row-calculator';
import type { RowOutputs } from '../../lib/estimate/row-outputs';
import { findFieldById } from '../../lib/fields/registry';
import type { ConfigDocument } from '../../lib/fields/schema';
import { createPlanCache, type PlanCache, type RateValue } from '../../lib/formula';
import type { MasterRepository } from '../repositories/master-repository';

/**
 * The calculation service (STORY-03.03 and 03.04; FR-024, FR-028 to FR-030; architecture sections 4.1 and 4.2). It holds the one thing the
 * rest is built on: `calculateRow` works out one node's calculated fields, M to BK, and `calculateEstimate` works out every row of an
 * estimate and then its product totals (BL, BN and the total Tool Cost), from the masters as they are now. The full Calculate flow (a
 * transaction, a locked estimate, the stored record) is STORY-05.09 and its neighbours.
 *
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

export interface CalculationService {
  /** One node's outputs M to BK. Throws `FieldValidationError` for a typed value that is not a number, `NotFoundError` for an unknown customer or material. */
  calculateRow(request: RowCalculationRequest): Promise<RowOutputs>;
  /** Every row's outputs, then BL, BN and the total Tool Cost. The same errors; a typed value is named with its row, `rows[1].<field ID>`. */
  calculateEstimate(request: EstimateCalculationRequest): Promise<EstimateCalculation>;
}

export interface CalculationServiceDependencies {
  readonly masters: Pick<MasterRepository, 'findCustomer' | 'findMaterialForCalculation' | 'readExchangeRates'>;
  /** The registry version in force, read on each calculation. */
  readonly currentConfiguration: () => Promise<CalculationConfiguration>;
  /** Compiled plans by version. A test passes its own to count compiles; the default is one cache for the service. */
  readonly plans?: PlanCache;
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

/** The masters one calculation reads, once: the customer's rates, each distinct material, and the two exchange rates. */
interface MasterValues {
  readonly rates: ReadonlyArray<RateValue>;
  readonly materials: ReadonlyMap<string, MaterialValues>;
  readonly exchange: ExchangeValues;
}

const decimalOrNull = (text: string | null): Decimal | null => (text === null ? null : new Decimal(text));

async function readMasters(
  masters: CalculationServiceDependencies['masters'],
  customerId: string,
  materialIds: ReadonlyArray<string>,
): Promise<MasterValues> {
  const materials = new Map<string, MaterialValues>();
  const loadMaterials = Promise.all(
    materialIds.map(async (id) => {
      const material = await masters.findMaterialForCalculation(id);
      if (material === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
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
  };
}

export function createCalculationService(dependencies: CalculationServiceDependencies): CalculationService {
  const { masters, currentConfiguration, plans = createPlanCache() } = dependencies;

  /** Every row, then the totals. `prefixOf` names a row in a validation problem: nothing for a single row, `rows[n].` for an estimate. */
  async function calculate(request: EstimateCalculationRequest, prefixOf: (index: number) => string): Promise<EstimateCalculation> {
    const { id, document } = await currentConfiguration();
    const typed = request.rows.map((row, index) => ({ materialId: row.materialId, inputs: parseInputs(document, row.inputs, prefixOf(index)) }));
    const values = await readMasters(masters, request.customerId, [...new Set(typed.map((row) => row.materialId))]);
    const plan = plans.get(id, document.fields);
    const calculated = typed.map(({ materialId, inputs }) => {
      const material = values.materials.get(materialId);
      if (material === undefined) throw new NotFoundError(NOT_FOUND_MESSAGE);
      return { inputs, outputs: calculateRowOutputs({ document, plan, inputs, rates: values.rates, material, exchange: values.exchange }) };
    });
    return { rows: calculated.map((row) => row.outputs), totals: calculateProductTotals({ document, plan, rows: calculated }) };
  }

  return {
    async calculateRow(request) {
      const [outputs] = (await calculate({ customerId: request.customerId, rows: [request] }, () => '')).rows;
      if (outputs === undefined) throw new Error('A calculation of one row returned none.');
      return outputs;
    },
    calculateEstimate: (request) => calculate(request, (index) => `rows[${index}].`),
  };
}
