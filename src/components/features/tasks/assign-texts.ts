import type { AssignFieldName } from '@/lib/tasks/assign';

/**
 * The words of SCR-04 "Assign task" (UX spec section 6, SCR-04), written once. The messages under the fields are the rules' (`lib/tasks/assign.ts`), which the
 * server also speaks; everything else the screen says is here.
 */

export const ASSIGN_TITLE = 'Assign task';
export const ASSIGN_META_DESCRIPTION = 'Assign an estimation task to an Engineer with a folder path and a deadline.';
export const ASSIGN_DESCRIPTION = "Creates an empty estimate and puts the task in the Engineer's Open queue.";

export const BREADCRUMB_LABEL = 'Breadcrumb';
export const QUEUE_LINK_LABEL = 'Task queue';

export const FIELD_LABELS: Readonly<Record<AssignFieldName | 'deadlineTime', string>> = {
  engineerId: 'Engineer',
  folderPath: 'Network folder path',
  deadline: 'Deadline date',
  deadlineTime: 'Deadline time',
  title: 'Title',
  notes: 'Notes',
};

export const ENGINEER_PLACEHOLDER = 'Choose an Engineer';
export const NO_ENGINEERS_HINT = 'There is no active Engineer to assign to. Ask the Admin to add one.';
export const FOLDER_PATH_HINT = 'The folder with the drawings and requirements, for example \\\\server\\share\\RFQ-123.';
export const IST_ADDON = 'IST';
export const TIME_HINT = 'India Standard Time (UTC+5:30).';
export const TITLE_HINT = 'Up to 120 characters. Shown in the queue next to the task ID.';
export const NOTES_HINT = 'Up to 1,000 characters.';
export const OPTIONAL_TAG = '(optional)';

export const CANCEL_ASSIGN = 'Cancel';
export const SUBMIT_ASSIGN = 'Assign task';
export const SUBMITTING_ASSIGN = 'Assigning';
export const ASSIGN_ANOTHER = 'Assign another';

export const FAILED_ASSIGN_TITLE = 'We could not assign the task.';
export const FAILED_ASSIGN_BODY = 'Nothing was saved. What you typed is still here. Check your connection and try again.';

/** "3 things need fixing before this task can be assigned." (the summary of a refused form; the singular reads "1 thing needs fixing ..."). */
export function summaryTitle(count: number): string {
  return count === 1 ? '1 thing needs fixing before this task can be assigned.' : `${count} things need fixing before this task can be assigned.`;
}

/** "Task Q-2026-0324 assigned to Arjun Rao." (the success notice, STORY-04.01 AC-1). */
export function assignedTitle(code: string, engineerName: string): string {
  return `Task ${code} assigned to ${engineerName}.`;
}

export const FOLDER_LABEL = 'Folder';
export const ASSIGN_ANOTHER_HINT = 'Assign another task below.';

export const NEXT_TITLE = 'What happens next';
export const NEXT_STEPS: ReadonlyArray<string> = [
  'An empty estimate is created in Draft with a task ID like Q-2026-0324.',
  "It appears in the Engineer's Open queue, sorted by deadline.",
  'The Engineer chooses the customer and enters the part data.',
];
export const FOLDER_HELP_LABEL = 'How the folder link works';
export const FOLDER_HELP_BODY = 'Everyone sees the path as a link plus a Copy path button. Browsers often block links to network folders; the button always works.';
