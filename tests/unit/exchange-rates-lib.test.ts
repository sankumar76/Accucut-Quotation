import { describe, expect, it } from 'vitest';

import { cloneSeedConfig, seedConfig } from '../support/seed-config';
import { columnOfKey } from '@/lib/fields/lookup';
import {
  changedExchangeRates,
  EXCHANGE_RATE_LABELS,
  EXCHANGE_RATES_OBJECT_ID,
  EXCHANGE_RATES_OBJECT_TYPE,
  exchangeRateHint,
  exchangeRateProblem,
  exchangeRateProblems,
  normaliseExchangeRate,
} from '@/lib/masters/exchange-rates';
import { getExchangeRates, putExchangeRates, toExchangeRatesRow } from '@/lib/masters/exchange-rates-client';
import { AUDIT_EVENTS } from '@/server/services/audit-events';

/**
 * STORY-02.04 (AC-1 to AC-5): the pure rules of the Exchange rates tab and its route (what a typed rate may look like, what a save changes, the
 * hint made from the registry's letters), the reading of the route's answer in the browser, and the words of its audit entry. Every number is
 * invented (`n.37`, ADR-014), except inputs that test the format.
 */

const COLUMNS = {
  rate: { letter: 'BH', label: 'Exchange Rate USD' },
  price: { letter: 'BJ', label: 'Unit Production Price (USD)' },
};

describe('exchangeRateProblem (AC-2, AC-3)', () => {
  it.each(['0', '0.5', '83.37', '083.37', ' 83.37 ', '123456789012.99'])('accepts %j', (value) => {
    expect(exchangeRateProblem(value)).toBeNull();
  });

  it.each(['', '  ', '-1', '-0', '+1', 'abc', '83.371', '1e2', '1,083', '.5', '5.', '1234567890123'])('refuses %j in the words of SCR-11', (value) => {
    expect(exchangeRateProblem(value)).toBe('Enter a number, 0 or more, with up to 2 decimals.');
  });

  it('judges each field on its own and names only the ones that fail', () => {
    expect(exchangeRateProblems({ usd: '81.37', eur: '' })).toEqual({ eur: 'Enter a number, 0 or more, with up to 2 decimals.' });
    expect(exchangeRateProblems({ usd: '81.37', eur: '88.37' })).toEqual({});
  });
});

describe('normaliseExchangeRate and changedExchangeRates (AC-2, AC-4)', () => {
  it('writes a rate with two decimals and no leading zeros', () => {
    expect(normaliseExchangeRate(' 083.5 ')).toBe('83.50');
    expect(normaliseExchangeRate('0')).toBe('0.00');
  });

  it('counts a rate that was never set as changed once it is given', () => {
    expect(changedExchangeRates({ usd: null, eur: null }, { usd: '81.37', eur: '88.37' })).toEqual(['usd', 'eur']);
  });

  it('lists only the currencies that differ, comparing the same number written another way as equal', () => {
    const stored = { usd: '81.37', eur: '88.37' };
    expect(changedExchangeRates(stored, { usd: '081.37', eur: '88.37' })).toEqual([]);
    expect(changedExchangeRates(stored, { usd: '82.37', eur: '88.37' })).toEqual(['usd']);
    expect(changedExchangeRates(stored, { usd: '81.37', eur: '88.38' })).toEqual(['eur']);
    expect(changedExchangeRates(stored, { usd: '82.37', eur: '88.38' })).toEqual(['usd', 'eur']);
  });
});

describe('the labels and the hints (AC-1, AC-5, UX-23)', () => {
  it('labels the fields as AC-1 writes them', () => {
    expect(EXCHANGE_RATE_LABELS).toEqual({ usd: '1 USD in ₹', eur: '1 EUR in ₹' });
  });

  it('builds the hint of the ux-spec from the letters and the name it is given', () => {
    expect(exchangeRateHint('usd', COLUMNS)).toBe('Converts prices to US dollars. The rate (BH) feeds Unit Production Price (USD), BJ.');
    expect(exchangeRateHint('eur', { rate: { letter: 'BI', label: 'Exchange Rate EUR' }, price: { letter: 'BK', label: 'Unit Production Price (EUR)' } })).toBe(
      'Converts prices to euros. The rate (BI) feeds Unit Production Price (EUR), BK.',
    );
  });

  it('types no letter itself: other letters give a hint with those letters', () => {
    const hint = exchangeRateHint('usd', { rate: { letter: 'ZA', label: 'x' }, price: { letter: 'ZC', label: 'Moved price' } });
    expect(hint).toBe('Converts prices to US dollars. The rate (ZA) feeds Moved price, ZC.');
  });
});

