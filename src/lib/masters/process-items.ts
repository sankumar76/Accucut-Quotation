/**
 * What the Process Master screen (SCR-11) and its routes share (STORY-02.01; SPEC section 4.1, architecture sections 5.1 and 6):
 * the units a rate may have, the limits, the words, and the one check of a typed default value. Pure and without zod or the
 * formula engine, so the page does not carry them (NFR-009) and a client component may import it. The server states the same
 * rules again in `src/server/views/schemas/process-items.ts`, which imports the limits and the words from here, so a limit or a
 * sentence is written once.
 */

/**
 * The units in use (SPEC section 4.1; UX spec SCR-11: "second, stroke, hole, kg, sq ft, sq in, %"). They are stored as the seed
 * items hold them (`prisma/seed/config/seed-ids.ts`); a test keeps the two lists in step.
 */
export const PROCESS_UNITS = ['per second', 'per stroke', 'per hole', 'per kg', 'per sq ft', 'per sq in', '%'] as const;
export type ProcessUnit = (typeof PROCESS_UNITS)[number];

/** Is this text one of the units a rate may have? */
export function isProcessUnit(value: string): value is ProcessUnit {
  return PROCESS_UNITS.some((unit) => unit === value);
}

/** The unit of the three percentage rates, whose values are typed as whole percentages (12 means 12%). */
export const PERCENT_UNIT: ProcessUnit = '%';
const RUPEE = '₹';

/** The sign beside a value: "%" for a percentage rate, the rupee sign for any other (the one place this rule is written). */
export function valueSymbol(unit: string): string {
  return unit === PERCENT_UNIT ? PERCENT_UNIT : RUPEE;
}

/** How a unit reads on the screen and in the audit log: "₹ per second", and "%" as it is. */
export function unitLabel(unit: string): string {
  return unit === PERCENT_UNIT ? unit : `${valueSymbol(unit)} ${unit}`;
}

/** The longest rate name. The formula engine states the same limit (`MAX_RATE_NAME_LENGTH`); a test keeps the two equal. */
export const PROCESS_ITEM_NAME_MAX_LENGTH = 100;

/**
 * A default value as typed: digits, then at most two decimals after a point. The 12 digits before the point keep it inside
 * `Decimal(18,4)` with room to spare. A sign, a thousands separator and an exponent are not part of it (architecture section
 * 8: "the API accepts plain decimals only"). The value is carried as this text and never as a floating-point number.
 */
export const DEFAULT_VALUE_PATTERN = /^\d{1,12}(?:\.\d{1,2})?$/;

export const NAME_REQUIRED_MESSAGE = 'Enter a name.';
export const NAME_TOO_LONG_MESSAGE = `Use ${PROCESS_ITEM_NAME_MAX_LENGTH} characters or fewer.`;
export const NAME_TAKEN_MESSAGE = 'A rate with this name already exists.';
/** Said when a name would change how a formula that is already stored reads back from display form (DEF-006, QLT-15). It names no rate and no formula. */
export const ROUND_TRIP_MESSAGE = 'This name would change how an existing formula reads, so it cannot be used.';
export const UNIT_REQUIRED_MESSAGE = 'Choose a unit.';
export const DEFAULT_VALUE_MESSAGE = 'Enter a number, 0 or more, with up to 2 decimals.';
export const NOTHING_TO_CHANGE_MESSAGE = 'Change at least one of name, unit or default value.';

/** The hint under the name field (SCR-11). */
export const NAME_HINT = 'Used in formulas exactly as written. Names ending in % are typed as whole percentages: 12 means 12%.';

/** The message for the name field, or null. Only the shape is checked here; whether a name is free or safe is the server's. */
export function nameProblem(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return NAME_REQUIRED_MESSAGE;
  return trimmed.length > PROCESS_ITEM_NAME_MAX_LENGTH ? NAME_TOO_LONG_MESSAGE : null;
}

/** The message for the default value field, or null. Surrounding spaces are ignored. */
export function defaultValueProblem(value: string): string | null {
  return DEFAULT_VALUE_PATTERN.test(value.trim()) ? null : DEFAULT_VALUE_MESSAGE;
}

/**
 * A typed default value as the stored text: no leading zeros, and two decimals ("003.37" is "3.37"). Two spellings of
 * one number therefore compare equal. The text must already satisfy `DEFAULT_VALUE_PATTERN`.
 */
export function normaliseDefaultValue(value: string): string {
  const [whole = '0', fraction = ''] = value.trim().split('.');
  return `${whole.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(2, '0')}`;
}

/** A default value as the table shows it: the number, and a percentage sign for a rate whose unit is "%". */
export function formatDefaultValue(value: string, unit: string): string {
  return unit === PERCENT_UNIT ? `${value} %` : value;
}

/** What a rate holds. */
export interface ProcessItemValues {
  readonly name: string;
  readonly unit: string;
  readonly defaultValue: string;
}

/** The part of it a request asks to set. */
export interface ProcessItemFields {
  readonly name?: string | undefined;
  readonly unit?: string | undefined;
  readonly defaultValue?: string | undefined;
}

/**
 * What really changes when `wanted` is applied to a rate: only a field that is given and differs (the name compared as written, so a
 * change of letter case counts; the value compared as stored text, so "3.37" and "03.37" are one value). An empty result is a save
 * that changes nothing, which writes no entry on the server and sends no request from the screen. The one rule of both.
 */
export function changesFrom(before: ProcessItemValues, wanted: ProcessItemFields): ProcessItemFields {
  const defaultValue = wanted.defaultValue === undefined ? undefined : normaliseDefaultValue(wanted.defaultValue);
  return {
    ...(wanted.name !== undefined && wanted.name !== before.name ? { name: wanted.name } : {}),
    ...(wanted.unit !== undefined && wanted.unit !== before.unit ? { unit: wanted.unit } : {}),
    ...(defaultValue !== undefined && defaultValue !== before.defaultValue ? { defaultValue } : {}),
  };
}
