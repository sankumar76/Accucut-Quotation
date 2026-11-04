import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createFixedClock, MILLISECONDS_PER_MINUTE } from '@/lib/time';
import type { PasswordHasher } from '@/server/auth/password-hasher';
import type { AttemptPolicy } from '@/server/repositories/throttle-repository';
import { createAuthService, THROTTLE_POLICY, type AuthService } from '@/server/services/auth-service';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { createTestHasher, insertUser, TEST_PASSWORD } from '../../support/builders/user';

/**
 * G6 QLT-32 against real PostgreSQL: an attempt is reserved with one SQL statement before its password is checked, and
 * the number the database returns decides. Fifty requests at once on one account give at most five password checks, and
 * more than thirty on one address give at most thirty, because the database hands out the numbers 1, 2, 3 ... in order
 * whatever the concurrency. A correct password clears the account and gives its place on the address back.
 */

const SECRET = 'invented-reservation-test-key-material';
const START = new Date('2026-11-04T09:00:00.000Z');
const WINDOW = 15 * MILLISECONDS_PER_MINUTE;
const ACCOUNT: AttemptPolicy = { limit: 5, windowMilliseconds: null, blockMilliseconds: 15 * MILLISECONDS_PER_MINUTE };
const ADDRESS: AttemptPolicy = { limit: 30, windowMilliseconds: WINDOW, blockMilliseconds: 15 * MILLISECONDS_PER_MINUTE };

let db: AuthDatabase;
let counter = 0;

/** The real (cheap) hasher, with a count of the password checks it was asked for. */
function countingRealHasher(): PasswordHasher & { checks: () => number } {
  const real = createTestHasher();
  let checks = 0;
  return {
    hash: (password) => real.hash(password),
    verify(passwordHash, password) {
      checks += 1;
      return real.verify(passwordHash, password);
    },
    checks: () => checks,
  };
}

function serviceWith(hasher: PasswordHasher, clock = createFixedClock(START)): { service: AuthService; clock: typeof clock } {
  return { service: createAuthService({ users: db.users, throttles: db.throttles, hasher, clock, keySecret: SECRET }), clock };
}

/** An address of its own per test, so the limit of one test never reaches another. */
function freshAddress(): string {
  counter += 1;
  return `192.0.2.${counter}`;
}

const attempt = (email: string, password: string, ipAddress: string) => ({ email, password, ipAddress });

beforeAll(async () => {
  db = await openAuthDatabase();
});

afterAll(async () => {
  await db.close();
});

