import { getEstimateStatusService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { estimateIdParamsSchema, ignoreAnswerSchema, ignoreBodySchema } from '@/server/views/schemas/estimates';

/**
 * `POST /api/v1/estimates/{id}/ignore` (CR-01 item 7D, AQP-401; FR-109, FR-102; BR-067, BR-069; architecture section 4.12 c; ADR-019, DL-304): a Lead or an Admin sets an estimate aside with remarks. It leaves Open and
 * Overdue and is listed under Ignored; the status underneath is kept, so Restore loses nothing. Lead and Admin only, so `withRoute` refuses an Engineer with the fixed 403 **before the ID is looked at** (CR-33, NFR-002),
 * and a signed-out caller is a 401 before that; the service checks the role again. No step-up: Ignore is reversible and moves no price (the product-manager's ruling, DL-300).
 *
 * The body is `{ remarks }`: the Lead's own words, judged by the shared text rule (`checkIgnoreRemarks`, DL-219): 1 to 500 code points once trimmed, no hidden character, otherwise 422 under `remarks`. Then, under the
 * estimate's row lock in **one transaction**: 404 (no such estimate), 409 with the state machine's code (`ESTIMATE_QUOTED_IS_FINAL` from a Quoted estimate, `ESTIMATE_ALREADY_IGNORED` from a second press, which the screen
 * treats as done). A refusal writes nothing, not even an audit entry. A request that passes every check writes the three columns of the layer and records the audit entry `estimate.ignored`, together or not at all.
 *
 * **The answer** is `{status, ignored: {at, byName, remarks}}` and nothing else (NFR-002): the status underneath, a UTC time, a name and the Lead's words. No figure, no master value, rate or formula, and no ID.
 */
export const POST = withRoute({
  route: '/api/v1/estimates/[id]/ignore',
  method: 'POST',
  params: estimateIdParamsSchema,
  body: ignoreBodySchema,
  output: ignoreAnswerSchema,
  handler: ({ user, params, body, requestId }) =>
    getEstimateStatusService().ignore({ id: user.id, role: user.role }, params.id, { remarks: body.remarks, audit: { actorId: user.id, actorLabel: user.name, requestId } }),
});
