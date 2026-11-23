import { assertNever } from '../../lib/assert-never';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { stateOf, TRANSITION_REFUSALS } from '../../lib/estimate/state-machine';
import type { EstimateQuoting } from '../repositories/estimate-repository';
import type { TransactionRunner } from '../repositories/transaction';

import type { AuditContext, AuditService } from './audit-service';
import type { EstimateService, EstimateViewer } from './estimate-service';

/**
 * The status actions of an estimate that no figure depends on (CR-01 item 7C, AQP-400; FR-110, FR-065; BR-066, BR-069; architecture section 4.12 a and c; ADR-019). Today one: **Mark as quoted**, the Lead's or the
 * Admin's mark, once the quote has gone to the customer, that takes an APPROVED estimate to QUOTED, the last status. Ignore and Restore (story 7D) are added to this service.
 *
 * **The write** is one transaction under the estimate's row lock (`FOR UPDATE`): the estimate is locked and read (404 when there is none), the Ignored layer is refused here by name (`ESTIMATE_IGNORED`: the state machine
 * does not reach every path, and an ignored Draft or Prepared estimate must say "ignored" and not "not approved", AQP-401 QLT-B2), the state machine decides `MARK_QUOTED` through the estimate service's `transition`
 * (the one place that writes the status, and `quoted_at` and `quoted_by` with it, in one UPDATE: `ck_estimates_quoted`), the marker just written is read back for the answer, and the audit entry `estimate.quoted` is
 * recorded, **all in the one transaction**. A failure anywhere, the entry's included, rolls the whole mark back. Two presses at once queue on the lock: the second finds QUOTED and is the 409
 * `ESTIMATE_ALREADY_QUOTED`, so exactly one entry is written. **A refusal writes nothing**, not even an entry: an entry records what was done (NFR-007).
 *
 * **There is no undo** (A-CR01-3, confirmed 2026-11-23): no event, no method and no route un-marks a quote; the only way back is Unlock (and the Admin's Cancel approval), which clear the marker in the same UPDATE
 * that moves the status to DRAFT. **No step-up** (the product-manager's ruling, OQ-ARCH-CR01-4): marking moves no price.
 *
 * **The order of the checks**: the role (a Lead or an Admin; an Engineer is 403 before anything is read, the ID of an estimate that does not exist included), then, under the lock, the estimate exists (404), it is not
 * ignored (409), then the machine's own decision (409 `ESTIMATE_NOT_APPROVED`, `ESTIMATE_ALREADY_QUOTED`). **Lock order** is the writers' own; this takes the estimate's lock and no other.
 *
 * **Restricted** (NFR-002): it is for the Lead and the Admin alone and is classed so for the Engineer import rule; its answer holds a time and a name, never a figure.
 */

/** What `POST /api/v1/estimates/{id}/quoted` carries once the route has built it: who marked and on which request, for the audit entry (`actorLabel` is their name now). */
export interface MarkQuotedRequest {
  readonly audit: AuditContext;
}

/** What a mark answers (NFR-002): the new status and the marker just written, as UTC text and a name. No figure, no master value, no ID. */
export interface MarkQuotedResult {
  readonly status: 'QUOTED';
  readonly quoted: { readonly at: string; readonly byName: string };
}

export interface EstimateStatusService {
  /**
   * Marks an APPROVED estimate as quoted. Throws, in this order: `ForbiddenError` (an Engineer), `NotFoundError` (no such estimate, or an ID that is none), `ConflictError` with `ESTIMATE_IGNORED` (an ignored estimate,
   * whatever its status underneath) and then with the state machine's code (`ESTIMATE_NOT_APPROVED` from a Draft or a Prepared estimate, `ESTIMATE_ALREADY_QUOTED` from a quoted one). Every refusal writes nothing.
   * Passing all of them it writes the status, the marker and the audit entry together, or none.
   */
  markQuoted(viewer: EstimateViewer, estimateId: string, request: MarkQuotedRequest): Promise<MarkQuotedResult>;
}

export interface EstimateStatusDependencies {
  readonly estimates: EstimateQuoting;
  readonly transactions: TransactionRunner;
  /** What the write needs of the rest of the system: the state machine's move (`transition`, in the caller's transaction) and the audit trail. */
  readonly workflow: { readonly transition: EstimateService['transition']; readonly audit: AuditService };
}

/** The role check, first and alone: it reads nothing, so a role that may never mark learns nothing about any estimate (CR-33, NFR-002). Closed by `assertNever`, so a role added one day is refused until decided. */
export function assertMayMarkQuoted(viewer: Pick<EstimateViewer, 'role'>): void {
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

export function createEstimateStatusService({ estimates, transactions, workflow }: EstimateStatusDependencies): EstimateStatusService {
  return {
    // `async`, so every refusal, the role's included, is a rejected promise and never a throw before one (a caller that handles the promise sees them all alike).
    async markQuoted(viewer, estimateId, request) {
      assertMayMarkQuoted(viewer);
      return await transactions.run(async (tx) => {
        const estimate = await estimates.lockEstimate(estimateId, tx);
        if (estimate === null) throw new NotFoundError();
        // Ignored first, by this route's own check (the state machine refuses it too, but not every path asks the machine): the person is told to Restore it, whatever status lies underneath.
        if (stateOf(estimate).ignored) throw new ConflictError(TRANSITION_REFUSALS.IGNORED.message, { code: TRANSITION_REFUSALS.IGNORED.code });
        // The machine decides under the same lock (a lock the transaction already holds is re-entrant) and writes the status with `quoted_at` and `quoted_by` in one UPDATE.
        const moved = await workflow.transition(viewer, estimate.id, 'MARK_QUOTED', tx);
        // `APPROVED` by name and not `isLocked`: the one pair the machine's MARK_QUOTED cell allows. It leads from APPROVED to QUOTED and nowhere else; the check keeps a changed table from recording a mark that did not happen.
        if (moved.from !== 'APPROVED' || moved.to !== 'QUOTED') throw new Error('Marking as quoted must take an APPROVED estimate to QUOTED.');
        const marker = await estimates.findQuoteMarker(estimate.id, tx);
        // The write above made this row QUOTED under the lock, so the marker is there; the check keeps a skipped write from answering a mark that was not stored.
        if (marker === null) throw new Error('The estimate has no quote marker after it was marked as quoted.');
        await workflow.audit.record(tx, {
          event: 'estimate.quoted',
          ...request.audit,
          object: { id: estimate.id, label: estimate.taskCode },
          before: { status: moved.from },
          after: { status: moved.to },
        });
        return { status: 'QUOTED', quoted: { at: marker.at.toISOString(), byName: marker.byName } };
      });
    },
  };
}
