import { describe, expect, it } from 'vitest';

import {
  createUserBodySchema,
  resetPasswordBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
  userSchema,
  usersResponseSchema,
} from '@/server/views/schemas/users';

/**
 * QLT-70 (STORY-01.04): the strictness of the users contract is pinned. A key the schema does not name is an error in an
 * answer (so a field added to a person later cannot reach a client by being spread, NFR-002) and in a request (so a client
 * cannot set a hash, a session version or a flag directly). Every name and value here is invented.
 */

const PERSON = { id: '00000000-0000-4000-8000-000000000001', name: 'Rohan Das', email: 'rohan.das@example.test', role: 'ENGINEER', isActive: true };

describe('the answers are strict', () => {
  it.each([['passwordHash', 'x'], ['password_hash', 'x'], ['sessionVersion', 3], ['mustChangePassword', true]])(
    'a person with an extra "%s" is an error, alone and in the list',
    (key, value) => {
      const leaky = { ...PERSON, [key]: value };
      expect(userSchema.safeParse(leaky).success).toBe(false);
      expect(usersResponseSchema.safeParse({ users: [PERSON, leaky] }).success).toBe(false);
    },
  );

  it('accepts exactly a person and a list of them, and refuses a list with another key beside it', () => {
    expect(userSchema.safeParse(PERSON).success).toBe(true);
    expect(usersResponseSchema.safeParse({ users: [PERSON] }).success).toBe(true);
    expect(usersResponseSchema.safeParse({ users: [PERSON], total: 1 }).success).toBe(false);
  });

  it('refuses a person without a field, a role that does not exist or a flag that is not a boolean', () => {
    const withoutFlag = { id: PERSON.id, name: PERSON.name, email: PERSON.email, role: PERSON.role };
    expect(userSchema.safeParse(withoutFlag).success).toBe(false);
    expect(userSchema.safeParse({ ...PERSON, role: 'OWNER' }).success).toBe(false);
    expect(userSchema.safeParse({ ...PERSON, isActive: 'yes' }).success).toBe(false);
  });
});

describe('the requests are strict', () => {
  const create = { name: 'Rohan Das', email: 'rohan.das@example.test', role: 'ENGINEER', password: 'invented-1!' };

  it('POST accepts name, e-mail, role and password and nothing more', () => {
    expect(createUserBodySchema.safeParse(create).success).toBe(true);
    for (const extra of [{ isActive: false }, { passwordHash: 'x' }, { sessionVersion: 1 }, { id: PERSON.id }]) {
      expect(createUserBodySchema.safeParse({ ...create, ...extra }).success).toBe(false);
    }
  });

  it('PATCH takes name, role and isActive, any of them, and nothing else; an empty body is refused', () => {
    expect(updateUserBodySchema.safeParse({ name: 'A' }).success).toBe(true);
    expect(updateUserBodySchema.safeParse({ role: 'LEAD', isActive: false }).success).toBe(true);
    expect(updateUserBodySchema.safeParse({}).success).toBe(false);
    for (const extra of [{ email: 'other@example.test' }, { passwordHash: 'x' }, { sessionVersion: 1 }, { password: 'x' }]) {
      expect(updateUserBodySchema.safeParse({ name: 'A', ...extra }).success).toBe(false);
    }
  });

  it('the reset takes a password and nothing more', () => {
    expect(resetPasswordBodySchema.safeParse({ password: 'invented-1!' }).success).toBe(true);
    expect(resetPasswordBodySchema.safeParse({ password: 'invented-1!', role: 'ADMIN' }).success).toBe(false);
  });

  it('the path takes one UUID and nothing more', () => {
    expect(userIdParamsSchema.safeParse({ id: PERSON.id }).success).toBe(true);
    expect(userIdParamsSchema.safeParse({ id: PERSON.id, other: 'x' }).success).toBe(false);
    expect(userIdParamsSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });

  it('writes the ID in lower case, as PostgreSQL returns it, whatever case the address used', () => {
    // Every ID below holds hex letters, so a change of case really changes the string (an ID of digits only could not fail).
    const lower = 'abcdef01-2345-4678-89ab-cdef01234567';
    expect(lower).not.toBe(lower.toUpperCase());
    expect(userIdParamsSchema.parse({ id: lower.toUpperCase() })).toEqual({ id: lower });
    expect(userIdParamsSchema.parse({ id: 'AbCdEf01-2345-4678-89aB-cDeF01234567' })).toEqual({ id: lower });
    expect(userIdParamsSchema.parse({ id: lower })).toEqual({ id: lower });
  });
});
