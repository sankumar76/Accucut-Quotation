import { getUnlockService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { estimateIdParamsSchema } from '@/server/views/schemas/estimates';
import { unlockAnswerSchema, unlockBodySchema } from '@/server/views/schemas/unlock';

/**
 * `POST /api/v1/estimates/{id}/unlock` (STORY-06.08 AC-2, AC-4 to AC-6; FR-063; architecture section 6 "Unlock"): a Lead or an Admin takes an approved estimate back to Draft, with a reason. Lead and Admin only, so
 * `withRoute` refuses an Engineer with the fixed 403 **before the ID is looked at** (CR-33, NFR-002), and a signed-out caller is a 401 before that. Then, under the estimate's row lock in **one transaction**: 422
 * (the reason is empty, or over 500 characters), 404 (no such estimate), 409 with the state machine's code (a status that is not APPROVED, an estimate already unlocked included), 409 `CUSTOMER_DELETED` or
 * `MATERIAL_DELETED` (a customer or a material the estimate names was deleted after the approval, AC-10). A refusal writes nothing, not even an audit entry. A request that passes every check moves the estimate to DRAFT,
 * stores the unlock on the approval (who, when, why) and records the audit entry `approval.unlocked`, together or not at all. The approved price is not touched.
 *
 * **The answer** is `{status, unlockedAt}` and nothing else (NFR-002): no calculated figure, no master value, rate or formula, and no ID, so there is nothing for a scan to find.
 */
export const POST = withRoute({
  route: '/api/v1/estimates/[id]/unlock',
  method: 'POST',
  params: estimateIdParamsSchema,
  body: unlockBodySchema,
  output: unlockAnswerSchema,
  handler: ({ user, params, body, requestId }) =>
    getUnlockService().unlock({ id: user.id, role: user.role }, params.id, { ...body, audit: { actorId: user.id, actorLabel: user.name, requestId } }),
});
