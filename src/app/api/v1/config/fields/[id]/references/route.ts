import { plainUse } from '@/lib/fields/uses';
import { getConfigStructureService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { fieldIdParamsSchema } from '@/server/views/schemas/config-edit';
import { fieldReferencesAnswerSchema } from '@/server/views/schemas/config-structure';

/**
 * `GET /api/v1/config/fields/{id}/references` (STORY-08.04 AC-2, assumption A-1; FR-076; architecture section 4.5): what uses the field, read by the dialog of SCR-20 before it asks for a password: every formula
 * (with its column letter, label and text in display form), hide-when-zero rule, visibility rule and stage total that names it. An empty list means nothing uses it. It stores nothing. The Admin alone: the answer holds
 * formulas (NFR-002), so `withRoute` answers a Lead and an Engineer with the fixed 403 and a signed-out caller 401 before the field is looked at; then 404 for no such field and 409 `SYSTEM_FIELD` for a protected one.
 * This read is not in architecture section 6 yet (the story asks the solution-architect to confirm it).
 */
export const GET = withRoute({
  route: '/api/v1/config/fields/[id]/references',
  method: 'GET',
  params: fieldIdParamsSchema,
  output: fieldReferencesAnswerSchema,
  handler: async ({ user, params, requestId }) => {
    const view = await getConfigStructureService().listReferences({ user, requestId }, params.id);
    return { fieldId: view.fieldId, letter: view.letter, label: view.label, uses: view.uses.map(plainUse) };
  },
});
