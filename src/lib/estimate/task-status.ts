import { assertNever } from '../assert-never';

import type { EstimateStatus } from './state-machine';

/**
 * How a task's status is worded (STORY-04.04; FR-102, NFR-002; architecture section 4.4). Pure code, derived from `estimates.status` and from nothing else: the
 * status of a task is never stored, so it cannot disagree with its estimate. Every screen that shows a task's status (the queue, the task header, any page that opens
 * a task) and every role takes its words from here, so the Engineer, the Lead and the Admin read the same ones (AC-5).
 *
 *   DRAFT      -> "Draft"      (the task is open)
 *   SUBMITTED  -> "Submitted"  (the task is open)
 *   APPROVED   -> "Approved"   (the task is **closed**: Closed is the approved estimate, FR-038)
 *
 * One badge for each status, as the G3 screens draw it: the queue says "Approved" with a lock, the task header says "Approved and locked" (`APPROVED_LOCKED_LABEL`). "Closed"
 * is the name of the tab and, for a Lead and an Admin, the word of the action column (STORY-04.05); it is not a second badge. An estimate that was unlocked is DRAFT again, so
 * its task is open again with the word "Draft"; what an unlock leaves behind is Restricted and is not read here.
 * The result is a word and a flag. There is no approver, no price and no reason in it, so no screen can show one by reading it (NFR-002); the file holds no Restricted
 * type, so an Engineer's page may import it.
 */

export type TaskStatusLabel = 'Draft' | 'Submitted' | 'Approved';

export interface TaskStatusView {
  readonly label: TaskStatusLabel;
  /** True for an approved estimate: the task is in the Closed tab. Derived from `isTaskClosed`, the one rule. */
  readonly closed: boolean;
}

/** What the task header says of an approved estimate: it also tells the Engineer why the inputs are read-only (ux-spec SCR-05, state Approved). */
export const APPROVED_LOCKED_LABEL = 'Approved and locked';

/**
 * The one rule for "this task is closed": its estimate is approved (architecture section 4.4, FR-038). Every `closed` value is derived from it, and STORY-04.05 reuses it
 * for the list, the counts, the bell and the detail, so there is no second rule to drift from it.
 */
export const isTaskClosed = (status: EstimateStatus): boolean => status === 'APPROVED';

/** An exhaustive `switch`: a new status does not type-check until its word is decided, and bad data at run time throws and does not get a guessed word. */
export function taskStatusOf(status: EstimateStatus): TaskStatusView {
  const closed = isTaskClosed(status);
  switch (status) {
    case 'DRAFT':
      return { label: 'Draft', closed };
    case 'SUBMITTED':
      return { label: 'Submitted', closed };
    case 'APPROVED':
      return { label: 'Approved', closed };
    default:
      return assertNever(status, 'task status');
  }
}
