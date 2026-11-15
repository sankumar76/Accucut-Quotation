import { z } from 'zod';

import { IMAGE_MIMES } from '../../../lib/images/signature';
import { MAX_FILE_NAME_LENGTH } from '../../../lib/images/picture-rules';

/**
 * The contract of the part picture routes (STORY-05.07; architecture section 6 "Image" and section 8; ADR-008, ADR-013). Every path parameter and answer is a strict object: a key
 * that is not named is an error, so nothing leaves that is not meant to. No rate, cost or formula is in any of them (NFR-002: a picture of a part is not cost data); the same
 * schema answers every role.
 *
 * What is **shown** of a picture is its ID, its sanitised name and its size, never its bytes; the bytes leave only by `GET /api/v1/images/{id}`, as a file, with the stored type.
 * The upload itself is not a JSON body: it is one multipart file, read by `withRoute` within a hard cap (`upload`), so no body schema is declared for it.
 */

const MAX_ID_LENGTH = 100;

/** The path parameter of `GET /api/v1/images/{id}`. An ID that is not a picture is a 404, never a 400 that would tell a real ID from an invented one. */
export const imageParamsSchema = z.strictObject({ id: z.string().max(MAX_ID_LENGTH) });

/** A part's picture as it is shown: the ID to ask for it with, the sanitised name (display text) and the size in bytes. */
export const pictureSchema = z.strictObject({ id: z.uuid(), fileName: z.string().min(1).max(MAX_FILE_NAME_LENGTH), sizeBytes: z.number().int().min(1) });

/** `PUT` and `DELETE .../nodes/{nodeId}/image`: the part after the change (its new revision, how complete it is) and the picture it has now, or none. */
export const partPictureSchema = z.strictObject({
  id: z.string().min(1),
  revision: z.number().int(),
  completeness: z.enum(['EMPTY', 'PARTIAL', 'COMPLETE']),
  picture: pictureSchema.nullable(),
});

/**
 * `GET /api/v1/images/{id}`: a stored file. `withRoute` (`download`) answers with the bytes and the fixed headers (the stored type, `nosniff`, `no-store`); this is the schema that
 * holds the type to the four the content check accepts and the bytes to bytes. The JSON Schema of the bytes is a binary string, so the strict-schema walk can see no open object.
 */
export const pictureFileSchema = z.strictObject({
  mime: z.enum(IMAGE_MIMES),
  bytes: z.instanceof(Uint8Array).meta({ type: 'string', format: 'binary' }),
});
