import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { customerIdParamsSchema, resetCustomerResponseSchema } from '@/server/views/schemas/customers';

/**
 * `POST /api/v1/customers/{id}/reset-rates` (STORY-02.02 AC-3, AC-6): every rate of the customer goes back to the Process Master's current default, and the
 * answer is the customer and how many rates were replaced. Admin only, checked before the ID is looked at. Idempotent: a second call finds nothing to
 * replace, answers a count of 0 and writes no audit entry. An unknown or deleted ID is 404.
 */
export const POST = withRoute({
  route: '/api/v1/customers/[id]/reset-rates',
  method: 'POST',
  params: customerIdParamsSchema,
  output: resetCustomerResponseSchema,
  handler: ({ user, requestId, params }) => getMastersService().resetCustomerRates({ actorId: user.id, actorLabel: user.name, requestId }, params.id),
});
