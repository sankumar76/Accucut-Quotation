/**
 * The words of SCR-11 "Process master" that more than one component says (UX spec section 6, "SCR-11 Process master"; the mock-up
 * `docs/03-ux/screens/SCR-11.html`). The messages under the fields are in `src/lib/masters/process-items.ts`, where the server's
 * schemas read them too.
 */

export const PROCESS_TITLE = 'Process master';
export const PROCESS_DESCRIPTION = 'Default rates. Every customer starts with these values and can have its own.';
export const ADD_RATE = 'Add rate';

export const SEARCH_LABEL = 'Search';
export const SEARCH_PLACEHOLDER = 'Rate name';

export const EMPTY_TITLE = 'No rates yet';
export const EMPTY_DESCRIPTION = 'Add the first rate. A formula can only use a rate that is on this list.';
export const NO_MATCH_DESCRIPTION = 'Check the spelling, or clear the search.';
export const CLEAR_FILTERS = 'Clear filters';

export const ERROR_TITLE = 'We could not load the rates';
export const ERROR_RETRY = 'Try again';
export const LOADING_LABEL = 'Loading the rates';

/** The "Used in" cell of a rate no formula uses (SCR-11: Plating-rate-per-sqin). */
export const NOT_USED = 'None yet';

export const FAILED_ADD_MESSAGE = 'We could not add the rate.';
export const FAILED_EDIT_MESSAGE = 'We could not save the changes.';
export const FAILED_DELETE_MESSAGE = 'We could not delete the rate.';
export const TRY_AGAIN_BODY = 'Check your connection and try again. Nothing was changed.';
export const FAILED_DIALOGS_TITLE = 'The form did not open.';
export const FAILED_CONFIRMATION_TITLE = 'The confirmation did not open.';
export const FAILED_DIALOGS_MESSAGE = 'Check your connection and try again.';

export const BLOCKED_TITLE = 'This rate is used by a formula';
export const BLOCKED_ADVICE = 'Change those formulas first.';
export const BLOCKED_LINK = 'Go to Fields and formulas';
export const BLOCKED_CLOSE = 'Close';

export const DELETE_KEEP = 'Keep rate';
export const DELETE_CONFIRM = 'Delete rate';

/** Where the formulas are changed (route manifest: Fields and formulas, SCR-17). */
export const FIELDS_AND_FORMULAS_PATH = '/config/fields';

/** The sentence under the page header after a change; the audit log keeps the detail (SCR-11 "Saved"). */
export const savedNotice = (name: string, what: 'added' | 'saved' | 'deleted'): string =>
  what === 'saved' ? `${name} saved. The change is in the audit log.` : `${name} was ${what}. The change is in the audit log.`;

export const deleteTitle = (name: string): string => `Delete ${name}?`;
export const deleteDescription = (name: string): string =>
  `${name} is removed from the Process master. Estimates that are already calculated keep their figures. You cannot undo this here.`;
export const blockedSentence = (name: string): string => `${name} cannot be deleted while a formula uses it`;
