import { describe, expect, it } from 'vitest';

import { buildFormSections } from '@/lib/estimate/form-fields';
import { encodeTreatment } from '@/lib/estimate/treatment-value';
import { NOT_APPLICABLE_NAME, NOT_APPLICABLE_TREATMENT_ID } from '@/lib/masters/system-entries';
import { validateForCalculate, type BlockedPart, type CalculateCheck, type PartToCheck } from '@/lib/estimate/calculate-check';
import type { ConfigDocument } from '@/lib/fields/schema';

import { completePartInputs, fieldIdOf, INVENTED_MATERIAL_ID, INVENTED_NUMBER, INVENTED_TEXT } from '../../support/complete-part';
import { seedConfig } from '../../support/seed-config';

/**
 * STORY-05.09 AC-1, AC-2, AC-3, AC-5 (FR-055; SPEC section 14.4; architecture sections 4.2 and 4.5): the pure check that every part is complete before Calculate. A part is complete when
 * every field of the form that a person types and Calculate needs shows a value, with a value that its own rule accepts. A field the registry hides for the part (Fasteners Qty and Cost
 * while Fasteners is "None" or blank) is not needed and is read as 0; Part Model (C) is never needed; zero is a value. The check names each part with its Sl. No and name, and each
 * missing field by its ID and label, and nothing else.
 */

const document: ConfigDocument = seedConfig;

const part = (overrides: Partial<PartToCheck> = {}): PartToCheck => ({ id: '00000000-0000-4000-8000-0000000000b1', slNo: '1', inputs: completePartInputs(), ...overrides });
const without = (inputs: Readonly<Record<string, unknown>>, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(inputs).filter(([fieldId]) => fieldId !== fieldIdOf(key)));

function blocked(check: CalculateCheck): ReadonlyArray<BlockedPart> {
  if (check.ok) throw new Error('The check passed, and the test expected it to block.');
  return check.parts;
}

function passed(check: CalculateCheck) {
  if (!check.ok) throw new Error(`The check blocked, and the test expected it to pass: ${JSON.stringify(check.parts)}`);
  return check.parts;
}

/** The labels of the fields the form needs for Calculate, in the form's order. */
const REQUIRED = buildFormSections(document).flatMap((section) => section.fields.filter((field) => field.editable && field.required));

/** The fields that are needed whatever else is typed: no default to fall back on, and no rule that hides them. */
const ALWAYS_NEEDED = REQUIRED.filter((field) => field.defaultValue === null && !isHidable(field.id));

function isHidable(fieldId: string): boolean {
  const found = document.fields.find((candidate) => candidate.id === fieldId);
  return found?.kind === 'input' && found.visibleWhen !== null;
}

/** The same registry with one input's default replaced, as an Admin's later version could hold. */
function withDefault(key: string, defaultValue: string | null): ConfigDocument {
  return { ...document, fields: document.fields.map((field) => (field.key === key && field.kind === 'input' ? { ...field, defaultValue } : field)) };
}

describe('AC-2: a complete part passes', () => {
  it('a part with every needed input passes, with its material and its typed numbers and words', () => {
    const [checked] = passed(validateForCalculate([part()], document));
    expect(checked).toBeDefined();
    expect(checked?.id).toBe('00000000-0000-4000-8000-0000000000b1');
    expect(checked?.slNo).toBe('1');
    expect(checked?.materialId).toBe(INVENTED_MATERIAL_ID);
    expect(checked?.numbers[fieldIdOf('length')]).toBe(INVENTED_NUMBER);
    expect(checked?.texts[fieldIdOf('part-no')]).toBe(INVENTED_TEXT);
  });

  it('Material in Drawing is the part\'s material and is not one of its numbers or words (the calculation reads the material from the Material Master)', () => {
    const [checked] = passed(validateForCalculate([part()], document));
    expect(Object.keys(checked?.numbers ?? {})).not.toContain(fieldIdOf('material-in-drawing'));
    expect(Object.keys(checked?.texts ?? {})).not.toContain(fieldIdOf('material-in-drawing'));
  });

  it('Part Model (C, the picture of STORY-05.07) is on the form and is never needed: a part with none passes, and a value stored under it is neither a number nor a word of the part', () => {
    const picture = fieldIdOf('part-model');
    expect(buildFormSections(document).flatMap((section) => section.fields).find((field) => field.id === picture)?.rule).toEqual({ type: 'picture' });
    const [checked] = passed(validateForCalculate([part({ inputs: { ...completePartInputs(), [picture]: 'invented-stray-text' } })], document));
    expect(Object.keys(checked?.numbers ?? {})).not.toContain(picture);
    expect(Object.keys(checked?.texts ?? {})).not.toContain(picture);
    expect(passed(validateForCalculate([part()], document))).toHaveLength(1);
  });

  it('the stored material ID is read as the form reads it: trimmed and in lower case', () => {
    const inputs = { ...completePartInputs(), [fieldIdOf('material-in-drawing')]: `  ${INVENTED_MATERIAL_ID.toUpperCase()} ` };
    expect(passed(validateForCalculate([part({ inputs })], document))[0]?.materialId).toBe(INVENTED_MATERIAL_ID);
  });

  it('no part at all passes with nothing to calculate (the service refuses an estimate with no part before it asks)', () => {
    expect(passed(validateForCalculate([], document))).toEqual([]);
  });

  it('the registry\'s typed text, the default of Fasteners ("None") among them, is carried as the words the part used', () => {
    const [checked] = passed(validateForCalculate([part()], document));
    expect(checked?.texts[fieldIdOf('fasteners')]).toBe('None');
    expect(checked?.texts[fieldIdOf('remarks')]).toBe(INVENTED_TEXT);
  });
});

