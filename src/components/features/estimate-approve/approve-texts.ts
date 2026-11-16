/**
 * The words of SCR-08 "Approve and lock" (STORY-06.06; UX spec v0.30 SCR-08 "Fields" and "States"), written in the one place the dialog is built from. They are fetched with the dialog, on the first press of Approve
 * and lock, and are **not** in the first load of `/estimates/[code]` (NFR-009, ADR-016): nothing in the review's first-load files imports this file. No word here holds a figure, a rate or a formula (NFR-002): the
 * price is what the Lead typed and the calculated total is the field's own starting value. A sentence of the server's (the 409s) is written once in `lib/estimate/approval-words.ts` and is not repeated here.
 */

export const DIALOG_TITLE = 'Approve and lock';
/** The label of the field; the Excel letter of BO is drawn beside it from the configuration version (UX-26), never typed. */
export const PRICE_LABEL = 'Approved Quote Price';
export const RUPEE_SIGN = '₹';
/** The Default state's information line (AC-1). The reason it speaks of is STORY-06.07's field. */
export const PRICE_INFO = 'If you change the price, the difference is recorded as an override. You can add a reason for it; the reason is optional.';
export const CANCEL_LABEL = 'Cancel';
export const SAVING_LABEL = 'Approving';

/** State "Estimate changed while open" (UX-43; server answer 409 `TOTALS_OUT_OF_DATE`): the alert, and the way on that replaces Cancel while Approve and lock is off. */
export const OUT_OF_DATE_ALERT = 'An input changed while this window was open. The total is cleared, so nothing was approved. Press Recalculate, then approve and lock again.';
export const RECALCULATE_FIRST_LABEL = 'Recalculate first';

/** State "Figures recalculated while open" (v0.30; server answer 409 `CALCULATION_CHANGED`, whose sentence is `CALCULATION_CHANGED_MESSAGE`): the way on, and its failure line. */
export const SHOW_NEW_FIGURES_LABEL = 'Show the new figures';
export const SHOW_NEW_FIGURES_FAILED = 'We could not show the new figures. Check your connection and try again.';

/**
 * No usable answer came (the network, a server fault, an answer of the wrong shape). It claims nothing about what was saved: the approval may have gone through, so the page is drawn again and says what is true.
 * The UX spec gives no sentence for this case; this one follows the Recalculate failure line of SCR-06 (assumption A-4 of STORY-06.06).
 */
export const APPROVE_UNCONFIRMED = 'We could not confirm the approval. Reload the page to see whether it was approved.';
