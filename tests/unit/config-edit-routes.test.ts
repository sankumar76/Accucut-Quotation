import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defined } from '../support/defined';
import { HARNESS_PASSWORD } from '../support/harness-password';
import { seedFieldAt } from '../support/seed-config';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-08.02 AC-2, AC-4, AC-5, AC-6, AC-7 and AC-9 through the real `withRoute`, the real session, the real editor service over the in-memory registry, the 15 seed rates and the real step-up check: what the
 * Admin is sent for a check, the sample rows and a save; what a Lead, an Engineer and a signed-out caller are sent instead; the order of a save's refusals; and that the password is in no answer and no log line.
 * Which roles are allowed on every route is `tests/security/role-matrix.test.ts`, and that a refused role causes no lookup is `tests/security/engineer-refused-before-lookup.test.ts`. The table, the
 * transaction and the throttle against PostgreSQL are `tests/integration/config/save-formula.test.ts`. Every name and password is invented.
 */

const logged = vi.hoisted(() => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: logged }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getUserService: () => shared.userService,
    getConfigReadService: () => shared.configReadService,
    getConfigEditService: () => shared.configEditService,
  };
});

const ORIGIN = 'https://portal.example.test';
const checkRoute = await import('@/app/api/v1/config/formula-check/route');
const rowsRoute = await import('@/app/api/v1/config/sample-rows/route');
const saveRoute = await import('@/app/api/v1/config/fields/[id]/formula/route');
const currentRoute = await import('@/app/api/v1/config/current/route');

const AL = seedFieldAt('AL');
const record = z.record(z.string(), z.unknown());
const WRONG = 'Not-the-right-1!';
const TEXT = 'P * Cutting-Rate-per-Sec';
const CHANGED = 'P * Cutting-Rate-per-Sec * 2';

const headers = { origin: ORIGIN, 'content-type': 'application/json' };
const check = (body: unknown): Promise<Response> => checkRoute.POST(new Request(`${ORIGIN}/api/v1/config/formula-check`, { method: 'POST', headers, body: JSON.stringify(body) }));
const rows = (): Promise<Response> => rowsRoute.GET(new Request(`${ORIGIN}/api/v1/config/sample-rows`, { method: 'GET', headers: { origin: ORIGIN } }));
const save = (body: unknown, id = AL.id): Promise<Response> =>
  saveRoute.PUT(new Request(`${ORIGIN}/api/v1/config/fields/${id}/formula`, { method: 'PUT', headers, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

const asJson = async (response: Response) => record.parse(await response.json());

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);
beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ADMIN');
  for (const fn of Object.values(logged)) fn.mockClear();
});

describe('AC-7: the Admin alone', () => {
  const calls: ReadonlyArray<readonly [string, () => Promise<Response>]> = [
    ['POST /api/v1/config/formula-check', () => check({ fieldId: AL.id, text: TEXT })],
    ['GET /api/v1/config/sample-rows', rows],
    ['PUT /api/v1/config/fields/{id}/formula', () => save({ text: TEXT, password: HARNESS_PASSWORD, baseVersion: 1 })],
  ];

  it.each(calls)('%s answers the Admin 200', async (_name, call) => {
    expect((await call()).status).toBe(200);
  });

  it.each(calls)('%s answers a Lead and an Engineer the fixed 403, with no formula and no rate name', async (_name, call) => {
    for (const role of ['LEAD', 'ENGINEER'] as const) {
      harness.signInAs(role);
      const response = await call();
      expect(response.status).toBe(403);
      const text = await response.text();
      expect(text).not.toContain('Cutting-Rate-per-Sec');
      expect(text).not.toContain('{{');
      expect(record.parse(JSON.parse(text))['code']).toBe('FORBIDDEN');
    }
  });

  it.each(calls)('%s answers a signed-out caller 401', async (_name, call) => {
    harness.signInAs(null);
    expect((await call()).status).toBe(401);
  });
});

describe('AC-2 and AC-3: the live check', () => {
  it('answers a valid formula with what it says it uses, feeds and gives, and nothing else', async () => {
    const body = await asJson(await check({ fieldId: AL.id, text: TEXT }));
    expect(Object.keys(body).sort()).toEqual(['feeds', 'message', 'note', 'preview', 'uses', 'valid']);
    expect(body['valid']).toBe(true);
    expect(body['message']).toBe('The formula is valid. It uses P (Cutting Time) and the rate Cutting-Rate-per-Sec. Column AL feeds AY.');
    expect(body['preview']).toBeNull();
  });

  it.each([
    ['an unknown name', 'P * Cuting-Rate-per-Sec', '"Cuting-Rate-per-Sec" is not a column letter, rate name or function. Check the spelling, or add the rate in the Process master first.'],
    ['a syntax error', 'P * (Cutting-Rate-per-Sec + )', 'The formula ends too soon. A number or name is missing after "+" (position 29).'],
    ['a loop', 'P * Cutting-Rate-per-Sec + AY', 'This formula would make AL depend on itself. The loop is AL → AY → AL. Remove one of these references.'],
  ])('answers %s 422 with the SCR-18 sentence under text', async (_name, text, message) => {
    const response = await check({ fieldId: AL.id, text });
    expect(response.status).toBe(422);
    expect(await asJson(response)).toMatchObject({ code: 'VALIDATION_FAILED', errors: [{ field: 'text', message }] });
  });

  it('refuses a body that names a key it does not know, and a body with no text, as a form error', async () => {
    expect((await check({ fieldId: AL.id, text: TEXT, extra: 1 })).status).toBe(422);
    expect((await check({ fieldId: AL.id })).status).toBe(422);
  });

  it('answers 409 SYSTEM_FIELD for a field with no formula and 404 for an ID that is none', async () => {
    const system = await check({ fieldId: seedFieldAt('BO').id, text: '1' });
    expect(system.status).toBe(409);
    expect(await asJson(system)).toMatchObject({ code: 'SYSTEM_FIELD' });
    expect((await check({ fieldId: 'no-such-field', text: '1' })).status).toBe(404);
  });
});