describe('AC-1: a blank in any needed input blocks, and names the part and the field', () => {
  it.each(ALWAYS_NEEDED.map((field) => [field.label, field.id] as const))('blank %s blocks and is the one field named', (label, fieldId) => {
    const inputs = Object.fromEntries(Object.entries(completePartInputs()).filter(([id]) => id !== fieldId));
    expect(blocked(validateForCalculate([part({ inputs })], document))).toEqual([
      { nodeId: '00000000-0000-4000-8000-0000000000b1', slNo: '1', name: INVENTED_TEXT, fields: [{ fieldId, label }] },
    ]);
  });

  it('a part with nothing typed lists every needed field, in the order of the form, Treatment / Color among them, and not Fasteners Qty and Cost (hidden), Part Model or the flags', () => {
    const [only] = blocked(validateForCalculate([part({ inputs: {} })], document));
    const labels = only?.fields.map((field) => field.label) ?? [];
    expect(labels).toEqual(ALWAYS_NEEDED.map((field) => field.label));
    expect(labels).toContain('Treatment / Color');
    expect(labels).not.toContain('Fasteners Qty');
    expect(labels).not.toContain('Fasteners Cost');
    expect(labels).not.toContain('Part Model');
    expect(labels).not.toContain('Primer');
  });

  it.each([[''], ['   '], ['abc'], ['-1'], ['1.234'], ['1e3']])('a number stored as %j is not trusted and counts as blank', (stored) => {
    const inputs = { ...completePartInputs(), [fieldIdOf('length')]: stored };
    expect(blocked(validateForCalculate([part({ inputs })], document))[0]?.fields.map((field) => field.label)).toEqual(['Length']);
  });

  it.each([[5], [null], [{ id: 'x' }], [['a']], [true]])('a value that is not text (%j) counts as blank', (stored) => {
    const inputs = { ...completePartInputs(), [fieldIdOf('width')]: stored };
    expect(blocked(validateForCalculate([part({ inputs })], document))[0]?.fields.map((field) => field.label)).toEqual(['Width']);
  });

  it('a text that is only spaces, or longer than its field allows, counts as blank', () => {
    const spaces = { ...completePartInputs(), [fieldIdOf('description')]: '   ' };
    const long = { ...completePartInputs(), [fieldIdOf('remarks')]: 'x'.repeat(1001) };
    expect(blocked(validateForCalculate([part({ inputs: spaces })], document))[0]?.fields.map((field) => field.label)).toEqual(['Description']);
    expect(blocked(validateForCalculate([part({ inputs: long })], document))[0]?.fields.map((field) => field.label)).toEqual(['Remarks']);
  });

  it('only the parts with a blank are listed, in the order given, each with its own Sl. No and name', () => {
    const complete = completePartInputs();
    const parts: PartToCheck[] = [
      part({ id: '00000000-0000-4000-8000-0000000000c1', slNo: '1' }),
      part({ id: '00000000-0000-4000-8000-0000000000c2', slNo: '1.1', inputs: without(complete, 'cutting-time') }),
      part({ id: '00000000-0000-4000-8000-0000000000c3', slNo: '1.1.1' }),
      part({ id: '00000000-0000-4000-8000-0000000000c4', slNo: '2', inputs: without(without(complete, 'bend-count'), 'weld') }),
    ];
    const result = blocked(validateForCalculate(parts, document));
    expect(result.map((entry) => [entry.slNo, entry.fields.map((field) => field.label)])).toEqual([
      ['1.1', ['Cutting Time']],
      ['2', ['No. of Bend', 'Weld']],
    ]);
  });

  it('the name is the Description, or the Part No. while there is none, or null', () => {
    const complete = completePartInputs();
    const noDescription = { ...without(complete, 'description'), [fieldIdOf('length')]: '' };
    const neither = { ...without(without(complete, 'description'), 'part-no'), [fieldIdOf('length')]: '' };
    const named = { ...complete, [fieldIdOf('description')]: 'Invented lid', [fieldIdOf('length')]: '' };
    expect(blocked(validateForCalculate([part({ inputs: named })], document))[0]?.name).toBe('Invented lid');
    expect(blocked(validateForCalculate([part({ inputs: noDescription })], document))[0]?.name).toBe(INVENTED_TEXT);
    expect(blocked(validateForCalculate([part({ inputs: neither })], document))[0]?.name).toBeNull();
  });

  it('what is named holds no number from any calculation: an ID, a Sl. No, a name and labels of fields only', () => {
    const [only] = blocked(validateForCalculate([part({ inputs: {} })], document));
    expect(Object.keys(only ?? {}).sort()).toEqual(['fields', 'name', 'nodeId', 'slNo']);
    for (const field of only?.fields ?? []) expect(Object.keys(field).sort()).toEqual(['fieldId', 'label']);
  });
});

