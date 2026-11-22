import type { EstimateStatus } from '../estimate/state-machine';
import { isTaskClosed } from '../estimate/task-status';

import { isOverdue } from './overdue';
import type { QueueTab } from './queue';

/**
 * Which tab a task is in (STORY-04.05; FR-038, architecture sections 4.4 and 4.12 a: "Task Open or Closed is derived from estimates.status, never stored"). Pure, and derived from the
 * status of the task's estimate, whether the Ignored layer is set over it, and its deadline, so a task closes the moment its estimate is approved and opens again the moment an unlock or the
 * Admin's cancel makes it DRAFT, with nothing to update (AC-2, AC-3). An ignored task is in none of the three tabs here: its own tab (Ignored) arrives with story 7D.
 *
 * There is exactly one rule for "closed": `isTaskClosed` in `lib/estimate/task-status.ts` (AC-4). This file builds on it and never repeats the status test. The SQL form
 * of the same rule is `tabFilter` in `task-repository.ts` (it filters on `estimates.status`, which TypeScript cannot do for it); an integration test holds the two together.
 */

/** The tab a task is in by its status alone: Closed for an approved or a quoted estimate, Open for any other. Overdue is a part of Open, see `tabsOf`. The Ignored layer is `tabsOf`'s. */
export function taskTab(status: EstimateStatus): Extract<QueueTab, 'open' | 'closed'> {
  // By the status alone: the layer is `tabsOf`'s (it is passed there, and is required), so this is the tab of a task that is not ignored.
  return isTaskClosed(status, false) ? 'closed' : 'open';
}

/**
 * Every tab that lists the task at `now`: its own (`taskTab`), and Overdue as well when the task is open and its deadline is strictly before `now` (an overdue task
 * stays in Open). A closed task is never overdue, however late its deadline was (AC-2). An ignored task (`ignored`: the layer over the status is set) is in none of them, and so never
 * overdue: the bell counts Overdue only, so an ignored task never rings (architecture section 4.12 a).
 */
export function tabsOf(status: EstimateStatus, deadlineAt: Date, now: Date, ignored: boolean): ReadonlyArray<QueueTab> {
  if (ignored) return [];
  const tab = taskTab(status);
  return tab === 'open' && isOverdue(deadlineAt, now) ? [tab, 'overdue'] : [tab];
}
