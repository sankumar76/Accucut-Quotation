import { shiftWords } from './field-insert-words';

/**
 * The words of the delete (STORY-08.04; UX spec SCR-20): every sentence the server's check and save say, written once, as pure strings built from names the caller passes in, so a column letter or a field
 * name is never typed here (coding standards section 10). The words of the blocked state are in `lib/fields/uses.ts`. The success and refusal words below are proposed (the story marks them) and are the
 * ux-expert's to rule on at the end review.
 */

/** 409 `SYSTEM_FIELD`: a system field, or one the code finds by key (AC-5). The same sentence as the lock tag's hint. */
export const PROTECTED_FIELD_MESSAGE = 'This is a System field. The portal depends on it, so it cannot be deleted.';

/** 409 for a result the registry's own last gate would not accept. It names no value. */
export const DELETE_REFUSED_MESSAGE = 'The field registry would not be valid without this field, so it was not deleted.';

/** 409 `CONFIG_VERSION_CHANGED` for a delete: another save came first (AC-3). */
export function deleteVersionChangedMessage(currentVersion: number): string {
  return `The fields and formulas were changed while you were deleting. They are now at configuration version ${String(currentVersion)}. The field was not deleted; open the dialog again to see what changed.`;
}

/** `Field deleted. Configuration version 11.` (AC-3, proposed words). */
export function deletedMessage(versionNumber: number): string {
  return `Field deleted. Configuration version ${String(versionNumber)}.`;
}

/** One run of columns that moved by the same number of places, as the audit entry words it: `Columns AZ to BP moved one to the left` (a single column: `Column BP moved one to the left`). */
export function movedLeftWords(from: string, to: string, by: number): string {
  const places = `${shiftWords(by)} to the left`;
  return from === to ? `Column ${from} moved ${places}` : `Columns ${from} to ${to} moved ${places}`;
}
