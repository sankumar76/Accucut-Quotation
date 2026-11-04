import type { CredentialsConfig } from 'next-auth/providers/credentials';
import { describe, expect, it, vi } from 'vitest';

import { createFixedClock } from '@/lib/time';
import { buildAuthOptions, LOCKED_ERROR_CODE, UNAVAILABLE_ERROR_CODE } from '@/server/auth/options';
import { SESSION_MAX_AGE_SECONDS } from '@/server/auth/session-token';
import type { AuthService, SignInResult } from '@/server/services/auth-service';

import { defined } from '../support/defined';

/**
 * STORY-01.01 AC-5 and AC-4: what the next-auth options say. Over plain http the test builds them in production
 * mode (test strategy section 7, "Cookies"); the real cookie headers are checked in
 * `tests/integration/auth/sign-in-handler.test.ts`.
 */

const SECRET = 'invented-options-test-key-material';
const NOW = new Date('2026-11-04T09:00:00.000Z');

function fakeService(overrides: Partial<AuthService> = {}): AuthService & { readonly ended: string[] } {
  const ended: string[] = [];
  return {
    ended,
    authenticate: () => Promise.resolve<SignInResult>({ status: 'refused', reason: 'invalid' }),
    endAllSessions(userId) {
      ended.push(userId);
      return Promise.resolve();
    },
    ...overrides,
  };
}

function options(service: AuthService, production = true) {
  return buildAuthOptions({ authService: service, clock: createFixedClock(NOW), secret: SECRET, production });
}

/** The credentials provider's `authorize`, which next-auth keeps under `options.authorize`. */
function authorizeOf(service: AuthService) {
  const provider = defined(options(service).providers[0], 'credentials provider');
  const credentials = provider as CredentialsConfig;
  return defined(credentials.options.authorize, 'authorize');
}

const request = { headers: { 'x-forwarded-for': '203.0.113.9' }, body: {}, query: {}, method: 'POST' };

describe('AC-5: cookie and session settings', () => {
  it('in production mode the cookie is Secure (so it gets the __Secure- prefix), and the session is a 12-hour JWT', () => {
    const built = options(fakeService(), true);
    expect(built.useSecureCookies).toBe(true);
    expect(built.session).toEqual({ strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS });
    expect(built.jwt?.maxAge).toBe(12 * 60 * 60);
    expect(built.secret).toBe(SECRET);
  });

  it('outside production the cookie is not Secure, so a local http page can keep a session', () => {
    expect(options(fakeService(), false).useSecureCookies).toBe(false);
  });

  it('shows the sign-in page for a failure, so no next-auth page is ever shown', () => {
    expect(options(fakeService()).pages).toEqual({ signIn: '/sign-in', error: '/sign-in' });
  });

  it('the token built at sign-in holds the user ID, the session version and the sign-in time, and nothing else', async () => {
    const jwt = defined(options(fakeService()).callbacks?.jwt, 'jwt callback');
    const token = await jwt({
      token: { name: 'Should Not Stay', email: 'should.not@stay.test', picture: 'x', sub: 'ignored' },
      user: { id: 'user-1', name: 'Name', email: 'a@example.test', sessionVersion: 3 },
      account: null,
    });
    expect(token).toEqual({ sub: 'user-1', sv: 3, signedAt: NOW.getTime() / 1_000 });
  });

  it('a later request leaves the token as it is: the sign-in time does not move', async () => {
    const jwt = defined(options(fakeService()).callbacks?.jwt, 'jwt callback');
    const existing = { sub: 'user-1', sv: 3, signedAt: 5 };
    // A later request has a token and no `user`; next-auth's types only describe the sign-in call.
    expect(await jwt({ token: existing } as never)).toBe(existing);
  });

  it('the session shows the three values and no role, e-mail or name', async () => {
    const session = defined(options(fakeService()).callbacks?.session, 'session callback');
    const result = await session({
      session: { expires: '2026-11-04T21:00:00.000Z', user: { name: 'x', email: 'x@example.test' } },
      token: { sub: 'user-1', sv: 3, signedAt: 7 },
      user: { id: 'user-1', email: 'x@example.test', emailVerified: null },
      newSession: undefined,
      trigger: 'update',
    });
    expect(result).toEqual({ expires: '2026-11-04T21:00:00.000Z', userId: 'user-1', sessionVersion: 3, signedAt: 7 });
  });

  it('a token that is not ours gives a session with no user at all', async () => {
    const session = defined(options(fakeService()).callbacks?.session, 'session callback');
    const result = await session({ session: { expires: '2026-11-04T21:00:00.000Z' }, token: { sub: 'user-1' } } as never);
    expect(result).toEqual({ expires: '2026-11-04T21:00:00.000Z' });
  });
});

