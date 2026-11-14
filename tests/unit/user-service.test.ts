
import { beforeEach, describe, expect, it } from 'vitest';

import { ActiveAdminExistsError, ConflictError, FieldValidationError, NotFoundError } from '@/lib/errors';
import { accountThrottleKey, passwordChangeThrottleKey, stepUpThrottleKey } from '@/server/auth/throttle-key';
import { UserConstraintError, type UserRepository } from '@/server/repositories/user-repository';
import {
  CANNOT_RESET_OWN_PASSWORD_CODE,
  CANNOT_CHANGE_OWN_ROLE_CODE,
  CANNOT_DEACTIVATE_OWN_ACCOUNT_CODE,
  EMAIL_TAKEN_CODE,
  EMAIL_TAKEN_MESSAGE,
  type UserService,
} from '@/server/services/user-service';

import { defined } from '../support/defined';
import type { CountingHasher, FakeThrottleRepository, FakeUserRepository } from '../support/fake-auth-repositories';
import { createUserServiceFixture, KEY_SECRET, refusal, type UserServiceFixture } from '../support/user-service-fixture';

/**
 * STORY-01.04 T1 and T2 (AC-1, AC-2, AC-3, AC-4, AC-5) at the level of the rules, over in-memory repositories. The same rules
 * are run against PostgreSQL, with the database's own refusal of a second Admin, in tests/integration/users. The audit entries of
 * STORY-01.07 are `user-service-audit.test.ts`; both use the world of `tests/support/user-service-fixture.ts`.
 * Every name and address is invented.
 */

let users: FakeUserRepository;
let throttles: FakeThrottleRepository;
let hasher: CountingHasher;
let service: UserService;
let build: UserServiceFixture['build'];
let by: UserServiceFixture['by'];
let adminId: string;
let leadId: string;
let engineerId: string;

beforeEach(() => {
  ({ users, throttles, hasher, service, build, by, adminId, leadId, engineerId } = createUserServiceFixture());
});

describe('AC-1: the list', () => {
  it('lists every person with name, e-mail, role and active flag, and nothing else', async () => {
    const list = await service.list();
    expect(list.map((entry) => entry.email)).toEqual(['admin@example.test', 'lead@example.test', 'engineer@example.test']);
    for (const entry of list) expect(Object.keys(entry).sort()).toEqual(['email', 'id', 'isActive', 'name', 'role']);
    expect(JSON.stringify(list)).not.toMatch(/hash|password|session/i);
  });
});

describe('AC-1: adding a user', () => {
  const input = { name: 'Rohan Das', email: 'Rohan.Das@Example.TEST', role: 'ENGINEER', password: 'first-password-1' } as const;

  it('stores the password as a hash only, asks for a new one at the first sign-in, and returns the person without the hash', async () => {
    const created = await service.create(by(adminId), input);
    expect(created).toEqual({ id: expect.any(String), name: 'Rohan Das', email: 'rohan.das@example.test', role: 'ENGINEER', isActive: true });
    const stored = defined(users.records.find((record) => record.id === created.id));
    expect(stored.passwordHash).toBe('hash:first-password-1');
    expect(stored.passwordHash).not.toBe('first-password-1');
    expect(stored.mustChangePassword).toBe(true);
    expect(JSON.stringify(created)).not.toContain('first-password-1');
    expect(JSON.stringify(created)).not.toContain('hash');
  });

  it('refuses an e-mail that differs from an existing one only in letter case, on the e-mail field', async () => {
    const error = await refusal(service.create(by(adminId), { ...input, email: 'LEAD@example.test' }));
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({ code: EMAIL_TAKEN_CODE, httpStatus: 422, fields: [{ field: 'email', message: EMAIL_TAKEN_MESSAGE }] });
    expect(EMAIL_TAKEN_MESSAGE).toBe('A user with this e-mail already exists.');
    expect(users.records).toHaveLength(3);
  });
});

