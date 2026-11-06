import { ActiveAdminExistsError, ConflictError, FieldValidationError, NotFoundError } from '../../lib/errors';
import type { PasswordHasher } from '../auth/password-hasher';
import { accountThrottleKey } from '../auth/throttle-key';
import type { ThrottleRepository } from '../repositories/throttle-repository';
import {
  normaliseEmail,
  UserConstraintError,
  type UserChanges,
  type UserRepository,
  type UserRole,
  type UserSummary,
} from '../repositories/user-repository';

/**
 * User management by the Admin (STORY-01.04; FR-004, FR-005; architecture sections 5.1, 6 and 8): add, edit, deactivate,
 * activate and reset the password of a person. Who may call it is decided before it is reached (`withRoute`, the manifest);
 * this file holds the rules that stay true whoever asks:
 *
 *   - **One active Admin** (AC-3, CONSTRAINT-04). The service looks first, so the answer can name the current Admin, but the
 *     partial unique index decides: a write the index refuses, because another request won the race, gives the same answer.
 *   - **The Admin cannot lock themself out** (AC-4, architecture section 8 "Admin guards"): not their own deactivation, not
 *     their own role. A server rule; a disabled button is not enough.
 *   - **A password the Admin sets is temporary** (AC-1, AC-5, FR-004): it is stored as an argon2id hash only, `must_change_password`
 *     is set (the forced page is story 01.05), a reset ends the person's open sessions and lifts their sign-in block.
 *     The password rule (FR-098) is story 01.05's; until then a non-empty password is accepted (assumption A-1).
 *
 * Each change is one method here and one repository call, so story 01.07 adds its audit entry in the same place and, with the
 * repository's transaction, in the same transaction (assumption A-2). Nothing in a result or an error carries a password or
 * its hash.
 */

export const EMAIL_TAKEN_CODE = 'EMAIL_TAKEN';
export const EMAIL_TAKEN_MESSAGE = 'A user with this e-mail already exists.';
export const CANNOT_CHANGE_OWN_ROLE_CODE = 'CANNOT_CHANGE_OWN_ROLE';
export const CANNOT_DEACTIVATE_OWN_ACCOUNT_CODE = 'CANNOT_DEACTIVATE_OWN_ACCOUNT';
export const CANNOT_RESET_OWN_PASSWORD_CODE = 'CANNOT_RESET_OWN_PASSWORD';
const USER_NOT_FOUND_MESSAGE = 'User not found.';

export interface NewUserInput {
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  /** The first password, in clear. Hashed here and never kept, logged or returned. */
  readonly password: string;
}

export interface UserServiceDependencies {
  readonly users: UserRepository;
  readonly throttles: ThrottleRepository;
  readonly hasher: PasswordHasher;
  /** The key that makes the throttle hashes unguessable (`AUTH_SECRET`); a reset clears the person's account key with it. */
  readonly keySecret: string;
}

export interface UserService {
  list(): Promise<ReadonlyArray<UserSummary>>;
  create(input: NewUserInput): Promise<UserSummary>;
  /** `actorId` is the Admin making the change; `changes` has at least one field (the route's schema sees to that). */
  update(actorId: string, targetId: string, changes: UserChanges): Promise<UserSummary>;
  /** `actorId` is the Admin resetting; resetting their own password is refused (409). */
  resetPassword(actorId: string, targetId: string, password: string): Promise<void>;
}

/**
 * Is the row the database returned the caller? Compared by the row's own ID and ignoring letter case, because PostgreSQL's uuid
 * type does: an address written in capitals finds the same row, and a plain string comparison of the address with the caller's
 * ID would let the Admin past their own-account rules (found by the automated security review of AQP-65).
 */
function isSamePerson(actorId: string, rowId: string): boolean {
  return actorId.toLowerCase() === rowId.toLowerCase();
}

/** Would the person be an active Admin after the change? */
function isActiveAdmin(state: { readonly role: UserRole; readonly isActive: boolean }): boolean {
  return state.role === 'ADMIN' && state.isActive;
}

export function createUserService({ users, throttles, hasher, keySecret }: UserServiceDependencies): UserService {
  /** The refusal for a second Admin, naming whoever holds the place now (nobody is named if they cannot be read back). */
  async function activeAdminExists(): Promise<ActiveAdminExistsError> {
    return new ActiveAdminExistsError(await users.findActiveAdmin());
  }

  /** Runs a write and gives the two rules of the database their words. Any other failure passes on untouched. */
  async function withUserRules<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (!(error instanceof UserConstraintError)) throw error;
      if (error.constraint === 'email') {
        throw new FieldValidationError([{ field: 'email', message: EMAIL_TAKEN_MESSAGE }], { code: EMAIL_TAKEN_CODE, cause: error });
      }
      throw await activeAdminExists();
    }
  }

  return {
    list() {
      return users.list();
    },

    async create({ name, email, role, password }) {
      if (role === 'ADMIN' && (await users.findActiveAdmin()) !== null) throw await activeAdminExists();
      const passwordHash = await hasher.hash(password);
      const normalisedEmail = normaliseEmail(email);
      const id = await withUserRules(() =>
        users.create({ name, email: normalisedEmail, passwordHash, role, mustChangePassword: true }),
      );
      return { id, name, email: normalisedEmail, role, isActive: true };
    },

    async update(actorId, targetId, changes) {
      const target = await users.findAccountById(targetId);
      if (target === null) throw new NotFoundError(USER_NOT_FOUND_MESSAGE);

      if (isSamePerson(actorId, target.id)) {
        if (changes.role !== undefined && changes.role !== target.role) {
          throw new ConflictError('You cannot change your own role.', { code: CANNOT_CHANGE_OWN_ROLE_CODE });
        }
        if (changes.isActive === false && target.isActive) {
          throw new ConflictError('You cannot deactivate your own account.', { code: CANNOT_DEACTIVATE_OWN_ACCOUNT_CODE });
        }
      }

      const after = { role: changes.role ?? target.role, isActive: changes.isActive ?? target.isActive };
      if (isActiveAdmin(after) && !isActiveAdmin(target) && (await users.findActiveAdmin()) !== null) throw await activeAdminExists();

      const updated = await withUserRules(() => users.update(target.id, changes));
      if (updated === null) throw new NotFoundError(USER_NOT_FOUND_MESSAGE);
      return updated;
    },

    async resetPassword(actorId, targetId, password) {
      // The Admin's own password is changed with the current one, on the account page (story 01.05), not by a reset that
      // needs no proof: a stolen session could otherwise take the account over (STD-01).
      const target = await users.findAccountById(targetId);
      if (target === null) throw new NotFoundError(USER_NOT_FOUND_MESSAGE);
      if (isSamePerson(actorId, target.id)) throw new ConflictError('You cannot reset your own password here.', { code: CANNOT_RESET_OWN_PASSWORD_CODE });
      const email = await users.setPassword(target.id, await hasher.hash(password));
      if (email === null) throw new NotFoundError(USER_NOT_FOUND_MESSAGE);
      // The sign-in page tells a blocked person to ask the Admin for a reset (architecture section 6, "Rate limits").
      await throttles.clear(accountThrottleKey(keySecret, email));
    },
  };
}
