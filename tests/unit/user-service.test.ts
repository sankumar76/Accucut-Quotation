import { beforeEach, describe, expect, it } from 'vitest';

import { ActiveAdminExistsError, ConflictError, FieldValidationError, NotFoundError } from '@/lib/errors';
import { accountThrottleKey } from '@/server/auth/throttle-key';
import { UserConstraintError, type UserRepository } from '@/server/repositories/user-repository';
import { type AuditContext, createAuditService } from '@/server/services/audit-service';
import {
  CANNOT_RESET_OWN_PASSWORD_CODE,
  CANNOT_CHANGE_OWN_ROLE_CODE,
  CANNOT_DEACTIVATE_OWN_ACCOUNT_CODE,
  createUserService,
  EMAIL_TAKEN_CODE,
  EMAIL_TAKEN_MESSAGE,
  type UserService,
} from '@/server/services/user-service';

import { createFakeAuditWorld, type FakeAuditWorld } from '../support/fake-audit';
import { createCountingHasher, createFakeThrottleRepository, createFakeUserRepository, type CountingHasher, type FakeThrottleRepository, type FakeUserRepository } from '../support/fake-auth-repositories';
import { defined } from '../support/defined';

/**
 * STORY-01.04 T1 and T2 (AC-1, AC-2, AC-3, AC-4, AC-5) at the level of the rules, over in-memory repositories. The same rules
 * are run against PostgreSQL, with the database's own refusal of a second Admin, in tests/integration/users.
 * STORY-01.07 T3 (AC-2, AC-3, AC-4): each change is one transaction with its audit entry, over an in-memory audit log; the same
 * entries are checked in PostgreSQL, rolled back and committed, in tests/integration/audit.
 * Every name and address is invented.
 */

const KEY_SECRET = 'invented-throttle-key-material';
const REQUEST_ID = 'req-0a0b0c0d';

let users: FakeUserRepository;
let throttles: FakeThrottleRepository;
let hasher: CountingHasher;
let world: FakeAuditWorld;
let service: UserService;
let adminId: string;
let leadId: string;
let engineerId: string;

/** The Admin (or whoever) making the change, on one request. */
function by(actorId: string): AuditContext {
  return { actorId, requestId: REQUEST_ID };
}

function build(repository: UserRepository = users): UserService {
  return createUserService({
    users: repository,
    throttles,
    hasher,
    transactions: world.transactions,
    audit: createAuditService({ audit: world.audit }),
    keySecret: KEY_SECRET,
  });
}

beforeEach(() => {
  users = createFakeUserRepository([
    { name: 'Invented Admin', email: 'admin@example.test', passwordHash: 'hash:x', role: 'ADMIN', mustChangePassword: false },
    { name: 'Invented Lead', email: 'lead@example.test', passwordHash: 'hash:x', role: 'LEAD', mustChangePassword: false },
    { name: 'Invented Engineer', email: 'engineer@example.test', passwordHash: 'hash:x', role: 'ENGINEER', mustChangePassword: false },
  ]);
  throttles = createFakeThrottleRepository();
  hasher = createCountingHasher();
  world = createFakeAuditWorld((actorId) => users.records.find((record) => record.id === actorId)?.name ?? 'Invented Unknown');
  service = build();
  adminId = defined(users.records.find((record) => record.role === 'ADMIN')).id;
  leadId = defined(users.records.find((record) => record.role === 'LEAD')).id;
  engineerId = defined(users.records.find((record) => record.role === 'ENGINEER')).id;
});

