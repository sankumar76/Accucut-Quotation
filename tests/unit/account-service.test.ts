import { beforeEach, describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, NotFoundError, TooManyAttemptsError } from '@/lib/errors';
import { accountThrottleKey, passwordChangeThrottleKey } from '@/server/auth/throttle-key';
import { createAccountService, PASSWORD_CHANGED_ELSEWHERE_CODE, type AccountService } from '@/server/services/account-service';
import { createAuthService } from '@/server/services/auth-service';

import { defined } from '../support/defined';
import { createCountingHasher, createFakeThrottleRepository, createFakeUserRepository, type CountingHasher, type FakeThrottleRepository, type FakeUserRepository } from '../support/fake-auth-repositories';
import { refusal } from '../support/user-service-fixture';

/**
 * STORY-01.05 AC-3 and AC-6 at the level of the rules, over in-memory repositories and a controlled clock: the order of the checks, what a
 * wrong current password costs, the five-attempt block on a key of its own, and that the change ends the old sessions. The same rules run
 * against PostgreSQL in `tests/integration/auth/account-password.test.ts`. Every name and password is invented.
 */

const KEY_SECRET = 'invented-throttle-key-material';
const MINUTE = 60_000;
const CURRENT = 'Tn4#vLm8@Qz-current';
const NEW = 'Pr9$kWd3!Rx-fresh';

let users: FakeUserRepository;
let throttles: FakeThrottleRepository;
let hasher: CountingHasher;
let service: AccountService;
let now: Date;
let personId: string;

beforeEach(() => {
  now = new Date('2026-11-12T10:00:00.000Z');
  users = createFakeUserRepository([
    { name: 'Invented Person', email: 'Invented.Person@Example.TEST', passwordHash: `hash:${CURRENT}`, role: 'ENGINEER', mustChangePassword: true },
  ]);
  throttles = createFakeThrottleRepository();
  hasher = createCountingHasher();
  service = createAccountService({ users, throttles, hasher, clock: { now: () => now }, keySecret: KEY_SECRET });
  personId = defined(users.records[0]).id;
});

const stored = () => defined(users.records.find((record) => record.id === personId));

describe('AC-3: changing the password', () => {
  it('stores the new hash, clears must_change_password, raises session_version and returns the new version', async () => {
    const before = stored().sessionVersion;
    const result = await service.changePassword(personId, { currentPassword: CURRENT, newPassword: NEW });
    expect(result).toEqual({ sessionVersion: before + 1 });
    expect(stored()).toMatchObject({ passwordHash: `hash:${NEW}`, mustChangePassword: false, sessionVersion: before + 1 });
    expect(hasher.hashed).toEqual([NEW]);
  });

  it('refuses the old password afterwards and accepts the new one at sign-in', async () => {
    await service.changePassword(personId, { currentPassword: CURRENT, newPassword: NEW });
    const auth = createAuthService({ users, throttles, hasher, clock: { now: () => now }, keySecret: KEY_SECRET });
    expect(await auth.authenticate({ email: 'invented.person@example.test', password: CURRENT, ipAddress: null })).toEqual({ status: 'refused', reason: 'invalid' });
    expect((await auth.authenticate({ email: 'invented.person@example.test', password: NEW, ipAddress: null })).status).toBe('signed-in');
  });

  it('a wrong current password is 422 CURRENT_PASSWORD_WRONG under currentPassword, and nothing changes', async () => {
    const error = await refusal(service.changePassword(personId, { currentPassword: 'Not-the-current-1!', newPassword: NEW }));
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({
      code: 'CURRENT_PASSWORD_WRONG',
      httpStatus: 422,
      fields: [{ field: 'currentPassword', message: 'Your current password is not correct.' }],
    });
    expect(stored()).toMatchObject({ passwordHash: `hash:${CURRENT}`, mustChangePassword: true, sessionVersion: 0 });
    expect(hasher.hashed).toEqual([]);
  });

  it.each([
    ['too short', 'Ab7!xy', 'The new password must be at least 10 characters.'],
    ['without a number', 'abcdef-ghijkl', 'Add at least one number.'],
    ['the e-mail address, in other letter case', 'INVENTED.PERSON@example.test', 'The password cannot be the same as your e-mail address.'],
    ['common', 'Welcome@123', 'That password is too common. Choose a different one.'],
  ])('a new password that is %s is 422 PASSWORD_RULE under newPassword, before any check of the current one', async (_name, newPassword, message) => {
    const error = await refusal(service.changePassword(personId, { currentPassword: 'Not-the-current-1!', newPassword }));
    expect(error).toMatchObject({ code: 'PASSWORD_RULE', httpStatus: 422, fields: [{ field: 'newPassword', message }] });
    // The rule costs no attempt and no hash.
    expect(throttles.rows.size).toBe(0);
    expect(hasher.verified).toEqual([]);
    expect(hasher.hashed).toEqual([]);
  });

  it('is not found for a person who is not there', async () => {
    expect(await refusal(service.changePassword('00000000-0000-4000-8000-0000000000ff', { currentPassword: CURRENT, newPassword: NEW }))).toBeInstanceOf(NotFoundError);
  });

  it('says so when the stored password changed after it was checked, and overwrites nothing', async () => {
    const racing = { ...users, changeOwnPassword: () => Promise.resolve(null) };
    const racingService = createAccountService({ users: racing, throttles, hasher, clock: { now: () => now }, keySecret: KEY_SECRET });
    const error = await refusal(racingService.changePassword(personId, { currentPassword: CURRENT, newPassword: NEW }));
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ httpStatus: 409, code: PASSWORD_CHANGED_ELSEWHERE_CODE });
  });
});