describe('the reservation statement', () => {
  it('hands out 1, 2, 3 ... in order, and sets the block when the limit is reached', async () => {
    const answers = [];
    for (let count = 0; count < 6; count += 1) answers.push(await db.throttles.reserveAttempt('seq', ACCOUNT, START));
    expect(answers.map((answer) => answer.attempts)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(answers.map((answer) => answer.blockedUntil)).toEqual([
      null,
      null,
      null,
      null,
      new Date(START.getTime() + ACCOUNT.blockMilliseconds),
      new Date(START.getTime() + ACCOUNT.blockMilliseconds),
    ]);
  });

  it('50 reservations at once get 50 different numbers, 1 to 50, so the database orders them whatever the concurrency', async () => {
    const answers = await Promise.all(Array.from({ length: 50 }, () => db.throttles.reserveAttempt('burst', ACCOUNT, START)));
    expect(answers.map((answer) => answer.attempts).sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, index) => index + 1));
  });

  it('a block that is still in force is neither shortened nor extended by later attempts', async () => {
    for (let count = 0; count < 5; count += 1) await db.throttles.reserveAttempt('hold', ACCOUNT, START);
    const later = new Date(START.getTime() + 10 * MILLISECONDS_PER_MINUTE);
    const answer = await db.throttles.reserveAttempt('hold', ACCOUNT, later);
    expect(answer).toEqual({ attempts: 6, blockedUntil: new Date(START.getTime() + ACCOUNT.blockMilliseconds) });
  });

  it('starts a new count of one when the block has ended (an account has no window)', async () => {
    for (let count = 0; count < 5; count += 1) await db.throttles.reserveAttempt('ended', ACCOUNT, START);
    const answer = await db.throttles.reserveAttempt('ended', ACCOUNT, new Date(START.getTime() + ACCOUNT.blockMilliseconds));
    expect(answer).toEqual({ attempts: 1, blockedUntil: null });
  });

  it('an account run is not restarted by time alone: it is a run of attempts, not a window', async () => {
    for (let count = 0; count < 3; count += 1) await db.throttles.reserveAttempt('run', ACCOUNT, START);
    const answer = await db.throttles.reserveAttempt('run', ACCOUNT, new Date(START.getTime() + 24 * 60 * MILLISECONDS_PER_MINUTE));
    expect(answer.attempts).toBe(4);
  });

  it('an address window that has run out starts again at one, when nothing blocks it', async () => {
    for (let count = 0; count < 5; count += 1) await db.throttles.reserveAttempt('window', ADDRESS, START);
    expect((await db.throttles.reserveAttempt('window', ADDRESS, new Date(START.getTime() + WINDOW - 1))).attempts).toBe(6);
    const restarted = await db.throttles.reserveAttempt('window', ADDRESS, new Date(START.getTime() + WINDOW));
    expect(restarted).toEqual({ attempts: 1, blockedUntil: null });
  });

  it('an address that is blocked keeps its block when its window has already run out; the block ends first', async () => {
    for (let count = 0; count < 29; count += 1) await db.throttles.reserveAttempt('blocked-window', ADDRESS, START);
    const thirtieth = new Date(START.getTime() + 10 * MILLISECONDS_PER_MINUTE);
    const blockEnds = new Date(thirtieth.getTime() + ADDRESS.blockMilliseconds);
    expect(await db.throttles.reserveAttempt('blocked-window', ADDRESS, thirtieth)).toEqual({ attempts: 30, blockedUntil: blockEnds });
    // 16 minutes in: the window (15 minutes) has run out, the block (until 25 minutes) has not.
    const pastWindow = new Date(START.getTime() + 16 * MILLISECONDS_PER_MINUTE);
    expect(await db.throttles.reserveAttempt('blocked-window', ADDRESS, pastWindow)).toEqual({ attempts: 31, blockedUntil: blockEnds });
    expect(await db.throttles.reserveAttempt('blocked-window', ADDRESS, blockEnds)).toEqual({ attempts: 1, blockedUntil: null });
  });

  it('gives a reservation back but never goes below zero, and clears a key; a key with nothing to forget is not written', async () => {
    await db.throttles.reserveAttempt('give', ACCOUNT, START);
    await db.throttles.reserveAttempt('give', ACCOUNT, START);
    await db.throttles.releaseAttempt('give');
    expect((await db.throttles.reserveAttempt('give', ACCOUNT, START)).attempts).toBe(2);
    await db.throttles.releaseAttempt('give');
    await db.throttles.releaseAttempt('give');
    await db.throttles.releaseAttempt('give');
    await db.throttles.releaseAttempt('give');
    expect((await db.throttles.reserveAttempt('give', ACCOUNT, START)).attempts).toBe(1);

    await db.throttles.clear('give');
    const before = (await db.owner.query(`SELECT updated_at FROM login_throttles WHERE key_hash = 'give'`)).rows[0];
    await db.throttles.clear('give');
    const after = (await db.owner.query(`SELECT updated_at FROM login_throttles WHERE key_hash = 'give'`)).rows[0];
    expect(after).toEqual(before);
    expect((await db.throttles.reserveAttempt('give', ACCOUNT, START)).attempts).toBe(1);
    await expect(db.throttles.clear('never-seen')).resolves.toBeUndefined();
    await expect(db.throttles.releaseAttempt('never-seen')).resolves.toBeUndefined();
  });
});

describe('QLT-32: attempts that arrive at once', () => {
  it('50 wrong attempts at once on one account get at most 5 password checks; the rest are locked', async () => {
    const hasher = countingRealHasher();
    const { service } = serviceWith(hasher);
    const user = await insertUser(db.users, createTestHasher());
    const checksBefore = hasher.checks();
    const answers = await Promise.all(
      Array.from({ length: 50 }, (_, index) => service.authenticate(attempt(user.email, 'wrong-password', `198.51.100.${index + 1}`))),
    );
    expect(hasher.checks() - checksBefore).toBeLessThanOrEqual(5);
    expect(answers.filter((answer) => answer.status === 'refused' && answer.reason === 'invalid')).toHaveLength(5);
    expect(answers.filter((answer) => answer.status === 'refused' && answer.reason === 'locked')).toHaveLength(45);
  });

  it('the right password sent at the same time is refused once the five are used, so a burst cannot sneak a sixth guess in', async () => {
    const hasher = countingRealHasher();
    const { service } = serviceWith(hasher);
    const user = await insertUser(db.users, createTestHasher());
    const answers = await Promise.all([
      ...Array.from({ length: 20 }, (_, index) => service.authenticate(attempt(user.email, 'wrong-password', `198.51.100.${100 + index}`))),
      ...Array.from({ length: 20 }, (_, index) => service.authenticate(attempt(user.email, TEST_PASSWORD, `198.51.100.${150 + index}`))),
    ]);
    expect(hasher.checks()).toBeLessThanOrEqual(5);
    expect(answers.filter((answer) => answer.status === 'signed-in').length).toBeLessThanOrEqual(5);
  });

  it('more than 30 attempts at once from one address get at most 30 password checks, whoever they are for', async () => {
    const hasher = countingRealHasher();
    const { service } = serviceWith(hasher);
    const address = freshAddress();
    const answers = await Promise.all(
      Array.from({ length: 45 }, (_, index) => service.authenticate(attempt(`spray-${counter}-${index}@example.test`, 'wrong-password', address))),
    );
    expect(hasher.checks()).toBeLessThanOrEqual(THROTTLE_POLICY.ipFailureLimit);
    expect(answers.filter((answer) => answer.status === 'refused' && answer.reason === 'locked')).toHaveLength(15);
  });
});

