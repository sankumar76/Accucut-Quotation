import { describe, expect, it } from 'vitest';

import { ConflictError } from '@/lib/errors';
import { ADMIN_EXISTS_CODE, bootstrapAdmin, FIRST_ADMIN_NAME } from '@/server/services/bootstrap-admin-service';

import { createCountingHasher, createFakeUserRepository } from '../support/fake-auth-repositories';
import { defined } from '../support/defined';

/** STORY-01.01 AC-7: one active Admin with `must_change_password`, the password hashed and never kept, a second run refused. */

const INPUT = { email: 'First.Admin@example.test', password: 'invented-initial-password' };

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
    expect(stored.replace('hash:invented-initial-password', '')).not.toContain(INPUT.password);
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
