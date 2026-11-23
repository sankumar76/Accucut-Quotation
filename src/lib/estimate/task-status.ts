import { assertNever } from '../assert-never';

import { isLocked, type EstimateStatus } from './state-machine';

/**
 * How a task's status is worded (STORY-04.04; FR-102, NFR-002; architecture sections 4.4 and 4.12 a). Pure code, derived from `estimates.status` and `estimates.ignored_at` and
 * from nothing else: the status of a task is never stored, so it cannot disagree with its estimate. Every screen that shows a task's status (the queue, the task header, any page that
 * opens a task) and every role takes its words from here, so the Engineer, the Lead and the Admin read the same ones (AC-5).
 *
 *   DRAFT      -> "Draft"      (the task is open)
 *   PREPARED   -> "Prepared"   (the task is open)
 *   APPROVED   -> "Approved"   (the task is **closed**: Closed is an approved or a quoted estimate, FR-038)
 *   QUOTED     -> "Quoted"     (the task is closed)
 *   ignored    -> "Ignored"    (`displayStatusOf`: the layer over the status; the task is in the Ignored tab alone, neither open nor closed)
 *
 * One badge for each status, as the G3 screens draw it: the queue says "Approved" with a lock, the task header says "Approved and locked" (`APPROVED_LOCKED_LABEL`). "Closed"
 * is the name of the tab and, for a Lead and an Admin, the word of the action column (STORY-04.05); it is not a second badge. An estimate that was unlocked is DRAFT again, so
 * its task is open again with the word "Draft"; what an unlock leaves behind is Restricted and is not read here.
 * The result is a word and a flag. There is no approver, no price and no reason in it, so no screen can show one by reading it (NFR-002); the file holds no Restricted
 * type, so an Engineer's page may import it.
 */

/** What a screen shows for an estimate: its status, or `IGNORED` when the layer over it is set (`displayStatusOf`). */
export type DisplayStatus = EstimateStatus | 'IGNORED';

export type TaskStatusLabel = 'Draft' | 'Prepared' | 'Approved' | 'Quoted' | 'Ignored';

export interface TaskStatusView {
  readonly label: TaskStatusLabel;
  /** True for an approved or a quoted estimate that is not ignored: the task is in the Closed tab. Derived from `isTaskClosed`, the one rule. */
  readonly closed: boolean;
}

/** What the task header says of an approved estimate: it also tells the Engineer why the inputs are read-only (ux-spec SCR-05, state Approved). */
export const APPROVED_LOCKED_LABEL = 'Approved and locked';

/**
 * What a screen shows for an estimate (architecture section 4.12 a): `IGNORED` when `ignoredAt` is set, else the status. **Nothing else decides what a status looks like**: the queue,
 * the badges, the bell and every view read it. `ignoredAt` is the column's value, as a `Date` on the server or as the ISO text a view carries.
 */
export function displayStatusOf(row: { readonly status: EstimateStatus; readonly ignoredAt: Date | string | null }): DisplayStatus {
  return row.ignoredAt === null ? row.status : 'IGNORED';
}

/**
 * The one rule for "this task is closed": its estimate is locked (approved or quoted) and not ignored (architecture section 4.12 a, FR-038). Every `closed` value is derived from it, and
 * STORY-04.05 reuses it for the list, the counts, the bell and the detail, so there is no second rule to drift from it. `ignored` is true when the layer over the status is set.
 */
export const isTaskClosed = (status: EstimateStatus, ignored: boolean): boolean => !ignored && isLocked(status);

/** The one rule for "this task is open": its estimate is a Draft or a Prepared one and not ignored. Overdue is open and past its deadline (`tabsOf`). */
export const isTaskOpen = (status: EstimateStatus, ignored: boolean): boolean => !ignored && !isLocked(status);

/** An exhaustive `switch`: a new status does not type-check until its word is decided, and bad data at run time throws and does not get a guessed word. */
export function taskStatusOf(status: DisplayStatus): TaskStatusView {
  switch (status) {
    case 'DRAFT':
      return { label: 'Draft', closed: isTaskClosed(status, false) };
    case 'PREPARED':
      return { label: 'Prepared', closed: isTaskClosed(status, false) };
    case 'APPROVED':
      return { label: 'Approved', closed: isTaskClosed(status, false) };
    case 'QUOTED':
      return { label: 'Quoted', closed: isTaskClosed(status, false) };
    case 'IGNORED':
      return { label: 'Ignored', closed: false };
    default:
      return assertNever(status, 'task status');
  }
}
