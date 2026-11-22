import { isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

/**
 * The browser's side of Cancel approval (STORY-06.12; SCR-06; architecture section 6 "Cancel approval"): send the approval the Admin saw, their reason and their password. Nothing here decides anything: whether the
 * Admin may cancel, whether the reason is acceptable, whether the password is right, and whether the estimate's customer and materials still exist are the server's, and a refusal comes back with its code and the
 * server's own sentence. An answer of the wrong shape is a failure, not a crash. **No figure is read from a good answer**: the page is drawn again by the server (`router.refresh()`), so the cancelled state reaches the
 * screen the way it always does. The password is sent in the one request and kept nowhere here.
 */

const cancelPath = (estimateId: string): string => `/api/v1/estimates/${encodeURIComponent(estimateId)}/approval/cancel`;

/** What the request carries (the strict body of the route). */
export interface CancelApprovalInput {
  readonly approvalId: string;
  readonly reason: string;
  readonly password: string;
}

/** `true` when the answer says the estimate is DRAFT or PREPARED; `null` for anything else (a failure, never a crash). */
const toCancelled = (body: unknown): true | null => (isRecord(body) && (body['status'] === 'DRAFT' || body['status'] === 'PREPARED') ? true : null);

/** `POST /api/v1/estimates/{id}/approval/cancel`. */
export function cancelApproval(estimateId: string, input: CancelApprovalInput, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(doFetch, cancelPath(estimateId), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) }, toCancelled);
}
