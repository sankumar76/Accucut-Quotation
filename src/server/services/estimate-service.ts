import type { RoleName } from '../../lib/auth/roles';
import { ConflictError, FieldValidationError, ForbiddenError, NotFoundError, TreeChangedError, ValidationError } from '../../lib/errors';
import { canEditInputs } from '../../lib/estimate/can-edit-inputs';
import type { Completeness, PartView } from '../../lib/estimate/part-view';
import { decideTransition, TRANSITION_REFUSALS, type EstimateEvent } from '../../lib/estimate/state-machine';
import { subtreeFingerprint } from '../../lib/estimate/subtree-fingerprint';
import { buildTree, canMove, changedPlacements, childCount, descendantIds, insertNode, moveNode, removeNodes, siblingIndex, type PlacedNode } from '../../lib/estimate/tree';
import { folderUrlOf } from '../../lib/tasks/folder-path';
import type { EstimateNodeRepository, NodeRecord } from '../repositories/estimate-node-repository';
import type { CustomerChoice, EstimateRepository } from '../repositories/estimate-repository';
import type { EstimateStatus } from '../repositories/task-repository';
import type { Transaction, TransactionRunner } from '../repositories/transaction';

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
 *
 * **The parts tree (STORY-05.02; FR-043, FR-044; architecture sections 4.8, 5.1 and 6).** Reading the tree is open to whoever may open the estimate. Every write
 * (add, move, delete) follows one order, so the answer depends on the estimate before it depends on what was sent: the estimate is locked (404 when it is not the
 * person's or does not exist), this person must still be allowed to change its inputs (409, `assertEditable`: a draft for an Engineer, a draft or a submitted estimate for a Lead or an Admin, never an approved one), the part named must be in it (404), the part's `revision` and, for a delete, the count and the
 * fingerprint of the parts the person was shown must still be right (409, with the fresh tree), and only then does the content of a move count (422). All of it is one transaction with the
 * estimate's row lock, so two changes to one tree are serialised and `inputs_revision` rises by one with the change or not at all. A change that moves nothing
 * writes nothing. **The Sl. No is never stored**; it is read from the layout each time (`lib/estimate/tree.ts`). No answer carries a rate, a cost or a formula.
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

/** One part with what was typed into it. */
export interface PartDetail extends PartView {
  readonly inputs: Readonly<Record<string, unknown>>;
}

/** The tree in reading order, depth first. */
export type PartsTree = ReadonlyArray<PartView>;

/** What a person asks to add: a new top-level item, a sub-part (last under the part named) or a part beside (right after the part named). */
export type AddPartRequest = { readonly kind: 'item' } | { readonly kind: 'sub-part' | 'beside'; readonly nodeId: string };

/** Move a part (with its sub-parts) under `parentId` (null: the top) so that it ends up at place `index` (0 is first) among its new siblings. */
export interface MovePartRequest {
  readonly nodeId: string;
  readonly revision: number;
  readonly parentId: string | null;
  readonly index: number;
}

/**
 * Delete a part and its sub-parts. `parts` is the number the person was told would go (the part and every sub-part) and `subtree` the fingerprint of those parts with
 * their revisions (`subtreeFingerprint`): a different number, or a different set, or a part of it typed into since, is a 409 and nothing is deleted (review SQR-01).
 */
export interface DeletePartRequest {
  readonly nodeId: string;
  readonly revision: number;
  readonly parts: number;
  readonly subtree: string;
}

/**
 * The most parts one estimate may hold. **Assumption, to be confirmed by the architect or the product manager**: NFR-008 sizes Calculate and the screens at 500 parts,
 * and this is four times that. Depth stays unlimited (FR-043), but every change reads and answers the whole tree, and the Sl. No of a deep part grows with its depth, so
 * an estimate with no bound could make each request cost seconds and megabytes (review SQR-02).
 */
export const MAX_PARTS_PER_ESTIMATE = 2000;
/** The `code` of the 422 of an add to an estimate that already holds the most parts. */
export const TREE_FULL_CODE = 'TREE_FULL';
export const TREE_FULL_MESSAGE = `This estimate already has ${MAX_PARTS_PER_ESTIMATE.toLocaleString('en-US')} parts, the most it can hold. Delete a part before adding another.`;

/** The part added and the tree as it is now. */
export interface AddedPart {
  readonly nodeId: string;
  readonly nodes: PartsTree;
}

export const CANNOT_MOVE_MESSAGE = 'A part cannot be moved under itself or under one of its own sub-parts.';
export const MOVE_PARENT_UNKNOWN_MESSAGE = 'Choose a part of this estimate.';

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
  /** The parts tree (`GET /api/v1/estimates/{id}/tree`): 404 for an estimate that is not this person's or does not exist. The same answer for every role. */
  getTree(viewer: EstimateViewer, estimateId: string): Promise<PartsTree>;
  /** One part with what was typed into it (`GET /api/v1/estimates/{id}/nodes/{nodeId}`): 404 for an estimate or a part that is not there for this person. */
  getNode(viewer: EstimateViewer, estimateId: string, nodeId: string): Promise<PartDetail>;
  /** Adds a part with empty inputs (`POST /api/v1/estimates/{id}/nodes`). 404, 409 not editable by this person, 422 `TREE_FULL` at `MAX_PARTS_PER_ESTIMATE` parts. Answers with the new part's ID and the tree. */
  addPart(viewer: EstimateViewer, estimateId: string, request: AddPartRequest): Promise<AddedPart>;
  /** Moves a part (`PUT .../nodes/{nodeId}`, `POST .../tree/move`). 404, 409 (not editable by this person, or a stale revision, with the tree), 422 under `parentId`. Answers with the tree. */
  moveNode(viewer: EstimateViewer, estimateId: string, request: MovePartRequest): Promise<PartsTree>;
  /** Deletes a part and its sub-parts (`DELETE .../nodes/{nodeId}`). 404, 409 (not editable by this person, a stale revision, or a count that is no longer right, with the tree). Answers with the tree. */
  deleteNode(viewer: EstimateViewer, estimateId: string, request: DeletePartRequest): Promise<PartsTree>;

  /**
   * Applies one event of the state machine to an estimate (STORY-06.01), under its row lock, and answers the status it had and the status it has. 404 for an
   * estimate that is not this person's or does not exist, and for an Engineer's event that is not Calculate (the same answer, so nothing is told); 403 for a
   * Lead's or an Admin's event that is not theirs (the Admin-only cancel); 409 with a named code for a pair the machine refuses (`TRANSITION_REFUSALS`). A
   * refusal writes nothing. The routes and the work of each event (Calculate, approve, unlock, cancel) call this inside their own steps as they arrive.
   * Pass `tx` to run in the caller's transaction (as `storeCalculation` does): the lock and the write are then the caller's, so the status changes, or is put
   * back, together with the caller's own writes (the approval row, the audit entry, the calculation link), and no second transaction is opened (one opened
   * here would wait on the row lock its caller already holds). Without `tx` the service opens its own.
   */
  transition(viewer: EstimateViewer, estimateId: string, event: EstimateEvent, tx?: Transaction): Promise<EstimateTransition>;
}

