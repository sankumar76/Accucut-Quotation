import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import {
  APPROVAL_NOT_AVAILABLE_CODE,
  APPROVAL_NOT_AVAILABLE_MESSAGE,
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
import type { CalculationRepository, FigureBasis } from '../repositories/calculation-repository';
import type { EstimateRepository } from '../repositories/estimate-repository';
import type { TransactionRunner } from '../repositories/transaction';

import type { EstimateViewer } from './estimate-service';

/**
 * The approval service (STORY-06.05; FR-101, D-20; NFR-001, NFR-007; architecture sections 4.8 and 6 "Approve"). This story is its **guard**: the server refuses an approval, with a fixed sentence that names the
 * missing step, unless the estimate is SUBMITTED, its figures are `current` and the request names the estimate's current calculation. The button on SCR-06 being off is only a convenience; this is the authority.
 *
 * **The order of the checks is the story's (AC-5):** the role (a Lead or an Admin; an Engineer is 403, before anything is read), then the estimate exists (404), then its status (the state machine's own decision, so
 * the code and sentence of "not submitted" and "already approved" are the machine's, written once), then the state of the figures, then `calculationId`. All of it runs **under the estimate's row lock in one
 * transaction**, so an input saved at the same moment either lands first (the figures are out of date, refused) or waits until the approval is over (and an input cannot change after an approval, because it locks them).
 *
 * **The state is read the one way it is ever read** (`figureState` of `lib/estimate/figure-state.ts`, from the two counts `findFigureBasis` holds): no figure is read, so none can leave. A refusal writes nothing and
 * records no audit entry (AC-8, NFR-007: an entry is the record of what was done, and nothing was).
 *
 * **What this story does not do:** the write of the approval (the `approvals` row, the price, the audit entry, the status) is STORY-06.06's. Until it lands, an approval that passes every check is the fixed 501
 * `APPROVAL_NOT_AVAILABLE`, raised inside the transaction so nothing is committed (assumption A-1). The status is decided here with `decideTransition` (no write); 06.06 moves it with `transition`.
 *
 * **Restricted** (ADR-008): it reads the calculation basis, so it is blocked for every Engineer view (`tests/security/engineer-import-rule.test.ts`).
 */

/** What the body of `POST /api/v1/estimates/{id}/approve` carries once the route has parsed it. The price and the reason are 06.06's to judge; this story only needs `calculationId`. */
export interface ApprovalRequest {
  readonly calculationId: string;
  readonly price: string;
  readonly reason?: string | undefined;
}

export interface ApprovalService {
  /**
   * Approves an estimate. Throws, in this order: `ForbiddenError` (an Engineer), `NotFoundError` (no such estimate, or an ID that is none), `ConflictError` with the state machine's code (a status that is not
   * SUBMITTED), `NOT_CALCULATED`, `TOTALS_OUT_OF_DATE`, `CALCULATION_CHANGED`. Passing all of them reaches the approval, which is STORY-06.06's: until then it is the fixed 501 `APPROVAL_NOT_AVAILABLE`. Nothing is
   * written in any case.
   */
  approve(viewer: EstimateViewer, estimateId: string, request: ApprovalRequest): Promise<never>;
}

export interface ApprovalDependencies {
  readonly estimates: Pick<EstimateRepository, 'lockEstimate'>;
  readonly calculations: Pick<CalculationRepository, 'findFigureBasis'>;
  readonly transactions: TransactionRunner;
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

/** The HTTP status of "this is not built yet". */
const NOT_IMPLEMENTED_STATUS = 501;

export function createApprovalService({ estimates, calculations, transactions }: ApprovalDependencies): ApprovalService {
  return {
    approve(viewer, estimateId, request) {
      assertMayApprove(viewer);
      return transactions.run(async (tx) => {
        const estimate = await estimates.lockEstimate(estimateId, tx);
        if (estimate === null) throw new NotFoundError();
        // In the same transaction, so the basis is read under the lock: no input can change between the lock and this read, and none can after it until the transaction ends.
        const basis = await calculations.findFigureBasis(estimate.id, tx);
        if (basis === null) throw new NotFoundError();
        assertApprovable(viewer, estimate, basis, request);
        // STORY-06.06 writes the approval here. Until then the answer is fixed and the transaction ends without a write.
        throw new AppError(APPROVAL_NOT_AVAILABLE_CODE, NOT_IMPLEMENTED_STATUS, APPROVAL_NOT_AVAILABLE_MESSAGE);
      });
    },
  };
}
