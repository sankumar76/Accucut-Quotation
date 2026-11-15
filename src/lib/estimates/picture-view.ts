import { isRecord } from '../api-client';

/**
 * What the browser reads of a part's picture (STORY-05.07): its ID (to ask `GET /api/v1/images/{id}` for it), its sanitised name (display text, shown as text) and its size. Kept apart
 * from the picture client, because the part form reads it from the part's answer in the first load of the page and the client that sends a picture is fetched only when the control is.
 */
export interface PictureView {
  readonly id: string;
  readonly fileName: string;
  readonly sizeBytes: number;
}

/** A picture as the server sends it, or `null` when the value is not one (an answer of the wrong shape is a failure, not a crash). */
export function toPictureView(value: unknown): PictureView | null {
  if (!isRecord(value)) return null;
  const { id, fileName, sizeBytes } = value;
  return typeof id === 'string' && id !== '' && typeof fileName === 'string' && fileName !== '' && typeof sizeBytes === 'number' ? { id, fileName, sizeBytes } : null;
}
