import { describe, expect, it } from 'vitest';

import { buildFormSections } from '@/lib/estimate/form-fields';
import { changedFields, REMOVED_MATERIAL_TEXT } from '@/lib/estimate/input-change';
import { OTHER_TREATMENT_ID } from '@/lib/masters/system-entries';

import { seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * DEF-131 stage 2 (architecture note lead-admin-input-edit-2026-11-27, section 3.4; ED-14): the fields a Lead's or an Admin's save changed, as the audit entry keeps them: the changed fields only, each with its
 * letter, its label and the display text before and after (a number as normalised text, a text as typed, a material by its name, a treatment by its words, a flag as Yes or No, a blank as null), and a field
 * that a rule zeroed in the same save counted too. No calculated value, rate or formula has a key to sit in (NFR-002, NFR-007). Every name and ID is invented.
 */

const LENGTH = seedFieldAt('J');
const WIDTH = seedFieldAt('K');
const PART_NO = seedFieldAt('B');
const MATERIAL = seedFieldAt('E');
const TREATMENT = seedFieldAt('G');
const FASTENERS_QTY = seedFieldAt('T');
const MATERIAL_ID = '11111111-1111-4111-8111-111111111111';
const GONE_ID = '22222222-2222-4222-8222-222222222222';
const NAMES = new Map([[MATERIAL_ID, 'Invented mild steel sheet']]);
const SURFACE = buildFormSections(seedConfig).flatMap((section) => section.fields).find((field) => field.rule.type === 'flag');

const diff = (before: Record<string, unknown>, after: Record<string, unknown>) => changedFields(seedConfig, before, after, NAMES);

describe('ED-14: the changed fields only', () => {
  it('lists the field that changed with its letter, its label and the value before and after, and not the one that did not', () => {
    const result = diff({ [LENGTH.id]: '450.00', [WIDTH.id]: '100.00' }, { [LENGTH.id]: '480.00', [WIDTH.id]: '100.00' });
    expect(result.before).toEqual([{ letter: 'J', label: LENGTH.label, value: '450.00' }]);
    expect(result.after).toEqual([{ letter: 'J', label: LENGTH.label, value: '480.00' }]);
  });

  it('keeps the two lists in step, field for field, in the form\'s order', () => {
    const result = diff({}, { [WIDTH.id]: '10.00', [LENGTH.id]: '20.00' });
    expect(result.before.map((field) => field.letter)).toEqual(['J', 'K']);
    expect(result.after.map((field) => field.letter)).toEqual(['J', 'K']);
  });

  it('says nothing when nothing differs, whatever the order of the keys', () => {
    expect(diff({ [LENGTH.id]: '450.00', [WIDTH.id]: '1.00' }, { [WIDTH.id]: '1.00', [LENGTH.id]: '450.00' })).toEqual({ before: [], after: [] });
  });

  it('shows a blank as null, before a value is typed and after it is cleared', () => {
    expect(diff({}, { [LENGTH.id]: '12.50' })).toEqual({ before: [{ letter: 'J', label: LENGTH.label, value: null }], after: [{ letter: 'J', label: LENGTH.label, value: '12.50' }] });
    expect(diff({ [LENGTH.id]: '12.50' }, {})).toEqual({ before: [{ letter: 'J', label: LENGTH.label, value: '12.50' }], after: [{ letter: 'J', label: LENGTH.label, value: null }] });
  });

  it('keeps a text as it was typed', () => {
    const result = diff({ [PART_NO.id]: 'XP-1101' }, { [PART_NO.id]: 'XP-2202' });
    expect(result.after).toEqual([{ letter: 'B', label: PART_NO.label, value: 'XP-2202' }]);
  });
});

describe('ED-14: values are shown as words, never as IDs', () => {
  it('shows a material by its name, and a material that is no longer listed as the words for one', () => {
    const named = diff({}, { [MATERIAL.id]: MATERIAL_ID });
    expect(named.after[0]?.value).toBe('Invented mild steel sheet');
    expect(JSON.stringify(named)).not.toContain(MATERIAL_ID);
    const gone = diff({ [MATERIAL.id]: GONE_ID }, {});
    expect(gone.before[0]?.value).toBe(REMOVED_MATERIAL_TEXT);
    expect(JSON.stringify(gone)).not.toContain(GONE_ID);
  });

  it('shows a treatment by its words and not by its ID', () => {
    const result = diff({}, { [TREATMENT.id]: { id: OTHER_TREATMENT_ID, text: 'Invented blue finish' } });
    expect(result.after[0]).toEqual({ letter: 'G', label: TREATMENT.label, value: 'Invented blue finish' });
    expect(JSON.stringify(result)).not.toContain(OTHER_TREATMENT_ID);
  });

  it('shows a flag as Yes or No', () => {
    expect(SURFACE).toBeDefined();
    const id = SURFACE?.id ?? '';
    expect(diff({ [id]: '0' }, { [id]: '1' })).toMatchObject({ before: [{ value: 'No' }], after: [{ value: 'Yes' }] });
  });

  it('counts a field that a rule zeroed in the same save, and shows the zero', () => {
    const result = diff({ [FASTENERS_QTY.id]: '4.00' }, { [FASTENERS_QTY.id]: '0.00' });
    expect(result.after).toEqual([{ letter: 'T', label: FASTENERS_QTY.label, value: '0.00' }]);
  });
});

describe('ED-14: nothing outside the form can be kept (NFR-002)', () => {
  it('reads only fields of the form that a person types: an unknown key and a derived field are not in the entry', () => {
    const rate = seedFieldAt('I');
    const result = diff({ ['not-a-field']: 'x', [rate.id]: '99.00' }, { ['not-a-field']: 'y', [rate.id]: '100.00' });
    expect(result).toEqual({ before: [], after: [] });
  });

  it('gives each field exactly three keys: the letter, the label and the value', () => {
    const result = diff({}, { [LENGTH.id]: '1.00' });
    expect(Object.keys(result.after[0] ?? {}).sort()).toEqual(['label', 'letter', 'value']);
  });

  it('cuts a very long text so that the entry is always accepted, and never reads past the limit', () => {
    const long = 'a'.repeat(5_000);
    const result = diff({}, { [PART_NO.id]: long });
    expect((result.after[0]?.value ?? '').length).toBeLessThanOrEqual(2_000);
  });
});
