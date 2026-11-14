import { ACCEPT_JSON, isRecord, sendJson, type Fetch, type Outcome } from '../api-client';

import { isQueueTab, queueQueryString, type QueueCounts, type QueueTab, type TaskEstimateStatus } from './queue';

/**
 * The browser's side of `GET /api/v1/tasks` (SCR-03; architecture section 6, "Tasks"): ask for a page of a tab and turn the answer into something the screen
 * can draw. Nothing here decides anything: who sees which tasks, the order and the counts are the server's. An answer that does not look like a page of the
 * queue is a failure, never an empty list: a screen that said "No open tasks" for a broken answer would tell a Lead that nothing is assigned.
 */

/** A task as the screen draws a row. The deadline is UTC text, shown with `formatIst`. */
export interface QueueRowData {
  readonly id: string;
  readonly code: string;
  readonly title: string | null;
  readonly engineerName: string;
  readonly customerName: string | null;
  readonly folderPath: string;
  readonly folderUrl: string | null;
  readonly deadlineAt: string;
  readonly status: TaskEstimateStatus;
  readonly assignedByName: string;
}

export interface QueuePageData {
  readonly tab: QueueTab;
  readonly tasks: ReadonlyArray<QueueRowData>;
  readonly counts: QueueCounts;
  readonly nextCursor: string | null;
}

const TASKS_PATH = '/api/v1/tasks';
const STATUSES: ReadonlyArray<TaskEstimateStatus> = ['DRAFT', 'SUBMITTED', 'APPROVED'];

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** The text, or `undefined` for a value that is not text. */
const textOf = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** The text, `null` for `null`, or `undefined` for a value that is neither. */
const nullableTextOf = (value: unknown): string | null | undefined => (value === null ? null : textOf(value));

function toRow(value: unknown): QueueRowData | null {
  if (!isRecord(value) || !isRecord(value['engineer'])) return null;
  const id = textOf(value['id']);
  const code = textOf(value['code']);
  const engineerName = textOf(value['engineer']['name']);
  const folderPath = textOf(value['folderPath']);
  const deadlineAt = textOf(value['deadlineAt']);
  const assignedByName = textOf(value['assignedByName']);
  const title = nullableTextOf(value['title']);
  const customerName = nullableTextOf(value['customerName']);
  const folderUrl = nullableTextOf(value['folderUrl']);
  const status = STATUSES.find((candidate) => candidate === value['status']);
  if (id === undefined || code === undefined || engineerName === undefined || folderPath === undefined || deadlineAt === undefined || assignedByName === undefined) return null;
  if (title === undefined || customerName === undefined || folderUrl === undefined || status === undefined) return null;
  return { id, code, title, engineerName, customerName, folderPath, folderUrl, deadlineAt, status, assignedByName };
}

function toCounts(value: unknown): QueueCounts | null {
  if (!isRecord(value)) return null;
  const { open, closed, overdue } = value;
  return isCount(open) && isCount(closed) && isCount(overdue) ? { open, closed, overdue } : null;
}

/** The page of the queue that an answer of `GET /api/v1/tasks` is, or null for a body that is not one. The server's own page reads its first paint through it too. */
export function readQueuePage(body: unknown): QueuePageData | null {
  if (!isRecord(body) || !Array.isArray(body['tasks'])) return null;
  const { tab, nextCursor } = body;
  const counts = toCounts(body['counts']);
  if (typeof tab !== 'string' || !isQueueTab(tab) || counts === null) return null;
  if (!(nextCursor === null || typeof nextCursor === 'string')) return null;
  const tasks = body['tasks'].map(toRow);
  return tasks.every((row): row is QueueRowData => row !== null) ? { tab, tasks, counts, nextCursor } : null;
}

/**
 * One page of a tab, after `cursor` when one is given. Pass a `signal` to cancel the call when the person changes tab before the answer arrives; a cancelled
 * call answers `failed`, which the screen ignores when a newer call has taken over. A session that ended takes the person to sign-in (`sendJson`).
 */
export function fetchQueuePage(tab: QueueTab, cursor?: string, doFetch: Fetch = fetch, signal?: AbortSignal): Promise<Outcome<QueuePageData>> {
  return sendJson(doFetch, `${TASKS_PATH}?${queueQueryString(tab, cursor)}`, { method: 'GET', headers: ACCEPT_JSON, ...(signal === undefined ? {} : { signal }) }, readQueuePage);
}
