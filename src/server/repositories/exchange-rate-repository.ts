import { z } from 'zod';

import { EXCHANGE_RATE_FIELDS, type ExchangeRateField, type ExchangeRateValues } from '../../lib/masters/exchange-rates';

import { withDatabaseErrors } from './database-errors';
import { trimDecimalText } from './decimal-text';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the Exchange Rate Master (STORY-02.04; architecture sections 5.1 and 6; SPEC sections 4.4 and 7.4): 1 US dollar and 1 euro in
 * rupees. The table `exchange_rates` has at most two rows, one per currency, and is created empty (ADR-014). A rate that was never saved is
 * `null`. Both rows are written by one save with the same stamp (who and when, UTC), so the stamp of the pair is the stamp of its newest row.
 *
 * A rate is carried as **decimal text** ("83.37"), never as a JavaScript number (coding standards section 10, "Money and rates"): the column
 * is `Decimal(18,4)`, and the text keeps at least two decimals and drops zeros beyond them.
 *
 * Every method that changes a rate takes the caller's `Transaction`, because every such change is audited in the same one (STORY-01.07;
 * architecture section 6, DEF-017). The runtime role can read, add and change the two rows and cannot delete them.
 */

/** Who made the save that last changed a rate, and when. */
export interface ExchangeRateStamp {
  readonly updatedById: string;
  readonly updatedByName: string;
  /** An instant, stored and carried in UTC. */
  readonly updatedAt: Date;
}

/** The two rates and their stamp. `stamp` is null while no rate has ever been saved. */
export interface ExchangeRatesRecord {
  readonly usd: string | null;
  readonly eur: string | null;
  readonly stamp: ExchangeRateStamp | null;
}

/** What a save writes: the person and the instant, the same for both rows. */
export interface NewExchangeRateStamp {
  readonly updatedById: string;
  readonly updatedAt: Date;
}

export interface ExchangeRateMethods {
  /** The two rates and the stamp of the pair. Plain read: it is not held up by a save. */
  readExchangeRates(): Promise<ExchangeRatesRecord>;
  /** Takes the lock that serialises saves until the transaction ends (`SHARE ROW EXCLUSIVE`): two saves cannot overlap, even while there is no row yet to lock. Plain reads are not held up. */
  lockExchangeRates(tx: Transaction): Promise<void>;
  /** The two rates and the stamp, read **with the rows locked** until the transaction ends, so `before` is the state replaced. */
  findExchangeRatesForUpdate(tx: Transaction): Promise<ExchangeRatesRecord>;
  /** Writes both rates (adding a row that does not exist yet) with one stamp, and returns the state as written. `values` is decimal text, already checked. */
  saveExchangeRates(values: ExchangeRateValues, stamp: NewExchangeRateStamp, tx: Transaction): Promise<ExchangeRatesRecord>;
}

const CURRENCY_OF: Readonly<Record<ExchangeRateField, 'USD' | 'EUR'>> = { usd: 'USD', eur: 'EUR' };
const CURRENCIES = ['USD', 'EUR'] as const;

/** A row as read, whichever way it was read: the value already as decimal text. */
interface RateRow {
  readonly currency: (typeof CURRENCIES)[number];
  readonly inrValue: string;
  readonly updatedById: string;
  readonly updatedByName: string;
  readonly updatedAt: Date;
}

const LOCKED_ROWS = z.array(
  z.strictObject({
    currency: z.enum(CURRENCIES),
    inrValue: z.string(),
    updatedAt: z.date(),
    updatedById: z.string(),
    updatedByName: z.string(),
  }),
);

/** The newest stamp of the rows, or null when there are none. The rows of one save share a stamp; the newest is the pair's. */
function stampOf(rows: ReadonlyArray<RateRow>): ExchangeRateStamp | null {
  let newest: RateRow | undefined;
  for (const row of rows) {
    if (newest === undefined || row.updatedAt.getTime() > newest.updatedAt.getTime()) newest = row;
  }
  return newest === undefined ? null : { updatedById: newest.updatedById, updatedByName: newest.updatedByName, updatedAt: newest.updatedAt };
}

function toRecord(rows: ReadonlyArray<RateRow>): ExchangeRatesRecord {
  const valueOf = (currency: (typeof CURRENCIES)[number]): string | null => {
    const row = rows.find((candidate) => candidate.currency === currency);
    return row === undefined ? null : trimDecimalText(row.inrValue);
  };
  return { usd: valueOf('USD'), eur: valueOf('EUR'), stamp: stampOf(rows) };
}

async function readRows(db: PrismaClient, tx?: Transaction): Promise<ExchangeRatesRecord> {
  const found = await clientFor(db, tx).exchangeRate.findMany({
    select: { currency: true, inrValue: true, updatedAt: true, updatedById: true, updatedBy: { select: { name: true } } },
  });
  const rows = found.flatMap((row): RateRow[] => {
    const currency = CURRENCIES.find((candidate) => candidate === row.currency);
    // The table's CHECK allows only these two; a row of another currency is damaged and is not shown as a rate.
    if (currency === undefined) return [];
    return [{ currency, inrValue: row.inrValue.toFixed(4), updatedById: row.updatedById, updatedByName: row.updatedBy.name, updatedAt: row.updatedAt }];
  });
  return toRecord(rows);
}

async function selectForUpdate(db: PrismaClient, tx: Transaction): Promise<ExchangeRatesRecord> {
  // Prisma has no row lock, so this is a raw statement; it has no parameter. Only the exchange_rates rows are locked, not the users read beside them.
  const rows = await clientFor(db, tx).$queryRaw`
    SELECT e.currency AS "currency", e.inr_value::text AS "inrValue", e.updated_at AS "updatedAt",
           e.updated_by::text AS "updatedById", u.name AS "updatedByName"
    FROM exchange_rates e JOIN users u ON u.id = e.updated_by
    ORDER BY e.currency FOR UPDATE OF e`;
  return toRecord(LOCKED_ROWS.parse(rows));
}

async function writeRows(db: PrismaClient, values: ExchangeRateValues, stamp: NewExchangeRateStamp, tx: Transaction): Promise<ExchangeRatesRecord> {
  const client = clientFor(db, tx);
  for (const field of EXCHANGE_RATE_FIELDS) {
    const data = { inrValue: values[field], updatedById: stamp.updatedById, updatedAt: stamp.updatedAt };
    await client.exchangeRate.upsert({ where: { currency: CURRENCY_OF[field] }, create: { currency: CURRENCY_OF[field], ...data }, update: data });
  }
  return readRows(db, tx);
}

/** The exchange-rate methods of the master repository; each turns a pool or statement timeout into `DatabaseBusyError`. */
export function createExchangeRateMethods(db: PrismaClient): ExchangeRateMethods {
  return {
    readExchangeRates: () => withDatabaseErrors(() => readRows(db)),
    lockExchangeRates: (tx) =>
      withDatabaseErrors(async () => {
        await clientFor(db, tx).$executeRaw`LOCK TABLE exchange_rates IN SHARE ROW EXCLUSIVE MODE`;
      }),
    findExchangeRatesForUpdate: (tx) => withDatabaseErrors(() => selectForUpdate(db, tx)),
    saveExchangeRates: (values, stamp, tx) => withDatabaseErrors(() => writeRows(db, values, stamp, tx)),
  };
}
