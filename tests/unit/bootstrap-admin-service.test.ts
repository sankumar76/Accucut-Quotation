import { describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, PASSWORD_RULE_CODE } from '@/lib/errors';
import { ADMIN_EXISTS_CODE, bootstrapAdmin, FIRST_ADMIN_NAME } from '@/server/services/bootstrap-admin-service';

import { createCountingHasher, createFakeUserRepository } from '../support/fake-auth-repositories';
import { defined } from '../support/defined';

/**
 * STORY-01.01 AC-7: one active Admin with `must_change_password`, the password hashed and never kept, a second run refused.
 * STORY-01.05 AC-4: a password that does not meet the rule is refused with the part that failed, and nothing is created or hashed.
 */

const INPUT = { email: 'First.Admin@example.test', password: 'invented-initial-pass-7' };

describe('AC-7: the first Admin', () => {
  it('creates one Admin who must change the password, with the e-mail in lower case', async () => {
    const users = createFakeUserRepository();
    const hasher = createCountingHasher();
    await bootstrapAdmin(INPUT, { users, hasher });
    expect(users.records).toHaveLength(1);
    expect(users.records[0]).toMatchObject({
      name: FIRST_ADMIN_NAME,
      email: 'first.admin@example.test',
      role: 'ADMIN',
      isActive: true,
      mustChangePassword: true,
    });
  });

  it('stores only the hash, never the password', async () => {
    const users = createFakeUserRepository();
    await bootstrapAdmin(INPUT, { users, hasher: createCountingHasher() });
    const stored = JSON.stringify(users.records);
    expect(stored).toContain('hash:');
    expect(stored.replace(`hash:${INPUT.password}`, '')).not.toContain(INPUT.password);
  });

  it('refuses when an Admin exists, with the ADMIN_EXISTS code, and changes nothing and hashes nothing', async () => {
    const hasher = createCountingHasher();
    const users = createFakeUserRepository([
      { name: 'Existing', email: 'existing@example.test', passwordHash: 'h', role: 'ADMIN', mustChangePassword: false },
    ]);
    const failure: unknown = await bootstrapAdmin(INPUT, { users, hasher }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ConflictError);
    expect(failure instanceof ConflictError ? failure.code : '').toBe(ADMIN_EXISTS_CODE);
    expect(users.records).toHaveLength(1);
    expect(hasher.hashed).toEqual([]);
  });

  it('refuses a second run after a first', async () => {
    const users = createFakeUserRepository();
    const hasher = createCountingHasher();
    await bootstrapAdmin(INPUT, { users, hasher });
    await expect(bootstrapAdmin({ ...INPUT, email: 'other@example.test' }, { users, hasher })).rejects.toBeInstanceOf(ConflictError);
    expect(users.records).toHaveLength(1);
    expect(defined(users.records[0]).email).toBe('first.admin@example.test');
  });

  it('an existing Lead or Engineer does not stop it', async () => {
    const users = createFakeUserRepository([
      { name: 'Lead', email: 'lead@example.test', passwordHash: 'h', role: 'LEAD', mustChangePassword: false },
    ]);
    await bootstrapAdmin(INPUT, { users, hasher: createCountingHasher() });
    expect(users.records).toHaveLength(2);
  });
});

describe('STORY-01.05 AC-4: the password rule at the first Admin', () => {
  const weak: ReadonlyArray<readonly [string, string, string]> = [
    ['too short', 'Short-7!', 'The new password must be at least 10 characters.'],
    ['no number', 'invented-initial-pass', 'Add at least one number.'],
    ['no symbol', 'InventedInitialPass7', 'Add at least one symbol, such as ! # $ or %.'],
    ['the e-mail address', 'First.Admin@example.test', "The password cannot be the same as the user's e-mail address."],
    ['a common password', 'Welcome@123456', 'That password is too common. Choose a different one.'],
  ];

  it.each(weak)('refuses a password that is %s, names the part, and creates and hashes nothing', async (_name, password, message) => {
    const users = createFakeUserRepository();
    const hasher = createCountingHasher();
    const failure: unknown = await bootstrapAdmin({ ...INPUT, password }, { users, hasher }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(FieldValidationError);
    expect(failure).toMatchObject({ code: PASSWORD_RULE_CODE, httpStatus: 422, fields: [{ field: 'ADMIN_INITIAL_PASSWORD', message }] });
    expect(users.records).toEqual([]);
    expect(hasher.hashed).toEqual([]);
  });

  it('accepts a valid password', async () => {
    const users = createFakeUserRepository();
    await bootstrapAdmin(INPUT, { users, hasher: createCountingHasher() });
    expect(users.records).toHaveLength(1);
  });
});
