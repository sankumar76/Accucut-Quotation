import { getEstimateService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { addedNodeSchema, addNodeBodySchema, estimateIdParamsSchema } from '@/server/views/schemas';

/**
 * `POST /api/v1/estimates/{id}/nodes` (STORY-05.02 AC-1, AC-5, AC-7; architecture section 6 "Node"): add a part with empty inputs: a new item last at the top, a
 * sub-part last under a part, or a part right after a part. An Admin and a Lead may add to any draft, an Engineer only to their own. The Sl. No is not stored: the
 * answer carries the new part's ID and the tree, from which it is read. Adding is an input change, so `inputs_revision` rises in the same transaction.
 */
export const POST = withRoute({
  route: '/api/v1/estimates/[id]/nodes',
  method: 'POST',
  status: 201,
  params: estimateIdParamsSchema,
  body: addNodeBodySchema,
  output: addedNodeSchema,
  handler: async ({ user, params, body }) => {
    const added = await getEstimateService().addPart({ id: user.id, role: user.role }, params.id, body);
    return { nodeId: added.nodeId, nodes: [...added.nodes] };
  },
});
