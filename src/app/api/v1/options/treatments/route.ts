import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { treatmentOptionsBody } from '@/server/views/part-form-bodies';
import { treatmentOptionsResponseSchema } from '@/server/views/schemas/options';

/**
 * `GET /api/v1/options/treatments` (STORY-02.05 AC-5; architecture section 6 "Safe options"): the treatments the estimate form chooses from, for an
 * Admin, a Lead and an Engineer alike, "Other" included. The answer is IDs and names through one strict schema, and **no rate of any kind**: the
 * table has none, and the schema would refuse one. The hidden "Not applicable" entry is the last of this list (STORY-02.06 AC-5); it is offered here and on no Admin list (D-17).
 */
export const GET = withRoute({
  route: '/api/v1/options/treatments',
  method: 'GET',
  output: treatmentOptionsResponseSchema,
  handler: async () => treatmentOptionsBody(await getMastersService().listTreatmentOptions()),
});
