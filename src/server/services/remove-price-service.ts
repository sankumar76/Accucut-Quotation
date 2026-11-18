import { assertNever } from '../../lib/assert-never';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { APPROVAL_CHANGED_CODE, APPROVAL_CHANGED_MESSAGE } from '../../lib/estimate/cancel-words';
import {
  APPROVAL_NOT_CANCELLED_CODE,
  APPROVAL_NOT_CANCELLED_MESSAGE,
  NO_PRICE_TO_REMOVE_CODE,
  NO_PRICE_TO_REMOVE_MESSAGE,
  PRICE_ALREADY_REMOVED_CODE,
  PRICE_ALREADY_REMOVED_MESSAGE,
} from '../../lib/estimate/remove-price-words';
import type { ApprovalRemoving } from '../repositories/approval-repository';
import type { EstimateLocking } from '../repositories/estimate-repository';
import type { TransactionRunner } from '../repositories/transaction';

import type { AuditContext, AuditService } from './audit-service';
import type { EstimateViewer } from './estimate-service';
import type { StepUpService } from './step-up-service';

/**
 * Remove price (STORY-06.13; FR-108, D-29; NFR-001, NFR-004, NFR-007; architecture sections 4.10 and 6 "Remove price"): step 2 of two. The Admin, and only the Admin, removes the price of an approval that was
 * **cancelled** (STORY-06.12), with their password. BO then reads "Not set yet" on every screen, and the Excel file's BO2 is empty (STORY-07.03). **The price is not erased**: the `approvals` row and its calculation stay, the
 * runtime role has no grant on an approve column and a trigger refuses a change of one, and the audit entry `approval.price_removed` **keeps the price**, readable by the Admin alone (erasing it there would break NFR-007).
 * Nothing serves the price to a screen afterwards: `findLatestApproval` answers `null` for a latest row that was removed.
 *
 * **A separate request from the cancel** (AC-2): no single call does both. It does not move the estimate: the cancel already took an approved estimate back to Draft, so the status, the task and the figures are as they were.
 *
 * **The order of the checks** (AC-3 to AC-5): the role (Admin only: a Lead or an Engineer is 403 before anything is read), the password (`verifyStepUp`, **in the same request** and before the transaction, so the slow hash
 * never holds the estimate's row lock: 422 `STEP_UP_FAILED`, 429 `STEP_UP_LOCKED`; the session stays valid, and the attempts are the step-up's), then, **under the estimate's row lock in one transaction**: the estimate exists
 * (404), it has an approval (409), it is the one the request names (409 `APPROVAL_CHANGED`: only the latest can be removed), its price was not removed already (409), and it was cancelled (409). The answer about the request
 * comes first: the removal, unlike the cancel, reads no customer and no material, so there is no check that could answer before the approval's own (SQR-03 of AQP-329). Passing all of them the write is made **in that
 * transaction**: the removal stored on the approval (who, when: `markRemoved`, the remove columns only) and the audit entry `approval.price_removed`, together or none. A refusal writes nothing, not even an audit entry: an
 * entry records what was done (NFR-007).
 *
 * **Exactly one removal** (AC-5): two requests at once queue on the estimate's lock; the second finds the price removed and is the 409. The row's own "cancelled and not yet removed" test and the write-once trigger are the backstops.
 *
 * **The password** is read by `verifyStepUp` and nothing else. It is not in the audit context, the audit entry, an error, a log line or an answer (AC-7); this file never copies it anywhere but into that one call.
 *
 * **The answer** is `{removedAt}` and nothing else: the price is in no answer (AC-6), and the Admin saw it on the page they pressed the button on.
 *
 * **Restricted** (ADR-008, NFR-002): it reads the approval's price (for the audit entry), so it is blocked for every Engineer view (`tests/security/engineer-import-rule.test.ts`) and only its route, for the Admin alone, asks for it.
 */

/** What the body of `POST /api/v1/estimates/{id}/approval/remove-price` carries once the route has parsed it, and who sent it. */
export interface RemovePriceRequest {
  /** The approval the Admin saw on the page (BO, cancelled). It must still be the latest, or the request is 409 `APPROVAL_CHANGED`. */
  readonly approvalId: string;
  /** The Admin's password, for the step-up check and for nothing else. */
  readonly password: string;
  /** Who removed it and on which request, for the audit entry (`actorLabel` is their name now). Always given by the route. It never holds the password. */
  readonly audit: AuditContext;
}

