import type { RoleName } from '../../lib/auth/roles';
import { ConflictError, FieldValidationError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { canEditInputs } from '../../lib/estimate/can-edit-inputs';
import { decideTransition, TRANSITION_REFUSALS, type EstimateEvent } from '../../lib/estimate/state-machine';
import { folderUrlOf } from '../../lib/tasks/folder-path';
import type { CustomerChoice, EstimateRepository } from '../repositories/estimate-repository';
import type { EstimateStatus } from '../repositories/task-repository';
import type { TransactionRunner } from '../repositories/transaction';

/**
 * The estimate workspace (STORY-05.01; FR-042; architecture sections 4.1, 4.8 and 6, "Set customer"): opening a task's estimate and choosing the customer
 * it is for. Who may call is decided before this is reached (`withRoute`, `authorizePage`, the manifest); this file holds the rules that stay true whoever asks:
 *
 *   - **An Engineer sees and changes only their own task.** An estimate that is not theirs and one that does not exist are the same answer (`null` for the
 *     page, `NotFoundError` for the route), so the answer never says that a code or an ID is real (CR-33). A Lead and an Admin may open any.
 *   - **Inputs change only when the state machine says so** (STORY-06.01; FR-064, BR-012). A DRAFT may be changed by whoever has it open; a SUBMITTED estimate
 *     only by a Lead or an Admin, so the Engineer's inputs are read-only from the first calculation on; an APPROVED one by nobody. The check is
 *     `assertEditable`, the one every write of an input shares, and it is made after the estimate is locked, so it cannot pass while a Calculate or an
 *     approval is changing the status. The order of the refusals is: not found (404), not editable (409), unknown customer (422).
 *   - **Status changes only by `transition`** (STORY-06.01; architecture section 4.4): the row is locked, the person's task and role are checked, then the
 *     machine decides, and the new status is written in the same transaction. Two transitions at once queue on the row lock, so the second sees the status the
 *     first left; a status never skips a step.
 *   - **A changed customer is an input change** (section 4.8): `inputs_revision` goes up by one in the same transaction as the customer. The same customer
 *     again changes nothing, and so raises nothing, which is also what stops a repeated request from clearing a total.
 *   - **Nothing but an ID and a name of a customer** is read or returned. The figures that depend on the customer are the Admin's and Lead's, never this file's.
 *
 * There is no audit entry: the audit log of architecture section 8 lists no event for a customer chosen on an estimate.
 */

/** Who is asking: the ID and the role of the signed-in person, read from the session on this request. */
export interface EstimateViewer {
  readonly id: string;
  readonly role: RoleName;
}

/** The header of the workspace: the task as it was assigned, and the customer chosen so far. */
export interface Workspace {
  readonly estimateId: string;
  readonly code: string;
  readonly status: EstimateStatus;
  readonly customer: CustomerChoice | null;
  readonly deadlineAt: Date;
  readonly folderPath: string;
  /** The `file:` link built from the path on the server; the browser is never asked to build one. Null only for a path the portal would not link. */
  readonly folderUrl: string | null;
  readonly title: string | null;
  readonly notes: string | null;
  readonly assignedByName: string;
}

/** What choosing a customer answers: the estimate and the customer it is now for. */
export interface EstimateCustomer {
  readonly id: string;
  readonly status: EstimateStatus;
  readonly customer: CustomerChoice;
}

/** The `code` of the 409 of a change to an estimate that is no longer a draft. */
export const ESTIMATE_NOT_EDITABLE_CODE = 'ESTIMATE_NOT_EDITABLE';
export const NOT_EDITABLE_MESSAGE = 'This estimate can no longer be changed.';
export const CUSTOMER_CHOICE_MESSAGE = 'Choose a customer from the list.';

/** The `code` of the 409 when a transition's write finds the status other than the one the lock showed. The lock makes it impossible; the check is a guard. */
export const ESTIMATE_STATUS_CHANGED_CODE = 'ESTIMATE_STATUS_CHANGED';
export const STATUS_CHANGED_MESSAGE = 'This estimate was changed by someone else. Reload it and try again.';

/** What a transition answers: the estimate, the status it had and the status it has now. */
export interface EstimateTransition {
  readonly id: string;
  readonly from: EstimateStatus;
  readonly to: EstimateStatus;
}

/**
 * Throws the 409 unless this person may change the inputs of an estimate in this status (`canEditInputs`, the state machine of STORY-06.01; AC-2). The one
 * check every write of an input shares (a field, a part, an image, the customer); it replaces the local draft-only check of STORY-05.01 (assumption A-2 of
 * that story), with the same code and words. Call it **after** the estimate is locked, so the status it reads cannot change before the write. Who owns the
 * task is not asked here: that is the 404 the caller has already given.
 */
export function assertEditable(viewer: EstimateViewer, estimate: { readonly status: EstimateStatus }): void {
  if (!canEditInputs(estimate.status, viewer.role)) throw new ConflictError(NOT_EDITABLE_MESSAGE, { code: ESTIMATE_NOT_EDITABLE_CODE });
}

export interface EstimateService {
  /**
   * The workspace of the task with this code, or `null` when there is none for this person: no such code, and an Engineer asking for another's task, are the
   * same answer. A Lead and an Admin may open any.
   */
  getWorkspace(viewer: EstimateViewer, code: string): Promise<Workspace | null>;
  /**
   * Chooses the customer of an estimate (`PUT /api/v1/estimates/{id}/customer`). 404 for an estimate that is not this person's or does not exist, 409 when it
   * is not editable by this person (`assertEditable`: an Engineer's submitted estimate, anyone's approved one), 422 under `customerId` for a customer that does not exist or was deleted. The same customer again writes nothing.
   */
  setCustomer(viewer: EstimateViewer, estimateId: string, customerId: string): Promise<EstimateCustomer>;
  /**
   * Applies one event of the state machine to an estimate (STORY-06.01), under its row lock, and answers the status it had and the status it has. 404 for an
   * estimate that is not this person's or does not exist, and for an Engineer's event that is not Calculate (the same answer, so nothing is told); 403 for a
   * Lead's or an Admin's event that is not theirs (the Admin-only cancel); 409 with a named code for a pair the machine refuses (`TRANSITION_REFUSALS`). A
   * refusal writes nothing. The routes and the work of each event (Calculate, approve, unlock, cancel) call this inside their own steps as they arrive.
   */
  transition(viewer: EstimateViewer, estimateId: string, event: EstimateEvent): Promise<EstimateTransition>;
}

export interface EstimateDependencies {
  readonly estimates: EstimateRepository;
  readonly transactions: TransactionRunner;
}

const mayOpen = (viewer: EstimateViewer, engineerId: string): boolean => viewer.role !== 'ENGINEER' || viewer.id.toLowerCase() === engineerId.toLowerCase();

export function createEstimateService({ estimates, transactions }: EstimateDependencies): EstimateService {
  return {
    async getWorkspace(viewer, code) {
      const record = await estimates.findWorkspaceByCode(code);
      if (record === null || !mayOpen(viewer, record.engineerId)) return null;
      return {
        estimateId: record.estimateId,
        code: record.code,
        status: record.status,
        customer: record.customer,
        deadlineAt: record.deadlineAt,
        folderPath: record.folderPath,
        folderUrl: folderUrlOf(record.folderPath),
        title: record.title,
        notes: record.notes,
        assignedByName: record.assignedByName,
      };
    },

    setCustomer(viewer, estimateId, customerId) {
      return transactions.run(async (tx) => {
        const estimate = await estimates.lockEstimate(estimateId, tx);
        if (estimate === null || !mayOpen(viewer, estimate.engineerId)) throw new NotFoundError();
        assertEditable(viewer, estimate);
        const customer = await estimates.findActiveCustomer(customerId, tx);
        if (customer === null) throw new FieldValidationError([{ field: 'customerId', message: CUSTOMER_CHOICE_MESSAGE }]);
        // The same customer again is no change: no write, and so no new revision.
        if (estimate.customerId !== null && estimate.customerId.toLowerCase() === customer.id.toLowerCase()) {
          return { id: estimate.id, status: estimate.status, customer };
        }
        await estimates.setCustomer(estimate.id, customer.id, tx);
        return { id: estimate.id, status: estimate.status, customer };
      });
    },

    transition(viewer, estimateId, event) {
      return transactions.run(async (tx) => {
        const estimate = await estimates.lockEstimate(estimateId, tx);
        if (estimate === null || !mayOpen(viewer, estimate.engineerId)) throw new NotFoundError();
        const decision = decideTransition(estimate.status, event, viewer.role);
        if (!decision.allowed) {
          // A role that may never apply the event is refused before the status is looked at. An Engineer gets the uniform "not found" (CR-33); a Lead gets 403.
          if (decision.kind === 'ROLE') throw viewer.role === 'ENGINEER' ? new NotFoundError() : new ForbiddenError();
          const refusal = TRANSITION_REFUSALS[decision.reason];
          throw new ConflictError(refusal.message, { code: refusal.code });
        }
        // A transition that keeps the status (Recalculate of a submitted estimate, an edit, an export) writes nothing here; what it does is its own story's.
        if (decision.to !== decision.from) {
          const moved = await estimates.setStatus(estimate.id, decision.from, decision.to, tx);
          if (!moved) throw new ConflictError(STATUS_CHANGED_MESSAGE, { code: ESTIMATE_STATUS_CHANGED_CODE });
        }
        return { id: estimate.id, from: decision.from, to: decision.to };
      });
    },
  };
}
