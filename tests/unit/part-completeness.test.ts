import { describe, expect, it } from 'vitest';

import { createCompletenessReader } from '@/lib/estimate/part-completeness';
import { buildFormSections } from '@/lib/estimate/form-fields';
import type { ConfigDocument } from '@/lib/fields/schema';

import { completePartInputs, fieldIdOf, INVENTED_NUMBER } from '../support/complete-part';
import { seedConfig } from '../support/seed-config';

/**
 * STORY-05.11 AC-2 (and the rule behind AC-1, AC-3): the completeness of one part by the rule of Calculate, over the seed registry. `COMPLETE` is every needed, visible field showing a value; `EMPTY`
 * is nothing typed; `PARTIAL` is the rest. 0 is a value, a hidden field is not needed, a default that is shown and not stored is nothing typed, and the picture is never read.
 */

const document: ConfigDocument = seedConfig;
const completenessOf = createCompletenessReader(document);

const without = (inputs: Readonly<Record<string, unknown>>, ...keys: string[]): Record<string, unknown> => {
  const dropped = new Set(keys.map((key) => fieldIdOf(key)));
  return Object.fromEntries(Object.entries(inputs).filter(([fieldId]) => !dropped.has(fieldId)));
};

/** The fields that are needed whatever else is typed: no default to fall back on, and no rule that hides them (Fasteners Qty and Cost). */
const REQUIRED = buildFormSections(document).flatMap((section) => section.fields.filter((field) => field.editable && field.required && field.defaultValue === null && !field.visibleWhen));

describe('AC-2: the three words', () => {
  it('a part with nothing stored is EMPTY', () => {
    expect(completenessOf({})).toBe('EMPTY');
  });

  it('a part with every needed input is COMPLETE', () => {
    expect(completenessOf(completePartInputs())).toBe('COMPLETE');
  });

  it('a part with some inputs is PARTIAL', () => {
    expect(completenessOf({ [fieldIdOf('part-no')]: 'Invented text' })).toBe('PARTIAL');
  });

  it('a complete part with one needed input taken away is PARTIAL, for every needed input of the form (no answer says PARTIAL for a complete part, and none says COMPLETE for one that lacks a field)', () => {
    expect(REQUIRED.length).toBeGreaterThan(5);
    for (const field of REQUIRED) {
      const inputs = Object.fromEntries(Object.entries(completePartInputs()).filter(([fieldId]) => fieldId !== field.id));
      expect(completenessOf(inputs), field.label).toBe('PARTIAL');
    }
  });

  it('a stored value that is only spaces is not a value: the part is not complete', () => {
    expect(completenessOf({ ...completePartInputs(), [fieldIdOf('part-no')]: '   ' })).toBe('PARTIAL');
  });

  it('the picture is not read: a part with every input and no picture is COMPLETE (Part Model is optional, D-31), and a value under Part Model changes nothing', () => {
    const inputs = completePartInputs();
    expect(Object.keys(inputs)).not.toContain(fieldIdOf('part-model'));
    expect(completenessOf(inputs)).toBe('COMPLETE');
    expect(completenessOf({ ...inputs, [fieldIdOf('part-model')]: 'anything' })).toBe('COMPLETE');
    expect(completenessOf({ [fieldIdOf('part-model')]: 'anything' })).toBe('EMPTY');
  });
});

describe('0 is a value, a default is not stored', () => {
  it('a part whose numbers are all 0 is PARTIAL while its words and material are missing, and COMPLETE when they are there', () => {
    const zeros = Object.fromEntries(REQUIRED.filter((field) => field.rule.type === 'number').map((field) => [field.id, '0']));
    expect(Object.keys(zeros).length).toBeGreaterThan(0);
    expect(completenessOf(zeros)).toBe('PARTIAL');
    const complete = completePartInputs();
    expect(completenessOf({ ...complete, ...zeros })).toBe('COMPLETE');
  });

  it('a part holding nothing but the default of a field (Fasteners "None" is shown, never stored) is EMPTY', () => {
    expect(completenessOf({})).toBe('EMPTY');
    expect(completenessOf({ [fieldIdOf('fasteners')]: 'None' })).toBe('PARTIAL');
  });
});

describe('a hidden field is not needed', () => {
  it('Fasteners "None" hides Qty and Cost: the part is COMPLETE without them, with them, and with stored zeros', () => {
    const base = { ...completePartInputs(), [fieldIdOf('fasteners')]: 'None' };
    expect(completenessOf(base)).toBe('COMPLETE');
    expect(completenessOf({ ...base, [fieldIdOf('fasteners-qty')]: '5.00' })).toBe('COMPLETE');
    expect(completenessOf({ ...base, [fieldIdOf('fasteners-qty')]: '0', [fieldIdOf('fasteners-cost')]: '0' })).toBe('COMPLETE');
  });

  it('a blank Fasteners hides them too, as the form does', () => {
    expect(completenessOf(without(completePartInputs(), 'fasteners-qty', 'fasteners-cost'))).toBe('COMPLETE');
  });

  it('another word in Fasteners shows Qty and Cost, and a part that lacks them is PARTIAL until both are there', () => {
    const base = { ...completePartInputs(), [fieldIdOf('fasteners')]: 'Invented bolts' };
    expect(completenessOf(base)).toBe('PARTIAL');
    expect(completenessOf({ ...base, [fieldIdOf('fasteners-qty')]: INVENTED_NUMBER })).toBe('PARTIAL');
    expect(completenessOf({ ...base, [fieldIdOf('fasteners-qty')]: INVENTED_NUMBER, [fieldIdOf('fasteners-cost')]: '0' })).toBe('COMPLETE');
  });
});

describe('the registry as it is now', () => {
  it('a field added to the form later counts with no edit here: a new needed input makes a complete part PARTIAL', () => {
    const remarks = document.fields.find((field) => field.kind === 'input' && field.key === 'remarks');
    expect(remarks).toBeDefined();
    const newId = '00000000-0000-4000-8000-0000000000f1';
    const wider: ConfigDocument = { ...document, fields: [...document.fields, ...(remarks === undefined ? [] : [{ ...remarks, id: newId, key: 'invented-note', label: 'Invented note', formOrder: 99 }])] };
    const complete = completePartInputs();
    expect(completenessOf(complete)).toBe('COMPLETE');
    expect(createCompletenessReader(wider)(complete)).toBe('PARTIAL');
    expect(createCompletenessReader(wider)({ ...complete, [newId]: 'Invented text' })).toBe('COMPLETE');
  });

  it('a registry with no Material in Drawing cannot be complete (Calculate refuses every part), so no part is COMPLETE', () => {
    const noMaterial: ConfigDocument = { ...document, fields: document.fields.filter((field) => field.key !== 'material-in-drawing') };
    expect(createCompletenessReader(noMaterial)(completePartInputs())).not.toBe('COMPLETE');
  });
});