describe('AC-2 and AC-3: authorize turns the service answer into next-auth\'s', () => {
  it('returns the user for a successful sign-in, with the address of the request passed on', async () => {
    const authenticate = vi.fn((): Promise<SignInResult> => Promise.resolve({ status: 'signed-in', userId: 'user-1', sessionVersion: 2 }));
    const authorize = authorizeOf(fakeService({ authenticate }));
    expect(await authorize({ email: 'a@example.test', password: 'pw' }, request)).toEqual({ id: 'user-1', sessionVersion: 2 });
    expect(authenticate).toHaveBeenCalledWith({ email: 'a@example.test', password: 'pw', ipAddress: '203.0.113.9' });
  });

  it('returns null for an invalid sign-in, which next-auth answers with one generic 401', async () => {
    expect(await authorizeOf(fakeService())({ email: 'a@example.test', password: 'pw' }, request)).toBeNull();
  });

  it('throws the locked code for a blocked sign-in', async () => {
    const authorize = authorizeOf(fakeService({ authenticate: () => Promise.resolve<SignInResult>({ status: 'refused', reason: 'locked' }) }));
    await expect(authorize({ email: 'a@example.test', password: 'pw' }, request)).rejects.toThrow(LOCKED_ERROR_CODE);
  });

  it.each([
    ['no credentials', undefined],
    ['an empty e-mail', { email: '', password: 'pw' }],
    ['an empty password', { email: 'a@example.test', password: '' }],
    ['a missing password', { email: 'a@example.test' }],
    ['an over-long password', { email: 'a@example.test', password: 'x'.repeat(1_025) }],
    ['an over-long e-mail', { email: `${'a'.repeat(321)}@example.test`, password: 'pw' }],
  ])('returns null for %s without asking the service', async (_name, credentials) => {
    const authenticate = vi.fn((): Promise<SignInResult> => Promise.resolve({ status: 'refused', reason: 'invalid' }));
    expect(await authorizeOf(fakeService({ authenticate }))(credentials, request)).toBeNull();
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('turns any other failure into the "unavailable" code, so no cause reaches the client (STD-19)', async () => {
    const authorize = authorizeOf(
      fakeService({ authenticate: () => Promise.reject(new Error('connect ECONNREFUSED db.internal.example:5432')) }),
    );
    const failure: unknown = await authorize({ email: 'a@example.test', password: 'pw' }, request).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure instanceof Error ? failure.message : '').toBe(UNAVAILABLE_ERROR_CODE);
  });

  it('passes no address when the request has none', async () => {
    const authenticate = vi.fn((): Promise<SignInResult> => Promise.resolve({ status: 'refused', reason: 'invalid' }));
    await authorizeOf(fakeService({ authenticate }))({ email: 'a@example.test', password: 'pw' }, { ...request, headers: {} });
    expect(authenticate).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: null }));
  });
});

describe('AC-4: sign-out ends every session of the person', () => {
  it('raises the session version of the user named in the token', async () => {
    const service = fakeService();
    const signOut = defined(options(service).events?.signOut, 'signOut event');
    await signOut({ token: { sub: 'user-1', sv: 0, signedAt: 1 }, session: undefined as never });
    expect(service.ended).toEqual(['user-1']);
  });

  it('does nothing for a token that is not ours', async () => {
    const service = fakeService();
    await defined(options(service).events?.signOut, 'signOut event')({ token: { sub: 'user-1' }, session: undefined as never });
    expect(service.ended).toEqual([]);
  });

  it('does not fail the sign-out when the version cannot be raised: the cookie is still cleared, and the fault is logged', async () => {
    const service = fakeService({ endAllSessions: () => Promise.reject(new Error('database down')) });
    await expect(
      defined(options(service).events?.signOut, 'signOut event')({ token: { sub: 'user-1', sv: 0, signedAt: 1 }, session: undefined as never }),
    ).resolves.toBeUndefined();
  });
});
