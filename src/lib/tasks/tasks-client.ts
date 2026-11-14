import { isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

import type { AssignInput } from './assign';

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
