import { NotFoundError } from '@/lib/errors';
import { getTaskService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { buildTaskDetail } from '@/server/views/engineer-task';
import { taskDetailSchema, taskIdParamsSchema } from '@/server/views/schemas/tasks';

/**
 * `GET /api/v1/tasks/{id}` (STORY-04.04 AC-1, AC-3, AC-4; architecture section 6, "Task detail"): one task and the status of its estimate. Every role may ask: an
 * Engineer is answered with their own task only, a Lead and an Admin with any, decided by the service from the session and never from the request. One route and one
 * strict schema for all three, with no cost field (NFR-002): a Lead's or an Admin's extras come from separate routes, not from a role branch here. A task that does
 * not exist and another Engineer's task are the same 404, with the same body, so the route cannot be used to find which tasks exist (CR-33). A signed-out caller gets 401.
 */
export const GET = withRoute({
  route: '/api/v1/tasks/[id]',
  method: 'GET',
  params: taskIdParamsSchema,
  output: taskDetailSchema,
  handler: async ({ user, params }) => {
    const task = await getTaskService().getTask({ id: user.id, role: user.role }, params.id);
    if (task === null) throw new NotFoundError();
    return buildTaskDetail(task);
  },
});
