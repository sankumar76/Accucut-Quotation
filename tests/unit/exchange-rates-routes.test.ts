import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { EXCHANGE_RATE_CANARIES } from '../support/exchange-rate-canary';
import { harness, holdSessionClock, releaseSessionClock, SESSION_NOW } from '../support/session-harness';

/**
 * STORY-02.04 T3 (AC-1 to AC-4), through the real `withRoute`, the real session and the real masters service over in-memory storage: what the
 * body must look like, what each refusal says, that the answer is one strict shape, and that the same body gives the same result. Who may call
 * is `tests/security`. Every number is invented (`n.37`, ADR-014), except inputs that test the format.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getMastersService: () => shared.mastersService };
});

const ORIGIN = 'https://portal.example.test';
const NUMBER_MESSAGE = 'Enter a number, 0 or more, with up to 2 decimals.';
const SAVED = { usd: '81.37', eur: '88.37' } as const;

const { GET, PUT } = await import('@/app/api/v1/exchange-rates/route');

const record = z.record(z.string(), z.unknown());

function request(method: string, body?: unknown): Request {
  return new Request(`${ORIGIN}/api/v1/exchange-rates`, {
    method,
    headers: { origin: ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** The field messages of a 422, by field. */
async function fieldMessages(response: Response): Promise<Record<string, string>> {
  const body = record.parse(await response.json());
  expect(body['code']).toBe('VALIDATION_FAILED');
  return Object.fromEntries(z.array(z.object({ field: z.string(), message: z.string() })).parse(body['errors']).map((entry) => [entry.field, entry.message]));
}

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ADMIN');
  // Every test starts from the two canary rates, whatever an earlier test saved.
  harness.masters.exchange.usd = EXCHANGE_RATE_CANARIES.usd;
  harness.masters.exchange.eur = EXCHANGE_RATE_CANARIES.eur;
  harness.masters.exchange.stamp = { updatedById: harness.idOf.ADMIN, updatedByName: 'Invented Admin', updatedAt: SESSION_NOW };
});

describe('GET /api/v1/exchange-rates (AC-1, AC-5)', () => {
  it('answers the two rates, who saved them and when, and the columns of the hints, in one strict shape', async () => {
    const response = await GET(request('GET'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const body = record.parse(await response.json());
    expect(Object.keys(body).sort()).toEqual(['columns', 'eur', 'updatedAt', 'updatedBy', 'usd']);
    expect(body).toMatchObject({ usd: EXCHANGE_RATE_CANARIES.usd, eur: EXCHANGE_RATE_CANARIES.eur, updatedBy: 'Invented Admin', updatedAt: SESSION_NOW.toISOString() });
    expect(body['columns']).toEqual({
      usd: { rate: { letter: 'BH', label: 'Exchange Rate USD' }, price: { letter: 'BJ', label: 'Unit Production Price (USD)' } },
      eur: { rate: { letter: 'BI', label: 'Exchange Rate EUR' }, price: { letter: 'BK', label: 'Unit Production Price (EUR)' } },
    });
  });

  it('says "not set yet" with nulls while no rate was saved', async () => {
    Object.assign(harness.masters.exchange, { usd: null, eur: null, stamp: null });
    const body = record.parse(await (await GET(request('GET'))).json());
    expect(body).toMatchObject({ usd: null, eur: null, updatedBy: null, updatedAt: null });
  });
});

describe('PUT /api/v1/exchange-rates (AC-2, AC-4)', () => {
  it('saves both rates: 200, the rates to two decimals, the stamp, and exactly one master.edited entry of object type exchange_rate', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await PUT(request('PUT', { usd: ' 81.3 ', eur: '88.37' }));
    expect(response.status).toBe(200);
    expect(record.parse(await response.json())).toMatchObject({ usd: '81.30', eur: '88.37', updatedBy: 'Invented Admin' });
    const entries = harness.auditWorld.audit.committed.slice(before);
    expect(entries.map((row) => [row.event, row.objectType, row.objectLabel])).toEqual([['master.edited', 'exchange_rate', 'Exchange rates']]);
    expect(entries[0]).toMatchObject({
      before: { usd: EXCHANGE_RATE_CANARIES.usd, eur: EXCHANGE_RATE_CANARIES.eur },
      after: { usd: '81.30', eur: '88.37' },
    });
  });

  it('is idempotent: the same body twice gives the same answer and only the first writes an entry', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const first = await (await PUT(request('PUT', SAVED))).text();
    const second = await (await PUT(request('PUT', SAVED))).text();
    expect(second).toBe(first);
    expect(harness.auditWorld.audit.committed).toHaveLength(before + 1);
  });

  it('accepts 0 for a rate (assumption A-1)', async () => {
    const response = await PUT(request('PUT', { usd: '0', eur: '0.00' }));
    expect(response.status).toBe(200);
    expect(record.parse(await response.json())).toMatchObject({ usd: '0.00', eur: '0.00' });
  });

  it.each([
    ['a blank value', { usd: '' }, 'usd'],
    ['spaces only', { eur: '   ' }, 'eur'],
    ['a negative value', { usd: '-1' }, 'usd'],
    ['a non-numeric value', { eur: 'abc' }, 'eur'],
    ['three decimals', { usd: '81.371' }, 'usd'],
    ['a sign', { eur: '+88.37' }, 'eur'],
    ['a JSON number (a rate is decimal text)', { usd: 81.37 }, 'usd'],
    ['null', { eur: null }, 'eur'],
  ])('refuses %s with 422, names the field, and neither rate changes', async (_what, change, field) => {
    const entries = harness.auditWorld.audit.committed.length;
    const response = await PUT(request('PUT', { ...SAVED, ...change }));
    expect(response.status).toBe(422);
    expect((await fieldMessages(response))[field]).toBe(NUMBER_MESSAGE);
    expect(harness.masters.exchange).toMatchObject({ usd: EXCHANGE_RATE_CANARIES.usd, eur: EXCHANGE_RATE_CANARIES.eur });
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
  });

  it('names a missing field, and every failing field at once', async () => {
    const missing = await PUT(request('PUT', { usd: SAVED.usd }));
    expect(missing.status).toBe(422);
    expect(Object.keys(await fieldMessages(missing))).toEqual(['eur']);
    const both = await PUT(request('PUT', { usd: '', eur: '-1' }));
    expect(Object.keys(await fieldMessages(both)).sort()).toEqual(['eur', 'usd']);
  });

  it('refuses a key it does not know (a strict body) and a body that is not JSON', async () => {
    expect((await PUT(request('PUT', { ...SAVED, gbp: '99.37' }))).status).toBe(422);
    const notJson = new Request(`${ORIGIN}/api/v1/exchange-rates`, { method: 'PUT', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{' });
    expect((await PUT(notJson)).status).toBe(400);
  });

  it('refuses a request from another origin before it reads anything (CSRF)', async () => {
    const foreign = new Request(`${ORIGIN}/api/v1/exchange-rates`, {
      method: 'PUT',
      headers: { origin: 'https://evil.example.test', 'content-type': 'application/json' },
      body: JSON.stringify(SAVED),
    });
    expect((await PUT(foreign)).status).toBe(403);
    expect(harness.masters.exchange.usd).toBe(EXCHANGE_RATE_CANARIES.usd);
  });
});
