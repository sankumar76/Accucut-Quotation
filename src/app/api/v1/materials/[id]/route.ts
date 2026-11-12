import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
export { createTransactionHandle as plantedMakeHandle } from '../../../../../server/repositories/transaction';
import { materialIdParamsSchema, materialSchema, updateMaterialBodySchema } from '@/server/views/schemas/materials';

/**
 * `PATCH /api/v1/materials/{id}` (STORY-02.03 AC-2, AC-3, AC-5): the Admin changes any of a material's fields. Admin only, checked before
 * the ID is looked at, so a real ID and an invented one are refused alike (CR-33). An unknown ID, and later a hidden one, is 404. A
 * specific gravity of 0 or below is 422 (UX-37). Delete is story 02.07's.
 */
export const PATCH = withRoute({
  route: '/api/v1/materials/[id]',
  method: 'PATCH',
  params: materialIdParamsSchema,
  body: updateMaterialBodySchema,
  output: materialSchema,
  handler: ({ user, requestId, params, body }) =>
    getMastersService().updateMaterial({ actorId: user.id, actorLabel: user.name, requestId }, params.id, body),
});
