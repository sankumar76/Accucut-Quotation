import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

/**
 * The browser's side of Unlock (STORY-06.08; SCR-09; architecture section 6 "Unlock preview" and "Unlock"): read what changed since the approval, and send the reason. Nothing here decides anything: whether the
 * estimate may be unlocked, whether the reason is acceptable and whether its customer and materials still exist are the server's, and a refusal comes back with its code and the server's own sentence. An answer of
 * the wrong shape is a failure, not a crash. **No figure is read from a good answer**: the page is drawn again by the server (`router.refresh()`), so the Draft state reaches the screen the way it always does.
 */

const unlockPath = (estimateId: string): string => `/api/v1/estimates/${encodeURIComponent(estimateId)}/unlock`;
const previewPath = (estimateId: string): string => `/api/v1/estimates/${encodeURIComponent(estimateId)}/unlock-preview`;

/** What the dialog shows of the preview: whose queue the task returns to, the two version numbers and the counts by kind. */
export interface UnlockPreviewView {
  readonly engineerName: string;
  readonly configuration: { readonly approved: number; readonly current: number };
  readonly changed: { readonly processRates: number; readonly materialPrices: number; readonly exchangeRates: number };
}

const asCount = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);

/** The preview, or `null` for an answer that is not the shape the route promises. */
function toPreview(body: unknown): UnlockPreviewView | null {
  if (!isRecord(body)) return null;
  const { engineerName, configuration, changed } = body;
  if (typeof engineerName !== 'string' || engineerName === '' || !isRecord(configuration) || !isRecord(changed)) return null;
  const approved = asCount(configuration['approved']);
  const current = asCount(configuration['current']);
  const processRates = asCount(changed['processRates']);
  const materialPrices = asCount(changed['materialPrices']);
  const exchangeRates = asCount(changed['exchangeRates']);
  if (approved === null || current === null || processRates === null || materialPrices === null || exchangeRates === null) return null;
  return { engineerName, configuration: { approved, current }, changed: { processRates, materialPrices, exchangeRates } };
}

/** `true` when the answer says the estimate is DRAFT; `null` for anything else (a failure, never a crash). */
const toUnlocked = (body: unknown): true | null => (isRecord(body) && body['status'] === 'DRAFT' ? true : null);

/** `GET /api/v1/estimates/{id}/unlock-preview`. */
export function readUnlockPreview(estimateId: string, doFetch: Fetch = fetch): Promise<Outcome<UnlockPreviewView>> {
  return sendJson(doFetch, previewPath(estimateId), { method: 'GET', headers: ACCEPT_JSON }, toPreview);
}

/** `POST /api/v1/estimates/{id}/unlock`. */
export function unlockEstimate(estimateId: string, reason: string, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(doFetch, unlockPath(estimateId), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ reason }) }, toUnlocked);
}
