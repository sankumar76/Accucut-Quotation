import type { z } from 'zod';

import type { EstimateStatus } from '../../lib/estimate/state-machine';

import type { taskDetailSchema } from './schemas/tasks';

/**
 * The projection behind `GET /api/v1/tasks/{id}` (STORY-04.04 AC-1, AC-2, AC-3): one task and the status of its estimate, copied field by field from what the task
 * service hands the route, so a field added to the service's answer later (an approver, a price, an override reason) is not sent by accident. The strict schema of
 * the route parses what this returns as well, so a field the schema does not name never leaves (NFR-002).
 *
 * The prefix names the lint scope, not the audience (STORY-01.03 STD-06): `engineer-*` means "an Engineer can reach this view, so the import rule of
 * `eslint.config.mjs` applies". It is the same projection for every role (one route, one schema, architecture section 6): there is no branch on the role here, and
 * no Lead or Admin extra. It imports no service or repository (they are blocked for these views), so its input is described here, and the service's answer fits it.
 * The status is the estimate's own; its words come from `lib/estimate/task-status`, which holds no Restricted type.
 */

/** What the view reads of a task: a name, a code, a path, a text, an instant and the status. Nothing about cost. */
export interface TaskDetailSource {
  readonly id: string;
  readonly code: string;
  readonly title: string | null;
  readonly notes: string | null;
  readonly engineer: { readonly id: string; readonly name: string };
  readonly customerName: string | null;
  readonly folderPath: string;
  readonly folderUrl: string | null;
  readonly deadlineAt: Date;
  readonly status: EstimateStatus;
  readonly assignedByName: string;
}

export function buildTaskDetail(task: TaskDetailSource): z.input<typeof taskDetailSchema> {
  return {
    id: task.id,
    code: task.code,
    title: task.title,
    notes: task.notes,
    engineer: { id: task.engineer.id, name: task.engineer.name },
    customerName: task.customerName,
    folderPath: task.folderPath,
    folderUrl: task.folderUrl,
    deadlineAt: task.deadlineAt.toISOString(),
    status: task.status,
    assignedByName: task.assignedByName,
  };
}
