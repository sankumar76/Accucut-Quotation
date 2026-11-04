// next-auth does not export its core handler by package name, so it is reached by path, as the developer's handler test does.
import { AuthHandler, type ResponseInternal } from '../../node_modules/next-auth/core/index.js';
import { decode } from 'next-auth/jwt';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { safeReturnPath, signInPathFor } from '@/lib/auth/return-path';
import { DatabaseBusyError } from '@/lib/errors';
import { createFixedClock, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE, type FixedClock } from '@/lib/time';
import { withSignInStatus } from '@/server/auth/locked-response';
import { buildAuthOptions } from '@/server/auth/options';
import { createPasswordHasher, type PasswordHasher } from '@/server/auth/password-hasher';
import { resolveSessionUser } from '@/server/auth/resolve-session-user';
import { createThrottleRepository } from '@/server/repositories/throttle-repository';
import { createAuthService, THROTTLE_POLICY } from '@/server/services/auth-service';

import { openAuthDatabase, type AuthDatabase } from '../support/auth-database';
import { createTestHasher, insertUser, TEST_PASSWORD } from '../support/builders/user';
import { defined } from '../support/defined';
import { createTestPrismaClient } from '../support/test-prisma-client';

/**
 * QA acceptance tests for AQP-38 (STORY-01.01), over real PostgreSQL through next-auth's own handler. They add what
 * the developer's tests leave out: every AC-3 rule tested one attempt at a time, to the millisecond, on a controlled
 * clock; e-mail spellings and forged address headers that must not buy extra guesses; real argon2id work for AC-2;
 * a database that is really busy (a held lock and the statement limit), not a stub; the 12-hour edge; sign-out and
 * stale cookies on two devices; and a larger set of open-redirect attacks. All people, e-mails and passwords are invented.
 */

const SECRET = 'invented-qa-aqp-38-key-material-long-enough-0123';
const ORIGIN = 'https://portal.example.test';
const START = new Date('2026-11-05T03:30:00.000Z');
const SESSION_COOKIE = '__Secure-next-auth.session-token';
const LOCKED = 'locked';
const INVALID = 'CredentialsSignin';
const UNAVAILABLE = 'unavailable';

const testHasher = createTestHasher();

let db: AuthDatabase;
let addressCounter = 0;

function freshAddress(): string {
  addressCounter += 1;
  return `192.0.2.${addressCounter}`;
}

function optionsWith(clock: FixedClock, hasher: PasswordHasher = testHasher, throttles = db.throttles) {
  const authService = createAuthService({ users: db.users, throttles, hasher, clock, keySecret: SECRET });
  return buildAuthOptions({ authService, clock, secret: SECRET, production: true });
}

type Options = ReturnType<typeof optionsWith>;

async function csrf(options: Options) {
  const response = await AuthHandler<{ csrfToken: string }>({ req: { action: 'csrf', method: 'GET', origin: ORIGIN, headers: {} }, options });
  const cookie = defined(response.cookies?.[0], 'csrf cookie');
  return { name: cookie.name, value: cookie.value, token: defined(response.body?.csrfToken, 'csrf token') };
}

async function signIn(options: Options, email: string, password: string, forwardedFor: string): Promise<ResponseInternal> {
  const token = await csrf(options);
  return AuthHandler({
    req: {
      action: 'callback',
      providerId: 'credentials',
      method: 'POST',
      origin: ORIGIN,
      headers: { 'x-forwarded-for': forwardedFor },
      cookies: { [token.name]: token.value },
      body: { csrfToken: token.token, email, password, json: 'true' },
    },
    options,
  });
}

async function signOut(options: Options, sessionCookie: string): Promise<ResponseInternal> {
  const token = await csrf(options);
  return AuthHandler({
    req: {
      action: 'signout',
      method: 'POST',
      origin: ORIGIN,
      headers: {},
      cookies: { [token.name]: token.value, [SESSION_COOKIE]: sessionCookie },
      body: { csrfToken: token.token, json: 'true' },
    },
    options,
  });
}

function errorOf(response: ResponseInternal): string | null {
  return response.redirect === undefined ? null : new URL(response.redirect, ORIGIN).searchParams.get('error');
}

function sessionCookieOf(response: ResponseInternal): string | undefined {
  return response.cookies?.find((item) => item.name === SESSION_COOKIE)?.value;
}

