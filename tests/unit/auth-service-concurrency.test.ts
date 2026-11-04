import { describe, expect, it } from 'vitest';

import { createFixedClock } from '@/lib/time';
import { createAuthService, THROTTLE_POLICY, type SignInAttempt } from '@/server/services/auth-service';

import { createCountingHasher, createFakeThrottleRepository, createFakeUserRepository } from '../support/fake-auth-repositories';

/**
 * G6 QLT-32, QLT-33 and the give-back rule, with fakes (the same arithmetic as the SQL statement, tested against
 * PostgreSQL in `tests/integration/auth/throttle-reservation.test.ts`). Attempts are sent with `Promise.all`: the check
 * that fails before the fix gave 50 password checks for 50 attempts at once.
 */

const PASSWORD = 'invented-password-one';
const KNOWN = 'known.person@example.test';
const SECRET = 'invented-throttle-key-material';
const START = new Date('2026-11-04T09:00:00.000Z');
const OFFICE = '198.51.100.250';

const attempt = (email: string, password: string, ipAddress: string | null = '203.0.113.7'): SignInAttempt => ({ email, password, ipAddress });
const refused = (reason: 'invalid' | 'locked') => ({ status: 'refused', reason });

async function setup() {
  const hasher = createCountingHasher();
  const users = createFakeUserRepository([
    { name: 'Known Person', email: KNOWN, passwordHash: await hasher.hash(PASSWORD), role: 'ENGINEER', mustChangePassword: false },
  ]);
  hasher.hashed.length = 0;
  const throttles = createFakeThrottleRepository();
  const clock = createFixedClock(START);
  const service = createAuthService({ users, throttles, hasher, clock, keySecret: SECRET });
  return { service, users, throttles, hasher, clock };
}

describe('QLT-32: attempts that arrive at once', () => {
  it('50 wrong attempts at once on one account get at most 5 password checks; the other 45 are locked', async () => {
    const s = await setup();
    const answers = await Promise.all(
      Array.from({ length: 50 }, (_, index) => s.service.authenticate(attempt(KNOWN, 'wrong', `198.51.100.${index + 1}`))),
    );
    expect(s.hasher.verified).toHaveLength(THROTTLE_POLICY.accountFailureLimit);
    expect(answers.filter((answer) => answer.status === 'refused' && answer.reason === 'invalid')).toHaveLength(5);
    expect(answers.filter((answer) => answer.status === 'refused' && answer.reason === 'locked')).toHaveLength(45);
  });

  it('the right password sent in the same burst is refused once the five are used', async () => {
    const s = await setup();
    const answers = await Promise.all([
      ...Array.from({ length: 10 }, (_, index) => s.service.authenticate(attempt(KNOWN, 'wrong', `198.51.100.${index + 1}`))),
      ...Array.from({ length: 10 }, (_, index) => s.service.authenticate(attempt(KNOWN, PASSWORD, `198.51.100.${index + 100}`))),
    ]);
    expect(s.hasher.verified.length).toBeLessThanOrEqual(THROTTLE_POLICY.accountFailureLimit);
    expect(answers.filter((answer) => answer.status === 'signed-in').length).toBeLessThanOrEqual(THROTTLE_POLICY.accountFailureLimit);
  });

  it('45 attempts at once from one address, for different accounts, get at most 30 password checks', async () => {
    const s = await setup();
    const answers = await Promise.all(
      Array.from({ length: 45 }, (_, index) => s.service.authenticate(attempt(`person${index}@example.test`, 'wrong'))),
    );
    expect(s.hasher.verified).toHaveLength(THROTTLE_POLICY.ipFailureLimit);
    expect(answers.filter((answer) => answer.status === 'refused' && answer.reason === 'locked')).toHaveLength(15);
  });

  it('an attempt refused on the address touches no account, so a flood from a blocked address cannot lock a person out', async () => {
    const s = await setup();
    for (let count = 0; count < THROTTLE_POLICY.ipFailureLimit; count += 1) {
      await s.service.authenticate(attempt(`person${count}@example.test`, 'wrong'));
    }
    for (let count = 0; count < 10; count += 1) expect(await s.service.authenticate(attempt(KNOWN, 'wrong'))).toEqual(refused('locked'));
    expect((await s.service.authenticate(attempt(KNOWN, PASSWORD, '198.51.100.200'))).status).toBe('signed-in');
  });

  it('an attempt refused on the account gives its place on the address back', async () => {
    const s = await setup();
    for (let count = 0; count < THROTTLE_POLICY.accountFailureLimit; count += 1) {
      await s.service.authenticate(attempt(KNOWN, 'wrong', `198.51.100.${count + 1}`));
    }
    // Twenty more from the office address, all locked on the account: the address must not fill up with them.
    for (let count = 0; count < 20; count += 1) await s.service.authenticate(attempt(KNOWN, 'wrong', OFFICE));
    for (let count = 0; count < THROTTLE_POLICY.ipFailureLimit; count += 1) {
      expect(await s.service.authenticate(attempt(`person${count}@example.test`, 'wrong', OFFICE))).toEqual(refused('invalid'));
    }
  });
});

