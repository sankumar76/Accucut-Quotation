import { z } from 'zod';

import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { customerIdParamsSchema, customerSchema, updateCustomerBodySchema } from '@/server/views/schemas/customers';

const NO_CONTENT = 204;

/**
 * `PATCH /api/v1/customers/{id}` (STORY-02.02 AC-2, AC-6): the Admin changes a customer's details and any rate. Admin only, checked before the ID is looked
 * at, so a real ID and an invented one are refused alike (CR-33). An unknown or deleted ID is 404; a rate that is not one of the customer's is 409; a
 * save that changes nothing answers 200 with the customer as it is and writes no audit entry.
 */
export const PATCH = withRoute({
  route: '/api/v1/customers/[id]',
  method: 'PATCH',
  params: customerIdParamsSchema,
  body: updateCustomerBodySchema,
  output: customerSchema,
  handler: ({ user, requestId, params, body }) =>
    getMastersService().updateCustomer({ actorId: user.id, actorLabel: user.name, requestId }, params.id, body),
});

/**
 * `DELETE /api/v1/customers/{id}` (STORY-02.07 AC-1, AC-2, AC-6): soft-deletes a customer no Draft or Submitted estimate has, and answers 204 with no body.
 * While one has it the answer is 409 with those estimates named (the first ten and the count) and nothing changes. Admin only, checked before the ID is
 * looked at, so a real ID and an invented one are refused alike (CR-33). An unknown or already deleted ID is 404.
 */
export const DELETE = withRoute({
  route: '/api/v1/customers/[id]',
  method: 'DELETE',
  status: NO_CONTENT,
  params: customerIdParamsSchema,
  output: z.undefined(),
  handler: async ({ user, requestId, params }) => {
    await getMastersService().deleteCustomer({ actorId: user.id, actorLabel: user.name, requestId }, params.id);
    return undefined;
  },
});