/** What a removal answers (NFR-002): when. No price, no figure, no master value, no ID, no password. */
export interface RemovePriceResult {
  /** UTC, ISO 8601, the database's clock. */
  readonly removedAt: string;
}

export interface RemovePriceService {
  /**
   * Removes the price of a cancelled approval. Throws, in this order: `ForbiddenError` (not the Admin), `StepUpFailed` (422), `StepUpLocked` (429), `NotFoundError` (no such estimate, or an ID that is none),
   * `NO_PRICE_TO_REMOVE`, `APPROVAL_CHANGED`, `PRICE_ALREADY_REMOVED`, `APPROVAL_NOT_CANCELLED` (all 409). Every refusal writes nothing. Passing all of them it writes the removal and the audit entry together, or none.
   */
  removePrice(viewer: EstimateViewer, estimateId: string, request: RemovePriceRequest): Promise<RemovePriceResult>;
}

export interface RemovePriceDependencies {
  readonly estimates: EstimateLocking;
  readonly approvals: ApprovalRemoving;
  readonly transactions: TransactionRunner;
  /** The password check of STORY-06.14, called in the request of the removal before the transaction. */
  readonly stepUp: Pick<StepUpService, 'verifyStepUp'>;
  readonly audit: AuditService;
}

/** The role check, first and alone: it reads nothing, so a role that may never remove a price learns nothing about any estimate (CR-33, NFR-002). Closed by `assertNever`, so a role added one day is refused until decided. */
export function assertMayRemovePrice(viewer: Pick<EstimateViewer, 'role'>): void {
  switch (viewer.role) {
    case 'ADMIN':
      return;
    case 'LEAD':
    case 'ENGINEER':
      throw new ForbiddenError();
    default:
      return assertNever(viewer.role, 'role');
  }
}

export function createRemovePriceService({ estimates, approvals, transactions, stepUp, audit }: RemovePriceDependencies): RemovePriceService {
  return {
    // `async`, so every refusal, the role's included, is a rejected promise and never a throw before one (a caller that handles the promise sees them all alike).
    async removePrice(viewer, estimateId, request) {
      assertMayRemovePrice(viewer);
      // The person is the signed-in one, never a name in the body; the password goes to this one call. A wrong or blocked step-up ends here, before anything is read or locked.
      await stepUp.verifyStepUp({ user: { id: viewer.id }, requestId: request.audit.requestId }, request.password);
      return await transactions.run(async (tx) => {
        const estimate = await estimates.lockEstimate(estimateId, tx);
        if (estimate === null) throw new NotFoundError();
        const latest = await approvals.findLatestForRemoval(estimate.id, tx);
        if (latest === null) throw new ConflictError(NO_PRICE_TO_REMOVE_MESSAGE, { code: NO_PRICE_TO_REMOVE_CODE });
        // IDs are compared without regard to case, as PostgreSQL's `uuid` type does.
        if (latest.id.toLowerCase() !== request.approvalId.toLowerCase()) throw new ConflictError(APPROVAL_CHANGED_MESSAGE, { code: APPROVAL_CHANGED_CODE });
        if (latest.removedAt !== null) throw new ConflictError(PRICE_ALREADY_REMOVED_MESSAGE, { code: PRICE_ALREADY_REMOVED_CODE });
        if (latest.cancelledAt === null) throw new ConflictError(APPROVAL_NOT_CANCELLED_MESSAGE, { code: APPROVAL_NOT_CANCELLED_CODE });
        // The write, in this transaction: the removal, then the entry that keeps the price. Either failing takes the other back.
        const removedAt = await approvals.markRemoved({ approvalId: latest.id, removedById: viewer.id }, tx);
        // The lock makes this impossible (the price was not removed a moment ago and the approval was cancelled); the check keeps a skipped lock from recording a removal that was not stored.
        if (removedAt === null) throw new Error('The price was no longer open to remove when it was removed.');
        await audit.record(tx, {
          event: 'approval.price_removed',
          ...request.audit,
          object: { id: estimate.id, label: estimate.taskCode },
          before: { approvedPrice: latest.approvedPrice },
          after: null,
        });
        return { removedAt: removedAt.toISOString() };
      });
    },
  };
}
