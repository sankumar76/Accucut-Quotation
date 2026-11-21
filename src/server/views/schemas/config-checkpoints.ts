import { z } from 'zod';

import { stepUpPasswordSchema } from './step-up';

/**
 * The contract of the checkpoint and revert routes (STORY-08.06; architecture section 6 rows "Checkpoints" and "Revert"; SCR-21). Every body, parameter and answer is a strict object, so a key that is not named is an
 * error and never reaches a client. **Restricted, for the Admin alone** (NFR-001, NFR-002): the manifest rows are for the Admin only, and nothing an Engineer may call has a schema like these. There is no key in any
 * answer that could hold a snapshot, a formula or a rate: a checkpoint is a name, a version number, a time and a person's name.
 *
 * The body of a save bounds only the size of what is read. The rule for the name (trimmed, 1 to 100 characters, no control character) and its words are `lib/config/checkpoint.ts`, which runs again on the server
 * whatever the browser did.
 */

/** A name longer than this is refused by the schema before the rule is read; the rule's own limit is 100 characters. */
const MAX_TYPED_NAME_LENGTH = 1_000;

/** `POST /api/v1/config/checkpoints`. */
export const checkpointBodySchema = z.strictObject({ name: z.string().max(MAX_TYPED_NAME_LENGTH) });

/** The path parameter of `POST /api/v1/config/versions/{id}/revert`: a version's ID, which is a UUID. */
export const versionIdParamsSchema = z.strictObject({ id: z.uuid() });

/** `POST /api/v1/config/versions/{id}/revert`: the person's own password (the step-up), and the number of the version the screen showed as current. */
export const revertBodySchema = z.strictObject({ password: stepUpPasswordSchema, baseVersion: z.number().int().min(1) });

/** One checkpoint: the name, the version it names (the revert is by this ID), when it was saved (an ISO 8601 instant in UTC) and by whom (`null` for the seed checkpoint). */
export const checkpointSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1),
  versionId: z.uuid(),
  versionNumber: z.number().int().min(1),
  savedAt: z.iso.datetime(),
  savedBy: z.string().min(1).nullable(),
});

/** `GET /api/v1/config/checkpoints`: every checkpoint, newest first. */
export const checkpointsSchema = z.strictObject({ checkpoints: z.array(checkpointSchema).readonly() });

/** `POST /api/v1/config/versions/{id}/revert`: the number of the version the revert made, the number it copied and the ID of the version that was latest before it (the target of the undo). */
export const revertAnswerSchema = z.strictObject({
  version: z.number().int().min(1),
  copiedFrom: z.number().int().min(1),
  undoVersionId: z.uuid(),
});
