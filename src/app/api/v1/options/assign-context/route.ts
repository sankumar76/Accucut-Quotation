import { getTaskService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { assignContextSchema } from '@/server/views/schemas/tasks';

/**
 * `GET /api/v1/options/assign-context` (STORY-04.01 AC-5; architecture section 6 "Assign context"): the active Engineers SCR-04 chooses from, by ID and name. For a
 * Lead and an Admin only; an Engineer gets 403 before anything is read. The answer holds no e-mail address and nothing else about a person.
 */
export const GET = withRoute({
  route: '/api/v1/options/assign-context',
  method: 'GET',
  output: assignContextSchema,
  handler: () => getTaskService().getAssignContext(),
});
