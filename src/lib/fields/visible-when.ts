/**
 * The one rule of "does a field show" (STORY-05.05 AC-1, AC-4; SPEC sections 7.1 and 14.4): a field whose `visibleWhen` names a watched field and the values that hide it (Fasteners Qty and Cost,
 * watching Fasteners, hidden for "None" and for blank). Pure and with no import, so the part form in the browser and the server read the same function. The registry's `isFieldShown`
 * (`visibility.ts`) calls it, and so do the form (`form-values.ts`), the save (`hidden-inputs.ts`) and the completeness check of Calculate (`calculate-check.ts`): there is no second copy.
 */

/** What the rule needs of a field's `visibleWhen`: the watched field's ID and the values that hide the field. (The registry's `VisibleWhen` and the form's field view both fit.) */
export interface ShownRule {
  readonly fieldId: string;
  readonly values: ReadonlyArray<string>;
}

/** A watched value as the rule compares it: without the spaces around it and without regard to letter case, so " NONE " is "None" (AC-1). */
const comparable = (value: string): string => value.trim().toLowerCase();

/**
 * Whether a field shows, given the current value of the field the rule watches. No rule means it always shows. A blank or absent watched value counts as blank, so the field is hidden
 * while the watched one is blank as well as while it is one of the listed values.
 */
export function isShownByRule(rule: ShownRule | null, valueOf: (fieldId: string) => string | undefined): boolean {
  if (rule === null) return true;
  const watched = comparable(valueOf(rule.fieldId) ?? '');
  return !rule.values.some((hiding) => comparable(hiding) === watched);
}
