/**
 * The task queue's vocabulary (STORY-04.02; FR-034, architecture sections 4.4 and 6): the four tabs, the page size and the query string the screen sends.
 * Pure and small, so the browser carries it and the server reads the same names (no zod here: the page does not carry it).
 *
 * Open is "not closed": an estimate that is not APPROVED or QUOTED, and not ignored. Closed is an APPROVED or a QUOTED estimate that is not ignored. Overdue is open **and** past its deadline, so an overdue task is in
 * Open as well (the sort note says so). **Ignored** (CR-01 item 7D, AQP-401) is the layer over the status: an ignored task is in that tab alone, whatever its status underneath. All four are derived from
 * `estimates.status`, `estimates.ignored_at` and the deadline, never stored (architecture sections 4.4 and 4.12 a).
 */

import type { DisplayStatus } from '../estimate/task-status';

/** The tabs in the order the screen draws them, which is FR-034's: Open, Overdue, Closed, Ignored (DEF-103; SCR-03). The tab strip and the arrow keys follow this list. */
export const QUEUE_TABS = ['open', 'overdue', 'closed', 'ignored'] as const;

export type QueueTab = (typeof QUEUE_TABS)[number];

export const DEFAULT_QUEUE_TAB: QueueTab = 'open';

/** The tab names as the person reads them. */
export const QUEUE_TAB_LABELS: Readonly<Record<QueueTab, string>> = { open: 'Open', closed: 'Closed', overdue: 'Overdue', ignored: 'Ignored' };

/**
 * Whether an Engineer sees their **own** Ignored tasks, read-only and with the Lead's remarks (A-CR01-2, confirmed 2026-11-23: "Yes, Ignored tab"). **The one place that says so**: the queue's scope, the counts and the
 * task read all ask it, so the answer cannot differ between them. A task of another Engineer is never theirs, whatever this says (it opens as not found, as any task that is not theirs).
 */
export const engineerSeesIgnored = (): boolean => true;

/** Tasks per page (architecture section 6, "Pagination": default 50, at most 200). */
export const QUEUE_DEFAULT_LIMIT = 50;
export const QUEUE_MAX_LIMIT = 200;

export function isQueueTab(value: string): value is QueueTab {
  return QUEUE_TABS.some((tab) => tab === value);
}

/** What a row shows: the display status (`displayStatusOf`): the estimate's status, or `IGNORED` while the layer over it is set. A status added to the state machine reaches the queue. */
export type TaskEstimateStatus = DisplayStatus;

/** How many tasks each tab holds for the person asking (an Engineer's own, or every task for a Lead and an Admin). */
export interface QueueCounts {
  readonly open: number;
  readonly closed: number;
  readonly overdue: number;
  readonly ignored: number;
}
