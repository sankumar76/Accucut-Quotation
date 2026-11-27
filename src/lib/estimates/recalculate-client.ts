import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

import { reviewSaveGate } from './review-save-gate';

/**
 * The browser's side of Recalculate (STORY-06.04; SCR-06 "Total cleared"; architecture section 6 "Recalculate"): press the button, and read whether it worked. Nothing here decides anything: whether the
 * person may press, whether the estimate is approved, which inputs are missing and whether a quantity needs a second look are the server's, and this file only reads what it says (an answer of the wrong
 * shape is a failure, not a crash).
 *
 * **No figure is read.** The good answer is the costs view, which holds the figures, but the screen does not draw from it: it asks the server to draw the page again (`router.refresh()`), so a figure reaches
 * the screen only as the server's figure state let it out (architecture section 4.8, NFR-002). The only thing read from the answer is that its state is `current`; nothing else is kept.
 */

const recalculatePath = (estimateId: string): string => `/api/v1/estimates/${encodeURIComponent(estimateId)}/recalculate`;

/** `true` when the answer says the figures are current; `null` for anything else (a failure, never a crash). */
const toCurrent = (body: unknown): true | null => (isRecord(body) && body['state'] === 'current' ? true : null);

/** `POST /api/v1/estimates/{id}/recalculate` with no body. A 0 in QTY per Assy earns the 409 `CALCULATE_ACK_REQUIRED`, which `warningFrom` reads and the Lead's dialog shows (STORY-06.10). */
export function recalculateEstimate(estimateId: string, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(doFetch, recalculatePath(estimateId), { method: 'POST', headers: ACCEPT_JSON }, toCurrent);
}

/**
 * "Recalculate anyway" (STORY-06.10 AC-1, AC-2): the same `POST` with `{acknowledge: {inputsRevision}}`, the revision from the 409 the person saw. The server compares it with the estimate's own under its lock, so an
 * acknowledgement is only ever good for the state it was given for; this sends what it was told to and decides nothing. The answer is read exactly as the first press's is.
 */
export function recalculateAnyway(estimateId: string, inputsRevision: number, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(doFetch, recalculatePath(estimateId), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ acknowledge: { inputsRevision } }) }, toCurrent);
}

/** What a press says when a field of the inputs block shows a value that could not be saved (DEF-131, ED-7): nothing is sent, and the person is told what to do. */
export const RECALCULATE_UNSAVED_TITLE = 'A field shows a value that could not be saved. Fix it, then press Recalculate.';

const UNSAVED: Outcome<true> = { status: 'refused', httpStatus: 0, code: 'RECALCULATE_UNSAVED', title: RECALCULATE_UNSAVED_TITLE, fields: {}, body: {} };

/**
 * One press: the first (no `acknowledged`) or "Recalculate anyway" with the revision of the 409 the person saw. The choice is made here, in the lazy chunk, so the page's first load does not carry it.
 * **It saves first** (DEF-131 stage 2, ED-7): the inputs block of the same page may hold a value typed a moment ago, so every form is asked to send again what it shows, the saves are waited for, and the request goes only when
 * nothing is left unsaved. With no inputs block (an Approved estimate, an Engineer-less page) the gate is empty and the press goes at once.
 */
export async function press(estimateId: string, acknowledged?: number): Promise<Outcome<true>> {
  // Only when something is typed and not yet saved, or a save is on its way: a form that shows what the server holds is not asked to send it again (each such request is a save of a value that changes nothing).
  if (reviewSaveGate.isDirty()) reviewSaveGate.flush('draft');
  if (!(await reviewSaveGate.settle())) return UNSAVED;
  return acknowledged === undefined ? recalculateEstimate(estimateId) : recalculateAnyway(estimateId, acknowledged);
}

/** The rows and revision of a 409 `CALCULATE_ACK_REQUIRED`: the one reading of it, shared with the Engineer's Calculate (`calculate-client.ts`). */
export { warningFrom } from './calculate-client';
