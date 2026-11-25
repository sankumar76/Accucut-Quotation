/**
 * The ids of the places of Ignore and Restore (CR-01 item 7D, AQP-401), in a file of their own so the small client scripts of the buttons, the dialogs (fetched on the first press) and the server components that draw the
 * notices share them without importing each other (a server file cannot read a value out of a client file). Pure constants, no import.
 */

/** The Lead's and the Admin's notice of an ignored estimate on SCR-06: it holds focus when it is the place a person is going to (`tabIndex` -1). */
export const IGNORED_NOTICE_ID = 'review-ignored-notice';

/** The Remarks field of the Ignore dialog. */
export const IGNORE_REMARKS_FIELD_ID = 'ignore-remarks';

/** The danger alert of a refused Ignore in the dialog: it holds focus when it appears (`tabIndex` -1), so the sentence is read and focus is not left on a control that is now off. */
export const IGNORE_ALERT_ID = 'ignore-alert';

/** The same for a refused Restore. */
export const RESTORE_ALERT_ID = 'restore-alert';

/**
 * The action bar of SCR-06, where focus goes when a button leaves the page because the estimate changed elsewhere (a refusal): a stable place, so focus is not lost to the body (WCAG 2.4.3). The same id as the review's
 * (`REVIEW_ACTIONS_ID` of the Mark as quoted ids), written here so this folder imports no other folder's ids; a unit test holds the two equal.
 */
export const ACTIONS_BAR_ID = 'review-actions';

/** The danger alert of SCR-05 when a save, an auto-save or a Calculate is refused because the estimate was ignored meanwhile: it takes focus when it appears. */
export const ENGINEER_IGNORED_ALERT_ID = 'estimate-ignored-alert';
