import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { buildUser, createTestHasher, insertUser } from '../../support/builders/user';
import { defined } from '../../support/defined';

/**
 * STORY-01.01 T1, against real PostgreSQL in a throwaway database: the `users` and `login_throttles` tables, the
 * one-active-Admin index, the lower-case e-mail rule, the grants of the runtime role, and the foreign key from
 * `config_versions.created_by` (architect ruling on AQP-97).
 */

const hasher = createTestHasher();
const CONFIG_INSERT = `INSERT INTO config_versions (number, snapshot, created_by, reason) VALUES ($1, '{}'::jsonb, $2, 'test')`;

let db: AuthDatabase;

beforeAll(async () => {
  db = await openAuthDatabase();
});

afterAll(async () => {
  await db.close();
});

describe('users', () => {
  it('stores a user and reads it back as an account, without the password hash', async () => {
    const { id, email } = await insertUser(db.users, hasher, { name: 'Invented Lead', role: 'LEAD', email: 'Lead.One@Example.TEST' });
    expect(email).toBe('Lead.One@Example.TEST');
    const account = defined(await db.users.findAccountById(id), 'account');
    expect(account).toEqual({
      id,
      name: 'Invented Lead',
      email: 'lead.one@example.test',
      role: 'LEAD',
      isActive: true,
      sessionVersion: 0,
      mustChangePassword: false,
    });
    expect(Object.keys(account)).not.toContain('passwordHash');
  });

  it('finds a user by e-mail without regard to letter case or surrounding spaces', async () => {
    const { id } = await insertUser(db.users, hasher, { email: 'case.test@example.test' });
    expect((await db.users.findCredentialsByEmail('  CASE.Test@Example.TEST '))?.id).toBe(id);
  });

  it('gives the sign-in view an argon2id hash, the active flag and the session version', async () => {
    const { email } = await insertUser(db.users, hasher);
    const credentials = defined(await db.users.findCredentialsByEmail(email), 'credentials');
    expect(credentials.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(credentials).toMatchObject({ isActive: true, sessionVersion: 0 });
  });

  it('knows nobody for an unknown e-mail or ID', async () => {
    expect(await db.users.findCredentialsByEmail('nobody@example.test')).toBeNull();
    expect(await db.users.findAccountById('00000000-0000-4000-8000-000000000000')).toBeNull();
  });

  it('refuses a second user with the same e-mail', async () => {
    const { email } = await insertUser(db.users, hasher);
    await expect(db.users.create(await buildUser(hasher, { email }))).rejects.toThrow();
    await expect(db.users.create(await buildUser(hasher, { email: email.toUpperCase() }))).rejects.toThrow();
  });

  it('the database itself refuses an e-mail that is not lower case, so two rows can never differ only by case', async () => {
    const insert = `INSERT INTO users (name, email, password_hash, role) VALUES ('n', $1, 'h', 'ENGINEER')`;
    await expect(db.owner.query(insert, ['Mixed.Case@example.test'])).rejects.toThrow(/ck_users_email_lower_case/);
  });

  it('raises the session version by one when it is the version the caller names (compare and increment)', async () => {
    const { id } = await insertUser(db.users, hasher);
    expect(await db.users.raiseSessionVersion(id, 0)).toBe(true);
    expect(await db.users.raiseSessionVersion(id, 1)).toBe(true);
    expect((await db.users.findAccountById(id))?.sessionVersion).toBe(2);
  });

  it('leaves the version alone when the caller names an out-of-date one, so an old copied token cannot end the current session', async () => {
    const { id } = await insertUser(db.users, hasher);
    await db.users.raiseSessionVersion(id, 0);
    expect(await db.users.raiseSessionVersion(id, 0)).toBe(false);
    expect(await db.users.raiseSessionVersion(id, 7)).toBe(false);
    expect((await db.users.findAccountById(id))?.sessionVersion).toBe(1);
  });

  it('many sign-outs with the same token raise the version once, however many arrive at once', async () => {
    const { id } = await insertUser(db.users, hasher);
    const results = await Promise.all(Array.from({ length: 10 }, () => db.users.raiseSessionVersion(id, 0)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await db.users.findAccountById(id))?.sessionVersion).toBe(1);
  });

  it('raising the version of a user who does not exist changes nothing and does not fail', async () => {
    await expect(db.users.raiseSessionVersion('00000000-0000-4000-8000-000000000000', 0)).resolves.toBe(false);
  });

  it('keeps the must-change-password flag it is given', async () => {
    const { id } = await insertUser(db.users, hasher, { mustChangePassword: true });
    expect((await db.users.findAccountById(id))?.mustChangePassword).toBe(true);
  });
});

describe('one active Admin (CONSTRAINT-04; its own test is story 01.04)', () => {
  it('reports whether any Admin exists, and refuses a second active Admin in the database', async () => {
    expect(await db.users.hasAnyAdmin()).toBe(false);
    await insertUser(db.users, hasher, { role: 'ADMIN' });
    expect(await db.users.hasAnyAdmin()).toBe(true);
    await expect(db.users.create(await buildUser(hasher, { role: 'ADMIN' }))).rejects.toThrow(/uq_users_single_active_admin/);
  });

  it('an inactive Admin does not count against the index, but still counts as "an Admin exists"', async () => {
    await db.owner.query(`UPDATE users SET is_active = false WHERE role = 'ADMIN'`);
    await expect(insertUser(db.users, hasher, { role: 'ADMIN' })).resolves.toBeDefined();
    expect(await db.users.hasAnyAdmin()).toBe(true);
  });
});

describe('grants of the runtime role', () => {
  it('may read, add and change users', async () => {
    const { id } = await insertUser(db.users, hasher);
    await db.runtime.query(`UPDATE users SET name = 'Renamed' WHERE id = $1`, [id]);
    expect((await db.runtime.query(`SELECT name FROM users WHERE id = $1`, [id])).rows).toEqual([{ name: 'Renamed' }]);
  });

  it('may not delete or truncate users: a user is deactivated, never deleted', async () => {
    const { id } = await insertUser(db.users, hasher);
    await expect(db.runtime.query(`DELETE FROM users WHERE id = $1`, [id])).rejects.toThrow(/permission denied/);
    await expect(db.runtime.query(`TRUNCATE users`)).rejects.toThrow(/permission denied/);
  });

  it('may read, add, change and delete throttle rows, and has no DDL rights over either table', async () => {
    await db.runtime.query(`INSERT INTO login_throttles (key_hash, failures) VALUES ('k', 1)`);
    await db.runtime.query(`DELETE FROM login_throttles WHERE key_hash = 'k'`);
    await expect(db.runtime.query(`ALTER TABLE users ADD COLUMN x text`)).rejects.toThrow(/must be owner|permission denied/);
    await expect(db.runtime.query(`DROP TABLE login_throttles`)).rejects.toThrow(/must be owner|permission denied/);
  });
});

describe('login_throttles columns', () => {
  it('has created_at and updated_at, filled in by the database (G6 STD-02)', async () => {
    await db.runtime.query(`INSERT INTO login_throttles (key_hash, failures) VALUES ('created', 1)`);
    const { rows } = await db.runtime.query(`SELECT created_at, updated_at FROM login_throttles WHERE key_hash = 'created'`);
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
    expect(rows[0]?.updated_at).toBeInstanceOf(Date);
  });
});

describe('config_versions.created_by (architect ruling, AQP-97 comment 10695)', () => {
  it('version 1 keeps a null created_by, and the constraint exists with no cascade', async () => {
    await db.owner.query(CONFIG_INSERT, [1, null]);
    const { rows } = await db.owner.query(
      `SELECT confdeltype, confupdtype FROM pg_constraint WHERE conname = 'fk_config_versions_created_by'`,
    );
    // 'a' is NO ACTION.
    expect(rows).toEqual([{ confdeltype: 'a', confupdtype: 'a' }]);
  });

  it('refuses a version made by someone who is not a user', async () => {
    await expect(db.owner.query(CONFIG_INSERT, [2, '00000000-0000-4000-8000-000000000000'])).rejects.toThrow(
      /fk_config_versions_created_by/,
    );
  });

  it('accepts a version made by a user, and then refuses to remove that user', async () => {
    const { id } = await insertUser(db.users, hasher);
    await db.owner.query(CONFIG_INSERT, [3, id]);
    await expect(db.owner.query(`DELETE FROM users WHERE id = $1`, [id])).rejects.toThrow(/fk_config_versions_created_by/);
  });

  it('leaves the immutability guard in force: the row still cannot be changed', async () => {
    await expect(db.owner.query(`UPDATE config_versions SET reason = 'x' WHERE number = 1`)).rejects.toThrow(/immutable/);
  });
});
