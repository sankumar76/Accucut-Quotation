import { getCostDetailsService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { nodeCostsSchema } from '@/server/views/schemas/node-costs';
import { nodeParamsSchema } from '@/server/views/schemas/tree';

/**
 * `GET /api/v1/estimates/{id}/nodes/{nodeId}/costs` (STORY-06.03 AC-1, AC-7, AC-8; architecture section 6 "Cost details"): the six stages of one row, each line with its formula, the same formula with the
 * values it was worked out from, and its value, for the Lead and the Admin only. The manifest row lists no other role, so `withRoute` refuses an Engineer with the fixed 403 **before either ID is looked
 * at** (CR-33), and a signed-out caller is a 401 before that. A part that is not in this estimate is the same 404 as an estimate that does not exist. The answer is one strict schema (`nodeCostsSchema`):
 * the state alone while it is `none` or `out-of-date`, and the stages of this row, and no other, while it is `current` (NFR-002, architecture sections 4.8 and 4.9).
 */
export const GET = withRoute({
  route: '/api/v1/estimates/[id]/nodes/[nodeId]/costs',
  method: 'GET',
  params: nodeParamsSchema,
  output: nodeCostsSchema,
  handler: ({ user, params }) => getCostDetailsService().getNodeCosts({ id: user.id, role: user.role }, params.id, params.nodeId),
});
