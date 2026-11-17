/**
 * The id of the notice an approved estimate shows (STORY-06.06 AC-5), in a file of its own so the small client script of the Approve button and the server component that draws the notice share it without
 * importing each other (a server file cannot read a value out of a client file). Pure constants, no import.
 */
export const APPROVED_NOTICE_ID = 'review-approved-notice';
