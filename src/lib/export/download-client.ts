import { isRecord, type Fetch } from '../api-client';
import { handleSessionEnded } from '../auth/session-ended';

/**
 * The browser's side of the export download (STORY-07.01 AC-2, AC-6; architecture section 6 "Export"): ask for the file, and hand it to the browser as a download. Nothing here decides anything: who may
 * download is the server's (the manifest row), and the file is built there; this file only sends one request, keeps the answer's bytes in memory as a `Blob` and offers them under the name the server gave
 * (`Content-Disposition`). It reads no figure and writes nothing to storage. It is fetched by a bare `import()` when the button is first pressed, so the page does not carry it (NFR-009).
 */

/** The server's own request ID of an answer, which a person can read out ("Error with reference", SCR-10). */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/** What the button is told: it worked, the server refused with its own title, or no usable answer came. Both failures carry the request ID when the answer had one. */
export type DownloadOutcome =
  | { readonly status: 'ok' }
  | { readonly status: 'refused'; readonly title: string; readonly reference: string | null }
  | { readonly status: 'failed'; readonly reference: string | null };

/** Offers the bytes to the browser under a name. Replaced in a test. */
export type SaveFile = (blob: Blob, fileName: string) => void;

/** The name inside `Content-Disposition: attachment; filename="..."`, only when it is made of what the export makes (`lib/export/file-name.ts`); otherwise `null`. */
export function fileNameFrom(contentDisposition: string | null): string | null {
  const found = /filename="([A-Za-z0-9_-]{1,200}\.xlsx)"/.exec(contentDisposition ?? '');
  return found?.[1] ?? null;
}

const REVOKE_AFTER_MS = 10_000;

/** The real `SaveFile`: a link to the blob, pressed once. The address is let go after a while, so the browser has begun the download. */
export const saveInBrowser: SaveFile = (blob, fileName) => {
  const address = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = address;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(address), REVOKE_AFTER_MS);
};

const exportPath = (estimateId: string): string => `/api/v1/estimates/${encodeURIComponent(estimateId)}/export`;

async function refusalTitle(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (!isRecord(body) || typeof body['title'] !== 'string' || typeof body['code'] !== 'string') return null;
    handleSessionEnded(response.status, body['code']);
    return response.status >= 500 ? null : body['title'];
  } catch {
    return null;
  }
}

/** `GET /api/v1/estimates/{id}/export`, then the file is offered to the browser under the server's name (or `fallbackName`, the one the page showed, if the header held none we can trust). */
export async function downloadExport(estimateId: string, fallbackName: string, doFetch: Fetch = fetch, save: SaveFile = saveInBrowser): Promise<DownloadOutcome> {
  let response: Response;
  try {
    response = await doFetch(exportPath(estimateId), { credentials: 'same-origin', headers: { Accept: '*/*' } });
  } catch {
    return { status: 'failed', reference: null };
  }
  const reference = response.headers.get(REQUEST_ID_HEADER);
  if (!response.ok) {
    const title = await refusalTitle(response);
    return title === null ? { status: 'failed', reference } : { status: 'refused', title, reference };
  }
  try {
    save(await response.blob(), fileNameFrom(response.headers.get('Content-Disposition')) ?? fallbackName);
  } catch {
    return { status: 'failed', reference };
  }
  return { status: 'ok' };
}
