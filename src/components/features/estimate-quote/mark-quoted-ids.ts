/**
 * The ids of Mark as quoted's places on SCR-06 (CR-01 item 7C, AQP-400), in a file of their own so the small client script of the button, the dialog (fetched on the first press) and the server component that draws
 * the Quoted notice share them without importing each other (a server file cannot read a value out of a client file). Pure constants, no import.
 */

/** The notice of a quoted estimate ("Quoted on ... by ..."): it holds focus when a mark has just worked (`tabIndex` -1), so focus is not lost with the button that was pressed. */
export const QUOTED_NOTICE_ID = 'review-quoted-notice';
