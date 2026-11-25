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
/** The sort note of the Ignored tab (UX 12944 section 1): the clause about Overdue is dropped, an ignored task is never overdue. */
export const SORT_NOTE_IGNORED = 'Sorted by deadline, earliest first.';
export const TABLE_REGION_LABEL = 'Tasks, scrollable table';
export const TABLE_CAPTION = 'Tasks sorted by deadline, earliest first';
export const LIST_LABEL = 'Tasks';

/**
 * The Ignored tab's intro line, per role (CR-01 item 7D, AQP-401 AC-3; UX 12944 section 1): an Engineer reads their own set-aside tasks and cannot change them; a Lead or an Admin is told where they come from and where they are
 * restored (on the task's own page).
 */
export const IGNORED_INTRO_ENGINEER = 'Tasks that a Lead or Admin set aside. You can read them but not change them.';
export const IGNORED_INTRO_MANAGER = 'RFQs that were not taken forward. They are out of Open and Overdue. Open one to restore it.';

/** The link of an Ignored row for a Lead and an Admin: it opens the task, where Restore is. It restores nothing, so it does not say so (UX 12944). */
export const OPEN_TO_RESTORE = 'Open to restore';
/** The link of a row whose remarks were cut: it opens the task, where the whole text is. */
export const READ_ALL_REMARKS = 'Read all remarks';

/** The accessible names: the visible words first (WCAG 2.5.3), then the task, so the same link on every row is told apart. */
export const openToRestoreLabel = (code: string): string => `${OPEN_TO_RESTORE}, ${code}`;
export const readAllRemarksLabel = (code: string): string => `${READ_ALL_REMARKS}, ${code}`;

/** The words in front of how late a task is (STORY-04.03 AC-1): "Overdue by 1 d 18 h". */
export const OVERDUE_BY = 'Overdue by';
/** The filter row (STORY-04.06 AC-3, AC-6, AC-9): every control has a visible label, and "(IST)" says which clock the deadline days are read on. */
export const FILTERS_LABEL = 'Filter tasks';
export const SEARCH_LABEL = 'Search tasks';
export const SEARCH_PLACEHOLDER = 'Task ID or title';
export const ENGINEER_LABEL = 'Engineer';
export const ALL_ENGINEERS = 'All Engineers';
export const CUSTOMER_LABEL = 'Customer';
export const ALL_CUSTOMERS = 'All customers';
export const FROM_LABEL = 'Deadline from (IST)';
export const TO_LABEL = 'Deadline to (IST)';
export const CLEAR_FILTERS = 'Clear filters';

/** The chip of the Lead's default and of a bell address (STORY-04.06 AC-1, AC-2). The control that puts it back is named like the chip. */
export const ASSIGNED_BY_ME = 'Assigned by me';
export const REMOVE_ASSIGNED_BY_ME = 'Remove filter Assigned by me';

/** The No match state of a filtered list (STORY-04.06 AC-6): a Lead and an Admin may clear several filters, an Engineer only has the search. */
export const NO_MATCH_MANAGER: EmptyText = { title: 'No tasks match your filters.', description: 'Change a filter, or clear them all to see every task.' };
export const NO_MATCH_ENGINEER: EmptyText = { title: 'No tasks match your search.', description: 'Try a different task ID or part of the title.' };

/** Read out politely after a filter changes (STORY-04.06 AC-9): how many tasks the open tab holds under the filters. */
export function tasksFoundText(count: number): string {
  if (count === 0) return 'No tasks found';
  return count === 1 ? '1 task found' : `${count} tasks found`;
}

export const ASSIGN_TASK_LABEL = 'Assign task';
export const NOT_CHOSEN_YET = 'Not chosen yet';
export const DEADLINE_COLUMN = 'Deadline (IST)';
/** The deadline's label on a phone's card, where the time already ends in "IST". */
export const CARD_DEADLINE_LABEL = 'Due';
export const COLUMNS = { task: 'Task', engineer: 'Engineer', customer: 'Customer', folder: 'Folder', status: 'Status', assignedBy: 'Assigned by', actions: 'Actions' } as const;
/** What a Lead and an Admin read in the action column of a closed task in place of the row actions (UX-20; STORY-04.05 AC-5). It is not a status badge. */
export const CLOSED_ROW_WORD = 'Closed';
/** The action of an open row for a Lead and an Admin (STORY-04.07 AC-1, UX spec SCR-03 "Interactions"). It opens SCR-04 in edit mode. */
export const REASSIGN_ACTION = 'Reassign or change deadline';

/** The action's accessible name: its visible words first (WCAG 2.5.3), then the task, so the same action on every row is told apart by a screen reader. */
export function reassignActionLabel(code: string): string {
  return `${REASSIGN_ACTION}, ${code}`;
}

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
  ignored: {
    ENGINEER: { title: 'Nothing has been ignored', description: 'If a Lead or Admin sets one of your tasks aside, it appears here with their remarks.' },
    MANAGER: { title: 'No ignored tasks', description: 'An RFQ you ignore leaves Open and appears here. You can restore it from its page.' },
  },
};

/** The intro line of the Ignored tab for a role. */
export function ignoredIntroFor(role: RoleName): string {
  return role === 'ENGINEER' ? IGNORED_INTRO_ENGINEER : IGNORED_INTRO_MANAGER;
}

/** The empty state of a tab for a role: an Engineer's words speak of "you", a Lead's and an Admin's of tasks and Engineers. */
export function emptyTextFor(role: RoleName, tab: QueueTab): EmptyText {
  return EMPTY_TEXTS[tab][role === 'ENGINEER' ? 'ENGINEER' : 'MANAGER'];
}

/** The description under the page title: an Engineer's own words, and the Lead's and Admin's. */
export function descriptionFor(role: RoleName): string {
  return role === 'ENGINEER' ? ENGINEER_DESCRIPTION : LEAD_DESCRIPTION;
}