describe('AC-1: the fields the registry hides, and the ones never needed', () => {
  const fasteners = fieldIdOf('fasteners');
  const quantity = fieldIdOf('fasteners-qty');
  const cost = fieldIdOf('fasteners-cost');

  it.each([[undefined], ['None'], [''], ['   ']])('Fasteners %j leaves Fasteners Qty and Cost hidden: not needed, and read as 0', (stored) => {
    const inputs = stored === undefined ? completePartInputs() : { ...completePartInputs(), [fasteners]: stored };
    const [checked] = passed(validateForCalculate([part({ inputs })], document));
    expect(checked?.numbers[quantity]).toBe('0.00');
    expect(checked?.numbers[cost]).toBe('0.00');
  });

  it('a Qty and a Cost typed before Fasteners became "None" are not used: they are read as 0 (SPEC section 14.4)', () => {
    const inputs = { ...completePartInputs(), [quantity]: '5.00', [cost]: '100.00' };
    const [checked] = passed(validateForCalculate([part({ inputs })], document));
    expect(checked?.numbers[quantity]).toBe('0.00');
    expect(checked?.numbers[cost]).toBe('0.00');
  });

  it('Fasteners that is anything else shows Qty and Cost: both are needed, and a value typed is kept', () => {
    const base = { ...completePartInputs(), [fasteners]: 'Invented bolts' };
    expect(blocked(validateForCalculate([part({ inputs: base })], document))[0]?.fields.map((field) => field.label)).toEqual(['Fasteners Qty', 'Fasteners Cost']);
    const typed = { ...base, [quantity]: '4.00', [cost]: '2.50' };
    const [checked] = passed(validateForCalculate([part({ inputs: typed })], document));
    expect(checked?.numbers[quantity]).toBe('4.00');
    expect(checked?.numbers[cost]).toBe('2.50');
  });

  it('Part Model (C) is never needed, with no picture or with any stored value', () => {
    const inputs = { ...completePartInputs(), [fieldIdOf('part-model')]: 'something' };
    expect(passed(validateForCalculate([part({ inputs })], document))).toHaveLength(1);
    expect(passed(validateForCalculate([part()], document))).toHaveLength(1);
  });

  it('STORY-05.06: Treatment / Color (G) is needed, and its words as the part holds them are carried: "Other" with typed words, a listed entry, and "Not applicable"', () => {
    const treatment = fieldIdOf('treatment-color');
    const without = Object.fromEntries(Object.entries(completePartInputs()).filter(([fieldId]) => fieldId !== treatment));
    expect(blocked(validateForCalculate([part({ inputs: without })], document))[0]?.fields).toEqual([{ fieldId: treatment, label: 'Treatment / Color' }]);
    expect(passed(validateForCalculate([part()], document))[0]?.texts[treatment]).toBe(INVENTED_TEXT);
    for (const choice of [{ id: '00000000-0000-4000-8000-000700000c01', text: 'Invented powder coat' }, { id: NOT_APPLICABLE_TREATMENT_ID, text: NOT_APPLICABLE_NAME }]) {
      expect(passed(validateForCalculate([part({ inputs: { ...completePartInputs(), [treatment]: choice } })], document))[0]?.texts[treatment]).toBe(choice.text);
    }
  });

  it.each([
    ['a plain text', 'Invented powder coat'],
    ['the JSON text of a choice (the wire form is never what is stored)', encodeTreatment({ id: NOT_APPLICABLE_TREATMENT_ID, text: NOT_APPLICABLE_NAME })],
    ['an object with no words', { id: '00000000-0000-4000-8000-000700000c01' }],
    ['an object with blank words', { id: '00000000-0000-4000-8000-000700000c01', text: '   ' }],
    ['a list', ['x']],
    ['null', null],
  ])('Treatment / Color stored as %s is not a value: it is blank, so the part is blocked', (_name, stored) => {
    const treatment = fieldIdOf('treatment-color');
    expect(blocked(validateForCalculate([part({ inputs: { ...completePartInputs(), [treatment]: stored } })], document))[0]?.fields.map((field) => field.label)).toEqual(['Treatment / Color']);
  });

  it('a treatment flag is never needed: an absent one is 0 (its default), a stored one is carried as the number it is', () => {
    const flag = fieldIdOf('primer');
    expect(passed(validateForCalculate([part()], document))[0]?.numbers[flag]).toBe('0.00');
    const inputs = { ...completePartInputs(), [flag]: '1' };
    expect(passed(validateForCalculate([part({ inputs })], document))[0]?.numbers[flag]).toBe('1.00');
  });
});