describe('AC-3: only one active Admin', () => {
  it('refuses a second Admin, names the current one, and changes nothing', async () => {
    const error = await refusal(service.create(by(adminId), { name: 'Second Admin', email: 'second@example.test', role: 'ADMIN', password: 'first-password-1' }));
    expect(error).toBeInstanceOf(ActiveAdminExistsError);
    expect(error).toMatchObject({ httpStatus: 409, currentAdmin: { id: adminId, name: 'Invented Admin' } });
    expect(users.records).toHaveLength(3);
    expect(hasher.hashed).toEqual([]);
  });

  it('refuses to promote a Lead to Admin', async () => {
    const error = await refusal(service.update(by(adminId), leadId, { role: 'ADMIN' }));
    expect(error).toBeInstanceOf(ActiveAdminExistsError);
    expect(defined(users.records.find((record) => record.id === leadId)).role).toBe('LEAD');
  });

  it('refuses to activate an inactive Admin while another is active', async () => {
    const inactiveAdmin = await users.create({ name: 'Old Admin', email: 'old.admin@example.test', passwordHash: 'hash:x', role: 'ENGINEER', mustChangePassword: false });
    defined(users.records.find((record) => record.id === inactiveAdmin)).isActive = false;
    defined(users.records.find((record) => record.id === inactiveAdmin)).role = 'ADMIN';
    const error = await refusal(service.update(by(adminId), inactiveAdmin, { isActive: true }));
    expect(error).toBeInstanceOf(ActiveAdminExistsError);
    expect(defined(users.records.find((record) => record.id === inactiveAdmin)).isActive).toBe(false);
  });

  it('the database decides when two requests race: its refusal becomes the same answer, naming the Admin who won', async () => {
    const racing: UserRepository = {
      ...users,
      // The check before the write saw no Admin; the write is then refused by the index.
      findActiveAdmin: (() => {
        let calls = 0;
        return () => {
          calls += 1;
          return Promise.resolve(calls === 1 ? null : { id: adminId, name: 'Invented Admin' });
        };
      })(),
      create: () => Promise.reject(new UserConstraintError('single-active-admin', { cause: new Error('uq_users_single_active_admin') })),
    };
    const error = await refusal(build(racing).create(by(adminId), { name: 'Second Admin', email: 'second@example.test', role: 'ADMIN', password: 'Racing-pass-7!' }));
    expect(error).toBeInstanceOf(ActiveAdminExistsError);
    expect(error).toMatchObject({ currentAdmin: { id: adminId, name: 'Invented Admin' } });
  });

  it('the database decides an update the same way', async () => {
    const racing: UserRepository = {
      ...users,
      findActiveAdmin: (() => {
        let calls = 0;
        return () => {
          calls += 1;
          return Promise.resolve(calls === 1 ? null : { id: adminId, name: 'Invented Admin' });
        };
      })(),
      update: () => Promise.reject(new UserConstraintError('single-active-admin', { cause: new Error('uq_users_single_active_admin') })),
    };
    const error = await refusal(build(racing).update(by(adminId), leadId, { role: 'ADMIN' }));
    expect(error).toBeInstanceOf(ActiveAdminExistsError);
  });

  it('an e-mail refusal by the database, after the check passed, is the e-mail message too', async () => {
    const racing: UserRepository = {
      ...users,
      create: () => Promise.reject(new UserConstraintError('email', { cause: new Error('uq_users_email') })),
    };
    const error = await refusal(build(racing).create(by(adminId), { name: 'Rohan Das', email: 'rohan@example.test', role: 'ENGINEER', password: 'Racing-pass-7!' }));
    expect(error).toBeInstanceOf(FieldValidationError);
  });

  it('passes on any other failure of the database untouched', async () => {
    const broken = new Error('connection lost');
    const failing: UserRepository = { ...users, create: () => Promise.reject(broken) };
    expect(await refusal(build(failing).create(by(adminId), { name: 'Rohan Das', email: 'rohan@example.test', role: 'ENGINEER', password: 'Racing-pass-7!' }))).toBe(broken);
  });
});

describe('AC-1 and AC-2: editing, deactivating and activating', () => {
  it('changes the name and the role of a person who is not the caller', async () => {
    const changed = await service.update(by(adminId), engineerId, { name: 'Renamed Engineer', role: 'LEAD' });
    expect(changed).toEqual({ id: engineerId, name: 'Renamed Engineer', email: 'engineer@example.test', role: 'LEAD', isActive: true });
  });

  it('deactivating ends the sessions of the person; activating again does not bring the old one back', async () => {
    const before = defined(users.records.find((record) => record.id === engineerId)).sessionVersion;
    expect((await service.update(by(adminId), engineerId, { isActive: false })).isActive).toBe(false);
    const after = defined(users.records.find((record) => record.id === engineerId)).sessionVersion;
    expect(after).toBe(before + 1);
    expect((await service.update(by(adminId), engineerId, { isActive: true })).isActive).toBe(true);
    expect(defined(users.records.find((record) => record.id === engineerId)).sessionVersion).toBe(after);
  });

  it('answers not found for an ID nobody has', async () => {
    const error = await refusal(service.update(by(adminId), '00000000-0000-4000-8000-0000000000ff', { name: 'Nobody' }));
    expect(error).toBeInstanceOf(NotFoundError);
  });
});

