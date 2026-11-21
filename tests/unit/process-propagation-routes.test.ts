import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defined } from '../support/defined';
import { fakeCustomer, type FakeCustomer } from '../support/fake-customers';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-02.08 AC-1 to AC-4 and AC-7 (the contract), through the real `withRoute`, the real session and the real masters service over in-memory storage: what
 * the save answers when a default changes, what `POST /process-items/{id}/propagation` accepts and refuses (a strict body, 422 for a client that bypasses the
 * dialog, 409 for a default that changed again, 404 for an unknown rate), and the counts it answers. Who may call is `tests/security`; the rules against PostgreSQL
 * are `tests/integration/masters/process-propagation.test.ts`. Every name and number is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getMastersService: () => shared.mastersService };
});

const ORIGIN = 'https://portal.example.test';
const CUTTING = '00000000-0000-4000-8000-000400000001';
const UNKNOWN_ITEM = '00000000-0000-4000-8000-0bbb00000009';
const UNKNOWN_CUSTOMER = '00000000-0000-4000-8000-00000000dead';
const OLD = '1.37';
const NEW = '1.52';

const { PATCH } = await import('@/app/api/v1/process-items/[id]/route');
const { POST } = await import('@/app/api/v1/process-items/[id]/propagation/route');

const record = z.record(z.string(), z.unknown());

function request(method: string, body?: unknown, path = '/api/v1/process-items'): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const choose = (body: unknown, id = CUTTING) => POST(request('POST', body, `/api/v1/process-items/${id}/propagation`), withId(id));

/** The messages of a 422, by field. */
async function fieldMessages(response: Response): Promise<Record<string, string>> {
  const body = record.parse(await response.json());
  expect(body['code']).toBe('VALIDATION_FAILED');
  return Object.fromEntries(z.array(z.object({ field: z.string(), message: z.string() })).parse(body['errors']).map((entry) => [entry.field, entry.message]));
}

let marlow: FakeCustomer;
let orchid: FakeCustomer;
let equal: FakeCustomer;

const valueOf = (customer: FakeCustomer): string | undefined => customer.values.get(CUTTING);
const entries = () => harness.auditWorld.audit.committed.length;

/** What the dialog sends for the two customers that differ, with the choice given for each. */
const dialog = (marlowChoice: string, orchidChoice: string) => ({
  newDefault: NEW,
  choices: [
    { customerId: marlow.id, choice: marlowChoice, shownValue: '1.50' },
    { customerId: orchid.id, choice: orchidChoice, shownValue: '1.45' },
  ],
});

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ADMIN');
  for (const item of harness.masters.records) item.defaultValue = '0.00';
  defined(harness.masters.records.find((item) => item.id === CUTTING)).defaultValue = OLD;
  marlow = fakeCustomer(harness.masters.records, 'Marlow Agro', { [CUTTING]: '1.50' });
  orchid = fakeCustomer(harness.masters.records, 'Orchid Rail', { [CUTTING]: '1.45' });
  equal = fakeCustomer(harness.masters.records, 'Alpha Works');
  harness.masters.customers.splice(0, harness.masters.customers.length, marlow, orchid, equal);
});

describe('AC-1, AC-2: PATCH answers what the new default did to the customers', () => {
  it('moves the customers on the old default and lists the ones that differ with ID, name and current value', async () => {
    const before = entries();
    const response = await PATCH(request('PATCH', { defaultValue: NEW }), withId(CUTTING));
    expect(response.status).toBe(200);
    const body = record.parse(await response.json());
    expect(body['propagation']).toEqual({
      previousDefault: OLD,
      moved: 1,
      differing: [
        { customerId: marlow.id, name: 'Marlow Agro', value: '1.50' },
        { customerId: orchid.id, name: 'Orchid Rail', value: '1.45' },
      ],
    });
    expect(body['customersWithOwnValue']).toBe(2);
    expect([valueOf(equal), valueOf(marlow), valueOf(orchid)]).toEqual([NEW, '1.50', '1.45']);
    // The rate's own entry, then one for the customer that moved.
    expect(harness.auditWorld.audit.committed.slice(before).map((row) => [row.event, row.objectType])).toEqual([
      ['master.edited', 'process_item'],
      ['master.edited', 'customer'],
    ]);
  });

  it('answers propagation null for a save that changes only the name', async () => {
    const response = await PATCH(request('PATCH', { name: 'Cutting-Rate-renamed' }), withId(CUTTING));
    expect(record.parse(await response.json())['propagation']).toBeNull();
    expect([valueOf(equal), valueOf(marlow)]).toEqual([OLD, '1.50']);
  });
});

