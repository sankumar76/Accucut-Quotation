import { ACCEPT_JSON, isRecord, sendJson, type Fetch, type Outcome } from '../api-client';

/**
 * The browser's side of Mark as quoted (CR-01 item 7C, AQP-400; SCR-06; architecture section 4.12 c): one request with no body. Nothing here decides anything: whether the estimate may be marked (the role, the status, the
 * Ignored layer) is the server's, and a refusal comes back with its code and the server's own sentence, so the dialog can tell a second press (`ESTIMATE_ALREADY_QUOTED`, treated as done) from every other refusal.
 * An answer of the wrong shape is a failure, not a crash. **No marker is read from a good answer**: the page is drawn again by the server (`router.refresh()`), so the Quoted state reaches the screen the way it always does.
 */

const quotedPath = (estimateId: string): string => `/api/v1/estimates/${encodeURIComponent(estimateId)}/quoted`;

/** `true` when the answer says the estimate is QUOTED; `null` for anything else (a failure, never a crash). */
const toMarked = (body: unknown): true | null => (isRecord(body) && body['status'] === 'QUOTED' ? true : null);

/** `POST /api/v1/estimates/{id}/quoted`. */
export function markEstimateQuoted(estimateId: string, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(doFetch, quotedPath(estimateId), { method: 'POST', headers: ACCEPT_JSON }, toMarked);
}
