import { CALCULATE_BLOCKED_CODE, CALCULATE_SUBMITTED_STATUS } from '../estimate/calculate-words';
import { ACCEPT_JSON, isRecord, sendJson, type Fetch, type Outcome, type Refusal } from '../api-client';

/**
 * The browser's side of Calculate (STORY-05.09; SCR-05 "Calculate blocked" and "Submitted"; architecture section 6 "Calculate"): press the button, and read the answer. Nothing here decides
 * anything: whether the estimate is the person's, whether it is a draft, which inputs are missing and whether the masters allow a calculation are the server's, and this file only reads what it says
 * (an answer of the wrong shape is a failure, not a crash). **The one good answer is a status and a sentence**; there is no figure in it to read, and none is asked for (NFR-002).
 */

/** A needed field that a part does not show a value for: its ID, to link to it, and its label. */
export interface MissingFieldView {
  readonly fieldId: string;
  readonly label: string;
}

/** A part that Calculate found a missing input in: its ID, Sl. No, name (null while it has none) and the fields. */
export interface BlockedPartView {
  readonly nodeId: string;
  readonly slNo: string;
  readonly name: string | null;
  readonly fields: ReadonlyArray<MissingFieldView>;
}

/** What a good Calculate answers: the estimate is now submitted, and the sentence to show. */
export interface CalculateDone {
  readonly status: typeof CALCULATE_SUBMITTED_STATUS;
  readonly message: string;
}

const toDone = (body: unknown): CalculateDone | null =>
  isRecord(body) && body['status'] === CALCULATE_SUBMITTED_STATUS && typeof body['message'] === 'string' && body['message'] !== '' ? { status: CALCULATE_SUBMITTED_STATUS, message: body['message'] } : null;

/** `POST /api/v1/estimates/{id}/calculate`. No body: the route takes none. */
export function calculateEstimate(estimateId: string, doFetch: Fetch = fetch): Promise<Outcome<CalculateDone>> {
  return sendJson(doFetch, `/api/v1/estimates/${encodeURIComponent(estimateId)}/calculate`, { method: 'POST', headers: ACCEPT_JSON }, toDone);
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