describe('AC-3: zero is a value', () => {
  it('a 0 in every number field passes, QTY per Assy included (its own warning is STORY-05.12\'s)', () => {
    const zeros = Object.fromEntries(REQUIRED.filter((field) => field.rule.type === 'number').map((field) => [field.id, '0']));
    const inputs = { ...completePartInputs(), ...zeros };
    const [checked] = passed(validateForCalculate([part({ inputs })], document));
    for (const id of Object.keys(zeros)) expect(checked?.numbers[id]).toBe('0.00');
  });
});

describe('AC-5 (order): blank inputs are found whatever the quantity is', () => {
  it('a 0 in QTY per Assy with a blank beside it still blocks, naming the blank', () => {
    const inputs = { ...without(completePartInputs(), 'cutting-length'), [fieldIdOf('qty-per-assy')]: '0' };
    expect(blocked(validateForCalculate([part({ inputs })], document))[0]?.fields.map((field) => field.label)).toEqual(['Cutting Length']);
  });
});

describe('SQR-03 of STORY-05.04: a default is read through the field\'s rule, and is not trusted as valid', () => {
  it('a default that the rule accepts fills the field, in the form the rule stores it', () => {
    const defaulted = withDefault('length', '5');
    const inputs = without(completePartInputs(), 'length');
    const [checked] = passed(validateForCalculate([part({ inputs })], defaulted));
    expect(checked?.numbers[fieldIdOf('length')]).toBe('5.00');
  });

  it.each([['abc'], ['-3'], ['1.234'], ['']])('a default of %j that the rule refuses does not fill the field: it is blank, and the part is blocked', (defaultValue) => {
    const defaulted = withDefault('length', defaultValue);
    const inputs = without(completePartInputs(), 'length');
    expect(blocked(validateForCalculate([part({ inputs })], defaulted))[0]?.fields.map((field) => field.label)).toEqual(['Length']);
  });

  it('a stored value wins over the default, and a stored blank is the same as none (a blank clears)', () => {
    const defaulted = withDefault('length', '5');
    const typed = { ...completePartInputs(), [fieldIdOf('length')]: '7' };
    expect(passed(validateForCalculate([part({ inputs: typed })], defaulted))[0]?.numbers[fieldIdOf('length')]).toBe('7.00');
  });

  it('a text default longer than its field allows is not trusted either', () => {
    const defaulted = withDefault('description', 'x'.repeat(201));
    const inputs = without(completePartInputs(), 'description');
    expect(blocked(validateForCalculate([part({ inputs })], defaulted))[0]?.fields.map((field) => field.label)).toEqual(['Description']);
  });

  it('the Fasteners rule reads its default "None" through the same path: a default that is not "None" shows Qty and Cost', () => {
    const defaulted = withDefault('fasteners', 'Invented bolts');
    expect(blocked(validateForCalculate([part()], defaulted))[0]?.fields.map((field) => field.label)).toEqual(['Fasteners Qty', 'Fasteners Cost']);
  });
});

