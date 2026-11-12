import { handleSessionEnded, HTTP_UNAUTHORIZED } from '../auth/session-ended';

import { auditQueryString, type AuditFilters } from './filters';

/**
 * The browser's side of `GET /api/v1/audit` (SCR-16; architecture section 6, "Audit"): the call and the reading of its answer.
 * Nothing here decides anything: who may read is the server's (the Admin only, checked before the query is looked at), and this
 * file only turns the answer into something the screen can draw, or into a failure it can put in words. It takes `fetch` as an
 * argument so a test can answer for the server, and it has no zod, so the page does not carry it (NFR-009).
 *
 * An answer that does not look like a page of entries is a failure, never an empty list: a screen that said "No entries match" for
 * a broken answer would tell the Admin that nothing was recorded.
 */

export interface AuditEntryRow {
  readonly id: string;
  /** UTC, ISO 8601: shown with `formatIst`. */
  readonly createdAt: string;
  readonly who: string;
  readonly event: string;
  readonly category: { readonly id: string; readonly label: string } | null;
  readonly objectLabel: string;
  readonly change: { readonly before: string; readonly after: string };
}

export interface AuditPageData {
  readonly entries: ReadonlyArray<AuditEntryRow>;
  readonly total: number;
  readonly nextCursor: string | null;
}

/** The answer of a call: it worked, it failed (the network, a server fault, an answer that is not a page), or it was cancelled. */
export type AuditOutcome = { readonly status: 'ok'; readonly value: AuditPageData } | { readonly status: 'failed' } | { readonly status: 'cancelled' };

type Fetch = typeof fetch;

const AUDIT_PATH = '/api/v1/audit';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toCategory(value: unknown): AuditEntryRow['category'] | undefined {
  if (value === null) return null;
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['label'] !== 'string') return undefined;
  return { id: value['id'], label: value['label'] };
}

function toEntry(value: unknown): AuditEntryRow | null {
  if (!isRecord(value)) return null;
  const { id, createdAt, who, event, objectLabel } = value;
  const change = value['change'];
  const category = toCategory(value['category']);
  if (typeof id !== 'string' || typeof createdAt !== 'string' || typeof who !== 'string' || typeof event !== 'string' || typeof objectLabel !== 'string') return null;
  if (category === undefined || !isRecord(change) || typeof change['before'] !== 'string' || typeof change['after'] !== 'string') return null;
  return { id, createdAt, who, event, category, objectLabel, change: { before: change['before'], after: change['after'] } };
}

function toPage(body: unknown): AuditPageData | null {
  if (!isRecord(body) || !Array.isArray(body['entries'])) return null;
  const total = body['total'];
  const nextCursor = body['nextCursor'];
  if (typeof total !== 'number' || !Number.isInteger(total) || total < 0) return null;
  if (nextCursor !== null && typeof nextCursor !== 'string') return null;
  const entries = body['entries'].map(toEntry);
  return entries.every((entry): entry is AuditEntryRow => entry !== null) ? { entries, total, nextCursor } : null;
}

/** A 401 that says the session ended takes the person to SCR-01, to sign in again and come back here (STORY-01.06 AC-4). */
async function leaveIfSessionEnded(response: Response): Promise<void> {
  if (response.status !== HTTP_UNAUTHORIZED) return;
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body['code'] === 'string') handleSessionEnded(response.status, body['code']);
  } catch {
    // A body that is not JSON is not the session-ended problem; the call fails as any other refusal does.
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * One page of entries for these filters, after `cursor` when one is given. Pass a `signal` to be able to cancel the call when the
 * Admin changes a filter before the answer arrives; a cancelled call answers `cancelled`, which the screen ignores.
 */
export async function fetchAuditPage(filters: AuditFilters, cursor?: string, doFetch: Fetch = fetch, signal?: AbortSignal): Promise<AuditOutcome> {
  const query = auditQueryString(filters, cursor);
  try {
    const response = await doFetch(query === '' ? AUDIT_PATH : `${AUDIT_PATH}?${query}`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      ...(signal === undefined ? {} : { signal }),
    });
    if (!response.ok) {
      await leaveIfSessionEnded(response);
      return { status: 'failed' };
    }
    const page = toPage(await response.json());
    return page === null ? { status: 'failed' } : { status: 'ok', value: page };
  } catch (error) {
    return isAbort(error) ? { status: 'cancelled' } : { status: 'failed' };
  }
}
