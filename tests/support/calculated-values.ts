import { Decimal } from 'decimal.js';

import { variantsOf, type ForbiddenString } from './canary-masters';

/**
 * What a Calculate leaves in the database, as strings to look for (STORY-05.09 AC-6, NFR-002; review SQR-02 of AQP-317). The master sentinels cannot say whether a figure the calculation itself
 * produced reached an Engineer, because the figure is not known until it has been calculated. So, after the press, the journey reads this estimate's record (every output of every row, and the
 * product values: total price, price per tool cost, tool cost total), turns each figure into the forms a screen would print (plain digits, two decimals, Indian grouping, grouping of three: the
 * same `variantsOf` the master sentinels use), and scans everything the Engineer was sent from the press on.
 *
 * **Which figures are skipped, and why.** A figure under 100 (so 0, 0.00 and 1 too) is not looked for: its two-decimal text (`18.75`, `0.52`, `1.00`) appears in scripts, styles and ordinary
 * screens for no reason, and a scan that cried wolf on it would be quarantined. A whole number (`300`, `1000.0000`) is skipped too, for the same reason: it is the likeliest to be on a page for
 * another reason, and a cost worked out from rates and weights is a whole number only by accident. A figure that equals something the Engineer typed into the part (any value of the row's inputs,
 * compared as a number) is not looked for either: the Engineer's own `200.00` is on their screen by right. Of a watched figure, a form with no decimal point is never looked for. The gap is real and is the
 * price of a scan that stays honest: only figures of three or more integer digits with a fraction are watched, the same shape as the master sentinels (`SENTINEL_PATTERN`). The journey asserts the
 * list is not empty, so it can never pass by watching nothing.
 */

/** Every number-like scalar inside a JSON value, as text, in the order met. Strings that are not plain numbers (names, Sl. No., material text) are left out, and so are nulls and booleans. */
export function numericScalars(value: unknown): string[] {
  if (typeof value === 'number') return Number.isFinite(value) ? [String(value)] : [];
  if (typeof value === 'string') return /^-?\d+(\.\d+)?$/.test(value.trim()) ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(numericScalars);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(numericScalars);
  return [];
}

/** The smallest figure that is looked for: three integer digits, like the master sentinels. */
const SMALLEST_WATCHED = new Decimal(100);

/**
 * The forbidden strings for the figures a calculation produced: each figure of 100 or more, that the Engineer did not type, in each form it can take. `calculated` and `typed` are JSON values as
 * the database holds them (an `outputs` object, a `product_values` object, an `inputs` object); the nested figures are found by `numericScalars`.
 */
export function forbiddenCalculated(calculated: ReadonlyArray<unknown>, typed: ReadonlyArray<unknown> = []): ReadonlyArray<ForbiddenString> {
  const typedFigures = new Set(typed.flatMap(numericScalars).map((text) => new Decimal(text).abs().toString()));
  const seen = new Set<string>();
  const list: ForbiddenString[] = [];
  for (const figure of calculated.flatMap(numericScalars)) {
    const magnitude = new Decimal(figure).abs();
    if (magnitude.lessThan(SMALLEST_WATCHED) || magnitude.isInteger() || typedFigures.has(magnitude.toString())) continue;
    for (const { text, form } of variantsOf(magnitude.toString())) {
      if (!text.includes('.') || seen.has(text)) continue;
      seen.add(text);
      list.push({ text, reason: `a figure of this estimate's own calculation (${form})` });
    }
  }
  return list;
}
