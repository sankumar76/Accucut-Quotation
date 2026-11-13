import { CURRENT_PASSWORD_WRONG_MESSAGE, NEW_PASSWORD_SAME_MESSAGE, TOO_MANY_CHANGE_ATTEMPTS_MESSAGE } from '../../lib/auth/change-password';
import {
  ConflictError,
  CURRENT_PASSWORD_WRONG_CODE,
  FieldValidationError,
  NotFoundError,
  PASSWORD_RULE_CODE,
  TooManyAttemptsError,
} from '../../lib/errors';
import type { Clock } from '../../lib/time';
import type { PasswordHasher } from '../auth/password-hasher';
import { passwordChangeThrottleKey } from '../auth/throttle-key';
import type { AttemptPolicy, ThrottleRepository } from '../repositories/throttle-repository';
import type { UserRepository } from '../repositories/user-repository';

import { THROTTLE_POLICY } from './auth-service';
import { assertPasswordRule } from './password-policy';

/**
 * The person's own account (STORY-01.05; FR-002, FR-004; architecture sections 6 and 8): change your own password with the current one.
 *
 * In this order, and each step costs more than the one before it:
 *   1. the password rule on the new password (FR-098), which names the part that failed and makes no hash;
 *   2. the change-attempt throttle (AC-6, assumption A-2): the sixth attempt after five wrong current passwords is refused for 15
 *      minutes, on a key of its own (`password-change`), so a mistyped current password can never lock the person out of signing in;
 *   3. the current password is checked against the stored hash (a wrong one is a 422 under its own field, never a 401, which a screen
 *      reads as a lost session);
 *   4. a new password equal to the current one is refused (422 under `newPassword`, FR-004: a password the Admin gave is only used once), so
 *      the flag cannot be cleared by typing the temporary password again; no hash is made and nothing changes;
 *   5. the new password is hashed and stored, `must_change_password` is cleared and `session_version` is raised, in one statement, so
 *      every token issued before is refused (AC-3). The caller then issues the current browser a fresh session at the new version.
 *
 * The password, its hash and the current password are never logged, returned or put in an error. No audit entry is written for a person
 * changing their own password: the audit log names changes the Admin makes (STORY-01.07; recorded as an open question of STORY-01.05).
 */

export const PASSWORD_CHANGED_ELSEWHERE_CODE = 'PASSWORD_CHANGED_ELSEWHERE';
export const PASSWORD_CHANGED_ELSEWHERE_MESSAGE =
  'Your password was just changed somewhere else. Enter the newest password as your current password and try again.';

/** Five consecutive wrong current passwords block the form for 15 minutes (AC-6). The numbers are the sign-in account policy's, written once. */
const CHANGE_POLICY: AttemptPolicy = {
  limit: THROTTLE_POLICY.accountFailureLimit,
  windowMilliseconds: null,
  blockMilliseconds: THROTTLE_POLICY.blockMilliseconds,
};

export interface ChangePasswordInput {
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface ChangePasswordResult {
  /** The person's `session_version` after the change: the fresh session is issued at it. */
  readonly sessionVersion: number;
}

export interface AccountServiceDependencies {
  readonly users: UserRepository;
  readonly throttles: ThrottleRepository;
  readonly hasher: PasswordHasher;
  readonly clock: Clock;
  /** The key that makes the throttle hashes unguessable (`AUTH_SECRET`). */
  readonly keySecret: string;
}

export interface AccountService {
  /**
   * Changes the signed-in person's own password. Throws 422 `PASSWORD_RULE` (under `newPassword`), 422 `CURRENT_PASSWORD_WRONG` (under
   * `currentPassword`), 429 `TOO_MANY_ATTEMPTS`, or 409 `PASSWORD_CHANGED_ELSEWHERE` when the stored password changed meanwhile.
   */
  changePassword(userId: string, input: ChangePasswordInput): Promise<ChangePasswordResult>;
}

export function createAccountService({ users, throttles, hasher, clock, keySecret }: AccountServiceDependencies): AccountService {
  /** Checks the current password against the stored hash. A fault of ours gives the attempt back: it never counts against the person. */
  async function checkCurrent(userId: string, currentPassword: string, key: string): Promise<{ readonly storedHash: string; readonly matches: boolean }> {
    try {
      const stored = await users.findCredentialsById(userId);
      if (stored === null) throw new NotFoundError('User not found.');
      return { storedHash: stored.passwordHash, matches: await hasher.verify(stored.passwordHash, currentPassword) };
    } catch (error) {
      await throttles.releaseAttempt(key).catch(() => undefined);
      throw error;
    }
  }

  return {
    async changePassword(userId, { currentPassword, newPassword }) {
      const account = await users.findAccountById(userId);
      if (account === null) throw new NotFoundError('User not found.');
      assertPasswordRule(newPassword, { email: account.email, subject: 'self', field: 'newPassword' });

      const key = passwordChangeThrottleKey(keySecret, account.id);
      const reserved = await throttles.reserveAttempt(key, CHANGE_POLICY, clock.now());
      if (reserved.attempts > CHANGE_POLICY.limit) throw new TooManyAttemptsError(TOO_MANY_CHANGE_ATTEMPTS_MESSAGE);

      const { storedHash, matches } = await checkCurrent(account.id, currentPassword, key);
      if (!matches) {
        throw new FieldValidationError([{ field: 'currentPassword', message: CURRENT_PASSWORD_WRONG_MESSAGE }], { code: CURRENT_PASSWORD_WRONG_CODE });
      }

      // The right current password ends the run of failures.
      await throttles.clear(key);
      if (newPassword === currentPassword) {
        throw new FieldValidationError([{ field: 'newPassword', message: NEW_PASSWORD_SAME_MESSAGE }], { code: PASSWORD_RULE_CODE });
      }
      const newHash = await hasher.hash(newPassword);
      const sessionVersion = await users.changeOwnPassword(account.id, storedHash, newHash);
      if (sessionVersion === null) {
        throw new ConflictError(PASSWORD_CHANGED_ELSEWHERE_MESSAGE, { code: PASSWORD_CHANGED_ELSEWHERE_CODE });
      }
      return { sessionVersion };
    },
  };
}
