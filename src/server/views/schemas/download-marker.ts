import { z } from 'zod';

import type { DownloadMarker } from '../../../lib/export/download-marker';
import { QUEUE_MAX_LIMIT } from '../../../lib/tasks/queue';

/**
 * The marker of an estimate's Excel downloads as a Lead and an Admin read it (STORY-CR01.7E, AQP-402; CR-01 item 7c; architecture section 4.12 d; ADR-008): "Not downloaded", "Downloaded N times" or
 * "Changed since download", with the number of downloads and who downloaded last and when. **It exists only in the Lead and Admin schemas**: the Engineer's queue, task and workspace schemas have no key
 * for it, every schema here is strict, and the export routes that carry it list no Engineer (NFR-002). It holds a count, a person's name and an instant: no price, no figure and no ID.
 */

const lastDownloadSchema = z.strictObject({
  byName: z.string().min(1),
  /** An ISO 8601 instant in UTC; the screen writes it in IST. */
  at: z.iso.datetime(),
});

export const downloadMarkerSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({ kind: z.literal('downloaded'), count: z.number().int().min(1), last: lastDownloadSchema }),
  z.strictObject({ kind: z.literal('changed'), count: z.number().int().min(1), last: lastDownloadSchema }),
]);

export type DownloadMarkerView = z.infer<typeof downloadMarkerSchema>;

/** The marker as the routes and pages send it: the instant as ISO 8601 text, and nothing else changed. */
export function markerViewOf(marker: DownloadMarker): z.input<typeof downloadMarkerSchema> {
  return marker.kind === 'none' ? { kind: 'none' } : { kind: marker.kind, count: marker.count, last: { byName: marker.last.byName, at: marker.last.at.toISOString() } };
}

/** The most task IDs `GET /api/v1/download-markers` takes: one page of the queue. */
export const MARKER_IDS_MAX = QUEUE_MAX_LIMIT;

const MARKER_IDS_MESSAGE = `The ids must be one to ${String(MARKER_IDS_MAX)} task IDs, separated by commas.`;

/** `GET /api/v1/download-markers?ids=<task id>,<task id>`: the task IDs of the rows a page of the Closed tab shows (a Lead and an Admin only). Each must be a UUID; an ID that is none is a 422, never a lookup. */
export const downloadMarkersQuerySchema = z.strictObject({
  ids: z
    .string({ error: MARKER_IDS_MESSAGE })
    .max(MARKER_IDS_MAX * 37, MARKER_IDS_MESSAGE)
    .transform((text) => text.split(','))
    .pipe(z.array(z.uuid({ error: MARKER_IDS_MESSAGE })).min(1, MARKER_IDS_MESSAGE).max(MARKER_IDS_MAX, MARKER_IDS_MESSAGE)),
});

/** One entry for each task the estimate of which exists; a task asked for that does not exist is left out. */
export const downloadMarkersSchema = z.strictObject({
  markers: z.array(z.strictObject({ taskId: z.uuid(), marker: downloadMarkerSchema })),
});

export type DownloadMarkersView = z.infer<typeof downloadMarkersSchema>;
