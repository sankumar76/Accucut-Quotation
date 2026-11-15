import { ACCEPT_JSON, isRecord, sendJson, type Fetch, type Outcome } from '../api-client';

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

/** `POST /api/v1/estimates/{id}/recalculate` with no body. A 0 in QTY per Assy earns the 409 `CALCULATE_ACK_REQUIRED`, shown in the server's own sentence until the dialog of STORY-06.10. */
export function recalculateEstimate(estimateId: string, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(doFetch, recalculatePath(estimateId), { method: 'POST', headers: ACCEPT_JSON }, toCurrent);
}
