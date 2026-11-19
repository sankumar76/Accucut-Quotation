/**
 * The ids of Cancel approval's places on SCR-06 and in its dialog (STORY-06.12), in a file of their own so the small client script of the Cancel approval button, the dialog (fetched on the first press) and the server
 * component that draws the notice share them without importing each other (a server file cannot read a value out of a client file). Pure constants, no import.
 */

/** The notice of a cancelled approval ("Approval cancelled on ... by ..."): it holds focus when a cancel has just worked (`tabIndex` -1), so focus is not lost with the button that was pressed. */
export const CANCELLED_NOTICE_ID = 'review-cancelled-notice';

/** The two fields of the dialog, and the danger alert that holds focus when it appears (a deleted customer or material, a blocked step-up). */
export const CANCEL_REASON_FIELD_ID = 'cancel-reason';
export const CANCEL_PASSWORD_FIELD_ID = 'cancel-password';
export const CANCEL_ALERT_ID = 'cancel-alert';
