import { z } from 'zod';

import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { processItemIdParamsSchema, updateProcessItemBodySchema, updatedProcessItemSchema } from '@/server/views/schemas/process-items';

const NO_CONTENT = 204;

/**
 * `PATCH /api/v1/process-items/{id}` (STORY-02.01 AC-3, AC-5): the Admin changes a rate's name, unit or default value. Admin only,
 * checked before the ID is looked at, so a real ID and an invented one are refused alike (CR-33). A new default reaches the customers that held the old one in the
 * same transaction and the answer lists the customers that hold another value (`propagation`, STORY-02.08 AC-1, AC-2).
 */
export const PATCH = withRoute({
  route: '/api/v1/process-items/[id]',
  method: 'PATCH',
  params: processItemIdParamsSchema,
  body: updateProcessItemBodySchema,
  output: updatedProcessItemSchema,
  handler: ({ user, requestId, params, body }) =>
    getMastersService().updateProcessItem({ actorId: user.id, actorLabel: user.name, requestId }, params.id, body),
});

/**
 * `DELETE /api/v1/process-items/{id}` (AC-4, AC-5): deletes a rate no formula uses, and answers 204 with no body. While a formula
 * uses it the answer is 409 with the formulas listed and nothing changes. Admin only, checked before the ID is looked at.
 */
export const DELETE = withRoute({
  route: '/api/v1/process-items/[id]',
  method: 'DELETE',
  status: NO_CONTENT,
  params: processItemIdParamsSchema,
  output: z.undefined(),
  handler: async ({ user, requestId, params }) => {
    await getMastersService().deleteProcessItem({ actorId: user.id, actorLabel: user.name, requestId }, params.id);
    return undefined;
  },
});
