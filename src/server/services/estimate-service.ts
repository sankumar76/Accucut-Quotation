import type { RoleName } from '../../lib/auth/roles';
import { ConflictError, FieldValidationError, ForbiddenError, NotFoundError, TreeChangedError, ValidationError } from '../../lib/errors';
import { canEditInputs } from '../../lib/estimate/can-edit-inputs';
import { isAllowedChild, NODE_KIND_NAMES, type NodeKind } from '../../lib/estimate/node-kinds';
import { createCompletenessReader, type CompletenessReader } from '../../lib/estimate/part-completeness';
import { partNameOf } from '../../lib/estimate/part-name';
import type { PartView } from '../../lib/estimate/part-view';
import { decideTransition, isLocked, stateOf, TRANSITION_REFUSALS, type EstimateEvent } from '../../lib/estimate/state-machine';
import { subtreeFingerprint } from '../../lib/estimate/subtree-fingerprint';
import type { ConfigDocument } from '../../lib/fields/schema';
import { buildTree, changedPlacements, childCount, descendantIds, insertNode, moveNode, removeNodes, type PlacedNode } from '../../lib/estimate/tree';
import { folderUrlOf } from '../../lib/tasks/folder-path';
import type { EstimateNodeRepository, NodeRecord } from '../repositories/estimate-node-repository';
import type { CustomerChoice, EstimateRepository } from '../repositories/estimate-repository';
import type { ImageRepository, PictureRecord } from '../repositories/image-repository';
import type { EstimateStatus } from '../repositories/task-repository';
import type { Transaction, TransactionRunner } from '../repositories/transaction';

import type { AuditContext, AuditService } from './audit-service';
import { createEstimateInputs, type EstimateForm, type EstimateInputs, type EstimateInputsDependencies } from './estimate-inputs';
import { createImageService, type ImageService } from './image-service';
import { createInputChangeAudit } from './input-change-audit';

/**
 * The estimate workspace (STORY-05.01; FR-042; architecture sections 4.1, 4.8 and 6, "Set customer"): opening a task's estimate and choosing the customer
 * it is for. Who may call is decided before this is reached (`withRoute`, `authorizePage`, the manifest); this file holds the rules that stay true whoever asks:
 *
 *   - **An Engineer sees and changes only their own task.** An estimate that is not theirs and one that does not exist are the same answer (`null` for the
 *     page, `NotFoundError` for the route), so the answer never says that a code or an ID is real (CR-33). A Lead and an Admin may open any.
 *   - **Inputs change only when the state machine says so** (STORY-06.01; FR-064, BR-012). A DRAFT may be changed by whoever has it open; a PREPARED estimate
 *     only by a Lead or an Admin, so the Engineer's inputs are read-only from the first calculation on; an APPROVED one by nobody. The check is
 *     `assertEditable`, the one every write of an input shares, and it is made after the estimate is locked, so it cannot pass while a Calculate or an
 *     approval is changing the status. The order of the refusals is: not found (404), not editable (409), unknown customer (422).
 *   - **Status changes only by `transition`** (STORY-06.01; architecture section 4.4): the row is locked, the person's task and role are checked, then the
 *     machine decides, and the new status is written in the same transaction. Two transitions at once queue on the row lock, so the second sees the status the
 *     first left; a status never skips a step.
 *   - **A changed customer is an input change** (section 4.8): `inputs_revision` goes up by one in the same transaction as the customer. The same customer
 *     again changes nothing, and so raises nothing, which is also what stops a repeated request from clearing a total.
 *   - **Nothing but an ID, a name and a short name of a customer** is read or returned. The figures that depend on the customer are the Admin's and Lead's, never this file's.
 *   - **Only a Lead or an Admin sets the customer** (CR-01 item 6, AQP-390; architecture section 4.11 b): the customer is chosen when a task is assigned, and an Engineer sees it and cannot change it.
 *     The manifest drops the Engineer from the route (403 before the ID is read) and `setCustomer` refuses a viewer who is not a Lead or an Admin as well, before anything is read (defence in depth, as in section 4.10).
 *     The customer is read `FOR SHARE`, so a delete of it waits for the change and then sees the open estimate (BR-053).
 *
 * A customer change writes one `estimate.customer_changed` entry in the same transaction (`audit.record(tx, ...)`, the static check of STORY-10.18), with the company names before and after and no figure.
 *
 * **The parts tree (STORY-05.02; FR-043, FR-044; architecture sections 4.8, 5.1 and 6).** Reading the tree is open to whoever may open the estimate. Every write
 * (add, move, delete) follows one order, so the answer depends on the estimate before it depends on what was sent: the estimate is locked (404 when it is not the
 * person's or does not exist), this person must still be allowed to change its inputs (409, `assertEditable`: a draft for an Engineer, a draft or a prepared estimate for a Lead or an Admin, never an approved one), the part named must be in it (404), the part's `revision` and, for a delete, the count and the
 * fingerprint of the parts the person was shown must still be right (409, with the fresh tree), and only then does the content of a move count (422). All of it is one transaction with the
 * estimate's row lock, so two changes to one tree are serialised and `inputs_revision` rises by one with the change or not at all. A change that moves nothing
 * writes nothing. **The Sl. No is never stored**; it is read from the layout each time (`lib/estimate/tree.ts`). No answer carries a rate, a cost or a formula.
 */

