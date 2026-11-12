import { decode, encode } from 'next-auth/jwt';
import type { CredentialsConfig } from 'next-auth/providers/credentials';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFixedClock, MILLISECONDS_PER_HOUR } from '@/lib/time';
import { buildAuthOptions, LOCKED_ERROR_CODE, UNAVAILABLE_ERROR_CODE } from '@/server/auth/options';
import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_MAX_AGE_SECONDS } from '@/server/auth/session-token';
import type { AuthService, SignInResult } from '@/server/services/auth-service';

import { defined } from '../support/defined';

// The pino logger is replaced, to read what is written and at which level.
const logs = vi.hoisted(() => ({
  debug: vi.fn<(fields: Record<string, unknown>, message: string) => void>(),
  warn: vi.fn<(fields: Record<string, unknown>, message: string) => void>(),
  error: vi.fn<(fields: Record<string, unknown>, message: string) => void>(),
}));
vi.mock('@/lib/logger', () => ({ logger: logs }));

/**
 * STORY-01.01 AC-5 and AC-4: what the next-auth options say. Over plain http the test builds them in production
 * mode (test strategy section 7, "Cookies"); the real cookie headers are checked in
 * `tests/integration/auth/sign-in-handler.test.ts`.
 */

const SECRET = 'invented-options-test-key-material';
const NOW = new Date('2026-11-04T09:00:00.000Z');

