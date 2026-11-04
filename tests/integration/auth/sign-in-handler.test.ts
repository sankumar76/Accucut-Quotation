// next-auth does not export its core handler by package name, so it is reached by path. This is the function the route
// handler calls once it has read the request, and it is the only way to drive a sign-in without a running server.
import { AuthHandler, type ResponseInternal } from '../../../node_modules/next-auth/core/index.js';
import { decode } from 'next-auth/jwt';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createFixedClock, MILLISECONDS_PER_MINUTE, type FixedClock } from '@/lib/time';
import { buildAuthOptions } from '@/server/auth/options';
import { resolveSessionUser } from '@/server/auth/resolve-session-user';
import { createAuthService, THROTTLE_POLICY } from '@/server/services/auth-service';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { createTestHasher, insertUser, TEST_PASSWORD } from '../../support/builders/user';
import { defined } from '../../support/defined';

/**
 * STORY-01.01 AC-1 to AC-5 through next-auth's own handler (the one the route calls), over real PostgreSQL and a
 * controlled clock. The options are built in production mode over plain http (test strategy section 7, "Cookies"),
 * so the cookie names and flags are the ones a deployed server sends. The route's 429 mapping is tested in
 * `tests/unit/auth-locked-response.test.ts`; the browser-level behaviour in `tests/e2e/sign-in.spec.ts`.
 */

const SECRET = 'invented-handler-test-key-material-long-enough';
const ORIGIN = 'https://portal.example.test';
const START = new Date('2026-11-04T09:00:00.000Z');
const SESSION_COOKIE = '__Secure-next-auth.session-token';
const hasher = createTestHasher();

let db: AuthDatabase;
let clock: FixedClock;
let counter = 0;

function optionsFor(production: boolean) {
  const authService = createAuthService({ users: db.users, throttles: db.throttles, hasher, clock, keySecret: SECRET });
  return buildAuthOptions({ authService, clock, secret: SECRET, production });
}

type Options = ReturnType<typeof optionsFor>;

interface Tokens {
  readonly csrfCookieName: string;
  readonly csrfCookieValue: string;
  readonly csrfToken: string;
}

async function fetchCsrf(options: Options): Promise<Tokens> {
  const response = await AuthHandler<{ csrfToken: string }>({ req: { action: 'csrf', method: 'GET', origin: ORIGIN, headers: {} }, options });
  const cookie = defined(response.cookies?.[0], 'csrf cookie');
  const token = defined(response.body?.csrfToken, 'csrf token');
  return { csrfCookieName: cookie.name, csrfCookieValue: cookie.value, csrfToken: token };
}

async function signInWith(options: Options, email: string, password: string, address = '203.0.113.5'): Promise<ResponseInternal> {
  const csrf = await fetchCsrf(options);
  return AuthHandler({
    req: {
      action: 'callback',
      providerId: 'credentials',
      method: 'POST',
      origin: ORIGIN,
      headers: { 'x-forwarded-for': address },
      cookies: { [csrf.csrfCookieName]: csrf.csrfCookieValue },
      body: { csrfToken: csrf.csrfToken, email, password, json: 'true' },
    },
    options,
  });
}

function errorOf(response: ResponseInternal): string | null {
  return response.redirect === undefined ? null : new URL(response.redirect, ORIGIN).searchParams.get('error');
}

/** A fresh address per test, so the per-address limit of one test never leaks into another. */
function freshAddress(): string {
  counter += 1;
  return `198.51.100.${counter}`;
}

beforeAll(async () => {
  db = await openAuthDatabase();
  clock = createFixedClock(START);
});

afterAll(async () => {
  await db.close();
});

