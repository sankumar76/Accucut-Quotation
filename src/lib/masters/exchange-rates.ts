import type { FieldColumn } from '../fields/lookup';
import { DEFAULT_VALUE_MESSAGE, DEFAULT_VALUE_PATTERN, normaliseDefaultValue, RUPEE } from './process-items';

/**
 * What the Exchange rates tab of SCR-13 (STORY-02.04; SPEC sections 4.4 and 7.4, architecture sections 5.1 and 6) and its route share: the
 * words, the rule about a typed rate, and the part of the answer the hints are made from. Pure and without zod or the formula engine, so the
 * page does not carry them (NFR-009) and a client component may import it. The server states the same rules again in
 * `src/server/views/schemas/exchange-rates.ts`, which imports the words and the check from here, so a sentence is written once.
 *
 * A rate is carried as **decimal text** ("83.37"), never as a JavaScript number (coding standards section 10, "Money and rates"). It
 * follows the Process Master's default value: up to 12 digits, up to two decimals, 0 or more. Zero is accepted on purpose (assumption A-1):
 * the division-by-zero case CE-8 runs a zero rate and shows a dash.
 */

/** The two fields, as the route's body names them. `usd` is 1 US dollar in rupees and `eur` is 1 euro in rupees. */
export const EXCHANGE_RATE_FIELDS = ['usd', 'eur'] as const;

export type ExchangeRateField = (typeof EXCHANGE_RATE_FIELDS)[number];

/** What the Admin types, or what a save carries: both rates, as decimal text. */
export type ExchangeRateValues = { readonly [Field in ExchangeRateField]: string };

/** What is stored: a rate that was never set is `null`. */
export type StoredExchangeRates = { readonly [Field in ExchangeRateField]: string | null };

/**
 * What an audit entry about the pair is about (architecture section 8: `object_type` names the master; every audited object has a UUID, so the
 * pair has one fixed ID). One save is one entry, whatever number of the two rates it changes.
 */
export const EXCHANGE_RATES_OBJECT_TYPE = 'exchange_rate';
export const EXCHANGE_RATES_OBJECT_ID = '00000000-0000-4000-8000-000600000001';
export const EXCHANGE_RATES_LABEL = 'Exchange rates';

/** The labels of AC-1. */
export const EXCHANGE_RATE_LABELS: Readonly<Record<ExchangeRateField, string>> = {
  usd: `1 USD in ${RUPEE}`,
  eur: `1 EUR in ${RUPEE}`,
};

export const EXCHANGE_RATE_MESSAGE = DEFAULT_VALUE_MESSAGE;

/** The message for a typed rate, or null: digits, then up to two decimals, 0 or more. Spaces around the text are ignored. */
export function exchangeRateProblem(value: string): string | null {
  return DEFAULT_VALUE_PATTERN.test(value.trim()) ? null : EXCHANGE_RATE_MESSAGE;
}

/** A typed rate as the stored text: no leading zeros, two decimals ("083.5" is "83.50"). The text must already pass its check. */
export function normaliseExchangeRate(value: string): string {
  return normaliseDefaultValue(value.trim());
}

/** The message under each field that has one. */
export function exchangeRateProblems(values: ExchangeRateValues): Readonly<Partial<Record<ExchangeRateField, string>>> {
  const found: { -readonly [Field in ExchangeRateField]?: string } = {};
  for (const field of EXCHANGE_RATE_FIELDS) {
    const problem = exchangeRateProblem(values[field]);
    if (problem !== null) found[field] = problem;
  }
  return found;
}

/**
 * The currencies a save changes (AC-4): a rate that was never set changes when it is given; a rate that was set changes when the text
 * differs (compared as stored text, so "83.5" and "083.50" are one value). Empty means a save that changes nothing: no stamp and no entry.
 */
export function changedExchangeRates(before: StoredExchangeRates, wanted: ExchangeRateValues): ReadonlyArray<ExchangeRateField> {
  return EXCHANGE_RATE_FIELDS.filter((field) => before[field] !== normaliseExchangeRate(wanted[field]));
}

/** The two columns each rate belongs to: the column that holds the rate and the price column that divides by it. */
export interface ExchangeRateColumns {
  readonly rate: FieldColumn;
  readonly price: FieldColumn;
}

/** The currency in words, as the hint writes it. */
const CURRENCY_WORDS: Readonly<Record<ExchangeRateField, string>> = { usd: 'US dollars', eur: 'euros' };

/**
 * The hint under a field (AC-5, UX-23): "Converts prices to US dollars. The rate (<its letter>) feeds Unit Production Price (USD), <its letter>." The letters and the
 * name of the price column are the registry's, passed in, never typed here, so a later re-lettering keeps the hint right.
 */
export function exchangeRateHint(field: ExchangeRateField, columns: ExchangeRateColumns): string {
  return `Converts prices to ${CURRENCY_WORDS[field]}. The rate (${columns.rate.letter}) feeds ${columns.price.label}, ${columns.price.letter}.`;
}
