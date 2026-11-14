import type { EstimateStatus } from '../estimate/state-machine';
import { isTaskClosed } from '../estimate/task-status';

import { isOverdue } from './overdue';
import type { QueueTab } from './queue';

/**
 * Which tab a task is in (STORY-04.05; FR-038, architecture section 4.4: "Task Open or Closed is derived from estimates.status, never stored"). Pure, and derived from the
 * status of the task's estimate and its deadline, so a task closes the moment its estimate is approved and opens again the moment an unlock or the Admin's cancel makes
 * it DRAFT, with nothing to update (AC-2, AC-3).
 *
 * There is exactly one rule for "closed": `isTaskClosed` in `lib/estimate/task-status.ts` (AC-4). This file builds on it and never repeats the status test. The SQL form
 * of the same rule is `tabFilter` in `task-repository.ts` (it filters on `estimates.status`, which TypeScript cannot do for it); an integration test holds the two together.
 */

/** The tab a task is in by its status alone: Closed for an approved estimate, Open for any other. Overdue is a part of Open, see `tabsOf`. */
export function taskTab(status: EstimateStatus): Extract<QueueTab, 'open' | 'closed'> {
  return isTaskClosed(status) ? 'closed' : 'open';
}

/**
 * Every tab that lists the task at `now`: its own (`taskTab`), and Overdue as well when the task is open and its deadline is strictly before `now` (an overdue task
 * stays in Open). A closed task is never overdue, however late its deadline was (AC-2).
 */
export function tabsOf(status: EstimateStatus, deadlineAt: Date, now: Date): ReadonlyArray<QueueTab> {
  const tab = taskTab(status);
  return tab === 'open' && isOverdue(deadlineAt, now) ? [tab, 'overdue'] : [tab];
}
