import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ActiveAdminExistsError, ConflictError, FieldValidationError, NotFoundError } from '@/lib/errors';
import { accountThrottleKey } from '@/server/auth/throttle-key';
import { resolveSessionUser } from '@/server/auth/resolve-session-user';
import { createAuthService, type AuthService } from '@/server/services/auth-service';
import { createUserService, type UserService } from '@/server/services/user-service';
import { systemClock } from '@/lib/time';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { createTestHasher } from '../../support/builders/user';
import { defined } from '../../support/defined';

/**
 * STORY-01.04 T1, T2 and T5 (AC-1 to AC-5) against real PostgreSQL in a throwaway database: the user service over the real
 * repositories, the real hasher (at a small cost), the real sign-in rules and the real session check. It includes the part
 * that only the database can prove: a second active Admin is refused by `uq_users_single_active_admin` whatever the code
 * checked first, for two requests at once and for direct SQL. Names and addresses are invented.
 */

const KEY_SECRET = 'invented-throttle-key-material';
const hasher = createTestHasher();
const ADMIN_INDEX = 'uq_users_single_active_admin';
const RACE_TIMEOUT_MILLISECONDS = 30_000;

let db: AuthDatabase;
let service: UserService;
let auth: AuthService;
let adminId: string;

function newUser(label: string, role: 'ADMIN' | 'LEAD' | 'ENGINEER' = 'ENGINEER') {
  return { name: `Invented ${label}`, email: `${label}@example.test`, role, password: 'invented-first-password-1' } as const;
}

async function row(id: string) {
  const { rows } = await db.owner.query<{
    name: string;
    email: string;
    password_hash: string;
    role: string;
    is_active: boolean;
    session_version: number;
    must_change_password: boolean;
  }>('SELECT name, email, password_hash, role, is_active, session_version, must_change_password FROM users WHERE id = $1', [id]);
  return defined(rows[0], 'user row');
}

async function signIn(email: string, password: string) {
  return auth.authenticate({ email, password, ipAddress: null });
}

