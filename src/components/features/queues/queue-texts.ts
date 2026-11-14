import type { RoleName } from '@/lib/auth/roles';
import type { QueueTab, TaskEstimateStatus } from '@/lib/tasks/queue';

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

export const ASSIGN_TASK_LABEL = 'Assign task';
export const NOT_CHOSEN_YET = 'Not chosen yet';
export const DEADLINE_COLUMN = 'Deadline (IST)';
/** The deadline's label on a phone's card, where the time already ends in "IST". */
export const CARD_DEADLINE_LABEL = 'Due';
export const COLUMNS = { task: 'Task', engineer: 'Engineer', customer: 'Customer', folder: 'Folder', status: 'Status', assignedBy: 'Assigned by' } as const;

export const LOADING_LABEL = 'Loading tasks';
export const ERROR_TITLE = 'We could not load the tasks';
export const ERROR_RETRY = 'Try again';
export const SHOW_MORE = 'Show more tasks';
export const SHOW_MORE_FAILED_TITLE = 'We could not load more tasks';
export const SHOW_MORE_FAILED_BODY = 'Check your connection and try again. The tasks above are unchanged.';

/** The status of the estimate as a row says it, until story 04.04 words it for the Engineer. */
export const STATUS_LABELS: Readonly<Record<TaskEstimateStatus, string>> = { DRAFT: 'Draft', SUBMITTED: 'Submitted', APPROVED: 'Approved' };

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
