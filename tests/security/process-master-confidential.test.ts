import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { RoleName } from '@/lib/auth/roles';
import { ROUTE_MANIFEST } from '@/server/http/route-manifest';

import { PROCESS_MASTER_CANARIES, PROCESS_MASTER_CANARY_NAME, PROCESS_MASTER_CANARY_VALUES } from '../support/process-master-canary';
import { API_LOADERS, PAGE_LOADERS } from '../support/route-loaders';
import { harness, holdSessionClock, releaseSessionClock, FORBIDDEN_SIGNAL } from '../support/session-harness';

/**
 * STORY-02.01 AC-6 (BR-003, NFR-001, NFR-002, CR-33; architecture section 6 "What a refused role gets"): no Process Master rate
 * reaches a Lead or an Engineer. The harness holds three canary rates (distinctive invented names and values); the test calls every
 * Process master route and the page as a Lead, an Engineer and a signed-out caller, and as the Engineer calls every route the
 * Engineer may call, and looks for the canaries in everything that comes back. It also shows the role check runs before any lookup:
 * a refused call does not read the rates at all (the in-memory storage counts its reads).
 *
 * The scan of story 01.03 (`canaryMasters`, AQP-57) is not in the repository yet. This is the interim check, and the canary values
 * are in `tests/support/process-master-canary.ts` for 01.03 to take into its list.
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
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getUserService: () => shared.userService,
    getAuditService: () => shared.auditService,
    getMastersService: () => shared.mastersService,
  };
});

const ORIGIN = 'https://portal.example.test';
const REFUSED: ReadonlyArray<RoleName> = ['LEAD', 'ENGINEER'];
const PROCESS_PATHS = ['/api/v1/process-items', '/api/v1/process-items/[id]'] as const;
const moduleShape = z.record(z.string(), z.unknown());
const CANARY_ITEM_ID = '00000000-0000-4000-8000-000400000001';

beforeAll(async () => {
  holdSessionClock();
  await Promise.all([...Object.values(API_LOADERS), ...Object.values(PAGE_LOADERS)].map((load) => load()));
});
afterAll(releaseSessionClock);
// A spy keeps its calls until it is restored; each test counts only its own.
afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs(null);
  // Three rates that carry the canaries: the first seed rate gets the name and the value 771.37, two others get the other values.
  const [first, second, third] = harness.masters.records;
  if (first === undefined || second === undefined || third === undefined) throw new Error('The fake storage holds the seed rates.');
  first.name = PROCESS_MASTER_CANARY_NAME;
  first.defaultValue = PROCESS_MASTER_CANARY_VALUES[0] ?? '';
  second.defaultValue = PROCESS_MASTER_CANARY_VALUES[1] ?? '';
  third.defaultValue = PROCESS_MASTER_CANARY_VALUES[2] ?? '';
});

/** Calls a Process master route with a valid body and a real ID, so a refusal is the role's and not the input's. */
async function call(path: string, method: string): Promise<Response> {
  const loader = API_LOADERS[path];
  if (loader === undefined) throw new Error(`no loader for ${path}`);
  const handler = moduleShape.parse(await loader())[method];
  if (typeof handler !== 'function') throw new Error(`${path} exports no ${method}`);
  const hasBody = method === 'POST' || method === 'PATCH';
  const body = method === 'POST' ? { name: 'Invented-rate-per-sqin', unit: 'per sq in', defaultValue: '1.37' } : { defaultValue: '2.37' };
  const request = new Request(`${ORIGIN}${path.replace('[id]', CANARY_ITEM_ID)}`, {
    method,
    headers: { origin: ORIGIN, ...(hasBody ? { 'content-type': 'application/json' } : {}) },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });
  const answer: unknown = await handler(request, { params: Promise.resolve({ id: CANARY_ITEM_ID }) });
  if (!(answer instanceof Response)) throw new Error(`${path} ${method} did not answer with a Response`);
  return answer;
}

const processCalls = ROUTE_MANIFEST.filter((row) => row.kind === 'api' && PROCESS_PATHS.some((path) => path === row.path)).flatMap((row) =>
  row.methods.map((method) => ({ name: `${method} ${row.path}`, path: row.path, method })),
);

