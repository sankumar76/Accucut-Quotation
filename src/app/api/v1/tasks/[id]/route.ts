import { NotFoundError } from '@/lib/errors';
import { getTaskService } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { buildTaskDetail } from '@/server/views/engineer-task';
import { reassignedTaskSchema, reassignTaskBodySchema, taskDetailSchema, taskIdParamsSchema } from '@/server/views/schemas/tasks';

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

/**
 * `PATCH /api/v1/tasks/{id}` (STORY-04.07 AC-3, AC-4, AC-6, AC-7; architecture section 6, "Change task"): a Lead or an Admin gives an open task to another Engineer, moves its deadline, or both.
 * Any Lead or Admin may change any open task (D-f). An Engineer gets 403 and a signed-out caller 401 before the task is read or the body is parsed; an ID that is no task is 404; an
 * approved task is 409 `TASK_CLOSED`; a value that is wrong is 422 with the words of assigning under the field. The change, its revision and its audit entry are one transaction under the
 * task's and the estimate's row locks. The answer is the task as the queue shows it, with no cost.
 */
export const PATCH = withRoute({
  route: '/api/v1/tasks/[id]',
  method: 'PATCH',
  params: taskIdParamsSchema,
  body: reassignTaskBodySchema,
  output: reassignedTaskSchema,
  handler: async ({ user, params, body, requestId }) => {
    const { task } = await getTaskService().reassignTask({ actorId: user.id, actorLabel: user.name, requestId }, params.id, body);
    return { ...task, deadlineAt: task.deadlineAt.toISOString() };
  },
});
