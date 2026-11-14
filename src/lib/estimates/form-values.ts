import { validateNumberInput, validateTextInput, type InputCheck } from '../estimate/validation';

import type { FormRule } from './form-client';

/**
 * What the part form does with one typed value before it asks the server (STORY-05.03 AC-4): read it by its field's rule, so a wrong number is refused on the screen with the
 * words of the rule and the typed text is kept, and a right one goes as the text the server will store. The server reads every value again and is the only judge (`estimate-inputs.ts`);
 * this is the same rule from one place (`lib/estimate/validation.ts`), so the screen and the server cannot say different things. Pure, no zod, so the page carries it.
 */

/** A choice is its ID: a blank clears it, anything else is sent and the server checks it against the Material Master. A derived field is never typed and never sent. */
export function readTyped(rule: FormRule, typed: string): InputCheck {
  switch (rule.type) {
    case 'number':
      return validateNumberInput(typed);
    case 'text':
      return validateTextInput(typed, { multiline: rule.multiline });
    case 'select':
      return { ok: true, value: typed.trim() === '' ? null : typed.trim().toLowerCase() };
    case 'derived':
      return { ok: true, value: null };
  }
}

/** The text to show in a field for a value the server holds (nothing is blank). */
export const shownText = (stored: string | undefined): string => stored ?? '';
