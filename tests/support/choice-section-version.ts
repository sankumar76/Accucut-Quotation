import { insertFields, type NewInput } from '../../src/lib/config/field-insert';
import type { ConfigDocument } from '../../src/lib/fields/schema';

import { defined } from './defined';
import { inputAfterAx } from './insert-specs';
import { SEED_PROCESS_ITEMS, seedConfig } from './seed-config';

/**
 * A configuration version with a choice input in a new section, made the way the Admin's screen makes it (STORY-08.08; the pure core of 08.03's insert, so a unit test needs no database): an input of type
 * "Choice from a list" is inserted after AX into **a new section** (number 9). The document goes through the registry's own schema, as a stored version does. Written once for the tests that need "the
 * configuration after the Admin added a choice input and a section". Every name is invented.
 */

export const CHOICE_LABEL = 'Invented Finish Grade';
export const CHOICE_OPTIONS: ReadonlyArray<string> = ['Coarse', 'Fine', 'Mirror'];
export const NEW_SECTION_NAME = 'Invented Finishing';
export const NEW_SECTION_SHORT_NAME = 'Finishing';

const RATES = SEED_PROCESS_ITEMS.map(({ id, name }) => ({ id, name }));

export interface ChoiceSectionVersion {
  readonly document: ConfigDocument;
  /** The ID of the choice input. */
  readonly fieldId: string;
  /** The ID of the new section (number 9). */
  readonly sectionId: string;
}

/** The input the Admin types for the choice, in a new section. `overrides` change what is typed. */
export function choiceInput(overrides: Partial<NewInput> = {}): Partial<NewInput> {
  return {
    label: CHOICE_LABEL,
    dataType: 'select',
    choices: CHOICE_OPTIONS.join('\n'),
    numFmt: '@',
    sectionId: '',
    newSection: { name: NEW_SECTION_NAME, shortName: NEW_SECTION_SHORT_NAME },
    ...overrides,
  };
}

/** The registry after the insert; throws when the invented insert is refused, so a broken fixture fails loudly. */
export function choiceSectionVersion(overrides: Partial<NewInput> = {}, base: ConfigDocument = seedConfig): ChoiceSectionVersion {
  const result = insertFields({ document: base, rates: RATES, spec: inputAfterAx(choiceInput(overrides)) });
  if (!result.ok) throw new Error(`The invented choice insert must succeed: ${JSON.stringify(result.issues)}`);
  const inserted = defined(result.inserted[0]);
  const field = defined(result.document.fields.find((candidate) => candidate.id === inserted.id));
  return { document: result.document, fieldId: inserted.id, sectionId: defined(field.sectionId) };
}
