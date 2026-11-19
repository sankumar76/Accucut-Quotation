import { MAX_UPLOAD_BODY_BYTES } from '@/lib/images/picture-rules';
import { getEstimateService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { nodeParamsSchema, partPictureSchema } from '@/server/views/schemas';

/**
 * `PUT` and `DELETE /api/v1/estimates/{id}/nodes/{nodeId}/image` (STORY-05.07 AC-1, AC-2, AC-4, AC-6, AC-7; architecture sections 6 "Image" and 8; ADR-013): add or replace the picture
 * of a part, or remove it. An Admin and a Lead may use any estimate, an Engineer only their own, and a change is allowed while this person may change its inputs (`assertEditable`).
 *
 * The upload is **one multipart file** under the name `file`, read with a hard cap on the bytes that arrive (`MAX_UPLOAD_BODY_BYTES`, 256 KB, before anything is parsed; 413 over it).
 * The order of the refusals is: 401, 403 (the role, before the body is read), 400 (not one file in a multipart form), 413 (the body is over the cap), 404 (the estimate, then the part,
 * the same for one that is not theirs and one that does not exist), 409 (not editable by this person), then by content: 413 (200 x 1024 bytes or more) and 415 (not a PNG, JPEG or GIF: judged
 * by the bytes, never the name or the declared type; a WebP is 415 too, because the browser converts it before it is sent, DL-237). Nothing is stored on a refusal. A real change raises the part's revision and the estimate's `inputs_revision` in
 * one transaction. The answer is the part's new revision and its picture (ID, sanitised name, size), never the bytes.
 */

/** Add the picture, or replace the one the part has. The same file again changes nothing. */
export const PUT = withRoute({
  route: '/api/v1/estimates/[id]/nodes/[nodeId]/image',
  method: 'PUT',
  params: nodeParamsSchema,
  upload: { maxBodyBytes: MAX_UPLOAD_BODY_BYTES },
  output: partPictureSchema,
  handler: async ({ user, params, upload }) => {
    // `withRoute` reads the file for a route that declares `upload`, so it is always there; the check is for the compiler and for a route copied without it.
    if (upload === undefined) throw new Error('The upload was not read.');
    return await getEstimateService().putPicture({ id: user.id, role: user.role }, params.id, params.nodeId, upload);
  },
});

/** Remove the part's picture. A part with none is answered as it is. The picture row stays: it is immutable, and a record that shows it still can. */
export const DELETE = withRoute({
  route: '/api/v1/estimates/[id]/nodes/[nodeId]/image',
  method: 'DELETE',
  params: nodeParamsSchema,
  output: partPictureSchema,
  handler: ({ user, params }) => getEstimateService().removePicture({ id: user.id, role: user.role }, params.id, params.nodeId),
});