describe('AC-6: five wrong current passwords block the form for 15 minutes', () => {
  const wrong = () => refusal(service.changePassword(personId, { currentPassword: 'Not-the-current-1!', newPassword: NEW }));

  it('refuses the sixth attempt with 429, even with the right current password', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) expect(await wrong()).toMatchObject({ code: 'CURRENT_PASSWORD_WRONG' });
    const sixth = await refusal(service.changePassword(personId, { currentPassword: CURRENT, newPassword: NEW }));
    expect(sixth).toBeInstanceOf(TooManyAttemptsError);
    expect(sixth).toMatchObject({ httpStatus: 429, code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts. Try again in 15 minutes.' });
    expect(stored().passwordHash).toBe(`hash:${CURRENT}`);
    // A refused attempt checks nothing: five checks were made, not six.
    expect(hasher.verified).toHaveLength(5);
  });

  it('lets the person try again after 15 minutes', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) await wrong();
    expect(await refusal(service.changePassword(personId, { currentPassword: CURRENT, newPassword: NEW }))).toBeInstanceOf(TooManyAttemptsError);
    now = new Date(now.getTime() + 15 * MINUTE);
    await expect(service.changePassword(personId, { currentPassword: CURRENT, newPassword: NEW })).resolves.toMatchObject({ sessionVersion: 1 });
  });

  it('a right current password ends the run: four wrong, one right, then four wrong again are not blocked', async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) await wrong();
    await service.changePassword(personId, { currentPassword: CURRENT, newPassword: NEW });
    const second = { currentPassword: 'Not-the-current-1!', newPassword: CURRENT };
    for (let attempt = 0; attempt < 4; attempt += 1) expect(await refusal(service.changePassword(personId, second))).toMatchObject({ code: 'CURRENT_PASSWORD_WRONG' });
  });

  it('has its own key: five wrong current passwords do not block signing in', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) await wrong();
    expect(throttles.rows.has(passwordChangeThrottleKey(KEY_SECRET, personId))).toBe(true);
    expect(throttles.rows.has(accountThrottleKey(KEY_SECRET, 'invented.person@example.test'))).toBe(false);
    const auth = createAuthService({ users, throttles, hasher, clock: { now: () => now }, keySecret: KEY_SECRET });
    expect((await auth.authenticate({ email: 'invented.person@example.test', password: CURRENT, ipAddress: null })).status).toBe('signed-in');
  });

  it('the key does not depend on the letter case of the ID', () => {
    expect(passwordChangeThrottleKey(KEY_SECRET, 'ABCDEF00-0000-4000-8000-000000000001')).toBe(passwordChangeThrottleKey(KEY_SECRET, 'abcdef00-0000-4000-8000-000000000001'));
    expect(passwordChangeThrottleKey(KEY_SECRET, 'abc')).not.toBe(accountThrottleKey(KEY_SECRET, 'abc'));
  });

  it('gives the attempt back when the check itself fails, so a fault of ours never counts against the person', async () => {
    const broken = new Error('hasher is down');
    const failing = { ...hasher, verify: () => Promise.reject(broken) };
    const failingService = createAccountService({ users, throttles, hasher: failing, clock: { now: () => now }, keySecret: KEY_SECRET });
    expect(await refusal(failingService.changePassword(personId, { currentPassword: CURRENT, newPassword: NEW }))).toBe(broken);
    expect(throttles.rows.get(passwordChangeThrottleKey(KEY_SECRET, personId))?.failures).toBe(0);
  });
});
