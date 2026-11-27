import { isShownByRule } from '../fields/visible-when';

import type { FormField, FormSection } from './form-client';

/**
 * What the part form shows, and how wide each card is, for what is typed: the three pure rules that decide the form's **shape** (`textOf`, `fieldVisibility`/`shownSections`, `sectionWeight`), in a module of their
 * own (DEF-145). The form (`PartFields`, in its lazy chunk) and the form's loading ghost (drawn on the server) both read them, so the ghost has the cards and fields the form will have; the rest of
 * `form-values.ts` (reading and checking what is typed) stays with the fields. They are re-exported from `form-values.ts`, so no other import changes.
 */

export type TextedField = Pick<FormField, 'id' | 'defaultValue'>;
export type Texts = Readonly<Record<string, string>>;

/**
 * The text a field shows (STORY-05.04 AC-3): what the person typed or the server holds, or, while nothing is held, the field's default (Fasteners shows "None"; nothing is stored until it is
 * changed, so a part left alone is still `EMPTY`). A blank typed over the default is a blank, so a person can clear the box while they type.
 */
export const textOf = (field: TextedField, texts: Texts): string => texts[field.id] ?? field.defaultValue ?? '';

type VisibleField = Pick<FormField, 'id' | 'defaultValue' | 'visibleWhen'>;

/**
 * Whether each field shows for what is typed (STORY-05.05 AC-1, AC-2; SPEC section 14.4): the registry's own rule, which the server sends with the field (`visibleWhen`) and `isShownByRule` reads.
 * The value a rule watches is the text that field shows, so Fasteners at its default "None", or a blank typed over it, hides Fasteners Qty and Cost, and any other word shows them. What was typed
 * into a hidden field stays in `texts`: it is the person's until they leave the form, and shows again when the field does (AC-2). This decides only what the screen draws; the server decides what
 * is stored (a hidden number is 0, `estimate-inputs.ts`).
 */
export function fieldVisibility(fields: ReadonlyArray<VisibleField>, texts: Texts): (field: VisibleField) => boolean {
  const byId = new Map(fields.map((field) => [field.id, field]));
  const valueOf = (fieldId: string): string | undefined => {
    const watched = byId.get(fieldId);
    return watched === undefined ? texts[fieldId] : textOf(watched, texts);
  };
  return (field) => isShownByRule(field.visibleWhen, valueOf);
}

/** The sections as the form draws them for what is typed: each card without its hidden fields (so "n of m" and the missing marks leave them out too). */
export function shownSections(sections: ReadonlyArray<FormSection>, texts: Texts): FormSection[] {
  const shown = fieldVisibility(
    sections.flatMap((section) => section.fields),
    texts,
  );
  return sections.map((section) => ({ ...section, fields: section.fields.filter(shown) }));
}

/** The least weight of a card in the row of cards: a card with one field is as wide as one with two, so it is never squeezed to a sliver. */
export const MIN_SECTION_WEIGHT = 2;

/**
 * How much of the row a card takes (CR-01 item 1, UX spec section 0.9; AQP-388 AC-2): its number of fields, so a card with more fields is wider than one with fewer. The cards sit side by side in
 * wrapping rows and each one's share follows this number (`--n` in `globals.css`). The surface treatments are drawn together as one multi-select, so the flags of a card count once; the picture counts as a field.
 */
export function sectionWeight(section: { readonly fields: ReadonlyArray<Pick<FormField, 'rule'>> }): number {
  const flags = section.fields.some((field) => field.rule.type === 'flag') ? 1 : 0;
  const drawn = section.fields.filter((field) => field.rule.type !== 'flag').length + flags;
  return Math.max(MIN_SECTION_WEIGHT, drawn);
}
