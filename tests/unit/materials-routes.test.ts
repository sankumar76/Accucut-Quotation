import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { MATERIAL_CANARIES, MATERIAL_RECIPE_ID } from '../support/material-master-canary';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-02.03 T3 (AC-2 to AC-5), through the real `withRoute`, the real session and the real masters service over in-memory storage: what
 * each body must look like, what each refusal says, that a specific gravity of 0 or below is refused with 422 on `POST` and on `PATCH`
 * (UX-37, FR-015), that `/options/materials` carries no rate of any kind, and that a strict schema keeps anything else out. Who may call is
 * `tests/security`. Every name and number is invented (`n.37`, ADR-014), except inputs that test the format.
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
const ALPHA = MATERIAL_RECIPE_ID;
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';

const { GET, POST } = await import('@/app/api/v1/materials/route');
const { PATCH } = await import('@/app/api/v1/materials/[id]/route');
const { GET: GET_OPTIONS } = await import('@/app/api/v1/options/materials/route');

const record = z.record(z.string(), z.unknown());

function request(method: string, body?: unknown, path = '/api/v1/materials'): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const added = {
  materialInDrawing: '  Invented-plate-grade-Q ',
  materialConsidered: ' Invented alloy ',
  pricePerKg: ' 58.3 ',
  specificGravity: '7.37',
  scrapRate: '22.37',
};

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
  // Every test starts from the two canary materials, whatever an earlier test added or changed.
  harness.masters.materials.splice(0, harness.masters.materials.length, ...MATERIAL_CANARIES.map((material) => ({ ...material })));
});

