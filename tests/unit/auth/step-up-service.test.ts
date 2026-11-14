import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PASSWORD_INPUT_CEILING } from '@/lib/users/validation';
import { DatabaseBusyError, StepUpFailed, StepUpLocked, UnauthorizedError } from '@/lib/errors';
import { stepUpThrottleKey } from '@/server/auth/throttle-key';
import { createAuthService, STEP_UP_POLICY } from '@/server/services/auth-service';
import { createStepUpService, type StepUpService } from '@/server/services/step-up-service';

import { defined } from '../../support/defined';
import { createCountingHasher, createFakeThrottleRepository, createFakeUserRepository, type CountingHasher, type FakeThrottleRepository, type FakeUserRepository } from '../../support/fake-auth-repositories';

/**
 * STORY-06.14 at the level of the rules, over in-memory repositories and a controlled clock: AC-1 (a right password passes and ends the
 * run of failures), AC-2 (one neutral 422), AC-3 (five wrong passwords block for 15 minutes, on a key of their own), AC-4 (sign-in and
 * step-up never share a count), AC-5 (a fault of ours gives the reservation back), AC-6 (only the given person's own password is read)
 * and AC-7 (the log carries the person's ID and the request ID, and never the password). The same rules run against PostgreSQL, through a
 * real `withRoute` handler, in `tests/integration/auth/step-up.test.ts`. Every name, ID and password here is invented.
 */

const mocks = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: mocks.debug, info: mocks.info, warn: mocks.warn, error: mocks.error } }));

const KEY_SECRET = 'invented-throttle-key-material';
const MINUTE = 60_000;
const RIGHT = 'Tn4#vLm8@Qz-right';
const WRONG = 'Not-the-right-1!';
const THEIRS = 'Zx8%mNc4#Tv-other';
const REQUEST_ID = 'req-1a2b3c4d';

let users: FakeUserRepository;
let throttles: FakeThrottleRepository;
let hasher: CountingHasher;
let service: StepUpService;
let now: Date;
let personId: string;
let otherId: string;

function build(overrides: { readonly users?: FakeUserRepository['findCredentialsById']; readonly hasher?: CountingHasher } = {}): StepUpService {
  const repository = overrides.users === undefined ? users : { ...users, findCredentialsById: overrides.users };
  return createStepUpService({ users: repository, throttles, hasher: overrides.hasher ?? hasher, clock: { now: () => now }, keySecret: KEY_SECRET });
}

beforeEach(() => {
  vi.clearAllMocks();
  now = new Date('2026-11-14T10:00:00.000Z');
  users = createFakeUserRepository([
    { name: 'Invented Admin', email: 'Invented.Admin@Example.TEST', passwordHash: `hash:${RIGHT}`, role: 'ADMIN', mustChangePassword: false },
    { name: 'Invented Lead', email: 'invented.lead@example.test', passwordHash: `hash:${THEIRS}`, role: 'LEAD', mustChangePassword: false },
  ]);
  throttles = createFakeThrottleRepository();
  hasher = createCountingHasher();
  service = build();
  personId = defined(users.records[0]).id;
  otherId = defined(users.records[1]).id;
});

const caller = (id = personId) => ({ user: { id }, requestId: REQUEST_ID });
const keyOf = (id = personId) => stepUpThrottleKey(KEY_SECRET, id);
const failures = (id = personId) => throttles.rows.get(keyOf(id))?.failures;

async function thrown(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (reason: unknown) => reason,
  );
}

async function wrongTimes(count: number): Promise<void> {
  for (let attempt = 0; attempt < count; attempt += 1) await thrown(service.verifyStepUp(caller(), WRONG));
}

describe('the policy', () => {
  it('is five failures and a 15-minute block (NFR-003, proposed)', () => {
    expect(STEP_UP_POLICY).toEqual({ failureLimit: 5, blockMilliseconds: 15 * MINUTE });
  });
});

describe('AC-1: the right password', () => {
  it('passes, and checks the stored hash of the person given', async () => {
    await expect(service.verifyStepUp(caller(), RIGHT)).resolves.toBeUndefined();
    expect(hasher.verified).toEqual([{ passwordHash: `hash:${RIGHT}`, matched: true }]);
  });

  it('ends the run of failures: four wrong, one right, then four wrong again do not block', async () => {
    await wrongTimes(4);
    expect(failures()).toBe(4);
    await service.verifyStepUp(caller(), RIGHT);
    expect(failures()).toBe(0);
    await wrongTimes(4);
    await expect(service.verifyStepUp(caller(), RIGHT)).resolves.toBeUndefined();
  });

  it('writes nothing to the log', async () => {
    await service.verifyStepUp(caller(), RIGHT);
    expect([mocks.debug, mocks.info, mocks.warn, mocks.error].flatMap((spy) => spy.mock.calls)).toEqual([]);
  });
});

