import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';
import { FRESH_TREATMENTS, OTHER_TREATMENT_ID, TREATMENT_CANARIES, TREATMENT_RECIPE_ID } from '../support/treatment-canary';

/**
 * STORY-02.05 T3 (AC-2 to AC-6), through the real `withRoute`, the real session and the real masters service over in-memory storage: what each body
 * must look like, what each refusal says (the reserved names in any letter case give 422 `NAME_RESERVED` and a sentence that names neither entry;
 * the locked "Other" gives 409 on `PATCH` and on `DELETE`), that `/options/treatments` carries an ID and a name and nothing else for every role, and
 * that a strict schema keeps anything else out. Who may call is `tests/security`. Every name is invented.
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
const ALPHA = TREATMENT_RECIPE_ID;
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';

const { GET, POST } = await import('@/app/api/v1/treatments/route');
const { PATCH, DELETE } = await import('@/app/api/v1/treatments/[id]/route');
const { GET: GET_OPTIONS } = await import('@/app/api/v1/options/treatments/route');

const record = z.record(z.string(), z.unknown());

function request(method: string, body?: unknown, path = '/api/v1/treatments'): Request {
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

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ADMIN');
  // Every test starts from "Other" and the two canary treatments, whatever an earlier test added, renamed or deleted.
  harness.masters.treatments.splice(0, harness.masters.treatments.length, ...[...FRESH_TREATMENTS, ...TREATMENT_CANARIES].map((treatment) => ({ ...treatment })));
});

describe('GET /api/v1/treatments (AC-1)', () => {
  it('lists "Other" first and locked, then the treatments, each with an ID, a name and the locked flag, and no other key', async () => {
    const response = await GET(request('GET'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const treatments = z.array(record).parse(record.parse(await response.json())['treatments']);
    expect(treatments.map((treatment) => [treatment['name'], treatment['locked']])).toEqual([
      ['Other', true],
      ['Canary-Treatment-Alpha', false],
      ['Canary-Treatment-Beta', false],
    ]);
    for (const treatment of treatments) expect(Object.keys(treatment).sort()).toEqual(['id', 'locked', 'name']);
  });
});

describe('POST /api/v1/treatments (AC-2, AC-6)', () => {
  it('adds a treatment: 201, the trimmed name, and exactly one master.created entry with object_type treatment', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await POST(request('POST', { name: '  Invented anodised ' }));
    expect(response.status).toBe(201);
    expect(record.parse(await response.json())).toEqual({ id: expect.any(String), name: 'Invented anodised', locked: false });
    const entries = harness.auditWorld.audit.committed.slice(before);
    expect(entries.map((row) => [row.event, row.objectType, row.objectLabel])).toEqual([['master.created', 'treatment', 'Invented anodised']]);
  });

  it.each([
    ['a blank name', { name: '   ' }, 'Enter a name.'],
    ['a missing name', {}, 'Enter a name.'],
    ['a name that is not text', { name: 7 }, 'Enter a name.'],
    ['a name over 100 characters', { name: 'x'.repeat(101) }, 'Use 100 characters or fewer.'],
  ])('refuses %s with 422, names the field, and stores nothing', async (_what, body, message) => {
    const entries = harness.auditWorld.audit.committed.length;
    const treatments = harness.masters.treatments.length;
    const response = await POST(request('POST', body));
    expect(response.status).toBe(422);
    expect((await fieldMessages(response)).name).toBe(message);
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
    expect(harness.masters.treatments).toHaveLength(treatments);
  });

  it.each(['Other', 'OTHER', 'oTHEr', ' other ', 'Not applicable', 'NOT APPLICABLE', 'not  applicable'])(
    'refuses the name %j with 422 NAME_RESERVED and a message that names neither entry, and stores nothing (AC-2)',
    async (name) => {
      const entries = harness.auditWorld.audit.committed.length;
      const response = await POST(request('POST', { name }));
      expect(response.status).toBe(422);
      expect(await fieldMessages(response, 'NAME_RESERVED')).toEqual({ name: 'That name cannot be used.' });
      expect(harness.auditWorld.audit.committed).toHaveLength(entries);
      expect(harness.masters.treatments).toHaveLength(3);
    },
  );

  it('refuses a name another treatment has, ignoring letter case, in the words of AC-2', async () => {
    const response = await POST(request('POST', { name: 'canary-treatment-ALPHA' }));
    expect(response.status).toBe(422);
    expect(await fieldMessages(response, 'NAME_TAKEN')).toEqual({ name: 'A treatment with this name already exists.' });
  });

  it('refuses a key it does not know (a strict body) and a body that is not JSON', async () => {
    expect((await POST(request('POST', { name: 'Invented anodised', isHidden: true }))).status).toBe(422);
    expect((await POST(request('POST', { name: 'Invented anodised', locked: true }))).status).toBe(422);
    const notJson = new Request(`${ORIGIN}/api/v1/treatments`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{' });
    expect((await POST(notJson)).status).toBe(400);
  });
});

describe('PATCH /api/v1/treatments/{id} (AC-2, AC-3, AC-6)', () => {
  it('renames: 200, the ID stays, one master.edited entry with the name before and after', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await PATCH(request('PATCH', { name: ' Invented hard coat ' }), withId(ALPHA));
    expect(response.status).toBe(200);
    expect(record.parse(await response.json())).toEqual({ id: ALPHA, name: 'Invented hard coat', locked: false });
    const entries = harness.auditWorld.audit.committed.slice(before);
    expect(entries.map((row) => [row.event, row.objectType])).toEqual([['master.edited', 'treatment']]);
    expect(entries[0]).toMatchObject({ before: { name: 'Canary-Treatment-Alpha' }, after: { name: 'Invented hard coat' } });
  });

  it('writes no entry for a rename that changes nothing', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await PATCH(request('PATCH', { name: 'Canary-Treatment-Alpha' }), withId(ALPHA));
    expect(response.status).toBe(200);
    expect(harness.auditWorld.audit.committed).toHaveLength(before);
  });

  it.each(['Other', 'OTHER', ' other ', 'Not applicable', 'not  applicable'])('refuses the name %j with 422 NAME_RESERVED and changes nothing (AC-2)', async (name) => {
    const entries = harness.auditWorld.audit.committed.length;
    const response = await PATCH(request('PATCH', { name }), withId(ALPHA));
    expect(response.status).toBe(422);
    expect(await fieldMessages(response, 'NAME_RESERVED')).toEqual({ name: 'That name cannot be used.' });
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
    expect(harness.masters.treatments.find((treatment) => treatment.id === ALPHA)?.name).toBe('Canary-Treatment-Alpha');
  });

  it('refuses a rename to a name another treatment has, ignoring letter case, and allows a change of letter case of its own name', async () => {
    const taken = await PATCH(request('PATCH', { name: 'CANARY-TREATMENT-BETA' }), withId(ALPHA));
    expect(taken.status).toBe(422);
    expect(await fieldMessages(taken, 'NAME_TAKEN')).toEqual({ name: 'A treatment with this name already exists.' });
    expect((await PATCH(request('PATCH', { name: 'canary-treatment-alpha' }), withId(ALPHA))).status).toBe(200);
  });

  it('refuses the locked "Other" entry with 409 TREATMENT_LOCKED and changes nothing (AC-3)', async () => {
    const entries = harness.auditWorld.audit.committed.length;
    const response = await PATCH(request('PATCH', { name: 'Invented renamed' }), withId(OTHER_TREATMENT_ID));
    expect(response.status).toBe(409);
    expect(record.parse(await response.json())['code']).toBe('TREATMENT_LOCKED');
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
    expect(harness.masters.treatments.find((treatment) => treatment.id === OTHER_TREATMENT_ID)).toEqual(FRESH_TREATMENTS[0]);
  });

  it('answers 404 for an ID no treatment has and 422 for one that is not a UUID; an empty body and an unknown key are 422', async () => {
    expect((await PATCH(request('PATCH', { name: 'Invented hard coat' }), withId(UNKNOWN_ID))).status).toBe(404);
    expect((await PATCH(request('PATCH', { name: 'Invented hard coat' }), withId('not-an-id'))).status).toBe(422);
    expect((await PATCH(request('PATCH', {}), withId(ALPHA))).status).toBe(422);
    expect((await PATCH(request('PATCH', { isHidden: true }), withId(ALPHA))).status).toBe(422);
  });
});

describe('DELETE /api/v1/treatments/{id} (AC-3, AC-4, AC-6)', () => {
  it('deletes: 204 with no body, the treatment leaves the list, and exactly one master.deleted entry', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await DELETE(request('DELETE'), withId(ALPHA));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(harness.masters.treatments.map((treatment) => treatment.id)).not.toContain(ALPHA);
    const entries = harness.auditWorld.audit.committed.slice(before);
    expect(entries.map((row) => [row.event, row.objectType, row.objectLabel])).toEqual([['master.deleted', 'treatment', 'Canary-Treatment-Alpha']]);
    expect(entries[0]).toMatchObject({ before: { name: 'Canary-Treatment-Alpha' }, after: null });
  });

  it('refuses the locked "Other" entry with 409 TREATMENT_LOCKED and changes nothing (AC-3)', async () => {
    const entries = harness.auditWorld.audit.committed.length;
    const response = await DELETE(request('DELETE'), withId(OTHER_TREATMENT_ID));
    expect(response.status).toBe(409);
    expect(record.parse(await response.json())['code']).toBe('TREATMENT_LOCKED');
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
    expect(harness.masters.treatments.map((treatment) => treatment.id)).toContain(OTHER_TREATMENT_ID);
  });

  it('answers 404 for an unknown ID and for one deleted already, and 422 for one that is not a UUID', async () => {
    expect((await DELETE(request('DELETE'), withId(UNKNOWN_ID))).status).toBe(404);
    expect((await DELETE(request('DELETE'), withId(ALPHA))).status).toBe(204);
    expect((await DELETE(request('DELETE'), withId(ALPHA))).status).toBe(404);
    expect((await DELETE(request('DELETE'), withId('not-an-id'))).status).toBe(422);
  });
});

describe('GET /api/v1/options/treatments (AC-5)', () => {
  it.each(['ADMIN', 'LEAD', 'ENGINEER'] as const)('as %s: IDs and names only, "Other" included, through a strict schema, with no rate of any kind', async (role) => {
    harness.signInAs(role);
    const response = await GET_OPTIONS(request('GET', undefined, '/api/v1/options/treatments'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const body = record.parse(await response.json());
    expect(Object.keys(body)).toEqual(['options']);
    const options = z.array(record).parse(body['options']);
    expect(options).toEqual([...FRESH_TREATMENTS, ...TREATMENT_CANARIES].map((treatment) => ({ id: treatment.id, name: treatment.name })));
    for (const option of options) expect(Object.keys(option).sort()).toEqual(['id', 'name']);
  });
});
