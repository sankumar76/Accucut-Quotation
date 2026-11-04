import { beforeEach, describe, expect, it } from 'vitest';

import { createFixedClock, MILLISECONDS_PER_MINUTE, type FixedClock } from '@/lib/time';
import { resolveSessionUser } from '@/server/auth/resolve-session-user';
import { createAuthService, THROTTLE_POLICY, type AuthService, type SignInAttempt } from '@/server/services/auth-service';

import {
  createCountingHasher,
  createFakeThrottleRepository,
  createFakeUserRepository,
  type CountingHasher,
  type FakeThrottleRepository,
  type FakeUserRepository,
} from '../support/fake-auth-repositories';

/**
 * STORY-01.01 AC-2 and AC-3: one answer for a wrong password, an unknown e-mail and a deactivated account, the
 * same work for each (a hash is always checked), and a block after five consecutive failures that ends after 15
 * minutes (controlled clock, PROPOSED values of NFR-003). No wall-clock limit anywhere (test strategy section 10):
 * "response times do not tell them apart" is proved by counting the work, which is what decides the time.
 */

const PASSWORD = 'invented-password-one';
const KNOWN = 'known.person@example.test';
const SECRET = 'invented-throttle-key-material';
const START = new Date('2026-11-04T09:00:00.000Z');
const ADDRESS = '203.0.113.7';

interface Setup {
  readonly service: AuthService;
  readonly clock: FixedClock;
  readonly users: FakeUserRepository;
  readonly throttles: FakeThrottleRepository;
  readonly hasher: CountingHasher;
}

async function setup(): Promise<Setup> {
  const hasher = createCountingHasher();
  const users = createFakeUserRepository([
    { name: 'Known Person', email: KNOWN, passwordHash: await hasher.hash(PASSWORD), role: 'ENGINEER', mustChangePassword: false },
  ]);
  hasher.hashed.length = 0;
  const throttles = createFakeThrottleRepository();
  const clock = createFixedClock(START);
  const service = createAuthService({ users, throttles, hasher, clock, keySecret: SECRET });
  return { service, clock, users, throttles, hasher };
}

const attempt = (email: string, password: string, ipAddress: string | null = ADDRESS): SignInAttempt => ({ email, password, ipAddress });

describe('AC-1: a correct e-mail and password sign in', () => {
  let s: Setup;
  beforeEach(async () => {
    s = await setup();
  });

  it('returns the user ID and their session version, ignoring the case and spaces of the e-mail', async () => {
    const result = await s.service.authenticate(attempt('  Known.Person@Example.TEST ', PASSWORD));
    expect(result).toEqual({ status: 'signed-in', userId: s.users.records[0]?.id, sessionVersion: 0 });
  });
});

describe('AC-2: one answer for every failure, after the same work', () => {
  let s: Setup;
  beforeEach(async () => {
    s = await setup();
  });

  it('refuses a wrong password as "invalid"', async () => {
    expect(await s.service.authenticate(attempt(KNOWN, 'wrong'))).toEqual({ status: 'refused', reason: 'invalid' });
  });

  it('refuses an unknown e-mail as "invalid", the same answer', async () => {
    expect(await s.service.authenticate(attempt('nobody@example.test', PASSWORD))).toEqual({
      status: 'refused',
      reason: 'invalid',
    });
  });

  it('refuses a deactivated account, even with the right password, as "invalid"', async () => {
    const record = s.users.records[0];
    if (record !== undefined) record.isActive = false;
    expect(await s.service.authenticate(attempt(KNOWN, PASSWORD))).toEqual({ status: 'refused', reason: 'invalid' });
  });

  it('checks exactly one hash in every case; an unknown e-mail is checked against a dummy hash made once', async () => {
    await s.service.authenticate(attempt(KNOWN, 'wrong'));
    await s.service.authenticate(attempt('nobody@example.test', PASSWORD));
    await s.service.authenticate(attempt('other.nobody@example.test', PASSWORD));
    const record = s.users.records[0];
    if (record !== undefined) record.isActive = false;
    await s.service.authenticate(attempt(KNOWN, PASSWORD));

    expect(s.hasher.verified).toHaveLength(4);
    const dummy = s.hasher.verified[1]?.passwordHash;
    expect(dummy).toBeDefined();
    expect(dummy).not.toBe(record?.passwordHash);
    expect(s.hasher.verified[2]?.passwordHash).toBe(dummy);
    // The dummy is hashed once, the first time it is needed, not for every unknown e-mail.
    expect(s.hasher.hashed).toHaveLength(1);
  });

  it('a deactivated account with the right password still counts as a failure for the account key', async () => {
    const record = s.users.records[0];
    if (record !== undefined) record.isActive = false;
    await s.service.authenticate(attempt(KNOWN, PASSWORD));
    expect([...s.throttles.rows.values()].map((row) => row.failures)).toEqual([1, 1]);
  });

  it('never stores an e-mail or an address in clear: the throttle keys are hashes', async () => {
    await s.service.authenticate(attempt('nobody@example.test', 'x'));
    for (const key of s.throttles.rows.keys()) {
      expect(key).toMatch(/^[0-9a-f]{64}$/);
      expect(key).not.toContain('nobody');
      expect(key).not.toContain(ADDRESS);
    }
  });
});

