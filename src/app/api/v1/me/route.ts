import { isDesignSystemAvailable } from '@/lib/design-system-gate';
import { getTaskService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { buildMe } from '@/server/views/engineer-me';
import { meResponseSchema } from '@/server/views/schemas/me';

/**
 * `GET /api/v1/me` (STORY-01.02 AC-7): who is signed in, their menu and the overdue count. Every role; 401 when signed out. The count is the role's (STORY-04.03 AC-2):
 * an Engineer's own overdue tasks, the overdue tasks a Lead assigned, every overdue task for an Admin. It is read here and handed to the view, which stays free of tasks and cost.
 */
export const GET = withRoute({
  route: '/api/v1/me',
  method: 'GET',
  output: meResponseSchema,
  handler: async ({ user }) => buildMe(user, { includeHiddenInProduction: isDesignSystemAvailable(), overdueCount: await getTaskService().countOverdue(user) }),
});
