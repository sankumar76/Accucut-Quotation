/**
 * The task queue's vocabulary (STORY-04.02; FR-034, architecture sections 4.4 and 6): the three tabs, the page size and the query string the screen sends.
 * Pure and small, so the browser carries it and the server reads the same names (no zod here: the page does not carry it).
 *
 * Open is "not closed": an estimate that is not APPROVED. Closed is an APPROVED estimate. Overdue is open **and** past its deadline, so an overdue task is in
 * Open as well (the sort note says so). All three are derived from `estimates.status` and the deadline, never stored (architecture section 4.4).
 */

export const QUEUE_TABS = ['open', 'closed', 'overdue'] as const;

export type QueueTab = (typeof QUEUE_TABS)[number];

export const DEFAULT_QUEUE_TAB: QueueTab = 'open';

/** The tab names as the person reads them. */
export const QUEUE_TAB_LABELS: Readonly<Record<QueueTab, string>> = { open: 'Open', closed: 'Closed', overdue: 'Overdue' };

/** Tasks per page (architecture section 6, "Pagination": default 50, at most 200). */
export const QUEUE_DEFAULT_LIMIT = 50;
export const QUEUE_MAX_LIMIT = 200;

export function isQueueTab(value: string): value is QueueTab {
  return QUEUE_TABS.some((tab) => tab === value);
}

/** The status of an estimate, which is what a row shows until story 04.04 words it for the Engineer. */
export type TaskEstimateStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';

/** How many tasks each tab holds for the person asking (an Engineer's own, or every task for a Lead and an Admin). */
export interface QueueCounts {
  readonly open: number;
  readonly closed: number;
  readonly overdue: number;
}

/** `tab=overdue&cursor=...`: the query string of one page of a tab; the cursor is the one the server sent, passed back unchanged. */
export function queueQueryString(tab: QueueTab, cursor?: string): string {
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (cursor !== undefined) params.set('cursor', cursor);
  return params.toString();
}
