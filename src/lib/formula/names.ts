import 'server-only';

import { EXCHANGE_CURRENCIES, MATERIAL_OPERAND_KEYS, type ExchangeCurrency, type MaterialOperandKey } from '../fields/types';

import type { FormulaReference } from './ast';

/**
 * The names of the formula language (SPEC section 8.2) and its limits. The names a formula may use in display
 * form are: column letters, the Process Master rate names, the three `Material-*` operands and the two
 * `ExchangeRate-*` operands. Functions are upper case.
 */

export const FUNCTION_NAMES = ['SUM', 'MIN', 'MAX', 'ROUND', 'IF'] as const;
export type FunctionName = (typeof FUNCTION_NAMES)[number];

/** Longest formula text read, in characters. The schema allows 2,000 for stored text; this only stops abuse. */
export const MAX_FORMULA_LENGTH = 4_000;
/** Deepest nesting of brackets, function calls and unary minus signs. */
export const MAX_NESTING_DEPTH = 100;
/** The most decimal places `ROUND` accepts. */
export const MAX_ROUND_PLACES = 20;

/** How each `{{mat:<key>}}` operand reads in display form (SPEC section 4.3, architecture section 4.5). */
export const MATERIAL_OPERAND_NAMES: Readonly<Record<MaterialOperandKey, string>> = {
  pricePerKg: 'Material-Price-per-kg',
  specificGravity: 'Material-Specific-Gravity',
  scrapRate: 'Material-Scrap-Rate',
};

const EXCHANGE_NAME_PREFIX = 'ExchangeRate-';

/** `ExchangeRate-USD`: how an `{{fx:USD}}` operand reads in display form. */
export function exchangeOperandName(currency: ExchangeCurrency): string {
  return `${EXCHANGE_NAME_PREFIX}${currency}`;
}

/** The rates a formula may name. Their IDs are fixed for the 15 seed items (`prisma/seed/config/seed-ids.ts`). */
export interface RateReference {
  readonly id: string;
  readonly name: string;
}

/** What is needed to convert: the fields in position order, and the Process Master rates. */
export interface ReferenceContext {
  /** Field IDs in position order: the field at index `n - 1` has position `n`, and so the letter for `n`. */
  readonly fieldIds: ReadonlyArray<string>;
  readonly rates: ReadonlyArray<RateReference>;
}

/** An operand spelled as a fixed name rather than as letters. */
export interface NamedOperand {
  readonly name: string;
  readonly reference: FormulaReference;
}

/** The `Material-*` and `ExchangeRate-*` operands: fixed, whatever the Process Master holds. */
export function fixedOperands(): NamedOperand[] {
  return [
    ...MATERIAL_OPERAND_KEYS.map((key): NamedOperand => ({ name: MATERIAL_OPERAND_NAMES[key], reference: { kind: 'material', key } })),
    ...EXCHANGE_CURRENCIES.map((currency): NamedOperand => ({ name: exchangeOperandName(currency), reference: { kind: 'exchange', currency } })),
  ];
}

/**
 * Every named operand, longest name first, so that a name never loses to a shorter one that it contains:
 * `Cutting-Rate-per-Sec` is one name and not a subtraction, and `OH Profit %` is not column `OH` (SPEC section
 * 8.2, ADR-005). Names of equal length keep a fixed order, so the result never depends on the list order.
 */
export function namedOperands(rates: ReadonlyArray<RateReference>): NamedOperand[] {
  const operands: NamedOperand[] = [
    ...rates.map((rate): NamedOperand => ({ name: rate.name, reference: { kind: 'rate', id: rate.id } })),
    ...fixedOperands(),
  ];
  return operands.sort((a, b) => b.name.length - a.name.length || a.name.localeCompare(b.name, 'en'));
}
