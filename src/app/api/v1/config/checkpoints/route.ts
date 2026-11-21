import { getConfigCheckpointService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { checkpointBodySchema, checkpointSchema, checkpointsSchema } from '@/server/views/schemas/config-checkpoints';

/**
 * `GET /api/v1/config/checkpoints` (STORY-08.06 AC-3, AC-9; FR-078; architecture section 6 "Checkpoints"): every checkpoint, newest first, with the version it names, when it was saved and by whom, and no snapshot. The
 * Admin alone, so `withRoute` answers a Lead and an Engineer with the fixed 403 and a signed-out caller 401 before anything is read.
 */
export const GET = withRoute({
  route: '/api/v1/config/checkpoints',
  method: 'GET',
  output: checkpointsSchema,
  handler: ({ user, requestId }) => getConfigCheckpointService().listCheckpoints({ user, requestId }),
});

/**
 * `POST /api/v1/config/checkpoints` (STORY-08.06 AC-2, AC-9): a name for the **current latest** version, 201 with the row. No new configuration version, no password (FR-080 lists only revert) and no audit entry (decision
 * D-1: nothing in the configuration changed). A name that is empty or too long is 422 with the sentence for the field; a name already used in any letter case is 409 `CHECKPOINT_NAME_TAKEN`.
 */
export const POST = withRoute({
  route: '/api/v1/config/checkpoints',
  method: 'POST',
  status: 201,
  body: checkpointBodySchema,
  output: checkpointSchema,
  handler: ({ user, body, requestId }) => getConfigCheckpointService().saveCheckpoint({ user, requestId }, body),
});
