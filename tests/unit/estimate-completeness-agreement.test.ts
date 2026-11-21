import { describe, expect, it } from 'vitest';

import { validateForCalculate } from '@/lib/estimate/calculate-check';
import { buildFormSections } from '@/lib/estimate/form-fields';
import { createCompletenessReader } from '@/lib/estimate/part-completeness';
import { encodeTreatment, treatmentChoiceOf } from '@/lib/estimate/treatment-value';
import { sectionProgress, shownSections, sumProgress } from '@/lib/estimates/form-values';
import type { FormSection } from '@/lib/estimates/form-client';
import type { ConfigDocument } from '@/lib/fields/schema';

import { completePartInputs, fieldIdOf, INVENTED_NUMBER } from '../support/complete-part';
import { choiceSectionVersion } from '../support/choice-section-version';
import { seedConfig } from '../support/seed-config';

/**
 * STORY-05.11 AC-3 and AC-5: the count the page draws (`sectionProgress`, added up), the server's completeness (`createCompletenessReader`) and Calculate's blocked list (`validateForCalculate`) are
 * three readings of the same part, and they must agree for every part whose values are saved. "n of n" is true exactly when the server says `COMPLETE`; a part the tree calls `COMPLETE` is
 * never named by `CALCULATE_BLOCKED`, and a part Calculate names is never `COMPLETE`. The page and the server hold two code paths on purpose (the server rule stays out of the page's first load,
 * NFR-009), so this test over the **seed registry** is what holds them together: a registry that changes, or a field that a later story adds, breaks it here and not in front of an Engineer.
 */

const document: ConfigDocument = seedConfig;
const completenessOf = createCompletenessReader(document);
const sections = buildFormSections(document) as unknown as FormSection[];

/** The text the part form shows for each stored value: the text, and the one text of Treatment / Color (`treatment-value.ts`). Nothing stored shows nothing (the form adds a field's default itself). */
function textsOf(inputs: Readonly<Record<string, unknown>>): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const [fieldId, value] of Object.entries(inputs)) {
    if (typeof value === 'string') texts[fieldId] = value;
    else {
      const choice = treatmentChoiceOf(value);
      if (choice !== null) texts[fieldId] = encodeTreatment(choice);
    }
  }
  return texts;
}

/** What the page counts for a part whose values are saved: no value waits to be saved and none is refused (no errors). */
function counted(inputs: Readonly<Record<string, unknown>>) {
  const texts = textsOf(inputs);
  return sumProgress(shownSections(sections, texts).map((section) => sectionProgress(section, texts, {})));
}

function calculateNames(inputs: Readonly<Record<string, unknown>>): boolean {
  return !validateForCalculate([{ id: '00000000-0000-4000-8000-0000000000b1', slNo: '1', inputs }], document).ok;
}

const without = (inputs: Readonly<Record<string, unknown>>, ...keys: string[]): Record<string, unknown> => {
  const dropped = new Set(keys.map((key) => fieldIdOf(key)));
  return Object.fromEntries(Object.entries(inputs).filter(([fieldId]) => !dropped.has(fieldId)));
};

const complete = completePartInputs();
const NUMBER_IDS = sections.flatMap((section) => section.fields.filter((field) => field.editable && field.required && field.rule.type === 'number' && !field.visibleWhen).map((field) => field.id));

