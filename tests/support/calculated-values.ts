import { Decimal } from 'decimal.js';

import { indianGrouping, variantsOf, westernGrouping, type ForbiddenString } from './canary-masters';

/**
 * What a Calculate leaves in the database, as strings to look for (STORY-05.09 AC-6, NFR-002; review SQR-02 of AQP-317). The master sentinels cannot say whether a figure the calculation itself
 * produced reached an Engineer, because the figure is not known until it has been calculated. So, after the press, the journey reads this estimate's record (every output of every row, and the
 * product values: total price, price per tool cost, tool cost total), turns each figure into the forms a screen would print (plain digits, two decimals, Indian grouping, grouping of three: the
 * same `variantsOf` the master sentinels use), and scans everything the Engineer was sent from the press on.
 *
 * **Which figures are skipped, and why.** A figure under 100 (so 0, 0.00 and 1 too) is not looked for: its two-decimal text (`18.75`, `0.52`, `1.00`) appears in scripts, styles and ordinary
 * screens for no reason, and a scan that cried wolf on it would be quarantined. A whole number (`300`, `1000.0000`) is skipped too, for the same reason: it is the likeliest to be on a page for
 * another reason, and a cost worked out from rates and weights is a whole number only by accident. A figure that equals something the Engineer typed into the part (any value of the row's inputs,
 * compared as a number) is not looked for either: the Engineer's own `200.00` is on their screen by right. Of a watched figure, the forms of the figure itself are the ones with a decimal point; the whole-rupee rounding is looked for only in a form a page would not show for another reason (`wholeRupeeForms`: grouped from 10,000, plain from seven digits, rupee-prefixed for four to six). The gap that is left is real and is the
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
 * The whole-rupee forms of a watched figure (STORY-06.02, review SQR-12 of AQP-317): a quotation or a summary rounds a price to the whole rupee, so `1234567.891` can reach a page as `12,34,568`
 * or `1,234,568`. The scanner matches by substring over scripts, styles and payloads too, so only a form a page does not show for another reason is looked for (review SQR-03 of AQP-319):
 * a grouped form from 10,000 up (`10,000` and longer: `1,235` can sit inside a minified list of numbers), a plain form from seven digits, and, for four to six digits, the plain form with the
 * rupee sign in front (`₹ 12346`, `₹12346`), which no script holds by chance. A rounding that is the whole number of something the Engineer typed is not looked for at all: it is on their page by right.
 * `345.67` rounds to `346`, which is on a page for any reason, so it adds nothing.
 */
const MIN_GROUPED_ROUNDED_DIGITS = 5;
const MIN_PLAIN_ROUNDED_DIGITS = 7;
const MIN_PREFIXED_ROUNDED_DIGITS = 4;
const RUPEE_SIGNS = ['₹ ', '₹'] as const;

function wholeRupeeForms(magnitude: Decimal, typedWholes: ReadonlySet<string>): ForbiddenString[] {
  const whole = magnitude.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString();
  if (typedWholes.has(whole)) return [];
  const reason = (form: string): string => `a figure of this estimate's own calculation (rounded to the whole rupee, ${form})`;
  const forms: ForbiddenString[] = [];
  if (whole.length >= MIN_GROUPED_ROUNDED_DIGITS) {
    forms.push({ text: indianGrouping(whole), reason: reason('Indian grouping') }, { text: westernGrouping(whole), reason: reason('grouping of three') });
  }
  if (whole.length >= MIN_PLAIN_ROUNDED_DIGITS) forms.push({ text: whole, reason: reason('plain digits') });
  if (whole.length >= MIN_PREFIXED_ROUNDED_DIGITS && whole.length < MIN_PLAIN_ROUNDED_DIGITS) {
    for (const sign of RUPEE_SIGNS) forms.push({ text: `${sign}${whole}`, reason: reason('plain digits after the rupee sign') });
  }
  return forms;
}

/**
 * The forbidden strings for the figures a calculation produced: each figure of 100 or more, that the Engineer did not type, in each form it can take. `calculated` and `typed` are JSON values as
 * the database holds them (an `outputs` object, a `product_values` object, an `inputs` object); the nested figures are found by `numericScalars`.
 */
export function forbiddenCalculated(calculated: ReadonlyArray<unknown>, typed: ReadonlyArray<unknown> = []): ReadonlyArray<ForbiddenString> {
  const typedFigures = new Set(typed.flatMap(numericScalars).map((text) => new Decimal(text).abs().toString()));
  const typedWholes = new Set(typed.flatMap(numericScalars).map((text) => new Decimal(text).abs().toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString()));
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
    for (const entry of wholeRupeeForms(magnitude, typedWholes)) {
      if (seen.has(entry.text)) continue;
      seen.add(entry.text);
      list.push(entry);
    }
  }
  return list;
}
