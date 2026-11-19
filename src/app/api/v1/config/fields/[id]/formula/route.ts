import { getConfigEditService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { fieldIdParamsSchema, saveFormulaAnswerSchema, saveFormulaBodySchema } from '@/server/views/schemas/config-edit';

/**
 * `PUT /api/v1/config/fields/{id}/formula` (STORY-08.02 AC-2, AC-4 to AC-7, AC-9; FR-077, FR-080; NFR-004; architecture section 6 "Save formula"): the Admin saves a formula with their own password. The Admin
 * alone, so `withRoute` answers a Lead and an Engineer with the fixed 403 and a signed-out caller 401 before the field or the body is looked at. Then, in the service's order: 404 (no such field), 409 `SYSTEM_FIELD` (a
 * field with no formula), 409 `CONFIG_VERSION_CHANGED` (the editor was opened on an older version), 422 (the formula, with the same words as the live check), 422 `STEP_UP_FAILED` or 429 `STEP_UP_LOCKED` (the
 * password, on its own throttle key), and then one new immutable version with its audit entry in one transaction.
 *
 * The password is in the body and nowhere else: it reaches `verifyStepUp` and is in no answer, log line or audit entry.
 */
export const PUT = withRoute({
  route: '/api/v1/config/fields/[id]/formula',
  method: 'PUT',
  params: fieldIdParamsSchema,
  body: saveFormulaBodySchema,
  output: saveFormulaAnswerSchema,
  handler: ({ user, params, body, requestId }) => getConfigEditService().saveFormula({ user, requestId }, params.id, body),
});
