import { isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

import type { AssignInput } from './assign';
import type { ReassignInput } from './reassign';

/**
 * The browser's side of `POST /api/v1/tasks` (SCR-04; architecture section 6 "Create task"): send the form, and turn the answer into something the screen
 * can show. Nothing here decides anything: whether the Engineer is active, whether the path is a UNC path and whether the deadline is later than now are the
 * server's, and this file only reads its answer (an answer of the wrong shape is a failure, not a crash).
 */

/** The task that was assigned, as the success notice and the folder link need it. */
export interface AssignedTaskView {
  readonly id: string;
  readonly code: string;
  readonly engineerName: string;
  readonly folderPath: string;
  /** The `file:` link the server built from the path. */
  readonly folderUrl: string;
}

const TASKS_PATH = '/api/v1/tasks';

function toAssignedTask(value: unknown): AssignedTaskView | null {
  if (!isRecord(value) || !isRecord(value['engineer'])) return null;
  const { id, code, folderPath, folderUrl } = value;
  const name = value['engineer']['name'];
  if (typeof id !== 'string' || typeof code !== 'string' || typeof folderPath !== 'string' || typeof folderUrl !== 'string' || typeof name !== 'string') return null;
  return { id, code, engineerName: name, folderPath, folderUrl };
}

/** `POST /api/v1/tasks`: the answer is the new task with its code. */
export function assignTask(input: AssignInput, doFetch: Fetch = fetch): Promise<Outcome<AssignedTaskView>> {
  return sendJson(doFetch, TASKS_PATH, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) }, toAssignedTask);
}

/** The task after a reassign, as the success notice needs it: who has it and when it is due. */
export interface ReassignedTaskView {
  readonly id: string;
  readonly code: string;
  readonly engineerName: string;
  /** An ISO 8601 instant in UTC. */
  readonly deadlineAt: string;
}

function toReassignedTask(value: unknown): ReassignedTaskView | null {
  if (!isRecord(value) || !isRecord(value['engineer'])) return null;
  const { id, code, deadlineAt } = value;
  const name = value['engineer']['name'];
  if (typeof id !== 'string' || typeof code !== 'string' || typeof deadlineAt !== 'string' || typeof name !== 'string') return null;
  return { id, code, engineerName: name, deadlineAt };
}

/**
 * `PATCH /api/v1/tasks/{id}` (STORY-04.07): the new Engineer's ID and/or the new deadline as a UTC instant, only what changed. The answer is the task as the queue shows it; a refusal carries the
 * server's messages under the field they name (422, `engineerId` and `deadlineAt`) or the code `TASK_CLOSED` (409, an approved task).
 */
export function reassignTask(id: string, changes: ReassignInput, doFetch: Fetch = fetch): Promise<Outcome<ReassignedTaskView>> {
  return sendJson(doFetch, `${TASKS_PATH}/${encodeURIComponent(id)}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(changes) }, toReassignedTask);
}
