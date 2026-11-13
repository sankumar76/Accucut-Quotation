import { Decimal } from '../../lib/decimal';
import { FieldValidationError, NotFoundError, type FieldProblem } from '../../lib/errors';
import { calculateRowOutputs } from '../../lib/estimate/row-calculator';
import type { RowOutputs } from '../../lib/estimate/row-outputs';
import { findFieldById } from '../../lib/fields/registry';
import type { ConfigDocument } from '../../lib/fields/schema';
import { createPlanCache, type PlanCache } from '../../lib/formula';
import type { MasterRepository } from '../repositories/master-repository';

/**
 * The calculation service (STORY-03.03; FR-024, FR-028; architecture sections 4.1 and 4.2). This story starts it with the one thing the rest
 * is built on: `calculateRow` works out one node's calculated fields, M to BK, from the masters as they are now. The full Calculate flow
 * (a transaction, a locked estimate, the product totals, the stored record) is STORY-05.09 and its neighbours.
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

/** What one row's calculation needs from the caller: whose rates, which material, and what was typed. */
export interface RowCalculationRequest {
  readonly customerId: string;
  /** The Material Master row for the part's Material in Drawing (E). The hidden "Not applicable" row is allowed. */
  readonly materialId: string;
  /** The typed numbers and flags by field ID, as plain decimal text. One that is absent counts as 0 (see `row-calculator.ts`). */
  readonly inputs: Readonly<Record<string, string>>;
}

export interface CalculationService {
  /** One node's outputs M to BK. Throws `FieldValidationError` for a typed value that is not a number, `NotFoundError` for an unknown customer or material. */
  calculateRow(request: RowCalculationRequest): Promise<RowOutputs>;
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
function parseInputs(document: ConfigDocument, inputs: Readonly<Record<string, string>>): Map<string, Decimal> {
  const problems: FieldProblem[] = [];
  const parsed = new Map<string, Decimal>();
  for (const [fieldId, text] of Object.entries(inputs)) {
    if (!takesTypedNumber(document, fieldId)) problems.push({ field: fieldId, message: NOT_A_NUMBER_FIELD_MESSAGE });
    else if (!TYPED_NUMBER_PATTERN.test(text)) problems.push({ field: fieldId, message: NOT_A_NUMBER_MESSAGE });
    else parsed.set(fieldId, new Decimal(text));
  }
  if (problems.length > 0) throw new FieldValidationError(problems);
  return parsed;
}

export function createCalculationService(dependencies: CalculationServiceDependencies): CalculationService {
  const { masters, currentConfiguration, plans = createPlanCache() } = dependencies;

  return {
    async calculateRow(request) {
      const configuration = await currentConfiguration();
      const inputs = parseInputs(configuration.document, request.inputs);
      const [customer, material, exchange] = await Promise.all([
        masters.findCustomer(request.customerId),
        masters.findMaterialForCalculation(request.materialId),
        masters.readExchangeRates(),
      ]);
      if (customer === null || material === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
      return calculateRowOutputs({
        document: configuration.document,
        plan: plans.get(configuration.id, configuration.document.fields),
        inputs,
        rates: customer.rates.map((rate) => ({ id: rate.processItemId, name: rate.name, value: new Decimal(rate.value) })),
        material: {
          pricePerKg: new Decimal(material.pricePerKg),
          specificGravity: new Decimal(material.specificGravity),
          scrapRate: new Decimal(material.scrapRate),
        },
        exchange: { usd: exchange.usd === null ? null : new Decimal(exchange.usd), eur: exchange.eur === null ? null : new Decimal(exchange.eur) },
      });
    },
  };
}