describe('columnOfKey (AC-5)', () => {
  it('gives the letter and the name of the field with a key, from the document it is given', () => {
    expect(columnOfKey(seedConfig, 'exchange-rate-usd')?.letter).toBe('BH');
    expect(columnOfKey(seedConfig, 'unit-price-eur')).toEqual({ letter: 'BK', label: 'Unit Production Price (EUR)' });
  });

  it('follows a change of position, because a letter is derived and never stored', () => {
    const moved = cloneSeedConfig();
    const field = moved.fields.find((candidate) => candidate.key === 'exchange-rate-eur');
    if (field !== undefined) field.position += 1;
    expect(columnOfKey(moved, 'exchange-rate-eur')?.letter).toBe('BJ');
    expect(columnOfKey(seedConfig, 'exchange-rate-eur')?.letter).toBe('BI');
  });

  it('gives null for a key the document does not have', () => {
    expect(columnOfKey(seedConfig, 'no-such-field')).toBeNull();
  });
});

describe('the audit entry of a save (AC-4, SCR-16)', () => {
  it('keeps the fixed object id of the pair (architecture 8): a new value would split the append-only history', () => {
    expect(EXCHANGE_RATES_OBJECT_ID).toBe('00000000-0000-4000-8000-000600000001');
    expect(EXCHANGE_RATES_OBJECT_TYPE).toBe('exchange_rate');
  });

  const words = (before: unknown, after: unknown, objectType = 'exchange_rate') => AUDIT_EVENTS['master.edited'].describeStored(before, after, objectType);

  it('is a master.edited entry in the "Master data edit" category', () => {
    expect(AUDIT_EVENTS['master.edited']).toMatchObject({ status: 'wired', category: 'master_data' });
  });

  it('says both rates before and after, and "Not set yet" for a rate that was never set', () => {
    expect(words({ usd: null, eur: null }, { usd: '81.37', eur: '88.37' })).toEqual({
      before: '1 USD in ₹ Not set yet, 1 EUR in ₹ Not set yet',
      after: '1 USD in ₹ 81.37, 1 EUR in ₹ 88.37',
    });
    expect(words({ usd: '81.37', eur: '88.37' }, { usd: '82.37', eur: '88.37' })).toEqual({
      before: '1 USD in ₹ 81.37, 1 EUR in ₹ 88.37',
      after: '1 USD in ₹ 82.37, 1 EUR in ₹ 88.37',
    });
  });

  it('shows a dash for a state that does not fit the object type, and chooses the words by the type', () => {
    expect(words({ usd: '81.37', eur: '88.37' }, { usd: '82.37', eur: '88.37' }, 'process_item')).toEqual({ before: '—', after: '—' });
    // A state that is no exchange-rate shape at all is not described: the audit screen shows a dash for it (`AuditService.list`).
    expect(words({ usd: '81', eur: '88.37' }, { usd: '82.37', eur: '88.37' })).toBeNull();
  });
});

describe('the browser side of the route (AC-1, AC-2)', () => {
  const answer = {
    usd: '81.37',
    eur: null,
    updatedBy: 'Invented Admin',
    updatedAt: '2026-11-09T09:40:00.000Z',
    columns: {
      usd: COLUMNS,
      eur: { rate: { letter: 'BI', label: 'Exchange Rate EUR' }, price: { letter: 'BK', label: 'Unit Production Price (EUR)' } },
    },
  };

  const respondWith = (status: number, body: unknown): typeof fetch => () => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

  it('reads a well-formed answer, with a rate that is not set as null', () => {
    expect(toExchangeRatesRow(answer)).toEqual(answer);
  });

  it.each([
    ['a missing column', { ...answer, columns: { usd: COLUMNS } }],
    ['a rate that is a number', { ...answer, usd: 81.37 }],
    ['a stamp of the wrong type', { ...answer, updatedAt: 5 }],
    ['not an object', 'text'],
  ])('reads %s as no usable answer, not as a crash', (_what, body) => {
    expect(toExchangeRatesRow(body)).toBeNull();
  });

  it('asks with GET and sends both rates in a PUT body', async () => {
    const seen: Array<{ method: string | undefined; body: unknown }> = [];
    const recording: typeof fetch = (_input, init) => {
      seen.push({ method: init?.method, body: init?.body });
      return respondWith(200, answer)(_input, init);
    };
    expect((await getExchangeRates(recording)).status).toBe('ok');
    expect((await putExchangeRates({ usd: '81.37', eur: '88.37' }, recording)).status).toBe('ok');
    expect(seen).toEqual([
      { method: 'GET', body: undefined },
      { method: 'PUT', body: JSON.stringify({ usd: '81.37', eur: '88.37' }) },
    ]);
  });

  it('turns a 422 into a refusal that names the field, and a 503 into a failure', async () => {
    const problem = { code: 'VALIDATION_FAILED', title: 'Invalid', errors: [{ field: 'eur', message: 'Enter a number, 0 or more, with up to 2 decimals.' }] };
    expect(await putExchangeRates({ usd: '1.00', eur: 'x' }, respondWith(422, problem))).toMatchObject({ status: 'refused', fields: { eur: 'Enter a number, 0 or more, with up to 2 decimals.' } });
    expect(await getExchangeRates(respondWith(503, { code: 'DATABASE_BUSY', title: 'Busy' }))).toEqual({ status: 'failed' });
  });
});
