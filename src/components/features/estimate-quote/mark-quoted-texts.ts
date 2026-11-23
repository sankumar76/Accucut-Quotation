/**
 * The words of the Mark as quoted dialog (CR-01 item 7C, AQP-400; UX spec SCR-06 "Mark as quoted" and its mock-up), written in the one place the dialog is built from. They are fetched with the dialog, on the first
 * press of the button, and are **not** in the first load of `/estimates/[code]` (NFR-009, ADR-016): nothing in the review's first-load files imports this file. No word here holds a figure (NFR-002). A sentence of the
 * server's (the 409s) is written once in `lib/estimate/state-machine.ts` and is not repeated here.
 *
 * "This cannot be undone, except by Unlock." is the line AC-4 asks for (the confirmed answer A-CR01-3: no undo apart from Unlock); the ux-expert owns the final words in the Built column of the spec.
 */

/**
 * The `code` of the 409 of a second press, which the dialog treats as done (the estimate is quoted, which is what was asked for) while every other refusal is a sentence to show. It is spelled here and not read from
 * `TRANSITION_REFUSALS`: a client that reads that table keeps all ten sentences of the state machine in the chunk the first load of `/queue` and `/estimates/[code]` share (it cost `/queue` 215 bytes gzip, NFR-009, AQP-400),
 * and a new shared module for one word cost 44. A unit test holds this equal to the machine's code (`tests/unit/estimate-status-service.test.ts`).
 */
export const ALREADY_QUOTED_CODE = 'ESTIMATE_ALREADY_QUOTED';

export const markQuotedTitle = (code: string): string => `Mark ${code} as quoted?`;

/** "Do this once the quote has been sent to Brightwater Controls." The customer is named when the estimate has one (an estimate made before CR-01 has none). */
export const markQuotedIntro = (customerName: string | null): string =>
  `Do this once the quote has been sent to ${customerName ?? 'the customer'}. The status becomes Quoted, with your name and the time.`;

export const MARK_QUOTED_NO_UNDO = 'This cannot be undone, except by Unlock.';

export const NOT_YET_LABEL = 'Not yet';
export const MARK_QUOTED_SUBMIT_LABEL = 'Mark as quoted';
export const MARKING_LABEL = 'Marking as quoted';

/**
 * No usable answer came (the network, a server fault, an answer of the wrong shape). It claims nothing about what was stored: the mark may have gone through, so the page is drawn again and says what is true. It
 * follows the sentence of the unlock (an assumption of AQP-400: the spec has no sentence for it).
 */
export const MARK_QUOTED_UNCONFIRMED =
  'We could not confirm that the estimate was marked as quoted. It may have gone through, and the page is being updated to show it. If this window stays open, press Mark as quoted again. An estimate can only be marked once, so pressing again cannot mark it twice.';
