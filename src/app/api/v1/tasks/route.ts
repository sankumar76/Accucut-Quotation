import { getTaskService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { assignedTaskSchema, assignTaskBodySchema } from '@/server/views/schemas/tasks';

const CREATED = 201;

/**
 * `POST /api/v1/tasks` (STORY-04.01 AC-1, AC-3, AC-5): a Lead or an Admin assigns a task to an Engineer. The task and its empty estimate are written in one
 * transaction, and the caller from the session is `assigned_by`. A field that is wrong is 422 with the UX spec's words under the field it names, and nothing is
 * stored; an inactive person or a person who is not an Engineer is "Choose an Engineer." (422). An Engineer gets 403 and a signed-out visitor 401, before the
 * body is read.
 */
export const POST = withRoute({
  route: '/api/v1/tasks',
  method: 'POST',
  status: CREATED,
  body: assignTaskBodySchema,
  output: assignedTaskSchema,
  handler: async ({ user, body }) => {
    const task = await getTaskService().assignTask(user.id, body);
    return { ...task, deadlineAt: task.deadlineAt.toISOString() };
  },
});
