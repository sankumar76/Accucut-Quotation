import { ConflictError, FieldValidationError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { isOverridePrice, validateReason } from '../../lib/estimate/approve-price';
import {
  CALCULATION_CHANGED_CODE,
  CALCULATION_CHANGED_MESSAGE,
  NOT_CALCULATED_CODE,
  NOT_CALCULATED_MESSAGE,
  TOTALS_OUT_OF_DATE_CODE,
  TOTALS_OUT_OF_DATE_MESSAGE,
} from '../../lib/estimate/approval-words';
import { assertNever } from '../../lib/assert-never';
import { figureState } from '../../lib/estimate/figure-state';
import { decideTransition, TRANSITION_REFUSALS, type EstimateStatus } from '../../lib/estimate/state-machine';
import { toTwoPlaces } from '../../lib/money';
import type { ApprovalWrites } from '../repositories/approval-repository';
import type { CalculationApprovalReads, FigureBasis } from '../repositories/calculation-repository';
import type { EstimateLocking } from '../repositories/estimate-repository';
import type { TransactionRunner } from '../repositories/transaction';

import type { AuditContext, AuditService } from './audit-service';
import type { EstimateService, EstimateViewer } from './estimate-service';

/**
 * The approval service (STORY-06.05, STORY-06.06; FR-062, FR-064, FR-101, D-20; NFR-001, NFR-007; architecture sections 4.4, 4.8 and 6 "Approve").
 *
 * **The guard** (06.05): the server refuses an approval, with a fixed sentence that names the missing step, unless the estimate is SUBMITTED, its figures are `current` and the request names the estimate's
 * current calculation. The button on SCR-06 being off is only a convenience; this is the authority. **The write** (06.06): an approval that passes the guard moves the estimate to APPROVED, stores the
 * `approvals` row (the price, the calculated total it was set against, the approver and the time) and records the audit entry `approval.approved`, **all in the one transaction that took the guard's lock**.
 *
 * **The order of the checks is the story's (06.05 AC-5):** the role (a Lead or an Admin; an Engineer is 403, before anything is read), then the estimate exists (404), then its status (the state machine's own
 * decision, so the code and sentence of "not submitted" and "already approved" are the machine's, written once), then the state of the figures, then `calculationId`. All of it runs **under the estimate's row
 * lock in one transaction**, so an input saved at the same moment either lands first (the figures are out of date, refused) or waits until the approval is over (and an input cannot change after an approval,
 * because it locks them).
 *
 * **One transaction, no second** (SQR-05 of the review of AQP-322). Every writer of an input (a save, a tree change, the customer, a picture, Calculate, Recalculate) takes the same row lock first. The write is
 * therefore made in the transaction that already holds it: `transition` (which locks again; a lock the transaction already holds is re-entrant), the insert and the audit entry follow `assertApprovable`. A
 * second transaction would lose the protection. The guard stays write-free and runs first; `transition` is never called before it. A failure anywhere, the audit entry's included, rolls the whole approval back.
 * Two approvals at once queue on the lock: the second sees APPROVED and is the machine's 409, so exactly one row is written (AC-6); the migration's one-live-approval index is the backstop.
 *
 * **The state is read the one way it is ever read** (`figureState` of `lib/estimate/figure-state.ts`, from the two counts `findFigureBasis` holds). A refusal writes nothing and records no audit entry (06.05
 * AC-8, NFR-007: an entry is the record of what was done, and nothing was). The price kept is the one the Lead sent, in rupees and paise.
 *
 * **The override (STORY-06.07; FR-103, D-18; architecture assumption A-12).** A price is an override when it differs from the calculated total **at rupees and paise**. The service decides it, never the client: it
 * reads the total itself under the lock, and both sides are the one rounding (`toTwoPlaces`), the way the dialog pre-fills, so a Lead who accepts the pre-filled price is not recorded as an override
 * (`isOverridePrice`). The flag and the reason are written **at insert, in this same transaction after the guard**: the approvals trigger forbids a change of an approved column afterwards, so there is no second
 * write path and none could be added. The reason is optional, trimmed and at most 500 characters by the shared text rule (the route has checked it; the service checks it again, so another caller cannot keep a
 * hidden character or an over-long text), and it is **kept only with an override**: one sent with the calculated total is dropped (AC-5, UX-31). The audit entry `approval.approved` carries the flag, the calculated
 * total and the price; an override adds a second entry, `approval.price_overridden`, with the calculated total, the price and the reason, in the same transaction. The reason is in no Excel cell (FR-011, 07.x)
 * and in no answer to an Engineer: the route's answer holds the status, the price and the time only.
 *
 * **Restricted** (ADR-008): it reads the calculation basis and writes the price, so it is blocked for every Engineer view (`tests/security/engineer-import-rule.test.ts`).
 */

/** What the body of `POST /api/v1/estimates/{id}/approve` carries once the route has parsed it, and who sent it. */
export interface ApprovalRequest {
  readonly calculationId: string;
  readonly price: string;
  /** The optional reason for a different price, as typed. It is kept, trimmed, only when the price differs from the calculated total (STORY-06.07). */
  readonly reason?: string | undefined;
  /** Who approved and on which request, for the audit entry (`actorLabel` is their name now). Always given by the route. */
  readonly audit: AuditContext;
}

/** What an approval answers (NFR-002): the new status, the price as stored and when. No calculated figure, no master value, no ID. */
export interface ApprovalResult {
  readonly status: 'APPROVED';
  /** The price as decimal text with two decimals ("12600.00"). */
  readonly approvedPrice: string;
  /** UTC, ISO 8601. */
  readonly approvedAt: string;
}

export interface ApprovalService {
  /**
   * Approves an estimate. Throws, in this order: `ForbiddenError` (an Engineer), `NotFoundError` (no such estimate, or an ID that is none), `ConflictError` with the state machine's code (a status that is not
   * SUBMITTED), `NOT_CALCULATED`, `TOTALS_OUT_OF_DATE`, `CALCULATION_CHANGED`. Every refusal writes nothing. Passing all of them it writes the status, the approval and the audit entry together, or none.
   */
  approve(viewer: EstimateViewer, estimateId: string, request: ApprovalRequest): Promise<ApprovalResult>;
}

export interface ApprovalDependencies {
  readonly estimates: EstimateLocking;
  readonly calculations: CalculationApprovalReads;
  readonly approvals: ApprovalWrites;
  readonly transactions: TransactionRunner;
  /** What the write needs of the rest of the system: the state machine's move (`transition`, in the caller's transaction) and the audit trail. */
  readonly workflow: { readonly transition: EstimateService['transition']; readonly audit: AuditService };
}

/** The role check, first and alone: it reads nothing, so a role that may never approve learns nothing about any estimate (CR-33, NFR-002). Closed by `assertNever`, so a role added one day is refused until decided. */
export function assertMayApprove(viewer: Pick<EstimateViewer, 'role'>): void {
  switch (viewer.role) {
    case 'ADMIN':
    case 'LEAD':
      return;
    case 'ENGINEER':
      throw new ForbiddenError();
    default:
      return assertNever(viewer.role, 'role');
  }
}

/**
 * The guard, with no storage: the status, then the state of the figures, then `calculationId` (the role first, again). Call it under the estimate's lock, with the basis read in the same transaction. It
 * returns when an approval may go ahead and throws the 409 that names the missing step otherwise.
 */
export function assertApprovable(viewer: Pick<EstimateViewer, 'role'>, estimate: { readonly status: EstimateStatus }, basis: FigureBasis, input: { readonly calculationId: string }): void {
  assertMayApprove(viewer);
  const decision = decideTransition(estimate.status, 'APPROVE', viewer.role);
  if (!decision.allowed) {
    if (decision.kind === 'ROLE') throw new ForbiddenError();
    const refusal = TRANSITION_REFUSALS[decision.reason];
    throw new ConflictError(refusal.message, { code: refusal.code });
  }
  const state = figureState({ inputsRevision: basis.inputsRevision, calculationInputsRevision: basis.calculation?.inputsRevision ?? null });
  switch (state) {
    case 'none':
      throw new ConflictError(NOT_CALCULATED_MESSAGE, { code: NOT_CALCULATED_CODE });
    case 'out-of-date':
      throw new ConflictError(TOTALS_OUT_OF_DATE_MESSAGE, { code: TOTALS_OUT_OF_DATE_CODE });
    case 'current':
      break;
    default:
      return assertNever(state, 'figure state');
  }
  // `current` means a calculation is linked. IDs are compared without regard to case, as PostgreSQL's `uuid` type does.
  const linked = basis.calculation;
  if (linked === null || linked.id.toLowerCase() !== input.calculationId.toLowerCase()) {
    throw new ConflictError(CALCULATION_CHANGED_MESSAGE, { code: CALCULATION_CHANGED_CODE });
  }
}

/**
 * The reason to keep with an override: the text the Lead typed, trimmed, or `null` when none was given. The route has already refused a reason that breaks the shared rule (a 422 under `reason`); this reads it
 * again by the same rule, so the service is safe on its own and never keeps a text the column's CHECK or the audit entry's schema would refuse. It needs no storage, so it runs before the transaction.
 */
function reasonToKeep(typed: string | undefined): string | null {
  const check = validateReason(typed ?? '');
  if (!check.ok) throw new FieldValidationError([{ field: 'reason', message: check.message }]);
  return check.value;
}

export function createApprovalService({ estimates, calculations, approvals, transactions, workflow }: ApprovalDependencies): ApprovalService {
  return {
    // `async`, so every refusal, the role's included, is a rejected promise and never a throw before one (a caller that handles the promise sees them all alike).
    async approve(viewer, estimateId, request) {
      assertMayApprove(viewer);
      // The route has already refused a price that is not rupees with up to two decimals; the same text in paise is the form the column keeps.
      const approvedPrice = toTwoPlaces(request.price);
      if (approvedPrice === null) throw new Error('The approved price is not a decimal number.');
      const reason = reasonToKeep(request.reason);
      return await transactions.run(async (tx) => {
        const estimate = await estimates.lockEstimate(estimateId, tx);
        if (estimate === null) throw new NotFoundError();
        // In the same transaction, so the basis is read under the lock: no input can change between the lock and this read, and none can after it until the transaction ends.
        const basis = await calculations.findFigureBasis(estimate.id, tx);
        if (basis === null) throw new NotFoundError();
        assertApprovable(viewer, estimate, basis, request);
        // The guard passed, so a calculation is linked and it is the one the request named. Its total is the figure the price was set against; a current calculation without one is a fault in the data.
        const calculationId = basis.calculation?.id;
        const calculatedTotal = calculationId === undefined ? null : await calculations.findCalculatedTotal(calculationId, tx);
        if (calculationId === undefined || calculatedTotal === null) throw new Error('The calculation linked to the estimate has no total to approve against.');
        // The total is kept as rupees and paise, rounded by the one rule the dialog pre-fills its price with (`toTwoPlaces`, half away from zero), so the price and the total are always compared at the
        // same precision (SQR-03 of the review of AQP-323). The full-precision BL stays in the immutable calculation the approval points at. Whether the price is an override is decided here, from the
        // total this transaction read, before anything is written: the client's own idea of it is not an input.
        const calculatedPaise = toTwoPlaces(calculatedTotal);
        if (calculatedPaise === null) throw new Error('The calculated total of the linked calculation is not a decimal number.');
        const isOverride = isOverridePrice(approvedPrice, calculatedPaise);
        const overrideReason = isOverride ? reason : null;
        // The write, in this transaction and in this order: the status (the machine decides again under the same lock), the approval, the entry. Any of them failing takes the others back.
        await workflow.transition(viewer, estimate.id, 'APPROVE', tx);
        const approval = await approvals.insertApproval(
          { estimateId: estimate.id, calculationId, approvedPrice, calculatedTotal: calculatedPaise, approvedById: viewer.id, isOverride, overrideReason },
          tx,
        );
        await workflow.audit.record(tx, {
          event: 'approval.approved',
          ...request.audit,
          object: { id: estimate.id, label: estimate.taskCode },
          before: null,
          after: { approvedPrice, calculatedTotal: calculatedPaise, approver: request.audit.actorLabel, isOverride },
        });
        // The override's own entry, after the approval's and in the same transaction: the calculated total, the price and the reason, if one was given (the log is Admin-only).
        if (isOverride) {
          await workflow.audit.record(tx, {
            event: 'approval.price_overridden',
            ...request.audit,
            object: { id: estimate.id, label: estimate.taskCode },
            before: { calculatedTotal: calculatedPaise },
            after: { approvedPrice, reason: overrideReason },
          });
        }
        return { status: 'APPROVED', approvedPrice, approvedAt: approval.approvedAt.toISOString() };
      });
    },
  };
}
