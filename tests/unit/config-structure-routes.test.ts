import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defined } from '../support/defined';
import { fieldIdAt, inputAfterAx, newInput, pairAfterAx } from '../support/insert-specs';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-08.03 AC-1, AC-3, AC-4, AC-7 and AC-9 through the real `withRoute`, the real session and the real insert service over the in-memory registry and the 15 seed rates: what the Admin is sent for the options, the
 * preview and a save; what a Lead, an Engineer and a signed-out caller are sent instead; that every answer is a strict object (no internal ID, no key that is not named); and that the save asks for no password.
 * Which roles are allowed on every route is `tests/security/role-matrix.test.ts`, and that a refused role causes no lookup is `tests/security/engineer-refused-before-lookup.test.ts`. The table, the transaction, two
 * inserts racing and the audit rollback against PostgreSQL are `tests/integration/config/insert-field.test.ts`. Every name is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getUserService: () => shared.userService,
    getConfigReadService: () => shared.configReadService,
    getConfigEditService: () => shared.configEditService,
    getConfigStructureService: () => shared.configStructureService,
  };
});

const ORIGIN = 'https://portal.example.test';
const optionsRoute = await import('@/app/api/v1/config/insert-options/route');
const previewRoute = await import('@/app/api/v1/config/fields/preview/route');
const fieldsRoute = await import('@/app/api/v1/config/fields/route');

const record = z.record(z.string(), z.unknown());
const asJson = async (response: Response) => record.parse(await response.json());

const headers = { origin: ORIGIN, 'content-type': 'application/json' };
const options = (): Promise<Response> => optionsRoute.GET(new Request(`${ORIGIN}/api/v1/config/insert-options`, { method: 'GET', headers: { origin: ORIGIN } }));
const preview = (body: unknown): Promise<Response> => previewRoute.POST(new Request(`${ORIGIN}/api/v1/config/fields/preview`, { method: 'POST', headers, body: JSON.stringify(body) }));
const insert = (body: unknown): Promise<Response> => fieldsRoute.POST(new Request(`${ORIGIN}/api/v1/config/fields`, { method: 'POST', headers, body: JSON.stringify(body) }));

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);
beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ADMIN');
});

describe('AC-1: the Admin alone', () => {
  const calls: ReadonlyArray<readonly [string, () => Promise<Response>, number]> = [
    ['GET /api/v1/config/insert-options', options, 200],
    ['POST /api/v1/config/fields/preview', () => preview({ spec: inputAfterAx() }), 200],
    // A stale base is the save that stores nothing: it answers the Admin 409 at any state.
    ['POST /api/v1/config/fields', () => insert({ spec: inputAfterAx(), baseVersion: 999 }), 409],
  ];

  it.each(calls)('%s answers the Admin %s', async (_name, call, status) => {
    expect((await call()).status).toBe(status);
  });

  it.each(calls)('%s answers a Lead and an Engineer the fixed 403, with no formula, label or letter', async (_name, call) => {
    for (const role of ['LEAD', 'ENGINEER'] as const) {
      harness.signInAs(role);
      const response = await call();
      expect(response.status).toBe(403);
      const text = await response.text();
      expect(text).not.toContain('Cutting');
      expect(text).not.toContain('{{');
      expect(record.parse(JSON.parse(text))['code']).toBe('FORBIDDEN');
    }
  });

  it.each(calls)('%s answers a signed-out caller 401', async (_name, call) => {
    harness.signInAs(null);
    expect((await call()).status).toBe(401);
  });

  it('has only the methods the story names on the three routes (the read of the fields list is the first story\'s)', () => {
    expect(Object.keys(optionsRoute).sort()).toEqual(['GET']);
    expect(Object.keys(previewRoute).sort()).toEqual(['POST']);
    expect(Object.keys(fieldsRoute).sort()).toEqual(['GET', 'POST']);
  });
});

describe('the options of the wizard', () => {
  it('are a strict object of names and structure, with the version the wizard is opened on', async () => {
    const body = await asJson(await options());
    expect(Object.keys(body).sort()).toEqual(['columns', 'numberFormats', 'sections', 'stages', 'version']);
    expect(body['version']).toBe(1);
    const columns = z.array(record).parse(body['columns']);
    expect(Object.keys(defined(columns[0])).sort()).toEqual(['id', 'kind', 'label', 'letter', 'watchable']);
  });
});