/** What the route sends: next-auth's JSON answer passed through the same status mapping the route uses. */
async function routeStatusOf(response: ResponseInternal): Promise<number> {
  const asRoute = new Response(JSON.stringify({ url: response.redirect }), { status: response.status ?? 200 });
  return (await withSignInStatus(asRoute)).status;
}

beforeAll(async () => {
  db = await openAuthDatabase();
});

afterAll(async () => {
  await db.close();
});

// ---- AC-2 -------------------------------------------------------------------------------------------------------

describe('[AQP-38 AC-2] one answer for a wrong password, an unknown e-mail and a deactivated account', () => {
  it('[AQP-38 AC-2] five kinds of failure give the same status, the same address, the same cookies and no session', async () => {
    const clock = createFixedClock(START);
    const options = optionsWith(clock);
    const known = await insertUser(db.users, testHasher);
    const deactivated = await insertUser(db.users, testHasher);
    await db.owner.query('UPDATE users SET is_active = false WHERE id = $1', [deactivated.id]);

    const attempts: ReadonlyArray<readonly [string, string, string]> = [
      ['wrong password', known.email, 'an-invented-wrong-password'],
      ['unknown e-mail', 'nobody-qa-38@example.test', TEST_PASSWORD],
      ['deactivated, correct password', deactivated.email, TEST_PASSWORD],
      ['deactivated, wrong password', deactivated.email, 'an-invented-wrong-password'],
      ['known e-mail in other case, wrong password', known.email.toUpperCase(), 'another-invented-wrong-one'],
    ];
    const answers = [];
    for (const [name, email, password] of attempts) {
      const response = await signIn(options, email, password, freshAddress());
      answers.push({
        name,
        status: response.status,
        routeStatus: await routeStatusOf(response),
        redirect: response.redirect,
        cookieNames: (response.cookies ?? []).map((cookie) => cookie.name).sort(),
        session: sessionCookieOf(response),
      });
    }
    for (const answer of answers) {
      expect(answer, answer.name).toMatchObject({ status: 401, routeStatus: 401, session: undefined });
      expect(new URL(defined(answer.redirect), ORIGIN).searchParams.get('error'), answer.name).toBe(INVALID);
    }
    expect(new Set(answers.map((answer) => answer.redirect)).size).toBe(1);
    expect(new Set(answers.map((answer) => JSON.stringify(answer.cookieNames))).size).toBe(1);
  });

  it('[AQP-38 AC-2] every case checks exactly one password hash (an unknown e-mail checks a dummy), so the work is the same', async () => {
    const verified: string[] = [];
    const counting: PasswordHasher = {
      hash: (password) => testHasher.hash(password),
      async verify(hash, password) {
        verified.push(hash.slice(0, 9));
        return testHasher.verify(hash, password);
      },
    };
    const clock = createFixedClock(START);
    const options = optionsWith(clock, counting);
    const known = await insertUser(db.users, testHasher);
    const deactivated = await insertUser(db.users, testHasher);
    await db.owner.query('UPDATE users SET is_active = false WHERE id = $1', [deactivated.id]);

    for (const [email, password] of [
      [known.email, 'wrong-one'],
      ['nobody-else-qa-38@example.test', 'wrong-one'],
      [deactivated.email, TEST_PASSWORD],
    ] as const) {
      const before = verified.length;
      await signIn(options, email, password, freshAddress());
      expect(verified.length - before, email).toBe(1);
    }
    expect(verified.every((prefix) => prefix === '$argon2id')).toBe(true);
  });

  it('[AQP-38 AC-2] with the production argon2id cost, the median times of the three failures are within 50 % of each other (stated tolerance)', async () => {
    // Real cost (64 MiB, 3 passes). Interleaved rounds, so machine load falls on every case alike. Each round uses
    // people of its own, so no account key nears the five-failure block, and the dummy hash is made before timing
    // starts (once per process, at the first unknown e-mail). The tolerance is wide on purpose (test strategy section
    // 10: no load-sensitive limit); without the dummy hash an unknown e-mail would take about 0 ms against about
    // 350 ms, far outside it, and the verify-count test above fails on that as well.
    const realHasher = createPasswordHasher();
    const clock = createFixedClock(START);
    const service = createAuthService({ users: db.users, throttles: db.throttles, hasher: realHasher, clock, keySecret: SECRET });
    await service.authenticate({ email: 'warm-up-qa-38@example.test', password: 'x', ipAddress: freshAddress() });

    const ROUNDS = 7;
    const times = { wrong: [] as number[], unknown: [] as number[], deactivated: [] as number[] };
    for (let round = 0; round < ROUNDS; round += 1) {
      const known = await insertUser(db.users, realHasher);
      const deactivated = await insertUser(db.users, realHasher);
      await db.owner.query('UPDATE users SET is_active = false WHERE id = $1', [deactivated.id]);
      const cases = {
        wrong: { email: known.email, password: 'a-wrong-password' },
        unknown: { email: `nobody-timed-${round}-qa-38@example.test`, password: 'a-wrong-password' },
        deactivated: { email: deactivated.email, password: TEST_PASSWORD },
      } as const;
      for (const name of ['wrong', 'unknown', 'deactivated'] as const) {
        const started = performance.now();
        const result = await service.authenticate({ ...cases[name], ipAddress: freshAddress() });
        times[name].push(performance.now() - started);
        expect(result).toEqual({ status: 'refused', reason: 'invalid' });
      }
    }
    const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
    const medians = Object.values(times).map(median);
    const slowest = Math.max(...medians);
    const fastest = Math.min(...medians);
    expect(fastest).toBeGreaterThan(0);
    expect(slowest / fastest).toBeLessThan(1.5);
  }, 120_000);
});

