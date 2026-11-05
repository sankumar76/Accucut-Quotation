import { getUserService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { updateUserBodySchema, userIdParamsSchema, userSchema } from '@/server/views/schemas/users';

/**
 * `PATCH /api/v1/users/{id}` (STORY-01.04 AC-1, AC-3, AC-4): the Admin changes a person's name or role, or deactivates or
 * activates them. Admin only, checked before the ID is looked at, so a real ID and an invented one are refused alike.
 */
export const PATCH = withRoute({
  route: '/api/v1/users/[id]',
  method: 'PATCH',
  params: userIdParamsSchema,
  body: updateUserBodySchema,
  output: userSchema,
  handler: ({ user, params, body }) => getUserService().update(user.id, params.id, body),
});
