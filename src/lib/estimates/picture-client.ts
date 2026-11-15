import { ACCEPT_JSON, isRecord, sendJson, type Fetch, type Outcome } from '../api-client';

import { toPictureView, type PictureView } from './picture-view';
import type { Completeness } from './tree-client';

/**
 * The browser's side of the picture routes (STORY-05.07; SCR-05; architecture section 6 "Image"): send a picture, remove it, and the address a picture is shown from. Nothing here
 * decides anything: whether the estimate is the person's, whether it may still be changed, whether the file is a picture and how large it may be are the server's, and this file only reads
 * its answer (an answer of the wrong shape is a failure, not a crash). The part's `id` and new `revision` come back, so the form keeps saving with the right one.
 */

/** The part after a picture change: its revision, how complete it is, and the picture it has now (or none). */
export interface PartPictureAnswer {
  readonly id: string;
  readonly revision: number;
  readonly completeness: Completeness;
  readonly picture: PictureView | null;
}

const isCompleteness = (value: unknown): value is Completeness => value === 'EMPTY' || value === 'PARTIAL' || value === 'COMPLETE';

function toAnswer(body: unknown): PartPictureAnswer | null {
  if (!isRecord(body)) return null;
  const { id, revision, completeness } = body;
  if (typeof id !== 'string' || id === '' || typeof revision !== 'number' || !isCompleteness(completeness)) return null;
  const picture = body['picture'] === null ? null : toPictureView(body['picture']);
  return body['picture'] !== null && picture === null ? null : { id, revision, completeness, picture };
}

const imagePath = (estimateId: string, nodeId: string): string => `/api/v1/estimates/${encodeURIComponent(estimateId)}/nodes/${encodeURIComponent(nodeId)}/image`;

/** The address of a stored picture, for a plain `<img>` (the server serves it only to the people who may open its estimate). */
export const pictureUrl = (imageId: string): string => `/api/v1/images/${encodeURIComponent(imageId)}`;

/**
 * `PUT /api/v1/estimates/{id}/nodes/{nodeId}/image`: one file as a multipart form under the name `file`. The browser sets the content type and its boundary, and its own `Origin`.
 * A refusal carries the server's words (`title`): 413 for a picture that is too large, 415 for one that is not a PNG, JPEG, GIF or WebP by its content.
 */
export function sendPicture(estimateId: string, nodeId: string, file: File, doFetch: Fetch = fetch): Promise<Outcome<PartPictureAnswer>> {
  const form = new FormData();
  form.append('file', file);
  return sendJson(doFetch, imagePath(estimateId, nodeId), { method: 'PUT', headers: ACCEPT_JSON, body: form }, toAnswer);
}

/** `DELETE /api/v1/estimates/{id}/nodes/{nodeId}/image`: the part has no picture afterwards (it already had none is no error). */
export function dropPicture(estimateId: string, nodeId: string, doFetch: Fetch = fetch): Promise<Outcome<PartPictureAnswer>> {
  return sendJson(doFetch, imagePath(estimateId, nodeId), { method: 'DELETE', headers: ACCEPT_JSON }, toAnswer);
}