// ---- AC-3, one attempt at a time ----------------------------------------------------------------------------------

describe('[AQP-38 AC-3] the lock-out, one attempt at a time, on a controlled clock', () => {
  it('[AQP-38 AC-3] five failures; the sixth is locked; a correct password stays locked until exactly 15 minutes after the fifth failure', async () => {
    const clock = createFixedClock(START);
    const options = optionsWith(clock);
    const user = await insertUser(db.users, testHasher);
    const address = freshAddress();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(errorOf(await signIn(options, user.email, `wrong-${attempt}`, address)), `attempt ${attempt}`).toBe(INVALID);
      if (attempt < 5) clock.advance(MILLISECONDS_PER_MINUTE);
    }
    const fifthFailure = clock.now().getTime();

    const sixth = await signIn(options, user.email, 'wrong-6', address);
    expect(errorOf(sixth)).toBe(LOCKED);
    expect(await routeStatusOf(sixth)).toBe(429);

    clock.advance(THROTTLE_POLICY.blockMilliseconds - 1);
    expect(clock.now().getTime()).toBe(fifthFailure + 15 * MILLISECONDS_PER_MINUTE - 1);
    const almost = await signIn(options, user.email, TEST_PASSWORD, address);
    expect(errorOf(almost)).toBe(LOCKED);
    expect(sessionCookieOf(almost)).toBeUndefined();

    clock.advance(1);
    const after = await signIn(options, user.email, TEST_PASSWORD, address);
    expect(errorOf(after)).toBeNull();
    expect(sessionCookieOf(after)).toBeDefined();
  });

  it('[AQP-38 AC-3] the attempts refused during the block do not lengthen it, and after it a new run needs five failures again', async () => {
    const clock = createFixedClock(START);
    const options = optionsWith(clock);
    const user = await insertUser(db.users, testHasher);
    const address = freshAddress();
    for (let attempt = 1; attempt <= 5; attempt += 1) await signIn(options, user.email, 'wrong', address);
    for (let minute = 1; minute <= 14; minute += 1) {
      clock.advance(MILLISECONDS_PER_MINUTE);
      expect(errorOf(await signIn(options, user.email, 'wrong', address)), `minute ${minute}`).toBe(LOCKED);
    }
    clock.advance(MILLISECONDS_PER_MINUTE);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(errorOf(await signIn(options, user.email, 'wrong', address)), `new run ${attempt}`).toBe(INVALID);
    }
    expect(errorOf(await signIn(options, user.email, TEST_PASSWORD, address))).toBe(LOCKED);
  });

  it('[AQP-38 AC-3] "consecutive": four failures, a correct sign-in, then five more failures are all answered, and only the sixth after is locked', async () => {
    const clock = createFixedClock(START);
    const options = optionsWith(clock);
    const user = await insertUser(db.users, testHasher);
    const address = freshAddress();
    for (let attempt = 1; attempt <= 4; attempt += 1) expect(errorOf(await signIn(options, user.email, 'wrong', address))).toBe(INVALID);
    expect(sessionCookieOf(await signIn(options, user.email, TEST_PASSWORD, address))).toBeDefined();
    for (let attempt = 1; attempt <= 5; attempt += 1) expect(errorOf(await signIn(options, user.email, 'wrong', address))).toBe(INVALID);
    expect(errorOf(await signIn(options, user.email, 'wrong', address))).toBe(LOCKED);
  });

  it('[AQP-38 AC-3] spelling the e-mail differently (case, spaces) is the same account key: it buys no extra guesses', async () => {
    const clock = createFixedClock(START);
    const options = optionsWith(clock);
    const user = await insertUser(db.users, testHasher);
    const spellings = [user.email, user.email.toUpperCase(), `  ${user.email}`, `${user.email}  `, user.email.replace(/^./, (first) => first.toUpperCase())];
    for (const spelling of spellings) expect(errorOf(await signIn(options, spelling, 'wrong', freshAddress())), JSON.stringify(spelling)).toBe(INVALID);
    expect(errorOf(await signIn(options, user.email.toUpperCase(), TEST_PASSWORD, freshAddress()))).toBe(LOCKED);
    expect(errorOf(await signIn(options, user.email, TEST_PASSWORD, freshAddress()))).toBe(LOCKED);
  });

  it('[AQP-38 AC-3] an unknown e-mail takes the same path: five answered, the sixth locked with the same code and status', async () => {
    const clock = createFixedClock(START);
    const options = optionsWith(clock);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(errorOf(await signIn(options, 'Invented.Unknown.QA@Example.Test', 'x', freshAddress()))).toBe(INVALID);
    }
    const sixth = await signIn(options, 'invented.unknown.qa@example.test', 'x', freshAddress());
    expect(errorOf(sixth)).toBe(LOCKED);
    expect(await routeStatusOf(sixth)).toBe(429);
  });

  it('[AQP-38 AC-3] a blocked account blocks only itself: another person on the same address signs in', async () => {
    const clock = createFixedClock(START);
    const options = optionsWith(clock);
    const blocked = await insertUser(db.users, testHasher);
    const colleague = await insertUser(db.users, testHasher);
    const office = freshAddress();
    for (let attempt = 1; attempt <= 6; attempt += 1) await signIn(options, blocked.email, 'wrong', office);
    expect(sessionCookieOf(await signIn(options, colleague.email, TEST_PASSWORD, office))).toBeDefined();
  });

  it('[AQP-38 AC-3] per address: 30 failures on 30 accounts in 15 minutes block the 31st, even a correct password, until exactly 15 minutes after the 30th', async () => {
    const clock = createFixedClock(START);
    const options = optionsWith(clock);
    const address = freshAddress();
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      expect(errorOf(await signIn(options, `spray-qa-${attempt}@example.test`, 'x', address)), `attempt ${attempt}`).toBe(INVALID);
      if (attempt < 30) clock.advance(20_000);
    }
    const thirtieth = clock.now().getTime();
    const person = await insertUser(db.users, testHasher);
    expect(errorOf(await signIn(options, person.email, TEST_PASSWORD, address))).toBe(LOCKED);
    expect(sessionCookieOf(await signIn(options, person.email, TEST_PASSWORD, freshAddress()))).toBeDefined();

    clock.advance(THROTTLE_POLICY.blockMilliseconds - 1);
    expect(clock.now().getTime()).toBe(thirtieth + 15 * MILLISECONDS_PER_MINUTE - 1);
    expect(errorOf(await signIn(options, person.email, TEST_PASSWORD, address))).toBe(LOCKED);
    clock.advance(1);
    expect(sessionCookieOf(await signIn(options, person.email, TEST_PASSWORD, address))).toBeDefined();
  });

  it('[AQP-38 AC-3] per address: 29 failures, then the 15-minute window runs out, and the count starts again', async () => {
    const clock = createFixedClock(START);
    const options = optionsWith(clock);
    const address = freshAddress();
    for (let attempt = 1; attempt <= 29; attempt += 1) await signIn(options, `window-qa-${attempt}@example.test`, 'x', address);
    clock.advance(THROTTLE_POLICY.ipWindowMilliseconds);
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      expect(errorOf(await signIn(options, `window-qa-b${attempt}@example.test`, 'x', address)), `attempt ${attempt}`).toBe(INVALID);
    }
    expect(errorOf(await signIn(options, 'window-qa-last@example.test', 'x', address))).toBe(LOCKED);
  });

  it('[AQP-38 AC-3] a forged X-Forwarded-For first entry does not buy a fresh address: only the proxy\'s last entry counts', async () => {
    const clock = createFixedClock(START);
    const options = optionsWith(clock);
    const real = freshAddress();
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      await signIn(options, `forged-qa-${attempt}@example.test`, 'x', `10.9.${attempt}.1, ${real}`);
    }
    expect(errorOf(await signIn(options, 'forged-qa-31@example.test', 'x', `172.16.0.31, ${real}`))).toBe(LOCKED);
  });

  it('[AQP-38 AC-3] the throttle table holds only keyed hashes: no e-mail and no address in clear', async () => {
    const { rows } = await db.owner.query<{ key_hash: string }>('SELECT key_hash FROM login_throttles');
    expect(rows.length).toBeGreaterThan(0);
    for (const { key_hash: key } of rows) expect(key).toMatch(/^[0-9a-f]{64}$/);
    const text = JSON.stringify(rows);
    expect(text).not.toContain('@');
    expect(text).not.toContain('192.0.2.');
  });
});

