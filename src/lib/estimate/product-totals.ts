import 'server-only';

import { add, Decimal, type Value } from '../decimal';
import { findFieldByKey, findSystemField } from '../fields/registry';
import type { ConfigDocument } from '../fields/schema';
import { PRICE_PER_TOOL_COST_KEY } from '../fields/types';
import { evaluateProductFormulas, type CompiledPlan, type Resolver } from '../formula';

import { typedFieldValue } from './row-calculator';
import type { RowOutputs } from './row-outputs';

/**
 * The estimate's product-level figures (STORY-03.04; FR-024, FR-025, FR-029, FR-030; SPEC section 7.4 BL, BN and BO; architecture section
 * 4.3): BL is the plain sum of BG over every row, BN is BL divided by the total Tool Cost, and BO is the approved price.
 *
 * The rule is the worksheet's `SUM(BG)`. Each row's BG already carries its own count (`BB = BA x H`), so nothing here multiplies a row by
 * another row's quantity, and nothing sums a parent's children: a parent shows only its own row. The sums are the registry's `SUM`
 * formulas run by the engine over the rows' stored figures (`evaluateProductFormulas`), so the portal holds no copy of the rule. A row
 * without a figure in BG makes BL "no figure" (`null`), never a lower number (test strategy CE-8).
 *
 * **Restricted** (ADR-008, NFR-002), like `row-outputs.ts`: `eslint.config.mjs` refuses it from the Engineer views.
 */

/** What the screen shows for the Approved Quote Price (BO) of an estimate that has no approval. */
export const APPROVED_PRICE_NOT_SET_TEXT = 'Not set yet';

/** One row of the estimate as the totals need it: its calculated outputs and its typed values (the Tool Cost, BM, is typed). */
export interface ProductRow {
  readonly outputs: RowOutputs;
  readonly inputs: ReadonlyMap<string, Value>;
}

export interface ProductTotalsInput {
  readonly document: ConfigDocument;
  readonly plan: CompiledPlan;
  /** Every row of the estimate, in any order. An estimate with no rows totals 0. */
  readonly rows: ReadonlyArray<ProductRow>;
}

export interface ProductTotals {
  /** Every product-scope output of the plan by field ID (BL and BN in the seed registry). */
  readonly values: ReadonlyMap<string, Value>;
  /** BL: the sum of BG over every row, or `null` if any row has no BG. */
  readonly totalPrice: Value;
  /** The total of the Tool Cost entries (BM) as typed, with no quantity applied (D-05, D-16). 0 when none was entered. */
  readonly toolCostTotal: Value;
  /** BN: BL divided by the total Tool Cost, or `null` when that total is 0 (the screen shows a dash, the export an empty cell). */
  readonly pricePerToolCost: Value;
  /** BO. Always `null` here: it is written only by an approval (STORY-06.06), never calculated. */
  readonly approvedPrice: null;
}

/** The value of `fieldId` in each row: the row's calculated output (which may be `null`), else its typed value. */
function columnOf(input: ProductTotalsInput, fieldId: string): ReadonlyArray<Value> {
  return input.rows.map((row) =>
    row.outputs.values.has(fieldId) ? (row.outputs.values.get(fieldId) ?? null) : typedFieldValue(input.document, row.inputs, fieldId),
  );
}

/** Product formulas read column totals only; a row-scope value, a rate, a material and an exchange rate are not theirs to read. */
function resolverFor(input: ProductTotalsInput): Resolver {
  return {
    fieldValue: () => null,
    columnValues: (fieldId) => columnOf(input, fieldId),
    rate: () => null,
    material: () => null,
    exchangeRate: () => null,
  };
}

function toolCostTotalOf(input: ProductTotalsInput): Value {
  const toolCost = findSystemField(input.document, 'tool-cost');
  const entries = toolCost === undefined ? [] : columnOf(input, toolCost.id);
  return entries.reduce<Value>((total, entry) => add(total, entry), new Decimal(0));
}

/** The value of the product-scope field with this ID, or `null` when the registry has no such field. */
function valueOf(values: ReadonlyMap<string, Value>, fieldId: string | undefined): Value {
  return fieldId === undefined ? null : (values.get(fieldId) ?? null);
}

/** BL, BN and the total Tool Cost of an estimate whose rows are all calculated. Nothing here throws on data. */
export function calculateProductTotals(input: ProductTotalsInput): ProductTotals {
  const values = evaluateProductFormulas(input.plan, resolverFor(input));
  return {
    values,
    totalPrice: valueOf(values, findSystemField(input.document, 'total')?.id),
    toolCostTotal: toolCostTotalOf(input),
    pricePerToolCost: valueOf(values, findFieldByKey(input.document, PRICE_PER_TOOL_COST_KEY)?.id),
    approvedPrice: null,
  };
}
