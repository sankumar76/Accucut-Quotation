import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { customerIdParamsSchema, customerSchema, updateCustomerBodySchema } from '@/server/views/schemas/customers';

/**
 * `PATCH /api/v1/customers/{id}` (STORY-02.02 AC-2, AC-6): the Admin changes a customer's details and any rate. Admin only, checked before the ID is looked
 * at, so a real ID and an invented one are refused alike (CR-33). An unknown or deleted ID is 404; a rate that is not one of the customer's is 409; a
 * save that changes nothing answers 200 with the customer as it is and writes no audit entry. `DELETE` is story 02.07's.
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
