import { getEstimateService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { estimateIdParamsSchema, partsTreeSchema } from '@/server/views/schemas';

/**
 * `GET /api/v1/estimates/{id}/tree` (STORY-05.02 AC-8; architecture section 6 "Tree"): the parts of an estimate in reading order, each with its ID, parent, Sl. No,
 * label, completeness and revision. An Admin and a Lead may read any estimate, an Engineer only their own; an estimate that is not theirs answers exactly as one that
 * does not exist (404, CR-33). **One schema for every role, and no figure in it** (NFR-002, ADR-008): a Lead's figures come from other routes that an Engineer cannot call.
 */
export const GET = withRoute({
  route: '/api/v1/estimates/[id]/tree',
  method: 'GET',
  params: estimateIdParamsSchema,
  output: partsTreeSchema,
  handler: async ({ user, params }) => ({ nodes: [...(await getEstimateService().getTree({ id: user.id, role: user.role }, params.id))] }),
});
