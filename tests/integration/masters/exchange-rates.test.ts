import { randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FieldValidationError } from '@/lib/errors';
import { createFixedClock, formatIst } from '@/lib/time';
import { EXCHANGE_RATES_OBJECT_ID } from '@/lib/masters/exchange-rates';
import { createTransactionRunner, type TransactionRunner } from '@/server/repositories/transaction';

import { contextOf, entriesFor, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';
import { createLateFailingRunner } from '../../support/late-failure-runner';
import { refusal } from '../../support/user-service-fixture';

/**
 * STORY-02.04 T1, T2 and T5 (AC-1 to AC-4) against real PostgreSQL in a throwaway database: the rules the table itself keeps (two currencies, a
 * rate of 0 or more, no DELETE and no TRUNCATE for the runtime role), and the Exchange Rate Master over the real repositories: both rates saved
 * together with one stamp, exactly one audit entry for a save that changes a rate and none for one that does not, a refused save changing
 * neither rate, and two saves at once. Names and numbers are invented (`n.37`, ADR-014), except inputs that test the format (zero, a sign, a
 * third decimal).
 *
 * The audit entry commits with its change or not at all (DEF-017): the late-failure tests use the shared runner of tech-debt #130
 * (`tests/support/late-failure-runner.ts`), which fails only the outermost transaction, so an entry written in a second transaction inside the
 * change would stay behind and fail the test. Plants A3 (such an entry on the first save) and A4 (on a later save) each fail this file.
 */

const LATE_FAILURE = 'a failure after the entry was written';
const SAVED = { usd: '83.37', eur: '90.37' } as const;
const NUMBER_MESSAGE = 'Enter a number, 0 or more, with up to 2 decimals.';
/** 23:59:59 IST on 9 Nov 2026, one second before midnight there (IST is UTC+05:30 all year). */
const BEFORE_MIDNIGHT_IST = new Date('2026-11-09T18:29:59.000Z');

let db: AuditDatabase;
let adminId: string;

/** A request ID of each test's own: the audit log is never emptied, so a test finds its entries by it. */
let requestId = '';

const by = () => ({ ...contextOf(adminId), requestId });

interface RateDbRow {
  readonly currency: string;
  readonly inr_value: string;
  readonly updated_by: string;
  readonly updated_at: Date;
}

async function rows(): Promise<RateDbRow[]> {
  const { rows: found } = await db.owner.query<RateDbRow>('SELECT currency, inr_value::text, updated_by::text, updated_at FROM exchange_rates ORDER BY currency');
  return found;
}

async function valueOf(currency: 'USD' | 'EUR'): Promise<string | undefined> {
  return (await rows()).find((row) => row.currency === currency)?.inr_value;
}

/** The entries this test made about the pair (the object ID is fixed; the request ID is the test's). */
async function entries() {
  return (await entriesFor(db, EXCHANGE_RATES_OBJECT_ID)).filter((entry) => entry.request_id === requestId);
}

/** Empties the table after a test, whether it passed or failed, so one failure is reported once and not again by every test after it. */
const emptyTable = async (): Promise<void> => {
  await db.owner.query('DELETE FROM exchange_rates');
};

beforeEach(() => {
  requestId = `req-${randomBytes(4).toString('hex')}`;
});

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

describe('AC-1 (T1): the table starts empty, and the pair reads as "not set yet"', () => {
  it('holds no rate after the migration: no real rate is committed (ADR-014)', async () => {
    expect(await rows()).toEqual([]);
    expect(await db.masterRepository.readExchangeRates()).toEqual({ usd: null, eur: null, stamp: null });
  });

  it('reads as no rates, no stamp, and the letters of the four columns from the registry', async () => {
    const view = await db.mastersService.getExchangeRates();
    expect(view).toMatchObject({ usd: null, eur: null, updatedBy: null, updatedAt: null });
    expect(view.columns).toEqual({
      usd: { rate: { letter: 'BH', label: 'Exchange Rate USD' }, price: { letter: 'BJ', label: 'Unit Production Price (USD)' } },
      eur: { rate: { letter: 'BI', label: 'Exchange Rate EUR' }, price: { letter: 'BK', label: 'Unit Production Price (EUR)' } },
    });
  });
});

describe('AC-2 (T1): what the table keeps, whoever writes to it', () => {
  afterEach(emptyTable);

  const insert = 'INSERT INTO exchange_rates (currency, inr_value, updated_by) VALUES ($1, $2, $3)';

  it('refuses a currency other than USD and EUR, and a rate below 0, even to the owner (the CHECK constraints)', async () => {
    await expect(db.owner.query(insert, ['GBP', '1.37', adminId])).rejects.toMatchObject({ constraint: 'ck_exchange_rates_currency' });
    await expect(db.owner.query(insert, ['USD', '-0.01', adminId])).rejects.toMatchObject({ constraint: 'ck_exchange_rates_inr_value_not_negative' });
    expect(await rows()).toEqual([]);
  });

  it('accepts a rate of 0 (assumption A-1: the division-by-zero case CE-8 runs a zero rate)', async () => {
    await db.owner.query(insert, ['USD', '0', adminId]);
    expect(await valueOf('USD')).toBe('0.0000');
  });

  it('keeps one row for a currency and refuses a stamp by a person who does not exist (primary key and foreign key)', async () => {
    await db.owner.query(insert, ['USD', '1.37', adminId]);
    await expect(db.owner.query(insert, ['USD', '2.37', adminId])).rejects.toMatchObject({ constraint: 'exchange_rates_pkey' });
    await expect(db.owner.query(insert, ['EUR', '2.37', '00000000-0000-4000-8000-0ccc00000009'])).rejects.toMatchObject({ constraint: 'fk_exchange_rates_updated_by' });
  });

  it('lets the runtime role read, add and change rows, and gives it no DELETE and no TRUNCATE', async () => {
    await db.owner.query(insert, ['USD', '1.37', adminId]);
    const privileges = await db.owner.query<{ privilege: string; granted: boolean }>(
      `SELECT p AS privilege, has_table_privilege('accucut_app', 'exchange_rates', p) AS granted FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) AS p`,
    );
    expect(Object.fromEntries(privileges.rows.map((row) => [row.privilege, row.granted]))).toEqual({
      SELECT: true,
      INSERT: true,
      UPDATE: true,
      DELETE: false,
      TRUNCATE: false,
    });
  });
});

describe('AC-2, AC-4 (T2): saving the pair', () => {
  afterEach(emptyTable);

  it('stores both rates with one stamp (who, when in UTC) and writes exactly one master.edited entry of object type exchange_rate', async () => {
    const clock = createFixedClock(new Date('2026-11-09T09:40:00.000Z'));
    const before = await entryCount(db);
    const view = await db.buildMastersService({ clock }).saveExchangeRates(by(), SAVED);

    expect(view).toMatchObject({ usd: '83.37', eur: '90.37', updatedBy: 'Invented Admin', updatedAt: '2026-11-09T09:40:00.000Z' });
    const stored = await rows();
    expect(stored.map((row) => [row.currency, row.inr_value])).toEqual([
      ['EUR', '90.3700'],
      ['USD', '83.3700'],
    ]);
    for (const row of stored) {
      expect(row.updated_by).toBe(adminId);
      expect(row.updated_at.toISOString()).toBe('2026-11-09T09:40:00.000Z');
    }
    expect(await entryCount(db)).toBe(before + 1);
    const [entry, ...others] = await entries();
    expect(others).toEqual([]);
    expect(entry).toMatchObject({
      event: 'master.edited',
      actor_id: adminId,
      actor_label: 'Invented Admin',
      object_type: 'exchange_rate',
      object_id: EXCHANGE_RATES_OBJECT_ID,
      object_label: 'Exchange rates',
      before: { usd: null, eur: null },
      after: { usd: '83.37', eur: '90.37' },
      request_id: requestId,
    });
  });

  it('is idempotent: the same body again gives the same state, the same stamp and no second entry', async () => {
    const clock = createFixedClock(new Date('2026-11-09T09:40:00.000Z'));
    const service = db.buildMastersService({ clock });
    const first = await service.saveExchangeRates(by(), SAVED);
    clock.advance(60_000);
    const second = await service.saveExchangeRates(by(), SAVED);
    // The same number written another way is the same value too.
    const third = await service.saveExchangeRates(by(), { usd: '083.37', eur: ' 90.37' });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(await entries()).toHaveLength(1);
    expect((await rows()).every((row) => row.updated_at.toISOString() === '2026-11-09T09:40:00.000Z')).toBe(true);
  });

  it('records a change of one rate with both rates before and after, and stamps both rows with the new save', async () => {
    const clock = createFixedClock(new Date('2026-11-09T09:40:00.000Z'));
    const service = db.buildMastersService({ clock });
    await service.saveExchangeRates(by(), SAVED);
    clock.advance(3_600_000);
    const other = await insertPersonAsOwner(db, 'Second Admin', 'LEAD');
    const view = await service.saveExchangeRates({ ...contextOf(other, 'Invented Second Admin'), requestId }, { usd: '84.37', eur: SAVED.eur });

    expect(view).toMatchObject({ usd: '84.37', eur: '90.37', updatedBy: 'Invented Second Admin', updatedAt: '2026-11-09T10:40:00.000Z' });
    const stored = await rows();
    expect(stored.map((row) => row.updated_by)).toEqual([other, other]);
    const edits = await entries();
    expect(edits).toHaveLength(2);
    expect(edits[1]).toMatchObject({ before: { usd: '83.37', eur: '90.37' }, after: { usd: '84.37', eur: '90.37' }, actor_id: other });
  });

  it('accepts 0 (assumption A-1) and writes the stored value with two decimals', async () => {
    const view = await db.mastersService.saveExchangeRates(by(), { usd: '0', eur: '0.5' });
    expect(view).toMatchObject({ usd: '0.00', eur: '0.50' });
    expect(await valueOf('USD')).toBe('0.0000');
  });

  it('shows the stamp across midnight IST: the instant is stored in UTC, and 00:00:01 IST is a different day from 23:59:59 IST', async () => {
    const clock = createFixedClock(BEFORE_MIDNIGHT_IST);
    const service = db.buildMastersService({ clock });
    const first = (await service.saveExchangeRates(by(), SAVED)).updatedAt;
    clock.advance(2_000);
    const second = (await service.saveExchangeRates(by(), { usd: '84.37', eur: SAVED.eur })).updatedAt;
    expect([first, second]).toEqual(['2026-11-09T18:29:59.000Z', '2026-11-09T18:30:01.000Z']);
    // The day the screen shows (SCR-13 writes the stamp with `formatIst`): 23:59:59 on 9 Nov, then 00:00:01 on 10 Nov.
    expect([formatIst(new Date(defined(first))), formatIst(new Date(defined(second)))]).toEqual(['09 Nov 2026, 23:59 IST', '10 Nov 2026, 00:00 IST']);
  });

  it('puts the saver\'s current name in the view, not the name they had when they saved', async () => {
    await db.mastersService.saveExchangeRates(by(), SAVED);
    await db.owner.query('UPDATE users SET name = $2 WHERE id = $1', [adminId, 'Invented Renamed Admin']);
    expect((await db.mastersService.getExchangeRates()).updatedBy).toBe('Invented Renamed Admin');
    await db.owner.query('UPDATE users SET name = $2 WHERE id = $1', [adminId, 'Invented Admin']);
  });
});

describe('AC-3 (T2): a value the rules refuse changes neither rate and writes nothing', () => {
  afterEach(emptyTable);

  it.each([
    ['blank', '', 'usd'],
    ['spaces only', '   ', 'eur'],
    ['negative', '-1.37', 'usd'],
    ['not a number', 'abc', 'eur'],
    ['a sign', '+83.37', 'usd'],
    ['three decimals', '83.371', 'eur'],
    ['an exponent', '1e2', 'usd'],
    ['a thousands separator', '1,083.37', 'eur'],
  ])('refuses a %s value, naming the field', async (_name, value, field) => {
    await db.mastersService.saveExchangeRates(by(), SAVED);
    const entriesBefore = await entryCount(db);
    const wanted = { ...SAVED, [field]: value };

    const error = await refusal(db.mastersService.saveExchangeRates(by(), wanted));

    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({ fields: [{ field, message: NUMBER_MESSAGE }] });
    expect(await valueOf('USD')).toBe('83.3700');
    expect(await valueOf('EUR')).toBe('90.3700');
    expect(await entryCount(db)).toBe(entriesBefore);
  });

  it('names both fields when both are wrong, and stores nothing on the first save', async () => {
    const error = await refusal(db.mastersService.saveExchangeRates(by(), { usd: '', eur: '-1' }));
    expect(error).toMatchObject({ fields: [{ field: 'usd' }, { field: 'eur' }] });
    expect(await rows()).toEqual([]);
    expect(await entries()).toEqual([]);
  });
});

describe('AC-4 (DEF-017): an entry commits with its change, or not at all', () => {
  afterEach(emptyTable);

  /** The outermost transaction fails after its work; one opened inside it commits (tests/support/late-failure-runner.ts, #130). */
  function failingAfterTheLastStep(): TransactionRunner {
    return createLateFailingRunner(createTransactionRunner(db.prisma), new Error(LATE_FAILURE));
  }

  it('first save (create): no rate is left and no entry is kept', async () => {
    const entriesBefore = await entryCount(db);
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });
    await expect(service.saveExchangeRates(by(), SAVED)).rejects.toThrow(LATE_FAILURE);
    expect(await rows()).toEqual([]);
    expect(await entryCount(db)).toBe(entriesBefore);
  });

  it('a later save (edit): the rates are as they were, with their stamp, and no entry is kept', async () => {
    await db.buildMastersService({ clock: createFixedClock(new Date('2026-11-09T09:40:00.000Z')) }).saveExchangeRates(by(), SAVED);
    const stored = await rows();
    const entriesBefore = await entryCount(db);
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });
    await expect(service.saveExchangeRates(by(), { usd: '99.37', eur: '98.37' })).rejects.toThrow(LATE_FAILURE);
    expect(await rows()).toEqual(stored);
    expect(await entryCount(db)).toBe(entriesBefore);
  });

  it('an entry the audit service refuses takes the first save back (a rate is never saved without its record)', async () => {
    const entriesBefore = await entryCount(db);
    // An empty actor label is refused by the audit service, inside the transaction of the save.
    await expect(db.mastersService.saveExchangeRates({ ...by(), actorLabel: '' }, SAVED)).rejects.toMatchObject({ reason: 'shape' });
    expect(await rows()).toEqual([]);
    expect(await entryCount(db)).toBe(entriesBefore);
  });

  it('an entry the audit service refuses takes a later save back (NFR-007)', async () => {
    await db.mastersService.saveExchangeRates(by(), SAVED);
    const stored = await rows();
    const entriesBefore = await entryCount(db);
    await expect(db.mastersService.saveExchangeRates({ ...by(), actorLabel: '' }, { usd: '1.37', eur: '2.37' })).rejects.toMatchObject({ reason: 'shape' });
    expect(await rows()).toEqual(stored);
    expect(await entryCount(db)).toBe(entriesBefore);
  });
});

describe('two saves at once', () => {
  afterEach(emptyTable);

  it('wait for each other: the state is one save entire, never half of each, and the entry of the second holds the state the first left', async () => {
    const left = { usd: '81.37', eur: '91.37' };
    const right = { usd: '82.37', eur: '92.37' };
    await Promise.all([db.mastersService.saveExchangeRates(by(), left), db.mastersService.saveExchangeRates(by(), right)]);

    const finalState = { usd: await valueOf('USD'), eur: await valueOf('EUR') };
    const isLeft = isDeepStrictEqual(finalState, { usd: '81.3700', eur: '91.3700' });
    const isRight = isDeepStrictEqual(finalState, { usd: '82.3700', eur: '92.3700' });
    expect(isLeft || isRight, 'one save entire').toBe(true);

    const saved = await entries();
    expect(saved).toHaveLength(2);
    // Whichever went first: the entry that starts from "not set" is the first, and the other one starts from where it ended. Nothing here orders
    // the entries by time (QLT-03).
    const first = saved.find((entry) => isDeepStrictEqual(entry.before, { usd: null, eur: null }));
    const second = saved.find((entry) => entry !== first);
    expect(defined(second).before).toEqual(defined(first).after);
  });
});
