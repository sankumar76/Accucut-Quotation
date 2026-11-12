/**
 * Decimal text, the form in which the masters carry a rate, a price or a gravity (coding standards section 10, "Money and rates"): never a
 * JavaScript number. The columns are `Decimal(18,4)`; the text keeps at least two decimals and drops zeros beyond them.
 */

/** The decimals the columns store. */
export const STORED_DECIMALS = 4;

/** The decimals a value shows at least. */
const SHOWN_DECIMALS = 2;

/** "0.3700" is "0.37" and "21.3700" is "21.37": at least two decimals, and no zero beyond them. */
export function trimDecimalText(text: string): string {
  const [whole = '0', fraction = ''] = text.split('.');
  const kept = fraction.replace(/0+$/, '').padEnd(SHOWN_DECIMALS, '0');
  return `${whole}.${kept}`;
}
