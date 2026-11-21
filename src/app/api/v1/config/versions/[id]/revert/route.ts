import { getConfigCheckpointService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { revertAnswerSchema, revertBodySchema, versionIdParamsSchema } from '@/server/views/schemas/config-checkpoints';

/**
 * `POST /api/v1/config/versions/{id}/revert` (STORY-08.06 AC-4, AC-5, AC-7, AC-9; FR-077, FR-078, FR-080; NFR-004; architecture section 6 "Revert"): the Admin reverts the configuration to an earlier version, with their own
 * password. The Admin alone, so `withRoute` answers a Lead and an Engineer with the fixed 403 and a signed-out caller 401 before the version or the body is looked at. Then, in the service's order, so that a refusal
 * costs nothing: 404 (no such version), 409 `CONFIG_VERSION_CHANGED` (the screen's base is not the latest), 409 `NOTHING_TO_REVERT` (the target is the current configuration), 422 (the target reads a rate the Process
 * master no longer has; no password is asked for), 422 `STEP_UP_FAILED` or 429 `STEP_UP_LOCKED` (the password, on its own throttle key), and then one new immutable version equal to the target's snapshot, with its audit
 * entry, in one transaction. The revert is by version ID, so the undo of a revert, which has no checkpoint, works.
 *
 * The body is the password and the base version in a strict object: the password reaches `verifyStepUp` and is in no answer, log line or audit entry.
 */
export const POST = withRoute({
  route: '/api/v1/config/versions/[id]/revert',
  method: 'POST',
  params: versionIdParamsSchema,
  body: revertBodySchema,
  output: revertAnswerSchema,
  handler: ({ user, params, body, requestId }) => getConfigCheckpointService().revert({ user, requestId }, params.id, body),
});
