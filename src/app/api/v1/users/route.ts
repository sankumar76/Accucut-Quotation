import { getUserService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { createUserBodySchema, userSchema, usersResponseSchema } from '@/server/views/schemas/users';

const CREATED = 201;

/** `GET /api/v1/users` (STORY-01.04 AC-1): everyone, for SCR-14. Admin only; the role check runs before anything is read. */
export const GET = withRoute({
  route: '/api/v1/users',
  method: 'GET',
  output: usersResponseSchema,
  handler: async () => ({ users: [...(await getUserService().list())] }),
});

/** `POST /api/v1/users` (AC-1, AC-3): adds a person with a first password that they must change at their first sign-in. */
export const POST = withRoute({
  route: '/api/v1/users',
  method: 'POST',
  status: CREATED,
  body: createUserBodySchema,
  output: userSchema,
  handler: ({ user, requestId, body }) => getUserService().create({ actorId: user.id, requestId }, body),
});
