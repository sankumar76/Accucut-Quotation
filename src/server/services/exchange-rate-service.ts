import { FieldValidationError } from '../../lib/errors';
import { columnOfKey } from '../../lib/fields/lookup';
import type { ConfigDocument } from '../../lib/fields/schema';
import {
  changedExchangeRates,
  EXCHANGE_RATE_FIELDS,
  EXCHANGE_RATES_LABEL,
  EXCHANGE_RATES_OBJECT_ID,
  EXCHANGE_RATES_OBJECT_TYPE,
  exchangeRateProblems,
  normaliseExchangeRate,
  type ExchangeRateColumns,
  type ExchangeRateField,
  type ExchangeRateValues,
  type StoredExchangeRates,
} from '../../lib/masters/exchange-rates';
import { systemClock, type Clock } from '../../lib/time';
import type { ExchangeRatesRecord, MasterRepository } from '../repositories/master-repository';
import type { Transaction, TransactionRunner } from '../repositories/transaction';

import type { AuditContext, AuditService } from './audit-service';

/**
 * The Exchange Rate Master (STORY-02.04; FR-011, FR-016; architecture sections 4.1, 5.1, 6 and 8): the Admin keeps 1 US dollar and 1 euro in
 * rupees, with who saved them and when. Who may call it is decided before it is reached (`withRoute`, the manifest, BR-003 and BR-004); this
 * file holds the rules that stay true whoever asks:
 *
 *   - **Both rates are saved together** (AC-2): one call carries both, one transaction writes both rows with one stamp (the person and the
 *     instant, from the service's clock, so a test moves time), and a body that repeats what is stored changes nothing.
 *   - **A rate is a number of 0 or more with up to two decimals** (AC-3), checked here as well as at the route, so a caller that did not go
 *     through the schema is refused the same way and neither rate changes. Zero is accepted on purpose (assumption A-1).
 *   - **One audit entry per save that changes a rate** (AC-4): `master.edited`, `object_type` `exchange_rate`, with both rates before and after,
 *     written with the change's own `tx` (DEF-017). A save that changes nothing writes no stamp and no entry. The table is locked first and
 *     its rows next, so two saves cannot overlap.
 *   - **The hints name their columns from the registry** (AC-5, UX-23): the view carries the letter and the name of the rate columns and of the
 *     price columns they feed, taken from the current configuration version at each read, so a later re-lettering is followed.
 *
 * The configuration is read, and the columns of the hints worked out, before the transaction opens, so a failure to read it or to name a column
 * happens before anything is written (QLT-05), never after a save that has been committed.
 */

/** The fields of the registry the hints name, by key (`prisma/seed/config/seed-config.ts`): the rate column and the price that divides by it. */
const COLUMN_KEYS: Readonly<Record<ExchangeRateField, { readonly rate: string; readonly price: string }>> = {
  usd: { rate: 'exchange-rate-usd', price: 'unit-price-usd' },
  eur: { rate: 'exchange-rate-eur', price: 'unit-price-eur' },
};

/** The two rates as SCR-13 shows them: decimal text, or null while never set; who saved them and when; and the columns the hints name. */
export interface ExchangeRatesView extends StoredExchangeRates {
  /** The name of the person who last saved a change, now; null while no rate was ever saved. */
  readonly updatedBy: string | null;
  /** The instant of that save, as an ISO 8601 text in UTC (the screen shows it in IST); null while no rate was ever saved. */
  readonly updatedAt: string | null;
  readonly columns: Readonly<Record<ExchangeRateField, ExchangeRateColumns>>;
}

export interface ExchangeRateOperations {
  /** The two rates, the stamp and the columns for the hints. Admin only (the route says so). */
  getExchangeRates(): Promise<ExchangeRatesView>;
  /**
   * Saves both rates. 422 naming the field for a blank, negative, non-numeric or three-decimal value (nothing is stored). A save that changes
   * nothing writes no stamp and no entry, and answers with the state as it is.
   */
  saveExchangeRates(context: AuditContext, input: ExchangeRateValues): Promise<ExchangeRatesView>;
}