/** Who is asking: the ID and the role of the signed-in person, read from the session on this request. */
export interface EstimateViewer {
  readonly id: string;
  readonly role: RoleName;
}

/** The header of the workspace: the task as it was assigned, with its customer and subject (the same, read-only, for every role). */
export interface Workspace {
  readonly estimateId: string;
  readonly code: string;
  readonly status: EstimateStatus;
  readonly customer: CustomerChoice | null;
  /** The project name (CR-01 item 6). */
  readonly subject: string;
  readonly deadlineAt: Date;
  readonly folderPath: string;
  /** The `file:` link built from the path on the server; the browser is never asked to build one. Null only for a path the portal would not link. */
  readonly folderUrl: string | null;
  readonly title: string;
  readonly notes: string | null;
  readonly assignedByName: string;
  /** The name of the Engineer the task is assigned to (CR-01 item 7D): the Restore dialog says whose Open queue it returns to. A name, never an ID (NFR-002). */
  readonly engineerName: string;
  /** Who marked the estimate as quoted and when, by name (CR-01 item 7C): for a Lead and an Admin only, so it is `null` for an Engineer whatever the row holds (NFR-002, ADR-008). `null` while the estimate is not QUOTED. */
  readonly quoted: { readonly at: Date; readonly byName: string } | null;
  /**
   * The Ignored layer over the status (ADR-019; CR-01 item 7D, AQP-401 AC-9): who set it (by name, never an ID), when, and the Lead's remarks, or `null` while the estimate is not ignored. **The same for every role**: an Engineer's own ignored task
   * reads its notice from it (the remarks are the Lead's words, no figure, NFR-002), and the estimate of another Engineer is not found before this is read.
   */
  readonly ignored: { readonly at: Date; readonly byName: string; readonly remarks: string } | null;
}

/** What choosing a customer answers: the estimate and the customer it is now for. */
export interface EstimateCustomer {
  readonly id: string;
  readonly status: EstimateStatus;
  readonly customer: CustomerChoice;
}

/** One part with what was typed into it. */
export interface PartDetail extends PartView {
  readonly inputs: Readonly<Record<string, string>>;
  /** The part's picture (STORY-05.07): its ID, sanitised name and size, never the bytes; null when it has none (Part Model is optional, D-31). */
  readonly picture: PictureRecord | null;
}

/** The tree in reading order, depth first. */
export type PartsTree = ReadonlyArray<PartView>;

/**
 * What a person asks to add (CR-01 item 3A; SPEC 6.1): a row of this kind, **last** under `parentId` (null: the top level, where only a MAIN_ASSEMBLY may go). The kind must be one the parent's kind
 * allows (`ALLOWED_CHILDREN`). It replaces the `item`, `sub-part` and `beside` union, whose `kind` would clash with the node kind.
 */
export interface AddPartRequest {
  readonly parentId: string | null;
  readonly nodeKind: NodeKind;
}

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
 * The most parts one estimate may hold. **Decision (DL-217)**: NFR-008 sizes Calculate and the screens at 500 parts,
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

