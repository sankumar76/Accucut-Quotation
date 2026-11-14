import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome, type Refusal } from '../api-client';

/**
 * The browser's side of the parts-tree routes (STORY-05.02; SCR-05; architecture section 6 "Tree", "Node", "Reorder"): read the tree, add a part, move one, delete one.
 * Nothing here decides anything: who may change the tree, whether the estimate is still a draft, whether a move is allowed and what a Sl. No is are the server's, and
 * this file only reads its answer (an answer of the wrong shape is a failure, not a crash). A part is six facts and no figure.
 */

export type Completeness = 'EMPTY' | 'PARTIAL' | 'COMPLETE';

export interface PartItem {
  readonly id: string;
  readonly parentId: string | null;
  readonly slNo: string;
  readonly label: string;
  readonly completeness: Completeness;
  readonly revision: number;
}

/** The tree as the server has it, and the part a call added (null for any other call). */
export interface TreeAnswer {
  readonly nodes: ReadonlyArray<PartItem>;
  readonly nodeId: string | null;
}

/** The code of the 409 for a part, or a count of parts, that changed under the person. Its body carries the tree as it is now. */
export const TREE_CHANGED_CODE = 'TREE_CHANGED';

const isCompleteness = (value: unknown): value is Completeness => value === 'EMPTY' || value === 'PARTIAL' || value === 'COMPLETE';

function toPart(value: unknown): PartItem | null {
  if (!isRecord(value)) return null;
  const { id, parentId, slNo, label, completeness, revision } = value;
  const parentOk = parentId === null || (typeof parentId === 'string' && parentId !== '');
  if (typeof id !== 'string' || id === '' || !parentOk || typeof slNo !== 'string' || slNo === '' || typeof label !== 'string') return null;
  if (!isCompleteness(completeness) || typeof revision !== 'number') return null;
  return { id, parentId: parentId === null ? null : String(parentId), slNo, label, completeness, revision };
}

function toParts(value: unknown): ReadonlyArray<PartItem> | null {
  if (!Array.isArray(value)) return null;
  const parts = value.map(toPart);
  return parts.every((part) => part !== null) ? parts : null;
}

function toAnswer(body: unknown): TreeAnswer | null {
  if (!isRecord(body)) return null;
  const nodes = toParts(body['nodes']);
  const nodeId = body['nodeId'];
  if (nodes === null) return null;
  return { nodes, nodeId: typeof nodeId === 'string' && nodeId !== '' ? nodeId : null };
}

/** The tree a 409 `TREE_CHANGED` carries, or null for any other refusal. */
export function treeFromRefusal(refusal: Refusal): ReadonlyArray<PartItem> | null {
  return refusal.httpStatus === 409 && refusal.code === TREE_CHANGED_CODE ? toParts(refusal.body['tree']) : null;
}

const base = (estimateId: string): string => `/api/v1/estimates/${encodeURIComponent(estimateId)}`;

/** `GET /api/v1/estimates/{id}/tree`. */
export function loadTree(estimateId: string, doFetch: Fetch = fetch): Promise<Outcome<TreeAnswer>> {
  return sendJson(doFetch, `${base(estimateId)}/tree`, { method: 'GET', headers: ACCEPT_JSON }, toAnswer);
}

/** What to add: a new item at the top, or a sub-part or a part beside the part named. */
export type AddRequest = { readonly kind: 'item' } | { readonly kind: 'sub-part' | 'beside'; readonly nodeId: string };

/** `POST /api/v1/estimates/{id}/nodes`: the answer is the tree and the part added. */
export function addPart(estimateId: string, request: AddRequest, doFetch: Fetch = fetch): Promise<Outcome<TreeAnswer>> {
  return sendJson(doFetch, `${base(estimateId)}/nodes`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(request) }, toAnswer);
}

export interface MoveRequest {
  readonly nodeId: string;
  /** The part's revision as the person saw it. */
  readonly revision: number;
  readonly parentId: string | null;
  /** The place the part is to end up in among its new siblings (0 is first). */
  readonly index: number;
}

/** `POST /api/v1/estimates/{id}/tree/move`: the answer is the tree. */
export function movePart(estimateId: string, request: MoveRequest, doFetch: Fetch = fetch): Promise<Outcome<TreeAnswer>> {
  return sendJson(doFetch, `${base(estimateId)}/tree/move`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(request) }, toAnswer);
}

export interface DeleteRequest {
  readonly nodeId: string;
  readonly revision: number;
  /** How many parts the person was told would go: the part and every sub-part. */
  readonly parts: number;
  /** The fingerprint of those parts with their revisions, from the tree the dialog showed (`subtreeFingerprint`). */
  readonly subtree: string;
}

/** `DELETE /api/v1/estimates/{id}/nodes/{nodeId}?revision=&parts=&subtree=`: the answer is the tree that is left. */
export function deletePart(estimateId: string, request: DeleteRequest, doFetch: Fetch = fetch): Promise<Outcome<TreeAnswer>> {
  const query = `revision=${String(request.revision)}&parts=${String(request.parts)}&subtree=${request.subtree}`;
  return sendJson(doFetch, `${base(estimateId)}/nodes/${encodeURIComponent(request.nodeId)}?${query}`, { method: 'DELETE', headers: ACCEPT_JSON }, toAnswer);
}
