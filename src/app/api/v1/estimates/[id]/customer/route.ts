import { getEstimateService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { estimateCustomerSchema, estimateIdParamsSchema, setCustomerBodySchema } from '@/server/views/schemas/estimates';

/**
 * `PUT /api/v1/estimates/{id}/customer` (STORY-05.01 AC-3 to AC-6; architecture section 6 "Set customer"): choose the customer an estimate is for. An Admin and a
 * Lead may change any draft; an Engineer only their own. The role is checked before the ID is looked at, and an estimate that is not the Engineer's answers
 * exactly as one that does not exist (404, CR-33). An estimate that is no longer a draft is 409; a customer that does not exist or was deleted is 422 under
 * `customerId`. A changed customer raises `inputs_revision` in the same transaction; the same customer again changes nothing.
 */
export const PUT = withRoute({
  route: '/api/v1/estimates/[id]/customer',
  method: 'PUT',
  params: estimateIdParamsSchema,
  body: setCustomerBodySchema,
  output: estimateCustomerSchema,
  handler: ({ user, params, body }) => getEstimateService().setCustomer({ id: user.id, role: user.role }, params.id, body.customerId),
});
