import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { processItemIdParamsSchema, propagationBodySchema, propagationResultSchema } from '@/server/views/schemas/process-items';

/**
 * `POST /api/v1/process-items/{id}/propagation` (STORY-02.08 AC-3, AC-4, AC-7): Save choices of the dialog "Customers differ". Each customer the Admin chose
 * Apply for gets the rate's current default, but only while its value is still the `shownValue` it was listed with; the answer is the counts (applied, kept,
 * skipped). Admin only, checked before the ID is looked at, so a real ID and an invented one are refused alike (CR-33). 404 for an unknown rate, 409
 * `DEFAULT_CHANGED` when the default is no longer `newDefault`, 422 for a body the schema or the service refuses.
 */
export const POST = withRoute({
  route: '/api/v1/process-items/[id]/propagation',
  method: 'POST',
  params: processItemIdParamsSchema,
  body: propagationBodySchema,
  output: propagationResultSchema,
  handler: ({ user, requestId, params, body }) =>
    getMastersService().applyPropagation({ actorId: user.id, actorLabel: user.name, requestId }, params.id, body),
});
