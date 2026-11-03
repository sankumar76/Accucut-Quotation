import DecimalJs from 'decimal.js';

/**
 * The one configured Decimal of the application (ADR-005; coding standards section 10, "Money and rates").
 *
 * Precision is 34 significant digits and rounding is half-up, which for a tie rounds away from zero, as Excel
 * rounds a displayed value. The settings live on a private clone, so no other module's `decimal.js` import is
 * changed by them and nothing can drift: every money or rate calculation imports `Decimal` from here.
 *
 * No JavaScript number takes part in a calculation: a value enters as a string (or as a Decimal) and leaves
 * as a Decimal.
 */

/** Significant digits kept by every operation. */
export const DECIMAL_PRECISION = 34;

/**
 * decimal.js's own limits on the exponent. Setting `toExpNeg` and `toExpPos` to them means `toString()` (and so
 * `String()` and `JSON.stringify`) never writes a value in exponent form such as `1e-10`: a stored figure is
 * always a plain decimal string (G6 QLT-16).
 */
const EXPONENT_LIMIT = 9e15;

export const Decimal = DecimalJs.clone({
  precision: DECIMAL_PRECISION,
  rounding: DecimalJs.ROUND_HALF_UP,
  toExpNeg: -EXPONENT_LIMIT,
  toExpPos: EXPONENT_LIMIT,
});
export type Decimal = DecimalJs;

/**
 * A calculated or looked-up figure. `null` is "no figure": a division by zero (SPEC section 8.2, A-07) or a
 * figure that is not available. It spreads through every operator and through `SUM`, so a total is never
 * quietly lower because one row had no figure (test strategy CE-8).
 */
export type Value = Decimal | null;

/** a + b, or `null` if either has no figure. */
export function add(a: Value, b: Value): Value {
  return a === null || b === null ? null : a.plus(b);
}

/** a - b, or `null` if either has no figure. */
export function subtract(a: Value, b: Value): Value {
  return a === null || b === null ? null : a.minus(b);
}

/** a * b, or `null` if either has no figure. */
export function multiply(a: Value, b: Value): Value {
  return a === null || b === null ? null : a.times(b);
}

/** a / b, or `null` if either has no figure or the divisor is 0. It never throws and never returns Infinity or NaN. */
export function divide(a: Value, b: Value): Value {
  if (a === null || b === null || b.isZero()) return null;
  return a.div(b);
}

/** -a, or `null` if a has no figure. */
export function negate(a: Value): Value {
  return a === null ? null : a.negated();
}

/** True when both are figures and equal in value, or both have none. For tests and callers that compare results. */
export function sameValue(a: Value, b: Value): boolean {
  if (a === null || b === null) return a === b;
  return a.equals(b);
}