describe('AC-4: the Admin cannot lock themself out', () => {
  it('refuses to deactivate the caller own account, with 409 and a reason', async () => {
    const error = await refusal(service.update(by(adminId), adminId, { isActive: false }));
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ httpStatus: 409, code: CANNOT_DEACTIVATE_OWN_ACCOUNT_CODE });
    expect(defined(users.records.find((record) => record.id === adminId)).isActive).toBe(true);
  });

  it('refuses to change the caller own role, with 409 and a reason', async () => {
    const error = await refusal(service.update(by(adminId), adminId, { role: 'LEAD' }));
    expect(error).toMatchObject({ httpStatus: 409, code: CANNOT_CHANGE_OWN_ROLE_CODE });
    expect(defined(users.records.find((record) => record.id === adminId)).role).toBe('ADMIN');
  });

  it('refuses both together, and still lets the caller rename themself or send the role they already have', async () => {
    expect(await refusal(service.update(by(adminId), adminId, { role: 'LEAD', isActive: false }))).toBeInstanceOf(ConflictError);
    expect(await service.update(by(adminId), adminId, { name: 'Renamed Admin', role: 'ADMIN', isActive: true })).toMatchObject({ name: 'Renamed Admin', role: 'ADMIN', isActive: true });
  });
});

describe('the own-account rules do not depend on the letter case of an ID (PostgreSQL uuid ignores it)', () => {
  const mixed = (id: string): string => id.replace(/[a-f]/g, (digit, index: number) => (index % 2 === 0 ? digit.toUpperCase() : digit));

  it.each([
    ['upper case', (id: string) => id.toUpperCase()],
    ['mixed case', mixed],
  ])('refuses own deactivation, own role and own password reset when the target ID is written in %s', async (_name, spell) => {
    const target = spell(adminId);
    expect(target).not.toBe(adminId);
    expect(await refusal(service.update(by(adminId), target, { isActive: false }))).toMatchObject({ httpStatus: 409, code: CANNOT_DEACTIVATE_OWN_ACCOUNT_CODE });
    expect(await refusal(service.update(by(adminId), target, { role: 'LEAD' }))).toMatchObject({ httpStatus: 409, code: CANNOT_CHANGE_OWN_ROLE_CODE });
    expect(await refusal(service.resetPassword(by(adminId), target, 'temporary-password-1'))).toMatchObject({ httpStatus: 409, code: CANNOT_RESET_OWN_PASSWORD_CODE });
    expect(defined(users.records.find((record) => record.id === adminId))).toMatchObject({ role: 'ADMIN', isActive: true, mustChangePassword: false, sessionVersion: 0 });
    expect(hasher.hashed).toEqual([]);
  });

  it('refuses it when the caller ID is the one written in upper case', async () => {
    expect(await refusal(service.update(by(adminId.toUpperCase()), adminId, { isActive: false }))).toMatchObject({ code: CANNOT_DEACTIVATE_OWN_ACCOUNT_CODE });
    expect(await refusal(service.resetPassword(by(adminId.toUpperCase()), adminId, 'temporary-password-1'))).toMatchObject({ code: CANNOT_RESET_OWN_PASSWORD_CODE });
  });

  it('still lets the Admin change someone else, however the ID is written', async () => {
    expect((await service.update(by(adminId), engineerId.toUpperCase(), { name: 'Renamed Engineer' })).name).toBe('Renamed Engineer');
    await expect(service.resetPassword(by(adminId), engineerId.toUpperCase(), 'temporary-password-1')).resolves.toBeUndefined();
  });
});

