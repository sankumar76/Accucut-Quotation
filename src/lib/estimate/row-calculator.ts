import 'server-only';

import { Decimal, type Value } from '../decimal';
import { findFieldById } from '../fields/registry';
import type { ConfigDocument } from '../fields/schema';
import { MATERIAL_RATE_KEY } from '../fields/types';
import { createRateLookup, evaluateRowFormulas, type CompiledPlan, type RateValue, type Resolver } from '../formula';

import type { RowOutputs } from './row-outputs';

/**
 * The row calculator (STORY-03.03; FR-024, FR-028; SPEC section 7.4; architecture sections 4.2 and 5.1): one node's calculated fields,
 * columns M to BK, from what the Engineer typed for that node, the selected customer's rates, the Material Master row for its Material in
 * Drawing and the two exchange rates.
 *
 * Pure: it reads nothing and writes nothing. The caller (`calculation-service`) reads the masters and passes plain values in. The formulas
 * are the registry's; the calculator holds none of them, so a re-lettered or edited registry changes the result with no change here. It runs
 * the compiled plan (`evaluateRowFormulas`), which keeps a `null` ("no figure", for example `BG / 0`) and still works out the others
 * (FR-026, A-07).
 *
 * **Restricted** (ADR-008, NFR-002): it returns `RowOutputs`, which only a Lead, an Admin or the system may see.
 */

/** The three numbers of the Material Master row that formulas read as `{{mat:<key>}}` (architecture section 4.5). `null` is "no figure". */
export interface MaterialValues {
  readonly pricePerKg: Value;
  readonly specificGravity: Value;
  readonly scrapRate: Value;
}

/** Rupees for 1 US dollar and for 1 euro. `null` while the Admin has never saved a rate. */
export interface ExchangeValues {
  readonly usd: Value;
  readonly eur: Value;
}

export interface RowCalculationInput {
  /** The configuration version's document, to find which fields are typed or looked up. */
  readonly document: ConfigDocument;
  /** The compiled plan of the same version. */
  readonly plan: CompiledPlan;
  /** The node's typed numbers and flags by field ID. A number or flag that is absent counts as 0 (see `fieldValue` below). */
  readonly inputs: ReadonlyMap<string, Value>;
  /** The selected customer's rates, each with the value typed for it (a percent rate as a percentage). */
  readonly rates: ReadonlyArray<RateValue>;
  readonly material: MaterialValues;
  readonly exchange: ExchangeValues;
}

const ZERO = new Decimal(0);

/**
 * The value of a field for this node. A typed number or flag is itself. One that is absent is 0: an unselected treatment flag is stored as
 * 0 (SPEC section 7.4, "Hide zero treatment lines"), and Fasteners Qty and Cost, hidden while Fasteners is "None", are stored as 0 (SPEC
 * section 14 item 4). A blank that must be filled in is refused by Calculate before it reaches here. Material Rate / Kg (I) comes from
 * the Material Master. Any other field (text, a drop-down, a picture) is not a number and has no figure.
 */
function fieldValueOf(input: RowCalculationInput, fieldId: string): Value {
  const typed = input.inputs.get(fieldId);
  if (typed !== undefined) return typed;
  const field = findFieldById(input.document, fieldId);
  if (field === undefined) return null;
  if (field.kind === 'auto') return field.key === MATERIAL_RATE_KEY ? input.material.pricePerKg : null;
  if (field.kind === 'input') return field.dataType === 'number' || field.dataType === 'flag' ? ZERO : null;
  return null;
}

function resolverFor(input: RowCalculationInput): Resolver {
  const rate = createRateLookup(input.rates);
  return {
    fieldValue: (fieldId) => fieldValueOf(input, fieldId),
    // A row's formulas never total a column; the product's totals are evaluated once every row is done (STORY-03.04).
    columnValues: () => [],
    rate,
    material: (key) => input.material[key],
    exchangeRate: (currency) => (currency === 'USD' ? input.exchange.usd : input.exchange.eur),
  };
}

/**
 * Every row-scope output of one node, M to BK, in dependency order. Nothing here throws on data: a division by zero leaves that one output
 * `null` and the rest as they are.
 */
export function calculateRowOutputs(input: RowCalculationInput): RowOutputs {
  return { values: evaluateRowFormulas(input.plan, resolverFor(input)) };
}