describe('AC-2: a wrong password', () => {
  it('is a 422 STEP_UP_FAILED, never a 401', async () => {
    const error = await thrown(service.verifyStepUp(caller(), WRONG));
    expect(error).toBeInstanceOf(StepUpFailed);
    expect(error).toMatchObject({ httpStatus: 422, code: 'STEP_UP_FAILED' });
  });

  it('says the same words for every wrong case: a wrong password, an empty one, one too long to be a password, and another person\'s', async () => {
    const messages = [];
    for (const attempt of [WRONG, '', 'x'.repeat(PASSWORD_INPUT_CEILING + 1), THEIRS]) {
      const error = await thrown(service.verifyStepUp(caller(), attempt));
      expect(error).toBeInstanceOf(StepUpFailed);
      messages.push((error as StepUpFailed).message);
    }
    expect(new Set(messages).size).toBe(1);
  });

  it('does not hash a password longer than any the portal could have stored, and still counts it', async () => {
    await thrown(service.verifyStepUp(caller(), 'x'.repeat(PASSWORD_INPUT_CEILING + 1)));
    expect(hasher.verified).toEqual([]);
    expect(failures()).toBe(1);
  });
});

describe('AC-3: five wrong passwords block for 15 minutes, on a key of their own', () => {
  it('refuses the sixth with 429 STEP_UP_LOCKED even with the right password, and checks no password for it', async () => {
    await wrongTimes(5);
    expect(hasher.verified).toHaveLength(5);
    const error = await thrown(service.verifyStepUp(caller(), RIGHT));
    expect(error).toBeInstanceOf(StepUpLocked);
    expect(error).toMatchObject({ httpStatus: 429, code: 'STEP_UP_LOCKED' });
    expect(hasher.verified).toHaveLength(5);
  });

  it('keeps refusing until the 15 minutes are over, then accepts the right password', async () => {
    await wrongTimes(5);
    now = new Date(now.getTime() + 15 * MINUTE - 1);
    expect(await thrown(service.verifyStepUp(caller(), RIGHT))).toBeInstanceOf(StepUpLocked);
    now = new Date(now.getTime() + 1);
    await expect(service.verifyStepUp(caller(), RIGHT)).resolves.toBeUndefined();
  });

  it('blocks one person only: another person can still step up', async () => {
    await wrongTimes(5);
    await expect(service.verifyStepUp(caller(otherId), THEIRS)).resolves.toBeUndefined();
  });

  it('counts on the `stepup` key and on no other row', async () => {
    await wrongTimes(2);
    expect([...throttles.rows.keys()]).toEqual([keyOf()]);
  });
});

describe('AC-4: sign-in and step-up never block each other', () => {
  function signIn() {
    return createAuthService({ users, throttles, hasher, clock: { now: () => now }, keySecret: KEY_SECRET });
  }

  it('a blocked step-up does not block sign-in', async () => {
    await wrongTimes(5);
    expect(await thrown(service.verifyStepUp(caller(), RIGHT))).toBeInstanceOf(StepUpLocked);
    expect((await signIn().authenticate({ email: 'invented.admin@example.test', password: RIGHT, ipAddress: '192.0.2.10' })).status).toBe('signed-in');
  });

  it('four failed sign-ins do not count towards step-up, and the step-up failures do not count towards sign-in', async () => {
    const auth = signIn();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await auth.authenticate({ email: 'invented.admin@example.test', password: WRONG, ipAddress: '192.0.2.10' });
    }
    // Five wrong step-up passwords: the fifth is the one that would have been the ninth on a shared count.
    await wrongTimes(5);
    expect(await thrown(service.verifyStepUp(caller(), RIGHT))).toBeInstanceOf(StepUpLocked);
    // Sign-in has had four failures and is not blocked: the right password signs in.
    expect((await auth.authenticate({ email: 'invented.admin@example.test', password: RIGHT, ipAddress: '192.0.2.11' })).status).toBe('signed-in');
  });

  it('four failed sign-ins and then a step-up with the right password pass', async () => {
    const auth = signIn();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await auth.authenticate({ email: 'invented.admin@example.test', password: WRONG, ipAddress: '192.0.2.10' });
    }
    await expect(service.verifyStepUp(caller(), RIGHT)).resolves.toBeUndefined();
  });
});

