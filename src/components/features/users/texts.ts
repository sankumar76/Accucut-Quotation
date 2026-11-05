/**
 * The words of SCR-14 that more than one component says (UX spec section 6, "SCR-14 Users"). The sentences of the password
 * rule (10 to 128 characters, a number and a symbol; FR-098) are left out of the two hints until story 01.05 applies the
 * rule: a hint must not promise a check that is not made.
 */

export const PASSWORD_HINT =
  'Tell the person in person or by phone; the portal does not e-mail it until Release 2. The person must change it at their first sign-in.';

export const RESET_PASSWORD_HINT = 'The old password stops working straight away. The person must change it at their next sign-in.';

export const FAILED_ADD_MESSAGE = 'We could not add the user.';
export const FAILED_EDIT_MESSAGE = 'We could not save the changes.';
export const FAILED_RESET_MESSAGE = 'We could not set the password.';
export const FAILED_DEACTIVATE_MESSAGE = 'We could not deactivate the user.';
export const FAILED_ACTIVATE_MESSAGE = 'We could not activate the user.';
export const FAILED_REFRESH_TITLE = 'We could not refresh the list.';
export const FAILED_REFRESH_MESSAGE = 'The change was saved. Reload the page to see it.';
export const FAILED_DIALOGS_TITLE = 'The form did not open.';
export const FAILED_DIALOGS_MESSAGE = 'Check your connection and press the button again.';
export const TRY_AGAIN_BODY = 'Check your connection and try again. Nothing was changed.';
