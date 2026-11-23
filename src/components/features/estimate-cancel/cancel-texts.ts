/**
 * The words of the Cancel approval dialog (STORY-06.12; UX spec SCR-06 "Cancel approval (Admin)" and "Cancel approval on a Draft or Prepared estimate"), written in the one place the dialog is built from. They are fetched
 * with the dialog, on the first press of the button, and are **not** in the first load of `/estimates/[code]` (NFR-009, ADR-016): nothing in the review's first-load files imports this file. No word here holds a figure, a rate or
 * a formula (NFR-002). A sentence of the server's (the 409s and the step-up's 422 and 429) is written once in `lib/estimate/cancel-words.ts` and `lib/auth/step-up.ts` and is not repeated here.
 */

import { assertNever } from '@/lib/assert-never';
import type { EstimateStatus } from '@/lib/estimate/state-machine';

/** The status the estimate is in when the dialog opens: what the dialog promises depends on it (AC-10). */
export type CancelStatus = EstimateStatus;

export const cancelTitle = (code: string): string => `Cancel the approval of ${code}?`;

const PRICE_STAYS = 'The approved price stays on screen, marked "Approval cancelled", until you remove it. Neither step can be undone.';

/**
 * The first sentence and the last differ by status (ux-spec v0.31, "Cancel approval on a Draft or Prepared estimate"): an approved estimate goes back to Draft and its task reopens; a Draft or a Prepared one keeps
 * its status and its task.
 */
export function cancelIntro(status: CancelStatus, engineerName: string): string {
  switch (status) {
    case 'APPROVED':
    // A quoted estimate is an approved one whose quote has gone out; Cancel takes it back to Draft the same way (A-CR01-1).
    case 'QUOTED':
      return `The estimate goes back to Draft and the task returns to ${engineerName}'s Open queue, as it does when it is unlocked. ${PRICE_STAYS} A new approval, after a Recalculate, brings a price back.`;
    case 'DRAFT':
      return `The estimate stays a Draft and its task does not change. ${PRICE_STAYS} A new approval brings a price back.`;
    case 'PREPARED':
      return `The estimate stays Prepared and its task does not change. ${PRICE_STAYS} A new approval brings a price back.`;
    default:
      return assertNever(status, 'cancel status');
  }
}

export const REASON_LABEL = 'Reason for cancelling';
export const REASON_HINT = 'It is kept in the audit log.';
export const PASSWORD_LABEL = 'Your password';
export const PASSWORD_HINT = 'We ask for your password again because this changes a price that was approved.';
export const KEEP_LABEL = 'Keep the approval';
export const CANCEL_LABEL = 'Cancel approval';
export const CANCELLING_LABEL = 'Cancelling';

/**
 * No usable answer came (the network, a server fault, an answer of the wrong shape). It claims nothing about what was stored: the cancel may have gone through, so the page is drawn again and says what is true. It
 * follows the sentence ruled for the lost approval (ux-spec v0.31, SCR-08 ruling 1) and the unlock's, with "cancelled" for "unlocked" (an assumption of STORY-06.12).
 */
export const CANCEL_UNCONFIRMED =
  'We could not confirm the cancel. It may have gone through, and the page is being updated to show it. If this window stays open, press Cancel approval again. An approval can only be cancelled once, so pressing again cannot cancel it twice.';