beforeAll(async () => {
  db = await openAuthDatabase();
  service = createUserService({ users: db.users, throttles: db.throttles, hasher, keySecret: KEY_SECRET });
  auth = createAuthService({ users: db.users, throttles: db.throttles, hasher, clock: systemClock, keySecret: KEY_SECRET });
  // The first query opens the pool's connections; doing it here keeps that cost out of the first test's time limit.
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

describe('AC-3: two requests at once cannot make two Admins (the index decides)', () => {
  it('lets exactly one of several simultaneous Admin creations win, and tells the others who did', async () => {
    const attempts = await Promise.allSettled(
      ['race.one', 'race.two', 'race.three', 'race.four'].map((label) => service.create(newUser(label, 'ADMIN'))),
    );
    const winners = attempts.filter((attempt) => attempt.status === 'fulfilled');
    const losers = attempts.flatMap((attempt) => (attempt.status === 'rejected' ? [attempt.reason as unknown] : []));
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(3);
    for (const loser of losers) expect(loser).toBeInstanceOf(ActiveAdminExistsError);
    const winner = defined(winners[0]);
    adminId = winner.status === 'fulfilled' ? winner.value.id : '';
    for (const loser of losers) expect(loser).toMatchObject({ httpStatus: 409, currentAdmin: { id: adminId } });
    const { rows } = await db.owner.query<{ count: string }>("SELECT count(*) FROM users WHERE role = 'ADMIN' AND is_active");
    expect(rows[0]?.count).toBe('1');
    // Four password hashes and four writes at once on a busy machine can pass the default 5 s; the outcome is what is asserted.
  }, RACE_TIMEOUT_MILLISECONDS);
});

describe('AC-3: the database itself refuses a second active Admin, whatever the code checked', () => {
  const insert = "INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Direct', $1, 'h', 'ADMIN', $2)";

  it('direct SQL as the owner: a second active Admin fails on uq_users_single_active_admin and nothing changes', async () => {
    await expect(db.owner.query(insert, ['direct.owner@example.test', true])).rejects.toThrow(ADMIN_INDEX);
    const { rows } = await db.owner.query<{ count: string }>("SELECT count(*) FROM users WHERE email = 'direct.owner@example.test'");
    expect(rows[0]?.count).toBe('0');
  });

  it('direct SQL as the runtime role: the same refusal', async () => {
    await expect(db.runtime.query(insert, ['direct.runtime@example.test', true])).rejects.toThrow(ADMIN_INDEX);
  });

  it('direct SQL: promoting a user to Admin, or activating an inactive Admin, fails the same way', async () => {
    const lead = await service.create(newUser('promote.me', 'LEAD'));
    await expect(db.owner.query("UPDATE users SET role = 'ADMIN' WHERE id = $1", [lead.id])).rejects.toThrow(ADMIN_INDEX);
    await db.owner.query(insert, ['inactive.admin@example.test', false]);
    await expect(db.owner.query("UPDATE users SET is_active = true WHERE email = 'inactive.admin@example.test'")).rejects.toThrow(ADMIN_INDEX);
    expect((await row(lead.id)).role).toBe('LEAD');
  });

  it('an inactive Admin may exist next to the active one (the index is on active Admins only)', async () => {
    const { rows } = await db.owner.query<{ count: string }>("SELECT count(*) FROM users WHERE role = 'ADMIN'");
    expect(Number(rows[0]?.count)).toBeGreaterThanOrEqual(2);
  });
});

describe('AC-1: adding, listing, editing', () => {
  it('adds a person: the password is an argon2id hash and only that, the e-mail is stored lower case, and a new password is required at the first sign-in', async () => {
    const created = await service.create({ ...newUser('rohan.das'), email: 'Rohan.Das@Example.TEST' });
    expect(created).toEqual({ id: expect.any(String), name: 'Invented rohan.das', email: 'rohan.das@example.test', role: 'ENGINEER', isActive: true });
    expect(Object.keys(created).sort()).toEqual(['email', 'id', 'isActive', 'name', 'role']);
    const stored = await row(created.id);
    expect(stored.password_hash.startsWith('$argon2id$')).toBe(true);
    expect(stored.password_hash).not.toContain('invented-first-password-1');
    expect(stored).toMatchObject({ email: 'rohan.das@example.test', must_change_password: true, is_active: true, session_version: 0 });
    expect(await hasher.verify(stored.password_hash, 'invented-first-password-1')).toBe(true);
  });

  it('refuses an e-mail that differs from an existing one only in letter case: "A user with this e-mail already exists."', async () => {
    await service.create(newUser('case.test'));
    const error = await service.create({ ...newUser('case.test.other'), email: 'CASE.TEST@example.test' }).then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({ code: 'EMAIL_TAKEN', fields: [{ field: 'email', message: 'A user with this e-mail already exists.' }] });
  });

  it('lists everyone, active first, then Admin, Lead, Engineer, by name, with no hash or session field', async () => {
    const lead = await service.create(newUser('b.lead', 'LEAD'));
    const gone = await service.create(newUser('a.gone'));
    await service.update(adminId, gone.id, { isActive: false });
    const list = await service.list();
    const names = list.map((entry) => entry.name);
    expect(names.indexOf('Invented b.lead')).toBeGreaterThan(names.indexOf(defined(list.find((entry) => entry.role === 'ADMIN' && entry.isActive)).name));
    expect(list.find((entry) => entry.id === lead.id)).toBeDefined();
    const firstInactive = list.findIndex((entry) => !entry.isActive);
    expect(list.slice(firstInactive).every((entry) => !entry.isActive)).toBe(true);
    for (const entry of list) expect(Object.keys(entry).sort()).toEqual(['email', 'id', 'isActive', 'name', 'role']);
    expect(JSON.stringify(list)).not.toMatch(/argon2|password|session/i);
  });

  it('edits the name and the role of another person', async () => {
    const person = await service.create(newUser('edit.me'));
    const changed = await service.update(adminId, person.id, { name: 'Edited Name', role: 'LEAD' });
    expect(changed).toEqual({ ...person, name: 'Edited Name', role: 'LEAD' });
    expect(await row(person.id)).toMatchObject({ name: 'Edited Name', role: 'LEAD' });
  });

  it('answers not found for a well-formed ID nobody has', async () => {
    await expect(service.update(adminId, '00000000-0000-4000-8000-000000000000', { name: 'Nobody' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.resetPassword(adminId, '00000000-0000-4000-8000-000000000000', 'x1!')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('AC-3: through the service', () => {
  it('refuses a second Admin on create, promotion and activation, names the current Admin, and changes nothing', async () => {
    const name = defined(await db.users.findActiveAdmin()).name;
    const createError = await service.create(newUser('second.admin', 'ADMIN')).then(() => null, (reason: unknown) => reason);
    expect(createError).toBeInstanceOf(ActiveAdminExistsError);
    expect(createError).toMatchObject({ message: 'There is already an active Admin. Only one Admin can be active.', currentAdmin: { id: adminId, name } });

    const engineer = await service.create(newUser('promote.engineer'));
    await expect(service.update(adminId, engineer.id, { role: 'ADMIN' })).rejects.toBeInstanceOf(ActiveAdminExistsError);
    expect((await row(engineer.id)).role).toBe('ENGINEER');

    const { rows } = await db.owner.query<{ id: string }>("SELECT id FROM users WHERE email = 'inactive.admin@example.test'");
    const inactiveAdminId = defined(rows[0]).id;
    await expect(service.update(adminId, inactiveAdminId, { isActive: true })).rejects.toBeInstanceOf(ActiveAdminExistsError);
    expect((await row(inactiveAdminId)).is_active).toBe(false);
  });
});

describe('AC-4: the Admin cannot lock themself out', () => {
  it('refuses, with 409, to deactivate their own account or change their own role, and the row stays as it was', async () => {
    await expect(service.update(adminId, adminId, { isActive: false })).rejects.toMatchObject({ httpStatus: 409, code: 'CANNOT_DEACTIVATE_OWN_ACCOUNT' });
    await expect(service.update(adminId, adminId, { role: 'LEAD' })).rejects.toMatchObject({ httpStatus: 409, code: 'CANNOT_CHANGE_OWN_ROLE' });
    await expect(service.update(adminId, adminId, { role: 'LEAD' })).rejects.toBeInstanceOf(ConflictError);
    expect(await row(adminId)).toMatchObject({ role: 'ADMIN', is_active: true });
  });

  it('STD-01: refuses, with 409, to reset their own password, and the hash and session are as they were', async () => {
    const before = await row(adminId);
    await expect(service.resetPassword(adminId, adminId, 'invented-temporary-password-9')).rejects.toMatchObject({
      httpStatus: 409,
      code: 'CANNOT_RESET_OWN_PASSWORD',
    });
    expect(await row(adminId)).toMatchObject({ password_hash: before.password_hash, session_version: before.session_version, must_change_password: before.must_change_password });
  });
});

describe('AC-2: a deactivated person, and a role that changed, at the next request', () => {
  it('a deactivated person cannot sign in (the same answer as a wrong password) and an open session is refused at the next request', async () => {
    const person = await service.create(newUser('leaver'));
    const signedIn = await signIn('leaver@example.test', 'invented-first-password-1');
    expect(signedIn.status).toBe('signed-in');
    const claims = signedIn.status === 'signed-in' ? { userId: signedIn.userId, sessionVersion: signedIn.sessionVersion, signedAt: Math.floor(Date.now() / 1000) } : null;
    expect((await resolveSessionUser(claims, db.users, new Date()))?.id).toBe(person.id);

    await service.update(adminId, person.id, { isActive: false });
    expect(await resolveSessionUser(claims, db.users, new Date())).toBeNull();
    expect(await signIn('leaver@example.test', 'invented-first-password-1')).toEqual({ status: 'refused', reason: 'invalid' });
    expect(await signIn('leaver@example.test', 'a-wrong-password')).toEqual({ status: 'refused', reason: 'invalid' });

    // Activated again: the old session does not come back (it was ended), a new sign-in works.
    await service.update(adminId, person.id, { isActive: true });
    expect(await resolveSessionUser(claims, db.users, new Date())).toBeNull();
    expect((await signIn('leaver@example.test', 'invented-first-password-1')).status).toBe('signed-in');
  });

  it('a role change is read at the next request, from the database, not from the session', async () => {
    const person = await service.create(newUser('promoted'));
    const signedIn = defined(await signIn('promoted@example.test', 'invented-first-password-1'));
    if (signedIn.status !== 'signed-in') throw new Error('expected a sign-in');
    const claims = { userId: signedIn.userId, sessionVersion: signedIn.sessionVersion, signedAt: Math.floor(Date.now() / 1000) };
    expect((await resolveSessionUser(claims, db.users, new Date()))?.role).toBe('ENGINEER');
    await service.update(adminId, person.id, { role: 'LEAD' });
    expect((await resolveSessionUser(claims, db.users, new Date()))?.role).toBe('LEAD');
  });
});

describe('AC-5: resetting a password', () => {
  it('stores the new hash, asks for a change, ends the old session, lifts the sign-in block and lets the new password in', async () => {
    const person = await service.create(newUser('blocked.person'));
    await db.owner.query('UPDATE users SET must_change_password = false WHERE id = $1', [person.id]);
    const before = await row(person.id);

    // Five wrong passwords block the account for 15 minutes: even the right one is then refused.
    for (let attempt = 0; attempt < 5; attempt += 1) await signIn('blocked.person@example.test', 'wrong-password');
    expect(await signIn('blocked.person@example.test', 'invented-first-password-1')).toEqual({ status: 'refused', reason: 'locked' });
    const key = accountThrottleKey(KEY_SECRET, 'blocked.person@example.test');
    const blocked = await db.owner.query<{ blocked_until: Date | null }>('SELECT blocked_until FROM login_throttles WHERE key_hash = $1', [key]);
    expect(blocked.rows[0]?.blocked_until).not.toBeNull();

    await service.resetPassword(adminId, person.id, 'invented-temporary-password-9');

    const after = await row(person.id);
    expect(after.password_hash).not.toBe(before.password_hash);
    expect(after.password_hash.startsWith('$argon2id$')).toBe(true);
    expect(after.password_hash).not.toContain('invented-temporary-password-9');
    expect(after).toMatchObject({ must_change_password: true, session_version: before.session_version + 1 });
    const cleared = await db.owner.query<{ failures: number; blocked_until: Date | null }>('SELECT failures, blocked_until FROM login_throttles WHERE key_hash = $1', [key]);
    expect(cleared.rows[0]).toMatchObject({ failures: 0, blocked_until: null });
    expect((await signIn('blocked.person@example.test', 'invented-temporary-password-9')).status).toBe('signed-in');
    expect(await signIn('blocked.person@example.test', 'invented-first-password-1')).toEqual({ status: 'refused', reason: 'invalid' });
  });

  it('leaves every other person blocked', async () => {
    await service.create(newUser('still.blocked'));
    const other = await service.create(newUser('reset.someone.else'));
    for (let attempt = 0; attempt < 5; attempt += 1) await signIn('still.blocked@example.test', 'wrong-password');
    await service.resetPassword(adminId, other.id, 'invented-temporary-password-9');
    expect(await signIn('still.blocked@example.test', 'invented-first-password-1')).toEqual({ status: 'refused', reason: 'locked' });
  });
});
