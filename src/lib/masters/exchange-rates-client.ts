import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';
import type { FieldColumn } from '../fields/lookup';

import type { ExchangeRateColumns, ExchangeRateField, ExchangeRateValues, StoredExchangeRates } from './exchange-rates';

/**
 * The browser's side of the Exchange Rate Master route (SCR-13, Exchange rates tab; `/api/v1/exchange-rates`, architecture section 6): two
 * small calls and the reading of their answer. Nothing here decides anything: who may call and every rule about a rate are the server's, and
 * this file only turns its answer into something the screen can show.
 */

/** The pair as the tab shows it: the rates (null while never set), who saved them and when (UTC), and the columns the hints name. */
export interface ExchangeRatesRow extends StoredExchangeRates {
  readonly updatedBy: string | null;
  /** An ISO 8601 instant in UTC; the screen shows it in IST. */
  readonly updatedAt: string | null;
  readonly columns: Readonly<Record<ExchangeRateField, ExchangeRateColumns>>;
}

const EXCHANGE_RATES_PATH = '/api/v1/exchange-rates';

function toColumn(value: unknown): FieldColumn | null {
  if (!isRecord(value)) return null;
  const { letter, label } = value;
  return typeof letter === 'string' && typeof label === 'string' ? { letter, label } : null;
}

function toColumns(value: unknown): ExchangeRateColumns | null {
  if (!isRecord(value)) return null;
  const rate = toColumn(value['rate']);
  const price = toColumn(value['price']);
  return rate === null || price === null ? null : { rate, price };
}

const isTextOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string';

/** The answer of `GET` and `PUT`, checked field by field; a shape that is wrong is a failure and not a crash. */
export function toExchangeRatesRow(value: unknown): ExchangeRatesRow | null {
  if (!isRecord(value) || !isRecord(value['columns'])) return null;
  const { usd, eur, updatedBy, updatedAt } = value;
  const usdColumns = toColumns(value['columns']['usd']);
  const eurColumns = toColumns(value['columns']['eur']);
  if (!isTextOrNull(usd) || !isTextOrNull(eur) || !isTextOrNull(updatedBy) || !isTextOrNull(updatedAt)) return null;
  if (usdColumns === null || eurColumns === null) return null;
  return { usd, eur, updatedBy, updatedAt, columns: { usd: usdColumns, eur: eurColumns } };
}

/** `GET /api/v1/exchange-rates`. */
export function getExchangeRates(doFetch: Fetch = fetch): Promise<Outcome<ExchangeRatesRow>> {
  return sendJson(doFetch, EXCHANGE_RATES_PATH, { method: 'GET', headers: ACCEPT_JSON }, toExchangeRatesRow);
}

/** `PUT /api/v1/exchange-rates`: both rates, always together. */
export function putExchangeRates(values: ExchangeRateValues, doFetch: Fetch = fetch): Promise<Outcome<ExchangeRatesRow>> {
  return sendJson(doFetch, EXCHANGE_RATES_PATH, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(values) }, toExchangeRatesRow);
}
