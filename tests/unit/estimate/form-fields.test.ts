import { describe, expect, it } from 'vitest';

import { fieldLetter } from '@/lib/fields/registry';
import type { FieldDefinition } from '@/lib/fields/field-schema';
import { MATERIAL_CONSIDERED_KEY, MATERIAL_IN_DRAWING_KEY, MATERIAL_RATE_KEY } from '@/lib/fields/types';
import { buildFormSections, FORM_SECTION_NUMBERS, formFieldById, QTY_PER_ASSY_HINT } from '@/lib/estimate/form-fields';
import { MAX_LONG_TEXT_LENGTH, MAX_PART_TEXT_LENGTH } from '@/lib/estimate/validation';

import { cloneSeedConfig, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-05.03 T2 (AC-1, AC-2, AC-3, AC-8): the form is built from the registry, never typed: the two sections of this story, each field with its derived letter, the
 * column range of the fields shown, the fixed hint of QTY per Assy, and **nothing that carries a rate, a cost or a formula** (Material Rate (I) and every calculated
 * field are not on it, whatever else the registry says).
 */

const sections = buildFormSections(seedConfig);
const lettersOf = (index: number): string[] => (sections[index]?.fields ?? []).map((field) => field.letter);

const byLetter = (letter: string) => sections.flatMap((section) => section.fields).find((field) => field.letter === letter);
/**
 * The words with "cost" in them that the form may say: the labels of the four cost-typed inputs (a number the Engineer types, which is no cost shown to them: FR-008; STORY-05.04 AC-2,
 * AC-7) and the name of section 08, "Other Costs and Remarks" (SPEC 7.1). Nothing else on the form names a cost.
 */
const TYPED_COST_LABELS = ['Fasteners Cost', 'Machining Cost', 'Plating Cost', 'Tool Cost'];
const TYPED_COST_WORDS = [...TYPED_COST_LABELS, 'Other Costs and Remarks'];
const withoutTypedCostLabels = (text: string): string => TYPED_COST_WORDS.reduce((left, label) => left.replaceAll(label, ''), text);

describe('AC-1 (STORY-05.04): all eight sections, from the registry', () => {
  it('has the eight sections of SPEC 7.1, in order, with their number, name and the column range of the fields shown', () => {
    expect(FORM_SECTION_NUMBERS).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(sections.map(({ number, name, shortName, columnRange }) => ({ number, name, shortName, columnRange }))).toEqual([
      { number: 1, name: 'Part Details', shortName: 'Part details', columnRange: 'A, B, D, G, H' },
      { number: 2, name: 'Material and Dimensions', shortName: 'Material', columnRange: 'E, F, J–L, N' },
      { number: 3, name: 'Cutting Process', shortName: 'Cutting', columnRange: 'P, Q' },
      { number: 4, name: 'Bending', shortName: 'Bending', columnRange: 'R' },
      { number: 5, name: 'Fasteners', shortName: 'Fasteners', columnRange: 'S–U' },
      { number: 6, name: 'Welding', shortName: 'Welding', columnRange: 'V–Y' },
      { number: 7, name: 'Surface Treatment', shortName: 'Surface', columnRange: 'Z–AG' },
      { number: 8, name: 'Other Costs and Remarks', shortName: 'Other', columnRange: 'AJ, AP, AU, BM' },
    ]);
  });

  it('lists the fields of every section in the order of the form (section 08: AP, AU, BM, then AJ)', () => {
    expect(lettersOf(0)).toEqual(['A', 'B', 'D', 'H']);
    expect(lettersOf(1)).toEqual(['E', 'F', 'J', 'K', 'L', 'N']);
    expect(lettersOf(2)).toEqual(['P', 'Q']);
    expect(lettersOf(3)).toEqual(['R']);
    expect(lettersOf(4)).toEqual(['S', 'T', 'U']);
    expect(lettersOf(5)).toEqual(['V', 'W', 'X', 'Y']);
    expect(lettersOf(6)).toEqual([]);
    expect(lettersOf(7)).toEqual(['AP', 'AU', 'BM', 'AJ']);
  });

  it('AC-6: Treatment / Color (G) and the eight surface treatments (Z to AG) are placeholders that story 05.06 fills, not fields', () => {
    expect(sections.map((section) => section.reserved.map((field) => field.letter))).toEqual([['G'], [], [], [], [], [], ['Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG'], []]);
    expect(sections[0]?.reserved).toEqual([{ id: seedFieldAt('G').id, letter: 'G', label: 'Treatment / Color' }]);
    const offered = sections.flatMap((section) => section.fields.map((field) => field.letter));
    for (const letter of ['G', 'Z', 'AA', 'AG']) expect(offered).not.toContain(letter);
  });

  it('AC-6: a placeholder is something no save may name, and the picture (C) is neither a field nor a placeholder', () => {
    for (const letter of ['G', 'Z', 'AG', 'C']) expect(formFieldById(seedConfig, seedFieldAt(letter).id), letter).toBeUndefined();
    expect(sections.flatMap((section) => section.reserved.map((field) => field.letter))).not.toContain('C');
  });

  it('keeps a placeholder for a field that is flagged hidden from the Engineer out of the answer altogether', () => {
    const hidden = cloneSeedConfig();
    const treatment = hidden.fields.find((field) => field.key === 'treatment-color');
    if (treatment === undefined) throw new Error('The seed has no Treatment / Color.');
    (treatment as { engineerVisible: boolean }).engineerVisible = false;
    expect(buildFormSections(hidden)[0]?.reserved).toEqual([]);
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
    expect(byLetter('J')?.rule).toEqual({ type: 'number', decimals: 2 });
    expect(byLetter('H')?.rule).toEqual({ type: 'number', decimals: 2 });
    expect(byLetter('B')?.rule).toEqual({ type: 'text', maxLength: MAX_PART_TEXT_LENGTH, multiline: false });
    expect(byLetter('E')?.rule).toEqual({ type: 'select', source: 'materials' });
    expect(byLetter('N')?.unit).toBe('kg');
  });

  it('AC-1: every number of the new sections has the number rule (0 or more, 2 decimals), and the units of the registry are kept (P in sec)', () => {
    for (const letter of ['P', 'Q', 'R', 'T', 'U', 'V', 'W', 'X', 'Y', 'AP', 'AU', 'BM']) expect(byLetter(letter)?.rule, letter).toEqual({ type: 'number', decimals: 2 });
    expect(byLetter('P')?.unit).toBe('sec');
    for (const letter of ['Q', 'R', 'T', 'V', 'W', 'X', 'Y']) expect(byLetter(letter)?.unit, letter).toBeNull();
  });

  it('AC-1, AC-4, A-1: Fasteners (S) is a text of 200 characters and Remarks (AJ) a multi-line text of 1,000', () => {
    expect(byLetter('S')?.rule).toEqual({ type: 'text', maxLength: MAX_PART_TEXT_LENGTH, multiline: false });
    expect(byLetter('AJ')?.rule).toEqual({ type: 'text', maxLength: MAX_LONG_TEXT_LENGTH, multiline: true });
    expect(MAX_LONG_TEXT_LENGTH).toBe(1000);
  });

  it('every field is needed to Calculate except that nothing here refuses a blank while saving', () => {
    for (const letter of ['P', 'S', 'U', 'AJ', 'AP', 'BM']) expect(byLetter(letter)?.required, letter).toBe(true);
    expect(byLetter('F')?.required).toBe(false);
  });
});

describe('AC-2, AC-3, AC-4 (STORY-05.04): the units, hints and the default that the form adds', () => {
  const COST_HINT = 'Enter 0 if there is none.';

  it('AC-2: the four cost-typed inputs (U, AP, AU, BM) have the rupee add-on and the hint "Enter 0 if there is none."', () => {
    for (const letter of ['U', 'AP', 'AU', 'BM']) {
      expect(byLetter(letter)?.unit, letter).toBe('₹');
      expect(byLetter(letter)?.hint, letter).toBe(COST_HINT);
    }
    expect(COST_HINT).toBe('Enter 0 if there is none.');
  });

  it('AC-3: Fasteners (S) has the default "None" and the hint "Type "None" if the part has no fasteners."; T and U are plain number inputs', () => {
    expect(byLetter('S')?.defaultValue).toBe('None');
    expect(byLetter('S')?.hint).toBe('Type "None" if the part has no fasteners.');
    expect(byLetter('T')).toMatchObject({ hint: null, unit: null, rule: { type: 'number' } });
  });

  it('AC-4: Remarks (AJ) has the hint "Write "None" if there is nothing to add."', () => {
    expect(byLetter('AJ')?.hint).toBe('Write "None" if there is nothing to add.');
  });

  it('every other field has no default: a blank stays a blank (only S has one in the registry)', () => {
    const withDefault = sections.flatMap((section) => section.fields).filter((field) => field.defaultValue !== null);
    expect(withDefault.map((field) => field.letter)).toEqual(['S']);
  });

  it('is found by the field\'s key and not its letter or its text, so a renamed label or a moved column keeps its hint and add-on', () => {
    const renamed = cloneSeedConfig();
    const tool = renamed.fields.find((field) => field.key === 'tool-cost');
    if (tool === undefined) throw new Error('The seed has no Tool Cost.');
    tool.label = 'Invented outlay';
    tool.position += 100;
    const found = buildFormSections(renamed)
      .flatMap((section) => section.fields)
      .find((field) => field.id === tool.id);
    expect(found).toMatchObject({ label: 'Invented outlay', unit: '₹', hint: COST_HINT });
  });

  it('keeps the hint and the unit the registry itself holds, which the form only falls back on', () => {
    const edited = cloneSeedConfig();
    const machining = edited.fields.find((field) => field.key === 'machining-cost');
    if (machining?.kind !== 'input') throw new Error('The seed has no Machining Cost input.');
    machining.hint = 'Invented hint';
    machining.unit = 'Invented unit';
    const found = buildFormSections(edited)
      .flatMap((section) => section.fields)
      .find((field) => field.id === machining.id);
    expect(found).toMatchObject({ hint: 'Invented hint', unit: 'Invented unit' });
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
    // The calculated twins of the typed costs (Material Cost, Cutting Cost, Total Process Cost ... AK to AY, and every later column) are on no section.
    for (const letter of ['AK', 'AL', 'AM', 'AN', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BG', 'BL', 'BN', 'BO']) {
      expect(offered.map((field) => field.letter), letter).not.toContain(letter);
    }
  });

  it('is built from keys, ids, letters, labels, units, hints and rules: no formula text, no rate name, no figure; the typed costs are named by their labels only', () => {
    const text = JSON.stringify(sections);
    expect(Object.keys(sections[0] ?? {}).sort()).toEqual(['columnRange', 'fields', 'id', 'name', 'number', 'reserved', 'shortName']);
    for (const field of offered) {
      expect(Object.keys(field).sort()).toEqual(['defaultValue', 'editable', 'hint', 'id', 'kind', 'label', 'letter', 'required', 'rule', 'unit']);
    }
    for (const placeholder of sections.flatMap((section) => section.reserved)) expect(Object.keys(placeholder).sort()).toEqual(['id', 'label', 'letter']);
    // The word "cost" is in the four labels of inputs an Engineer types (FR-008), and nowhere else; no formula, no price, no rate.
    expect(withoutTypedCostLabels(text)).not.toMatch(/\{\{|formula|price|cost|rate/i);
    expect(offered.filter((field) => /cost/i.test(field.label)).map((field) => field.label)).toEqual(['Fasteners Cost', 'Machining Cost', 'Plating Cost', 'Tool Cost']);
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
    for (const letter of ['B', 'D', 'H', 'E', 'J', 'K', 'L', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'AJ', 'AP', 'AU', 'BM']) {
      expect(formFieldById(seedConfig, savable(letter).id)?.editable, letter).toBe(true);
    }
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
    ['Hot Dip Galvanizing (Z), a surface treatment of story 05.06', () => seedFieldAt('Z').id],
    ['Machining Cost\'s calculated twin, Total Process Cost (AY)', () => seedFieldAt('AY').id],
    ['Approved Quote Price (BO)', () => seedFieldAt('BO').id],
    ['an ID the registry does not have', () => '00000000-0000-4000-8000-0000deadbeef'],
  ])('does not find %s', (_name, idOf) => {
    expect(formFieldById(seedConfig, idOf())).toBeUndefined();
  });

  it('names the keys of the material fields by their registry keys', () => {
    expect(seedConfig.fields.find((field) => field.key === MATERIAL_IN_DRAWING_KEY)).toBeDefined();
    expect(seedConfig.fields.find((field) => field.key === MATERIAL_CONSIDERED_KEY)).toBeDefined();
  });
});
