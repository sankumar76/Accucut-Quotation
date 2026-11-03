import { columnLetterToIndex } from '../../src/lib/columns';
import { Decimal, type Value } from '../../src/lib/decimal';
import type { ExchangeCurrency, MaterialOperandKey } from '../../src/lib/fields/types';
import {
  createRateLookup,
  parseFormula,
  type Expression,
  type RateReference,
  type ReferenceContext,
  type Resolver,
} from '../../src/lib/formula';

import { defined } from './defined';

/**
 * Invented fixtures for the formula engine (test strategy section 4). Every ID, name and number here is made up:
 * rate names are structure and appear only as names, never with a real value (ADR-014).
 */

/** A field ID that looks like the real ones and says which test field it is. */
export function fieldIdOf(position: number): string {
  return `00000000-0000-4000-8000-0fff${String(position).padStart(8, '0')}`;
}

const REGISTRY_SIZE = 500;

/** Field IDs in position order: A is position 1. */
export const FIELD_IDS: ReadonlyArray<string> = Array.from({ length: REGISTRY_SIZE }, (_, index) => fieldIdOf(index + 1));

/** The ID of the field in the column with this letter (tests may write letters). */
export function fieldAt(letter: string): string {
  return defined(FIELD_IDS[columnLetterToIndex(letter) - 1], `field ${letter}`);
}

export const RATE_PLAIN = '00000000-0000-4000-8000-0bbb00000001';
export const RATE_SPACED = '00000000-0000-4000-8000-0bbb00000002';
export const RATE_PERCENT = '00000000-0000-4000-8000-0bbb00000003';
export const RATE_HYPHENS = '00000000-0000-4000-8000-0bbb00000004';
export const RATE_COLUMN_PREFIX = '00000000-0000-4000-8000-0bbb00000005';
export const RATE_AMPERSAND = '00000000-0000-4000-8000-0bbb00000006';

export const RATES: ReadonlyArray<RateReference> = [
  { id: RATE_PLAIN, name: 'Test-Rate-per-kg' },
  { id: RATE_SPACED, name: 'Test Spaced Rate' },
  { id: RATE_PERCENT, name: 'Test Share %' },
  { id: RATE_HYPHENS, name: 'Cutting-Rate-per-Sec' },
  // Begins with the letters of a column, as `OH Profit %` does in the seed.
  { id: RATE_COLUMN_PREFIX, name: 'OH Profit %' },
  { id: RATE_AMPERSAND, name: 'Inspection & Packing %' },
];

export const CONTEXT: ReferenceContext = { fieldIds: FIELD_IDS, rates: RATES };

/** A decimal from text. Tests never build a Decimal from a JavaScript number. */
export function d(text: string): Decimal {
  return new Decimal(text);
}

/** A Value as text, so a test compares exact digits: `null` stays `null`. */
export function show(value: Value): string | null {
  return value === null ? null : value.toFixed();
}

type Text = string | null;

/** What a resolver should answer. Fields are keyed by column letter and rates by name, for readability. */
export interface ResolverInput {
  /** The current row's values by column letter. */
  readonly fields?: Readonly<Record<string, Text>>;
  /** Each field's value in every row, by column letter, for `SUM`. */
  readonly columns?: Readonly<Record<string, ReadonlyArray<Text>>>;
  /** The value typed for a rate, by name. A percent rate is typed as a percentage: 12 means 12 %. */
  readonly rates?: Readonly<Record<string, Text>>;
  readonly material?: Readonly<Partial<Record<MaterialOperandKey, Text>>>;
  readonly exchange?: Readonly<Partial<Record<ExchangeCurrency, Text>>>;
}

function asValue(text: Text | undefined): Value {
  return text === undefined || text === null ? null : d(text);
}

/** A resolver over invented values. A value that was not given has no figure (`null`). */
export function makeResolver(input: ResolverInput = {}): Resolver {
  const fields = new Map(Object.entries(input.fields ?? {}).map(([letter, text]) => [fieldAt(letter), asValue(text)]));
  const columns = new Map(
    Object.entries(input.columns ?? {}).map(([letter, texts]) => [fieldAt(letter), texts.map((text) => asValue(text))]),
  );
  const rateLookup = createRateLookup(
    RATES.map((rate) => ({ ...rate, value: asValue(input.rates?.[rate.name]) })),
  );
  return {
    fieldValue: (fieldId) => fields.get(fieldId) ?? null,
    columnValues: (fieldId) => columns.get(fieldId) ?? [],
    rate: rateLookup,
    material: (key) => asValue(input.material?.[key]),
    exchangeRate: (currency) => asValue(input.exchange?.[currency]),
  };
}

/** A formula as a Lead would type it, parsed against the test registry. */
export function parseDisplay(text: string): Expression {
  return parseFormula(text, { form: 'display', context: CONTEXT });
}
