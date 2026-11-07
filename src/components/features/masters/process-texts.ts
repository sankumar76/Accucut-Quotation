/**
 * The words of SCR-11 "Process master" that more than one component says (UX spec section 6, "SCR-11 Process master"; the mock-up
 * `docs/03-ux/screens/SCR-11.html`; ux-spec v0.17 for the two notices of a rate deleted elsewhere). The messages under the fields
 * are in `src/lib/masters/process-items.ts`, where the server's schemas read them too.
 */

/**
 * The class that lets a long rate name wrap inside a dialog title, a description or a notice (ux-spec v0.17: "long names wrap"). It
 * is one string so that the rule is written once; Tailwind finds the class in this file.
 */
export const BREAK_LONG_NAMES = '[overflow-wrap:anywhere]';

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
export const BLOCKED_CLOSE = 'Close';

export const DELETE_KEEP = 'Keep rate';
export const DELETE_CONFIRM = 'Delete rate';

/** A notice under the page header (the slot of "Saved"): replaced by the next one, cleared by the next press of a button. */
export interface PageNotice {
  readonly tone: 'success' | 'warn' | 'info';
  /** The bold line, when there is one. */
  readonly title?: string;
  readonly text: string;
}

/** The sentence under the page header after a change; the audit log keeps the detail (SCR-11 "Saved"). */
export const savedNotice = (name: string, what: 'added' | 'saved' | 'deleted'): PageNotice => ({
  tone: 'success',
  text: what === 'saved' ? `${name} saved. The change is in the audit log.` : `${name} was ${what}. The change is in the audit log.`,
});

/**
 * A rate that was deleted elsewhere while its dialog was open (ux-spec v0.17, QLT-06): nothing failed and nothing is at risk, so
 * these are not alerts. `name` is the rate's name as it was when the dialog opened.
 */
export const goneNotice = (name: string, what: 'edit' | 'delete'): PageNotice =>
  what === 'edit'
    ? {
        tone: 'warn',
        title: `${name} no longer exists.`,
        text: 'It was deleted after you opened this list, so your changes were not saved. If you still need it, press Add rate.',
      }
    : { tone: 'info', title: `${name} was already deleted.`, text: 'It was deleted after you opened this list, so there was nothing to delete.' };

export const deleteTitle = (name: string): string => `Delete ${name}?`;
export const deleteDescription = (name: string): string =>
  `${name} is removed from the Process master. Estimates that are already calculated keep their figures. You cannot undo this here.`;

/**
 * The sentence of the refusal to delete a rate a formula uses, for Release 1 (ux-spec v0.17, ruled by the product-owner on AC-4):
 * the formulas cannot be changed until Release 2, so there is nothing to link to. The story that delivers SCR-17 adds the link.
 */
export const blockedSentence = (name: string): string =>
  `${name} cannot be deleted while a formula uses it. Formulas cannot be changed until Release 2, so this rate stays on the list.`;
