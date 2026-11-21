import { describe, expect, it } from 'vitest';

import { insertFields } from '@/lib/config/field-insert';
import { buildFormSections, formFieldById } from '@/lib/estimate/form-fields';
import type { ConfigDocument } from '@/lib/fields/schema';
import { MATERIAL_RATE_KEY } from '@/lib/fields/types';

import { choiceSectionVersion, CHOICE_LABEL, NEW_SECTION_NAME, NEW_SECTION_SHORT_NAME } from '../../support/choice-section-version';
import { defined } from '../../support/defined';
import { fieldIdAt, newInput, newOutput } from '../../support/insert-specs';
import { SEED_PROCESS_ITEMS, seedConfig } from '../../support/seed-config';

/**
 * STORY-08.08 AC-4, AC-5 (FR-074; NFR-002): the part form draws every section of the registry, in the order of its `number`, and the fixed list of sections 1 to 8 no longer limits it. A section with no
 * engineer-visible input draws nothing. Every other allow-list rule stays: an output, an auto field (a rate among them) and an input the registry hides from the Engineer are never on the form, in a
 * new section as in an old one. Over the real seed registry plus the insert of 08.03; every name is invented.
 */

const RATES = SEED_PROCESS_ITEMS.map(({ id, name }) => ({ id, name }));
const SECTION_NINE = '00000000-0000-4000-8000-0000000009a9';

const withField = (document: ConfigDocument, fieldId: string, change: Record<string, unknown>): ConfigDocument => ({
  ...document,
  fields: document.fields.map((field) => (field.id === fieldId ? ({ ...field, ...change } as typeof field) : field)),
});

describe('AC-4: a section above 8 is drawn after section 08 with its own name and column range', () => {
  const version = choiceSectionVersion();
  const sections = buildFormSections(version.document);

  it('is the ninth card, with its number, name, short name and the letters of its fields, after the eight of the seed', () => {
    expect(sections.map((section) => section.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const added = defined(sections[8]);
    expect(added).toMatchObject({ id: version.sectionId, number: 9, name: NEW_SECTION_NAME, shortName: NEW_SECTION_SHORT_NAME, columnRange: 'AY' });
    expect(added.fields.map((field) => field.label)).toEqual([CHOICE_LABEL]);
  });

  it('leaves the eight seeded sections as they were: the same fields in the same order (only the letters after AX move)', () => {
    const idsOf = (list: ReturnType<typeof buildFormSections>) => list.map((section) => [section.id, section.name, section.fields.map((field) => field.id)]);
    expect(idsOf(sections.slice(0, 8))).toEqual(idsOf(buildFormSections(seedConfig)));
  });

  it('orders the sections by `number`, whatever order the document lists them in', () => {
    const shuffled: ConfigDocument = { ...version.document, sections: [...version.document.sections].reverse() };
    expect(buildFormSections(shuffled).map((section) => section.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('draws a second new section after the first (numbers 9 and 10), each with its own fields', () => {
    const second = insertFields({
      document: version.document,
      rates: RATES,
      spec: { kind: 'input', afterFieldId: fieldIdAt('AX'), input: newInput({ label: 'Invented Second Count', sectionId: '', newSection: { name: 'Invented Checking', shortName: 'Checking' } }) },
    });
    if (!second.ok) throw new Error('The invented second insert must succeed.');
    const drawn = buildFormSections(second.document);
    expect(drawn.slice(8).map((section) => [section.number, section.name, section.fields.map((field) => field.label)])).toEqual([
      [9, NEW_SECTION_NAME, [CHOICE_LABEL]],
      [10, 'Invented Checking', ['Invented Second Count']],
    ]);
  });

  it('puts a Number input into an existing section and a new one alike, and every field of a new section can be saved', () => {
    const number = insertFields({
      document: seedConfig,
      rates: RATES,
      spec: { kind: 'input', afterFieldId: fieldIdAt('AX'), input: newInput({ label: 'Invented Count In New', sectionId: '', newSection: { name: 'Invented Counting', shortName: 'Counting' } }) },
    });
    if (!number.ok) throw new Error('The invented insert must succeed.');
    const id = defined(number.inserted[0]).id;
    expect(formFieldById(number.document, id)).toMatchObject({ editable: true, rule: { type: 'number' } });
  });

  it('draws nothing for a section with no engineer-visible input', () => {
    const hidden = withField(version.document, version.fieldId, { engineerVisible: false });
    expect(buildFormSections(hidden).map((section) => section.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('draws nothing for a field whose section the registry does not have', () => {
    const orphan = withField(version.document, version.fieldId, { sectionId: SECTION_NINE });
    expect(buildFormSections(orphan).map((section) => section.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(formFieldById(orphan, version.fieldId)).toBeUndefined();
  });
});

describe('AC-5: the allow-list holds in a new section (NFR-002)', () => {
  const version = choiceSectionVersion();

  it('never draws an output placed in a new section, nor saves a value for it', () => {
    const out = insertFields({ document: version.document, rates: RATES, spec: { kind: 'output', afterFieldId: fieldIdAt('AX'), output: newOutput({ label: 'Invented Planted Cost' }) } });
    if (!out.ok) throw new Error('The invented output insert must succeed.');
    const outputId = defined(out.inserted[0]).id;
    // A wrong stored version: the output is placed in the new section and flagged visible. The kind and the allow-list refuse it.
    const wrong = withField(out.document, outputId, { sectionId: version.sectionId, engineerVisible: true });
    expect(buildFormSections(wrong).flatMap((section) => section.fields).map((field) => field.id)).not.toContain(outputId);
    expect(formFieldById(wrong, outputId)).toBeUndefined();
  });

  it('never draws Material Rate / Kg moved into a new section and flagged visible, nor any auto field', () => {
    const rate = defined(version.document.fields.find((field) => field.key === MATERIAL_RATE_KEY));
    const wrong = withField(version.document, rate.id, { sectionId: version.sectionId, engineerVisible: true });
    expect(formFieldById(wrong, rate.id)).toBeUndefined();
    expect(buildFormSections(wrong).flatMap((section) => section.fields).map((field) => field.id)).not.toContain(rate.id);
    const auto = defined(version.document.fields.find((field) => field.kind === 'auto' && field.key !== 'material-considered' && field.systemRole === null));
    expect(formFieldById(withField(version.document, auto.id, { sectionId: version.sectionId, engineerVisible: true }), auto.id)).toBeUndefined();
  });

  it('never draws an input the registry hides from the Engineer, in a new section or an old one', () => {
    const hidden = withField(version.document, version.fieldId, { engineerVisible: false });
    expect(formFieldById(hidden, version.fieldId)).toBeUndefined();
    expect(buildFormSections(hidden).flatMap((section) => section.fields).map((field) => field.id)).not.toContain(version.fieldId);
  });

  it('carries no formula, rate or stage in what it draws for a field of a new section', () => {
    const drawn = JSON.stringify(buildFormSections(version.document).at(-1));
    for (const forbidden of ['formula', 'stageId', 'rate', 'cost', 'hideWhenZero']) expect(drawn.toLowerCase(), forbidden).not.toContain(forbidden.toLowerCase());
  });
});
