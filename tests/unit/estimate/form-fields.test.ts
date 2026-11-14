import { describe, expect, it } from 'vitest';

import { fieldLetter } from '@/lib/fields/registry';
import type { FieldDefinition } from '@/lib/fields/field-schema';
import { MATERIAL_CONSIDERED_KEY, MATERIAL_IN_DRAWING_KEY, MATERIAL_RATE_KEY } from '@/lib/fields/types';
import { buildFormSections, FORM_SECTION_NUMBERS, formFieldById, QTY_PER_ASSY_HINT } from '@/lib/estimate/form-fields';
import { MAX_PART_TEXT_LENGTH } from '@/lib/estimate/validation';

import { cloneSeedConfig, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-05.03 T2 (AC-1, AC-2, AC-3, AC-8): the form is built from the registry, never typed: the two sections of this story, each field with its derived letter, the
 * column range of the fields shown, the fixed hint of QTY per Assy, and **nothing that carries a rate, a cost or a formula** (Material Rate (I) and every calculated
 * field are not on it, whatever else the registry says).
 */

const sections = buildFormSections(seedConfig);
const lettersOf = (index: number): string[] => (sections[index]?.fields ?? []).map((field) => field.letter);

describe('AC-1: sections 01 and 02, from the registry', () => {
  it('has exactly the two sections of this story, in order, with their number, name and the column range of the fields shown', () => {
    expect(FORM_SECTION_NUMBERS).toEqual([1, 2]);
    expect(sections.map(({ number, name, shortName, columnRange }) => ({ number, name, shortName, columnRange }))).toEqual([
      { number: 1, name: 'Part Details', shortName: 'Part details', columnRange: 'A, B, D, H' },
      { number: 2, name: 'Material and Dimensions', shortName: 'Material', columnRange: 'E, F, J–L, N' },
    ]);
  });

  it('lists the fields of section 01 (Sl. No., Part No., Description, QTY per Assy) and of section 02 (E, F, J, K, L, N) in the order of the form', () => {
    expect(lettersOf(0)).toEqual(['A', 'B', 'D', 'H']);
    expect(lettersOf(1)).toEqual(['E', 'F', 'J', 'K', 'L', 'N']);
  });

  it('derives every letter from the position in the document, so a field that moved is lettered where it is now', () => {
    const moved = cloneSeedConfig();
    const length = moved.fields.find((field) => field.key === 'length');
    if (length === undefined) throw new Error('The seed has no Length.');
    const before = fieldLetter(length);
    length.position += 100;
    const field = buildFormSections(moved)
      .flatMap((section) => section.fields)
      .find((candidate) => candidate.id === length.id);
    expect(field?.letter).not.toBe(before);
    expect(field?.letter).toBe(fieldLetter(length));
  });

  it('marks Sl. No. and Material Considered as derived and read-only, and every other field as one a person types or chooses', () => {
    const fields = sections.flatMap((section) => section.fields);
    expect(fields.filter((field) => !field.editable).map((field) => field.letter)).toEqual(['A', 'F']);
    expect(fields.find((field) => field.letter === 'A')?.rule).toEqual({ type: 'derived', from: null });
    expect(fields.find((field) => field.letter === 'F')?.rule).toEqual({ type: 'derived', from: seedFieldAt('E').id });
  });

  it('gives each kind of field its rule: numbers two decimals, texts a length, the material a list', () => {
    const byLetter = (letter: string) => sections.flatMap((section) => section.fields).find((field) => field.letter === letter);
    expect(byLetter('J')?.rule).toEqual({ type: 'number', decimals: 2 });
    expect(byLetter('H')?.rule).toEqual({ type: 'number', decimals: 2 });
    expect(byLetter('B')?.rule).toEqual({ type: 'text', maxLength: MAX_PART_TEXT_LENGTH, multiline: false });
    expect(byLetter('E')?.rule).toEqual({ type: 'select', source: 'materials' });
    expect(byLetter('N')?.unit).toBe('kg');
  });
});

describe('AC-2: the label and the hint of QTY per Assy', () => {
  it('keeps the label and carries the hint of the delivery lead, whatever hint the stored registry holds', () => {
    const qty = sections.flatMap((section) => section.fields).find((field) => field.letter === 'H');
    expect(qty?.label).toBe('QTY per Assy');
    expect(qty?.hint).toBe('Enter the count for the whole order, not per assembly. For example, 24 lids in all, even if each pipe has 4.');
    expect(QTY_PER_ASSY_HINT).toBe(qty?.hint);
  });

  it('finds the field by its system role, not by its letter or its text', () => {
    const renamed = cloneSeedConfig();
    const quantity = renamed.fields.find((field) => field.systemRole === 'quantity');
    if (quantity === undefined) throw new Error('The seed has no quantity field.');
    quantity.label = 'Invented count';
    const found = buildFormSections(renamed)
      .flatMap((section) => section.fields)
      .find((field) => field.id === quantity.id);
    expect(found?.hint).toBe(QTY_PER_ASSY_HINT);
  });
});

describe('AC-3, AC-8: nothing that carries a rate, a cost or a formula', () => {
  const offered = sections.flatMap((section) => section.fields);

  it('does not offer Material Rate / Kg (I), any calculated field, or a field of a section that is not built yet', () => {
    const rate = seedConfig.fields.find((field) => field.key === MATERIAL_RATE_KEY);
    expect(rate).toBeDefined();
    expect(offered.map((field) => field.id)).not.toContain(rate?.id);
    const outputs = seedConfig.fields.filter((field) => field.kind === 'output').map((field) => field.id);
    expect(offered.filter((field) => outputs.includes(field.id))).toEqual([]);
    expect(offered.map((field) => field.letter)).not.toEqual(expect.arrayContaining(['C', 'G', 'P', 'Z', 'AJ']));
  });

  it('is built from keys, ids, letters, labels, units, hints and rules: no formula text, no rate name, no figure', () => {
    const text = JSON.stringify(sections);
    expect(Object.keys(sections[0] ?? {}).sort()).toEqual(['columnRange', 'fields', 'id', 'name', 'number', 'shortName']);
    for (const field of offered) {
      expect(Object.keys(field).sort()).toEqual(['editable', 'hint', 'id', 'kind', 'label', 'letter', 'required', 'rule', 'unit']);
    }
    expect(text).not.toMatch(/\{\{|formula|price|cost|rate/i);
  });

  it('refuses a field the registry wrongly flags as visible to an Engineer: a rate never gets on the form by a flag', () => {
    const tampered = cloneSeedConfig();
    for (const field of tampered.fields) {
      if (field.key === MATERIAL_RATE_KEY) (field as { engineerVisible: boolean }).engineerVisible = true;
      if (field.kind === 'output') (field as { engineerVisible: boolean }).engineerVisible = true;
    }
    const ids = buildFormSections(tampered).flatMap((section) => section.fields.map((field) => field.id));
    expect(ids.sort()).toEqual(offered.map((field) => field.id).sort());
  });

  it('does not offer an input the registry flags as hidden from the Engineer', () => {
    const hidden = cloneSeedConfig();
    const length = hidden.fields.find((field) => field.key === 'length');
    if (length === undefined) throw new Error('The seed has no Length.');
    (length as { engineerVisible: boolean }).engineerVisible = false;
    expect(buildFormSections(hidden).flatMap((section) => section.fields.map((field) => field.id))).not.toContain(length.id);
  });
});

describe('formFieldById: what a save may name', () => {
  it('finds the typed and chosen fields of the form, and nothing else', () => {
    const savable = (letter: string): FieldDefinition => seedFieldAt(letter);
    for (const letter of ['B', 'D', 'H', 'E', 'J', 'K', 'L', 'N']) expect(formFieldById(seedConfig, savable(letter).id)?.editable, letter).toBe(true);
  });

  it('finds the read-only fields too (so the form can draw them), marked as not editable', () => {
    expect(formFieldById(seedConfig, seedFieldAt('A').id)?.editable).toBe(false);
    expect(formFieldById(seedConfig, seedFieldAt('F').id)?.editable).toBe(false);
  });

  it.each([
    ['Material Rate / Kg (I)', () => seedFieldAt('I').id],
    ['Blank Weight (M), a calculated field', () => seedFieldAt('M').id],
    ['Part Model (C), the picture of story 05.07', () => seedFieldAt('C').id],
    ['Treatment / Color (G), story 05.06', () => seedFieldAt('G').id],
    ['Cutting Time (P), a section that is not built yet', () => seedFieldAt('P').id],
    ['an ID the registry does not have', () => '00000000-0000-4000-8000-0000deadbeef'],
  ])('does not find %s', (_name, idOf) => {
    expect(formFieldById(seedConfig, idOf())).toBeUndefined();
  });

  it('names the keys of the material fields by their registry keys', () => {
    expect(seedConfig.fields.find((field) => field.key === MATERIAL_IN_DRAWING_KEY)).toBeDefined();
    expect(seedConfig.fields.find((field) => field.key === MATERIAL_CONSIDERED_KEY)).toBeDefined();
  });
});
