import { getMastersService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { materialOptionsBody } from '@/server/views/part-form-bodies';
import { materialOptionsResponseSchema } from '@/server/views/schemas/options';

/**
 * `GET /api/v1/options/materials` (STORY-02.03 AC-4; architecture section 6 "Safe options"): the materials the estimate form chooses from,
 * for an Admin, a Lead and an Engineer alike. The answer is IDs, names and Material Considered, through one strict schema, and **no rate of
 * any kind**: the repository does not read a price, a specific gravity or a scrap rate for it, and the schema would refuse one (ARCH-R2).
 * The hidden "Not applicable" entry is the last of this list (STORY-02.06 AC-5), with a null `materialConsidered`; it is offered here and on no Admin list (D-17).
 */
export const GET = withRoute({
  route: '/api/v1/options/materials',
  method: 'GET',
  output: materialOptionsResponseSchema,
  handler: async () => materialOptionsBody(await getMastersService().listMaterialOptions()),
});
