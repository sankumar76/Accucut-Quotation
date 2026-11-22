import { getApprovalService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { approveAnswerSchema, approveBodySchema, estimateIdParamsSchema } from '@/server/views/schemas/estimates';

/**
 * `POST /api/v1/estimates/{id}/approve` (STORY-06.05 AC-1 to AC-5, AC-8; STORY-06.06 AC-2, AC-6, AC-7; FR-062, FR-101; architecture sections 4.8 and 6 "Approve"): a Lead or an Admin approves a prepared
 * estimate. Lead and Admin only, so `withRoute` refuses an Engineer with the fixed 403 **before the ID is looked at** (CR-33, NFR-002), and a signed-out caller is a 401 before that. Then, under the estimate's
 * row lock in **one transaction**: 404 (no such estimate), 409 with the state machine's code (a status that is not PREPARED, an estimate already approved included), 409 `NOT_CALCULATED`, 409
 * `TOTALS_OUT_OF_DATE`, 409 `CALCULATION_CHANGED` (the `calculationId` is not the current one). A refusal writes nothing, not even an audit entry. A request that passes every check moves the estimate to
 * APPROVED, stores the approval (the price, the calculated total, the approver, the time) and records the audit entry `approval.approved`, together or not at all.
 *
 * **The answer** is `{status, approvedPrice, approvedAt}` and nothing else (NFR-002): the new status, the price the Lead set (the one figure the Lead typed) and when. No calculated figure, no master value, rate or
 * formula, and no ID, so there is nothing for a scan to find. The body is strict; the price is shape-checked here and written as paise.
 *
 * **A price that differs from the calculated total is an override** (STORY-06.07 AC-2 to AC-6; FR-103, D-18): the service compares at rupees and paise, from the total it reads itself, and writes the flag, the
 * price and the optional reason with the approval, in the same transaction. The `reason` is checked here by the shared text rule (at most 500 characters, counted as the column counts them, no control or invisible
 * character: a 422 under `reason`); it is kept, trimmed, only with an override, and one sent with the calculated total is dropped. It is in no answer of this route, and none reaches an Engineer (FR-011, NFR-002).
 */
export const POST = withRoute({
  route: '/api/v1/estimates/[id]/approve',
  method: 'POST',
  params: estimateIdParamsSchema,
  body: approveBodySchema,
  output: approveAnswerSchema,
  handler: ({ user, params, body, requestId }) =>
    getApprovalService().approve({ id: user.id, role: user.role }, params.id, { ...body, audit: { actorId: user.id, actorLabel: user.name, requestId } }),
});
