import { DECIMAL_TEXT_MESSAGE, DECIMAL_TEXT_PATTERN, MASTER_NAME_MAX_LENGTH, NAME_TOO_LONG_MESSAGE, normaliseDecimalText } from './master-rules';

/**
 * What the Materials tab of SCR-13 (STORY-02.03; SPEC section 4.3, architecture sections 5.1 and 6) and its routes share: the limits,
 * the words, and the rules about a typed number. Pure and without zod or the formula engine, so the page does not carry them
 * (NFR-009) and a client component may import it. The server states the same rules again in `src/server/views/schemas/materials.ts`,
 * which imports the limits, the words and `specificGravityProblem` from here, so a limit or a sentence is written once.
 *
 * A price, a specific gravity and a Material-Scrap-Rate are carried as **decimal text** ("7.37"), never as a JavaScript number
 * (coding standards section 10, "Money and rates"). The text of a price or a scrap rate follows `DECIMAL_TEXT_PATTERN` (`master-rules.ts`)
 * (up to 12 digits, up to two decimals, 0 or more); a specific gravity follows it too and must also be above 0 (UX-37).
 */

/** The longest Material in Drawing and Material Considered. The same limit as every master's name (`master-rules.ts`). */
export const MATERIAL_TEXT_MAX_LENGTH = MASTER_NAME_MAX_LENGTH;

/** The words of the fields, as the labels of SCR-13 write them (the field is named Material-Scrap-Rate, per kg: SPEC D-39). */
export const MATERIAL_FIELD_LABELS = {
  materialInDrawing: 'Material in Drawing',
  materialConsidered: 'Material Considered',
  pricePerKg: 'Price per kg',
  specificGravity: 'Specific gravity',
  scrapRate: 'Material-Scrap-Rate (per kg)',
} as const;

export const MATERIAL_NAME_REQUIRED_MESSAGE = 'Enter the Material in Drawing.';
export const MATERIAL_NAME_TOO_LONG_MESSAGE = NAME_TOO_LONG_MESSAGE;
/** The ux-expert's words (ux-spec v0.18, SCR-13 "The Materials tab: final words", Jira 11188): "Enter the" plus the field's label. */
export const CONSIDERED_REQUIRED_MESSAGE = 'Enter the Material Considered.';
export const MATERIAL_NAME_TAKEN_MESSAGE = 'A material with this name already exists. Names must be unique.';
export const NUMBER_MESSAGE = DECIMAL_TEXT_MESSAGE;
/** The message and the hint of UX-37 (state "Specific gravity 0"). */
export const SPECIFIC_GRAVITY_ABOVE_ZERO_MESSAGE = 'Enter a value above 0.';
export const SPECIFIC_GRAVITY_HINT = 'Must be above 0.';
/** A specific gravity that is not a number of up to two decimals at all. */
export const SPECIFIC_GRAVITY_FORMAT_MESSAGE = 'Enter a number above 0, with up to 2 decimals.';
export const NOTHING_TO_CHANGE_MATERIAL_MESSAGE = 'Change at least one of the material fields.';

/** What a material holds, as the screen and the routes carry it: text, with the numbers as decimal text. */
export interface MaterialValues {
  readonly materialInDrawing: string;
  readonly materialConsidered: string;
  readonly pricePerKg: string;
  readonly specificGravity: string;
  readonly scrapRate: string;
}

/** The part of it a request asks to set. */
export type MaterialFields = { readonly [Field in keyof MaterialValues]?: string | undefined };

export type MaterialFieldName = keyof MaterialValues;

/** The fields in the order the form draws them, so focus goes to the first one with a message. */
export const MATERIAL_FIELD_NAMES: ReadonlyArray<MaterialFieldName> = ['materialInDrawing', 'materialConsidered', 'pricePerKg', 'specificGravity', 'scrapRate'];

const TEXT_FIELDS = ['materialInDrawing', 'materialConsidered'] as const;
const NUMBER_FIELDS = ['pricePerKg', 'specificGravity', 'scrapRate'] as const;

/** A number as someone may type it with a sign or more decimals than the pattern allows: it is judged by the words, not refused unread. */
const LOOSE_NUMBER = /^[+-]?\d+(?:\.\d+)?$/;
/** A digit other than 0: a number written in the allowed shape is above 0 exactly when it has one. */
const NONZERO_DIGIT = /[1-9]/;

/** The message for a name, or null. Spaces around the text are ignored. */
export function materialTextProblem(value: string, required: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return required;
  return trimmed.length > MATERIAL_TEXT_MAX_LENGTH ? MATERIAL_NAME_TOO_LONG_MESSAGE : null;
}

/** The message for a price or a Material-Scrap-Rate, or null: digits, then up to two decimals, 0 or more. */
export function materialNumberProblem(value: string): string | null {
  return DECIMAL_TEXT_PATTERN.test(value.trim()) ? null : NUMBER_MESSAGE;
}

/**
 * The message for a specific gravity, or null (UX-37, AC-2): it must be above 0, with up to two decimals. The one check of the screen
 * and of the server, on the text and with no floating point. A value of 0 or below (and a negative one) says "Enter a value above 0.";
 * a text that is no number in the allowed shape says what the shape is.
 */
export function specificGravityProblem(value: string): string | null {
  const text = value.trim();
  if (DECIMAL_TEXT_PATTERN.test(text)) return NONZERO_DIGIT.test(text) ? null : SPECIFIC_GRAVITY_ABOVE_ZERO_MESSAGE;
  if (LOOSE_NUMBER.test(text) && (text.startsWith('-') || !NONZERO_DIGIT.test(text))) return SPECIFIC_GRAVITY_ABOVE_ZERO_MESSAGE;
  return SPECIFIC_GRAVITY_FORMAT_MESSAGE;
}

/** A typed number as the stored text: no leading zeros, two decimals ("003.37" is "3.37"). The text must already pass its check. */
export function normaliseMaterialNumber(value: string): string {
  return normaliseDecimalText(value);
}

/**
 * What really changes when `wanted` is applied to a material: only a field that is given and differs (a name compared as written, so a
 * change of letter case counts; a number compared as stored text, so "7.37" and "07.37" are one value). An empty result is a save that
 * changes nothing, which writes no entry on the server and sends no request from the screen. The one rule of both.
 */
export function materialChangesFrom(before: MaterialValues, wanted: MaterialFields): MaterialFields {
  const changes: { -readonly [Field in keyof MaterialValues]?: string } = {};
  for (const field of TEXT_FIELDS) {
    const value = wanted[field];
    if (value !== undefined && value !== before[field]) changes[field] = value;
  }
  for (const field of NUMBER_FIELDS) {
    const typed = wanted[field];
    const value = typed === undefined ? undefined : normaliseMaterialNumber(typed);
    if (value !== undefined && value !== before[field]) changes[field] = value;
  }
  return changes;
}