describe('a registry that differs from the seed: the check follows the registry and fails closed', () => {
  const without = (...keys: string[]): ConfigDocument => ({ ...document, fields: document.fields.filter((field) => !keys.includes(field.key)) });
  const changed = (key: string, change: { mandatory?: boolean; defaultValue?: string | null }): ConfigDocument => ({
    ...document,
    fields: document.fields.map((field) => (field.key === key && field.kind === 'input' ? { ...field, ...change } : field)),
  });

  it('a field the registry does not mark mandatory is not needed: blank, it does not block, and it is not in the numbers', () => {
    const optional = changed('length', { mandatory: false });
    const inputs = Object.fromEntries(Object.entries(completePartInputs()).filter(([id]) => id !== fieldIdOf('length')));
    const [checked] = passed(validateForCalculate([part({ inputs })], optional));
    expect(checked?.numbers[fieldIdOf('length')]).toBeUndefined();
  });

  it('SQR-04 of AQP-317: a blank Material in Drawing blocks and is named even when the registry does not mark it mandatory (the person has a field to go to)', () => {
    const optional = changed('material-in-drawing', { mandatory: false });
    const result = blocked(validateForCalculate([part({ inputs: Object.fromEntries(Object.entries(completePartInputs()).filter(([id]) => id !== fieldIdOf('material-in-drawing'))) })], optional));
    expect(result[0]?.fields).toEqual([{ fieldId: fieldIdOf('material-in-drawing'), label: 'Material in Drawing' }]);
  });

  it('SQR-04 of AQP-317: a blank Material in Drawing that the registry marks mandatory is named once, not twice', () => {
    const result = blocked(validateForCalculate([part({ inputs: Object.fromEntries(Object.entries(completePartInputs()).filter(([id]) => id !== fieldIdOf('material-in-drawing'))) })], document));
    expect(result[0]?.fields.filter((field) => field.fieldId === fieldIdOf('material-in-drawing'))).toHaveLength(1);
  });

  it('a registry with no Material in Drawing cannot be calculated: every part is blocked, naming nothing', () => {
    const noMaterial = without('material-in-drawing');
    expect(blocked(validateForCalculate([part()], noMaterial))).toEqual([{ nodeId: '00000000-0000-4000-8000-0000000000b1', slNo: '1', name: INVENTED_TEXT, fields: [] }]);
  });

  it('a registry with neither Part No. nor Description names its blocked parts with null', () => {
    const noNames = without('part-no', 'description');
    expect(blocked(validateForCalculate([part({ inputs: {} })], noNames))[0]?.name).toBeNull();
  });

  it('a flag with no default and nothing stored is left out (it is 0 to the calculation), and a flag stored with a value the rule refuses is not trusted and is left out too', () => {
    const noDefault = changed('primer', { defaultValue: null });
    expect(passed(validateForCalculate([part()], noDefault))[0]?.numbers[fieldIdOf('primer')]).toBeUndefined();
    const refused = { ...completePartInputs(), [fieldIdOf('primer')]: 'abc' };
    expect(passed(validateForCalculate([part({ inputs: refused })], document))[0]?.numbers[fieldIdOf('primer')]).toBeUndefined();
  });

  it('Fasteners with a default the rule refuses is blank, so Fasteners Qty and Cost stay hidden and the part is blocked only for Fasteners itself', () => {
    const refusedDefault = changed('fasteners', { defaultValue: 'x'.repeat(201) });
    expect(blocked(validateForCalculate([part()], refusedDefault))[0]?.fields.map((field) => field.label)).toEqual(['Fasteners']);
  });
});

describe('the check does not change what it is given', () => {
  it('the parts and their inputs are left as they were', () => {
    const inputs = { ...completePartInputs(), [fieldIdOf('fasteners-qty')]: '5.00' };
    const before = JSON.stringify(inputs);
    passed(validateForCalculate([part({ inputs })], document));
    expect(JSON.stringify(inputs)).toBe(before);
  });
});
