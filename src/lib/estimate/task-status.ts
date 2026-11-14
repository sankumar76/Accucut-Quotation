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
 * An estimate that was unlocked is DRAFT again, so its task is open again with the word "Draft"; what an unlock leaves behind is Restricted and is not read here.
 * The result is a word and a flag. There is no approver, no price and no reason in it, so no screen can show one by reading it (NFR-002); the file holds no Restricted
 * type, so an Engineer's page may import it.
 */

export type TaskStatusLabel = 'Draft' | 'Submitted' | 'Approved';

export interface TaskStatusView {
  readonly label: TaskStatusLabel;
  /** True for an approved estimate: the task is in the Closed tab and wears the word `CLOSED_LABEL` beside its status. */
  readonly closed: boolean;
}

/** The word of a closed task. It is shown beside "Approved", never instead of it, and it is the same word as the Closed tab. */
export const CLOSED_LABEL = 'Closed';

/** Every word a status can show, in the order of the life of a task. */
export const TASK_STATUS_WORDS: ReadonlyArray<TaskStatusLabel | typeof CLOSED_LABEL> = ['Draft', 'Submitted', 'Approved', CLOSED_LABEL];

/** An exhaustive `switch`: a new status does not type-check until its word is decided, and bad data at run time throws and does not get a guessed word. */
export function taskStatusOf(status: EstimateStatus): TaskStatusView {
  switch (status) {
    case 'DRAFT':
      return { label: 'Draft', closed: false };
    case 'SUBMITTED':
      return { label: 'Submitted', closed: false };
    case 'APPROVED':
      return { label: 'Approved', closed: true };
    default:
      return assertNever(status, 'task status');
  }
}
