/**
 * The ids of Remove price's places on SCR-06 and in its dialog (STORY-06.13), in a file of their own so the small client script of the Remove price button, the dialog (fetched on the first press) and the server
 * component that draws the notice share them without importing each other (a server file cannot read a value out of a client file). Pure constants, no import.
 */

/** The notice of a removed price ("The approved price was removed on ... by ..."): it holds focus when a removal has just worked (`tabIndex` -1), so focus is not lost with the button that was pressed. */
export const PRICE_REMOVED_NOTICE_ID = 'review-price-removed-notice';

/** The password field of the dialog, and the danger alert that holds focus when it appears (a blocked step-up). */
export const REMOVE_PASSWORD_FIELD_ID = 'remove-price-password';
export const REMOVE_ALERT_ID = 'remove-price-alert';
