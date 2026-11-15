import { getEstimateReviewService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { costsSchema } from '@/server/views/schemas/costs';
import { estimateIdParamsSchema } from '@/server/views/schemas/estimates';

/**
 * `GET /api/v1/estimates/{id}/costs` (STORY-06.02 AC-4, AC-5; architecture section 6 "Cost"): the figures of the estimate review, for the Lead and the Admin only. The manifest row lists no other
 * role, so `withRoute` refuses an Engineer with the fixed 403 body **before the ID is looked at** (CR-33), and a signed-out caller is a 401 before that. The answer is one strict schema
 * (`costsSchema`): the state (`none`, `current`, `out-of-date`), when and with which configuration version it was calculated, each part's own count and figures, and BL, BN and the total
 * Tool Cost, with **no figure at all unless the state is `current`** and no sum except those three (NFR-002, architecture sections 4.3 and 4.8).
 */
export const GET = withRoute({
  route: '/api/v1/estimates/[id]/costs',
  method: 'GET',
  params: estimateIdParamsSchema,
  output: costsSchema,
  handler: ({ user, params }) => getEstimateReviewService().getCosts({ id: user.id, role: user.role }, params.id),
});
