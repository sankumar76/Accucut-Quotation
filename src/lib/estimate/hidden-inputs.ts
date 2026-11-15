import type { ConfigDocument } from '../fields/schema';
import { isFieldShown } from '../fields/visibility';

import { formFieldById } from './form-fields';

/**
 * What the registry's `visibleWhen` means for a part's stored inputs (STORY-05.05 AC-3, AC-4, AC-5; SPEC sections 7.3 and 14.4; architecture section 4.8). Fasteners Qty (T) and Cost (U) are
 * hidden while Fasteners (S) is "None" or blank, and a hidden number is **0**, whatever was typed under it before the rule hid it. The rule itself is `isFieldShown` (`fields/visibility.ts`),
 * the one copy: the save (`estimate-inputs.ts`), what a part is read back as, and the completeness check of Calculate (`calculate-check.ts`) all call it through here, and the part form in
 * the browser reads the same comparison (`fields/visible-when.ts`). Pure, so the unit tests cover every case with no database.
 */

/** What a hidden number is: 0, in the form every stored number has (two decimals). */
export const HIDDEN_NUMBER = '0.00';

/**
 * The value of a field as the registry's rules read it from a part's stored inputs: the stored text if it is not blank, otherwise the field's default (Fasteners: "None"), otherwise nothing. A
 * stored value that is not text is not a value.
 */
export function storedValueOf(document: ConfigDocument, inputs: Readonly<Record<string, unknown>>): (fieldId: string) => string | undefined {
  return (fieldId) => {
    const stored = inputs[fieldId];
    if (typeof stored === 'string' && stored.trim() !== '') return stored;
    const field = document.fields.find((candidate) => candidate.id === fieldId);
    return field?.kind === 'input' ? (field.defaultValue ?? undefined) : undefined;
  };
}

/** The IDs of the registry's inputs that its `visibleWhen` rules hide, given how each watched field reads (`valueOf`). */
export function hiddenFieldIds(document: ConfigDocument, valueOf: (fieldId: string) => string | undefined): ReadonlySet<string> {
  return new Set(document.fields.filter((field) => !isFieldShown(field, valueOf)).map((field) => field.id));
}

/**
 * The part's stored inputs with every hidden **number** that holds a value set to `HIDDEN_NUMBER`; a copy, the part that was read is not changed. A hidden number with no value stays
 * without one: nothing is stored for it, and every reader reads it as 0 (so a part with nothing typed holds `{}` and stays `EMPTY`, and the part form's own "nothing is stored until it is
 * changed" holds). Only a number is zeroed: a hidden text is not a number, and no registry hides one today.
 */
export function zeroHiddenNumbers(document: ConfigDocument, inputs: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const zeroed: Record<string, unknown> = { ...inputs };
  for (const fieldId of hiddenFieldIds(document, storedValueOf(document, inputs))) {
    if (typeof zeroed[fieldId] === 'string' && formFieldById(document, fieldId)?.rule.type === 'number') zeroed[fieldId] = HIDDEN_NUMBER;
  }
  return zeroed;
}