export interface EstimateDependencies {
  readonly estimates: EstimateRepository;
  readonly nodes: EstimateNodeRepository;
  readonly transactions: TransactionRunner;
}

const mayOpen = (viewer: EstimateViewer, engineerId: string): boolean => viewer.role !== 'ENGINEER' || viewer.id.toLowerCase() === engineerId.toLowerCase();

const completenessOf = (inputs: Readonly<Record<string, unknown>>): Completeness => (Object.keys(inputs).length === 0 ? 'EMPTY' : 'PARTIAL');

/** The parts in reading order, each with its Sl. No read from the layout. */
function viewsOf(records: ReadonlyArray<NodeRecord>): PartView[] {
  return buildTree(records).map(({ node, slNo }) => ({ id: node.id, parentId: node.parentId, slNo, label: '', completeness: completenessOf(node.inputs), revision: node.revision }));
}

/** The part with this ID in a list read from the estimate (never a part of another estimate), or a 404. An ID is compared in lower case, as the database writes it. */
function partIn(records: ReadonlyArray<NodeRecord>, nodeId: string): NodeRecord {
  const found = records.find((record) => record.id === nodeId.toLowerCase());
  if (found === undefined) throw new NotFoundError();
  return found;
}

const placedOf = (records: ReadonlyArray<NodeRecord>): PlacedNode[] => records.map(({ id, parentId, sortIndex }) => ({ id, parentId, sortIndex }));

/** Where a new part goes: a new item last at the top, a sub-part last under the part named, a part beside right after it. */
function placeForAdd(records: ReadonlyArray<NodeRecord>, request: AddPartRequest): { readonly parentId: string | null; readonly index: number } {
  if (request.kind === 'item') return { parentId: null, index: childCount(records, null) };
  const target = partIn(records, request.nodeId);
  return request.kind === 'sub-part' ? { parentId: target.id, index: childCount(records, target.id) } : { parentId: target.parentId, index: siblingIndex(records, target.id) + 1 };
}

/** The 422 of a parent that cannot be: not in this estimate, or the part itself or one of its own descendants. */
function movableParent(records: ReadonlyArray<NodeRecord>, id: string, parentId: string | null): string | null {
  const parent = parentId === null ? null : records.find((record) => record.id === parentId.toLowerCase());
  if (parent === undefined) throw new FieldValidationError([{ field: 'parentId', message: MOVE_PARENT_UNKNOWN_MESSAGE }]);
  if (!canMove(records, id, parent?.id ?? null)) throw new FieldValidationError([{ field: 'parentId', message: CANNOT_MOVE_MESSAGE }]);
  return parent?.id ?? null;
}

/** Locks the estimate, lets the state machine decide, and writes the new status, all in `tx`. The caller owns the transaction. */
async function applyTransition(
  estimates: EstimateRepository,
  viewer: EstimateViewer,
  estimateId: string,
  event: EstimateEvent,
  tx: Transaction,
): Promise<EstimateTransition> {
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
}

