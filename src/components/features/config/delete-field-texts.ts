/**
 * The words of SCR-20 "Delete field" (STORY-08.04; UX spec SCR-20 and its mock-up), in one place. The blocked sentence and the lines of each use are built in `lib/fields/uses.ts` (the server's 409 uses the same), and the
 * sentences of a wrong password, a block and a version that moved on are the server's; what is here is the dialog's own: its title, its labels, its states. A letter or a field name is never typed here: it is passed in from
 * the registry. The words marked proposed in the story are the ux-expert's to rule on at the end review.
 */

/** The title of the dialog and the heading of its confirm state: `Delete AX Soft Anodize Cost?` */
export const deleteTitle = (letter: string, label: string): string => `Delete ${letter} ${label}?`;

export const CHECKING_LINE = 'Checking what uses this field';
export const CHECK_FAILED_LINE = 'We could not check what uses this field. Check your connection and try again.';
export const CHECK_RETRY = 'Try again';

/** The confirm state (AC-3): the story's sentence and the one the mock-up adds about approved estimates. */
export const CONFIRM_LINE = 'No formula uses this field. Deleting it moves every later field one letter to the left. Approved estimates keep the layout and values they were approved with.';

export const PASSWORD_LABEL = 'Your password';
export const PASSWORD_HINT = 'The password you sign in with. Deleting a field is checked with it each time.';

export const KEEP_LABEL = 'Keep the field';
export const CLOSE_LABEL = 'Close';
export const DELETE_LABEL = 'Delete field';
export const DELETING_LABEL = 'Deleting';

/** The list of uses (AC-2): the heading of the list, the Edit link of a formula and the line under a use that cannot be changed yet are in `uses.ts` (`CANNOT_CHANGE_YET`). */
export const USES_LIST_LABEL = 'What uses this field';
export const EDIT_LABEL = 'Edit';

/** No usable answer came after the password was sent: the delete may have gone through. */
export const DELETE_UNCONFIRMED = 'The portal did not answer, so it is not known whether the field was deleted. Check Fields and formulas before you try again.';

/** The title of the notice above the list after a delete. */
export const DELETED_NOTICE_TITLE = 'Deleted';

/** The Delete button of a row of SCR-17: the field's letter and label follow it for a screen reader ("Delete AL Cutting Cost"). */
export const DELETE_ROW_LABEL = 'Delete';

/** What the Delete button says when the dialog's code did not come (the first-open failure line). */
export const DIALOG_FAILED_LINE = 'The delete window did not open. Check your connection and try again.';
