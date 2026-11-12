import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { PASSWORD_CHANGE_REQUIRED_CODE } from '@/lib/errors';
import type { AuthenticatedUser } from '@/server/auth/session';
import type { HttpMethod, RouteRow } from '@/server/http/route-manifest';

/**
 * STORY-01.05 AC-5 and AC-3 in `withRoute`: a person who still has to set a new password (FR-004) is refused with 403
 * `PASSWORD_CHANGE_REQUIRED` on every route whose row is not `mustChangeAllowed`, before the role, the input or the handler; and a
 * handler can put the fresh session cookie on its success answer. The session and the manifest are replaced so the wrapper is tested
 * on its own (`http-with-route.test.ts` is the wrapper's other behaviour).
 */

const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));

const TEST_ROWS: ReadonlyArray<RouteRow> = [
  { path: '/api/v1/test-closed', kind: 'api', methods: ['GET', 'POST'], roles: ['ADMIN', 'LEAD', 'ENGINEER'], status: 'implemented', stage: 'R1' },
  {
    path: '/api/v1/test-open',
    kind: 'api',
    methods: ['POST'],
    roles: ['ADMIN', 'LEAD', 'ENGINEER'],
    status: 'implemented',
    stage: 'R1',
    mustChangeAllowed: true,
  },
];

vi.mock('@/server/auth/session', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/server/http/route-manifest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/http/route-manifest')>();
  return {
    ...actual,
    findRoute: (path: string, method: HttpMethod) => TEST_ROWS.find((row) => row.path === path && row.methods.includes(method)),
  };
});

const { withRoute } = await import('@/server/http/with-route');

const APP_ORIGIN = 'https://portal.example.test';
const MUST_CHANGE: AuthenticatedUser = { id: 'u-new', name: 'Invented New', email: 'new@example.test', role: 'ENGINEER', mustChangePassword: true };
const SETTLED: AuthenticatedUser = { ...MUST_CHANGE, mustChangePassword: false };

const output = z.strictObject({ ok: z.boolean() });

function call(path: string, method: 'GET' | 'POST'): Request {
  return new Request(`${APP_ORIGIN}${path}`, { method, headers: { origin: APP_ORIGIN } });
}

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
  mocks.requireUser.mockReset();
  mocks.requireUser.mockResolvedValue(MUST_CHANGE);
});

describe('AC-5: a person who must set a new password', () => {
  it('is refused with 403 PASSWORD_CHANGE_REQUIRED on a route that is not open to them, and the handler never runs', async () => {
    const handler = vi.fn(() => ({ ok: true }));
    for (const method of ['GET', 'POST'] as const) {
      const response = await withRoute({ route: '/api/v1/test-closed', method, output, handler })(call('/api/v1/test-closed', method));
      expect(response.status).toBe(403);
      expect(response.headers.get('Content-Type')).toBe('application/problem+json');
      expect(await response.json()).toMatchObject({ status: 403, code: PASSWORD_CHANGE_REQUIRED_CODE, title: 'Set a new password to continue.' });
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it('is let through on a route whose row is mustChangeAllowed', async () => {
    const response = await withRoute({ route: '/api/v1/test-open', method: 'POST', output, handler: () => ({ ok: true }) })(call('/api/v1/test-open', 'POST'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('a person who has set one is let through everywhere', async () => {
    mocks.requireUser.mockResolvedValue(SETTLED);
    const response = await withRoute({ route: '/api/v1/test-closed', method: 'GET', output, handler: () => ({ ok: true }) })(call('/api/v1/test-closed', 'GET'));
    expect(response.status).toBe(200);
  });
});

describe('AC-3: the fresh session cookie', () => {
  const cookie = { name: 'next-auth.session-token', value: 'abc.def_ghi-1', maxAgeSeconds: 900, secure: false };

  it('puts the cookie the handler set on a 204 answer, beside no-store and the request ID', async () => {
    const handle = withRoute({
      route: '/api/v1/test-open',
      method: 'POST',
      status: 204,
      output: z.undefined(),
      handler: ({ setSessionCookie }) => {
        setSessionCookie(cookie);
        return undefined;
      },
    });
    const response = await handle(call('/api/v1/test-open', 'POST'));
    expect(response.status).toBe(204);
    expect(response.headers.get('Set-Cookie')).toBe('next-auth.session-token=abc.def_ghi-1; Max-Age=900; Path=/; HttpOnly; SameSite=Lax');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Request-Id')).toMatch(/^req-[0-9a-f]{8}$/);
  });

  it('puts it on a JSON answer too', async () => {
    const handle = withRoute({
      route: '/api/v1/test-open',
      method: 'POST',
      output,
      handler: ({ setSessionCookie }) => {
        setSessionCookie({ ...cookie, secure: true });
        return { ok: true };
      },
    });
    const response = await handle(call('/api/v1/test-open', 'POST'));
    expect(response.headers.get('Set-Cookie')).toContain('; Secure');
  });

  it('sets none when the handler refuses: a refusal never issues a session', async () => {
    const handle = withRoute({
      route: '/api/v1/test-open',
      method: 'POST',
      output,
      handler: ({ setSessionCookie }) => {
        setSessionCookie(cookie);
        throw new Error('refused after the cookie was prepared');
      },
    });
    const response = await handle(call('/api/v1/test-open', 'POST'));
    expect(response.status).toBe(500);
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });

  it('an answer without a cookie has no Set-Cookie header', async () => {
    const response = await withRoute({ route: '/api/v1/test-open', method: 'POST', output, handler: () => ({ ok: true }) })(call('/api/v1/test-open', 'POST'));
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });
});