describe('AC-1: the sample rows', () => {
  it('answers no estimate and no rows while nothing was calculated, and the names of the fixed operands for the suggestions', async () => {
    const body = await asJson(await rows());
    expect(body).toEqual({ estimate: null, rows: [], operandNames: expect.arrayContaining(['Material-Price-per-kg', 'ExchangeRate-USD']) as unknown });
  });
});

describe('AC-2, AC-4 to AC-6 and AC-9: saving', () => {
  it('refuses a formula that cannot be saved with 422 under text, before the password is looked at, even with a wrong one', async () => {
    const response = await save({ text: 'P * Cuting-Rate-per-Sec', password: WRONG, baseVersion: 1 });
    expect(response.status).toBe(422);
    expect(await asJson(response)).toMatchObject({ code: 'VALIDATION_FAILED', errors: [{ field: 'text' }] });
  });

  it('answers a wrong password 422 STEP_UP_FAILED with the fixed sentence, writes nothing, and holds no password or formula', async () => {
    const response = await save({ text: CHANGED, password: WRONG, baseVersion: 1 });
    expect(response.status).toBe(422);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ code: 'STEP_UP_FAILED', title: 'That password is not correct.' });
    expect(text).not.toContain(WRONG);
    expect(text).not.toContain(CHANGED);
    const current = await currentRoute.GET(new Request(`${ORIGIN}/api/v1/config/current`, { method: 'GET', headers: { origin: ORIGIN } }));
    expect(await asJson(current)).toMatchObject({ number: 1 });
  });

  it('refuses a body with no password, an empty one, or a number below 1 as base, as a form error, and asks for nothing', async () => {
    expect((await save({ text: CHANGED, baseVersion: 1 })).status).toBe(422);
    expect((await save({ text: CHANGED, password: '', baseVersion: 1 })).status).toBe(422);
    expect((await save({ text: CHANGED, password: HARNESS_PASSWORD, baseVersion: 0 })).status).toBe(422);
  });

  it('answers 409 SYSTEM_FIELD for a save on a field with no formula, and 404 for an ID that is none', async () => {
    const system = await save({ text: '1', password: HARNESS_PASSWORD, baseVersion: 1 }, seedFieldAt('BO').id);
    expect(system.status).toBe(409);
    expect(await asJson(system)).toMatchObject({ code: 'SYSTEM_FIELD' });
    expect((await save({ text: '1', password: HARNESS_PASSWORD, baseVersion: 1 }, 'no-such-field')).status).toBe(404);
  });

  it('saves with the right password as version 2, says so, writes the audit entry, and holds no password anywhere', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await save({ text: CHANGED, password: HARNESS_PASSWORD, baseVersion: 1 });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ version: 2, changed: true, message: 'Formula saved as configuration version 2.' });
    expect(body).not.toContain(HARNESS_PASSWORD);
    const entries = harness.auditWorld.audit.committed.slice(before);
    expect(entries).toHaveLength(1);
    expect(defined(entries[0])).toMatchObject({ event: 'config.formula_changed', before: { formula: TEXT }, after: { formula: CHANGED, version: 2 } });
    expect(JSON.stringify(entries)).not.toContain(HARNESS_PASSWORD);
    // No log line of the whole file holds the password or either formula.
    expect(JSON.stringify(Object.values(logged).map((fn) => fn.mock.calls))).not.toContain(HARNESS_PASSWORD);
  });

  it('answers a save made from the old base 409 CONFIG_VERSION_CHANGED with the newer number, and overwrites nothing', async () => {
    const response = await save({ text: 'P * 3', password: HARNESS_PASSWORD, baseVersion: 1 });
    expect(response.status).toBe(409);
    expect(await asJson(response)).toMatchObject({ code: 'CONFIG_VERSION_CHANGED', currentVersion: 2 });
  });

  it('answers the formula that is saved already 200 with no new version and no entry', async () => {
    const before = harness.auditWorld.audit.committed.length;
    const response = await save({ text: CHANGED, password: WRONG, baseVersion: 2 });
    expect(await asJson(response)).toEqual({ version: 2, changed: false, message: 'This is already the saved formula, so no new version was made.' });
    expect(harness.auditWorld.audit.committed).toHaveLength(before);
  });

  it('has no other method on any of the three routes', () => {
    expect(Object.keys(checkRoute).sort()).toEqual(['POST']);
    expect(Object.keys(rowsRoute).sort()).toEqual(['GET']);
    expect(Object.keys(saveRoute).sort()).toEqual(['PUT']);
  });
});
