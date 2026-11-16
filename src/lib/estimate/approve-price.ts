import { toTwoPlaces } from '../money';

/**
 * The Approved Quote Price a Lead types (STORY-06.06 AC-1; UX spec SCR-08 "Fields"), written once for the server's body schema and the dialog: rupees as plain decimal text, 0 or more, with up to 2
 * decimals. Pure, with no zod and no other import than the money formatter, so the dialog's code stays small (NFR-009). Whether the price is the right one is the Lead's; the server only checks its shape.
 */

/** Digits, then optionally a point and one or two digits: no sign, no grouping, no currency sign. */
export const PRICE_PATTERN = /^\d{1,12}(?:\.\d{1,2})?$/;
/** The sentence under the field, and the 422's, when the text is not a price. */
export const PRICE_MESSAGE = 'Enter a price in rupees, 0 or more, with up to 2 decimals.';
/** The longest reason for a different price (architecture section 6 "Approve": at most 500 characters; UX spec SCR-08). It is kept from STORY-06.07. */
export const MAX_REASON_LENGTH = 500;

/** Is this text a price the server would accept? Surrounding spaces are ignored. */
export const isPrice = (text: string): boolean => PRICE_PATTERN.test(text.trim());

/**
 * What the field starts with: the calculated total (BL) as rupees with two decimals. BL is held to more places than a price takes, so it is rounded half away from zero, as a screen shows it (`toTwoPlaces`);
 * an empty text when there is no total to start from, so the field is simply empty and the person types the price.
 */
export const prefillPrice = (calculatedTotal: string | null): string => (calculatedTotal === null ? '' : (toTwoPlaces(calculatedTotal) ?? ''));