/** The `code` of the 422 of an add whose kind the parent's kind does not allow (`ALLOWED_CHILDREN`), under `nodeKind`. */
export const NODE_KIND_NOT_ALLOWED_CODE = 'NODE_KIND_NOT_ALLOWED';
/** The `code` of the 422 of a move to a parent other than the part's own (A-CR01-5, confirmed 2026-11-23: a row is reordered only among rows with the same parent), under `parentId`. */
export const MOVE_ACROSS_PARENTS_CODE = 'MOVE_ACROSS_PARENTS';
export const MOVE_ACROSS_PARENTS_MESSAGE = 'A part can only be moved among the parts under the same parent.';

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
export function assertEditable(viewer: EstimateViewer, estimate: { readonly status: EstimateStatus; readonly ignoredAt: Date | null }): void {
  const state = stateOf(estimate);
  // An ignored estimate is refused with its own code and words, whatever its status underneath (architecture section 4.12 c, DL-300): the person is told to Restore it, not that it is locked.
  if (state.ignored) throw new ConflictError(TRANSITION_REFUSALS.IGNORED.message, { code: TRANSITION_REFUSALS.IGNORED.code });
  if (!canEditInputs(state, viewer.role)) throw new ConflictError(NOT_EDITABLE_MESSAGE, { code: ESTIMATE_NOT_EDITABLE_CODE });
}