// ---- A really busy database (QLT-34, ruling R4) --------------------------------------------------------------

describe('[AQP-38] a busy database: 503 "unavailable", no cause, and nothing counted against the person', () => {
  it('[AQP-38] with login_throttles locked by another session and a short statement limit, sign-in answers 503 and leaves no count', async () => {
    const busyPrisma = createTestPrismaClient('app', db.database.runtimeUrl, { statement_timeout: 700 });
    const blocker = new Client({ connectionString: db.database.ownerUrl });
    await blocker.connect();
    try {
      const clock = createFixedClock(START);
      const options = optionsWith(clock, testHasher, createThrottleRepository(busyPrisma));
      const user = await insertUser(db.users, testHasher);
      const address = freshAddress();
      await blocker.query('BEGIN');
      await blocker.query('LOCK TABLE login_throttles IN ACCESS EXCLUSIVE MODE');
      const response = await signIn(options, user.email, TEST_PASSWORD, address);
      await blocker.query('ROLLBACK');

      expect(errorOf(response)).toBe(UNAVAILABLE);
      expect(await routeStatusOf(response)).toBe(503);
      expect(sessionCookieOf(response)).toBeUndefined();
      expect(JSON.stringify(response)).not.toMatch(/57014|statement timeout|canceling|login_throttles/i);

      // Nothing was counted: five wrong attempts afterwards are still all answered, and the sixth is the one locked.
      const normal = optionsWith(clock);
      for (let attempt = 1; attempt <= 5; attempt += 1) expect(errorOf(await signIn(normal, user.email, 'wrong', address))).toBe(INVALID);
      expect(errorOf(await signIn(normal, user.email, 'wrong', address))).toBe(LOCKED);
    } finally {
      await blocker.end();
      await busyPrisma.$disconnect();
    }
  }, 60_000);
});

