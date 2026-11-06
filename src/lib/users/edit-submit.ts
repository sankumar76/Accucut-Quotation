import type { Outcome, UserChanges, UserRow } from './users-client';
import type { UserRoleValue } from './validation';

/**
 * What "Save" does in the Edit user dialog of SCR-14 (UX spec v0.14): the fields that really changed are sent, and when
 * nothing changed **no request is made at all** and the dialog just closes, with no "was saved" message. It is written apart
 * from the dialog so a test can hand it a spy for the save request and prove that rule (QLT-78); the dialog only shows the
 * outcome. Pure: the request is passed in.
 */

export interface EditValues {
  /** The name as typed; surrounding spaces are not part of it. */
  readonly name: string;
  readonly role: UserRoleValue;
}

export type Save = (id: string, changes: UserChanges) => Promise<Outcome<UserRow>>;

/** Only what differs from the person as opened. An empty object means there is nothing to save. */
export function editChanges(user: UserRow, values: EditValues): UserChanges {
  const name = values.name.trim();
  return { ...(name === user.name ? {} : { name }), ...(values.role === user.role ? {} : { role: values.role }) };
}

export type EditResult = { readonly kind: 'unchanged' } | { readonly kind: 'sent'; readonly outcome: Outcome<UserRow> };

/** Sends the changes and returns the server's answer; with no change it returns `unchanged` and never calls `save`. */
export async function submitEdit(user: UserRow, values: EditValues, save: Save): Promise<EditResult> {
  const changes = editChanges(user, values);
  if (Object.keys(changes).length === 0) return { kind: 'unchanged' };
  return { kind: 'sent', outcome: await save(user.id, changes) };
}
