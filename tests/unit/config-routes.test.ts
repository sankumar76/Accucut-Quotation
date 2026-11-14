import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { fixedForbiddenProblem, scanResponse } from '../support/scanner';
import { forbiddenStrings } from '../support/canary-masters';
import { FAKE_CONFIG_SAVED_AT, FAKE_CONFIG_USE } from '../support/fake-config';
import { defined } from '../support/defined';
import { seedFormulaTexts } from '../support/seed-formula-texts';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-08.01 AC-1, AC-3, AC-5 and AC-6: the contract of `GET /api/v1/config/fields` and `GET /api/v1/config/current`, through the real `withRoute`, the real session and the
 * real read service over the seed registry and the 15 seed rates. What an Admin and a Lead are sent, what an Engineer and a signed-out caller are sent instead (the fixed 403 and
 * 401, with no formula and no rate name), and that neither route has a write method. Which roles are allowed on every route is `tests/security/role-matrix.test.ts`; that a
 * refused role causes no lookup is `tests/security/engineer-refused-before-lookup.test.ts`. Every name is invented.
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
  };
});

const ORIGIN = 'https://portal.example.test';
const fieldsRoute = await import('@/app/api/v1/config/fields/route');
const currentRoute = await import('@/app/api/v1/config/current/route');
// What the confidentiality scan forbids: the canary values and names, and every seed formula in its stored form and in the form a person reads it (QLT-05).
const FORBIDDEN = forbiddenStrings(seedFormulaTexts());
const record = z.record(z.string(), z.unknown());

const get = (handler: typeof fieldsRoute.GET, path: string): Promise<Response> => handler(new Request(`${ORIGIN}${path}`, { method: 'GET', headers: { origin: ORIGIN } }));
const getFields = (): Promise<Response> => get(fieldsRoute.GET, '/api/v1/config/fields');
const getCurrent = (): Promise<Response> => get(currentRoute.GET, '/api/v1/config/current');

async function fieldsOf(response: Response): Promise<ReadonlyArray<Record<string, unknown>>> {
  return z.array(record).parse(record.parse(await response.json())['fields']);
}

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);
beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ADMIN');
});

describe('AC-1 and AC-3: GET /api/v1/config/fields', () => {
  it.each(['ADMIN', 'LEAD'] as const)('answers a %s with every field in column order, not cached, with a request ID', async (role) => {
    harness.signInAs(role);
    const response = await getFields();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Request-Id')).toMatch(/^req-[0-9a-f]{8}$/);
    const fields = await fieldsOf(response);
    expect(fields.map((field) => field['letter']).slice(0, 4)).toEqual(['A', 'B', 'C', 'D']);
    for (const field of fields) expect(Object.keys(field).sort()).toEqual(['canEditFormula', 'formula', 'id', 'kind', 'label', 'letter', 'note', 'place', 'systemRole']);
  });

  it('lists Scrap Weight with its formula and the estimate total as SUM(BG) with its sentence, in display form and never the stored one', async () => {
    const response = await getFields();
    const text = await response.clone().text();
    expect(text).not.toContain('{{');
    const fields = await fieldsOf(response);
    const scrap = defined(fields.find((field) => field['letter'] === 'O'));
    expect(scrap['formula']).toBe('IF(Material-Specific-Gravity > 0, M - N, 0)');
    const total = defined(fields.find((field) => field['letter'] === 'BL'));
    expect(total['formula']).toBe('SUM(BG)');
    expect(total['note']).toBe("The estimate total is the sum of every row's BG. Each row's count is typed for the whole order, so nothing is multiplied by the rows above.");
  });

  it('tags the six System fields and offers an edit on no field that has no formula', async () => {
    const fields = await fieldsOf(await getFields());
    expect(fields.filter((field) => field['systemRole'] !== null).map((field) => field['letter'])).toEqual(['A', 'H', 'BG', 'BL', 'BM', 'BO']);
    for (const letter of ['A', 'F', 'I', 'BO']) expect(defined(fields.find((field) => field['letter'] === letter))['canEditFormula'], letter).toBe(false);
  });

  it('has no write method: POST, PUT, PATCH and DELETE are not exported, so Next.js answers 405', () => {
    expect(Object.keys(fieldsRoute).sort()).toEqual(['GET']);
    expect(Object.keys(currentRoute).sort()).toEqual(['GET']);
  });
});

describe('AC-6: GET /api/v1/config/current', () => {
  it.each(['ADMIN', 'LEAD'] as const)('answers a %s with the number, who saved it, when, and how many estimates use it', async (role) => {
    harness.signInAs(role);
    const response = await getCurrent();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(record.parse(await response.json())).toEqual({ number: 1, savedBy: FAKE_CONFIG_USE.savedByName, savedAt: FAKE_CONFIG_SAVED_AT.toISOString(), estimatesInUse: FAKE_CONFIG_USE.estimatesInUse });
  });
});

describe('AC-5: an Engineer and a signed-out caller get nothing', () => {
  const calls = [
    ['GET /api/v1/config/fields', getFields],
    ['GET /api/v1/config/current', getCurrent],
  ] as const;

  it.each(calls)('%s: an Engineer gets the fixed 403, with no formula, no rate name and no field', async (_name, call) => {
    harness.signInAs('ENGINEER');
    const response = await call();
    const recorded = { label: _name, url: ORIGIN, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
    expect(fixedForbiddenProblem(recorded)).toBeNull();
    expect(scanResponse(recorded, FORBIDDEN)).toEqual([]);
    expect(recorded.body).not.toMatch(/letter|formula|fields|estimatesInUse/);
  });

  it.each(calls)('%s: a signed-out caller gets 401', async (_name, call) => {
    harness.signInAs(null);
    expect((await call()).status).toBe(401);
  });

  it('the control: the same scan finds the formulas and the rate names in what the Admin is sent', async () => {
    const response = await getFields();
    const recorded = { label: 'admin', url: ORIGIN, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
    const found = new Set(scanResponse(recorded, FORBIDDEN).map((finding) => finding.found));
    expect(found.has('Cutting-Rate-per-Sec')).toBe(true);
    expect(found.has('P * Cutting-Rate-per-Sec')).toBe(true);
  });
});
