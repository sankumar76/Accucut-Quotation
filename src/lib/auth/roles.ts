/**
 * The three roles as the person sees them (architecture section 6; FR-002). The role itself is stored and
 * checked on the server; this file only holds words, so a page and a menu say the same thing.
 */

import { assertNever } from '../assert-never';

export type RoleName = 'ADMIN' | 'LEAD' | 'ENGINEER';

const ROLE_LABELS: Readonly<Record<RoleName, string>> = {
  ADMIN: 'Admin',
  LEAD: 'Lead',
  ENGINEER: 'Engineer',
};

export function roleLabel(role: RoleName): string {
  return ROLE_LABELS[role];
}

/** The title of the page every role lands on: "My tasks" for an Engineer, "Task queue" for Lead and Admin (AC-1, SCR-03). */
export function queueTitleFor(role: RoleName): string {
  return role === 'ENGINEER' ? 'My tasks' : 'Task queue';
}

/**
 * The label of the one button on the "no access" and "not found" pages (UX spec v0.12, SCR-26). It is named as the menu names
 * the person's own landing page: an Engineer goes to "My tasks", a Lead or an Admin to the "Task queue" (SCR-03). It depends on
 * the viewer's role only, never on whether the address exists (UX-22). Where the role cannot be read, the role-neutral
 * "Go to the task list" is the accepted interim wording; "Go to your tasks" is not used.
 */
export function homeActionLabel(role: RoleName | null): string {
  switch (role) {
    case 'ENGINEER':
      return 'Go to my tasks';
    case 'LEAD':
    case 'ADMIN':
      return 'Go to the task queue';
    case null:
      return 'Go to the task list';
    default:
      return assertNever(role, 'role');
  }
}
