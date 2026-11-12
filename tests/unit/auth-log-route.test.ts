import type { NextAuthOptions } from 'next-auth';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { createFixedClock } from '@/lib/time';
import { buildAuthOptions } from '@/server/auth/options';
import type { AuthService } from '@/server/services/auth-service';

/**
 * SEC-01 (round 2 of STORY-01.06; issue 255): with a `logger` in the next-auth options, next-auth's `POST /api/auth/_log` writes whatever
 * the caller sends to that logger, with no sign-in and no CSRF token. The route closes it with a 404 before next-auth sees the request.
 *
 * The real route handler runs over the real options. Underneath it, next-auth's own core (`AuthHandler`, the function its route adapter
 * calls, as `tests/integration/auth/sign-in-handler.test.ts` does) stands in for the adapter, which can only run inside a Next.js request.
 * The core is what answers `_log`, so a route that lets the request through shows as a line at the logger. The pino logger is replaced, so
 * a line at any level shows.
 */

const logs = vi.hoisted(() => ({
  debug: vi.fn<(fields: Record<string, unknown>, message: string) => void>(),
  warn: vi.fn<(fields: Record<string, unknown>, message: string) => void>(),
  error: vi.fn<(fields: Record<string, unknown>, message: string) => void>(),
  info: vi.fn<(fields: Record<string, unknown>, message: string) => void>(),
}));
vi.mock('@/lib/logger', () => ({ logger: logs }));

const SECRET = 'invented-log-route-test-key-material';
const ORIGIN = 'https://portal.example.test';
const OK_STATUS = 200;

const authService: AuthService = {
  authenticate: () => Promise.resolve({ status: 'refused', reason: 'invalid' }),
  endAllSessions: () => Promise.resolve(true),
};

vi.mock('@/server/composition', () => ({
  getAuthOptions: () =>
    buildAuthOptions({ authService, clock: createFixedClock(new Date('2026-11-04T09:00:00.000Z')), secret: SECRET, production: true }),
}));

vi.mock('next-auth', async () => {
  // next-auth does not export its core by package name, so it is reached by path.
  const { AuthHandler } = await import('../../node_modules/next-auth/core/index.js');
  return {
    default: (options: NextAuthOptions) => async (request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) => {
      const { nextauth } = await context.params;
      const body = Object.fromEntries(new URLSearchParams(await request.text()));
      const answer = await AuthHandler({
        req: { action: nextauth[0] === '_log' ? '_log' : 'csrf', method: request.method, origin: ORIGIN, headers: {}, cookies: {}, query: {}, body },
        options,
      });
      return new Response(JSON.stringify(answer.body ?? {}), { status: answer.status ?? OK_STATUS });
    },
  };
});

const { GET, POST } = await import('@/app/api/auth/[...nextauth]/route');

function logRequest(method: 'GET' | 'POST', body: string): NextRequest {
  return new NextRequest(`${ORIGIN}/api/auth/_log`, {
    method,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    ...(method === 'POST' ? { body } : {}),
  });
}

function nothingWasLogged(): void {
  for (const level of [logs.debug, logs.warn, logs.error, logs.info]) expect(level).not.toHaveBeenCalled();
}

describe('SEC-01: the log relay of next-auth is closed', () => {
  it.each([
    ['an error line forged as the expired-token code', 'level=error&code=JWT_SESSION_ERROR&name=JWTExpired'],
    ['a warning', 'level=warn&code=NEXTAUTH_URL'],
    ['a debug line', 'level=debug&code=SESSION'],
  ])('POST /api/auth/_log with %s answers 404 and writes nothing at any level', async (_name, body) => {
    const response = await POST(logRequest('POST', body), { params: Promise.resolve({ nextauth: ['_log'] }) });
    expect(response.status).toBe(404);
    nothingWasLogged();
  });

  it('GET /api/auth/_log answers 404 as well', async () => {
    const response = await GET(logRequest('GET', ''), { params: Promise.resolve({ nextauth: ['_log'] }) });
    expect(response.status).toBe(404);
    nothingWasLogged();
  });

  it('the other next-auth routes still reach next-auth (the CSRF token is answered)', async () => {
    const response = await GET(new NextRequest(`${ORIGIN}/api/auth/csrf`), { params: Promise.resolve({ nextauth: ['csrf'] }) });
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({ csrfToken: expect.any(String) });
  });
});