describe('AC-1 and AC-5: a correct sign-in sets the session cookie', () => {
  it('sends the cookie with the __Secure- prefix, HttpOnly, Secure and SameSite=Lax, in production mode', async () => {
    const user = await insertUser(db.users, hasher, { role: 'LEAD' });
    const response = await signInWith(optionsFor(true), user.email, TEST_PASSWORD, freshAddress());
    expect(response.status).toBeUndefined();
    expect(errorOf(response)).toBeNull();
    const cookie = defined(response.cookies?.find((item) => item.name === SESSION_COOKIE), 'session cookie');
    expect(cookie.options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  });

  it('outside production the cookie has no prefix and is not Secure, so http://localhost works', async () => {
    const user = await insertUser(db.users, hasher);
    const response = await signInWith(optionsFor(false), user.email, TEST_PASSWORD, freshAddress());
    const cookie = defined(response.cookies?.find((item) => item.name === 'next-auth.session-token'), 'session cookie');
    expect(cookie.options).toMatchObject({ httpOnly: true, secure: false, sameSite: 'lax' });
  });

  it('the token holds only the user ID, the session version and the sign-in time, and lasts 12 hours', async () => {
    const user = await insertUser(db.users, hasher, { role: 'ADMIN', name: 'Invented Admin' });
    const response = await signInWith(optionsFor(true), user.email, TEST_PASSWORD, freshAddress());
    const cookie = defined(response.cookies?.find((item) => item.name === SESSION_COOKIE), 'session cookie');
    const token = defined(await decode({ token: cookie.value, secret: SECRET }), 'decoded token');
    expect(Object.keys(token).sort()).toEqual(['exp', 'iat', 'jti', 'signedAt', 'sub', 'sv']);
    expect(token).toMatchObject({ sub: user.id, sv: 0, signedAt: START.getTime() / 1_000 });
    expect(Number(token['exp']) - Number(token['iat'])).toBe(12 * 60 * 60);
    expect(JSON.stringify(token)).not.toContain(user.email);
    expect(JSON.stringify(token)).not.toContain('ADMIN');
    expect(JSON.stringify(token)).not.toContain('Invented Admin');
  });

  it('the session cookie is not readable without the secret', async () => {
    const user = await insertUser(db.users, hasher);
    const response = await signInWith(optionsFor(true), user.email, TEST_PASSWORD, freshAddress());
    const cookie = defined(response.cookies?.find((item) => item.name === SESSION_COOKIE), 'session cookie');
    expect(await decode({ token: cookie.value, secret: 'another-secret-entirely-0123456789-abcdef' }).catch(() => null)).toBeNull();
  });

  it('the e-mail is accepted in any letter case', async () => {
    const user = await insertUser(db.users, hasher);
    const response = await signInWith(optionsFor(true), user.email.toUpperCase(), TEST_PASSWORD, freshAddress());
    expect(response.cookies?.some((item) => item.name === SESSION_COOKIE)).toBe(true);
  });
});

describe('AC-2: one answer for a wrong password, an unknown e-mail and a deactivated account', () => {
  it('gives the same status and the same error code, and sets no session cookie', async () => {
    const wrong = await insertUser(db.users, hasher);
    const deactivated = await insertUser(db.users, hasher);
    await db.owner.query(`UPDATE users SET is_active = false WHERE id = $1`, [deactivated.id]);
    const options = optionsFor(true);

    const responses = [
      await signInWith(options, wrong.email, 'a-wrong-password', freshAddress()),
      await signInWith(options, 'nobody-at-all@example.test', TEST_PASSWORD, freshAddress()),
      await signInWith(options, deactivated.email, TEST_PASSWORD, freshAddress()),
    ];
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(errorOf(response)).toBe('CredentialsSignin');
      expect(response.cookies?.some((item) => item.name === SESSION_COOKIE)).toBe(false);
    }
    expect(new Set(responses.map((response) => response.redirect)).size).toBe(1);
  });
});