export interface EstimateService {
  /**
   * The workspace of the task with this code, or `null` when there is none for this person: no such code, and an Engineer asking for another's task, are the
   * same answer. A Lead and an Admin may open any.
   */
  getWorkspace(viewer: EstimateViewer, code: string): Promise<Workspace | null>;
  /**
   * Changes the customer of an estimate (`PUT /api/v1/estimates/{id}/customer`), for a Lead or an Admin only: 403 for any other viewer, before anything is read. 404 for an estimate that does not exist, 409 when it
   * is not editable (`assertEditable`: anyone's approved one), 422 under `customerId` for a customer that does not exist or was deleted. The same customer again writes nothing and no entry. A real change raises
   * `inputs_revision` and writes one `estimate.customer_changed` entry, in the same transaction.
   */
  setCustomer(viewer: EstimateViewer, audit: AuditContext, estimateId: string, customerId: string): Promise<EstimateCustomer>;
  /** The parts tree (`GET /api/v1/estimates/{id}/tree`): 404 for an estimate that is not this person's or does not exist. The same answer for every role. */
  getTree(viewer: EstimateViewer, estimateId: string): Promise<PartsTree>;
  /** One part with what was typed into it (`GET /api/v1/estimates/{id}/nodes/{nodeId}`): 404 for an estimate or a part that is not there for this person. */
  getNode(viewer: EstimateViewer, estimateId: string, nodeId: string): Promise<PartDetail>;
  /**
   * The form and one part together, for a page that hands both to the part form as props (DEF-141): **exactly what `getForm` and `getNode` answer**, for the same viewer, with the same refusals (404 for an estimate or a part
   * that is not there for this person), but with one access check, one read of the configuration and one listing of the parts instead of two of each.
   */
  getPartForm(viewer: EstimateViewer, estimateId: string, nodeId: string): Promise<{ readonly form: EstimateForm; readonly node: PartDetail }>;
  /**
   * The same pair for **the first row of the parts tree** (`getTree`'s first answer), for the Engineer's page, which hands the part form its data as props (DEF-085, DL-469): the form shows the first row until another is
   * chosen, so the page needs no row to ask for. **Exactly what `getForm` and `getNode(first row)` answer**, for the same viewer, with the same refusals (404 for an estimate that is not this person's), with one access
   * check, one read of the configuration and one listing of the parts. `null` when the estimate has no rows.
   */
  getFirstPartForm(viewer: EstimateViewer, estimateId: string): Promise<{ readonly form: EstimateForm; readonly node: PartDetail } | null>;
  /** Adds a part with empty inputs (`POST /api/v1/estimates/{id}/nodes`). 404, 409 not editable by this person, 422 `TREE_FULL` at `MAX_PARTS_PER_ESTIMATE` parts. Answers with the new part's ID and the tree. */
  addPart(viewer: EstimateViewer, estimateId: string, request: AddPartRequest, audit?: AuditContext): Promise<AddedPart>;
  /** Moves a part (`PUT .../nodes/{nodeId}`, `POST .../tree/move`). 404, 409 (not editable by this person, or a stale revision, with the tree), 422 under `parentId`. Answers with the tree. */
  moveNode(viewer: EstimateViewer, estimateId: string, request: MovePartRequest, audit?: AuditContext): Promise<PartsTree>;
  /** Deletes a part and its sub-parts (`DELETE .../nodes/{nodeId}`). 404, 409 (not editable by this person, a stale revision, or a count that is no longer right, with the tree). Answers with the tree. */
  deleteNode(viewer: EstimateViewer, estimateId: string, request: DeletePartRequest, audit?: AuditContext): Promise<PartsTree>;
  /** The sections of the part form and the time of the last save (`GET /api/v1/estimates/{id}/form`, STORY-05.03): the same for every role, built from the registry, no cost. 404 for an estimate that is not this person's. */
  getForm: EstimateInputs['getForm'];
  /** Saves values into a part (`PATCH /api/v1/estimates/{id}/nodes/{nodeId}/inputs`, STORY-05.03). 404, 409 (not editable by this person, or a stale revision), 422 under each field at fault. A real change raises the part's revision and `inputs_revision`; the same value again raises neither. */
  saveInputs: EstimateInputs['saveInputs'];
  /** Adds or replaces a part's picture (`PUT .../nodes/{nodeId}/image`, STORY-05.07). 404, 409 (not editable by this person), 413 (200 x 1024 bytes or more), 415 (not a PNG, JPEG, GIF or WebP by its content). A real change raises the part's revision and `inputs_revision`. */
  putPicture: ImageService['putPicture'];
  /** Removes a part's picture (`DELETE .../nodes/{nodeId}/image`). 404, 409. A part with none changes nothing. */
  removePicture: ImageService['removePicture'];
  /** The stored type and bytes of a picture (`GET /api/v1/images/{id}`): only for a person who may open its estimate; 404 otherwise, the same as for one that does not exist. */
  getPicture: ImageService['getPicture'];

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
  /** The audit entry of a customer change (CR-01 item 6), written in the change's transaction. A service built without it refuses to change a customer (as the task service refuses to reassign). */
  readonly audit?: AuditService | undefined;
  readonly nodes: EstimateNodeRepository;
  /** The part pictures (STORY-05.07). */
  readonly images: ImageRepository;
  readonly transactions: TransactionRunner;
  /** The Material Master lookup of a part's material and the field registry the form is built from (STORY-05.03; see `estimate-inputs.ts`). */
  readonly materials: EstimateInputsDependencies['materials'];
  readonly currentConfiguration: EstimateInputsDependencies['currentConfiguration'];
  /** One configuration version's document by its ID (cached per version): the registry an APPROVED estimate's form is built from (STORY-08.05). */
  readonly configurationById: (versionId: string) => Promise<ConfigDocument>;
}

const mayOpen = (viewer: EstimateViewer, engineerId: string): boolean => viewer.role !== 'ENGINEER' || viewer.id.toLowerCase() === engineerId.toLowerCase();

/** What an answer is built with, once: how complete a part is, and its name. Both are read from the part's inputs with no query per part. */
interface ViewReaders {
  /** The registry this estimate's form is built from, read here with the rest so that no write reads it on a second connection while it holds the estimate's lock (the audit entry of a Lead's tree write names rows by it). */
  readonly document: ConfigDocument;
  readonly completenessOf: CompletenessReader;
  /** The part's name: its Description, else its Part No., else an empty text (`partNameOf`, the reader SCR-06 and SCR-07 use). An input typed by the person, never a figure (AQP-446, DEF-089). */
  readonly nameOf: (inputs: Readonly<Record<string, unknown>>) => string;
}

/** The parts in reading order, each with its Sl. No read from the layout, its name and how complete it is by the rule of Calculate (`readers`, built once for the answer: no query per part). */
function viewsOf(records: ReadonlyArray<NodeRecord>, readers: ViewReaders): PartView[] {
  return buildTree(records).map(({ node, slNo }) => ({ id: node.id, parentId: node.parentId, slNo, label: readers.nameOf(node.inputs), nodeKind: node.nodeKind, completeness: readers.completenessOf(node.inputs), revision: node.revision }));
}

