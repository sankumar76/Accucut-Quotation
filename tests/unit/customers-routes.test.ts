import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { CUSTOMER_CANARIES, CUSTOMER_CANARY_PHONE, CUSTOMER_RECIPE_ID } from '../support/customer-canary';
import { defined } from '../support/defined';
import { fakeCustomer } from '../support/fake-customers';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-02.02 T4 (AC-1, AC-2, AC-3, AC-5, AC-6), through the real `withRoute`, the real session and the real masters service over in-memory storage: what
 * each body must look like, what each refusal says (in the words of AC-1 and AC-2, under the field they name), that a save and a reset that change nothing
 * write no entry, that the reset answers with the count, and that `/options/customers` carries an ID and a name and nothing else for every role.
 * Who may call is `tests/security`. Every name, address and number is invented.
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
const ALPHA = CUSTOMER_RECIPE_ID;
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';
/** The first seed item (a per-second rate) and the first percent item. */
const FIRST_ITEM = '00000000-0000-4000-8000-000400000001';
const PERCENT_ITEM = '00000000-0000-4000-8000-000400000013';

const { GET, POST } = await import('@/app/api/v1/customers/route');
const { PATCH } = await import('@/app/api/v1/customers/[id]/route');
const { POST: RESET } = await import('@/app/api/v1/customers/[id]/reset-rates/route');
const { GET: GET_OPTIONS } = await import('@/app/api/v1/options/customers/route');

const record = z.record(z.string(), z.unknown());

function request(method: string, body?: unknown, path = '/api/v1/customers'): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const withId = (id: string) => ({ params: Promise.resolve({ id }) });

/** The field messages of a 422, by field. `code` is the machine-readable reason: the generic one, or the one a name refusal carries. */
async function fieldMessages(response: Response, code = 'VALIDATION_FAILED'): Promise<Record<string, string>> {
  const body = record.parse(await response.json());
  expect(body['code']).toBe(code);
  return Object.fromEntries(z.array(z.object({ field: z.string(), message: z.string() })).parse(body['errors']).map((entry) => [entry.field, entry.message]));
}

const entriesSince = (count: number) => harness.auditWorld.audit.committed.slice(count);

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ADMIN');
  // Every test starts from the canary customer and nothing else, with every default at 0.00, whatever an earlier test added or changed.
  for (const item of harness.masters.records) item.defaultValue = '0.00';
  harness.masters.customers.splice(
    0,
    harness.masters.customers.length,
    ...CUSTOMER_CANARIES.map((canary) => ({
      ...fakeCustomer(harness.masters.records, canary.name, Object.fromEntries(canary.rates.map((rate) => [rate.processItemId, rate.value])), { phone: canary.phone }),
      id: canary.id,
    })),
  );
});

