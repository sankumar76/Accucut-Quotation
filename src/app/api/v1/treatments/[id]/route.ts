import { z } from 'zod';

import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { treatmentIdParamsSchema, treatmentSchema, updateTreatmentBodySchema } from '@/server/views/schemas/treatments';

const NO_CONTENT = 204;

/**
 * `PATCH /api/v1/treatments/{id}` (STORY-02.05 AC-2, AC-3, AC-6): the Admin renames a treatment. Admin only, checked before the ID is looked at, so
 * a real ID and an invented one are refused alike (CR-33). An unknown or hidden ID is 404; the locked "Other" entry is refused with 409 and
 * nothing changes.
 */
export const PATCH = withRoute({
  route: '/api/v1/treatments/[id]',
  method: 'PATCH',
  params: treatmentIdParamsSchema,
  body: updateTreatmentBodySchema,
  output: treatmentSchema,
  handler: ({ user, requestId, params, body }) =>
    getMastersService().updateTreatment({ actorId: user.id, actorLabel: user.name, requestId }, params.id, body),
});

/**
 * `DELETE /api/v1/treatments/{id}` (AC-3, AC-4, AC-6): deletes a treatment and answers 204 with no body. Admin only, checked before the ID is looked
 * at. An unknown or hidden ID is 404; the locked "Other" entry is refused with 409 and nothing changes.
 */
export const DELETE = withRoute({
  route: '/api/v1/treatments/[id]',
  method: 'DELETE',
  status: NO_CONTENT,
  params: treatmentIdParamsSchema,
  output: z.undefined(),
  handler: async ({ user, requestId, params }) => {
    await getMastersService().deleteTreatment({ actorId: user.id, actorLabel: user.name, requestId }, params.id);
    return undefined;
  },
});
