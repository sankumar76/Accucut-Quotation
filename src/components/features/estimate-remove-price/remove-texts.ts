/**
 * The words of the Remove price dialog (STORY-06.13 AC-2; UX spec SCR-06 "Remove price (Admin)"), written in the one place the dialog is built from. They are fetched with the dialog, on the first press of the button, and
 * are **not** in the first load of `/estimates/[code]` (NFR-009, ADR-016): nothing in the review's first-load files imports this file. The one figure is the price the Admin is looking at on the page, handed in already written
 * (`formatRupees`), so this file imports nothing. A sentence of the server's (the 409s and the step-up's 422 and 429) is written once in `lib/estimate/*-words.ts` and `lib/auth/step-up.ts` and is not repeated here.
 */

export const removeTitle = 'Remove the approved price?';

/** The dialog's one paragraph, word for word as the spec has it; `price` is the price on the page, written as rupees ("₹ 12,600.00"). */
export const removeIntro = (price: string): string =>
  `The price ${price} will be removed from every screen and from the Excel file. The audit log keeps it, and only you can read it. This cannot be undone. A new approval, after a Recalculate, is the way to set a price again.`;

export const PASSWORD_LABEL = 'Your password';
export const PASSWORD_HINT = 'We ask for your password again because this removes a price that was approved.';
export const KEEP_LABEL = 'Keep the price';
export const REMOVE_LABEL = 'Remove price';
export const REMOVING_LABEL = 'Removing';

/**
 * No usable answer came (the network, a server fault, an answer of the wrong shape). It claims nothing about what was stored: the removal may have gone through, so the page is drawn again and says what is true. It follows
 * the cancel's sentence (ux-spec v0.31, SCR-08 ruling 1), with "removed" for "cancelled" (an assumption of STORY-06.13).
 */
export const REMOVE_UNCONFIRMED =
  'We could not confirm the removal. It may have gone through, and the page is being updated to show it. If this window stays open, press Remove price again. A price can only be removed once, so pressing again cannot remove it twice.';