describe('[AQP-38] a fault after the attempt is reserved gives the reservation back', () => {
  it('[AQP-38] five sign-ins that fail on our side (503) cost the person nothing: five wrong passwords after are still answered', async () => {
    const clock = createFixedClock(START);
    const user = await insertUser(db.users, testHasher);
    let faults = 5;
    const flakyUsers = {
      ...db.users,
      findCredentialsByEmail(email: string) {
        if (faults > 0) {
          faults -= 1;
          return Promise.reject(new DatabaseBusyError());
        }
        return db.users.findCredentialsByEmail(email);
      },
    };
    const authService = createAuthService({ users: flakyUsers, throttles: db.throttles, hasher: testHasher, clock, keySecret: SECRET });
    const options = buildAuthOptions({ authService, clock, secret: SECRET, production: true });
    const address = freshAddress();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await signIn(options, user.email, TEST_PASSWORD, address);
      expect(errorOf(response), `fault ${attempt}`).toBe(UNAVAILABLE);
      expect(await routeStatusOf(response)).toBe(503);
    }
    for (let attempt = 1; attempt <= 5; attempt += 1) expect(errorOf(await signIn(options, user.email, 'wrong', address)), `wrong ${attempt}`).toBe(INVALID);
    expect(errorOf(await signIn(options, user.email, 'wrong', address))).toBe(LOCKED);
  });
});

