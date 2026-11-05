import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { isStateChanging, ROUTE_MANIFEST, type HttpMethod, type RouteRow } from '@/server/http/route-manifest';

import { OWN_PROTECTION } from '../support/route-files';
import { API_LOADERS } from '../support/route-loaders';
import { harness } from '../support/session-harness';

/**
 * STORY-01.02 AC-5 (NFR-003, negative): a state-changing request with a foreign `Origin` and no same-origin
 * `Sec-Fetch-Site` is refused by every state-changing route of the manifest, a POST from `APP_ORIGIN` is not, and no
 * route uses Server Actions. The routes come from the manifest, so the first POST route a later story adds is held to this
 * with no edit here (it needs its loader in `tests/support/route-loaders.ts`, as for the role matrix).
 *
 * No implemented route changes state yet except next-auth's own sign-in and sign-out, which protect themselves with their
 * own CSRF token. So that the loop cannot pass by finding nothing, a control route is added to the manifest for this file
 * alone and the same checks run against it through the real `withRoute`.
 */

const APP_ORIGIN = 'https://portal.example.test';
const CONTROL: RouteRow = {
  path: '/api/v1/csrf-control',
  kind: 'api',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  roles: ['ADMIN', 'LEAD', 'ENGINEER'],
  status: 'implemented',
  stage: 'R1',
};

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users };
});
vi.mock('@/server/http/route-manifest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/http/route-manifest')>();
  return {
    ...actual,
    findRoute: (path: string, method: HttpMethod) =>
      path === '/api/v1/csrf-control' ? ({ path, kind: 'api', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], roles: ['ADMIN', 'LEAD', 'ENGINEER'], status: 'implemented', stage: 'R1' } as const) : actual.findRoute(path, method),
  };
});

const { withRoute } = await import('@/server/http/with-route');

const emptyAnswer = z.strictObject({ done: z.literal(true) });

const stateChangingRoutes = ROUTE_MANIFEST.filter(
  (row) => row.kind === 'api' && row.status === 'implemented' && row.roles !== 'public' && row.methods.some((method) => isStateChanging(method)),
);

type Handler = (request: Request, context?: { params: Promise<Record<string, string>> }) => Promise<Response>;

function request(method: string, headers: Record<string, string>): Request {
  return new Request(`${APP_ORIGIN}/api/v1/anything`, { method, headers: { 'content-type': 'application/json', ...headers }, body: '{}' });
}

async function loadHandler(row: RouteRow, method: HttpMethod): Promise<Handler> {
  const loader = API_LOADERS[row.path];
  if (loader === undefined) throw new Error(`no loader for ${row.path} in tests/support/route-loaders.ts`);
  const handler = z.record(z.string(), z.unknown()).parse(await loader())[method];
  if (typeof handler !== 'function') throw new Error(`${row.path} exports no ${method}`);
  return async (incoming, context) => {
    const answer: unknown = await handler(incoming, context);
    if (!(answer instanceof Response)) throw new Error(`${row.path} ${method} did not answer with a Response`);
    return answer;
  };
}

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
  harness.signInAs('ADMIN');
});

describe('AC-5: every state-changing route of the manifest', () => {
  const calls = stateChangingRoutes.flatMap((row) =>
    row.methods.filter((method) => isStateChanging(method)).map((method) => [`${method} ${row.path}`, row, method] as const),
  );

  it.each(calls)('%s refuses a foreign Origin, even from a signed-in Admin', async (_name, row, method) => {
    const handler = await loadHandler(row, method);
    const answer = await handler(request(method, { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }), { params: Promise.resolve({}) });
    expect(answer.status).toBe(403);
    expect(z.record(z.string(), z.unknown()).parse(await answer.json())['code']).toBe('ORIGIN_REFUSED');
  });

  it.each(calls)('%s refuses a request that says nothing about where it came from', async (_name, row, method) => {
    const handler = await loadHandler(row, method);
    expect((await handler(request(method, {}), { params: Promise.resolve({}) })).status).toBe(403);
  });

  it.each(calls)('%s does not refuse a request from APP_ORIGIN for its origin', async (_name, row, method) => {
    const handler = await loadHandler(row, method);
    const answer = await handler(request(method, { origin: APP_ORIGIN }), { params: Promise.resolve({}) });
    const code = z.record(z.string(), z.unknown()).parse(await answer.json().catch(() => ({})))['code'];
    expect(code).not.toBe('ORIGIN_REFUSED');
  });

  it('knows which implemented routes change state: none yet except the ones that protect themselves', () => {
    const own = ROUTE_MANIFEST.filter((row) => Object.hasOwn(OWN_PROTECTION, row.path));
    expect(own.every((row) => row.roles === 'public')).toBe(true);
    // A route that changes state and is neither on this list nor in the loop above would be a hole.
    const unchecked = ROUTE_MANIFEST.filter(
      (row) => row.kind === 'api' && row.status === 'implemented' && row.methods.some((method) => isStateChanging(method)) && !stateChangingRoutes.includes(row) && !own.includes(row),
    );
    expect(unchecked).toEqual([]);
  });
});

describe('AC-5: the control route, so the loop cannot pass by finding nothing', () => {
  const routes = (['POST', 'PUT', 'PATCH', 'DELETE'] as const).map((method) => [method, method] as const);

  it.each(routes)('%s: a foreign Origin is refused, APP_ORIGIN and a same-origin browser request are not', async (method) => {
    const handler = withRoute({ route: CONTROL.path, method, output: emptyAnswer, handler: () => ({ done: true as const }) });
    expect((await handler(request(method, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await handler(request(method, { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }))).status).toBe(403);
    expect((await handler(request(method, {}))).status).toBe(403);
    expect((await handler(request(method, { origin: APP_ORIGIN }))).status).toBe(200);
    expect((await handler(request(method, { 'sec-fetch-site': 'same-origin' }))).status).toBe(200);
  });

  it('a signed-out foreign request is refused for its origin first, and reaches nothing', async () => {
    harness.signInAs(null);
    const handler = withRoute({ route: CONTROL.path, method: 'POST', output: emptyAnswer, handler: () => ({ done: true as const }) });
    const answer = await handler(request('POST', { origin: 'https://evil.example' }));
    expect(answer.status).toBe(403);
    expect(harness.getServerSession).not.toHaveBeenCalled();
  });
});

describe('AC-5: Server Actions are not used', () => {
  it('declares the rule in lint, and no source file opens with "use server"', async () => {
    const { readRouteFiles } = await import('../support/route-files');
    for (const file of readRouteFiles()) expect(file.source, file.file).not.toMatch(/['"]use server['"]/);
  });
});