/** The part with this ID in a list read from the estimate (never a part of another estimate), or a 404. An ID is compared in lower case, as the database writes it. */
function partIn(records: ReadonlyArray<NodeRecord>, nodeId: string): NodeRecord {
  const found = records.find((record) => record.id === nodeId.toLowerCase());
  if (found === undefined) throw new NotFoundError();
  return found;
}

const placedOf = (records: ReadonlyArray<NodeRecord>): PlacedNode[] => records.map(({ id, parentId, sortIndex }) => ({ id, parentId, sortIndex }));

/**
 * Where a new row goes and whether its kind may go there (AC-3): **last** under the parent named (404 for a parent that is not in this estimate; null is the top level), and 422 under
 * `nodeKind` with `NODE_KIND_NOT_ALLOWED` when `ALLOWED_CHILDREN` does not allow the kind under the parent's kind. Only a new add is checked: a legacy tree deeper than the table allows stays as it is (AC-6).
 */
function placeForAdd(records: ReadonlyArray<NodeRecord>, request: AddPartRequest): { readonly parentId: string | null; readonly index: number } {
  const parent = request.parentId === null ? null : partIn(records, request.parentId);
  if (!isAllowedChild(parent?.nodeKind ?? null, request.nodeKind)) {
    const under = parent === null ? 'at the top of the tree' : `under a ${NODE_KIND_NAMES[parent.nodeKind]}`;
    throw new FieldValidationError([{ field: 'nodeKind', message: `A ${NODE_KIND_NAMES[request.nodeKind]} cannot be added ${under}.` }], { code: NODE_KIND_NOT_ALLOWED_CODE });
  }
  return { parentId: parent?.id ?? null, index: childCount(records, parent?.id ?? null) };
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
  const state = stateOf(estimate);
  const decision = decideTransition(state, event, viewer.role);
  if (!decision.allowed) {
    // A role that may never apply the event is refused before the status is looked at. An Engineer gets the uniform "not found" (CR-33); a Lead gets 403.
    if (decision.kind === 'ROLE') throw viewer.role === 'ENGINEER' ? new NotFoundError() : new ForbiddenError();
    const refusal = TRANSITION_REFUSALS[decision.reason];
    throw new ConflictError(refusal.message, { code: refusal.code });
  }
  // Ignore and Restore change the layer over the status, which this function does not write (story 7D adds the service that does, with its audit entry): refuse to report them as done.
  if (decision.ignored !== state.ignored) throw new Error('Ignore and Restore are not written by the status transition.');
  // A transition that keeps the status (Recalculate of a prepared estimate, an edit, an export) writes nothing here; what it does is its own story's.
  if (decision.to !== decision.from) {
    // Marking as quoted records the person with the status, in the same UPDATE (`setStatus`); every other move leaves no quote marker behind.
    const moved = await estimates.setStatus(estimate.id, decision.from, decision.to, tx, decision.to === 'QUOTED' ? viewer.id : undefined);
    if (!moved) throw new ConflictError(STATUS_CHANGED_MESSAGE, { code: ESTIMATE_STATUS_CHANGED_CODE });
  }
  return { id: estimate.id, from: decision.from, to: decision.to };
}

