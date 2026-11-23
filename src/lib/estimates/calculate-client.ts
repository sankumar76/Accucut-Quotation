import { CALCULATE_BLOCKED_CODE, CALCULATE_PREPARED_STATUS } from '../estimate/calculate-words';
import { CALCULATE_ACK_REQUIRED_CODE } from '../estimate/warning-copy';
import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome, type Refusal } from '../api-client';

import type { BlockedPartView, MissingFieldView } from './calculate-missing';

/**
 * The browser's side of Calculate (STORY-05.09; SCR-05 "Calculate blocked" and "Prepared"; architecture section 6 "Calculate"): press the button, and read the answer. Nothing here decides
 * anything: whether the estimate is the person's, whether it is a draft, which inputs are missing and whether the masters allow a calculation are the server's, and this file only reads what it says
 * (an answer of the wrong shape is a failure, not a crash). **The one good answer is a status and a sentence**; there is no figure in it to read, and none is asked for (NFR-002).
 */

/** What a good Calculate answers: the estimate is now prepared, and the sentence to show. */
export interface CalculateDone {
  readonly status: typeof CALCULATE_PREPARED_STATUS;
  readonly message: string;
}

const toDone = (body: unknown): CalculateDone | null =>
  isRecord(body) && body['status'] === CALCULATE_PREPARED_STATUS && typeof body['message'] === 'string' && body['message'] !== '' ? { status: CALCULATE_PREPARED_STATUS, message: body['message'] } : null;

const calculatePath = (estimateId: string): string => `/api/v1/estimates/${encodeURIComponent(estimateId)}/calculate`;

/** `POST /api/v1/estimates/{id}/calculate`, the first press: no body. A 0 in QTY per Assy earns the 409 that `warningFrom` reads. */
export function calculateEstimate(estimateId: string, doFetch: Fetch = fetch): Promise<Outcome<CalculateDone>> {
  return sendJson(doFetch, calculatePath(estimateId), { method: 'POST', headers: ACCEPT_JSON }, toDone);
}

/**
 * "Calculate anyway" (STORY-05.12 AC-3): the same `POST` with `{acknowledge: {inputsRevision}}`, the revision from the 409 the person saw. The server compares it with the estimate's own under its lock, so
 * an acknowledgement is only ever good for the state it was given for; this sends what it was told to and decides nothing.
 */
export function calculateAnyway(estimateId: string, inputsRevision: number, doFetch: Fetch = fetch): Promise<Outcome<CalculateDone>> {
  return sendJson(doFetch, calculatePath(estimateId), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ acknowledge: { inputsRevision } }) }, toDone);
}

/** One press: the first (no `acknowledged`) or "Calculate anyway" with the revision of the 409 the person saw. The choice is made here, in the lazy chunk, so the page's first load does not carry it. */
export const press = (estimateId: string, acknowledged?: number): Promise<Outcome<CalculateDone>> =>
  acknowledged === undefined ? calculateEstimate(estimateId) : calculateAnyway(estimateId, acknowledged);

/** A row with a 0 in QTY per Assy as the dialog shows it: the part and the field to take the person to, the Sl. No and name, and the server's sentence. */
export interface WarnedRowView {
  readonly nodeId: string;
  readonly fieldId: string;
  readonly slNo: string;
  readonly label: string;
  readonly message: string;
}

/** What the 409 `CALCULATE_ACK_REQUIRED` asks the person to confirm: the revision to send back with "Calculate anyway", and the rows. */
export interface AckRequestView {
  readonly inputsRevision: number;
  readonly rows: ReadonlyArray<WarnedRowView>;
  /** True when this is the answer to "Calculate anyway": the list is a new one, because something changed after the person saw the last (AC-4). */
  readonly changed: boolean;
}

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

function toWarnedRow(value: unknown): WarnedRowView | null {
  if (!isRecord(value)) return null;
  const { nodeId, fieldId, slNo, label, message } = value;
  return isText(nodeId) && isText(fieldId) && isText(slNo) && typeof label === 'string' && isText(message) ? { nodeId, fieldId, slNo, label, message } : null;
}

/**
 * The rows and the revision of a 409 `CALCULATE_ACK_REQUIRED`, or `null` for any other refusal or a body that is not the expected shape (then the screen shows the server's own sentence and no rows).
 * No number is read from the body but the revision: there is no other in it (NFR-002).
 */
export function warningFrom(refusal: Refusal, changed = false): AckRequestView | null {
  const { inputsRevision, warnings } = refusal.body;
  if (refusal.code !== CALCULATE_ACK_REQUIRED_CODE || typeof inputsRevision !== 'number' || !Number.isInteger(inputsRevision) || inputsRevision < 0) return null;
  if (!Array.isArray(warnings) || warnings.length === 0) return null;
  const rows = warnings.map(toWarnedRow);
  return rows.every((row) => row !== null) ? { inputsRevision, rows, changed } : null;
}

function toField(value: unknown): MissingFieldView | null {
  if (!isRecord(value)) return null;
  const { fieldId, label } = value;
  return typeof fieldId === 'string' && fieldId !== '' && typeof label === 'string' && label !== '' ? { fieldId, label } : null;
}

function toBlockedPart(value: unknown): BlockedPartView | null {
  if (!isRecord(value) || !Array.isArray(value['fields'])) return null;
  const { nodeId, slNo, name } = value;
  const fields = value['fields'].map(toField);
  if (typeof nodeId !== 'string' || typeof slNo !== 'string' || (name !== null && typeof name !== 'string') || !fields.every((field) => field !== null)) return null;
  return { nodeId, slNo, name, fields };
}

/**
 * The parts of a refused Calculate that was blocked by missing inputs (422 `CALCULATE_BLOCKED`), or `null` for any other refusal, or a body whose parts are not the expected shape (then
 * the screen shows the server's own sentence and no list). A part that is listed with no field is dropped: there is nothing to link to.
 */
export function blockedPartsFrom(refusal: Refusal): ReadonlyArray<BlockedPartView> | null {
  if (refusal.code !== CALCULATE_BLOCKED_CODE || !Array.isArray(refusal.body['parts'])) return null;
  const parts = refusal.body['parts'].map(toBlockedPart);
  return parts.every((part) => part !== null) ? parts.filter((part) => part.fields.length > 0) : null;
}
