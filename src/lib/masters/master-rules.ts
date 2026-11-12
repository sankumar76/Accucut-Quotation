/**
 * The rules that more than one master states for its typed fields (the Process Master, the Material Master, the Exchange Rate Master and
 * the Treatment / Color list): the longest name and the one check of a name, a number typed as decimal text, and the rupee sign that money is
 * shown with. Pure and without zod or the formula engine, so the page does not carry them (NFR-009) and a client component may import it. The
 * server's schemas import the limit, the pattern and the words from here, so a limit or a sentence is written once.
 *
 * Each master's own words (the sentence for a name that is taken, the hint under its field) stay in its own file.
 */

/** The longest name of any master's list entry (a rate, a material, a treatment). The formula engine states the same limit for a rate's name (`MAX_RATE_NAME_LENGTH`); a test keeps the two equal. */
export const MASTER_NAME_MAX_LENGTH = 100;

export const NAME_REQUIRED_MESSAGE = 'Enter a name.';
export const NAME_TOO_LONG_MESSAGE = `Use ${MASTER_NAME_MAX_LENGTH} characters or fewer.`;

/** The message for a name field, or null. Only the shape is checked here; whether a name is free or safe is the server's. */
export function nameProblem(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return NAME_REQUIRED_MESSAGE;
  return trimmed.length > MASTER_NAME_MAX_LENGTH ? NAME_TOO_LONG_MESSAGE : null;
}

/**
 * A number as typed: digits, then at most two decimals after a point. The 12 digits before the point keep it inside `Decimal(18,4)` with
 * room to spare. A sign, a thousands separator and an exponent are not part of it (architecture section 8: "the API accepts plain decimals
 * only"). The value is carried as this text and never as a floating-point number. A rate's default value, a material's price, gravity and
 * scrap rate, and an exchange rate are all typed this way.
 */
export const DECIMAL_TEXT_PATTERN = /^\d{1,12}(?:\.\d{1,2})?$/;

export const DECIMAL_TEXT_MESSAGE = 'Enter a number, 0 or more, with up to 2 decimals.';

/** The rupee sign: the one place it is written for every master's screens and the audit log. */
export const RUPEE = '₹';

/**
 * A typed number as the stored text: no leading zeros, and two decimals ("003.37" is "3.37"). Two spellings of one number therefore
 * compare equal. The text must already satisfy `DECIMAL_TEXT_PATTERN`.
 */
export function normaliseDecimalText(value: string): string {
  const [whole = '0', fraction = ''] = value.trim().split('.');
  return `${whole.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(2, '0')}`;
}
