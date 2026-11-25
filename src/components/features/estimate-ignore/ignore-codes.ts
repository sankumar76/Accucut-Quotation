/**
 * The codes of the 409s of Ignore and Restore (CR-01 item 7D, AQP-401), spelled here and not read from `TRANSITION_REFUSALS`: a client that reads that table keeps all ten sentences of the state machine in the chunk the
 * first load of `/queue` and `/estimates/[code]` share (it cost `/queue` 215 bytes gzip when Mark as quoted did it, NFR-009, AQP-400). A unit test holds each equal to the machine's code
 * (`tests/unit/ignored-notices.test.ts`). Pure constants, no import.
 */

/** A second Ignore: the estimate is ignored, which is what was asked for, so the dialog treats it as done and the page is drawn again. */
export const ALREADY_IGNORED_CODE = 'ESTIMATE_ALREADY_IGNORED';

/** A second Restore: the estimate is not ignored, which is what was asked for. */
export const NOT_IGNORED_CODE = 'ESTIMATE_NOT_IGNORED';

/** Any other route's refusal of an ignored estimate: on SCR-05 a save, an auto-save or a Calculate that finds it says so (UX 12944 section 4). */
export const ESTIMATE_IGNORED_CODE = 'ESTIMATE_IGNORED';
