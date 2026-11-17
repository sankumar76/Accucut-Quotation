/**
 * The words and the one rule of Cancel approval (STORY-06.12; FR-107; UX spec SCR-06 "Cancel approval" and "SCR-09 and SCR-06 Cancel approval: customer or material deleted, final words"), written once for the server that
 * says them and the dialog and the notice that show them. Pure, with no import but the shared rules. **None of them holds a figure, a rate, a formula or an ID** (NFR-002): each names a step or a state and nothing else.
 *
 * A status the machine refuses is not here: it is the state machine's (`TRANSITION_REFUSALS`), one code and one sentence on every path. Neither is the password's: that is the step-up's (`lib/auth/step-up.ts`).
 */

import { checkUnlockReason, UNLOCK_REASON_MAX, UNLOCK_REASON_REQUIRED_MESSAGE, UNLOCK_REASON_TOO_LONG_MESSAGE } from './unlock-words';

/** The reason is the Admin's own text, kept in the audit log: required, at most this many characters (code points) once the ends are trimmed (AC-2, AC-5). The one rule of the unlock's reason, so both say it the same way. */
export const CANCEL_REASON_MAX = UNLOCK_REASON_MAX;
export const CANCEL_REASON_REQUIRED_MESSAGE = UNLOCK_REASON_REQUIRED_MESSAGE;
export const CANCEL_REASON_TOO_LONG_MESSAGE = UNLOCK_REASON_TOO_LONG_MESSAGE;

/** The sentence for 409 `CUSTOMER_DELETED` (ux-spec v0.30, final words; AC-9): the thing cancelled is the approval, so the sentence names it. The code is Calculate's own (`calculate-words.ts`). */
export const CANCEL_CUSTOMER_DELETED_MESSAGE = 'The customer chosen for this estimate was deleted, so the approval cannot be cancelled. The approval was not changed.';

/** The same for a material one of the parts names, `MATERIAL_DELETED` (ux-spec v0.30, final words). */
export const CANCEL_MATERIAL_DELETED_MESSAGE = 'A material chosen for a part of this estimate was deleted, so the approval cannot be cancelled. The approval was not changed.';

/**
 * The three 409s of the approval itself (AC-5, AC-10). The spec has no sentence for them (assumptions of STORY-06.12, listed in the pull request): each names what is true and nothing else, and none holds a figure.
 * `APPROVAL_CHANGED` is architecture section 4.10's: the request names an approval that is not the latest any more (another one was made, or the page is old).
 */
export const APPROVAL_CHANGED_CODE = 'APPROVAL_CHANGED';
export const APPROVAL_CHANGED_MESSAGE = 'This estimate has a newer approval than the one on your screen. Reload the page to see it.';
export const APPROVAL_ALREADY_CANCELLED_CODE = 'APPROVAL_ALREADY_CANCELLED';
export const APPROVAL_ALREADY_CANCELLED_MESSAGE = 'This approval has already been cancelled.';
export const NO_APPROVAL_TO_CANCEL_CODE = 'NO_APPROVAL_TO_CANCEL';
export const NO_APPROVAL_TO_CANCEL_MESSAGE = 'This estimate has no approval to cancel.';

export type CancelReasonCheck = { readonly ok: true; readonly reason: string } | { readonly ok: false; readonly message: string };

/** Judges the typed reason by the rule of the unlock's reason (`checkUnlockReason`): trimmed, 1 to 500 characters, no hidden character. */
export function checkCancelReason(text: string): CancelReasonCheck {
  return checkUnlockReason(text);
}
