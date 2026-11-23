import { TASK_CLOSED_MESSAGE } from '@/lib/tasks/reassign';
import { formatIst } from '@/lib/time';

/**
 * The words of the edit mode of SCR-04, "Reassign or change deadline" (STORY-04.07; UX spec SCR-04 "States": "Edit mode (R2): only Engineer and deadline are editable, folder, title
 * and notes show 'Locked', notice 'Changes are logged. The log records your name, the time, and the old and new values.'"). Written once. The messages under the fields are the rules'
 * (`lib/tasks/assign.ts`), which the server also speaks. **The words that the spec does not give are proposed here, for the ux-expert to rule on at the end review** (story AC-2): the
 * page title and description, the button, the success line, the "Locked" label, the summary, the failed line and the "nothing changed" line.
 */

export const REASSIGN_TITLE = 'Reassign or change deadline';
export const REASSIGN_META_TITLE = 'Assign task';
export const REASSIGN_DESCRIPTION = 'Give this open task to another Engineer, move its deadline, or both. The folder, title and notes cannot be changed here.';

/** The notice of the spec (SCR-04 "Edit mode"): what the log keeps. */
export const LOG_NOTICE = 'Changes are logged. The log records your name, the time, and the old and new values.';

export const LOCKED_TAG = 'Locked';
export const SUBMIT_REASSIGN = 'Save changes';
export const SUBMITTING_REASSIGN = 'Saving';
export const CANCEL_REASSIGN = 'Cancel';
/** Marks the task's own Engineer in the list when they are no longer active (the list is the active Engineers). */
export const NOT_ACTIVE_SUFFIX = ' (not active)';

export const FOLDER_LOCKED_LABEL = 'Network folder path';
export const TITLE_LOCKED_LABEL = 'Title';
export const NOTES_LOCKED_LABEL = 'Notes';
export const NONE_WRITTEN = 'None written';

export const NOTHING_CHANGED_TITLE = 'You have not changed anything.';
export const NOTHING_CHANGED_BODY = 'Choose another Engineer or a new deadline, then save.';

export const FAILED_REASSIGN_TITLE = 'We could not save the change.';
export const FAILED_REASSIGN_BODY = 'What you chose is still here. Check your connection and try again. If you are not sure it was saved, open the task queue to see the task as it is now.';

/** The 409 of an approved task: the spec's gap, filled by the server's own sentence so the two cannot differ. */
export const CLOSED_TITLE = TASK_CLOSED_MESSAGE;
export const CLOSED_BODY = 'It is in the Closed tab of the task queue. If it is unlocked, it can be changed again.';

/** An ignored task (CR-01 item 7D, FR-040, DL-304): read-only until it is restored, so its Engineer and deadline cannot be changed. The sentence is the state machine's own words, then where Restore is. */
export const IGNORED_TITLE = 'This task is ignored, so its Engineer and deadline cannot be changed.';
export const IGNORED_BODY = 'It is in the Ignored tab of the task queue. Open it and restore it first.';

export const BACK_TO_QUEUE = 'Back to the task queue';

/** "2 things need fixing before this change can be saved." (the summary of a refused form; the singular reads "1 thing needs fixing ..."). */
export function reassignSummaryTitle(count: number): string {
  return count === 1 ? '1 thing needs fixing before this change can be saved.' : `${count} things need fixing before this change can be saved.`;
}

/** "Task Q-2026-0324 is now with Meera Nair, due 04 Nov 2026, 12:00 IST." (the success notice, a polite status). */
export function reassignedTitle(code: string, engineerName: string, deadlineAt: Date): string {
  return `Task ${code} is now with ${engineerName}, due ${formatIst(deadlineAt)}.`;
}
