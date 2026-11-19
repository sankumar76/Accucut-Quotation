import { assertNever } from '../../lib/assert-never';
import { ConflictError, FieldValidationError, ForbiddenError, NotFoundError } from '../../lib/errors';
import {
  APPROVAL_ALREADY_CANCELLED_CODE,
  APPROVAL_ALREADY_CANCELLED_MESSAGE,
  APPROVAL_CHANGED_CODE,
  APPROVAL_CHANGED_MESSAGE,
  CANCEL_CUSTOMER_DELETED_MESSAGE,
  CANCEL_MATERIAL_DELETED_MESSAGE,
  checkCancelReason,
  NO_APPROVAL_TO_CANCEL_CODE,
  NO_APPROVAL_TO_CANCEL_MESSAGE,
} from '../../lib/estimate/cancel-words';
import type { EstimateStatus } from '../../lib/estimate/state-machine';
import type { ApprovalCancelling } from '../repositories/approval-repository';
import type { EstimateUnlocking } from '../repositories/estimate-repository';
import type { TransactionRunner } from '../repositories/transaction';

import type { DeletedWords } from './calculation-masters';
import type { AuditContext, AuditService } from './audit-service';
import { assertCustomerAndMaterialsExist } from './deleted-masters';
import type { EstimateService, EstimateViewer } from './estimate-service';
import type { StepUpService } from './step-up-service';

/**
 * Cancel approval (STORY-06.12; FR-107, FR-038; D-29; NFR-001, NFR-004, NFR-007; architecture sections 4.4, 4.8, 4.10 and 6 "Cancel approval"): the Admin, and only the Admin, cancels an approval with a reason and their
 * password. The approved price **stays on screen**, marked "Approval cancelled", until the Admin removes it (STORY-06.13) or a new approval replaces it; it leaves the Excel file (STORY-07.03).
 *
 * **Two cases, one request.** On an APPROVED estimate it does what Unlock does: the estimate goes to DRAFT through the state machine and its task is open again (derived from the status, never stored). On a DRAFT or SUBMITTED
 * estimate whose latest approval was kept through an unlock (AC-10; delivery lead decision, 2026-11-15) the **status and the task do not change**; the cancel is stored and audited the same way, and the audit entry holds the
 * status before and after, so it shows that nothing moved.
 *
 * **The order of the checks** (AC-3 to AC-5, AC-9): the role (Admin only: a Lead or an Engineer is 403 before anything is read), the reason (422 under `reason`; it is the Admin's own text, so it costs no read and no
 * password attempt), the password (`verifyStepUp`, **in the same request** and before the transaction, so the slow hash never holds the estimate's row lock: 422 `STEP_UP_FAILED`, 429 `STEP_UP_LOCKED`; the session
 * stays valid, and the attempts are the step-up's), then, **under the estimate's row lock in one transaction**: the estimate exists (404), the customer and the materials its parts name are still there (409
 * `CUSTOMER_DELETED`, `MATERIAL_DELETED`: the check Unlock shares, `deleted-masters.ts`), the estimate has an approval (409), it is the one the request names (409 `APPROVAL_CHANGED`) and it is not cancelled already (409).
 * Passing all of them the write is made **in that transaction**: the status (`transition`, which locks again; a lock the transaction already holds is re-entrant, and a transition that keeps the status writes none), the
 * cancel stored on the approval (who, when, why: `markCancelled`, the cancel columns only) and the audit entry `approval.cancelled`, together or none. A refusal writes nothing, not even an audit entry: an entry records what
 * was done (NFR-007).
 *
 * **Exactly one cancel** (AC-5): two requests at once queue on the estimate's lock; the second finds the approval cancelled and is the 409. The row's own "not yet cancelled" test and the write-once trigger are the backstops.
 *
 * **The password** is read by `verifyStepUp` and nothing else. It is not in the audit context, the audit entry, an error, a log line or an answer (AC-7); this file never copies it anywhere but into that one call.
 *
 * **Lock order** is the writers' own: the estimate, then its task (`lockEstimate`), then the customer, then the materials in ascending ID order; a customer or a material delete never forms a cycle with it.
 *
 * **Restricted** (ADR-008, NFR-002): it reads and writes the approval, so it is blocked for every Engineer view (`tests/security/engineer-import-rule.test.ts`) and only its route, for the Admin alone, asks for it.
 */

/** What the body of `POST /api/v1/estimates/{id}/approval/cancel` carries once the route has parsed it, and who sent it. */
export interface CancelApprovalRequest {
  /** The approval the Admin saw on the page (BO). It must still be the latest, or the request is 409 `APPROVAL_CHANGED`. */
  readonly approvalId: string;
  /** The Admin's reason as typed; the service trims it and judges it (1 to 500 characters). */
  readonly reason: string;
  /** The Admin's password, for the step-up check and for nothing else. */
  readonly password: string;
  /** Who cancelled and on which request, for the audit entry (`actorLabel` is their name now). Always given by the route. It never holds the password. */
  readonly audit: AuditContext;
}

/** What a cancel answers (NFR-002): the status the estimate has now and when. No figure, no master value, no ID, no password. */
export interface CancelApprovalResult {
  /** DRAFT when an approved estimate went back to Draft; the status it already had (DRAFT or SUBMITTED) when it did not move. */
  readonly status: Exclude<EstimateStatus, 'APPROVED'>;
  /** UTC, ISO 8601, the database's clock. */
  readonly cancelledAt: string;
}

