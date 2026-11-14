import type { RoleName } from '../../lib/auth/roles';
import { ConflictError, FieldValidationError, NotFoundError } from '../../lib/errors';
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
 *   - **Only a draft changes.** A SUBMITTED or an APPROVED estimate refuses with 409, and the check is made after the estimate is locked, so it cannot pass
 *     while a Calculate is submitting it. The order of the refusals is: not found (404), not a draft (409), unknown customer (422).
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

/**
 * Throws the 409 unless the estimate is a draft. A small local check until the status rules of EPIC-06 (STORY-06.01) give the one every input write shares
 * (assumption A-2 of the story); the words and the code are the ones that story is to keep.
 */
export function assertEditable(status: EstimateStatus): void {
  if (status !== 'DRAFT') throw new ConflictError(NOT_EDITABLE_MESSAGE, { code: ESTIMATE_NOT_EDITABLE_CODE });
}

export interface EstimateService {
  /**
   * The workspace of the task with this code, or `null` when there is none for this person: no such code, and an Engineer asking for another's task, are the
   * same answer. A Lead and an Admin may open any.
   */
  getWorkspace(viewer: EstimateViewer, code: string): Promise<Workspace | null>;
  /**
   * Chooses the customer of an estimate (`PUT /api/v1/estimates/{id}/customer`). 404 for an estimate that is not this person's or does not exist, 409 when it
   * is no longer a draft, 422 under `customerId` for a customer that does not exist or was deleted. The same customer again writes nothing.
   */
  setCustomer(viewer: EstimateViewer, estimateId: string, customerId: string): Promise<EstimateCustomer>;
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
        assertEditable(estimate.status);
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
  };
}
