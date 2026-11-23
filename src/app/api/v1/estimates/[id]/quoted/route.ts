import { getEstimateStatusService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { estimateIdParamsSchema, markQuotedAnswerSchema } from '@/server/views/schemas/estimates';

/**
 * `POST /api/v1/estimates/{id}/quoted` (CR-01 item 7C, AQP-400; FR-110, FR-065; BR-066, BR-069; architecture section 4.12 c; ADR-019): a Lead or an Admin marks an APPROVED estimate as quoted once the quote has gone
 * to the customer. Lead and Admin only, so `withRoute` refuses an Engineer with the fixed 403 **before the ID is looked at** (CR-33, NFR-002), and a signed-out caller is a 401 before that; the service checks the role
 * again. **There is no body**: the person is the signed-in one and the time is the database's, so nothing a caller sends can change what is written. No step-up: marking moves no price (the product-manager's ruling).
 *
 * Then, under the estimate's row lock in **one transaction**: 404 (no such estimate), 409 `ESTIMATE_IGNORED` (an ignored estimate, whatever its status underneath), 409 with the state machine's code (`ESTIMATE_NOT_APPROVED`
 * from a Draft or a Prepared estimate; `ESTIMATE_ALREADY_QUOTED` from a second press, which the screen treats as done and reloads). A refusal writes nothing, not even an audit entry. A request that passes every check
 * moves the estimate to QUOTED with `quoted_at` and `quoted_by` and records the audit entry `estimate.quoted`, together or not at all.
 *
 * **The answer** is `{status, quoted: {at, byName}}` and nothing else (NFR-002): the status QUOTED, the time as UTC text and the person's name. No figure, no master value, rate or formula, and no ID. There is no route that
 * un-marks a quote: the only way back is Unlock (A-CR01-3).
 */
export const POST = withRoute({
  route: '/api/v1/estimates/[id]/quoted',
  method: 'POST',
  params: estimateIdParamsSchema,
  output: markQuotedAnswerSchema,
  handler: ({ user, params, requestId }) => getEstimateStatusService().markQuoted({ id: user.id, role: user.role }, params.id, { audit: { actorId: user.id, actorLabel: user.name, requestId } }),
});
