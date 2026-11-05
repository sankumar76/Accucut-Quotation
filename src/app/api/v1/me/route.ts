import { isDesignSystemAvailable } from '@/lib/design-system-gate';
import { withRoute } from '@/server/http/with-route';
import { meResponseSchema } from '@/server/views/schemas/me';
import { buildMe } from '@/server/views/me-view';

/** `GET /api/v1/me` (STORY-01.02 AC-7): who is signed in, their menu and the overdue count. Every role; 401 when signed out. */
export const GET = withRoute({
  route: '/api/v1/me',
  method: 'GET',
  output: meResponseSchema,
  handler: ({ user }) => buildMe(user, { includeHiddenInProduction: isDesignSystemAvailable() }),
});
