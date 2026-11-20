import { getConfigStructureService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { fieldIdParamsSchema } from '@/server/views/schemas/config-edit';
import { deleteFieldAnswerSchema, deleteFieldBodySchema } from '@/server/views/schemas/config-structure';

/**
 * `DELETE /api/v1/config/fields/{id}` (STORY-08.04 AC-1 to AC-4, AC-9; FR-075, FR-076, FR-080; NFR-004; architecture section 6 "Delete field"): the Admin deletes a field that nothing uses, with their own password. The
 * Admin alone, so `withRoute` answers a Lead and an Engineer with the fixed 403 and a signed-out caller 401 before the field or the body is looked at. Then, in the service's order, so that a refusal costs nothing: 404 (no
 * such field), 409 `SYSTEM_FIELD` (a protected field), 409 `FIELD_IN_USE` (with every use; a blocked field never asks for a password), 422 `STEP_UP_FAILED` or 429 `STEP_UP_LOCKED` (the password, on its own throttle
 * key), and then one new immutable version with its audit entry in one transaction (409 `CONFIG_VERSION_CHANGED` when another save came first).
 *
 * The body is the password alone, in a strict object: it reaches `verifyStepUp` and is in no answer, log line or audit entry.
 */
export const DELETE = withRoute({
  route: '/api/v1/config/fields/[id]',
  method: 'DELETE',
  params: fieldIdParamsSchema,
  body: deleteFieldBodySchema,
  output: deleteFieldAnswerSchema,
  handler: ({ user, params, body, requestId }) => getConfigStructureService().deleteField({ user, requestId }, params.id, body),
});