describe('AC-3: five consecutive failures block the account key for 15 minutes', () => {
  let s: Setup;
  beforeEach(async () => {
    s = await setup();
  });

  async function failFive(email: string): Promise<void> {
    for (let count = 0; count < THROTTLE_POLICY.accountFailureLimit; count += 1) {
      // A different address each time, so only the per-account rule is in play.
      expect(await s.service.authenticate(attempt(email, 'wrong', `198.51.100.${count + 1}`))).toEqual({
        status: 'refused',
        reason: 'invalid',
      });
    }
  }

  it('the sixth attempt is refused as "locked", and a correct password during the block is refused too', async () => {
    await failFive(KNOWN);
    expect(await s.service.authenticate(attempt(KNOWN, 'wrong', '198.51.100.99'))).toEqual({ status: 'refused', reason: 'locked' });
    expect(await s.service.authenticate(attempt(KNOWN, PASSWORD, '198.51.100.99'))).toEqual({ status: 'refused', reason: 'locked' });
  });

  it('an unknown e-mail takes the same path and shows the same "locked"', async () => {
    await failFive('nobody@example.test');
    expect(await s.service.authenticate(attempt('nobody@example.test', 'wrong', '198.51.100.99'))).toEqual({
      status: 'refused',
      reason: 'locked',
    });
  });

  it('a blocked attempt checks no password', async () => {
    await failFive(KNOWN);
    const before = s.hasher.verified.length;
    await s.service.authenticate(attempt(KNOWN, PASSWORD, '198.51.100.99'));
    expect(s.hasher.verified).toHaveLength(before);
  });

  it('just before 15 minutes it is still blocked; at 15 minutes sign-in works again', async () => {
    await failFive(KNOWN);
    s.clock.advance(THROTTLE_POLICY.blockMilliseconds - 1);
    expect(await s.service.authenticate(attempt(KNOWN, PASSWORD, '198.51.100.99'))).toEqual({ status: 'refused', reason: 'locked' });
    s.clock.advance(1);
    expect((await s.service.authenticate(attempt(KNOWN, PASSWORD, '198.51.100.99'))).status).toBe('signed-in');
  });

  it('a wrong password just after the block ends starts a new count of one; it does not block again', async () => {
    await failFive(KNOWN);
    s.clock.advance(THROTTLE_POLICY.blockMilliseconds);
    expect(await s.service.authenticate(attempt(KNOWN, 'wrong', '198.51.100.99'))).toEqual({ status: 'refused', reason: 'invalid' });
    expect(await s.service.authenticate(attempt(KNOWN, PASSWORD, '198.51.100.99'))).toMatchObject({ status: 'signed-in' });
  });

  it('four failures and then the right password clear the run, so four more are still allowed', async () => {
    for (let count = 0; count < 4; count += 1) await s.service.authenticate(attempt(KNOWN, 'wrong', `198.51.100.${count + 1}`));
    expect((await s.service.authenticate(attempt(KNOWN, PASSWORD, '198.51.100.50'))).status).toBe('signed-in');
    for (let count = 0; count < 4; count += 1) {
      expect((await s.service.authenticate(attempt(KNOWN, 'wrong', `198.51.100.${count + 60}`))).status).toBe('refused');
    }
    expect((await s.service.authenticate(attempt(KNOWN, PASSWORD, '198.51.100.70'))).status).toBe('signed-in');
  });

  it('another account is not affected by the block', async () => {
    await failFive('nobody@example.test');
    expect((await s.service.authenticate(attempt(KNOWN, PASSWORD, '198.51.100.99'))).status).toBe('signed-in');
  });

  it('the e-mail is compared without regard to case, so a case change does not escape the block', async () => {
    await failFive(KNOWN);
    expect(await s.service.authenticate(attempt('KNOWN.PERSON@example.test', PASSWORD, '198.51.100.99'))).toEqual({
      status: 'refused',
      reason: 'locked',
    });
  });
});

