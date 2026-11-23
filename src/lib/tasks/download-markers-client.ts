import { ACCEPT_JSON, isRecord, sendJson, type Fetch, type Outcome } from '../api-client';
import { readDownloadMarker, type DownloadChipData } from '../export/download-marker-view';

/**
 * The browser's side of `GET /api/v1/download-markers` (STORY-CR01.7E AC-5; SCR-03 Closed tab): the download marker of the estimate of each task a page of the Closed tab lists, **for a Lead and an Admin only**
 * (the route refuses an Engineer, and the screen never asks for one). It decides nothing: the marker is the server's. An answer that does not look like markers is a failure, never "Not downloaded": a row that said
 * so for a broken answer would tell a Lead that no file went to the customer.
 */

/** The markers by task ID. A task that is not in the answer has none to show. */
export type DownloadMarkers = Readonly<Record<string, DownloadChipData>>;

const MARKERS_PATH = '/api/v1/download-markers';

/** The markers an answer holds, or null for a body that is not one. */
export function readDownloadMarkers(body: unknown): DownloadMarkers | null {
  if (!isRecord(body) || !Array.isArray(body['markers'])) return null;
  const markers: Record<string, DownloadChipData> = {};
  for (const entry of body['markers']) {
    if (!isRecord(entry) || typeof entry['taskId'] !== 'string') return null;
    const marker = readDownloadMarker(entry['marker']);
    if (marker === null) return null;
    markers[entry['taskId']] = marker;
  }
  return markers;
}

/** The markers of these tasks (at most one page of the queue). A cancelled call answers `failed`, which the screen ignores when a newer call has taken over. */
export function fetchDownloadMarkers(taskIds: ReadonlyArray<string>, doFetch: Fetch = fetch, signal?: AbortSignal): Promise<Outcome<DownloadMarkers>> {
  const query = new URLSearchParams({ ids: taskIds.join(',') });
  return sendJson(doFetch, `${MARKERS_PATH}?${query.toString()}`, { method: 'GET', headers: ACCEPT_JSON, ...(signal === undefined ? {} : { signal }) }, readDownloadMarkers);
}