/** The set of saved parts of AC-3: empty, partial, complete, Fasteners "None" with and without a typed Qty, a part of 0 values only, a part with a default only, and every complete part with one input missing. */
const PARTS: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ['empty', {}],
  ['partial: one text', { [fieldIdOf('part-no')]: 'Invented text' }],
  ['partial: numbers only', Object.fromEntries(NUMBER_IDS.map((id) => [id, INVENTED_NUMBER]))],
  ['complete', complete],
  ['complete, Fasteners "None" stored, no Qty', { ...complete, [fieldIdOf('fasteners')]: 'None' }],
  ['complete, Fasteners "None" stored with a typed Qty and Cost', { ...complete, [fieldIdOf('fasteners')]: 'None', [fieldIdOf('fasteners-qty')]: '5.00', [fieldIdOf('fasteners-cost')]: '7.00' }],
  ['complete, Fasteners "None" stored with Qty and Cost 0', { ...complete, [fieldIdOf('fasteners')]: 'None', [fieldIdOf('fasteners-qty')]: '0', [fieldIdOf('fasteners-cost')]: '0' }],
  ['Fasteners with a word and no Qty or Cost', { ...complete, [fieldIdOf('fasteners')]: 'Invented bolts' }],
  ['Fasteners with a word and a Qty only', { ...complete, [fieldIdOf('fasteners')]: 'Invented bolts', [fieldIdOf('fasteners-qty')]: INVENTED_NUMBER }],
  ['Fasteners with a word, Qty and Cost', { ...complete, [fieldIdOf('fasteners')]: 'Invented bolts', [fieldIdOf('fasteners-qty')]: INVENTED_NUMBER, [fieldIdOf('fasteners-cost')]: INVENTED_NUMBER }],
  ['only 0 values', Object.fromEntries(NUMBER_IDS.map((id) => [id, '0']))],
  ['0 in every number, with the words and the material', { ...complete, ...Object.fromEntries(NUMBER_IDS.map((id) => [id, '0'])) }],
  ['a default only (nothing stored)', {}],
  ['complete without a picture (Part Model is optional)', without(complete, 'part-model')],
  ...[...Object.keys(complete)].map((fieldId): readonly [string, Record<string, unknown>] => [`complete, one input missing (${fieldId})`, Object.fromEntries(Object.entries(complete).filter(([key]) => key !== fieldId))]),
];

describe('AC-3: the count, the server and Calculate agree', () => {
  it('covers every case of the story and every needed input of the form', () => {
    expect(PARTS.length).toBeGreaterThan(20);
    expect(NUMBER_IDS.length).toBeGreaterThan(3);
  });

  it.each(PARTS)('%s: "n of n" is true exactly when the server says COMPLETE, and Calculate names the part exactly when it does not', (_name, inputs) => {
    const counts = counted(inputs);
    const word = completenessOf(inputs);
    expect(counts.complete === counts.total && counts.total > 0, 'n of n').toBe(word === 'COMPLETE');
    expect(calculateNames(inputs), 'Calculate names the part').toBe(word !== 'COMPLETE');
  });

  it('AC-5: a part with all eight cards complete reads COMPLETE, and each card is complete by the same count', () => {
    const texts = textsOf(complete);
    const cards = shownSections(sections, texts).map((section) => sectionProgress(section, texts, {}));
    for (const card of cards) expect(card.complete).toBe(card.total);
    expect(completenessOf(complete)).toBe('COMPLETE');
  });

  it('the count is the sum of the cards, and it leaves out Part Model and a field the registry hides', () => {
    const texts = textsOf({ ...complete, [fieldIdOf('fasteners')]: 'None', [fieldIdOf('fasteners-qty')]: '5.00' });
    const cards = shownSections(sections, texts).map((section) => sectionProgress(section, texts, {}));
    const total = counted({ ...complete, [fieldIdOf('fasteners')]: 'None', [fieldIdOf('fasteners-qty')]: '5.00' });
    expect(total.total).toBe(cards.reduce((sum, card) => sum + card.total, 0));
    const shown = shownSections(sections, texts).flatMap((section) => section.fields.map((field) => field.id));
    expect(shown).not.toContain(fieldIdOf('fasteners-qty'));
    expect(shown).not.toContain(fieldIdOf('fasteners-cost'));
    const withShown = counted({ ...complete, [fieldIdOf('fasteners')]: 'Invented bolts' });
    expect(withShown.total).toBe(total.total + 2);
    expect(withShown.complete).toBe(total.complete);
  });

  it('0 is a value: a part of 0 numbers counts them', () => {
    // Every 0 counts, and so does Fasteners, which shows its default "None" while nothing is stored.
    expect(counted(Object.fromEntries(NUMBER_IDS.map((id) => [id, '0']))).complete).toBe(NUMBER_IDS.length + 1);
  });

  it('a field added to the registry later is counted by both with no edit here', () => {
    const remarks = document.fields.find((field) => field.kind === 'input' && field.key === 'remarks');
    expect(remarks).toBeDefined();
    const newId = '00000000-0000-4000-8000-0000000000f1';
    const wider: ConfigDocument = { ...document, fields: [...document.fields, ...(remarks === undefined ? [] : [{ ...remarks, id: newId, key: 'invented-note', label: 'Invented note', formOrder: 99 }])] };
    const wideSections = buildFormSections(wider) as unknown as FormSection[];
    const countOf = (inputs: Readonly<Record<string, unknown>>) => {
      const texts = textsOf(inputs);
      return sumProgress(shownSections(wideSections, texts).map((section) => sectionProgress(section, texts, {})));
    };
    const read = createCompletenessReader(wider);
    expect(read(complete)).toBe('PARTIAL');
    expect(countOf(complete).complete).toBe(countOf(complete).total - 1);
    const filled = { ...complete, [newId]: 'Invented text' };
    expect(read(filled)).toBe('COMPLETE');
    expect(countOf(filled).complete).toBe(countOf(filled).total);
    expect(validateForCalculate([{ id: 'a', slNo: '1', inputs: complete }], wider).ok).toBe(false);
    expect(validateForCalculate([{ id: 'a', slNo: '1', inputs: filled }], wider).ok).toBe(true);
  });
});

