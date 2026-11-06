import type { UserSummary } from '../repositories/user-repository';

/**
 * The choices of the Who filter on the audit screen (STORY-01.07 AC-6; architect, comment 11091): every user, deactivated ones
 * included, by their current name and sorted by it. A choice sends the person's ID, never the name, so entries written under an
 * older name are found too. Only `id` and `name` are built here, so nothing else about a person (the e-mail address, the role,
 * the active flag) can reach the screen through this list; the page reads it on the server after its Admin check.
 */

export interface AuditPersonChoice {
  readonly id: string;
  readonly name: string;
}

export function auditPeople(users: ReadonlyArray<UserSummary>): ReadonlyArray<AuditPersonChoice> {
  return users
    .map(({ id, name }): AuditPersonChoice => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