describe('GET /api/v1/materials (AC-1)', () => {
  it('lists the materials with the five fields and the ID, and no other key', async () => {
    const response = await GET(request('GET'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const materials = z.array(record).parse(record.parse(await response.json())['materials']);
    expect(materials).toHaveLength(MATERIAL_CANARIES.length);
    for (const material of materials) {
      expect(Object.keys(material).sort()).toEqual(['id', 'materialConsidered', 'materialInDrawing', 'pricePerKg', 'scrapRate', 'specificGravity']);
    }
  });
});

describe('POST /api/v1/materials (AC-2, AC-3, AC-5)', () => {
  it('adds a material: 201, the trimmed names, every number to two decimals, and exactly one master.created entry with object_type material', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await POST(request('POST', added));
    expect(response.status).toBe(201);
    const saved = record.parse(await response.json());
    expect(saved).toEqual({
      id: expect.any(String),
      materialInDrawing: 'Invented-plate-grade-Q',
      materialConsidered: 'Invented alloy',
      pricePerKg: '58.30',
      specificGravity: '7.37',
      scrapRate: '22.37',
    });
    const entries = harness.auditWorld.audit.committed.slice(before);
    expect(entries.map((row) => [row.event, row.objectType, row.objectLabel])).toEqual([['master.created', 'material', 'Invented-plate-grade-Q']]);
  });

  it('accepts a specific gravity of 0.01 and a price and scrap rate of 0 (AC-2 edge cases)', async () => {
    const response = await POST(request('POST', { ...added, specificGravity: '0.01', pricePerKg: '0', scrapRate: '0.00' }));
    expect(response.status).toBe(201);
    expect(record.parse(await response.json())).toMatchObject({ specificGravity: '0.01', pricePerKg: '0.00', scrapRate: '0.00' });
  });

  it.each([
    ['a blank name', { materialInDrawing: '   ' }, 'materialInDrawing', 'Enter the Material in Drawing.'],
    ['a name over 100 characters', { materialInDrawing: 'x'.repeat(101) }, 'materialInDrawing', 'Use 100 characters or fewer.'],
    ['a blank Material Considered', { materialConsidered: '' }, 'materialConsidered', 'Enter the Material Considered.'],
    ['a negative price', { pricePerKg: '-1' }, 'pricePerKg', 'Enter a number, 0 or more, with up to 2 decimals.'],
    ['a price with three decimals', { pricePerKg: '58.123' }, 'pricePerKg', 'Enter a number, 0 or more, with up to 2 decimals.'],
    ['a scrap rate with three decimals', { scrapRate: '1.234' }, 'scrapRate', 'Enter a number, 0 or more, with up to 2 decimals.'],
    ['a negative scrap rate', { scrapRate: '-0.01' }, 'scrapRate', 'Enter a number, 0 or more, with up to 2 decimals.'],
    ['a JSON number for a price (a price is decimal text)', { pricePerKg: 58.37 }, 'pricePerKg', 'Enter a number, 0 or more, with up to 2 decimals.'],
    ['a specific gravity of 0 (UX-37)', { specificGravity: '0' }, 'specificGravity', 'Enter a value above 0.'],
    ['a specific gravity of 0.00', { specificGravity: '0.00' }, 'specificGravity', 'Enter a value above 0.'],
    ['a negative specific gravity', { specificGravity: '-2' }, 'specificGravity', 'Enter a value above 0.'],
    ['a specific gravity with three decimals', { specificGravity: '7.375' }, 'specificGravity', 'Enter a number above 0, with up to 2 decimals.'],
    ['a specific gravity that is not a number', { specificGravity: 'heavy' }, 'specificGravity', 'Enter a number above 0, with up to 2 decimals.'],
  ])('refuses %s with 422, names the field, and stores nothing', async (_what, change, field, message) => {
    const entries = harness.auditWorld.audit.committed.length;
    const materials = harness.masters.materials.length;
    const response = await POST(request('POST', { ...added, ...change }));
    expect(response.status).toBe(422);
    expect((await fieldMessages(response))[field]).toBe(message);
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
    expect(harness.masters.materials).toHaveLength(materials);
  });

  it('names every failing field at once', async () => {
    const response = await POST(request('POST', { ...added, materialInDrawing: '', specificGravity: '0', pricePerKg: '-1' }));
    expect(response.status).toBe(422);
    expect(Object.keys(await fieldMessages(response)).sort()).toEqual(['materialInDrawing', 'pricePerKg', 'specificGravity']);
  });

  it('refuses a name another material has, ignoring letter case, in the words of AC-2', async () => {
    const response = await POST(request('POST', { ...added, materialInDrawing: 'canary-material-ALPHA' }));
    expect(response.status).toBe(422);
    expect(await fieldMessages(response, 'NAME_TAKEN')).toEqual({ materialInDrawing: 'A material with this name already exists. Names must be unique.' });
  });

  it('refuses a key it does not know (a strict body) and a body that is not JSON', async () => {
    expect((await POST(request('POST', { ...added, isHidden: true }))).status).toBe(422);
    const notJson = new Request(`${ORIGIN}/api/v1/materials`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{' });
    expect((await POST(notJson)).status).toBe(400);
  });
});

describe('PATCH /api/v1/materials/{id} (AC-2, AC-3, AC-5)', () => {
  it('changes any of the fields: 200, the ID stays, one master.edited entry with the material before and after', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await PATCH(request('PATCH', { scrapRate: '24.37', materialConsidered: ' Invented considered ' }), withId(ALPHA));
    expect(response.status).toBe(200);
    expect(record.parse(await response.json())).toMatchObject({ id: ALPHA, scrapRate: '24.37', materialConsidered: 'Invented considered', specificGravity: '737.37' });
    const entries = harness.auditWorld.audit.committed.slice(before);
    expect(entries.map((row) => [row.event, row.objectType])).toEqual([['master.edited', 'material']]);
    expect(entries[0]).toMatchObject({ before: expect.objectContaining({ scrapRate: '717.37' }), after: expect.objectContaining({ scrapRate: '24.37' }) });
  });

  it('writes no entry for a save that changes nothing', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await PATCH(request('PATCH', { specificGravity: '737.37', materialInDrawing: 'Canary-Material-Alpha' }), withId(ALPHA));
    expect(response.status).toBe(200);
    expect(harness.auditWorld.audit.committed).toHaveLength(before);
  });

  it.each([
    ['a specific gravity of 0', { specificGravity: '0' }, 'specificGravity', 'Enter a value above 0.'],
    ['a negative specific gravity', { specificGravity: '-0.5' }, 'specificGravity', 'Enter a value above 0.'],
    ['a negative price', { pricePerKg: '-3' }, 'pricePerKg', 'Enter a number, 0 or more, with up to 2 decimals.'],
    ['a scrap rate with three decimals', { scrapRate: '2.345' }, 'scrapRate', 'Enter a number, 0 or more, with up to 2 decimals.'],
    ['a blank name', { materialInDrawing: ' ' }, 'materialInDrawing', 'Enter the Material in Drawing.'],
  ])('refuses %s with 422, names the field, and changes nothing (UX-37)', async (_what, change, field, message) => {
    const entries = harness.auditWorld.audit.committed.length;
    const response = await PATCH(request('PATCH', change), withId(ALPHA));
    expect(response.status).toBe(422);
    expect((await fieldMessages(response))[field]).toBe(message);
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
    expect(harness.masters.materials.find((material) => material.id === ALPHA)).toMatchObject({ specificGravity: '737.37', pricePerKg: '917373.37' });
  });

  it('refuses a rename to a name another material has, ignoring letter case, and allows a change of letter case of its own name', async () => {
    const taken = await PATCH(request('PATCH', { materialInDrawing: 'CANARY-MATERIAL-BETA' }), withId(ALPHA));
    expect(taken.status).toBe(422);
    expect(await fieldMessages(taken, 'NAME_TAKEN')).toEqual({ materialInDrawing: 'A material with this name already exists. Names must be unique.' });
    const recased = await PATCH(request('PATCH', { materialInDrawing: 'canary-material-alpha' }), withId(ALPHA));
    expect(recased.status).toBe(200);
  });

  it('answers 404 for an ID no material has and 422 for one that is not a UUID; an empty body and an unknown key are 422', async () => {
    expect((await PATCH(request('PATCH', { scrapRate: '1.37' }), withId(UNKNOWN_ID))).status).toBe(404);
    expect((await PATCH(request('PATCH', { scrapRate: '1.37' }), withId('not-an-id'))).status).toBe(422);
    expect((await PATCH(request('PATCH', {}), withId(ALPHA))).status).toBe(422);
    expect((await PATCH(request('PATCH', { isHidden: true }), withId(ALPHA))).status).toBe(422);
  });
});

describe('GET /api/v1/options/materials (AC-4, AC-6)', () => {
  it.each(['ADMIN', 'LEAD', 'ENGINEER'] as const)('as %s: IDs, names and Material Considered only, through a strict schema, with no rate of any kind', async (role) => {
    harness.signInAs(role);
    const response = await GET_OPTIONS(request('GET', undefined, '/api/v1/options/materials'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const text = await response.text();
    const body = record.parse(JSON.parse(text));
    expect(Object.keys(body)).toEqual(['options']);
    const options = z.array(record).parse(body['options']);
    expect(options).toEqual(
      MATERIAL_CANARIES.map((material) => ({ id: material.id, name: material.materialInDrawing, materialConsidered: material.materialConsidered })),
    );
    for (const option of options) expect(Object.keys(option).sort()).toEqual(['id', 'materialConsidered', 'name']);
    // No number of the canary materials in any form, and no field name of one.
    for (const material of MATERIAL_CANARIES) {
      for (const value of [material.pricePerKg, material.specificGravity, material.scrapRate]) expect(text).not.toContain(value);
    }
    expect(text).not.toMatch(/price|gravity|scrap|rate/i);
  });
});