/**
 * The sequences below make dozens of sign-ins one after another. They run in hooks and the tests look at what came back
 * (test strategy section 10: set-up in hooks, never inside a test's own time limit on a busy machine).
 */
type Answer = Awaited<ReturnType<AuthService['authenticate']>>;

describe('once an address is blocked, a flood from it does not touch any account', () => {
  const floodAnswers: Answer[] = [];
  let personElsewhere: Answer | undefined;

  beforeAll(async () => {
    const { service } = serviceWith(countingRealHasher());
    const user = await insertUser(db.users, createTestHasher());
    const flood = freshAddress();
    for (let count = 0; count < THROTTLE_POLICY.ipFailureLimit; count += 1) {
      await service.authenticate(attempt(`spray-${counter}-${count}@example.test`, 'wrong-password', flood));
    }
    for (let count = 0; count < 20; count += 1) floodAnswers.push(await service.authenticate(attempt(user.email, 'wrong-password', flood)));
    personElsewhere = await service.authenticate(attempt(user.email, TEST_PASSWORD, freshAddress()));
  });

  it('every attempt from the blocked address is locked', () => {
    expect(floodAnswers).toHaveLength(20);
    expect(floodAnswers.every((answer) => answer.status === 'refused' && answer.reason === 'locked')).toBe(true);
  });

  it('the person whose e-mail was in the flood still signs in from another address', () => {
    expect(personElsewhere?.status).toBe('signed-in');
  });
});

describe('a correct password gives back its place on a shared address and clears the account', () => {
  const office: { successes: Answer[]; afterwards: Answer[] } = { successes: [], afterwards: [] };
  const account: { before: Answer[]; correct: Answer | undefined; after: Answer[] } = { before: [], correct: undefined, after: [] };
  const faults: { thrown: number; afterwards: Answer[] } = { thrown: 0, afterwards: [] };

  beforeAll(async () => {
    const { service } = serviceWith(countingRealHasher());
    const address = freshAddress();
    for (let person = 0; person < 40; person += 1) {
      const user = await insertUser(db.users, createTestHasher());
      office.successes.push(await service.authenticate(attempt(user.email, TEST_PASSWORD, address)));
    }
    for (let count = 0; count < THROTTLE_POLICY.ipFailureLimit; count += 1) {
      office.afterwards.push(await service.authenticate(attempt(`late-${count}@example.test`, 'wrong-password', address)));
    }

    const user = await insertUser(db.users, createTestHasher());
    for (let count = 0; count < 4; count += 1) account.before.push(await service.authenticate(attempt(user.email, 'wrong-password', freshAddress())));
    account.correct = await service.authenticate(attempt(user.email, TEST_PASSWORD, freshAddress()));
    for (let count = 0; count < 4; count += 1) account.after.push(await service.authenticate(attempt(user.email, 'wrong-password', freshAddress())));

    const failing: PasswordHasher = { hash: () => Promise.reject(new Error('no memory')), verify: () => Promise.reject(new Error('no memory')) };
    const { service: broken } = serviceWith(failing);
    const faultAddress = freshAddress();
    for (let count = 0; count < 8; count += 1) {
      await broken.authenticate(attempt('nobody@example.test', 'x', faultAddress)).catch(() => (faults.thrown += 1));
    }
    const { service: healthy } = serviceWith(countingRealHasher());
    for (let count = 0; count < THROTTLE_POLICY.ipFailureLimit; count += 1) {
      faults.afterwards.push(await healthy.authenticate(attempt(`after-${count}@example.test`, 'x', faultAddress)));
    }
  });

  it('40 correct sign-ins in a row from the office address are all accepted', () => {
    expect(office.successes.filter((answer) => answer.status === 'signed-in')).toHaveLength(40);
  });

  it('and the office address still has its whole allowance of 30 afterwards: had each success kept its place, it would be locked', () => {
    expect(office.afterwards.every((answer) => answer.status === 'refused' && answer.reason === 'invalid')).toBe(true);
  });

  it('four wrong attempts and a correct one clear the account: four more wrong ones are still answered "invalid"', () => {
    expect(account.before.every((answer) => answer.status === 'refused' && answer.reason === 'invalid')).toBe(true);
    expect(account.correct?.status).toBe('signed-in');
    expect(account.after.every((answer) => answer.status === 'refused' && answer.reason === 'invalid')).toBe(true);
  });

  it('a fault of ours gives its place back: eight faults leave the address its whole allowance of 30', () => {
    expect(faults.thrown).toBe(8);
    expect(faults.afterwards.every((answer) => answer.status === 'refused' && answer.reason === 'invalid')).toBe(true);
  });
});
