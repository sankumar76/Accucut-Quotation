import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ConflictError, ForbiddenError, UnauthorizedError } from '@/lib/errors';
import type { AuthenticatedUser } from '@/server/auth/session';
import type { HttpMethod, RouteRow } from '@/server/http/route-manifest';

/**
 * STORY-01.02 AC-1, AC-4 and AC-5: what `withRoute` does, in order. The session and the manifest are replaced so the
 * wrapper is tested on its own; `tests/security` runs the real handlers through the real session over fake users.
 */

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const TEST_ROWS: ReadonlyArray<RouteRow> = [
  { path: '/api/v1/test-all', kind: 'api', methods: ['GET', 'POST'], roles: ['ADMIN', 'LEAD', 'ENGINEER'], status: 'implemented', stage: 'R1' },
  { path: '/api/v1/test-lead/[id]', kind: 'api', methods: ['GET', 'POST'], roles: ['ADMIN', 'LEAD'], status: 'implemented', stage: 'R1' },
  { path: '/api/v1/test-public', kind: 'api', methods: ['GET'], roles: 'public', status: 'implemented', stage: 'R1' },
];

vi.mock('@/server/auth/session', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: mocks.warn, error: mocks.error } }));
vi.mock('@/server/http/route-manifest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/http/route-manifest')>();
  return {
    ...actual,
    findRoute: (path: string, method: HttpMethod) => TEST_ROWS.find((row) => row.path === path && row.methods.includes(method)),
  };
});

const { withRoute } = await import('@/server/http/with-route');

const APP_ORIGIN = 'https://portal.example.test';
const ADMIN: AuthenticatedUser = { id: 'u-admin', name: 'Invented Admin', email: 'admin@example.test', role: 'ADMIN', mustChangePassword: false };
const ENGINEER: AuthenticatedUser = { id: 'u-eng', name: 'Invented Engineer', email: 'engineer@example.test', role: 'ENGINEER', mustChangePassword: false };

const output = z.strictObject({ greeting: z.string() });

function get(url = 'https://portal.example.test/api/v1/test-all', init: RequestInit = {}): Request {
  return new Request(url, { method: 'GET', ...init });
}

function post(body: string | undefined, headers: Record<string, string> = { origin: APP_ORIGIN }): Request {
  return new Request('https://portal.example.test/api/v1/test-all', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body }),
  });
}

async function problemOf(response: Response): Promise<Record<string, unknown>> {
  expect(response.headers.get('Content-Type')).toBe('application/problem+json');
  return z.record(z.string(), z.unknown()).parse(await response.json());
}

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
  mocks.requireUser.mockReset();
  mocks.requireUser.mockResolvedValue(ADMIN);
  mocks.warn.mockClear();
  mocks.error.mockClear();
});

describe('AC-1: declaring a handler', () => {
  it('refuses a route that is not in the manifest, when the module loads', () => {
    expect(() => withRoute({ route: '/api/v1/not-listed', method: 'GET', output, handler: () => ({ greeting: 'x' }) })).toThrow('not in the route manifest');
  });

  it('refuses a method the row does not list', () => {
    expect(() => withRoute({ route: '/api/v1/test-public', method: 'DELETE', output, handler: () => ({ greeting: 'x' }) })).toThrow('not in the route manifest');
  });

  it('does not take a public row (sign-in and health have their own form)', () => {
    expect(() => withRoute({ route: '/api/v1/test-public', method: 'GET', output, handler: () => ({ greeting: 'x' }) })).toThrow('public');
  });

  it('answers with the handler result, no-store and a request ID', async () => {
    const handle = withRoute({ route: '/api/v1/test-all', method: 'GET', output, handler: ({ user }) => ({ greeting: `Hello ${user.name}` }) });
    const response = await handle(get());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Request-Id')).toMatch(/^req-[0-9a-f]{8}$/);
    expect(await response.json()).toEqual({ greeting: 'Hello Invented Admin' });
  });

  it('answers HEAD through the GET handler with the same checks', async () => {
    mocks.requireUser.mockRejectedValue(new UnauthorizedError());
    const handle = withRoute({ route: '/api/v1/test-all', method: 'GET', output, handler: () => ({ greeting: 'x' }) });
    expect((await handle(new Request('https://portal.example.test/api/v1/test-all', { method: 'HEAD' }))).status).toBe(401);
  });

  it('uses the status the route declares', async () => {
    const handle = withRoute({ route: '/api/v1/test-all', method: 'POST', status: 201, output, handler: () => ({ greeting: 'made' }) });
    expect((await handle(post(undefined))).status).toBe(201);
  });
});