/**
 * STORY-08.08 AC-4: the same three readings agree over a registry that has a **choice input in a new section** (the insert of 08.03 through its pure core, so the test needs no database). The new card
 * counts like the eight before it, a blank or unlisted choice keeps the part from `COMPLETE`, a value in the new section is counted, and Calculate names exactly the parts the server calls incomplete.
 */
describe('STORY-08.08 AC-4: a choice field in a new section is counted by the page, the server and Calculate alike', () => {
  const version = choiceSectionVersion();
  const wide = version.document;
  const wideSections = buildFormSections(wide) as unknown as FormSection[];
  const read = createCompletenessReader(wide);
  const wideComplete = { ...completePartInputs(wide), [version.fieldId]: 'Fine' };
  const countOf = (inputs: Readonly<Record<string, unknown>>) => {
    const texts = textsOf(inputs);
    return sumProgress(shownSections(wideSections, texts).map((section) => sectionProgress(section, texts, {})));
  };
  const namesPart = (inputs: Readonly<Record<string, unknown>>): boolean => !validateForCalculate([{ id: '00000000-0000-4000-8000-0000000000b1', slNo: '1', inputs }], wide).ok;
  const dropped = (inputs: Readonly<Record<string, unknown>>, fieldId: string) => Object.fromEntries(Object.entries(inputs).filter(([key]) => key !== fieldId));

  const parts: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ['empty', {}],
    ['complete, with the choice made', wideComplete],
    ['complete but the choice blank', dropped(wideComplete, version.fieldId)],
    ['complete, the choice holding a value no longer in the list', { ...wideComplete, [version.fieldId]: 'Retired grade' }],
    ['only the choice made', { [version.fieldId]: 'Mirror' }],
    ...Object.keys(wideComplete).map((fieldId): readonly [string, Record<string, unknown>] => [`complete, one input missing (${fieldId})`, dropped(wideComplete, fieldId)]),
  ];

  it.each(parts)('%s: "n of n" is true exactly when the server says COMPLETE, and Calculate names the part exactly when it does not', (_name, inputs) => {
    const counts = countOf(inputs);
    const word = read(inputs);
    expect(counts.complete === counts.total && counts.total > 0, 'n of n').toBe(word === 'COMPLETE');
    expect(namesPart(inputs), 'Calculate names the part').toBe(word !== 'COMPLETE');
  });

  it('counts the new card as a card of its own: one field, "1 of 1" once the choice is made, and the part total is the cards added up', () => {
    const texts = textsOf(wideComplete);
    const cards = shownSections(wideSections, texts).map((section) => ({ number: section.number, ...sectionProgress(section, texts, {}) }));
    expect(cards.at(-1)).toEqual({ number: 9, complete: 1, total: 1 });
    const blank = textsOf(dropped(wideComplete, version.fieldId));
    expect(shownSections(wideSections, blank).map((section) => sectionProgress(section, blank, {})).at(-1)).toEqual({ complete: 0, total: 1 });
    expect(countOf(wideComplete).total).toBe(cards.reduce((sum, card) => sum + card.total, 0));
    expect(read(wideComplete)).toBe('COMPLETE');
  });
});
