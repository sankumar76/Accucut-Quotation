/**
 * The words and the one rule of Ignore (CR-01 item 7D, AQP-401; FR-109; NFR-032; UX 12944 section 3), written once for the server that says them and the dialog that may show them. Pure, with no import but the shared
 * text rule. **None of them holds a figure, a rate, a formula or an ID** (NFR-002): each names a step or a state and nothing else.
 *
 * Restore has no words here: it takes no remarks of its own (the product-manager, PRD 0.43 FR-109), so there is nothing to judge. A wrong status is not here either: it is the state machine's
 * (`TRANSITION_REFUSALS` in `state-machine.ts`), one code and one sentence on every path.
 */

import { textTooLongMessage, validateTextInput } from './validation';

/** The remarks are the Lead's own text, kept in the audit log: required, at most this many characters (code points) after the ends are trimmed. **The one place the limit is written** (NFR-032); the dialog's hint and its message read it. */
export const IGNORE_REMARKS_MAX_LENGTH = 500;

/** Under the field when the remarks are empty or only white space (UX 12944 section 3). */
export const IGNORE_REMARKS_REQUIRED_MESSAGE = 'Enter remarks. They are kept in the audit log.';

/** Under the field when the remarks are longer than `IGNORE_REMARKS_MAX_LENGTH`: the shared sentence of the other length limits (UX-43), read from the shared function so it cannot drift. */
export const IGNORE_REMARKS_TOO_LONG_MESSAGE = textTooLongMessage(IGNORE_REMARKS_MAX_LENGTH);

export type IgnoreRemarksCheck = { readonly ok: true; readonly remarks: string } | { readonly ok: false; readonly message: string };

/**
 * Judges the typed remarks: the ends are trimmed, an empty or all-white-space text is refused, a text over `IGNORE_REMARKS_MAX_LENGTH` is refused, and so is a control, format or separator character and a lone
 * surrogate other than a line feed. The order is empty, length, hidden character. Counted in code points, as the column's CHECK counts (`char_length`), so 500 emoji are not judged longer than 500. A carriage return is
 * folded into a line feed, and a line feed counts 1. The text kept is the trimmed one.
 *
 * It is judged by the shared text rule (`validateTextInput`, DL-219), as the unlock reason is (`checkUnlockReason`): this file writes no sentence of its own for a hidden character, so the message changes in one place
 * when GitHub #429 names the refused character. A NUL or a lone surrogate (which PostgreSQL cannot store) is a 422 and never a 500. The dialog and the service call this same function.
 */
export function checkIgnoreRemarks(text: string): IgnoreRemarksCheck {
  const checked = validateTextInput(text, { multiline: true, maxLength: IGNORE_REMARKS_MAX_LENGTH, countCodePoints: true });
  if (!checked.ok) return { ok: false, message: checked.message };
  if (checked.value === null) return { ok: false, message: IGNORE_REMARKS_REQUIRED_MESSAGE };
  return { ok: true, remarks: checked.value };
}