describe('AC-4: signed out, and a role the row does not list', () => {
  it('a signed-out caller gets 401 with a problem body, and the handler never runs', async () => {
    mocks.requireUser.mockRejectedValue(new UnauthorizedError());
    const handler = vi.fn(() => ({ greeting: 'x' }));
    const response = await withRoute({ route: '/api/v1/test-all', method: 'GET', output, handler })(get());
    expect(response.status).toBe(401);
    expect(await problemOf(response)).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('a role the row does not list gets 403 before anything is parsed or looked up', async () => {
    mocks.requireUser.mockResolvedValue(ENGINEER);
    const queryCheck = vi.fn((value: string) => value.length > 0);
    const handler = vi.fn(() => ({ greeting: 'x' }));
    const handle = withRoute({
      route: '/api/v1/test-lead/[id]',
      method: 'GET',
      params: z.strictObject({ id: z.string().refine(queryCheck) }),
      output,
      handler,
    });
    const response = await handle(get('https://portal.example.test/api/v1/test-lead/anything'), { params: Promise.resolve({ id: 'anything' }) });
    expect(response.status).toBe(403);
    expect(queryCheck).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it('gives the same 403 for an invented ID and a real one, apart from the request ID', async () => {
    mocks.requireUser.mockResolvedValue(ENGINEER);
    const handle = withRoute({ route: '/api/v1/test-lead/[id]', method: 'GET', params: z.strictObject({ id: z.string() }), output, handler: () => ({ greeting: 'x' }) });
    const answer = async (id: string) => {
      const response = await handle(get(`https://portal.example.test/api/v1/test-lead/${id}`), { params: Promise.resolve({ id }) });
      const { requestId, ...fixed } = await problemOf(response);
      expect(requestId).toMatch(/^req-/);
      return { status: response.status, fixed };
    };
    const invented = await answer('00000000-0000-4000-8000-000000000000');
    const real = await answer('11111111-1111-4111-8111-111111111111');
    expect(invented).toEqual(real);
    expect(invented.fixed).toEqual({ type: 'about:blank', title: 'You do not have access to this.', status: 403, code: 'FORBIDDEN' });
  });

  it('lets a listed role through', async () => {
    const handle = withRoute({ route: '/api/v1/test-lead/[id]', method: 'GET', params: z.strictObject({ id: z.string() }), output, handler: ({ params }) => ({ greeting: params.id }) });
    const response = await handle(get('https://portal.example.test/api/v1/test-lead/abc'), { params: Promise.resolve({ id: 'abc' }) });
    expect(await response.json()).toEqual({ greeting: 'abc' });
  });
});

describe('AC-5: a state-changing request must come from the portal', () => {
  const handlerOf = () => withRoute({ route: '/api/v1/test-all', method: 'POST', output, handler: () => ({ greeting: 'done' }) });

  it('refuses a foreign Origin with 403 ORIGIN_REFUSED, before the session is read', async () => {
    const response = await handlerOf()(post(undefined, { origin: 'https://evil.example' }));
    expect(response.status).toBe(403);
    expect(await problemOf(response)).toMatchObject({ code: 'ORIGIN_REFUSED' });
    expect(mocks.requireUser).not.toHaveBeenCalled();
  });

  it('refuses a request that says nothing about where it came from', async () => {
    expect((await handlerOf()(post(undefined, {}))).status).toBe(403);
  });

  it('accepts a POST from APP_ORIGIN', async () => {
    expect((await handlerOf()(post(undefined))).status).toBe(200);
  });

  it('accepts a POST the browser marks same-origin', async () => {
    expect((await handlerOf()(post(undefined, { 'sec-fetch-site': 'same-origin' }))).status).toBe(200);
  });

  it('does not check a GET', async () => {
    const handle = withRoute({ route: '/api/v1/test-all', method: 'GET', output, handler: () => ({ greeting: 'x' }) });
    expect((await handle(get('https://portal.example.test/api/v1/test-all', { headers: { origin: 'https://evil.example' } }))).status).toBe(200);
  });
});

describe('the input is parsed after the role check', () => {
  const body = z.strictObject({ name: z.string().min(1) });
  const handle = withRoute({ route: '/api/v1/test-all', method: 'POST', body, output, handler: ({ body: input }) => ({ greeting: input.name }) });

  it('passes a valid body to the handler', async () => {
    expect(await (await handle(post(JSON.stringify({ name: 'Ada' })))).json()).toEqual({ greeting: 'Ada' });
  });

  it('answers 400 for a body that is not JSON', async () => {
    const response = await handle(post('{not json'));
    expect(response.status).toBe(400);
    expect(await problemOf(response)).toMatchObject({ code: 'MALFORMED_REQUEST' });
  });

  it('answers 422 for a body that does not fit, naming the field and not echoing the value', async () => {
    const response = await handle(post(JSON.stringify({ name: 5, extra: 'sneaky' })));
    expect(response.status).toBe(422);
    const problem = await problemOf(response);
    expect(problem['code']).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(problem)).not.toContain('sneaky');
  });

  it('parses the query string and the path parameters', async () => {
    const withInputs = withRoute({
      route: '/api/v1/test-lead/[id]',
      method: 'GET',
      query: z.strictObject({ limit: z.coerce.number().int().max(200) }),
      params: z.strictObject({ id: z.string() }),
      output,
      handler: ({ query, params }) => ({ greeting: `${params.id}:${query.limit}` }),
    });
    const ok = await withInputs(get('https://portal.example.test/api/v1/test-lead/7?limit=50'), { params: Promise.resolve({ id: '7' }) });
    expect(await ok.json()).toEqual({ greeting: '7:50' });
    const tooMany = await withInputs(get('https://portal.example.test/api/v1/test-lead/7?limit=500'), { params: Promise.resolve({ id: '7' }) });
    expect(tooMany.status).toBe(422);
  });
});

describe('errors and the shape of the answer', () => {
  it('maps an application error to its status and code, with no cause in the body', async () => {
    const handle = withRoute({
      route: '/api/v1/test-all',
      method: 'GET',
      output,
      handler: () => {
        throw new ConflictError('Someone else changed this.', { code: 'REVISION_CONFLICT', cause: new Error('relation "estimate_nodes" lock') });
      },
    });
    const response = await handle(get());
    expect(response.status).toBe(409);
    const text = JSON.stringify(await problemOf(response));
    expect(text).toContain('REVISION_CONFLICT');
    expect(text).not.toContain('estimate_nodes');
  });

  it('a service ForbiddenError with the default code is the same fixed 403', async () => {
    const handle = withRoute({
      route: '/api/v1/test-all',
      method: 'GET',
      output,
      handler: () => {
        throw new ForbiddenError('this is Engineer 7\x27s task');
      },
    });
    const response = await handle(get());
    expect(await problemOf(response)).toMatchObject({ title: 'You do not have access to this.', code: 'FORBIDDEN' });
  });

  it('an unexpected failure is a generic 500 with a reference, and the log gets the cause', async () => {
    const handle = withRoute({
      route: '/api/v1/test-all',
      method: 'GET',
      output,
      handler: () => {
        throw new Error('connect ECONNREFUSED 10.0.0.5:5432');
      },
    });
    const response = await handle(get());
    expect(response.status).toBe(500);
    const text = JSON.stringify(await problemOf(response));
    expect(text).not.toContain('ECONNREFUSED');
    expect(text).toMatch(/req-[0-9a-f]{8}/);
    expect(mocks.error).toHaveBeenCalledTimes(1);
  });

  it('never sends a field its schema does not name: an extra key is an error, not a leak (NFR-002)', async () => {
    const handle = withRoute({
      route: '/api/v1/test-all',
      method: 'GET',
      output,
      // The handler is typed by the schema, so the extra field is smuggled in through a widened value.
      handler: () => ({ greeting: 'x', unitCost: 123.45 }),
    });
    const response = await handle(get());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await problemOf(response))).not.toContain('123.45');
  });
});
