import { z } from 'zod';

import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { materialIdParamsSchema, materialSchema, updateMaterialBodySchema } from '@/server/views/schemas/materials';

const NO_CONTENT = 204;

/**
 * `PATCH /api/v1/materials/{id}` (STORY-02.03 AC-2, AC-3, AC-5): the Admin changes any of a material's fields. Admin only, checked before
 * the ID is looked at, so a real ID and an invented one are refused alike (CR-33). An unknown ID, and later a hidden one, is 404. A
 * specific gravity of 0 or below is 422 (UX-37).
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

/**
 * `DELETE /api/v1/materials/{id}` (STORY-02.07 AC-3, AC-6): soft-deletes a material no Draft or Submitted estimate has in a part, and answers 204 with no body.
 * While one has it the answer is 409 `MATERIAL_IN_USE` with those estimates named (the first ten and the count) and nothing changes. Admin only, checked before
 * the ID is looked at, so a real ID and an invented one are refused alike (CR-33). An unknown, already deleted or hidden ID ("Not applicable") is 404.
 */
export const DELETE = withRoute({
  route: '/api/v1/materials/[id]',
  method: 'DELETE',
  status: NO_CONTENT,
  params: materialIdParamsSchema,
  output: z.undefined(),
  handler: async ({ user, requestId, params }) => {
    await getMastersService().deleteMaterial({ actorId: user.id, actorLabel: user.name, requestId }, params.id);
    return undefined;
  },
});
