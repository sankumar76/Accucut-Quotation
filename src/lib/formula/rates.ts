import 'server-only';

import { Decimal, divide, type Value } from '../decimal';

/**
 * How a Process Master rate becomes a formula operand (SPEC section 7.4; FR-028).
 *
 * A rate whose name ends in ` %` is entered as a percentage: the Admin types 12 and means 12 %. A formula needs
 * the fraction, 0.12, so the value is divided by 100. That division happens here, once, and nowhere else: a
 * formula never writes `/ 100`, and no caller scales a rate itself.
 */

export const PERCENT_SUFFIX = ' %';
const ONE_HUNDRED = new Decimal(100);

/** A Process Master rate with the value typed for the customer being priced. `null` is "no value". */
export interface RateValue {
  readonly id: string;
  readonly name: string;
  readonly value: Value;
}

/** True when the rate is a percentage by the name rule above. */
export function isPercentRate(name: string): boolean {
  return name.endsWith(PERCENT_SUFFIX);
}

/** The value a formula reads for the rate: 12 typed for `OH Profit %` gives 0.12; any other rate is unchanged. */
export function formulaRateValue(name: string, typed: Value): Value {
  return isPercentRate(name) ? divide(typed, ONE_HUNDRED) : typed;
}

/**
 * The `rate(rateId)` function of a `Resolver`: looks the rate up by ID and applies the percent rule. A rate
 * that is not in the list has no figure (`null`) rather than a made-up one.
 */
export function createRateLookup(rates: ReadonlyArray<RateValue>): (rateId: string) => Value {
  const byId = new Map(rates.map((rate) => [rate.id, rate]));
  return (rateId) => {
    const rate = byId.get(rateId);
    return rate === undefined ? null : formulaRateValue(rate.name, rate.value);
  };
}
