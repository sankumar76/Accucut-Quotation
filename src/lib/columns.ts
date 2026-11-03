import { ValidationError } from './errors';

/**
 * Excel-style column letters (SPEC section 8.1, FR-021).
 *
 * A field's letter is never stored: it is derived from the field's position, so inserting or deleting
 * a field re-letters everything after it. Position 1 is A, 26 is Z, 27 is AA, 52 is AZ, 53 is BA.
 * Outside the seed configuration and tests, code never writes a letter by hand (coding standards
 * section 10); it calls these two functions.
 */

const ALPHABET_SIZE = 26;
const CODE_OF_A = 'A'.charCodeAt(0);

/**
 * Longest letter string accepted. 26^10 is below `Number.MAX_SAFE_INTEGER`, so every accepted string
 * converts to an exact integer; a longer one could silently lose precision.
 */
export const MAX_COLUMN_LETTERS = 10;

const UPPER_CASE_LETTERS = /^[A-Z]+$/;

/** A position or a letter string that is not a valid column reference. Carries no user data. */
export class ColumnReferenceError extends ValidationError {
  constructor(message: string) {
    super(message, { code: 'COLUMN_REFERENCE_INVALID' });
  }
}

/** 1 -> "A", 26 -> "Z", 27 -> "AA". Throws `ColumnReferenceError` unless `position` is an integer of 1 or more. */
export function indexToColumnLetter(position: number): string {
  if (!Number.isSafeInteger(position) || position < 1) {
    throw new ColumnReferenceError('A column position must be a whole number of 1 or more.');
  }
  let remaining = position;
  let letters = '';
  while (remaining > 0) {
    // Bijective base 26: there is no zero digit, so shift down by one before taking the remainder.
    const digit = (remaining - 1) % ALPHABET_SIZE;
    letters = String.fromCharCode(CODE_OF_A + digit) + letters;
    remaining = Math.floor((remaining - 1) / ALPHABET_SIZE);
  }
  return letters;
}

/** The inverse of `indexToColumnLetter`. Throws `ColumnReferenceError` unless `letters` is 1 to 10 capital letters. */
export function columnLetterToIndex(letters: string): number {
  if (!UPPER_CASE_LETTERS.test(letters) || letters.length > MAX_COLUMN_LETTERS) {
    throw new ColumnReferenceError(`A column reference is 1 to ${MAX_COLUMN_LETTERS} capital letters, A to Z.`);
  }
  let position = 0;
  for (const letter of letters) {
    position = position * ALPHABET_SIZE + (letter.charCodeAt(0) - CODE_OF_A + 1);
  }
  return position;
}

/** True when `text` is a valid column reference. Does not throw. */
export function isColumnLetters(text: string): boolean {
  return UPPER_CASE_LETTERS.test(text) && text.length <= MAX_COLUMN_LETTERS;
}
