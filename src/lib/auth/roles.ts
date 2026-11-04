/**
 * The three roles as the person sees them (architecture section 6; FR-002). The role itself is stored and
 * checked on the server; this file only holds words, so a page and a menu say the same thing.
 */

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