describe('GET /api/v1/customers (AC-1)', () => {
  it('lists each customer with its details and how many rates differ, and no other key', async () => {
    const response = await GET(request('GET'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const customers = z.array(record).parse(record.parse(await response.json())['customers']);
    expect(customers).toEqual([{ id: ALPHA, name: 'Canary-Customer-Alpha', phone: CUSTOMER_CANARY_PHONE, email: null, address: null, differ: 2 }]);
  });
});

describe('POST /api/v1/customers (AC-1, AC-6)', () => {
  it('adds a customer with a name only: 201, the name trimmed, 15 rates at the current default, and exactly one master.created entry with object_type customer', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await POST(request('POST', { name: '  Invented Works ' }));
    expect(response.status).toBe(201);
    const body = record.parse(await response.json());
    expect(body).toMatchObject({ id: expect.any(String), name: 'Invented Works', phone: null, email: null, address: null });
    expect(z.array(record).parse(body['rates'])).toHaveLength(15);
    for (const rate of z.array(record).parse(body['rates'])) {
      expect(Object.keys(rate).sort()).toEqual(['defaultValue', 'name', 'processItemId', 'unit', 'value']);
      expect(rate['value']).toBe(rate['defaultValue']);
    }
    const entries = entriesSince(before);
    expect(entries.map((row) => [row.event, row.objectType, row.objectLabel])).toEqual([['master.created', 'customer', 'Invented Works']]);
    expect(entries[0]).toMatchObject({ before: null, after: { name: 'Invented Works', contact: [] } });
  });

  it('keeps the contact details given and records their names in the entry and never their values', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await POST(request('POST', { name: 'Invented Works', phone: '+99 555 0142', email: 'buying@invented.example.test', address: null }));
    expect(response.status).toBe(201);
    expect(record.parse(await response.json())).toMatchObject({ phone: '+99 555 0142', email: 'buying@invented.example.test', address: null });
    const entry = defined(entriesSince(before)[0]);
    expect(entry.after).toMatchObject({ contact: ['phone', 'email'] });
    expect(JSON.stringify(entry)).not.toMatch(/555 0142|invented\.example/);
  });

  it.each([
    ['a blank name', { name: '   ' }, 'name', 'Enter the customer name.'],
    ['a missing name', {}, 'name', 'Enter the customer name.'],
    ['a name that is not text', { name: 7 }, 'name', 'Enter the customer name.'],
    ['a name over 100 characters', { name: 'x'.repeat(101) }, 'name', 'Use 100 characters or fewer.'],
    ['an e-mail address with no @', { name: 'Invented Works', email: 'not-an-address' }, 'email', 'Enter an e-mail address like name@company.com.'],
    ['an e-mail address with no dot after the @', { name: 'Invented Works', email: 'name@company' }, 'email', 'Enter an e-mail address like name@company.com.'],
    ['an e-mail address with a space', { name: 'Invented Works', email: 'na me@company.com' }, 'email', 'Enter an e-mail address like name@company.com.'],
    ['a phone number over 30 characters', { name: 'Invented Works', phone: '9'.repeat(31) }, 'phone', 'Use 30 characters or fewer.'],
    ['an address over 300 characters', { name: 'Invented Works', address: 'x'.repeat(301) }, 'address', 'Use 300 characters or fewer.'],
  ])('refuses %s with 422, names the field, and stores nothing', async (_what, body, field, message) => {
    const entries = harness.auditWorld.audit.committed.length;
    const customers = harness.masters.customers.length;
    const response = await POST(request('POST', body));
    expect(response.status).toBe(422);
    expect((await fieldMessages(response))[field]).toBe(message);
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
    expect(harness.masters.customers).toHaveLength(customers);
  });

  it('refuses a name another customer has, ignoring letter case, in the words of AC-1, and stores nothing', async () => {
    const entries = harness.auditWorld.audit.committed.length;
    const response = await POST(request('POST', { name: 'canary-customer-ALPHA' }));
    expect(response.status).toBe(422);
    expect(await fieldMessages(response, 'NAME_TAKEN')).toEqual({ name: 'A customer with this name already exists.' });
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
  });

  it('refuses a key the route does not offer (a strict body), such as a rate or a deleted flag', async () => {
    for (const extra of [{ deletedAt: '2026-01-01' }, { rates: [] }, { id: ALPHA }]) {
      expect((await POST(request('POST', { name: 'Invented Works', ...extra }))).status).toBe(422);
    }
    expect(harness.masters.customers).toHaveLength(1);
  });
});

