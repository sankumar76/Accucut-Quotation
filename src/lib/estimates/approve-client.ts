import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

/**
 * The browser's side of Approve and lock (STORY-06.06; SCR-08; architecture section 6 "Approve"): send the price and the calculation the Lead was looking at, and read whether it worked. Nothing here decides
 * anything: whether the estimate may be approved, whether the figures are current and whether the calculation is still the current one are the server's, and a refusal comes back with its code and the server's
 * own sentence. An answer of the wrong shape is a failure, not a crash. **No figure is read from a good answer**: the page is drawn again by the server (`router.refresh()`), so BO reaches the screen the way
 * it always does, from the approval's row.
 */

const approvePath = (estimateId: string): string => `/api/v1/estimates/${encodeURIComponent(estimateId)}/approve`;
const costsPath = (estimateId: string): string => `/api/v1/estimates/${encodeURIComponent(estimateId)}/costs`;

/** What the browser sends: the calculation the page showed and the price typed. The reason for a different price is STORY-06.07's. */
export interface ApproveRequest {
  readonly calculationId: string;
  readonly price: string;
}

/** `true` when the answer says the estimate is APPROVED; `null` for anything else (a failure, never a crash). */
const toApproved = (body: unknown): true | null => (isRecord(body) && body['status'] === 'APPROVED' ? true : null);

/** `POST /api/v1/estimates/{id}/approve`. */
export function approveEstimate(estimateId: string, request: ApproveRequest, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(doFetch, approvePath(estimateId), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ calculationId: request.calculationId, price: request.price }) }, toApproved);
}

/**
 * Can the new figures be read? One `GET /api/v1/estimates/{id}/costs`, whose body is dropped unread: this only tells the dialog whether the page can be drawn again (SCR-08 "Figures recalculated while open":
 * "If the read fails" the dialog stays open and says so). It makes no claim about what was saved.
 */
export async function canReadFigures(estimateId: string, doFetch: Fetch = fetch): Promise<boolean> {
  const outcome = await sendJson(doFetch, costsPath(estimateId), { method: 'GET', headers: ACCEPT_JSON }, () => true);
  return outcome.status === 'ok';
}
