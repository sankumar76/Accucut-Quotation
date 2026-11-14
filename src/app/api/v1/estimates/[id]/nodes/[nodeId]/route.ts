import { getEstimateService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { deleteNodeQuerySchema, moveNodeBodySchema, nodeDetailSchema, nodeParamsSchema, partsTreeSchema } from '@/server/views/schemas';

/**
 * `GET`, `PUT` and `DELETE /api/v1/estimates/{id}/nodes/{nodeId}` (STORY-05.02 AC-1 to AC-8; architecture section 6 "Node"). An Admin and a Lead may use any
 * estimate, an Engineer only their own, and a change is allowed while this person may change its inputs (`assertEditable`: a draft for an Engineer, their own only; a draft or a submitted estimate for a Lead or an Admin; never an approved one); and an estimate or a part that is not theirs answers exactly as one that does not exist (404, CR-33).
 * The order of the refusals of a change is: 404, 409 (not editable by this person, or the part changed since the person looked, with the tree), 422 under `parentId`.
 */

/** One part with what was typed into it. */
export const GET = withRoute({
  route: '/api/v1/estimates/[id]/nodes/[nodeId]',
  method: 'GET',
  params: nodeParamsSchema,
  output: nodeDetailSchema,
  // The part is read through its own strict schema here as well as by `withRoute`: `inputs` is strictly empty until STORY-05.03 names the fields, so a value
  // that nothing declared fails closed (a generic 500) instead of leaving, and the handler returns the schema's own type.
  handler: async ({ user, params }) => nodeDetailSchema.parse(await getEstimateService().getNode({ id: user.id, role: user.role }, params.id, params.nodeId)),
});

/** Move the part to another parent or place: the same move as `POST /tree/move`, with the part in the path. Answers with the tree. */
export const PUT = withRoute({
  route: '/api/v1/estimates/[id]/nodes/[nodeId]',
  method: 'PUT',
  params: nodeParamsSchema,
  body: moveNodeBodySchema,
  output: partsTreeSchema,
  handler: async ({ user, params, body }) => ({ nodes: [...(await getEstimateService().moveNode({ id: user.id, role: user.role }, params.id, { nodeId: params.nodeId, ...body }))] }),
});

/**
 * Delete the part and all its sub-parts in one transaction. `revision` is the part as the person saw it, `parts` the number they were told would go (the part
 * and every sub-part) and `subtree` the fingerprint of those parts with their revisions: when any is no longer right (a part added, moved in, replaced or typed into since)
 * nothing is deleted (409 with the tree). Answers with the tree.
 */
export const DELETE = withRoute({
  route: '/api/v1/estimates/[id]/nodes/[nodeId]',
  method: 'DELETE',
  params: nodeParamsSchema,
  query: deleteNodeQuerySchema,
  output: partsTreeSchema,
  handler: async ({ user, params, query }) => ({ nodes: [...(await getEstimateService().deleteNode({ id: user.id, role: user.role }, params.id, { nodeId: params.nodeId, ...query }))] }),
});