export interface ExchangeRateDependencies {
  readonly masters: MasterRepository;
  readonly transactions: TransactionRunner;
  readonly audit: AuditService;
  /** The document of the current configuration version, where the letters of the hints are read. Fails if there is none. */
  currentConfiguration(): Promise<ConfigDocument>;
  /** The one source of "now" for the stamp (coding standards section 10, "Dates"). The system clock when none is given. */
  readonly clock?: Clock | undefined;
}

/** The column the registry has for a key. A configuration without it is damaged, and says so loudly rather than printing a typed letter. */
function columnFor(document: ConfigDocument, key: string) {
  const column = columnOfKey(document, key);
  if (column === null) throw new Error(`The current configuration has no field "${key}", so the exchange-rate hints cannot name its column.`);
  return column;
}

function columnsOf(document: ConfigDocument): ExchangeRatesView['columns'] {
  const forField = (field: ExchangeRateField): ExchangeRateColumns => ({
    rate: columnFor(document, COLUMN_KEYS[field].rate),
    price: columnFor(document, COLUMN_KEYS[field].price),
  });
  return { usd: forField('usd'), eur: forField('eur') };
}

function viewOf(record: ExchangeRatesRecord, columns: ExchangeRatesView['columns']): ExchangeRatesView {
  return {
    usd: record.usd,
    eur: record.eur,
    updatedBy: record.stamp?.updatedByName ?? null,
    updatedAt: record.stamp?.updatedAt.toISOString() ?? null,
    columns,
  };
}

/** What an audit entry keeps of the pair (`exchangeRateState` in `audit-events.ts`). */
function auditState(record: ExchangeRatesRecord): StoredExchangeRates {
  return { usd: record.usd, eur: record.eur };
}

/** The server's own refusal of a value the route's schema would refuse: the same words, for a caller that did not go through it. */
function assertValid(input: ExchangeRateValues): void {
  const problems = exchangeRateProblems(input);
  const refused = EXCHANGE_RATE_FIELDS.flatMap((field) => {
    const message = problems[field];
    return message === undefined ? [] : [{ field, message }];
  });
  if (refused.length > 0) throw new FieldValidationError(refused);
}

/** Takes the table lock, then the rows; writes both rates and the entry only if a rate changes. All in the caller's transaction. */
async function change(
  { masters, audit, clock = systemClock }: ExchangeRateDependencies,
  tx: Transaction,
  context: AuditContext,
  wanted: ExchangeRateValues,
): Promise<ExchangeRatesRecord> {
  await masters.lockExchangeRates(tx);
  const before = await masters.findExchangeRatesForUpdate(tx);
  if (changedExchangeRates(before, wanted).length === 0) return before;
  const after = await masters.saveExchangeRates(wanted, { updatedById: context.actorId, updatedAt: clock.now() }, tx);
  await audit.record(tx, {
    event: 'master.edited',
    ...context,
    objectType: EXCHANGE_RATES_OBJECT_TYPE,
    object: { id: EXCHANGE_RATES_OBJECT_ID, label: EXCHANGE_RATES_LABEL },
    before: auditState(before),
    after: auditState(after),
  });
  return after;
}

/** The exchange-rate methods of the masters service. */
export function createExchangeRateOperations(dependencies: ExchangeRateDependencies): ExchangeRateOperations {
  const { masters, transactions, currentConfiguration } = dependencies;
  return {
    async getExchangeRates() {
      const [record, document] = await Promise.all([masters.readExchangeRates(), currentConfiguration()]);
      return viewOf(record, columnsOf(document));
    },

    async saveExchangeRates(context, input) {
      assertValid(input);
      const wanted: ExchangeRateValues = { usd: normaliseExchangeRate(input.usd), eur: normaliseExchangeRate(input.eur) };
      // The columns are worked out before anything is written: a registry that cannot name them fails the save, and does not leave it half done.
      const columns = columnsOf(await currentConfiguration());
      const record = await transactions.run((tx) => change(dependencies, tx, context, wanted));
      return viewOf(record, columns);
    },
  };
}
