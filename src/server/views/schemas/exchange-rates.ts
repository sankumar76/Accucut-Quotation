import { z } from 'zod';

import { EXCHANGE_RATE_MESSAGE } from '../../../lib/masters/exchange-rates';
import { DEFAULT_VALUE_PATTERN } from '../../../lib/masters/process-items';

/**
 * The contract of the Exchange Rate Master route (STORY-02.04, architecture section 6 "Exchange rates"). The body and the answer are strict
 * objects: a key that is not named is an error, so nothing is sent that is not meant to be, and a client cannot set a field the route does
 * not offer (NFR-002). The limit and the sentence are the ones the screen uses (`src/lib/masters/exchange-rates.ts`) and are shown under
 * the field they name.
 *
 * A rate is **decimal text**, never a JSON number (coding standards section 10, "Money and rates"): digits, then up to two decimals, 0 or
 * more. A blank, a negative, a non-numeric or a three-decimal value is 422 naming the field, and neither rate changes (AC-3). Zero is accepted
 * on purpose (assumption A-1).
 *
 * This is the Admin's schema and it carries both rates. Nothing an Engineer may call has a schema like it (BR-003).
 */

const rate = z.string({ error: EXCHANGE_RATE_MESSAGE }).trim().regex(DEFAULT_VALUE_PATTERN, EXCHANGE_RATE_MESSAGE);

/** `PUT /api/v1/exchange-rates` (AC-2, AC-3): both rates, always together. */
export const putExchangeRatesBodySchema = z.strictObject({ usd: rate, eur: rate });

/** A column of the field registry as a hint names it: the letter it has now, and its name (AC-5). */
const columnSchema = z.strictObject({ letter: z.string().min(1), label: z.string().min(1) });

/** The rate column and the price column it feeds. */
const columnsSchema = z.strictObject({ rate: columnSchema, price: columnSchema });

/**
 * The answer of `GET` and `PUT`: the rates as decimal text (null while never set), who saved them and when (an ISO 8601 instant in UTC; the
 * screen shows IST), and the columns for the hints.
 */
export const exchangeRatesSchema = z.strictObject({
  usd: z.string().min(1).nullable(),
  eur: z.string().min(1).nullable(),
  updatedBy: z.string().min(1).nullable(),
  updatedAt: z.iso.datetime().nullable(),
  columns: z.strictObject({ usd: columnsSchema, eur: columnsSchema }),
});
