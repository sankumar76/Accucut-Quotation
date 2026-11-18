import { getCancelApprovalService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { cancelApprovalAnswerSchema, cancelApprovalBodySchema } from '@/server/views/schemas/cancel-approval';
import { estimateIdParamsSchema } from '@/server/views/schemas/estimates';

/**
 * `POST /api/v1/estimates/{id}/approval/cancel` (STORY-06.12 AC-1, AC-3 to AC-5, AC-7, AC-9, AC-10; FR-107; NFR-004; architecture sections 4.10 and 6 "Cancel approval"): the Admin cancels an approval with a reason and
 * their password. **Admin only** ("A, step-up" in the manifest), so `withRoute` refuses a Lead and an Engineer with the fixed 403 **before the ID is looked at** (CR-33, NFR-002), and a signed-out caller is a 401 before
 * that. Then: 422 (the reason is empty or over 500 characters; the body is not the shape), 422 `STEP_UP_FAILED` or 429 `STEP_UP_LOCKED` (the password is checked **in this request**, before anything is read; the session
 * stays valid), then, under the estimate's row lock in **one transaction**: 404 (no such estimate), 409 `CUSTOMER_DELETED` or `MATERIAL_DELETED` (a customer or a material the estimate names was deleted, AC-9), 409
 * `NO_APPROVAL_TO_CANCEL`, 409 `APPROVAL_CHANGED` (the `approvalId` is not the latest), 409 `APPROVAL_ALREADY_CANCELLED`. A refusal writes nothing, not even an audit entry. A request that passes every check stores the
 * cancel on the approval (who, when, why), moves an APPROVED estimate to DRAFT (a DRAFT or SUBMITTED one keeps its status, AC-10) and records the audit entry `approval.cancelled`, together or not at all.
 *
 * **The answer** is `{status, cancelledAt}` and nothing else (NFR-002): no price, no calculated figure, no master value, no ID, and never the password (AC-7), which only `verifyStepUp` reads.
 */
export const POST = withRoute({
  route: '/api/v1/estimates/[id]/approval/cancel',
  method: 'POST',
  params: estimateIdParamsSchema,
  body: cancelApprovalBodySchema,
  output: cancelApprovalAnswerSchema,
  handler: ({ user, params, body, requestId }) =>
    getCancelApprovalService().cancel({ id: user.id, role: user.role }, params.id, {
      approvalId: body.approvalId,
      reason: body.reason,
      password: body.password,
      audit: { actorId: user.id, actorLabel: user.name, requestId },
    }),
});