describe('the Process master routes (AC-6)', () => {
  it('are in the manifest and the loops have something to check: four calls', () => {
    expect(processCalls.map((entry) => entry.name)).toEqual([
      'GET /api/v1/process-items',
      'POST /api/v1/process-items',
      'PATCH /api/v1/process-items/[id]',
      'DELETE /api/v1/process-items/[id]',
    ]);
  });

  it.each(REFUSED.flatMap((role) => processCalls.map((entry) => [`${entry.name} as ${role}`, entry.path, entry.method, role] as const)))(
    '%s: 403 with the fixed body, no rate and no canary, and the rates were not read',
    async (_name, path, method, role) => {
      harness.signInAs(role);
      const reads = vi.spyOn(harness.masters, 'listProcessItems');
      const lookups = vi.spyOn(harness.masters, 'findProcessItemForUpdate');
      const names = vi.spyOn(harness.masters, 'listProcessItemNames');
      const response = await call(path, method);
      const text = await response.text();
      expect(response.status).toBe(403);
      const { requestId, ...fixed } = z.record(z.string(), z.unknown()).parse(JSON.parse(text));
      expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
      expect(fixed).toEqual({ type: 'about:blank', title: 'You do not have access to this.', status: 403, code: 'FORBIDDEN' });
      for (const canary of PROCESS_MASTER_CANARIES) expect(text).not.toContain(canary);
      expect(reads).not.toHaveBeenCalled();
      expect(lookups).not.toHaveBeenCalled();
      expect(names).not.toHaveBeenCalled();
    },
  );

  it('answer a signed-out caller with 401 and no rate', async () => {
    harness.signInAs(null);
    for (const entry of processCalls) {
      const response = await call(entry.path, entry.method);
      const text = await response.text();
      expect(response.status, entry.name).toBe(401);
      for (const canary of PROCESS_MASTER_CANARIES) expect(text, entry.name).not.toContain(canary);
    }
  });

  it('give the Admin the canary rates, which is what the scan proves nobody else gets (a control)', async () => {
    harness.signInAs('ADMIN');
    const text = await (await call('/api/v1/process-items', 'GET')).text();
    for (const canary of PROCESS_MASTER_CANARIES) expect(text).toContain(canary);
  });
});

describe('the Process master page (AC-6)', () => {
  const pageModule = async () => moduleShape.parse(await PAGE_LOADERS['/masters/process']?.())['default'];

  it.each(REFUSED)('refuses %s with the "no access" page before it reads a rate', async (role) => {
    harness.signInAs(role);
    const reads = vi.spyOn(harness.masters, 'listProcessItems');
    const page = await pageModule();
    if (typeof page !== 'function') throw new Error('The page has no default export.');
    await expect(page({ params: Promise.resolve({}), searchParams: Promise.resolve({}) })).rejects.toThrow(FORBIDDEN_SIGNAL);
    expect(reads).not.toHaveBeenCalled();
  });
});

describe('what an Engineer may call (AC-6)', () => {
  it('sends no rate: every API route the manifest lists for the Engineer answers without a canary', async () => {
    harness.signInAs('ENGINEER');
    const engineerRoutes = ROUTE_MANIFEST.filter(
      (row) => row.kind === 'api' && row.status === 'implemented' && row.roles !== 'public' && row.roles.includes('ENGINEER') && row.methods.includes('GET'),
    );
    expect(engineerRoutes.length).toBeGreaterThan(0);
    for (const row of engineerRoutes) {
      const loader = API_LOADERS[row.path];
      if (loader === undefined) throw new Error(`no loader for ${row.path}`);
      const handler = moduleShape.parse(await loader())['GET'];
      if (typeof handler !== 'function') throw new Error(`${row.path} exports no GET`);
      const answer: unknown = await handler(new Request(`${ORIGIN}${row.path}`, { headers: { origin: ORIGIN } }), { params: Promise.resolve({}) });
      if (!(answer instanceof Response)) throw new Error(`${row.path} did not answer with a Response`);
      const text = await answer.text();
      for (const canary of PROCESS_MASTER_CANARIES) expect(text, row.path).not.toContain(canary);
    }
  });
});