describe('AC-3: POST /api/v1/process-items/{id}/propagation', () => {
  it('applies Apply, keeps Keep, answers 200 with the counts and writes one entry for the customer changed', async () => {
    const before = entries();
    await PATCH(request('PATCH', { defaultValue: NEW }), withId(CUTTING));
    const afterSave = entries();
    const response = await choose(dialog('apply', 'keep'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(record.parse(await response.json())).toEqual({ applied: 1, kept: 1, skipped: 0 });
    expect([valueOf(marlow), valueOf(orchid)]).toEqual([NEW, '1.45']);
    expect(harness.auditWorld.audit.committed.slice(afterSave).map((row) => [row.event, row.objectType])).toEqual([['master.edited', 'customer']]);
    expect(afterSave).toBeGreaterThan(before);
  });

  it('accepts a request with no choices: nothing changes and every count is 0', async () => {
    await PATCH(request('PATCH', { defaultValue: NEW }), withId(CUTTING));
    expect(record.parse(await (await choose({ newDefault: NEW, choices: [] })).json())).toEqual({ applied: 0, kept: 0, skipped: 0 });
  });

  it('reads an ID written in capitals as the same rate and the same customer', async () => {
    await PATCH(request('PATCH', { defaultValue: NEW }), withId(CUTTING));
    const body = { newDefault: NEW, choices: [{ customerId: marlow.id.toUpperCase(), choice: 'apply', shownValue: '1.50' }] };
    expect(record.parse(await (await choose(body, CUTTING.toUpperCase())).json())).toEqual({ applied: 1, kept: 0, skipped: 0 });
  });
});

describe('AC-4: stale and unsafe input', () => {
  it('skips a customer whose value changed since it was listed, and overwrites nothing', async () => {
    await PATCH(request('PATCH', { defaultValue: NEW }), withId(CUTTING));
    marlow.values.set(CUTTING, '1.99');
    expect(record.parse(await (await choose(dialog('apply', 'apply'))).json())).toEqual({ applied: 1, kept: 0, skipped: 1 });
    expect(valueOf(marlow)).toBe('1.99');
  });

  it('skips a customer that was deleted since', async () => {
    await PATCH(request('PATCH', { defaultValue: NEW }), withId(CUTTING));
    orchid.deleted = true;
    expect(record.parse(await (await choose(dialog('apply', 'apply'))).json())).toEqual({ applied: 1, kept: 0, skipped: 1 });
    expect(valueOf(orchid)).toBe('1.45');
  });

  it('answers 409 DEFAULT_CHANGED when the default is no longer the one chosen for, and changes nothing', async () => {
    await PATCH(request('PATCH', { defaultValue: NEW }), withId(CUTTING));
    await PATCH(request('PATCH', { defaultValue: '1.60' }), withId(CUTTING));
    const before = entries();
    const response = await choose(dialog('apply', 'apply'));
    expect(response.status).toBe(409);
    expect(record.parse(await response.json())['code']).toBe('DEFAULT_CHANGED');
    expect([valueOf(marlow), valueOf(orchid)]).toEqual(['1.50', '1.45']);
    expect(entries()).toBe(before);
  });

  it('answers 404 for a rate that does not exist, and 422 for an ID that is not a UUID', async () => {
    expect((await choose({ newDefault: NEW, choices: [] }, UNKNOWN_ITEM)).status).toBe(404);
    expect((await choose({ newDefault: NEW, choices: [] }, 'not-an-id')).status).toBe(422);
  });

  it.each([
    ['an unknown customer', (): unknown => ({ newDefault: NEW, choices: [{ customerId: UNKNOWN_CUSTOMER, choice: 'apply', shownValue: '1.50' }] }), 'choices.0.customerId', 'This customer does not exist.'],
    ['a customer listed twice', (): unknown => ({ newDefault: NEW, choices: [{ customerId: marlow.id, choice: 'apply', shownValue: '1.50' }, { customerId: marlow.id, choice: 'keep', shownValue: '1.50' }] }), 'choices.1.customerId', 'This customer is listed twice.'],
    ['a customer ID that is not a UUID', (): unknown => ({ newDefault: NEW, choices: [{ customerId: 'not-an-id', choice: 'apply', shownValue: '1.50' }] }), 'choices.0.customerId', 'Not a customer ID.'],
    ['a choice other than apply or keep', (): unknown => ({ newDefault: NEW, choices: [{ customerId: marlow.id, choice: 'delete', shownValue: '1.50' }] }), 'choices.0.choice', 'Choose apply or keep.'],
    ['no shown value', (): unknown => ({ newDefault: NEW, choices: [{ customerId: marlow.id, choice: 'apply' }] }), 'choices.0.shownValue', 'Send the value as it was listed: a number with up to 4 decimals, as text.'],
    ['a shown value that is a JSON number', (): unknown => ({ newDefault: NEW, choices: [{ customerId: marlow.id, choice: 'apply', shownValue: 1.5 }] }), 'choices.0.shownValue', 'Send the value as it was listed: a number with up to 4 decimals, as text.'],
    ['a shown value with an exponent', (): unknown => ({ newDefault: NEW, choices: [{ customerId: marlow.id, choice: 'apply', shownValue: '1e3' }] }), 'choices.0.shownValue', 'Send the value as it was listed: a number with up to 4 decimals, as text.'],
    ['a new default that is not decimal text', (): unknown => ({ newDefault: 1.52, choices: [] }), 'newDefault', 'Enter a number, 0 or more, with up to 2 decimals.'],
    ['more than 1,000 choices', (): unknown => ({ newDefault: NEW, choices: Array.from({ length: 1001 }, () => ({ customerId: marlow.id, choice: 'keep', shownValue: '1.50' })) }), 'choices', 'Choose for at most 1,000 customers at a time.'],
  ])('refuses %s with 422 under the field it names, and changes nothing', async (_what, body, field, message) => {
    await PATCH(request('PATCH', { defaultValue: NEW }), withId(CUTTING));
    const before = entries();
    const response = await choose(body());
    expect(response.status).toBe(422);
    expect((await fieldMessages(response))[field]).toBe(message);
    expect([valueOf(marlow), valueOf(orchid)]).toEqual(['1.50', '1.45']);
    expect(entries()).toBe(before);
  });

  it('accepts exactly 1,000 choices', async () => {
    await PATCH(request('PATCH', { defaultValue: NEW }), withId(CUTTING));
    const choices = Array.from({ length: 1000 }, (_, index) => ({ customerId: index === 0 ? marlow.id : UNKNOWN_CUSTOMER, choice: 'keep', shownValue: '1.50' }));
    // 999 of them name the same unknown customer, so the service refuses them: the point is that the schema let 1,000 through.
    const response = await choose({ newDefault: NEW, choices });
    expect(response.status).toBe(422);
    expect(Object.keys(await fieldMessages(response))).not.toContain('choices');
  });

  it('refuses a key it does not know (a strict body, at the top and on a choice) and a body that is not JSON', async () => {
    expect((await choose({ ...dialog('keep', 'keep'), note: 'x' })).status).toBe(422);
    expect((await choose({ newDefault: NEW, choices: [{ customerId: marlow.id, choice: 'keep', shownValue: '1.50', value: '2.00' }] })).status).toBe(422);
    const notJson = new Request(`${ORIGIN}/api/v1/process-items/${CUTTING}/propagation`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{' });
    expect((await POST(notJson, withId(CUTTING))).status).toBe(400);
  });
});