// Over 40 lines on purpose (coding standards section 1): one object of the service's methods, each a few lines; the longer steps are the named helpers above and inside.
export function createEstimateService({ estimates, audit, nodes, images, transactions, materials, currentConfiguration, configurationById }: EstimateDependencies): EstimateService {
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

  /**
   * The registry the form of this estimate is built from (STORY-08.05; FR-065, FR-077, SPEC section 8.4). **An APPROVED estimate keeps the fields it was approved with**: its form is the document of the version of its current
   * calculation, so a field inserted later does not appear on it and a field deleted later is still shown with its stored value. Every other estimate (a new Draft, an unlocked one, one whose approval was cancelled, a
   * Prepared one that was never approved) uses the latest version. The status and the version are read in one statement, each time, so an unlock is seen at once. The version is never part of an answer (NFR-002).
   */
  async function configurationFor(estimateId: string): Promise<ConfigDocument> {
    const basis = await estimates.findConfigurationBasis(estimateId);
    // A locked estimate (approved or quoted) keeps the fields it was approved with; a quoted one is an approved one the quote has gone out for, so its form does not change either.
    return basis !== null && isLocked(basis.status) && basis.configVersionId !== null ? configurationById(basis.configVersionId) : currentConfiguration();
  }

  /** What every change to the tree ends with: the places of the siblings that shifted (they get no new revision), the input change, and the tree as it is now. */
  async function finishChange(id: string, shifted: ReadonlyArray<PlacedNode>, readers: ViewReaders, tx: Transaction): Promise<PartsTree> {
    await nodes.placeNodes(
      id,
      shifted.map((place) => ({ ...place, bumpRevision: false })),
      tx,
    );
    await estimates.bumpInputsRevision(id, tx);
    return viewsOf(await nodes.listNodes(id, tx), readers);
  }

  /**
   * What an answer about the tree is built with. The completeness rule is for the registry as it is now; the name is read from the registry the estimate's own form is built from (`configurationFor`: an approved
   * estimate keeps the fields it was approved with). Read before a transaction opens, as the form's save does, so it holds no connection and no lock while it is read (a version never changes).
   */
  const viewReaders = async (estimateId: string): Promise<ViewReaders> => {
    const [current, document] = await Promise.all([currentConfiguration(), configurationFor(estimateId)]);
    return { document, completenessOf: createCompletenessReader(current), nameOf: (typed) => partNameOf(document, typed) };
  };

  // The trail of a Lead's or an Admin's writes to inputs, pictures and the tree (DEF-131 stage 2): written in each write's own transaction, so the write fails when the entry cannot be written.
  const traces = createInputChangeAudit({ audit, estimates, nodes, materials });

  // The part form shares the estimate's lock and its rules for who may open or change it, so they are handed over and not written twice.
  const inputs = createEstimateInputs({ nodes, materials, currentConfiguration, configurationFor, transactions, openForRead, lockForChange, bumpInputsRevision: (estimateId, tx) => estimates.bumpInputsRevision(estimateId, tx), traces });

  // The part pictures share the same lock and the same rules, handed over in the same way (STORY-05.07).
  const pictures = createImageService({ nodes, images, transactions, currentConfiguration, lockForChange, bumpInputsRevision: (estimateId, tx) => estimates.bumpInputsRevision(estimateId, tx), mayOpen, traces });

  return {
    getForm: inputs.getForm,
    saveInputs: inputs.saveInputs,
    putPicture: pictures.putPicture,
    removePicture: pictures.removePicture,
    getPicture: pictures.getPicture,

    async getWorkspace(viewer, code) {
      const record = await estimates.findWorkspaceByCode(code);
      if (record === null || !mayOpen(viewer, record.engineerId)) return null;
      return {
        estimateId: record.estimateId,
        code: record.code,
        status: record.status,
        customer: record.customer,
        subject: record.subject,
        deadlineAt: record.deadlineAt,
        folderPath: record.folderPath,
        folderUrl: folderUrlOf(record.folderPath),
        title: record.title,
        notes: record.notes,
        assignedByName: record.assignedByName,
        engineerName: record.engineerName,
        // The marker is the Lead's and the Admin's (ADR-008): an Engineer reads the status word and nothing of who marked it.
        quoted: viewer.role === 'ENGINEER' || record.quoted === null ? null : { at: record.quoted.at, byName: record.quoted.byName },
        ignored: record.ignored === null ? null : { at: record.ignored.at, byName: record.ignored.byName, remarks: record.ignored.remarks },
      };
    },

    setCustomer(viewer, context, estimateId, customerId) {
      // Only a Lead or an Admin sets the customer, whoever the estimate belongs to and whether or not it exists: refused before anything is read, so the answer is the same for every ID (AC-7).
      // An allow-list: a role added later gets nothing until someone decides, as the manifest row does.
      if (viewer.role !== 'LEAD' && viewer.role !== 'ADMIN') return Promise.reject(new ForbiddenError());
      if (audit === undefined) return Promise.reject(new Error('This estimate service was built without the audit service, so it cannot change a customer.'));
      return transactions.run(async (tx) => {
        const estimate = await estimates.lockEstimate(estimateId, tx);
        if (estimate === null) throw new NotFoundError();
        assertEditable(viewer, estimate);
        const customer = await estimates.findActiveCustomer(customerId, tx);
        if (customer === null) throw new FieldValidationError([{ field: 'customerId', message: CUSTOMER_CHOICE_MESSAGE }]);
        // The same customer again is no change: no write, no new revision and no entry.
        if (estimate.customerId !== null && estimate.customerId.toLowerCase() === customer.id.toLowerCase()) {
          return { id: estimate.id, status: estimate.status, customer };
        }
        // The customer replaced is named in the entry even when the Admin has deleted it since (a deleted customer is still the estimate's until it is changed).
        const previous = estimate.customerId === null ? null : await estimates.findCustomerChoice(estimate.customerId, tx);
        await estimates.setCustomer(estimate.id, customer.id, tx);
        await audit.record(tx, {
          event: 'estimate.customer_changed',
          ...context,
          object: { id: estimate.id, label: estimate.taskCode },
          before: { customer: previous === null ? null : { name: previous.name, shortName: previous.shortName } },
          after: { customer: { name: customer.name, shortName: customer.shortName } },
        });
        return { id: estimate.id, status: estimate.status, customer };
      });
    },

    async getTree(viewer, estimateId) {
      const id = await openForRead(viewer, estimateId);
      return viewsOf(await nodes.listNodes(id), await viewReaders(id));
    },

    async getNode(viewer, estimateId, nodeId) {
      const records = await nodes.listNodes(await openForRead(viewer, estimateId));
      const record = partIn(records, nodeId);
      const view = viewsOf(records, await viewReaders(estimateId)).find((candidate) => candidate.id === record.id);
      if (view === undefined) throw new NotFoundError();
      // Of what is stored, only the values of fields of the form leave (ADR-008: the answer is built from an allow-list).
      return { ...view, inputs: await inputs.visibleInputs(estimateId, record.inputs), picture: await pictures.pictureOf(estimateId, record.imageId) };
    },

    async getPartForm(viewer, estimateId, nodeId) {
      const id = await openForRead(viewer, estimateId);
      const [records, readers, written] = await Promise.all([nodes.listNodes(id), viewReaders(id), nodes.lastWrittenAt(id)]);
      const record = partIn(records, nodeId);
      const view = viewsOf(records, readers).find((candidate) => candidate.id === record.id);
      if (view === undefined) throw new NotFoundError();
      const node = { ...view, inputs: inputs.visibleInputsOf(readers.document, record.inputs), picture: await pictures.pictureOf(id, record.imageId) };
      return { form: inputs.formOf(readers.document, written), node };
    },

    async getFirstPartForm(viewer, estimateId) {
      const id = await openForRead(viewer, estimateId);
      const [records, readers, written] = await Promise.all([nodes.listNodes(id), viewReaders(id), nodes.lastWrittenAt(id)]);
      // The first row of the tree as `getTree` answers it (`viewsOf` is the tree's own order), and the record that row is: the part is then read exactly as `getPartForm` reads it.
      const view = viewsOf(records, readers)[0];
      if (view === undefined) return null;
      const record = partIn(records, view.id);
      const node = { ...view, inputs: inputs.visibleInputsOf(readers.document, record.inputs), picture: await pictures.pictureOf(id, record.imageId) };
      return { form: inputs.formOf(readers.document, written), node };
    },

    async addPart(viewer, estimateId, request, audit) {
      const trace = traces.traceFor(viewer, audit);
      const readers = await viewReaders(estimateId);
      return transactions.run(async (tx) => {
        const id = await lockForChange(viewer, estimateId, tx);
        const before = await nodes.listNodes(id, tx);
        // Under the lock, so two adds at once cannot both pass the limit.
        if (before.length >= MAX_PARTS_PER_ESTIMATE) throw new ValidationError(TREE_FULL_MESSAGE, { code: TREE_FULL_CODE });
        const { parentId, index } = placeForAdd(before, request);
        const created = await nodes.insertNode(id, parentId, request.nodeKind, index, tx);
        const after = insertNode(placedOf(before), { id: created.id, parentId, index });
        const shifted = changedPlacements([...placedOf(before), { id: created.id, parentId, sortIndex: index }], after);
        const tree = await finishChange(id, shifted, readers, tx);
        if (trace !== null) await trace.audit.recordMany(tx, await trace.partAdded(tx, { estimateId: id, document: readers.document, nodeId: created.id, after: await nodes.listNodes(id, tx) }));
        return { nodeId: created.id, nodes: tree };
      });
    },

    async moveNode(viewer, estimateId, request, audit) {
      const trace = traces.traceFor(viewer, audit);
      const readers = await viewReaders(estimateId);
      return transactions.run(async (tx) => {
        const id = await lockForChange(viewer, estimateId, tx);
        const before = await nodes.listNodes(id, tx);
        const part = partIn(before, request.nodeId);
        if (part.revision !== request.revision) throw new TreeChangedError(viewsOf(before, readers));
        // One refusal, one place (A-CR01-5, confirmed by the customer on 2026-11-23): a row is reordered only among rows with the same parent. This also keeps a row out of its own subtree and out of another estimate, because the
        // only parent allowed is the one it already has. If the customer ever asks for "other parents", this line goes and, instead, the parent must exist in this estimate, must not be the row
        // or one of its descendants (`canMove` in `lib/estimate/tree.ts` is that check, unused until then) and must allow the moving row's kind (`isAllowedChild`).
        if ((request.parentId?.toLowerCase() ?? null) !== part.parentId) throw new FieldValidationError([{ field: 'parentId', message: MOVE_ACROSS_PARENTS_MESSAGE }], { code: MOVE_ACROSS_PARENTS_CODE });
        const placed = placedOf(before);
        const changed = changedPlacements(placed, moveNode(placed, part.id, part.parentId, request.index));
        // A part that is already where it was asked to go changes nothing: no write, no new revision, and the figures are not cleared for it.
        if (!changed.some((place) => place.id === part.id)) return viewsOf(before, readers);
        await nodes.placeNodes(
          id,
          changed.map((place) => ({ ...place, bumpRevision: place.id === part.id })),
          tx,
        );
        await estimates.bumpInputsRevision(id, tx);
        const after = await nodes.listNodes(id, tx);
        if (trace !== null) await trace.audit.recordMany(tx, await trace.partMoved(tx, { estimateId: id, document: readers.document, nodeId: part.id, before, after }));
        return viewsOf(after, readers);
      });
    },

    async deleteNode(viewer, estimateId, request, audit) {
      const trace = traces.traceFor(viewer, audit);
      const readers = await viewReaders(estimateId);
      return transactions.run(async (tx) => {
        const id = await lockForChange(viewer, estimateId, tx);
        const before = await nodes.listNodes(id, tx);
        const part = partIn(before, request.nodeId);
        const doomed = [part.id, ...descendantIds(before, part.id)];
        // What the person confirmed must be what would go: the part as they saw it, the same number of parts, and the same parts in the same state. A part added below,
        // moved in or out, replaced by another or typed into since then changes the fingerprint, so it is not deleted unseen (SQR-01).
        const members = before.filter((record) => doomed.includes(record.id));
        if (part.revision !== request.revision || doomed.length !== request.parts || subtreeFingerprint(members) !== request.subtree) throw new TreeChangedError(viewsOf(before, readers));
        await nodes.deleteNodes(id, doomed, tx);
        if (trace !== null) await trace.audit.recordMany(tx, await trace.partDeleted(tx, { estimateId: id, document: readers.document, nodeId: part.id, before, doomed }));
        const placed = placedOf(before);
        const remaining = placed.filter((place) => !doomed.includes(place.id));
        return finishChange(id, changedPlacements(remaining, removeNodes(placed, doomed)), readers, tx);
      });
    },

    transition(viewer, estimateId, event, tx) {
      const apply = (inTransaction: Transaction): Promise<EstimateTransition> => applyTransition(estimates, viewer, estimateId, event, inTransaction);
      return tx === undefined ? transactions.run(apply) : apply(tx);
    },
  };
}
