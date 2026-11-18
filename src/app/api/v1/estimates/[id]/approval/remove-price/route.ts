import { getRemovePriceService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { estimateIdParamsSchema } from '@/server/views/schemas/estimates';
import { removePriceAnswerSchema, removePriceBodySchema } from '@/server/views/schemas/remove-price';

/**
 * `POST /api/v1/estimates/{id}/approval/remove-price` (STORY-06.13 AC-2 to AC-7; FR-108; NFR-004; architecture sections 4.10 and 6 "Remove price"): the Admin removes the price of a cancelled approval with their
 * password. **Admin only** ("A, step-up" in the manifest), so `withRoute` refuses a Lead and an Engineer with the fixed 403 **before the ID is looked at** (CR-33, NFR-002), and a signed-out caller is a 401 before that.
 * Then: 422 (the body is not the shape), 422 `STEP_UP_FAILED` or 429 `STEP_UP_LOCKED` (the password is checked **in this request**, before anything is read; the session stays valid), then, under the estimate's row lock
 * in **one transaction**: 404 (no such estimate), 409 `NO_PRICE_TO_REMOVE`, 409 `APPROVAL_CHANGED` (the `approvalId` is not the latest), 409 `PRICE_ALREADY_REMOVED`, 409 `APPROVAL_NOT_CANCELLED`. A refusal writes
 * nothing, not even an audit entry. A request that passes every check stores the removal on the approval (who and when) and records the audit entry `approval.price_removed`, which **keeps the price**, together or not
 * at all. This is a separate request from the cancel: no single call does both (AC-2).
 *
 * **The answer** is `{removedAt}` and nothing else (NFR-002, AC-6): no price, no calculated figure, no master value, no ID, and never the password (AC-7), which only `verifyStepUp` reads.
 */
export const POST = withRoute({
  route: '/api/v1/estimates/[id]/approval/remove-price',
  method: 'POST',
  params: estimateIdParamsSchema,
  body: removePriceBodySchema,
  output: removePriceAnswerSchema,
  handler: ({ user, params, body, requestId }) =>
    getRemovePriceService().removePrice({ id: user.id, role: user.role }, params.id, {
      approvalId: body.approvalId,
      password: body.password,
      audit: { actorId: user.id, actorLabel: user.name, requestId },
    }),
});
