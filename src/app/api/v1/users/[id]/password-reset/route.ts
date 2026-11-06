import { z } from 'zod';

import { getUserService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { resetPasswordBodySchema, userIdParamsSchema } from '@/server/views/schemas/users';

const NO_CONTENT = 204;

/**
 * `POST /api/v1/users/{id}/password-reset` (STORY-01.04 AC-5): the Admin sets a new, temporary password for a person.
 * The answer is 204 with no body, so no password and no hash can be in it. Admin only, checked before the ID is looked at.
 */
export const POST = withRoute({
  route: '/api/v1/users/[id]/password-reset',
  method: 'POST',
  status: NO_CONTENT,
  params: userIdParamsSchema,
  body: resetPasswordBodySchema,
  output: z.undefined(),
  handler: async ({ user, requestId, params, body }) => {
    await getUserService().resetPassword({ actorId: user.id, requestId }, params.id, body.password);
    return undefined;
  },
});