export interface CancelApprovalService {
  /**
   * Cancels an approval. Throws, in this order: `ForbiddenError` (not the Admin), `FieldValidationError` (`reason`, 422), `StepUpFailed` (422), `StepUpLocked` (429), `NotFoundError` (no such estimate, or an ID that is
   * none), `CUSTOMER_DELETED`, `MATERIAL_DELETED`, `NO_APPROVAL_TO_CANCEL`, `APPROVAL_CHANGED`, `APPROVAL_ALREADY_CANCELLED` (all 409). Every refusal writes nothing. Passing all of them it writes the status (when it moves),
   * the cancel and the audit entry together, or none.
   */
  cancel(viewer: EstimateViewer, estimateId: string, request: CancelApprovalRequest): Promise<CancelApprovalResult>;
}

export interface CancelApprovalDependencies {
  readonly estimates: EstimateUnlocking;
  readonly approvals: ApprovalCancelling;
  readonly transactions: TransactionRunner;
  /** The password check of STORY-06.14, called in the request of the cancel before the transaction. */
  readonly stepUp: Pick<StepUpService, 'verifyStepUp'>;
  /** What the write needs of the rest of the system: the state machine's move (`transition`, in the caller's transaction) and the audit trail. */
  readonly workflow: { readonly transition: EstimateService['transition']; readonly audit: AuditService };
}

/** The role check, first and alone: it reads nothing, so a role that may never cancel learns nothing about any estimate (CR-33, NFR-002). Closed by `assertNever`, so a role added one day is refused until decided. */
export function assertMayCancel(viewer: Pick<EstimateViewer, 'role'>): void {
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

const CANCEL_WORDS: DeletedWords = { customer: CANCEL_CUSTOMER_DELETED_MESSAGE, material: CANCEL_MATERIAL_DELETED_MESSAGE };

export function createCancelApprovalService({ estimates, approvals, transactions, stepUp, workflow }: CancelApprovalDependencies): CancelApprovalService {
  return {
    // `async`, so every refusal, the role's included, is a rejected promise and never a throw before one (a caller that handles the promise sees them all alike).
    async cancel(viewer, estimateId, request) {
      assertMayCancel(viewer);
      const checked = checkCancelReason(request.reason);
      if (!checked.ok) throw new FieldValidationError([{ field: 'reason', message: checked.message }]);
      // The person is the signed-in one, never a name in the body; the password goes to this one call. A wrong or blocked step-up ends here, before anything is read or locked.
      await stepUp.verifyStepUp({ user: { id: viewer.id }, requestId: request.audit.requestId }, request.password);
      return await transactions.run(async (tx) => {
        const estimate = await estimates.lockEstimate(estimateId, tx);
        if (estimate === null) throw new NotFoundError();
        // The customer, then the materials in ascending ID order, each `FOR SHARE` after the estimate's and the task's lock (AC-9): the check Unlock shares, in the cancel's words. The state machine's own decision for
        // CANCEL is made by `transition` below, under the same lock; it allows the Admin in every status (AC-10), so there is no status for this check to wait for.
        await assertCustomerAndMaterialsExist(estimates, estimate, tx, CANCEL_WORDS);
        const latest = await approvals.findLatestForCancel(estimate.id, tx);
        if (latest === null) throw new ConflictError(NO_APPROVAL_TO_CANCEL_MESSAGE, { code: NO_APPROVAL_TO_CANCEL_CODE });
        // IDs are compared without regard to case, as PostgreSQL's `uuid` type does.
        if (latest.id.toLowerCase() !== request.approvalId.toLowerCase()) throw new ConflictError(APPROVAL_CHANGED_MESSAGE, { code: APPROVAL_CHANGED_CODE });
        if (latest.cancelledAt !== null) throw new ConflictError(APPROVAL_ALREADY_CANCELLED_MESSAGE, { code: APPROVAL_ALREADY_CANCELLED_CODE });
        // The write, in this transaction and in this order: the status (the machine decides under the same lock; DRAFT and SUBMITTED stay as they are and write nothing), the cancel, the entry. Any of them failing takes the others back.
        const moved = await workflow.transition(viewer, estimate.id, 'CANCEL', tx);
        // The machine's CANCEL leads to DRAFT from APPROVED and stays put from the other two, so the estimate is never APPROVED afterwards; the check keeps a changed table from answering a status that is not one of the two.
        if (moved.to === 'APPROVED') throw new Error('A cancelled approval would leave the estimate APPROVED.');
        const cancelledAt = await approvals.markCancelled({ approvalId: latest.id, cancelledById: viewer.id, reason: checked.reason }, tx);
        // The lock makes this impossible (the approval was not cancelled a moment ago); the check keeps a skipped lock from recording a cancel that was not stored.
        if (cancelledAt === null) throw new Error('The approval was no longer open to cancel when it was cancelled.');
        await workflow.audit.record(tx, {
          event: 'approval.cancelled',
          ...request.audit,
          object: { id: estimate.id, label: estimate.taskCode },
          before: { approvedPrice: latest.approvedPrice, status: moved.from },
          after: { reason: checked.reason, status: moved.to },
        });
        return { status: moved.to, cancelledAt: cancelledAt.toISOString() };
      });
    },
  };
}
