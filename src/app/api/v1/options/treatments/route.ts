import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { treatmentOptionsResponseSchema } from '@/server/views/schemas/options';

/**
 * `GET /api/v1/options/treatments` (STORY-02.05 AC-5; architecture section 6 "Safe options"): the treatments the estimate form chooses from, for an
 * Admin, a Lead and an Engineer alike, "Other" included. The answer is IDs and names through one strict schema, and **no rate of any kind**: the
 * table has none, and the schema would refuse one. The "Not applicable" entry joins this list in story 02.06.
 */
export const GET = withRoute({
  route: '/api/v1/options/treatments',
  method: 'GET',
  output: treatmentOptionsResponseSchema,
  handler: async () => ({ options: await getMastersService().listTreatmentOptions() }),
});
