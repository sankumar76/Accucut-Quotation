import { getEstimateStatusService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { estimateIdParamsSchema, restoreAnswerSchema } from '@/server/views/schemas/estimates';

/**
 * `POST /api/v1/estimates/{id}/restore` (CR-01 item 7D, AQP-401; FR-109, FR-102; BR-067, BR-069; architecture section 4.12 c; ADR-019, DL-304): a Lead or an Admin clears the Ignored layer. The estimate comes back with the
 * status it had when it was ignored, in the tab that status fits. Lead and Admin only, so `withRoute` refuses an Engineer with the fixed 403 **before the ID is looked at** (CR-33, NFR-002), and a signed-out caller is a 401
 * before that; the service checks the role again. **There is no body**: Restore takes no remarks of its own (the product-manager, PRD 0.43 FR-109), the person is the signed-in one and the time is the database's. No step-up.
 *
 * Then, under the estimate's row lock in **one transaction**: 404 (no such estimate), 409 `ESTIMATE_NOT_IGNORED` (a second press, which the screen treats as done). A refusal writes nothing, not even an audit entry. A
 * request that passes every check clears the three columns and records the audit entry `estimate.restored`, together or not at all. The Ignore remarks stay on record in the audit entry.
 *
 * **The answer** is `{status}` and nothing else (NFR-002): no figure, no master value, rate or formula, and no ID.
 */
export const POST = withRoute({
  route: '/api/v1/estimates/[id]/restore',
  method: 'POST',
  params: estimateIdParamsSchema,
  output: restoreAnswerSchema,
  handler: ({ user, params, requestId }) => getEstimateStatusService().restore({ id: user.id, role: user.role }, params.id, { audit: { actorId: user.id, actorLabel: user.name, requestId } }),
});
