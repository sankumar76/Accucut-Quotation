import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { customerOptionsResponseSchema } from '@/server/views/schemas/options';

/**
 * `GET /api/v1/options/customers` (STORY-02.02 AC-5; architecture section 6 "Safe options"): the customers the estimate form chooses from, for an Admin, a
 * Lead and an Engineer alike. The answer is IDs and names through one strict schema: **no contact detail and no rate of any kind**, and the schema would refuse one.
 */
export const GET = withRoute({
  route: '/api/v1/options/customers',
  method: 'GET',
  output: customerOptionsResponseSchema,
  handler: async () => ({ options: await getMastersService().listCustomerOptions() }),
});