describe('AC-5: a fault of ours gives the reservation back', () => {
  it('a database fault while reading the person gives it back and answers 503 DATABASE_BUSY', async () => {
    const faulty = build({ users: () => Promise.reject(new DatabaseBusyError()) });
    await wrongTimes(2);
    const error = await thrown(faulty.verifyStepUp(caller(), WRONG));
    expect(error).toBeInstanceOf(DatabaseBusyError);
    expect(error).toMatchObject({ httpStatus: 503 });
    expect(failures()).toBe(2);
  });

  it('a fault while checking the password gives it back', async () => {
    const broken: CountingHasher = { ...hasher, verify: () => Promise.reject(new Error('hasher fault')) };
    const faulty = build({ hasher: broken });
    expect(await thrown(faulty.verifyStepUp(caller(), RIGHT))).toMatchObject({ message: 'hasher fault' });
    expect(failures()).toBe(0);
  });

  it('five faults in a row block no one', async () => {
    const faulty = build({ users: () => Promise.reject(new DatabaseBusyError()) });
    for (let attempt = 0; attempt < 5; attempt += 1) await thrown(faulty.verifyStepUp(caller(), RIGHT));
    await expect(service.verifyStepUp(caller(), RIGHT)).resolves.toBeUndefined();
  });

  it('a fault that also stops the reservation being given back still raises the original error', async () => {
    const stuck = { ...throttles, releaseAttempt: () => Promise.reject(new DatabaseBusyError()) };
    const faulty = createStepUpService({
      users: { ...users, findCredentialsById: () => Promise.reject(new Error('original fault')) },
      throttles: stuck,
      hasher,
      clock: { now: () => now },
      keySecret: KEY_SECRET,
    });
    expect(await thrown(faulty.verifyStepUp(caller(), RIGHT))).toMatchObject({ message: 'original fault' });
  });

  it('a fault while ending the run of failures after a right password gives the reservation back and refuses the action with the fault', async () => {
    const failing = { ...throttles, clear: () => Promise.reject(new DatabaseBusyError()) };
    const faulty = createStepUpService({ users, throttles: failing, hasher, clock: { now: () => now }, keySecret: KEY_SECRET });
    expect(await thrown(faulty.verifyStepUp(caller(), RIGHT))).toBeInstanceOf(DatabaseBusyError);
    expect(failures()).toBe(0);
  });

  it('a fault while reserving reaches the caller and counts nothing', async () => {
    const failing = { ...throttles, reserveAttempt: () => Promise.reject(new DatabaseBusyError()) };
    const faulty = createStepUpService({ users, throttles: failing, hasher, clock: { now: () => now }, keySecret: KEY_SECRET });
    expect(await thrown(faulty.verifyStepUp(caller(), RIGHT))).toBeInstanceOf(DatabaseBusyError);
    expect(throttles.rows.size).toBe(0);
    expect(hasher.verified).toEqual([]);
  });

  it('a person who is no longer there (deleted or deactivated since the session was read) is refused with 401, no password is checked, and the reservation is given back', async () => {
    defined(users.records[0]).isActive = false;
    expect(await thrown(service.verifyStepUp(caller(), RIGHT))).toBeInstanceOf(UnauthorizedError);
    expect(await thrown(service.verifyStepUp(caller('00000000-0000-4000-8000-000000000099'), RIGHT))).toBeInstanceOf(UnauthorizedError);
    expect(hasher.verified).toEqual([]);
    expect(failures()).toBe(0);
  });
});

describe('AC-6: only the given person\'s own password is read', () => {
  it('another person\'s password does not pass for this person, and this person\'s password does not pass for the other', async () => {
    expect(await thrown(service.verifyStepUp(caller(personId), THEIRS))).toBeInstanceOf(StepUpFailed);
    expect(await thrown(service.verifyStepUp(caller(otherId), RIGHT))).toBeInstanceOf(StepUpFailed);
    await expect(service.verifyStepUp(caller(personId), RIGHT)).resolves.toBeUndefined();
  });

  it('counts the attempt against the person it was made for, not against anyone else', async () => {
    await wrongTimes(3);
    expect(failures(personId)).toBe(3);
    expect(failures(otherId)).toBeUndefined();
  });
});

describe('AC-7: the log', () => {
  it('a failed step-up logs the person\'s ID and the request ID, and nothing else', async () => {
    await thrown(service.verifyStepUp(caller(), WRONG));
    expect(mocks.warn).toHaveBeenCalledTimes(1);
    expect(mocks.warn.mock.calls[0]?.[0]).toEqual({ userId: personId, requestId: REQUEST_ID });
  });

  it('a refused attempt on a blocked person is logged the same way', async () => {
    await wrongTimes(5);
    mocks.warn.mockClear();
    await thrown(service.verifyStepUp(caller(), RIGHT));
    expect(mocks.warn).toHaveBeenCalledTimes(1);
    expect(mocks.warn.mock.calls[0]?.[0]).toEqual({ userId: personId, requestId: REQUEST_ID });
  });

  it('no password, wrong or right, reaches any log call or any error', async () => {
    const errors = [];
    for (const attempt of [WRONG, RIGHT]) errors.push(await thrown(service.verifyStepUp(caller(), attempt)));
    await wrongTimes(5);
    errors.push(await thrown(service.verifyStepUp(caller(), RIGHT)));
    const everything = JSON.stringify([...[mocks.debug, mocks.info, mocks.warn, mocks.error].flatMap((spy) => spy.mock.calls), ...errors.map((error) => String(error))]);
    for (const secret of [WRONG, RIGHT, THEIRS]) expect(everything).not.toContain(secret);
    expect(everything).not.toContain(`hash:`);
  });
});
