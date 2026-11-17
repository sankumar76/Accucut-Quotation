/**
 * The ids of the unlock's places on SCR-06 and in SCR-09 (STORY-06.08), in a file of their own so the small client script of the Unlock button, the dialog (fetched on the first press) and the server component that
 * draws the notice share them without importing each other (a server file cannot read a value out of a client file). Pure constants, no import.
 */

/** The notice of an unlocked Draft ("Unlocked on ... by ..."): it holds focus when an unlock has just worked (`tabIndex` -1), so focus is not lost with the button that was pressed. */
export const UNLOCKED_NOTICE_ID = 'review-unlocked-notice';

/** The reason field of the dialog, and the alert that stops the unlock (a deleted customer or material), which holds focus when it appears. */
export const UNLOCK_REASON_FIELD_ID = 'unlock-reason';
export const UNLOCK_BLOCKED_ALERT_ID = 'unlock-blocked-alert';