async function refusal(action: Promise<unknown>): Promise<unknown> {
  return action.then(
    () => {
      throw new Error('expected a refusal');
    },
    (error: unknown) => error,
  );
}

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
    const error = await refusal(build(racing).create(by(adminId), { name: 'Second Admin', email: 'second@example.test', role: 'ADMIN', password: 'x1!' }));
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
    const error = await refusal(build(racing).create(by(adminId), { name: 'Rohan Das', email: 'rohan@example.test', role: 'ENGINEER', password: 'x1!' }));
    expect(error).toBeInstanceOf(FieldValidationError);
  });

  it('passes on any other failure of the database untouched', async () => {
    const broken = new Error('connection lost');
    const failing: UserRepository = { ...users, create: () => Promise.reject(broken) };
    expect(await refusal(build(failing).create(by(adminId), { name: 'Rohan Das', email: 'rohan@example.test', role: 'ENGINEER', password: 'x1!' }))).toBe(broken);
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

describe('STORY-01.07 AC-3: each change raises its event, once, with every part, in the same transaction', () => {
  const FIRST_PASSWORD = 'first-password-1';

  it('adding a person raises user.created: who, the person and their name at the time, no before, the role and active after, the request', async () => {
    const created = await service.create(by(adminId), { name: 'Rohan Das', email: 'rohan.das@example.test', role: 'ENGINEER', password: FIRST_PASSWORD });
    expect(world.audit.committed).toHaveLength(1);
    expect(world.audit.appended[0]).toEqual({
      actorId: adminId,
      event: 'user.created',
      objectType: 'user',
      objectId: created.id,
      objectLabel: 'Rohan Das',
      before: null,
      after: { role: 'ENGINEER', isActive: true },
      requestId: REQUEST_ID,
    });
    expect(world.audit.committed[0]).toMatchObject({ actor: { id: adminId, name: 'Invented Admin' }, createdAt: expect.any(Date) });
  });

  it('changing a role raises user.role_changed with the role before and after', async () => {
    await service.update(by(adminId), engineerId, { role: 'LEAD' });
    expect(world.audit.appended).toEqual([
      expect.objectContaining({ event: 'user.role_changed', objectId: engineerId, objectLabel: 'Invented Engineer', before: { role: 'ENGINEER' }, after: { role: 'LEAD' }, actorId: adminId, requestId: REQUEST_ID }),
    ]);
  });

  it('deactivating raises user.deactivated and activating raises user.activated', async () => {
    await service.update(by(adminId), engineerId, { isActive: false });
    await service.update(by(adminId), engineerId, { isActive: true });
    expect(world.audit.appended.map((row) => [row.event, row.before, row.after])).toEqual([
      ['user.deactivated', { isActive: true }, { isActive: false }],
      ['user.activated', { isActive: false }, { isActive: true }],
    ]);
  });

  it('resetting a password raises user.password_reset with whether a change was still due, before and after', async () => {
    await service.resetPassword(by(adminId), engineerId, 'temporary-password-1');
    expect(world.audit.appended).toEqual([
      expect.objectContaining({ event: 'user.password_reset', objectId: engineerId, before: { mustChangePassword: false }, after: { mustChangePassword: true } }),
    ]);
  });

  it('a request that changes the role and the active flag raises two events, one for each, in order (edge case: two events, two entries)', async () => {
    await service.update(by(adminId), engineerId, { role: 'LEAD', isActive: false });
    expect(world.audit.committed.map((row) => row.event)).toEqual(['user.role_changed', 'user.deactivated']);
    expect(new Set(world.audit.committed.map((row) => row.id)).size).toBe(2);
  });

  it('changes that change nothing raise nothing: the same role, the same flag, a new name alone', async () => {
    await service.update(by(adminId), engineerId, { role: 'ENGINEER' });
    await service.update(by(adminId), engineerId, { isActive: true });
    await service.update(by(adminId), engineerId, { name: 'Renamed Engineer' });
    expect(world.audit.committed).toEqual([]);
  });

  it('a change that is refused raises nothing: a second Admin, the own role, the own account, an unknown person', async () => {
    await refusal(service.create(by(adminId), { name: 'Second Admin', email: 'second@example.test', role: 'ADMIN', password: FIRST_PASSWORD }));
    await refusal(service.update(by(adminId), adminId, { role: 'LEAD' }));
    await refusal(service.update(by(adminId), adminId, { isActive: false }));
    await refusal(service.resetPassword(by(adminId), adminId, 'temporary-password-1'));
    await refusal(service.update(by(adminId), '00000000-0000-4000-8000-0000000000ff', { role: 'LEAD' }));
    expect(world.audit.committed).toEqual([]);
  });

  it('a change whose entry is refused does not leave an entry behind, and the caller sees the refusal', async () => {
    const broken = new Error('the audit write failed');
    const failing = createUserService({
      users,
      throttles,
      hasher,
      transactions: world.transactions,
      audit: { record: () => Promise.reject(broken), list: () => Promise.reject(broken) },
      keySecret: KEY_SECRET,
    });
    expect(await refusal(failing.update(by(adminId), engineerId, { role: 'LEAD' }))).toBe(broken);
    expect(world.audit.committed).toEqual([]);
  });

  it('does not lift a sign-in block when the reset was rolled back', async () => {
    const failing = createUserService({
      users,
      throttles,
      hasher,
      transactions: world.transactions,
      audit: { record: () => Promise.reject(new Error('the audit write failed')), list: () => Promise.reject(new Error('unused')) },
      keySecret: KEY_SECRET,
    });
    const key = accountThrottleKey(KEY_SECRET, 'engineer@example.test');
    throttles.rows.set(key, { failures: 5, windowStartedAt: new Date('2026-11-05T09:45:00.000Z'), blockedUntil: new Date('2026-11-05T10:00:00.000Z') });
    await refusal(failing.resetPassword(by(adminId), engineerId, 'temporary-password-1'));
    expect(throttles.rows.get(key)?.blockedUntil).not.toBeNull();
  });
});

describe('STORY-01.07 AC-4: an entry never holds a password, a hash or a token', () => {
  const PASSWORD = 'first-password-1';

  it('across all five events, the stored JSON holds neither the password, nor its hash, nor a key that names one', async () => {
    const created = await service.create(by(adminId), { name: 'Rohan Das', email: 'rohan.das@example.test', role: 'ENGINEER', password: PASSWORD });
    await service.update(by(adminId), created.id, { role: 'LEAD' });
    await service.update(by(adminId), created.id, { isActive: false });
    await service.update(by(adminId), created.id, { isActive: true });
    await service.resetPassword(by(adminId), created.id, PASSWORD);
    expect(world.audit.committed.map((row) => row.event)).toEqual(['user.created', 'user.role_changed', 'user.deactivated', 'user.activated', 'user.password_reset']);
    const stored = JSON.stringify(world.audit.appended);
    expect(stored).not.toContain(PASSWORD);
    expect(stored).not.toContain('hash:');
    expect(stored).not.toMatch(/"(password|passwordHash|password_hash|token|hash)"/i);
    expect(stored).not.toContain('rohan.das@example.test');
  });

  it('a name that says "password" or "hash" as plain text is recorded as it is: the check is on keys and values, not on text', async () => {
    const created = await service.create(by(adminId), { name: 'Password Hash Tester', email: 'tester@example.test', role: 'LEAD', password: PASSWORD });
    expect(world.audit.committed).toEqual([expect.objectContaining({ objectLabel: 'Password Hash Tester', event: 'user.created', objectId: created.id })]);
  });
});

describe('STORY-01.07 AC-5: the label is the name at the time', () => {
  it('a later rename leaves the earlier entries as they were and the next entry carries the new name', async () => {
    const created = await service.create(by(adminId), { name: 'Rohan Das', email: 'rohan.das@example.test', role: 'ENGINEER', password: 'first-password-1' });
    await service.update(by(adminId), created.id, { name: 'Rohan D. Das', role: 'LEAD' });
    expect(world.audit.committed.map((row) => [row.event, row.objectLabel])).toEqual([
      ['user.created', 'Rohan Das'],
      ['user.role_changed', 'Rohan D. Das'],
    ]);
  });
});