describe('AC-3: the preview', () => {
  it('answers the letters, the moved columns with the product cells and the base version, and no internal ID of a field that does not exist yet', async () => {
    const body = await asJson(await preview({ spec: inputAfterAx() }));
    expect(Object.keys(body).sort()).toEqual(['baseVersion', 'formulas', 'inserted', 'moved', 'productCells']);
    expect(body['baseVersion']).toBe(1);
    expect(body['inserted']).toEqual([{ letter: 'AY', label: 'Invented Notch Count', kind: 'input', followsLetter: 'AX' }]);
    expect(z.array(record).parse(body['moved'])[0]).toEqual({ label: expect.any(String), from: 'AY', to: 'AZ' });
    expect(z.array(record).parse(body['productCells']).map((cell) => `${String(cell['from'])} to ${String(cell['to'])}`)).toEqual(['BL2 to BM2', 'BN2 to BO2', 'BO2 to BP2']);
  });

  it('answers the cost formula of a pair in its final letters', async () => {
    const body = await asJson(await preview({ spec: pairAfterAx() }));
    expect(body['formulas']).toEqual([{ letter: 'AZ', label: 'Invented Notch Cost', formula: 'AY * 2' }]);
  });

  it('answers the letters alone for a half-typed form, with no formula', async () => {
    const body = await asJson(await preview({ spec: inputAfterAx({ label: '', sectionId: '', width: 0 }), lettersOnly: true }));
    expect(body['formulas']).toEqual([]);
    expect(body['inserted']).toEqual([expect.objectContaining({ letter: 'AY', label: 'New field' })]);
  });

  it('stores nothing: no new version and no audit entry', async () => {
    const entries = harness.auditWorld.audit.committed.length;
    await preview({ spec: pairAfterAx() });
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
    expect(await asJson(await options())).toMatchObject({ version: 1 });
  });
});

describe('AC-7: bad input is a 422 the form can show, and the server refuses what the schema does not name', () => {
  it('answers a bad label under input.label with the words of the story, from the preview and from the save', async () => {
    for (const call of [() => preview({ spec: inputAfterAx({ label: '' }) }), () => insert({ spec: inputAfterAx({ label: '' }), baseVersion: 1 })]) {
      const response = await call();
      expect(response.status).toBe(422);
      expect(await asJson(response)).toMatchObject({ code: 'VALIDATION_FAILED', errors: [{ field: 'input.label', message: 'Enter a label.' }] });
    }
  });

  it('answers every problem at once, so the form can show them all', async () => {
    const response = await insert({ spec: inputAfterAx({ label: '', sectionId: '', width: 0 }), baseVersion: 1 });
    const errors = z.array(record).parse((await asJson(response))['errors']);
    expect(errors.map((error) => error['field'])).toEqual(expect.arrayContaining(['input.label', 'input.sectionId', 'input.width']));
  });

  it.each([
    ['a key the spec does not name', { spec: { ...inputAfterAx(), letter: 'AY' } }],
    ['a key the input does not name', { spec: { ...inputAfterAx(), input: { ...newInput(), position: 51 } } }],
    ['a key of the body that is not named', { spec: inputAfterAx(), password: 'x' }],
    ['a kind that does not exist', { spec: { ...inputAfterAx(), kind: 'section' } }],
    ['a value type that is not Number or Text (decision D-2)', { spec: { ...inputAfterAx(), input: { ...newInput(), dataType: 'select' } } }],
  ])('refuses %s, as a strict schema must', async (_what, body) => {
    expect((await preview(body)).status).toBe(422);
    expect((await insert({ ...body, baseVersion: 1 })).status).toBe(422);
  });

  it('refuses a base version below 1 or that is not a whole number', async () => {
    expect((await insert({ spec: inputAfterAx(), baseVersion: 0 })).status).toBe(422);
    expect((await insert({ spec: inputAfterAx(), baseVersion: 1.5 })).status).toBe(422);
    expect((await insert({ spec: inputAfterAx() })).status).toBe(422);
  });
});

describe('AC-4 and AC-9: the save', () => {
  it('answers a save made from a base that is not the latest 409 CONFIG_VERSION_CHANGED with the newer number, and stores nothing', async () => {
    const entries = harness.auditWorld.audit.committed.length;
    const response = await insert({ spec: inputAfterAx(), baseVersion: 7 });
    expect(response.status).toBe(409);
    expect(await asJson(response)).toMatchObject({ code: 'CONFIG_VERSION_CHANGED', currentVersion: 1 });
    expect(harness.auditWorld.audit.committed).toHaveLength(entries);
  });

  it('stores one version for a pair with no password, says so in the words of the story, and writes one audit entry', async () => {
    const entries = harness.auditWorld.audit.committed.length;
    const response = await insert({ spec: pairAfterAx(), baseVersion: 1 });
    expect(response.status).toBe(200);
    expect(await asJson(response)).toEqual({ version: 2, letters: ['AY', 'AZ'], message: 'Inserted as AY and AZ. Configuration version 2.' });
    const written = harness.auditWorld.audit.committed.slice(entries);
    expect(written).toHaveLength(1);
    expect(defined(written[0])).toMatchObject({ event: 'config.field_inserted', actorId: harness.idOf.ADMIN, objectType: 'field' });
    expect(await asJson(await options())).toMatchObject({ version: 2 });
  });

  it('refuses a second insert from the base the first one used (two inserts at once cannot both win)', async () => {
    const response = await insert({ spec: inputAfterAx(), baseVersion: 1 });
    expect(response.status).toBe(409);
    expect(await asJson(response)).toMatchObject({ code: 'CONFIG_VERSION_CHANGED', currentVersion: 2 });
  });

  it('lets the same insert in from the new base, and the column it follows is the one named (the first insert shifted the letters)', async () => {
    const afterAx = fieldIdAt('AX');
    const response = await insert({ spec: { ...inputAfterAx(), afterFieldId: afterAx }, baseVersion: 2 });
    expect(response.status).toBe(200);
    expect(await asJson(response)).toMatchObject({ version: 3, letters: ['AY'] });
  });
});
