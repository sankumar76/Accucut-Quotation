import { assertNever } from '../../lib/assert-never';
import { ConflictError, FieldValidationError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { CUSTOMER_DELETED_CODE, MATERIAL_DELETED_CODE } from '../../lib/estimate/calculate-words';
import { diffRates, type RateChangeCounts } from '../../lib/estimate/rate-diff';
import { decideTransition, TRANSITION_REFUSALS, type EstimateStatus } from '../../lib/estimate/state-machine';
import { checkUnlockReason, UNLOCK_CUSTOMER_DELETED_MESSAGE, UNLOCK_MATERIAL_DELETED_MESSAGE } from '../../lib/estimate/unlock-words';
import { createPlanCache, type PlanCache } from '../../lib/formula';
import type { ApprovalUnlocking } from '../repositories/approval-repository';
import type { CalculationRepository } from '../repositories/calculation-repository';
import type { EstimateUnlocking } from '../repositories/estimate-repository';
import type { TransactionRunner } from '../repositories/transaction';

import { readMasters, type CalculationMasters, type DeletedWords } from './calculation-masters';
import type { AuditContext, AuditService } from './audit-service';
import type { ConfigVersion } from './config-service';
import type { EstimateService, EstimateViewer } from './estimate-service';

/**
 * Unlock (STORY-06.08; FR-063, FR-064, FR-038; BR-011; D-29; NFR-001, NFR-007, NFR-026; architecture sections 4.4, 4.8 "Unlock and the earlier price", 4.10 and 6 "Unlock preview" and "Unlock"): a Lead or an Admin
 * takes an approved estimate back to Draft, with a reason, so it can be estimated again while the price approved earlier stays on record.
 *
 * **The write** is one transaction under the estimate's row lock, through the shared state machine: the estimate's customer and the materials its parts name are read `FOR SHARE` (AC-10), the estimate's move to
 * DRAFT (`transition`, which locks again; a lock the transaction already holds is re-entrant), the unlock stored on the approval (who, when, why: `markUnlocked`, the unlock columns only) and the audit entry
 * `approval.unlocked`, **all in the one transaction**. A failure anywhere, the audit entry's included, rolls the whole unlock back. A second transaction would lose the protection. Two unlocks at once queue on the
 * lock: the second sees DRAFT and is the machine's 409, so exactly one unlock is stored (AC-5).
 *
 * **The order of the checks** is the story's and the approval's: the role (a Lead or an Admin; an Engineer is 403 before anything is read), then the reason (422: it is the Lead's own text, so it costs no read),
 * then, under the lock, the estimate exists (404), its status (the state machine's own decision, so the code and sentence of "not approved" are the machine's, written once), then the customer and the materials
 * (409 `CUSTOMER_DELETED`, `MATERIAL_DELETED`, in the unlock's words: the estimate stays APPROVED and nothing is written, no audit entry either). **A refusal writes nothing**, not even an audit entry: an entry
 * records what was done (NFR-007).
 *
 * **Lock order** is the writers' own: the estimate, then its task (`lockEstimate`), then the customer, then the materials in ascending ID order. A customer or a material delete takes no estimate lock and
 * reads the open estimates after its own row lock, so the two orders either wait for each other or one sees the other's result; they never form a cycle. An unlock never produces a DRAFT estimate that names a
 * deleted customer or material.
 *
 * **The preview** (`GET /unlock-preview`) is a read with no lock: how the configuration versions and the masters moved since the approval, **as counts by kind** (`lib/estimate/rate-diff.ts`, AC-8). It carries
 * no old or new value. A customer or a material deleted since is the same 409 as the unlock, so the dialog can say so before the reason is typed.
 *
 * **Restricted** (ADR-008, NFR-002): it reads the calculation's master snapshot (rates and prices) and writes the approval, so it is blocked for every Engineer view
 * (`tests/security/engineer-import-rule.test.ts`) and only the two routes, for the Lead and the Admin alone, ask for it.
 */

/** What the body of `POST /api/v1/estimates/{id}/unlock` carries once the route has parsed it, and who sent it. */
export interface UnlockRequest {
  /** The Lead's reason as typed; the service trims it and judges it (1 to 500 characters). */
  readonly reason: string;
  /** Who unlocked and on which request, for the audit entry (`actorLabel` is their name now). Always given by the route. */
  readonly audit: AuditContext;
}

/** What an unlock answers (NFR-002): the new status and when. No figure, no master value, no ID. */
export interface UnlockResult {
  readonly status: 'DRAFT';
  /** UTC, ISO 8601, the database's clock. */
  readonly unlockedAt: string;
}

/**
 * What the dialog shows before the unlock (SCR-09): whose queue the task returns to, the configuration versions (the one the approved calculation used, and the one in force now) and how many process rates, material prices and exchange rates
 * changed since. Counts only (AC-8); nothing that was approved, nothing that is now.
 */
export interface UnlockPreview {
  /** The Engineer whose Open queue the task returns to. */
  readonly engineerName: string;
  readonly configuration: { readonly approved: number; readonly current: number };
  readonly changed: RateChangeCounts;
}

export interface UnlockService {
  /**
   * Unlocks an approved estimate. Throws, in this order: `ForbiddenError` (an Engineer), `FieldValidationError` (`reason`, 422), `NotFoundError` (no such estimate, or an ID that is none), `ConflictError` with
   * the state machine's code (a status that is not APPROVED), `CUSTOMER_DELETED`, `MATERIAL_DELETED`. Every refusal writes nothing. Passing all of them it writes the status, the unlock and the audit entry together,
   * or none.
   */
  unlock(viewer: EstimateViewer, estimateId: string, request: UnlockRequest): Promise<UnlockResult>;
  /** The notices of SCR-09: 403 for an Engineer before anything is read, 404 for an estimate that does not exist, the machine's 409 for one that is not APPROVED, the unlock's 409 for a deleted customer or material. */
  preview(viewer: EstimateViewer, estimateId: string): Promise<UnlockPreview>;
}

export interface UnlockDependencies {
  readonly estimates: EstimateUnlocking;
  readonly approvals: ApprovalUnlocking;
  readonly calculations: Pick<CalculationRepository, 'findMasterSnapshot'>;
  readonly masters: CalculationMasters;
  readonly configuration: {
    /** The version in force now. */
    readonly current: () => Promise<ConfigVersion>;
    /** The version a calculation was made with, by its ID. */
    readonly byId: (id: string) => Promise<ConfigVersion>;
  };
  /** Compiled plans by version, for the set of rates the approved calculation's formulas read. A test passes its own; the default is one cache for the service. */
  readonly plans?: PlanCache;
  readonly transactions: TransactionRunner;
  /** What the write needs of the rest of the system: the state machine's move (`transition`, in the caller's transaction) and the audit trail. */
  readonly workflow: { readonly transition: EstimateService['transition']; readonly audit: AuditService };
}

/** The role check, first and alone: it reads nothing, so a role that may never unlock learns nothing about any estimate (CR-33, NFR-002). Closed by `assertNever`, so a role added one day is refused until decided. */
export function assertMayUnlock(viewer: Pick<EstimateViewer, 'role'>): void {
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

/** The state machine's decision for UNLOCK, as the error it is: 403 for a role that may not, the machine's own code and sentence for a status that does not allow it (`ESTIMATE_NOT_APPROVED`). */
function assertUnlockable(viewer: Pick<EstimateViewer, 'role'>, status: EstimateStatus): void {
  const decision = decideTransition(status, 'UNLOCK', viewer.role);
  if (decision.allowed) return;
  if (decision.kind === 'ROLE') throw new ForbiddenError();
  const refusal = TRANSITION_REFUSALS[decision.reason];
  throw new ConflictError(refusal.message, { code: refusal.code });
}

const UNLOCK_WORDS: DeletedWords = { customer: UNLOCK_CUSTOMER_DELETED_MESSAGE, material: UNLOCK_MATERIAL_DELETED_MESSAGE };

export function createUnlockService({ estimates, approvals, calculations, masters, configuration, plans = createPlanCache(), transactions, workflow }: UnlockDependencies): UnlockService {
  return {
    // `async`, so every refusal, the role's included, is a rejected promise and never a throw before one (a caller that handles the promise sees them all alike).
    async unlock(viewer, estimateId, request) {
      assertMayUnlock(viewer);
      const checked = checkUnlockReason(request.reason);
      if (!checked.ok) throw new FieldValidationError([{ field: 'reason', message: checked.message }]);
      return await transactions.run(async (tx) => {
        const estimate = await estimates.lockEstimate(estimateId, tx);
        if (estimate === null) throw new NotFoundError();
        assertUnlockable(viewer, estimate.status);
        // The customer, then the materials in ascending ID order, each `FOR SHARE` after the estimate's and the task's lock (AC-10). A customer or a material that was deleted after the approval is the 409 in the unlock's
        // words, and nothing has been written. An estimate with no customer is not affected.
        if (estimate.customerId !== null && (await estimates.findActiveCustomer(estimate.customerId, tx)) === null) {
          throw new ConflictError(UNLOCK_CUSTOMER_DELETED_MESSAGE, { code: CUSTOMER_DELETED_CODE });
        }
        if ((await estimates.lockMaterialsInUse(estimate.id, tx)).some((material) => material.deleted)) {
          throw new ConflictError(UNLOCK_MATERIAL_DELETED_MESSAGE, { code: MATERIAL_DELETED_CODE });
        }
        // An approved estimate has a live approval: the approval that approved it. Anything else is a fault in the data (a plain `Error`, a 500 with fixed words), never a guess.
        const live = await approvals.findLiveApproval(estimate.id, tx);
        if (live === null) throw new Error('The approved estimate has no live approval to unlock.');
        // The write, in this transaction and in this order: the status (the machine decides again under the same lock), the unlock, the entry. Any of them failing takes the others back.
        await workflow.transition(viewer, estimate.id, 'UNLOCK', tx);
        const unlockedAt = await approvals.markUnlocked({ approvalId: live.id, unlockedById: viewer.id, reason: checked.reason }, tx);
        // The lock makes this impossible (the approval was live a moment ago); the check keeps a skipped lock from recording an unlock that was not stored.
        if (unlockedAt === null) throw new Error('The approval was no longer live when it was unlocked.');
        await workflow.audit.record(tx, {
          event: 'approval.unlocked',
          ...request.audit,
          object: { id: estimate.id, label: estimate.taskCode },
          before: { approvedPrice: live.approvedPrice },
          after: { reason: checked.reason },
        });
        return { status: 'DRAFT', unlockedAt: unlockedAt.toISOString() };
      });
    },

    async preview(viewer, estimateId) {
      assertMayUnlock(viewer);
      const access = await estimates.findEstimateAccess(estimateId);
      if (access === null) throw new NotFoundError();
      assertUnlockable(viewer, access.status);
      const live = await approvals.findLiveApproval(estimateId);
      if (live === null) throw new Error('The approved estimate has no live approval to unlock.');
      const stored = await calculations.findMasterSnapshot(live.calculationId);
      if (stored === null) throw new Error('The calculation of the approval could not be read.');
      const [approved, current] = await Promise.all([configuration.byId(stored.configVersionId), configuration.current()]);
      const plan = plans.get(approved.id, approved.document.fields);
      // The masters as they are now, for the very customer and materials the approved calculation used and the rates its formulas read: the same read Calculate makes, so a master that was deleted is the same 409,
      // in the unlock's words.
      const now = await readMasters(
        masters,
        stored.masterSnapshot.customer.id,
        stored.masterSnapshot.materials.map((material) => material.id),
        plan.referencedRateIds,
        undefined,
        UNLOCK_WORDS,
      );
      return {
        engineerName: live.engineerName,
        configuration: { approved: approved.number, current: current.number },
        changed: diffRates(stored.masterSnapshot, now.snapshot, plan.referencedRateIds),
      };
    },
  };
}
