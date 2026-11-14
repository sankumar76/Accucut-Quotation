import type { RoleName } from '@/lib/auth/roles';
import type { QueueTab } from '@/lib/tasks/queue';

/**
 * The words of SCR-03 "Task queue" and "My tasks" (UX spec section 6, SCR-03), written once. The empty-state sentences of the Open tab are the UX spec's, per role;
 * the Closed and Overdue tabs have none in the spec, so they are worded here to the same pattern (what is missing, and when something appears).
 */

export const QUEUE_META_DESCRIPTION = 'Estimation tasks at Accucut Lasers, by deadline: open, closed and overdue.';
export const ENGINEER_DESCRIPTION = 'Tasks assigned to you. Open one to start entering part data.';
export const LEAD_DESCRIPTION = 'All tasks assigned to Engineers.';

export const TABS_LABEL = 'Task queues';
export const SORT_NOTE = 'Sorted by deadline, earliest first. Overdue tasks stay in Open as well.';
export const TABLE_REGION_LABEL = 'Tasks, scrollable table';
export const TABLE_CAPTION = 'Tasks sorted by deadline, earliest first';
export const LIST_LABEL = 'Tasks';

/** The words in front of how late a task is (STORY-04.03 AC-1): "Overdue by 1 d 18 h". */
export const OVERDUE_BY = 'Overdue by';
/** Under the title when the page is cut to the tasks the person assigned (a Lead's bell, STORY-04.03 AC-3). */
export const ASSIGNED_BY_ME_NOTE = 'Showing only the tasks you assigned.';
export const SHOW_ALL_TASKS = 'Show all tasks';

export const ASSIGN_TASK_LABEL = 'Assign task';
export const NOT_CHOSEN_YET = 'Not chosen yet';
export const DEADLINE_COLUMN = 'Deadline (IST)';
/** The deadline's label on a phone's card, where the time already ends in "IST". */
export const CARD_DEADLINE_LABEL = 'Due';
export const COLUMNS = { task: 'Task', engineer: 'Engineer', customer: 'Customer', folder: 'Folder', status: 'Status', assignedBy: 'Assigned by', actions: 'Actions' } as const;
/** What a Lead and an Admin read in the action column of a closed task in place of the row actions (UX-20; STORY-04.05 AC-5). It is not a status badge. */
export const CLOSED_ROW_WORD = 'Closed';

export const LOADING_LABEL = 'Loading tasks';
export const ERROR_TITLE = 'We could not load the tasks';
export const ERROR_RETRY = 'Try again';
export const SHOW_MORE = 'Show more tasks';
export const SHOW_MORE_FAILED_TITLE = 'We could not load more tasks';
export const SHOW_MORE_FAILED_BODY = 'Check your connection and try again. The tasks above are unchanged.';

export interface EmptyText {
  readonly title: string;
  readonly description: string;
}

const EMPTY_TEXTS: Readonly<Record<QueueTab, Readonly<Record<'ENGINEER' | 'MANAGER', EmptyText>>>> = {
  open: {
    ENGINEER: { title: 'Nothing assigned to you right now', description: 'When a Lead assigns you a task it appears here, with its folder and deadline.' },
    MANAGER: { title: 'No open tasks', description: 'Assign a task to an Engineer and it appears here.' },
  },
  closed: {
    ENGINEER: { title: 'No closed tasks yet', description: 'A task closes when its estimate is approved, and then it appears here.' },
    MANAGER: { title: 'No closed tasks yet', description: 'A task closes when its estimate is approved, and then it appears here.' },
  },
  overdue: {
    ENGINEER: { title: 'Nothing is overdue', description: 'None of your open tasks is past its deadline.' },
    MANAGER: { title: 'No overdue tasks', description: 'No open task is past its deadline.' },
  },
};

/** The empty state of a tab for a role: an Engineer's words speak of "you", a Lead's and an Admin's of tasks and Engineers. */
export function emptyTextFor(role: RoleName, tab: QueueTab): EmptyText {
  return EMPTY_TEXTS[tab][role === 'ENGINEER' ? 'ENGINEER' : 'MANAGER'];
}

/** The description under the page title: an Engineer's own words, and the Lead's and Admin's. */
export function descriptionFor(role: RoleName): string {
  return role === 'ENGINEER' ? ENGINEER_DESCRIPTION : LEAD_DESCRIPTION;
}
