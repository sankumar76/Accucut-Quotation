import { createPasswordHasher, type PasswordHasher } from '../../../src/server/auth/password-hasher';
import type { NewUser, UserRepository, UserRole } from '../../../src/server/repositories/user-repository';

/**
 * Invented users for tests (test strategy: builders, no real person, no real e-mail, no real password). E-mail
 * addresses use the reserved `.test` domain. The password is a fixed invented sentence, never used anywhere else.
 */

export const TEST_PASSWORD = 'invented-test-password-for-aqp-38';

/** An argon2id cost small enough that a test hashes in a few milliseconds. The format and the algorithm are the same. */
export const TEST_HASH_COST = { memoryCost: 64, timeCost: 1, parallelism: 1 } as const;

export function createTestHasher(): PasswordHasher {
  return createPasswordHasher(TEST_HASH_COST);
}

let counter = 0;

export interface UserOverrides {
  readonly name?: string;
  readonly email?: string;
  readonly role?: UserRole;
  readonly mustChangePassword?: boolean;
  readonly password?: string;
}

/** A user ready to insert: a unique invented e-mail, and the hash of `TEST_PASSWORD` unless another is given. */
export async function buildUser(hasher: PasswordHasher, overrides: UserOverrides = {}): Promise<NewUser> {
  counter += 1;
  return {
    name: overrides.name ?? `Invented Person ${counter}`,
    email: overrides.email ?? `person${counter}@example.test`,
    passwordHash: await hasher.hash(overrides.password ?? TEST_PASSWORD),
    role: overrides.role ?? 'ENGINEER',
    mustChangePassword: overrides.mustChangePassword ?? false,
  };
}

/** Builds and inserts a user; returns its ID and e-mail. */
export async function insertUser(
  users: UserRepository,
  hasher: PasswordHasher,
  overrides: UserOverrides = {},
): Promise<{ readonly id: string; readonly email: string }> {
  const user = await buildUser(hasher, overrides);
  const id = await users.create(user);
  return { id, email: user.email };
}