describe('PATCH /api/v1/customers/{id} (AC-2, AC-6)', () => {
  it('sets a rate: 200, the customer as it is now, and one master.edited entry with only that rate, old value before and new value after', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await PATCH(request('PATCH', { rates: [{ processItemId: FIRST_ITEM, value: '8.5' }] }, `/api/v1/customers/${ALPHA}`), withId(ALPHA));
    expect(response.status).toBe(200);
    const rates = z.array(record).parse(record.parse(await response.json())['rates']);
    expect(rates.find((rate) => rate['processItemId'] === FIRST_ITEM)?.['value']).toBe('8.50');
    const entry = defined(entriesSince(before)[0]);
    expect(entry).toMatchObject({ event: 'master.edited', objectType: 'customer', objectLabel: 'Canary-Customer-Alpha' });
    expect(entry.before).toMatchObject({ contact: [], rates: [{ processItemId: FIRST_ITEM, value: '881.37' }] });
    expect(entry.after).toMatchObject({ contact: [], rates: [{ processItemId: FIRST_ITEM, value: '8.50' }] });
  });

  it('changes the name and clears a contact field with null, and names the changed fields on both sides of the entry', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await PATCH(request('PATCH', { name: 'Renamed Works', phone: null, email: 'new@invented.example.test' }), withId(ALPHA));
    expect(response.status).toBe(200);
    expect(record.parse(await response.json())).toMatchObject({ name: 'Renamed Works', phone: null, email: 'new@invented.example.test' });
    const entry = defined(entriesSince(before)[0]);
    expect(entry).toMatchObject({ objectLabel: 'Renamed Works', before: { name: 'Canary-Customer-Alpha', contact: ['phone', 'email'] }, after: { name: 'Renamed Works', contact: ['phone', 'email'] } });
  });

  it('writes no entry for a save that changes nothing: the same values, rates typed as stored', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const same = await PATCH(request('PATCH', { name: ' Canary-Customer-Alpha ', phone: CUSTOMER_CANARY_PHONE, rates: [{ processItemId: FIRST_ITEM, value: '881.37' }] }), withId(ALPHA));
    expect(same.status).toBe(200);
    expect(entriesSince(before)).toEqual([]);
  });

  it.each([
    ['three decimals', { processItemId: FIRST_ITEM, value: '1.234' }, 'Enter a number, 0 or more, with up to 2 decimals.'],
    ['a negative number', { processItemId: FIRST_ITEM, value: '-1' }, 'Enter a number, 0 or more, with up to 2 decimals.'],
    ['text', { processItemId: FIRST_ITEM, value: 'many' }, 'Enter a number, 0 or more, with up to 2 decimals.'],
    ['decimals on a percent rate', { processItemId: PERCENT_ITEM, value: '11.5' }, 'Enter a whole number, 0 or more.'],
  ])('refuses a rate with %s with 422 under the rate, and changes nothing', async (_what, rate, message) => {
    const entries = harness.auditWorld.audit.committed.length;
    const response = await PATCH(request('PATCH', { rates: [rate] }), withId(ALPHA));
    expect(response.status).toBe(422);
    expect(await fieldMessages(response)).toEqual({ 'rates.0.value': message });
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
  });

  it('accepts a whole number on a percent rate, and zero on any rate', async () => {
    const response = await PATCH(request('PATCH', { rates: [{ processItemId: PERCENT_ITEM, value: '12' }, { processItemId: FIRST_ITEM, value: '0' }] }), withId(ALPHA));
    expect(response.status).toBe(200);
    const rates = z.array(record).parse(record.parse(await response.json())['rates']);
    expect(rates.find((rate) => rate['processItemId'] === PERCENT_ITEM)?.['value']).toBe('12.00');
    expect(rates.find((rate) => rate['processItemId'] === FIRST_ITEM)?.['value']).toBe('0.00');
  });

  it('answers 409 RATES_CHANGED for a rate the customer does not have, and 422 for a body that is empty, has an unknown key, or names a rate twice', async () => {
    const gone = await PATCH(request('PATCH', { rates: [{ processItemId: UNKNOWN_ID, value: '1.00' }] }), withId(ALPHA));
    expect(gone.status).toBe(409);
    expect(record.parse(await gone.json())['code']).toBe('RATES_CHANGED');
    expect((await PATCH(request('PATCH', {}), withId(ALPHA))).status).toBe(422);
    expect((await PATCH(request('PATCH', { deletedAt: null }), withId(ALPHA))).status).toBe(422);
    const twice = [{ processItemId: FIRST_ITEM, value: '1.00' }, { processItemId: FIRST_ITEM, value: '2.00' }];
    expect((await PATCH(request('PATCH', { rates: twice }), withId(ALPHA))).status).toBe(422);
  });

  it('answers 404 for an unknown ID, and 422 for one that is not a UUID', async () => {
    expect((await PATCH(request('PATCH', { name: 'Anything' }), withId(UNKNOWN_ID))).status).toBe(404);
    expect((await PATCH(request('PATCH', { name: 'Anything' }), withId('not-an-id'))).status).toBe(422);
  });
});

describe('POST /api/v1/customers/{id}/reset-rates (AC-3, AC-6)', () => {
  it('resets every rate that differs to the current default: 200, the customer and the count, and one master.edited entry with no contact and only those rates', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await RESET(request('POST', undefined, `/api/v1/customers/${ALPHA}/reset-rates`), withId(ALPHA));
    expect(response.status).toBe(200);
    const body = record.parse(await response.json());
    expect(body['count']).toBe(2);
    const rates = z.array(record).parse(record.parse(body['customer'])['rates']);
    expect(rates.every((rate) => rate['value'] === rate['defaultValue'])).toBe(true);
    const entry = defined(entriesSince(before)[0]);
    expect(entry).toMatchObject({ event: 'master.edited', objectType: 'customer', before: { contact: [] }, after: { contact: [] } });
    expect((entry.before as { rates: unknown[] }).rates).toHaveLength(2);
  });

  it('is idempotent: the second reset is a count of 0 and writes no entry', async () => {
    await RESET(request('POST'), withId(ALPHA));
    const before = harness.auditWorld.audit.committed.length;
    const response = await RESET(request('POST'), withId(ALPHA));
    expect(response.status).toBe(200);
    expect(record.parse(await response.json())['count']).toBe(0);
    expect(entriesSince(before)).toEqual([]);
  });

  it('answers 404 for an unknown ID and writes nothing', async () => {
    const entries = harness.auditWorld.audit.committed.length;
    expect((await RESET(request('POST'), withId(UNKNOWN_ID))).status).toBe(404);
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
  });
});

describe('GET /api/v1/options/customers (AC-5)', () => {
  it.each(['ADMIN', 'LEAD', 'ENGINEER'] as const)('as %s: IDs and names only, through a strict schema, with no contact detail and no rate', async (role) => {
    harness.signInAs(role);
    const response = await GET_OPTIONS(request('GET', undefined, '/api/v1/options/customers'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const text = await response.text();
    const body = record.parse(JSON.parse(text));
    expect(Object.keys(body)).toEqual(['options']);
    expect(z.array(record).parse(body['options'])).toEqual([{ id: ALPHA, name: 'Canary-Customer-Alpha' }]);
    for (const secret of [CUSTOMER_CANARY_PHONE, '881.37', '882.37']) expect(text).not.toContain(secret);
  });
});