describe('AC-3: per address, 30 failures in 15 minutes also block', () => {
  let s: Setup;
  beforeEach(async () => {
    s = await setup();
  });

  /** 30 failures from one address, each for a different unknown e-mail, so no account reaches its own limit. */
  async function failThirty(): Promise<void> {
    for (let count = 0; count < THROTTLE_POLICY.ipFailureLimit; count += 1) {
      expect((await s.service.authenticate(attempt(`nobody${count}@example.test`, 'wrong'))).status).toBe('refused');
    }
  }

  it('the 31st attempt from that address is "locked", even for a correct password', async () => {
    await failThirty();
    expect(await s.service.authenticate(attempt(KNOWN, PASSWORD))).toEqual({ status: 'refused', reason: 'locked' });
  });

  it('another address is not blocked', async () => {
    await failThirty();
    expect((await s.service.authenticate(attempt(KNOWN, PASSWORD, '198.51.100.200'))).status).toBe('signed-in');
  });

  it('29 failures are not enough', async () => {
    for (let count = 0; count < THROTTLE_POLICY.ipFailureLimit - 1; count += 1) {
      await s.service.authenticate(attempt(`nobody${count}@example.test`, 'wrong'));
    }
    expect((await s.service.authenticate(attempt(KNOWN, PASSWORD))).status).toBe('signed-in');
  });

  it('failures older than the 15-minute window do not add up', async () => {
    for (let count = 0; count < THROTTLE_POLICY.ipFailureLimit - 1; count += 1) {
      await s.service.authenticate(attempt(`nobody${count}@example.test`, 'wrong'));
    }
    s.clock.advance(THROTTLE_POLICY.ipWindowMilliseconds);
    // The window has run out: this failure starts a new one, so it is far from 30.
    await s.service.authenticate(attempt('late@example.test', 'wrong'));
    expect((await s.service.authenticate(attempt(KNOWN, PASSWORD))).status).toBe('signed-in');
  });

  it('a block of the address ends after 15 minutes', async () => {
    await failThirty();
    s.clock.advance(THROTTLE_POLICY.blockMilliseconds);
    expect((await s.service.authenticate(attempt(KNOWN, PASSWORD))).status).toBe('signed-in');
  });

  it('a correct sign-in does not erase the address count (it is a window, not a run)', async () => {
    for (let count = 0; count < THROTTLE_POLICY.ipFailureLimit - 1; count += 1) {
      await s.service.authenticate(attempt(`nobody${count}@example.test`, 'wrong'));
    }
    expect((await s.service.authenticate(attempt(KNOWN, PASSWORD))).status).toBe('signed-in');
    await s.service.authenticate(attempt('one-more@example.test', 'wrong'));
    expect(await s.service.authenticate(attempt(KNOWN, PASSWORD))).toEqual({ status: 'refused', reason: 'locked' });
  });

  it('attempts without an address share one counter instead of none', async () => {
    for (let count = 0; count < THROTTLE_POLICY.ipFailureLimit; count += 1) {
      await s.service.authenticate(attempt(`nobody${count}@example.test`, 'wrong', null));
    }
    expect(await s.service.authenticate(attempt(KNOWN, PASSWORD, null))).toEqual({ status: 'refused', reason: 'locked' });
  });
});

describe('the policy values (NFR-003, PROPOSED)', () => {
  it('are 5 consecutive failures, 30 per address in 15 minutes, a 15-minute block', () => {
    expect(THROTTLE_POLICY).toEqual({
      accountFailureLimit: 5,
      ipFailureLimit: 30,
      ipWindowMilliseconds: 15 * MILLISECONDS_PER_MINUTE,
      blockMilliseconds: 15 * MILLISECONDS_PER_MINUTE,
    });
  });
});

describe('sign-out ends every session of the person', () => {
  it('raises their session version, which no longer matches a copied cookie', async () => {
    const s = await setup();
    const id = s.users.records[0]?.id ?? '';
    expect(await s.service.endAllSessions(id, 0)).toBe(true);
    expect(s.users.records[0]?.sessionVersion).toBe(1);
    expect(await s.service.authenticate(attempt(KNOWN, PASSWORD))).toMatchObject({ status: 'signed-in', sessionVersion: 1 });
  });

  it('an out-of-date token leaves the version unchanged, and the current session still works (ADR-009 amendment 1)', async () => {
    const s = await setup();
    const id = s.users.records[0]?.id ?? '';
    await s.service.endAllSessions(id, 0);
    // The old copied token (version 0) signs out again, and again.
    expect(await s.service.endAllSessions(id, 0)).toBe(false);
    expect(await s.service.endAllSessions(id, 0)).toBe(false);
    expect(s.users.records[0]?.sessionVersion).toBe(1);
    // The session made after the first sign-out (version 1) is still the current one.
    const claims = { userId: id, sessionVersion: 1, signedAt: START.getTime() / 1_000 };
    expect(await resolveSessionUser(claims, s.users, s.clock.now())).not.toBeNull();
  });
});
