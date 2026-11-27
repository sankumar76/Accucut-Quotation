import { readChoiceInput } from '../estimate/choice-value';
import { readFlagInput, readTreatmentInput } from '../estimate/treatment-value';
import { textTooLongMessage, validateNumberInput, validateTextInput, type InputCheck } from '../estimate/validation';

import type { FormField, FormRule } from './form-client';
import { textOf, type Texts } from './form-shown';

export { fieldVisibility, MIN_SECTION_WEIGHT, sectionWeight, shownSections, textOf } from './form-shown';

/**
 * What the part form does with one typed value before it asks the server (STORY-05.03 AC-4): read it by its field's rule, so a wrong number is refused on the screen with the
 * words of the rule and the typed text is kept, and a right one goes as the text the server will store. The server reads every value again and is the only judge (`estimate-inputs.ts`);
 * this is the same rule from one place (`lib/estimate/validation.ts`), so the screen and the server cannot say different things. Pure, no zod, so the page carries it.
 */

/**
 * A choice is its ID: a blank clears it, anything else is sent and the server checks it against the Material Master. Treatment / Color is its ID and words as one text, and a flag is `1` or `0`
 * (`treatment-value.ts`). A derived field and a picture are never typed and never sent as a value.
 */
export function readTyped(rule: FormRule, typed: string): InputCheck {
  switch (rule.type) {
    case 'number':
      return validateNumberInput(typed);
    case 'text':
      return validateTextInput(typed, { multiline: rule.multiline, maxLength: rule.maxLength });
    case 'select':
      return { ok: true, value: typed.trim() === '' ? null : typed.trim().toLowerCase() };
    case 'choice':
      return readChoiceInput(typed, rule.options);
    case 'treatment':
      return readTreatmentInput(typed);
    case 'flag':
      return readFlagInput(typed);
    case 'derived':
    case 'picture':
      return { ok: true, value: null };
  }
}

/** The text to show in a field for a value the server holds (nothing is blank). */
export const shownText = (stored: string | undefined): string => stored ?? '';

/**
 * The words of the limit while a person is still typing a long text (Remarks, STORY-05.04 AC-4): the text is allowed to run over, so the message can be seen and the typed text is kept,
 * and the same words are under the field when it is left. Nothing for a text that fits, and nothing for a field that is not a text.
 */
export function lengthProblem(rule: FormRule, typed: string): string | undefined {
  return rule.type === 'text' && typed.trim().length > rule.maxLength ? textTooLongMessage(rule.maxLength) : undefined;
}

/** The fields that watch this one: the fields that showing or hiding it changes. */
export const watchersOf = <T extends Pick<FormField, 'visibleWhen'>>(fields: ReadonlyArray<T>, fieldId: string): T[] => fields.filter((field) => field.visibleWhen?.fieldId === fieldId);

/** How many of a section's fields are filled: `complete` of `total` (UX spec SCR-05 "Layout rules": "n of m" on every card). */
export interface SectionProgress {
  readonly complete: number;
  readonly total: number;
}

/**
 * The "n of m complete" of one card (STORY-05.04 AC-1, AC-6). A field is counted if a person types or chooses it and Calculate needs it; it is complete when it shows a value and has no
 * message under it. The placeholders of a later story are in no list of `fields`, so the counts leave them out until their story builds them. The count follows what is typed, as the
 * form shows it; the server judges completeness at Calculate (STORY-05.09).
 */
export function sectionProgress(section: { readonly fields: ReadonlyArray<Pick<FormField, 'id' | 'defaultValue' | 'editable' | 'required'>> }, texts: Texts, errors: Texts): SectionProgress {
  const counted = section.fields.filter((field) => field.editable && field.required);
  const complete = counted.filter((field) => textOf(field, texts).trim() !== '' && errors[field.id] === undefined).length;
  return { complete, total: counted.length };
}

/**
 * The count of the whole part (STORY-05.11 AC-1): the sum of the cards' counts. Part Model is in no card's count (it is no typed field) and a field the registry hides for what is typed is in none
 * (`shownSections`), so "n of m" is the one the cards already show, added up.
 */
export const sumProgress = (cards: ReadonlyArray<SectionProgress>): SectionProgress => ({
  complete: cards.reduce((sum, card) => sum + card.complete, 0),
  total: cards.reduce((sum, card) => sum + card.total, 0),
});

/** A card is complete when it has something to fill and all of it is filled: a card with nothing to fill is not "complete". */
export const isSectionComplete = (progress: SectionProgress): boolean => progress.total > 0 && progress.complete === progress.total;
