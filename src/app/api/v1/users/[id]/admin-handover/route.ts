import { z } from 'zod';

import { getAdminHandoverService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { adminHandoverBodySchema, userIdParamsSchema } from '@/server/views/schemas/users';

const NO_CONTENT = 204;

/**
 * `POST /api/v1/users/{id}/admin-handover` (STORY-01.09 AC-2 to AC-6; FR-006; NFR-004; architecture section 6 "Hand over Admin"): the Admin hands the Admin role to the person in the path, a Lead or an Engineer who is
 * active, and becomes a Lead. **Admin only** ("A, step-up" in the manifest), so `withRoute` refuses a Lead and an Engineer with the fixed 403 **before the ID is looked at**, and a signed-out caller is a 401
 * before that. Then: 422 (the ID is not a UUID, or the body is not `{password}`), 422 `STEP_UP_FAILED` or 429 `STEP_UP_LOCKED` (the password is checked **in this request**, before anything is read or locked, on the
 * step-up's own throttle key), 409 `CANNOT_HAND_OVER_TO_SELF`, then, in **one transaction** with both rows locked: 403 (the caller is no longer the Admin: another hand-over won), 404 (no such person), 409
 * `HAND_OVER_TARGET_INACTIVE`. A refusal changes and records nothing. A request that passes everything swaps the two roles (the Admin becomes a Lead first, the target the Admin second), ends both people's sessions
 * and records the one entry `user.admin_handed_over`, together or not at all.
 *
 * **The answer is 204 with no body**, so no password and no hash can be in it; the browser then goes to the sign-in page, because the caller's session has ended. The password is read by `verifyStepUp` and
 * nothing else.
 */
export const POST = withRoute({
  route: '/api/v1/users/[id]/admin-handover',
  method: 'POST',
  status: NO_CONTENT,
  params: userIdParamsSchema,
  body: adminHandoverBodySchema,
  output: z.undefined(),
  handler: async ({ user, requestId, params, body }) => {
    await getAdminHandoverService().handOver({ actorId: user.id, actorLabel: user.name, requestId }, params.id, body.password);
    return undefined;
  },
});
