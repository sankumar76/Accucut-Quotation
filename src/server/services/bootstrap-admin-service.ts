import { ConflictError } from '../../lib/errors';
import type { PasswordHasher } from '../auth/password-hasher';
import type { UserRepository } from '../repositories/user-repository';

import { assertPasswordRule } from './password-policy';

/**
 * Creates the first Admin (STORY-01.01 AC-7, architecture section 8 "First Admin"): nobody can sign in until a user
 * exists, so this runs once, from `scripts/bootstrap-admin.ts`, with the e-mail and the initial password the
 * installer chose. The Admin must choose their own password at the first sign-in (`must_change_password`; the
 * redirect that enforces it is story 01.05).
 *
 * It refuses, and changes nothing, when any Admin exists, active or not. The password is hashed here and is never
 * logged, returned or put in an error. A password that does not meet the rule (FR-098, BR-049) is refused before anything is read or
 * written (STORY-01.05 AC-4): a 422 `PASSWORD_RULE` error that names the failing part, and no Admin is created.
 */

/** The display name of the first Admin; they can be renamed later (story 01.04). */
export const FIRST_ADMIN_NAME = 'Administrator';

export const ADMIN_EXISTS_CODE = 'ADMIN_EXISTS';

export interface BootstrapAdminInput {
  readonly email: string;
  readonly password: string;
}

export interface BootstrapAdminDependencies {
  readonly users: UserRepository;
  readonly hasher: PasswordHasher;
}

/** Returns the new Admin's ID. Throws `ConflictError` (code `ADMIN_EXISTS`) if an Admin already exists. */
export async function bootstrapAdmin(
  { email, password }: BootstrapAdminInput,
  { users, hasher }: BootstrapAdminDependencies,
): Promise<string> {
  assertPasswordRule(password, { email, subject: 'other', field: 'ADMIN_INITIAL_PASSWORD' });
  if (await users.hasAnyAdmin()) {
    throw new ConflictError('An Admin already exists. Nothing was changed.', { code: ADMIN_EXISTS_CODE });
  }
  // Hashed after the check, so a refused run does no work. Two runs at once cannot both create an Admin: the
  // partial unique index on active Admins refuses the second insert.
  const passwordHash = await hasher.hash(password);
  return users.create({ name: FIRST_ADMIN_NAME, email, passwordHash, role: 'ADMIN', mustChangePassword: true });
}
