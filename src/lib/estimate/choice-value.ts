import type { InputCheck } from './validation';

/**
 * A choice input of the part form (STORY-08.08 AC-1, AC-2, A-1): a registry input of type `select` with `options`, drawn as a list. **A choice is stored as the text of the option**, so a stored value
 * reads the same whatever the list becomes. Pure and free of the registry, so the browser (`form-values.ts`) and the server (`estimate-inputs.ts`) read a typed value with one rule, and the page carries
 * no more than a few lines of it (NFR-009).
 *
 * The words are proposed (open question OQ-1 of the story) and are the ux-expert's to rule on at the end review.
 */

/** Under a value that is not one of the options (422 on the field). */
export const CHOOSE_LISTED_OPTION_MESSAGE = 'Choose one of the listed options.';

/** Under a choice Calculate found blank (`CALCULATE_BLOCKED`) and the placeholder of the list. */
export const CHOOSE_OPTION_MESSAGE = 'Choose an option.';

/**
 * One typed choice. A blank clears the value (a draft saves with any field blank, FR-053). Otherwise the text, trimmed, must be one of `options`, compared with the letter case as written; the option's own
 * text is what is stored. `held` is what the part already holds under the field: a stored value that is no longer in the list is kept as it is when it is sent back unchanged (the same rule as a deleted
 * treatment, AC-2), and is the only value outside the list that is accepted.
 */
export function readChoiceInput(typed: string, options: ReadonlyArray<string>, held?: unknown): InputCheck {
  const text = typed.trim();
  if (text === '') return { ok: true, value: null };
  const listed = options.find((option) => option === text);
  if (listed !== undefined) return { ok: true, value: listed };
  if (typeof held === 'string' && held === text) return { ok: true, value: held };
  return { ok: false, message: CHOOSE_LISTED_OPTION_MESSAGE };
}
