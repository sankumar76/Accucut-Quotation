// next-auth does not export its core handler by package name, so it is reached by path (see sign-in-handler.test.ts).
import { AuthHandler, type ResponseInternal } from '../../../node_modules/next-auth/core/index.js';
import { decode } from 'next-auth/jwt';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createFixedClock, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE, type FixedClock } from '@/lib/time';
import { buildAuthOptions } from '@/server/auth/options';
import { resolveSession, type SessionClaims } from '@/server/auth/resolve-session-user';
import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_MAX_AGE_SECONDS, sessionTokenSchema } from '@/server/auth/session-token';
import { createAuthService } from '@/server/services/auth-service';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { createTestHasher, insertUser, TEST_PASSWORD } from '../../support/builders/user';
import { defined } from '../../support/defined';

/**
 * STORY-01.06 (T4): the 12-hour session through next-auth's own handler, over real PostgreSQL and a controlled clock, so a test
 * never waits 12 hours. A session is counted from sign-in (ASSUMPTION-56), and what the browser does with the cookie, or a script
 * that calls the session route every minute, cannot make it longer: the token is written again with only the time that is left.
 *
 * AC-1 a request just before 12 hours is accepted and one just after is refused, for a session used every minute;
 * AC-2 the token holds the sign-in time and lives 12 hours, and is not renewed on activity;
 * AC-5 a deactivation, a role change and a sign-out are effective at the next request, inside the 12 hours.
 * The page and API answers are in `tests/unit/auth-session.test.ts` and `tests/e2e/session-ended.spec.ts`.
 */

const SECRET = 'invented-session-expiry-test-key-material-long-enough';
const ORIGIN = 'https://portal.example.test';
const START = new Date('2026-11-04T09:00:00.000Z');
/** 23:59 on 4 November in India (UTC+05:30): the 12 hours run across midnight and ignore the calendar. */
const JUST_BEFORE_MIDNIGHT_IST = new Date('2026-11-04T18:29:00.000Z');
const SESSION_COOKIE = '__Secure-next-auth.session-token';
const hasher = createTestHasher();

let db: AuthDatabase;
let clock: FixedClock;
let counter = 0;

function optionsFor() {
  const authService = createAuthService({ users: db.users, throttles: db.throttles, hasher, clock, keySecret: SECRET });
  return buildAuthOptions({ authService, clock, secret: SECRET, production: true });
}

type Options = ReturnType<typeof optionsFor>;

async function fetchCsrf(options: Options) {
  const response = await AuthHandler<{ csrfToken: string }>({ req: { action: 'csrf', method: 'GET', origin: ORIGIN, headers: {} }, options });
  const cookie = defined(response.cookies?.[0], 'csrf cookie');
  return { name: cookie.name, value: cookie.value, token: defined(response.body?.csrfToken, 'csrf token') };
}

/** Signs in a new invented person from an address of their own, and returns the session cookie next-auth sent. */
async function signIn(role: 'LEAD' | 'ENGINEER' = 'LEAD'): Promise<{ readonly id: string; readonly cookie: NonNullable<ResponseInternal['cookies']>[number] }> {
  const user = await insertUser(db.users, hasher, { role });
  counter += 1;
  const options = optionsFor();
  const csrf = await fetchCsrf(options);
  const response = await AuthHandler({
    req: {
      action: 'callback',
      providerId: 'credentials',
      method: 'POST',
      origin: ORIGIN,
      headers: { 'x-forwarded-for': `198.51.100.${counter}` },
      cookies: { [csrf.name]: csrf.value },
      body: { csrfToken: csrf.token, email: user.email, password: TEST_PASSWORD, json: 'true' },
    },
    options,
  });
  return { id: user.id, cookie: defined(response.cookies?.find((item) => item.name === SESSION_COOKIE), 'session cookie') };
}

/** What a page or a route sees of a cookie at the current time of the clock: next-auth's session body, then our own check. */
async function requestWith(cookieValue: string, user: { readonly id: string }, sessionVersion = 0) {
  const response = await AuthHandler<{ signedAt?: number }>({
    req: { action: 'session', method: 'GET', origin: ORIGIN, headers: {}, cookies: { [SESSION_COOKIE]: cookieValue } },
    options: optionsFor(),
  });
  const signedAt = response.body?.signedAt;
  const claims: SessionClaims | null = signedAt === undefined ? null : { userId: user.id, sessionVersion, signedAt };
  return { response, resolution: await resolveSession(claims, db.users, clock.now()) };
}

beforeAll(async () => {
  db = await openAuthDatabase();
});

beforeEach(() => {
  clock = createFixedClock(START);
});

afterAll(async () => {
  await db.close();
});