function fakeService(overrides: Partial<AuthService> = {}): AuthService & { readonly ended: Array<readonly [string, number]> } {
  const ended: Array<readonly [string, number]> = [];
  return {
    ended,
    authenticate: () => Promise.resolve<SignInResult>({ status: 'refused', reason: 'invalid' }),
    endAllSessions(userId, sessionVersion) {
      ended.push([userId, sessionVersion]);
      return Promise.resolve(true);
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
    // The token lives 12 hours (`jwt.maxAge`); the cookie stays a stated number of days longer so that a person coming back can be
    // told the session ended (STORY-01.06 AC-3). The server refuses the token after 12 hours whatever the cookie says.
    expect(built.session).toEqual({ strategy: 'jwt', maxAge: SESSION_COOKIE_MAX_AGE_SECONDS });
    expect(built.jwt?.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
    expect(SESSION_MAX_AGE_SECONDS).toBe(12 * 60 * 60);
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

  it('QLT-02: a token with the user and the version but no sign-in time gives a session with no user at all', async () => {
    const session = defined(options(fakeService()).callbacks?.session, 'session callback');
    const result = await session({
      session: { expires: '2026-11-04T21:00:00.000Z', user: { name: 'x', email: 'x@example.test' } },
      token: { sub: 'user-1', sv: 3 },
      user: { id: 'user-1', email: 'x@example.test', emailVerified: null },
      newSession: undefined,
      trigger: 'update',
    });
    expect(result).toEqual({ expires: '2026-11-04T21:00:00.000Z' });
  });

  it('a token that is not ours gives a session with no user at all', async () => {
    const session = defined(options(fakeService()).callbacks?.session, 'session callback');
    const result = await session({ session: { expires: '2026-11-04T21:00:00.000Z' }, token: { sub: 'user-1' } } as never);
    expect(result).toEqual({ expires: '2026-11-04T21:00:00.000Z' });
  });
});

describe('STORY-01.06 AC-2: the token does not live longer for being used', () => {
  const SIGNED_AT = NOW.getTime() / 1_000;
  const TOKEN = { sub: 'user-1', sv: 0, signedAt: SIGNED_AT };

  /** Writes the token the way next-auth does when it writes it again (it asks for the cookie's lifetime), and reads back its life. */
  async function lifeOf(token: Record<string, unknown>, clock = createFixedClock(NOW)): Promise<number> {
    const built = buildAuthOptions({ authService: fakeService(), clock, secret: SECRET, production: true });
    const encode = defined(built.jwt?.encode, 'jwt.encode');
    const written = await encode({ token, secret: SECRET, maxAge: SESSION_COOKIE_MAX_AGE_SECONDS });
    const read = defined(await decode({ token: written, secret: SECRET }), 'decoded token');
    return Number(read['exp']) - Number(read['iat']);
  }

  it('a token written at sign-in lives 12 hours', async () => {
    expect(await lifeOf(TOKEN)).toBe(12 * 60 * 60);
  });

  it('the same token written again 6 hours later lives only the 6 hours that are left: activity does not renew it', async () => {
    const clock = createFixedClock(NOW);
    clock.advance(6 * MILLISECONDS_PER_HOUR);
    expect(await lifeOf(TOKEN, clock)).toBe(6 * 60 * 60);
  });

  it('a token with no sign-in time is never written to live longer than 12 hours', async () => {
    expect(await lifeOf({ sub: 'user-1' })).toBe(12 * 60 * 60);
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
    await signOut({ token: { sub: 'user-1', sv: 3, signedAt: 1 }, session: undefined as never });
    // It names the version the token carries, so an out-of-date token cannot end the current session (ADR-009 amendment 1).
    expect(service.ended).toEqual([['user-1', 3]]);
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

describe('issue 255 (STD-05): next-auth\'s log lines for a session cookie that cannot be used', () => {
  beforeEach(() => {
    logs.debug.mockClear();
    logs.warn.mockClear();
    logs.error.mockClear();
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** The error next-auth really hands its logger: what `decode` throws for a token of that kind (`core/routes/session.js`). */
  async function realFailure(kind: 'expired' | 'wrong-key' | 'malformed'): Promise<Error> {
    const written = await encode({ token: { sub: 'user-1', sv: 0, signedAt: NOW.getTime() / 1_000 }, secret: SECRET, maxAge: 60 });
    vi.setSystemTime(new Date(NOW.getTime() + 120_000));
    const attempt =
      kind === 'malformed'
        ? decode({ token: 'not-a-token', secret: SECRET })
        : decode({ token: written, secret: kind === 'wrong-key' ? 'invented-other-key-material' : SECRET });
    const failure: unknown = await attempt.then(
      () => undefined,
      (error: unknown) => error,
    );
    if (!(failure instanceof Error)) throw new Error(`a ${kind} token did not fail to decode`);
    return failure;
  }

  function nextAuthLogger() {
    const built = defined(options(fakeService()).logger, 'logger');
    return { error: defined(built.error, 'logger.error'), warn: defined(built.warn, 'logger.warn'), debug: defined(built.debug, 'logger.debug') };
  }

  /** Every field object written at any level. */
  function writtenFields(): Array<Record<string, unknown>> {
    return [...logs.debug.mock.calls, ...logs.warn.mock.calls, ...logs.error.mock.calls].map(([fields]) => fields);
  }

  it('(i) JWT_SESSION_ERROR for an expired token goes to debug, and to no other level', async () => {
    nextAuthLogger().error('JWT_SESSION_ERROR', await realFailure('expired'));
    expect(logs.debug).toHaveBeenCalledWith(
      { authCode: 'JWT_SESSION_ERROR', errorName: 'JWTExpired', errorCode: 'ERR_JWT_EXPIRED' },
      expect.any(String),
    );
    expect(logs.warn).not.toHaveBeenCalled();
    expect(logs.error).not.toHaveBeenCalled();
  });

  it.each([
    ['cannot be decrypted (another key)', 'wrong-key' as const, 'ERR_JWE_DECRYPTION_FAILED'],
    ['cannot be parsed', 'malformed' as const, 'ERR_JWE_INVALID'],
  ])('(ii) JWT_SESSION_ERROR for a token that %s goes to warn, so it stays visible', async (_name, kind, errorCode) => {
    nextAuthLogger().error('JWT_SESSION_ERROR', await realFailure(kind));
    expect(logs.warn).toHaveBeenCalledWith(expect.objectContaining({ authCode: 'JWT_SESSION_ERROR', errorCode }), expect.any(String));
    expect(logs.debug).not.toHaveBeenCalled();
    expect(logs.error).not.toHaveBeenCalled();
  });

  it('(iii) every other code keeps its level and is never dropped', () => {
    const built = nextAuthLogger();
    built.error('SIGNIN_OAUTH_ERROR', new TypeError('invented failure'));
    built.warn('NEXTAUTH_URL');
    built.debug('CALLBACK_CREDENTIALS', { anything: 'here' });
    expect(logs.error).toHaveBeenCalledWith({ authCode: 'SIGNIN_OAUTH_ERROR', errorName: 'TypeError', errorCode: undefined }, expect.any(String));
    expect(logs.warn).toHaveBeenCalledWith({ authCode: 'NEXTAUTH_URL' }, expect.any(String));
    expect(logs.debug).toHaveBeenCalledWith({ authCode: 'CALLBACK_CREDENTIALS', errorName: undefined, errorCode: undefined }, expect.any(String));
  });

  it('(iv) only the code, the error name and the error code are written: never the message, the stack, the token or its claims', async () => {
    const secretText = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0.invented-token-body';
    const failure = await realFailure('wrong-key');
    failure.message = `could not decrypt ${secretText}`;
    failure.stack = `JWEDecryptionFailed: ${secretText}\n    at invented-decode-frame (jwt/index.js)`;
    const built = nextAuthLogger();
    built.error('JWT_SESSION_ERROR', Object.assign(failure, { token: secretText, claims: { sub: 'user-1' } }));
    built.error('SIGNIN_ERROR', { error: Object.assign(new Error(secretText), { token: secretText }), providerId: 'credentials' });
    built.debug('SESSION', { token: secretText, sub: 'user-1' });
    const written = JSON.stringify([logs.debug.mock.calls, logs.warn.mock.calls, logs.error.mock.calls]);
    for (const text of ['invented-token-body', 'invented-decode-frame', 'user-1', 'credentials', 'could not decrypt']) {
      expect(written).not.toContain(text);
    }
    expect(writtenFields()).toHaveLength(3);
    for (const fields of writtenFields()) {
      expect(Object.keys(fields).filter((key) => !['authCode', 'errorName', 'errorCode'].includes(key))).toEqual([]);
    }
  });

  it('a code, name or error code that is not a plain identifier is replaced, since POST /api/auth/_log lets anyone choose them', () => {
    const hostile = 'JWT_SESSION_ERROR"\n{"level":60,"msg":"forged"}';
    const built = nextAuthLogger();
    built.error(hostile, Object.assign(new Error('x'), { name: hostile, code: hostile }));
    built.debug(hostile, { error: { name: hostile, code: hostile } });
    expect(logs.error).toHaveBeenCalledWith({ authCode: 'unknown', errorName: undefined, errorCode: undefined }, expect.any(String));
    expect(logs.debug).toHaveBeenCalledWith({ authCode: 'unknown', errorName: undefined, errorCode: undefined }, expect.any(String));
  });
});
