import { isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

/**
 * The browser's side of Remove price (STORY-06.13; SCR-06; architecture section 6 "Remove price"): send the approval the Admin saw and their password. Nothing here decides anything: whether the Admin may remove it,
 * whether the password is right and whether the approval is still the latest, cancelled one are the server's, and a refusal comes back with its code and the server's own sentence. An answer of the wrong shape is a
 * failure, not a crash. **No figure is read from a good answer** (it holds none): the page is drawn again by the server (`router.refresh()`), so the removed state reaches the screen the way it always does. The password is
 * sent in the one request and kept nowhere here.
 */

const removePath = (estimateId: string): string => `/api/v1/estimates/${encodeURIComponent(estimateId)}/approval/remove-price`;

/** What the request carries (the strict body of the route). */
export interface RemovePriceInput {
  readonly approvalId: string;
  readonly password: string;
}

/** `true` when the answer carries the time of the removal; `null` for anything else (a failure, never a crash). */
const toRemoved = (body: unknown): true | null => (isRecord(body) && typeof body['removedAt'] === 'string' ? true : null);

/** `POST /api/v1/estimates/{id}/approval/remove-price`. */
export function removePrice(estimateId: string, input: RemovePriceInput, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(doFetch, removePath(estimateId), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) }, toRemoved);
}