// Over 40 lines on purpose (coding standards section 1): one object of the service's methods, each a few lines; the longer steps are the named helpers above and inside.
export function createEstimateService({ estimates, nodes, transactions }: EstimateDependencies): EstimateService {
  /** Locks the estimate for a change: 404 when it is not this person's, 409 when this person may no longer change its inputs (`assertEditable`). Returns the estimate's ID. */
  async function lockForChange(viewer: EstimateViewer, estimateId: string, tx: Transaction): Promise<string> {
    const estimate = await estimates.lockEstimate(estimateId, tx);
    if (estimate === null || !mayOpen(viewer, estimate.engineerId)) throw new NotFoundError();
    assertEditable(viewer, estimate);
    return estimate.id;
  }

  /** The estimate's ID for a read: 404 when it is not this person's or does not exist. */
  async function openForRead(viewer: EstimateViewer, estimateId: string): Promise<string> {
    const estimate = await estimates.findEstimateAccess(estimateId);
    if (estimate === null || !mayOpen(viewer, estimate.engineerId)) throw new NotFoundError();
    return estimate.id;
  }

  /** What every change to the tree ends with: the places of the siblings that shifted (they get no new revision), the input change, and the tree as it is now. */
  async function finishChange(id: string, shifted: ReadonlyArray<PlacedNode>, tx: Transaction): Promise<PartsTree> {
    await nodes.placeNodes(
      id,
      shifted.map((place) => ({ ...place, bumpRevision: false })),
      tx,
    );
    await estimates.bumpInputsRevision(id, tx);
    return viewsOf(await nodes.listNodes(id, tx));
  }

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

    async getTree(viewer, estimateId) {
      return viewsOf(await nodes.listNodes(await openForRead(viewer, estimateId)));
    },

    async getNode(viewer, estimateId, nodeId) {
      const records = await nodes.listNodes(await openForRead(viewer, estimateId));
      const record = partIn(records, nodeId);
      const view = viewsOf(records).find((candidate) => candidate.id === record.id);
      if (view === undefined) throw new NotFoundError();
      return { ...view, inputs: record.inputs };
    },

    addPart(viewer, estimateId, request) {
      return transactions.run(async (tx) => {
        const id = await lockForChange(viewer, estimateId, tx);
        const before = await nodes.listNodes(id, tx);
        // Under the lock, so two adds at once cannot both pass the limit.
        if (before.length >= MAX_PARTS_PER_ESTIMATE) throw new ValidationError(TREE_FULL_MESSAGE, { code: TREE_FULL_CODE });
        const { parentId, index } = placeForAdd(before, request);
        const created = await nodes.insertNode(id, parentId, index, tx);
        const after = insertNode(placedOf(before), { id: created.id, parentId, index });
        const shifted = changedPlacements([...placedOf(before), { id: created.id, parentId, sortIndex: index }], after);
        return { nodeId: created.id, nodes: await finishChange(id, shifted, tx) };
      });
    },

    moveNode(viewer, estimateId, request) {
      return transactions.run(async (tx) => {
        const id = await lockForChange(viewer, estimateId, tx);
        const before = await nodes.listNodes(id, tx);
        const part = partIn(before, request.nodeId);
        if (part.revision !== request.revision) throw new TreeChangedError(viewsOf(before));
        const parentId = movableParent(before, part.id, request.parentId);
        const placed = placedOf(before);
        const changed = changedPlacements(placed, moveNode(placed, part.id, parentId, request.index));
        // A part that is already where it was asked to go changes nothing: no write, no new revision, and the figures are not cleared for it.
        if (!changed.some((place) => place.id === part.id)) return viewsOf(before);
        await nodes.placeNodes(
          id,
          changed.map((place) => ({ ...place, bumpRevision: place.id === part.id })),
          tx,
        );
        await estimates.bumpInputsRevision(id, tx);
        return viewsOf(await nodes.listNodes(id, tx));
      });
    },

    deleteNode(viewer, estimateId, request) {
      return transactions.run(async (tx) => {
        const id = await lockForChange(viewer, estimateId, tx);
        const before = await nodes.listNodes(id, tx);
        const part = partIn(before, request.nodeId);
        const doomed = [part.id, ...descendantIds(before, part.id)];
        // What the person confirmed must be what would go: the part as they saw it, the same number of parts, and the same parts in the same state. A part added below,
        // moved in or out, replaced by another or typed into since then changes the fingerprint, so it is not deleted unseen (SQR-01).
        const members = before.filter((record) => doomed.includes(record.id));
        if (part.revision !== request.revision || doomed.length !== request.parts || subtreeFingerprint(members) !== request.subtree) throw new TreeChangedError(viewsOf(before));
        await nodes.deleteNodes(id, doomed, tx);
        const placed = placedOf(before);
        const remaining = placed.filter((place) => !doomed.includes(place.id));
        return finishChange(id, changedPlacements(remaining, removeNodes(placed, doomed)), tx);
      });
    },

    transition(viewer, estimateId, event, tx) {
      const apply = (inTransaction: Transaction): Promise<EstimateTransition> => applyTransition(estimates, viewer, estimateId, event, inTransaction);
      return tx === undefined ? transactions.run(apply) : apply(tx);
    },
  };
}
