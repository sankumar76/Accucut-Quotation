import { STEP_UP_FAILED_MESSAGE, STEP_UP_LOCKED_MESSAGE } from '../../lib/auth/step-up';
import { StepUpFailed, StepUpLocked, UnauthorizedError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { Clock } from '../../lib/time';
import { PASSWORD_INPUT_CEILING } from '../../lib/users/validation';
import type { PasswordHasher } from '../auth/password-hasher';
import { stepUpThrottleKey } from '../auth/throttle-key';
import type { AttemptPolicy, ThrottleRepository } from '../repositories/throttle-repository';
import type { UserRepository } from '../repositories/user-repository';

import { STEP_UP_POLICY } from './auth-service';

/**
 * The password step-up check (STORY-06.14; FR-080, NFR-003, NFR-004, NFR-007; ADR-009; architecture sections 6 and 8): one shared check that a
 * protected action (cancel an approval, remove a price, edit a formula, hand over the Admin) makes inside its own request, before it writes
 * anything. There is no token and no second session: the password rides in the same request and is checked against the signed-in person's own
 * stored hash.
 *
 * **Whose password.** `verifyStepUp` takes the person from the session (`HandlerContext.user`) and the password as a separate argument. There is
 * no parameter that could name another person, and the service reads only that person's own hash, so nothing in a request body can choose whose
 * password is checked (AC-6).
 *
 * **Attempts are counted before the password is checked** (G6 QLT-32, copied from sign-in): the attempt reserves its number on the person's
 * `stepup` key first, the database returns the number from the same statement that adds it, and only an attempt within the limit reaches the
 * password check. Ten wrong attempts at once reach it at most five times (AC-5). A refused attempt checks nothing, and is refused even with the
 * right password until the block ends (AC-3). A right password clears the run of failures (AC-1).
 *
 * **A fault of ours never counts against the person** (AC-5): when reading the person, checking the password or ending the run fails, the reservation
 * is given back and the fault goes on to the caller (a database fault is 503). Giving it back is best effort and never hides the original fault.
 *
 * **Its own key** (AC-3, AC-4): `stepup`, apart from sign-in's account key, the change-password key and the address key, so a slip in a dialog
 * cannot lock anyone out of signing in and a blocked sign-in cannot refuse a protected action.
 *
 * **What is said** (AC-2, AC-7): `StepUpFailed` (422) for every wrong case, with one sentence; `StepUpLocked` (429) for a block. A refusal is logged
 * with the person's ID and the request ID and nothing else; the password and its hash are never logged, returned or put in an error. A pass is
 * not logged. The service writes no audit entry: the protected action that calls it records its own event, in its own transaction.
 *
 * This file holds the rules only. It knows no HTTP; `withRoute` turns the two errors into their problem bodies (`problem.ts`).
 */

const STEP_UP_ATTEMPT_POLICY: AttemptPolicy = {
  limit: STEP_UP_POLICY.failureLimit,
  windowMilliseconds: null,
  blockMilliseconds: STEP_UP_POLICY.blockMilliseconds,
};

/** What the check needs of a request: the signed-in person (never from the body) and the request ID, for the log. `HandlerContext` fits. */
export interface StepUpCaller {
  readonly user: { readonly id: string };
  readonly requestId: string;
}

export interface StepUpServiceDependencies {
  readonly users: UserRepository;
  readonly throttles: ThrottleRepository;
  readonly hasher: PasswordHasher;
  readonly clock: Clock;
  /** The key that makes the throttle hashes unguessable (`AUTH_SECRET`). */
  readonly keySecret: string;
}

export interface StepUpService {
  /**
   * Checks `password` against the stored password of `caller.user`, inside the request of a protected action. Resolves when it is right.
   * Throws `StepUpFailed` (422) when it is not, `StepUpLocked` (429) when the person's step-up is blocked, `UnauthorizedError` (401) when the
   * person is no longer an active user, and lets a fault of ours (a busy database is 503) through, having given the attempt back.
   */
  verifyStepUp(caller: StepUpCaller, password: string): Promise<void>;
}

export function createStepUpService({ users, throttles, hasher, clock, keySecret }: StepUpServiceDependencies): StepUpService {
  /** Gives the reservation back. Best effort: a second fault must never hide the first. */
  async function giveBack(key: string): Promise<void> {
    await throttles.releaseAttempt(key).catch(() => undefined);
  }

  /** True if `password` is the stored password of the person. Anything that goes wrong gives the attempt back first. */
  async function passwordIsTheirs(userId: string, password: string, key: string): Promise<boolean> {
    try {
      const stored = await users.findCredentialsById(userId);
      // The session was read a moment ago in the same request, so this is a person deactivated or removed in between: a lost session, not a wrong password.
      if (stored === null || !stored.isActive) throw new UnauthorizedError();
      // A password longer than any the portal could have stored cannot match, and is not worth an argon2 run (architecture section 8).
      if (password.length > PASSWORD_INPUT_CEILING) return false;
      return await hasher.verify(stored.passwordHash, password);
    } catch (error) {
      await giveBack(key);
      throw error;
    }
  }

  return {
    async verifyStepUp({ user, requestId }, password) {
      const key = stepUpThrottleKey(keySecret, user.id);
      const reserved = await throttles.reserveAttempt(key, STEP_UP_ATTEMPT_POLICY, clock.now());
      if (reserved.attempts > STEP_UP_ATTEMPT_POLICY.limit) {
        logger.warn({ userId: user.id, requestId }, 'step-up refused: blocked');
        throw new StepUpLocked(STEP_UP_LOCKED_MESSAGE);
      }

      if (!(await passwordIsTheirs(user.id, password, key))) {
        logger.warn({ userId: user.id, requestId }, 'step-up failed');
        throw new StepUpFailed(STEP_UP_FAILED_MESSAGE);
      }

      // The right password ends the run of failures. If that fails the action is refused with the fault and the attempt is given back: the
      // password was right, so nothing is held against the person.
      try {
        await throttles.clear(key);
      } catch (error) {
        await giveBack(key);
        throw error;
      }
    },
  };
}
