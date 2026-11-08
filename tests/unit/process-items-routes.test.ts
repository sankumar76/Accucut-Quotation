import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { seedRecords } from '../support/fake-masters';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-02.01 T3 (AC-2 to AC-5): the contract of the Process master routes, through the real `withRoute`, the real session and the
 * real masters service over in-memory storage and the seed registry. What each body must look like, what each refusal says, which
 * formulas the 409 lists, and that a strict schema keeps anything else out. Who may call is `tests/security`. Every name and number
 * is invented (`n.37`).
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
const CUTTING = '00000000-0000-4000-8000-000400000001';
const PLATING = '00000000-0000-4000-8000-000400000009';
const FOAM = '00000000-0000-4000-8000-000400000011';

const { GET, POST } = await import('@/app/api/v1/process-items/route');
const { PATCH, DELETE } = await import('@/app/api/v1/process-items/[id]/route');

const record = z.record(z.string(), z.unknown());

function request(method: string, body?: unknown): Request {
  return new Request(`${ORIGIN}/api/v1/process-items`, {
    method,
    headers: { origin: ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const added = { name: '  Buffing-rate-per-sqin ', unit: 'per sq in', defaultValue: ' 1.5 ' };

/** The field messages of a 422, by field. `code` is the machine-readable reason: the generic one, or the one a name refusal carries. */
async function fieldMessages(response: Response, code = 'VALIDATION_FAILED'): Promise<Record<string, string>> {
  const body = record.parse(await response.json());
  expect(body['code']).toBe(code);
  return Object.fromEntries(z.array(z.object({ field: z.string(), message: z.string() })).parse(body['errors']).map((entry) => [entry.field, entry.message]));
}

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ADMIN');
  // Every test starts from the 15 seed rates, whatever an earlier test changed or deleted.
  harness.masters.records.splice(0, harness.masters.records.length, ...seedRecords());
});

describe('GET /api/v1/process-items (AC-1)', () => {
  it('lists the 15 rates with name, unit, default value and the formulas that use each, and no other field', async () => {
    const response = await GET(request('GET'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const items = z.array(record).parse(record.parse(await response.json())['processItems']);
    expect(items).toHaveLength(15);
    for (const item of items) expect(Object.keys(item).sort()).toEqual(['defaultValue', 'id', 'name', 'unit', 'usedBy']);
    expect(items.find((item) => item['id'] === CUTTING)).toMatchObject({ name: 'Cutting-Rate-per-Sec', unit: 'per second', usedBy: [{ letter: 'AL', label: 'Cutting Cost' }] });
    expect(items.find((item) => item['id'] === PLATING)).toMatchObject({ name: 'Plating-rate-per-sqin', usedBy: [] });
  });
});

describe('POST /api/v1/process-items (AC-2, AC-5)', () => {
  it('adds a rate: 201, the trimmed name, the value to two decimals, and one master.created entry', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await POST(request('POST', added));
    expect(response.status).toBe(201);
    expect(record.parse(await response.json())).toEqual({
      id: expect.any(String),
      name: 'Buffing-rate-per-sqin',
      unit: 'per sq in',
      defaultValue: '1.50',
      usedBy: [],
    });
    expect(harness.auditWorld.audit.committed.slice(before).map((row) => row.event)).toEqual(['master.created']);
  });

  it.each([
    ['an empty name', { name: '' }, 'name', 'Enter a name.'],
    ['a name of spaces', { name: '   ' }, 'name', 'Enter a name.'],
    ['a name over 100 characters', { name: 'x'.repeat(101) }, 'name', 'Use 100 characters or fewer.'],
    ['no unit', { unit: '' }, 'unit', 'Choose a unit.'],
    ['a unit that is not on the list', { unit: 'per minute' }, 'unit', 'Choose a unit.'],
    ['an empty value', { defaultValue: '' }, 'defaultValue', 'Enter a number, 0 or more, with up to 2 decimals.'],
    ['three decimals', { defaultValue: '1.234' }, 'defaultValue', 'Enter a number, 0 or more, with up to 2 decimals.'],
    ['a negative number', { defaultValue: '-1' }, 'defaultValue', 'Enter a number, 0 or more, with up to 2 decimals.'],
    ['a number written with an exponent', { defaultValue: '1e3' }, 'defaultValue', 'Enter a number, 0 or more, with up to 2 decimals.'],
    ['a JSON number (a rate is decimal text, not a floating-point number)', { defaultValue: 1.5 }, 'defaultValue', 'Enter a number, 0 or more, with up to 2 decimals.'],
  ])('refuses %s with 422 and the sentence of SCR-11 under the field', async (_what, change, field, message) => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await POST(request('POST', { ...added, ...change }));
    expect(response.status).toBe(422);
    expect((await fieldMessages(response))[field]).toBe(message);
    expect(harness.auditWorld.audit.committed).toHaveLength(before);
  });

  it('refuses a name another rate has, ignoring letter case, in the words of AC-2', async () => {
    const response = await POST(request('POST', { ...added, name: 'FOAM COST' }));
    expect(response.status).toBe(422);
    expect(await fieldMessages(response, 'NAME_TAKEN')).toEqual({ name: 'A rate with this name already exists.' });
  });

  it('refuses a name that is a valid column letter (letters move), without repeating the name', async () => {
    const response = await POST(request('POST', { ...added, name: 'AL' }));
    expect(response.status).toBe(422);
    const messages = await fieldMessages(response, 'RATE_NAME_REFUSED');
    expect(messages['name']).toContain('column letters');
    expect(messages['name']).not.toContain('AL');
  });

  it('refuses a key it does not know (a strict body) and a body that is not JSON', async () => {
    expect((await POST(request('POST', { ...added, id: FOAM }))).status).toBe(422);
    const notJson = new Request(`${ORIGIN}/api/v1/process-items`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{' });
    expect((await POST(notJson)).status).toBe(400);
  });
});

describe('PATCH /api/v1/process-items/{id} (AC-3, AC-5)', () => {
  it('changes the name, the unit and the value; the ID stays; the answer still lists the formulas', async () => {
    const response = await PATCH(request('PATCH', { name: 'Foam-Cost-per-sqft', unit: 'per kg', defaultValue: '21.37' }), withId(FOAM));
    expect(response.status).toBe(200);
    expect(record.parse(await response.json())).toEqual({
      id: FOAM,
      name: 'Foam-Cost-per-sqft',
      unit: 'per kg',
      defaultValue: '21.37',
      usedBy: [{ letter: 'AW', label: 'Foam Cost' }],
    });
  });

  it('reads an ID written in capitals as the same rate (the schema writes it in lower case, as PostgreSQL returns it)', async () => {
    harness.masters.records.push({ id: 'abcdef00-0000-4000-8000-000000000001', name: 'Invented-rate-per-sqin', unit: 'per kg', defaultValue: '0.00' });
    const response = await PATCH(request('PATCH', { defaultValue: '3.37' }), withId('ABCDEF00-0000-4000-8000-000000000001'));
    expect(response.status).toBe(200);
    expect(record.parse(await response.json())).toMatchObject({ id: 'abcdef00-0000-4000-8000-000000000001', defaultValue: '3.37' });
  });

  it('refuses an empty change, an ID that is not a UUID, and an unknown key', async () => {
    expect((await PATCH(request('PATCH', {}), withId(FOAM))).status).toBe(422);
    expect((await PATCH(request('PATCH', { defaultValue: '1.37' }), withId('not-an-id'))).status).toBe(422);
    expect((await PATCH(request('PATCH', { defaultValue: '1.37', note: 'x' }), withId(FOAM))).status).toBe(422);
  });

  it('answers 404 for a rate that does not exist', async () => {
    const response = await PATCH(request('PATCH', { defaultValue: '1.37' }), withId('00000000-0000-4000-8000-0bbb00000009'));
    expect(response.status).toBe(404);
  });

  it('refuses a name another rate has, and a name that reads as other rates and a minus sign (DEF-006)', async () => {
    expect(await fieldMessages(await PATCH(request('PATCH', { name: 'transport %' }), withId(FOAM)), 'NAME_TAKEN')).toEqual({ name: 'A rate with this name already exists.' });
    const response = await PATCH(request('PATCH', { name: 'Welding-rate-per-kg-Foam Cost' }), withId(PLATING));
    // A hyphen joins words; "Welding-rate-per-kg" is a rate and "-Foam Cost" is a minus sign and a rate: two rates and an operator.
    expect(response.status).toBe(422);
  });
});

describe('DELETE /api/v1/process-items/{id} (AC-4, AC-5)', () => {
  it('refuses a rate a formula uses: 409, the sentence of SCR-11, the formulas listed, and nothing changes', async () => {
    const entries = harness.auditWorld.audit.committed.length;
    const response = await DELETE(request('DELETE'), withId(CUTTING));
    expect(response.status).toBe(409);
    expect(response.headers.get('Content-Type')).toBe('application/problem+json');
    expect(record.parse(await response.json())).toMatchObject({
      status: 409,
      code: 'PROCESS_ITEM_IN_USE',
      title: 'Cutting-Rate-per-Sec cannot be deleted while a formula uses it',
      usedBy: [{ letter: 'AL', label: 'Cutting Cost' }],
    });
    expect(harness.masters.records.some((entry) => entry.id === CUTTING)).toBe(true);
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
  });

  it('deletes a rate no formula uses: 204 with no body, and one master.deleted entry', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await DELETE(request('DELETE'), withId(PLATING));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(harness.masters.records.some((entry) => entry.id === PLATING)).toBe(false);
    expect(harness.auditWorld.audit.committed.slice(before).map((row) => row.event)).toEqual(['master.deleted']);
  });

  it('answers 404 for a rate that is gone', async () => {
    expect((await DELETE(request('DELETE'), withId(PLATING))).status).toBe(204);
    expect((await DELETE(request('DELETE'), withId(PLATING))).status).toBe(404);
  });
});
