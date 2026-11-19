import { ActiveAdminExistsError, ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import {
  CANNOT_HAND_OVER_TO_SELF_CODE,
  CANNOT_HAND_OVER_TO_SELF_MESSAGE,
  HAND_OVER_TARGET_INACTIVE_CODE,
  HAND_OVER_TARGET_INACTIVE_MESSAGE,
  HAND_OVER_TARGET_UNKNOWN_MESSAGE,
} from '../../lib/users/hand-over';
import type { TransactionRunner } from '../repositories/transaction';
import { UserConstraintError, type UserRepository } from '../repositories/user-repository';

import type { AuditContext, AuditService } from './audit-service';
import type { StepUpService } from './step-up-service';

/**
 * The Admin hand-over (STORY-01.09; FR-006, FR-004, FR-011; NFR-004, NFR-007; BR-005; CONSTRAINT-04; architecture sections 5.1, 6 "Hand over Admin" and 8): the one change that moves the top role. The
 * Admin hands the role to another active person, a Lead or an Engineer (decision D-h), and becomes a Lead. The portal always has exactly one active Admin, and the database holds that rule
 * (`uq_users_single_active_admin`, including for direct SQL), so this file's job is to make the swap in an order and a transaction that never breaks it.
 *
 * **The order of the checks** (AC-2, AC-5): the role (Admin only, 403 before anything is read: `withRoute` and the manifest), the body (422), **the password** (`verifyStepUp`, **in the same request** and
 * before the transaction, so the slow hash never holds a row lock: 422 `STEP_UP_FAILED`, 429 `STEP_UP_LOCKED`, on the step-up's own throttle key), a target that is the caller (409), then, **in one
 * transaction with both rows locked**: the caller is still the active Admin (403: another hand-over won), the target exists (404) and is active (409). The password is the **signed-in person's own**: it is
 * judged against the caller's stored hash, and there is no parameter that could name another person.
 *
 * **One transaction, no moment with zero or two Admins** (AC-3, AC-7, AC-8): the caller's row and the target's are locked `FOR UPDATE` in **ascending ID order** (architecture section 8), whoever asked, so two
 * hand-overs, or a hand-over and an edit of either person, queue on the rows and never wait on each other in a circle. Under the locks the Admin becomes a Lead **first** and the target the Admin **second**
 * (`UserRepository.handOverAdmin`), both people's `session_version` is raised (the old Admin is signed out; the new Admin signs in again to hold the role), and the audit entry is written in the same
 * transaction. Another session sees the old state or the new one, never a state in between; if any step fails, nothing is kept: no role, no session change, no entry. Two requests at once from the Admin
 * queue on the caller's row: the second finds the caller a Lead and is refused 403.
 *
 * **One entry** (AC-4, decision D-h): `user.admin_handed_over`, by the old Admin, naming both people by ID and by name at the time. Not two `user.role_changed` entries, which would split one act. Neither
 * the entry, an error nor a log line holds the password (AC-9): it is handed to `verifyStepUp` and to nothing else. A hand-over sets no password, so `must_change_password` is untouched.
 */

export interface AdminHandoverDependencies {
  readonly users: UserRepository;
  /** Opens the transaction that the swap and its audit entry share. */
  readonly transactions: TransactionRunner;
  readonly audit: Pick<AuditService, 'record'>;
  /** The password check of STORY-06.14, called in the request of the hand-over before the transaction. */
  readonly stepUp: Pick<StepUpService, 'verifyStepUp'>;
}

export interface AdminHandoverService {
  /**
   * Hands the Admin role from the caller (`context.actorId`, the signed-in Admin) to `targetId`. Throws, in this order: `StepUpFailed` (422), `StepUpLocked` (429), `ConflictError`
   * `CANNOT_HAND_OVER_TO_SELF` (409), `ForbiddenError` (the caller is no longer the active Admin), `NotFoundError` (no such person), `ConflictError` `HAND_OVER_TARGET_INACTIVE` (409). Every refusal changes
   * and records nothing. `targetId` is a UUID in lower case (the route's schema).
   */
  handOver(context: AuditContext, targetId: string, password: string): Promise<void>;
}

/** PostgreSQL's `uuid` type ignores letter case, so two spellings of one ID are one person (found by the review of AQP-65). */
function isSamePerson(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** The two IDs in ascending order, the order PostgreSQL sorts a `uuid` in (architecture section 8: row locks in ascending `id` order). */
function inAscendingOrder(first: string, second: string): readonly [string, string] {
  const [a, b] = [first.toLowerCase(), second.toLowerCase()];
  return a < b ? [a, b] : [b, a];
}

export function createAdminHandoverService({ users, transactions, audit, stepUp }: AdminHandoverDependencies): AdminHandoverService {
  return {
    async handOver(context, targetId, password) {
      // The person is the signed-in one, never a name in the body; the password goes to this one call. A wrong or blocked step-up ends here, before anything is read or locked.
      await stepUp.verifyStepUp({ user: { id: context.actorId }, requestId: context.requestId }, password);
      if (isSamePerson(context.actorId, targetId)) {
        throw new ConflictError(CANNOT_HAND_OVER_TO_SELF_MESSAGE, { code: CANNOT_HAND_OVER_TO_SELF_CODE });
      }

      try {
        await transactions.run(async (tx) => {
          // Both rows, locked in ascending ID order whichever of the two is the caller. A row that does not exist (an unknown target) locks nothing and reads as null.
          const [low, high] = inAscendingOrder(context.actorId, targetId);
          const lowRow = await users.findAccountForUpdate(low, tx);
          const highRow = await users.findAccountForUpdate(high, tx);
          const [admin, target] = isSamePerson(low, context.actorId) ? [lowRow, highRow] : [highRow, lowRow];

          // The session said Admin a moment ago; the locked row says what is true now (a hand-over that won, a deactivation). A person who is not the active Admin has nothing to hand over.
          if (admin === null || admin.role !== 'ADMIN' || !admin.isActive) throw new ForbiddenError();
          if (target === null) throw new NotFoundError(HAND_OVER_TARGET_UNKNOWN_MESSAGE);
          if (!target.isActive) throw new ConflictError(HAND_OVER_TARGET_INACTIVE_MESSAGE, { code: HAND_OVER_TARGET_INACTIVE_CODE });

          // Down first, up second, both sessions ended, in the caller's transaction. False means a statement matched no row, which the locks make impossible: it is a fault and rolls everything back.
          if (!(await users.handOverAdmin({ fromAdminId: admin.id, toUserId: target.id }, tx))) {
            throw new Error('The Admin role could not be handed over.');
          }
          await audit.record(tx, {
            event: 'user.admin_handed_over',
            ...context,
            object: { id: target.id, label: target.name },
            before: { adminId: admin.id, adminName: admin.name },
            after: { adminId: target.id, adminName: target.name },
          });
        });
      } catch (error) {
        // The index is the last word on one Admin: a write it refuses, because another change won, is the one-Admin answer.
        if (error instanceof UserConstraintError && error.constraint === 'single-active-admin') {
          throw new ActiveAdminExistsError(await users.findActiveAdmin());
        }
        throw error;
      }
    },
  };
}