describe('AC-5: resetting a password', () => {
  it('stores the new password as a hash, asks for a change at the next sign-in and ends the open sessions', async () => {
    const before = defined(users.records.find((record) => record.id === engineerId)).sessionVersion;
    await service.resetPassword(by(adminId), engineerId, 'temporary-password-1');
    const stored = defined(users.records.find((record) => record.id === engineerId));
    expect(stored.passwordHash).toBe('hash:temporary-password-1');
    expect(stored.mustChangePassword).toBe(true);
    expect(stored.sessionVersion).toBe(before + 1);
  });

  it('clears the sign-in block of that person, as the sign-in page promises', async () => {
    const key = accountThrottleKey(KEY_SECRET, 'engineer@example.test');
    const blockedUntil = new Date('2026-11-05T10:00:00.000Z');
    throttles.rows.set(key, { failures: 5, windowStartedAt: new Date('2026-11-05T09:45:00.000Z'), blockedUntil });
    await service.resetPassword(by(adminId), engineerId, 'temporary-password-1');
    expect(throttles.rows.get(key)).toMatchObject({ failures: 0, blockedUntil: null });
  });

  it('QLT-03: clears the block of the change-password form too, so the person is not refused on "Set a new password", the only page open to them', async () => {
    const key = passwordChangeThrottleKey(KEY_SECRET, engineerId);
    throttles.rows.set(key, { failures: 5, windowStartedAt: new Date('2026-11-05T09:45:00.000Z'), blockedUntil: new Date('2026-11-05T10:00:00.000Z') });
    await service.resetPassword(by(adminId), engineerId, 'temporary-password-1');
    expect(throttles.rows.get(key)).toMatchObject({ failures: 0, blockedUntil: null });
  });

  it('STORY-06.14 A-1: clears the step-up block of that person too, and leaves another person\'s step-up block alone', async () => {
    const key = stepUpThrottleKey(KEY_SECRET, engineerId);
    const otherKey = stepUpThrottleKey(KEY_SECRET, adminId);
    const blocked = { failures: 5, windowStartedAt: new Date('2026-11-05T09:45:00.000Z'), blockedUntil: new Date('2026-11-05T10:00:00.000Z') };
    throttles.rows.set(key, { ...blocked });
    throttles.rows.set(otherKey, { ...blocked });
    await service.resetPassword(by(adminId), engineerId, 'temporary-password-1');
    expect(throttles.rows.get(key)).toMatchObject({ failures: 0, blockedUntil: null });
    expect(throttles.rows.get(otherKey)?.failures).toBe(5);
  });

  it('QLT-03: a refused reset (own password, weak password) leaves the change-form block as it was', async () => {
    const key = passwordChangeThrottleKey(KEY_SECRET, engineerId);
    throttles.rows.set(key, { failures: 5, windowStartedAt: new Date('2026-11-05T09:45:00.000Z'), blockedUntil: new Date('2026-11-05T10:00:00.000Z') });
    await refusal(service.resetPassword(by(adminId), engineerId, 'weak'));
    expect(throttles.rows.get(key)?.failures).toBe(5);
  });

  it('leaves everyone else blocked: only that person account key is cleared', async () => {
    const other = accountThrottleKey(KEY_SECRET, 'lead@example.test');
    throttles.rows.set(other, { failures: 5, windowStartedAt: new Date('2026-11-05T09:45:00.000Z'), blockedUntil: new Date('2026-11-05T10:00:00.000Z') });
    await service.resetPassword(by(adminId), engineerId, 'temporary-password-1');
    expect(throttles.rows.get(other)?.failures).toBe(5);
  });

  it('answers not found for an ID nobody has, and hashes nothing', async () => {
    const error = await refusal(service.resetPassword(by(adminId), '00000000-0000-4000-8000-0000000000ff', 'temporary-password-1'));
    expect(error).toBeInstanceOf(NotFoundError);
    expect(hasher.hashed).toEqual([]);
  });

  it('STD-01: refuses the Admin their own password through this route, with 409, and changes nothing', async () => {
    const before = { ...defined(users.records.find((record) => record.id === adminId)) };
    const error = await refusal(service.resetPassword(by(adminId), adminId, 'temporary-password-1'));
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ httpStatus: 409, code: CANNOT_RESET_OWN_PASSWORD_CODE });
    expect(defined(users.records.find((record) => record.id === adminId))).toMatchObject({
      passwordHash: before.passwordHash,
      mustChangePassword: before.mustChangePassword,
      sessionVersion: before.sessionVersion,
    });
    expect(hasher.hashed).toEqual([]);
  });

  it('works for a deactivated person too: they can be activated afterwards', async () => {
    await service.update(by(adminId), engineerId, { isActive: false });
    await service.resetPassword(by(adminId), engineerId, 'temporary-password-1');
    expect(defined(users.records.find((record) => record.id === engineerId)).mustChangePassword).toBe(true);
  });
});
