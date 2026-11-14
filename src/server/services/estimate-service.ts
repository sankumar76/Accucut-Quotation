import type { RoleName } from '../../lib/auth/roles';
import { ConflictError, FieldValidationError, NotFoundError, TreeChangedError } from '../../lib/errors';
import type { Completeness, PartView } from '../../lib/estimate/part-view';
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
 *   - **Only a draft changes.** A SUBMITTED or an APPROVED estimate refuses with 409, and the check is made after the estimate is locked, so it cannot pass
 *     while a Calculate is submitting it. The order of the refusals is: not found (404), not a draft (409), unknown customer (422).
 *   - **A changed customer is an input change** (section 4.8): `inputs_revision` goes up by one in the same transaction as the customer. The same customer
 *     again changes nothing, and so raises nothing, which is also what stops a repeated request from clearing a total.
 *   - **Nothing but an ID and a name of a customer** is read or returned. The figures that depend on the customer are the Admin's and Lead's, never this file's.
 *
 * There is no audit entry: the audit log of architecture section 8 lists no event for a customer chosen on an estimate.
 *
 * **The parts tree (STORY-05.02; FR-043, FR-044; architecture sections 4.8, 5.1 and 6).** Reading the tree is open to whoever may open the estimate. Every write
 * (add, move, delete) follows one order, so the answer depends on the estimate before it depends on what was sent: the estimate is locked (404 when it is not the
 * person's or does not exist), it must be a draft (409), the part named must be in it (404), the part's `revision` and, for a delete, the count of parts the
 * person was shown must still be right (409, with the fresh tree), and only then does the content of a move count (422). All of it is one transaction with the
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

/** Delete a part and its sub-parts. `parts` is the number the person was told would go (the part and every sub-part): a different number is a 409. */
export interface DeletePartRequest {
  readonly nodeId: string;
  readonly revision: number;
  readonly parts: number;
}

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
  /** The parts tree (`GET /api/v1/estimates/{id}/tree`): 404 for an estimate that is not this person's or does not exist. The same answer for every role. */
  getTree(viewer: EstimateViewer, estimateId: string): Promise<PartsTree>;
  /** One part with what was typed into it (`GET /api/v1/estimates/{id}/nodes/{nodeId}`): 404 for an estimate or a part that is not there for this person. */
  getNode(viewer: EstimateViewer, estimateId: string, nodeId: string): Promise<PartDetail>;
  /** Adds a part with empty inputs (`POST /api/v1/estimates/{id}/nodes`). 404, 409 not a draft. Answers with the new part's ID and the tree. */
  addPart(viewer: EstimateViewer, estimateId: string, request: AddPartRequest): Promise<AddedPart>;
  /** Moves a part (`PUT .../nodes/{nodeId}`, `POST .../tree/move`). 404, 409 (not a draft, or a stale revision, with the tree), 422 under `parentId`. Answers with the tree. */
  moveNode(viewer: EstimateViewer, estimateId: string, request: MovePartRequest): Promise<PartsTree>;
  /** Deletes a part and its sub-parts (`DELETE .../nodes/{nodeId}`). 404, 409 (not a draft, a stale revision, or a count that is no longer right, with the tree). Answers with the tree. */
  deleteNode(viewer: EstimateViewer, estimateId: string, request: DeletePartRequest): Promise<PartsTree>;
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

// Over 40 lines on purpose (coding standards section 1): one object of the service's methods, each a few lines; the longer steps are the named helpers above and inside.
export function createEstimateService({ estimates, nodes, transactions }: EstimateDependencies): EstimateService {
  /** Locks the estimate for a change: 404 when it is not this person's, 409 when it is no longer a draft. Returns the estimate's ID. */
  async function lockForChange(viewer: EstimateViewer, estimateId: string, tx: Transaction): Promise<string> {
    const estimate = await estimates.lockEstimate(estimateId, tx);
    if (estimate === null || !mayOpen(viewer, estimate.engineerId)) throw new NotFoundError();
    assertEditable(estimate.status);
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
        // The count the person confirmed must be what would go, and the part must be as they saw it: a part added below, or typed into, since then is not deleted unseen.
        if (part.revision !== request.revision || doomed.length !== request.parts) throw new TreeChangedError(viewsOf(before));
        await nodes.deleteNodes(id, doomed, tx);
        const placed = placedOf(before);
        const remaining = placed.filter((place) => !doomed.includes(place.id));
        return finishChange(id, changedPlacements(remaining, removeNodes(placed, doomed)), tx);
      });
    },
  };
}