describe('AC-3: lock-out, with a controlled clock', () => {
  it('five failures, then the sixth is refused as locked for 15 minutes; a correct password during the block is refused; after 15 minutes sign-in works', async () => {
    const user = await insertUser(db.users, hasher);
    const options = optionsFor(true);
    const address = freshAddress();
    for (let count = 0; count < THROTTLE_POLICY.accountFailureLimit; count += 1) {
      expect(errorOf(await signInWith(options, user.email, 'wrong-password', address))).toBe('CredentialsSignin');
    }
    expect(errorOf(await signInWith(options, user.email, 'wrong-password', address))).toBe('locked');
    expect(errorOf(await signInWith(options, user.email, TEST_PASSWORD, address))).toBe('locked');

    clock.advance(THROTTLE_POLICY.blockMilliseconds - MILLISECONDS_PER_MINUTE);
    expect(errorOf(await signInWith(options, user.email, TEST_PASSWORD, address))).toBe('locked');
    clock.advance(MILLISECONDS_PER_MINUTE);
    const response = await signInWith(options, user.email, TEST_PASSWORD, address);
    expect(errorOf(response)).toBeNull();
    expect(response.cookies?.some((item) => item.name === SESSION_COOKIE)).toBe(true);
  });

  it('an unknown e-mail takes the same path and shows the same locked answer', async () => {
    const options = optionsFor(true);
    const email = 'invented-unknown@example.test';
    for (let count = 0; count < THROTTLE_POLICY.accountFailureLimit; count += 1) {
      expect(errorOf(await signInWith(options, email, 'x', freshAddress()))).toBe('CredentialsSignin');
    }
    expect(errorOf(await signInWith(options, email, 'x', freshAddress()))).toBe('locked');
  });

  it('per address, 30 failures in 15 minutes also block', async () => {
    const options = optionsFor(true);
    const address = freshAddress();
    for (let count = 0; count < THROTTLE_POLICY.ipFailureLimit; count += 1) {
      await signInWith(options, `spray${count}@example.test`, 'x', address);
    }
    const user = await insertUser(db.users, hasher);
    expect(errorOf(await signInWith(options, user.email, TEST_PASSWORD, address))).toBe('locked');
    expect(errorOf(await signInWith(options, user.email, TEST_PASSWORD, freshAddress()))).toBeNull();
  });
});

describe('AC-4: sign-out', () => {
  it('clears the session cookie and ends every session of the person, so a copied cookie stops working', async () => {
    const user = await insertUser(db.users, hasher, { role: 'LEAD' });
    const options = optionsFor(true);
    const signedIn = await signInWith(options, user.email, TEST_PASSWORD, freshAddress());
    const session = defined(signedIn.cookies?.find((item) => item.name === SESSION_COOKIE), 'session cookie');
    const claims = { userId: user.id, sessionVersion: 0, signedAt: START.getTime() / 1_000 };
    expect(await resolveSessionUser(claims, db.users, clock.now())).not.toBeNull();

    const csrf = await fetchCsrf(options);
    const out = await AuthHandler({
      req: {
        action: 'signout',
        method: 'POST',
        origin: ORIGIN,
        headers: {},
        cookies: { [csrf.csrfCookieName]: csrf.csrfCookieValue, [SESSION_COOKIE]: session.value },
        body: { csrfToken: csrf.csrfToken, json: 'true' },
      },
      options,
    });
    const cleared = defined(out.cookies?.find((item) => item.name === SESSION_COOKIE), 'cleared cookie');
    expect(cleared.value).toBe('');
    expect(cleared.options.maxAge).toBe(0);

    expect((await db.users.findAccountById(user.id))?.sessionVersion).toBe(1);
    expect(await resolveSessionUser(claims, db.users, clock.now())).toBeNull();
  });

  it('a sign-out without a valid CSRF token does not end anyone\'s session', async () => {
    const user = await insertUser(db.users, hasher);
    const options = optionsFor(true);
    const signedIn = await signInWith(options, user.email, TEST_PASSWORD, freshAddress());
    const session = defined(signedIn.cookies?.find((item) => item.name === SESSION_COOKIE), 'session cookie');
    await AuthHandler({
      req: {
        action: 'signout',
        method: 'POST',
        origin: ORIGIN,
        headers: {},
        cookies: { [SESSION_COOKIE]: session.value },
        body: { csrfToken: 'not-the-token', json: 'true' },
      },
      options,
    });
    expect((await db.users.findAccountById(user.id))?.sessionVersion).toBe(0);
  });
});

describe('AC-5: role and active flag are read from the database on every request', () => {
  it('a deactivation and a role change are effective at the next request, with the same cookie', async () => {
    const user = await insertUser(db.users, hasher, { role: 'LEAD' });
    const claims = { userId: user.id, sessionVersion: 0, signedAt: START.getTime() / 1_000 };
    expect((await resolveSessionUser(claims, db.users, clock.now()))?.role).toBe('LEAD');
    await db.owner.query(`UPDATE users SET role = 'ENGINEER' WHERE id = $1`, [user.id]);
    expect((await resolveSessionUser(claims, db.users, clock.now()))?.role).toBe('ENGINEER');
    await db.owner.query(`UPDATE users SET is_active = false WHERE id = $1`, [user.id]);
    expect(await resolveSessionUser(claims, db.users, clock.now())).toBeNull();
  });
});
