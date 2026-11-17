import { toTwoPlaces } from '../money';

import { textTooLongMessage, validateTextInput, type InputCheck } from './validation';

/**
 * The Approved Quote Price a Lead types (STORY-06.06 AC-1; UX spec SCR-08 "Fields"), written once for the server's body schema and the dialog: rupees as plain decimal text, 0 or more, with up to 2
 * decimals. Pure, with no zod, so the dialog's code stays small (NFR-009; the dialog is fetched on the first press and is not in the first load). Whether the price is the right one is the Lead's; the
 * server only checks its shape.
 *
 * **An override (STORY-06.07; FR-103, D-18; architecture assumption A-12)** is a price that differs from the calculated total (BL) **at rupees and paise**. The approval keeps BL rounded to paise by the same
 * rule the dialog pre-fills its price with (`toTwoPlaces`, half away from zero, SQR-03 of the review of AQP-323), so the comparison rounds both sides by that one rule: a Lead who accepts the pre-filled
 * price is never an override, and `12629.99` and `12629.9900` are the same price. It is whole-number arithmetic on text, never a JavaScript number (ADR-005). The server decides it from BL it read itself;
 * the browser only uses it to show the reason field and the warning, so a client's idea of an override is never trusted.
 */

/** Digits, then optionally a point and one or two digits: no sign, no grouping, no currency sign. */
export const PRICE_PATTERN = /^\d{1,12}(?:\.\d{1,2})?$/;
/** The sentence under the field, and the 422's, when the text is not a price. */
export const PRICE_MESSAGE = 'Enter a price in rupees, 0 or more, with up to 2 decimals.';
/** The longest reason for a different price (architecture section 6 "Approve": at most 500 characters, counted in code points like the column; UX spec SCR-08). Kept with an override (STORY-06.07). */
export const MAX_REASON_LENGTH = 500;

/** Is this text a price the server would accept? Surrounding spaces are ignored. */
export const isPrice = (text: string): boolean => PRICE_PATTERN.test(text.trim());

/**
 * What the field starts with: the calculated total (BL) as rupees with two decimals. BL is held to more places than a price takes, so it is rounded half away from zero, as a screen shows it (`toTwoPlaces`);
 * an empty text when there is no total to start from, so the field is simply empty and the person types the price.
 */
export const prefillPrice = (calculatedTotal: string | null): string => (calculatedTotal === null ? '' : (toTwoPlaces(calculatedTotal) ?? ''));

/** The words under the reason when it is too long (the 422's too, UX-43; AC-4): the shared sentence of every text limit, with this field's 500. */
export const REASON_TOO_LONG_MESSAGE = textTooLongMessage(MAX_REASON_LENGTH);

/**
 * The reason for a different price as typed (AC-3, AC-4; UX spec SCR-08 "Fields"), read by the browser (the message under the field, the typed text kept) and by the server (the only place that decides). It is
 * the shared text rule (`validateTextInput`) for a text of several lines, so a **control, format or separator character is refused** exactly as everywhere else (DL-219: the zero-width characters, the
 * bidirectional overrides and the byte order mark could make a reason read other than it is stored in the audit log), and the 500-character limit counts **code points**, as the column's CHECK does.
 * The result's `value` is the trimmed text to keep, or `null` when nothing was typed: a reason is optional, and spaces alone are no reason.
 */
export function validateReason(typed: string): InputCheck {
  return validateTextInput(typed, { multiline: true, maxLength: MAX_REASON_LENGTH, countCodePoints: true });
}

/** A price in rupees and paise as a whole number of paise, or `null` when the text is no decimal. Both operands of the comparison go through the one rounding rule first. */
function paiseOf(text: string): bigint | null {
  const rounded = toTwoPlaces(text);
  return rounded === null ? null : BigInt(rounded.replace('.', ''));
}

/** Is this price different from the calculated total at rupees and paise? `false` when either text is no decimal (a field that is not yet a price shows no reason field). */
export const isOverridePrice = (price: string, calculatedTotal: string): boolean => {
  const entered = paiseOf(price);
  const total = paiseOf(calculatedTotal);
  return entered !== null && total !== null && entered !== total;
};

/** How far the price is from the calculated total: below or above it, and by how much in rupees with two decimals ("29.99"). */
export interface PriceDifference {
  readonly direction: 'lower' | 'higher';
  readonly amount: string;
}

const PAISE_DIGITS = 2;

/** The difference between the price and the calculated total, or `null` when they are the same price (not an override) or either is no decimal. */
export function priceDifference(price: string, calculatedTotal: string): PriceDifference | null {
  const entered = paiseOf(price);
  const total = paiseOf(calculatedTotal);
  if (entered === null || total === null || entered === total) return null;
  const gap = entered > total ? entered - total : total - entered;
  const digits = gap.toString().padStart(PAISE_DIGITS + 1, '0');
  return { direction: entered > total ? 'higher' : 'lower', amount: `${digits.slice(0, -PAISE_DIGITS)}.${digits.slice(-PAISE_DIGITS)}` };
}