// ---- AC-4 and AC-5: sign-out on every device, stale cookies, 12 hours --------------------------------------------

describe('[AQP-38 AC-4, AC-5] sign-out on every device, stale cookies and the 12-hour limit', () => {
  it('[AQP-38 AC-4] signing out on one device ends the session on the other, and both old cookies stay dead after a new sign-in', async () => {
    const clock = createFixedClock(START);
    const options = optionsWith(clock);
    const user = await insertUser(db.users, testHasher, { role: 'LEAD' });
    const phone = defined(sessionCookieOf(await signIn(options, user.email, TEST_PASSWORD, freshAddress())), 'phone cookie');
    clock.advance(MILLISECONDS_PER_MINUTE);
    const desk = defined(sessionCookieOf(await signIn(options, user.email, TEST_PASSWORD, freshAddress())), 'desk cookie');

    const claimsOf = async (cookie: string) => {
      const token = defined(await decode({ token: cookie, secret: SECRET }), 'token');
      return { userId: String(token['sub']), sessionVersion: Number(token['sv']), signedAt: Number(token['signedAt']) };
    };
    expect(await resolveSessionUser(await claimsOf(phone), db.users, clock.now())).not.toBeNull();
    expect(await resolveSessionUser(await claimsOf(desk), db.users, clock.now())).not.toBeNull();

    const out = await signOut(options, phone);
    const cleared = defined(out.cookies?.find((cookie) => cookie.name === SESSION_COOKIE), 'cleared cookie');
    expect([cleared.value, cleared.options.maxAge]).toEqual(['', 0]);
    expect(await resolveSessionUser(await claimsOf(phone), db.users, clock.now())).toBeNull();
    expect(await resolveSessionUser(await claimsOf(desk), db.users, clock.now())).toBeNull();

    const fresh = defined(sessionCookieOf(await signIn(options, user.email, TEST_PASSWORD, freshAddress())), 'fresh cookie');
    expect(await resolveSessionUser(await claimsOf(fresh), db.users, clock.now())).not.toBeNull();
    expect(await resolveSessionUser(await claimsOf(desk), db.users, clock.now())).toBeNull();
    // The stale desk cookie signing out cannot end the fresh session (compare and increment).
    await signOut(options, desk);
    expect(await resolveSessionUser(await claimsOf(fresh), db.users, clock.now())).not.toBeNull();
  });

  it('[AQP-38 AC-5] a session is honoured until just before 12 hours from sign-in and refused at 12 hours, whatever the activity', async () => {
    const user = await insertUser(db.users, testHasher);
    const signedAt = START.getTime() / 1_000;
    const claims = { userId: user.id, sessionVersion: 0, signedAt };
    const at = (milliseconds: number) => new Date(START.getTime() + milliseconds);
    expect(await resolveSessionUser(claims, db.users, at(0))).not.toBeNull();
    expect(await resolveSessionUser(claims, db.users, at(12 * MILLISECONDS_PER_HOUR - 1_000))).not.toBeNull();
    expect(await resolveSessionUser(claims, db.users, at(12 * MILLISECONDS_PER_HOUR - 1))).not.toBeNull();
    expect(await resolveSessionUser(claims, db.users, at(12 * MILLISECONDS_PER_HOUR))).toBeNull();
    expect(await resolveSessionUser(claims, db.users, at(30 * MILLISECONDS_PER_HOUR))).toBeNull();
    // A sign-in time in the future is not honoured either (a forged or clock-skewed token).
    expect(await resolveSessionUser(claims, db.users, at(-60_000))).toBeNull();
  });

  it('[AQP-38 AC-5] the cookie\'s own lifetime is 12 hours and the token holds only sub, sv and signedAt (plus next-auth\'s iat, exp, jti)', async () => {
    const clock = createFixedClock(START);
    const options = optionsWith(clock);
    const user = await insertUser(db.users, testHasher, { role: 'ADMIN', name: 'Invented QA Admin' });
    const response = await signIn(options, user.email, TEST_PASSWORD, freshAddress());
    const cookie = defined(response.cookies?.find((item) => item.name === SESSION_COOKIE), 'cookie');
    expect(cookie.options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    expect(cookie.options.expires instanceof Date ? cookie.options.expires.getTime() - Date.now() : 0).toBeGreaterThan(11.9 * MILLISECONDS_PER_HOUR);
    const token = defined(await decode({ token: cookie.value, secret: SECRET }), 'token');
    expect(Object.keys(token).sort()).toEqual(['exp', 'iat', 'jti', 'signedAt', 'sub', 'sv']);
    expect(JSON.stringify(token)).not.toMatch(/ADMIN|Invented QA Admin|example\.test/);
  });

  it('[AQP-38 AC-5] a cookie signed with another secret, or tampered with, is not a session', async () => {
    const clock = createFixedClock(START);
    const options = optionsWith(clock);
    const user = await insertUser(db.users, testHasher);
    const cookie = defined(sessionCookieOf(await signIn(options, user.email, TEST_PASSWORD, freshAddress())), 'cookie');
    const tampered = `${cookie.slice(0, -4)}${cookie.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA'}`;
    expect(await decode({ token: tampered, secret: SECRET }).catch(() => null)).toBeNull();
    expect(await decode({ token: cookie, secret: 'not-the-portal-secret-0123456789-abcdef' }).catch(() => null)).toBeNull();
  });
});

// ---- AC-6 -------------------------------------------------------------------------------------------------------

describe('[AQP-38 AC-6] only a same-origin relative path is honoured after sign-in', () => {
  it.each([
    ['protocol-relative', '//evil.example'],
    ['absolute https', 'https://evil.example'],
    ['absolute http', 'http://evil.example/queue'],
    ['backslash', '/\\evil.example'],
    ['two backslashes', '\\\\evil.example'],
    ['triple slash', '///evil.example'],
    ['dot then double slash', '/.//evil.example'],
    ['dot-dot then double slash', '/..//evil.example'],
    ['tab inside', '/\t/evil.example'],
    ['newline inside', '/\n/evil.example'],
    ['leading space', ' /queue'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,hi'],
    ['no leading slash', 'queue'],
    ['user-info trick', '/@evil.example'],
    ['the sign-in page itself', '/sign-in'],
    ['the auth API', '/api/auth/signout'],
    ['too long', `/${'a'.repeat(2_100)}`],
    ['empty', ''],
  ])('[AQP-38 AC-6] %s (%j) is ignored: the person goes home', (_name, candidate) => {
    const result = safeReturnPath(candidate);
    expect(result === '/queue' || (result.startsWith('/') && !result.startsWith('//') && new URL(result, ORIGIN).origin === ORIGIN)).toBe(true);
    if (!['user-info trick'].includes(_name)) expect(result).toBe('/queue');
  });

  it.each([
    ['%2F%2F encoded', '/%2F%2Fevil.example'],
    ['%5C encoded backslash', '/%5Cevil.example'],
    ['full-width solidus', '/／／evil.example'],
  ])('[AQP-38 AC-6] %s (%j) stays a path on this portal, never another site', (_name, candidate) => {
    const result = safeReturnPath(candidate);
    expect(result.startsWith('/')).toBe(true);
    expect(result.startsWith('//')).toBe(false);
    expect(new URL(result, ORIGIN).origin).toBe(ORIGIN);
    expect(new URL(result, ORIGIN).host).toBe('portal.example.test');
  });

  it('[AQP-38 AC-6] a same-origin path with a query is honoured as it is, and the sign-in link for it round-trips', () => {
    expect(safeReturnPath('/estimates/42?tab=costs')).toBe('/estimates/42?tab=costs');
    const link = new URL(signInPathFor('/estimates/42?tab=costs'), ORIGIN);
    expect(link.pathname).toBe('/sign-in');
    expect(safeReturnPath(link.searchParams.get('callbackUrl'))).toBe('/estimates/42?tab=costs');
    expect(signInPathFor('//evil.example')).toBe('/sign-in');
  });
});
