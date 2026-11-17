/**
 * The words and the one rule of Unlock (STORY-06.08; FR-063; UX spec SCR-09 and "SCR-09 and SCR-06 Cancel approval: customer or material deleted, final words"), written once for the server that says them and the
 * dialog that may show them. Pure, with no import but the shared text rule. **None of them holds a figure, a rate, a formula or an ID** (NFR-002): each names a step or a state and nothing else.
 *
 * A wrong status is not here: it is the state machine's (`TRANSITION_REFUSALS` in `state-machine.ts`), one code and one sentence on every path.
 */

import { validateTextInput } from './validation';

/** The reason is the Lead's own text, kept in the audit log: required, at most this many characters (code points) after the ends are trimmed (AC-4; the limit is the one of the reason for a different price, D-18). */
export const UNLOCK_REASON_MAX = 500;

/** Under the field when the reason is empty or only white space (SCR-09 state "Reason missing"; AC-4). */
export const UNLOCK_REASON_REQUIRED_MESSAGE = 'Enter a reason.';

/** Under the field when the reason is longer than `UNLOCK_REASON_MAX` (the sentence of the other length limits, UX-43). */
export const UNLOCK_REASON_TOO_LONG_MESSAGE = `Use ${UNLOCK_REASON_MAX} characters or fewer.`;

/** The `code` of the 409 for an approved estimate whose customer was deleted after the approval. The code is Calculate's own (`calculate-words.ts`); the sentence is Unlock's (ux-spec v0.30, final words). */
export const UNLOCK_CUSTOMER_DELETED_MESSAGE = 'The customer chosen for this estimate was deleted, so the estimate cannot be unlocked. The approval was not changed.';

/** The same for a material one of the parts names (ux-spec v0.30, final words). */
export const UNLOCK_MATERIAL_DELETED_MESSAGE = 'A material chosen for a part of this estimate was deleted, so the estimate cannot be unlocked. The approval was not changed.';

export type UnlockReasonCheck = { readonly ok: true; readonly reason: string } | { readonly ok: false; readonly message: string };

/**
 * Judges the typed reason: the ends are trimmed, an empty or all-white-space text is refused, and a text over `UNLOCK_REASON_MAX` characters is refused. Counted in code points, as the database counts
 * characters, so a reason of 500 letters with an accent or an emoji is not judged longer than it looks. The text kept is the trimmed one, with a carriage return folded into a line feed.
 * It is judged by the shared text rule (`validateTextInput`), as the reason of an approval is (DL-219): a control, format or separator character and a lone surrogate are refused with the shared sentence, so
 * the audit log never holds a reason that is invisible or reorders what is shown, and a NUL or a lone surrogate (which PostgreSQL cannot store) is a 422 and never a 500.
 */
export function checkUnlockReason(text: string): UnlockReasonCheck {
  const checked = validateTextInput(text, { multiline: true, maxLength: UNLOCK_REASON_MAX, countCodePoints: true });
  if (!checked.ok) return { ok: false, message: checked.message };
  if (checked.value === null) return { ok: false, message: UNLOCK_REASON_REQUIRED_MESSAGE };
  return { ok: true, reason: checked.value };
}
