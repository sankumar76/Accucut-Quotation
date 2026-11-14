import type { z } from 'zod';

import type { TaskQueue } from '../services/task-service';

import type { taskQueueSchema } from './schemas/tasks';

/**
 * The queue as the route and the page send it (STORY-04.02): the instants as ISO 8601 text in UTC, and nothing else changed. One function for both, so the page's
 * first paint and `GET /api/v1/tasks` cannot drift apart. The strict schema of the route still parses what this returns.
 */
export function queueAnswer(queue: TaskQueue): z.input<typeof taskQueueSchema> {
  return {
    tab: queue.tab,
    tasks: queue.tasks.map((task) => ({ ...task, deadlineAt: task.deadlineAt.toISOString() })),
    counts: queue.counts,
    nextCursor: queue.nextCursor,
  };
}
