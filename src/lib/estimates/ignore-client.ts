import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

/**
 * The browser's side of Ignore and Restore (CR-01 item 7D, AQP-401; SCR-06; architecture section 4.12 c): Ignore sends the Lead's remarks, Restore sends nothing. Nothing here decides anything: whether the estimate may be
 * ignored or restored (the role, the status, the layer) and whether the remarks are acceptable are the server's, and a refusal comes back with its code and the server's own sentence, so the dialog can tell a second press
 * (`ESTIMATE_ALREADY_IGNORED`, `ESTIMATE_NOT_IGNORED`: treated as done) from every other refusal. An answer of the wrong shape is a failure, not a crash. **No marker is read from a good answer**: the page is drawn
 * again by the server (`router.refresh()`), so the Ignored or the restored state reaches the screen the way it always does.
 */

const ignorePath = (estimateId: string): string => `/api/v1/estimates/${encodeURIComponent(estimateId)}/ignore`;
const restorePath = (estimateId: string): string => `/api/v1/estimates/${encodeURIComponent(estimateId)}/restore`;

/** `true` when the answer carries the status underneath (a Draft, a Prepared or an Approved estimate); `null` for anything else (a failure, never a crash). */
const toDone = (body: unknown): true | null => (isRecord(body) && typeof body['status'] === 'string' && body['status'] !== 'QUOTED' ? true : null);

/** `POST /api/v1/estimates/{id}/ignore` with the remarks as typed (the server judges and trims them). */
export function ignoreEstimate(estimateId: string, remarks: string, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(doFetch, ignorePath(estimateId), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ remarks }) }, toDone);
}

/** `POST /api/v1/estimates/{id}/restore`: no body, as Restore has no remarks of its own. */
export function restoreEstimate(estimateId: string, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(doFetch, restorePath(estimateId), { method: 'POST', headers: ACCEPT_JSON }, toDone);
}