describe('AC-1: the 12 hours are counted from sign-in, whatever the activity', () => {
  it('a session used every minute is accepted at 11 h 59 m 59 s and refused at 12 h 00 m 01 s', async () => {
    const { id, cookie } = await signIn();
    for (let minute = 1; minute < 12 * 60; minute += 1) {
      clock.advance(MILLISECONDS_PER_MINUTE);
      expect((await requestWith(cookie.value, { id })).resolution.status).toBe('active');
    }
    clock.advance(MILLISECONDS_PER_MINUTE - 1_000);
    expect((await requestWith(cookie.value, { id })).resolution.status).toBe('active');
    clock.advance(2_000);
    expect((await requestWith(cookie.value, { id })).resolution.status).toBe('ended');
  }, 60_000);

  it('a cookie that next-auth wrote again after every request (a script that calls the session route) lives no longer', async () => {
    const { id, cookie } = await signIn();
    let current = cookie.value;
    for (let hour = 1; hour < 12; hour += 1) {
      clock.advance(MILLISECONDS_PER_HOUR);
      const { response, resolution } = await requestWith(current, { id });
      expect(resolution.status).toBe('active');
      current = defined(response.cookies?.find((item) => item.name === SESSION_COOKIE), 'rewritten cookie').value;
    }
    clock.advance(MILLISECONDS_PER_HOUR - 1_000);
    expect((await requestWith(current, { id })).resolution.status).toBe('active');
    clock.advance(2_000);
    expect((await requestWith(current, { id })).resolution.status).toBe('ended');
  });

  it('the 12 hours ignore the calendar: a sign-in at 23:59 IST is good across midnight and over 12 hours later', async () => {
    clock.set(JUST_BEFORE_MIDNIGHT_IST);
    const { id, cookie } = await signIn();
    clock.advance(12 * MILLISECONDS_PER_HOUR - 1_000);
    expect((await requestWith(cookie.value, { id })).resolution.status).toBe('active');
    clock.advance(2_000);
    expect((await requestWith(cookie.value, { id })).resolution.status).toBe('ended');
  });

  it('a session that spans a deployment is still good: the secret is unchanged, so the options built again read the same cookie', async () => {
    const { id, cookie } = await signIn();
    clock.advance(6 * MILLISECONDS_PER_HOUR);
    expect((await requestWith(cookie.value, { id })).resolution.status).toBe('active');
  });
});

describe('AC-2: what the token and the cookie hold', () => {
  it('the token holds the sign-in time and lives 12 hours from it', async () => {
    const { cookie } = await signIn();
    const token = defined(await decode({ token: cookie.value, secret: SECRET }), 'decoded token');
    expect(sessionTokenSchema.parse(token).signedAt).toBe(START.getTime() / 1_000);
    expect(Number(token['exp']) - Number(token['iat'])).toBe(SESSION_MAX_AGE_SECONDS);
    expect(SESSION_MAX_AGE_SECONDS).toBe(12 * 60 * 60);
  });

  it('the token is not renewed on activity: written again 6 hours later it still ends at the same instant', async () => {
    const { id, cookie } = await signIn();
    const first = defined(await decode({ token: cookie.value, secret: SECRET }), 'first token');
    clock.advance(6 * MILLISECONDS_PER_HOUR);
    const { response } = await requestWith(cookie.value, { id });
    const again = defined(response.cookies?.find((item) => item.name === SESSION_COOKIE), 'rewritten cookie');
    const second = defined(await decode({ token: again.value, secret: SECRET }), 'second token');
    // Written again 6 hours (of the controlled clock) into the session, the token is given the 6 hours that are left, not a new 12.
    expect(Number(first['exp']) - Number(first['iat'])).toBe(12 * 60 * 60);
    expect(Number(second['exp']) - Number(second['iat'])).toBe(6 * 60 * 60);
    expect(second['signedAt']).toBe(first['signedAt']);
  });

  it('the cookie stays a stated number of days after the token has died, so a person coming back can be told', async () => {
    const { cookie } = await signIn();
    const expires = defined(cookie.options.expires, 'cookie expiry');
    const expected = Date.now() + SESSION_COOKIE_MAX_AGE_SECONDS * 1_000;
    expect(Math.abs(new Date(expires).getTime() - expected)).toBeLessThan(MILLISECONDS_PER_MINUTE);
    expect(SESSION_COOKIE_MAX_AGE_SECONDS).toBe(SESSION_MAX_AGE_SECONDS + 7 * 24 * 60 * 60);
  });
});

describe('AC-5: inside the 12 hours a deactivation, a role change and a sign-out take effect at the next request', () => {
  it('a role change re-scopes the session and a deactivation refuses it, with the same cookie, 6 hours in', async () => {
    const { id, cookie } = await signIn('LEAD');
    clock.advance(6 * MILLISECONDS_PER_HOUR);
    expect(await requestWith(cookie.value, { id })).toMatchObject({ resolution: { status: 'active', user: { role: 'LEAD' } } });
    await db.owner.query(`UPDATE users SET role = 'ENGINEER' WHERE id = $1`, [id]);
    expect(await requestWith(cookie.value, { id })).toMatchObject({ resolution: { status: 'active', user: { role: 'ENGINEER' } } });
    await db.owner.query(`UPDATE users SET is_active = false WHERE id = $1`, [id]);
    expect((await requestWith(cookie.value, { id })).resolution).toEqual({ status: 'refused' });
  });

  it('a session version that no longer matches refuses the session, and it is not described as an ended one', async () => {
    const { id, cookie } = await signIn();
    clock.advance(MILLISECONDS_PER_HOUR);
    await db.owner.query(`UPDATE users SET session_version = session_version + 1 WHERE id = $1`, [id]);
    expect((await requestWith(cookie.value, { id })).resolution).toEqual({ status: 'refused' });
  });
});
