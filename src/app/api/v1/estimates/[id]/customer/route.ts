import { getEstimateService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { estimateCustomerSchema, estimateIdParamsSchema, setCustomerBodySchema } from '@/server/views/schemas/estimates';

/**
 * `PUT /api/v1/estimates/{id}/customer` (STORY-05.01 AC-3 to AC-6; CR-01 item 6 AC-7, AQP-390; architecture sections 4.11 b and 6 "Set customer"): change the customer an estimate is for. **A Lead and an
 * Admin only**: an Engineer gets 403 before the ID is looked at, the same for their own estimate, another's and one that does not exist (the manifest says so, and the service refuses as well), and a
 * signed-out caller 401. An estimate that is approved is 409; a customer that does not exist or was deleted is 422 under `customerId`. A changed customer raises `inputs_revision` and writes one
 * `estimate.customer_changed` entry in the same transaction; the same customer again changes nothing.
 */
export const PUT = withRoute({
  route: '/api/v1/estimates/[id]/customer',
  method: 'PUT',
  params: estimateIdParamsSchema,
  body: setCustomerBodySchema,
  output: estimateCustomerSchema,
  handler: ({ user, requestId, params, body }) =>
    getEstimateService().setCustomer({ id: user.id, role: user.role }, { actorId: user.id, actorLabel: user.name, requestId }, params.id, body.customerId),
});