describe('a correct password gives back its place on a shared address and clears the account', () => {
  it('40 correct sign-ins in a row from one office address are all accepted', async () => {
    const hasher = createCountingHasher();
    const emails = Array.from({ length: 40 }, (_, index) => `worker${index}@example.test`);
    const passwordHash = await hasher.hash(PASSWORD);
    const users = createFakeUserRepository(
      emails.map((email) => ({ name: email, email, passwordHash, role: 'ENGINEER' as const, mustChangePassword: false })),
    );
    const service = createAuthService({ users, throttles: createFakeThrottleRepository(), hasher, clock: createFixedClock(START), keySecret: SECRET });
    for (const email of emails) expect((await service.authenticate(attempt(email, PASSWORD, OFFICE))).status).toBe('signed-in');
  });

  it('four wrong attempts, a correct one, and four more wrong ones: the account is never locked', async () => {
    const s = await setup();
    for (let count = 0; count < 4; count += 1) await s.service.authenticate(attempt(KNOWN, 'wrong', `198.51.100.${count + 1}`));
    expect((await s.service.authenticate(attempt(KNOWN, PASSWORD, '198.51.100.50'))).status).toBe('signed-in');
    for (let count = 0; count < 4; count += 1) {
      expect(await s.service.authenticate(attempt(KNOWN, 'wrong', `198.51.100.${count + 60}`))).toEqual(refused('invalid'));
    }
  });
});

describe('QLT-33: a failed dummy hash is forgotten, and a fault of ours counts against nobody', () => {
  it('after the first hash fails, the next unknown e-mail is answered "invalid", the same as a known one', async () => {
    const s = await setup();
    let failOnce = true;
    const flaky = {
      ...s.hasher,
      hash(password: string) {
        if (!failOnce) return s.hasher.hash(password);
        failOnce = false;
        return Promise.reject(new Error('no memory'));
      },
    };
    const service = createAuthService({ users: s.users, throttles: s.throttles, hasher: flaky, clock: s.clock, keySecret: SECRET });
    await expect(service.authenticate(attempt('nobody@example.test', 'x'))).rejects.toThrow('no memory');
    expect(await service.authenticate(attempt('other.nobody@example.test', 'x'))).toEqual(refused('invalid'));
    expect(await service.authenticate(attempt(KNOWN, 'wrong'))).toEqual(refused('invalid'));
  });

  it('an attempt that could not be checked gives both places back', async () => {
    const s = await setup();
    const broken = { ...s.hasher, verify: () => Promise.reject(new Error('no memory')) };
    const service = createAuthService({ users: s.users, throttles: s.throttles, hasher: broken, clock: s.clock, keySecret: SECRET });
    for (let count = 0; count < 10; count += 1) await expect(service.authenticate(attempt(KNOWN, PASSWORD))).rejects.toThrow('no memory');
    expect([...s.throttles.rows.values()].map((row) => row.failures)).toEqual([0, 0]);
    expect((await s.service.authenticate(attempt(KNOWN, PASSWORD))).status).toBe('signed-in');
  });

  it('a fault at the account step gives the address its place back', async () => {
    const s = await setup();
    let calls = 0;
    const throttles = {
      ...s.throttles,
      reserveAttempt: (...args: Parameters<typeof s.throttles.reserveAttempt>) => {
        calls += 1;
        return calls === 2 ? Promise.reject(new Error('database busy')) : s.throttles.reserveAttempt(...args);
      },
    };
    const service = createAuthService({ users: s.users, throttles, hasher: s.hasher, clock: s.clock, keySecret: SECRET });
    await expect(service.authenticate(attempt(KNOWN, PASSWORD))).rejects.toThrow('database busy');
    expect([...s.throttles.rows.values()].map((row) => row.failures)).toEqual([0]);
  });
});
