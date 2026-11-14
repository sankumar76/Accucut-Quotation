import { getEstimateService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { estimateIdParamsSchema, moveTreeBodySchema, partsTreeSchema } from '@/server/views/schemas';

/**
 * `POST /api/v1/estimates/{id}/tree/move` (STORY-05.02 AC-2, AC-4 to AC-7; architecture section 6 "Reorder"): move a part, with its sub-parts, under another part or to
 * the top, at a place among its new siblings. An Admin and a Lead may change any draft, an Engineer only their own. The order of the refusals is: 404 (the estimate is
 * not theirs, or the part is not in it), 409 (not a draft, or the part changed since the person looked, with the tree), 422 under `parentId` (a parent that is not in
 * the estimate, or the part itself or one of its own sub-parts). A move to where the part already is changes nothing. A move changes no input and no price.
 */
export const POST = withRoute({
  route: '/api/v1/estimates/[id]/tree/move',
  method: 'POST',
  params: estimateIdParamsSchema,
  body: moveTreeBodySchema,
  output: partsTreeSchema,
  handler: async ({ user, params, body }) => ({ nodes: [...(await getEstimateService().moveNode({ id: user.id, role: user.role }, params.id, body))] }),
});
