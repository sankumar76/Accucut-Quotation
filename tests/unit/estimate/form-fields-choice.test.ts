import { describe, expect, it } from 'vitest';

import { CHOOSE_LISTED_OPTION_MESSAGE, readChoiceInput } from '@/lib/estimate/choice-value';
import { createPartReader, validateForCalculate, type BlockedPart } from '@/lib/estimate/calculate-check';
import { buildFormSections, formFieldById } from '@/lib/estimate/form-fields';
import { readTyped } from '@/lib/estimates/form-values';
import type { ConfigDocument } from '@/lib/fields/schema';
import { FieldValidationError } from '@/lib/errors';
import { createEstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { choiceSectionVersion, CHOICE_LABEL, CHOICE_OPTIONS } from '../../support/choice-section-version';
import { completePartInputs, fieldIdOf, INVENTED_MATERIAL_ID } from '../../support/complete-part';
import { defined } from '../../support/defined';
import { inputsDependencies } from '../../support/estimate-inputs-deps';
import { createFakeEstimateWorld } from '../../support/fake-estimates';
import { seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-08.08 AC-1, AC-2, AC-3 (FR-074, FR-053, FR-055; A-1): a registry input of type `select` with `options` is drawn as a choice, saved as the **option's text** and checked on the server against the
 * registry's own list; a blank clears it; a mandatory choice with no value stops Calculate with the existing missing-input refusal, and a registry default that is one of the options counts. The words
 * are proposed (open question OQ-1). Over the real seed registry plus the insert of 08.03, in memory; the same chain against PostgreSQL is `tests/integration/estimates/choice-input.test.ts`. Every name is invented.
 */

const OWNER = '00000000-0000-4000-8000-0000000000a1';
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const NODE = '00000000-0000-4000-8000-0000000000b1';
const engineer: EstimateViewer = { id: OWNER, role: 'ENGINEER' };

const { document, fieldId } = choiceSectionVersion({ unit: 'grade', hint: 'Pick the grade on the drawing.' });
const choiceField = defined(formFieldById(document, fieldId));

describe('AC-1: a choice input is drawn from the registry', () => {
  it('is a choice rule with the options in their stored order and none the Admin did not give, with its letter, label, unit and hint', () => {
    expect(choiceField.rule).toEqual({ type: 'choice', options: [...CHOICE_OPTIONS] });
    expect(choiceField).toMatchObject({ label: CHOICE_LABEL, kind: 'input', unit: 'grade', hint: 'Pick the grade on the drawing.', editable: true, required: true, defaultValue: null });
    expect(choiceField.letter).toBe('AY');
  });

  it('leaves Material in Drawing and Treatment / Color as they were', () => {
    expect(defined(formFieldById(document, seedFieldAt('E').id)).rule).toEqual({ type: 'select', source: 'materials' });
    expect(defined(formFieldById(document, seedFieldAt('G').id)).rule).toMatchObject({ type: 'treatment' });
  });

  it('is not drawn when the registry gave it no options, or when it is not visible to the Engineer', () => {
    const bare = { ...document, fields: document.fields.map((field) => (field.id === fieldId && field.kind === 'input' ? { ...field, options: null } : field)) };
    expect(formFieldById(bare, fieldId)).toBeUndefined();
    const hidden = { ...document, fields: document.fields.map((field) => (field.id === fieldId ? { ...field, engineerVisible: false } : field)) };
    expect(formFieldById(hidden, fieldId)).toBeUndefined();
  });

  it('is drawn with one option too', () => {
    const single = choiceSectionVersion({ choices: 'Only one' });
    expect(defined(formFieldById(single.document, single.fieldId)).rule).toEqual({ type: 'choice', options: ['Only one'] });
  });
});

describe('AC-2: one typed choice is read by the registry list, in the browser and on the server', () => {
  const options = [...CHOICE_OPTIONS];

  it('stores the text of the option for an exact match, after trimming', () => {
    expect(readChoiceInput('Fine', options)).toEqual({ ok: true, value: 'Fine' });
    expect(readChoiceInput('  Mirror  ', options)).toEqual({ ok: true, value: 'Mirror' });
  });

  it('refuses a value that is none of the options, and a different letter case', () => {
    expect(readChoiceInput('Smooth', options)).toEqual({ ok: false, message: CHOOSE_LISTED_OPTION_MESSAGE });
    expect(readChoiceInput('fine', options)).toEqual({ ok: false, message: 'Choose one of the listed options.' });
  });

  it('clears on a blank', () => {
    expect(readChoiceInput('   ', options)).toEqual({ ok: true, value: null });
  });

  it('keeps a held value that is no longer in the list, only when it is sent back unchanged', () => {
    expect(readChoiceInput('Retired', options, 'Retired')).toEqual({ ok: true, value: 'Retired' });
    expect(readChoiceInput('Retired', options, 'Other')).toMatchObject({ ok: false });
    expect(readChoiceInput('Retired', options, { id: 'Retired' })).toMatchObject({ ok: false });
  });

  it('is the same rule the browser reads a typed value by', () => {
    expect(readTyped(choiceField.rule, 'Coarse')).toEqual({ ok: true, value: 'Coarse' });
    expect(readTyped(choiceField.rule, 'Nope')).toEqual({ ok: false, message: 'Choose one of the listed options.' });
  });
});

describe('AC-2: the server saves a choice, and the browser list is not trusted', () => {
  function setUp(inputs: Record<string, unknown> = {}) {
    const world = createFakeEstimateWorld(
      () => [],
      [
        {
          id: ESTIMATE,
          code: 'Q-9999-0008',
          engineerId: OWNER,
          assignedByName: 'Invented Lead',
          folderPath: '\\\\invented\\share',
          deadlineAt: new Date('2099-01-01T00:00:00.000Z'),
          title: null,
          notes: null,
          status: 'DRAFT',
          customerId: null,
          inputsRevision: 1,
        },
      ],
      [{ id: NODE, estimateId: ESTIMATE, parentId: null, sortIndex: 0, revision: 1, inputs }],
    );
    const dependencies = { ...inputsDependencies(), currentConfiguration: () => Promise.resolve(document), configurationById: () => Promise.resolve(document) };
    const service = createEstimateService({ estimates: world.repository, nodes: world.nodeRepository, images: world.imageRepository, transactions: world.transactions, ...dependencies });
    const node = () => defined(world.nodes[0]);
    const save = (values: Record<string, string>) => service.saveInputs(engineer, ESTIMATE, { nodeId: NODE, revision: node().revision, values });
    return { service, node, save };
  }

  it('stores the option text for an option typed with spaces around it, and sends it back', async () => {
    const { save, node } = setUp();
    const saved = await save({ [fieldId]: '  Fine ' });
    expect(node().inputs).toEqual({ [fieldId]: 'Fine' });
    expect(saved.inputs).toEqual({ [fieldId]: 'Fine' });
  });

  it('refuses a value that is not an option with 422 on that field, stores nothing and raises no revision', async () => {
    const { save, node } = setUp();
    const failure = await save({ [fieldId]: 'Smooth' }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(FieldValidationError);
    expect((failure as FieldValidationError).fields).toEqual([{ field: fieldId, message: 'Choose one of the listed options.' }]);
    expect(node().inputs).toEqual({});
    expect(node().revision).toBe(1);
  });

  it('refuses a different letter case', async () => {
    const { save } = setUp();
    await expect(save({ [fieldId]: 'fine' })).rejects.toBeInstanceOf(FieldValidationError);
  });

  it('clears the value on a blank, and a draft saves with the field blank', async () => {
    const { save, node } = setUp({ [fieldId]: 'Fine' });
    const saved = await save({ [fieldId]: '' });
    expect(node().inputs).toEqual({});
    expect(saved.completeness).toBe('EMPTY');
  });

  it('keeps a stored value that is no longer in the list when it is sent back unchanged, and refuses it chosen afresh', async () => {
    const { save, node } = setUp({ [fieldId]: 'Retired' });
    await save({ [fieldId]: 'Retired' });
    expect(node().inputs).toEqual({ [fieldId]: 'Retired' });
    const { save: saveAfresh } = setUp({ [fieldId]: 'Retired' });
    await expect(saveAfresh({ [fieldId]: 'Gone' })).rejects.toBeInstanceOf(FieldValidationError);
  });

  it('answers the form for any caller with the choice rule and its options, and nothing else of the field', async () => {
    const { service } = setUp();
    const form = await service.getForm(engineer, ESTIMATE);
    const drawn = form.sections.flatMap((section) => section.fields).find((field) => field.id === fieldId);
    expect(drawn?.rule).toEqual({ type: 'choice', options: [...CHOICE_OPTIONS] });
  });
});

describe('AC-3: Calculate and the completeness read a choice by the one rule', () => {
  const part = (inputs: Readonly<Record<string, unknown>>) => ({ id: NODE, slNo: '1', inputs });
  const filled = { ...completePartInputs(document), [fieldId]: 'Fine' };
  const without = (inputs: Readonly<Record<string, unknown>>, id: string) => Object.fromEntries(Object.entries(inputs).filter(([key]) => key !== id));

  function blocked(check: ReturnType<typeof validateForCalculate>): ReadonlyArray<BlockedPart> {
    if (check.ok) throw new Error('The check passed, and the test expected it to block.');
    return check.parts;
  }

  it('blocks a Draft whose mandatory choice holds no value, naming the part and the field, and passes with a value', () => {
    expect(blocked(validateForCalculate([part(without(filled, fieldId))], document))).toEqual([expect.objectContaining({ nodeId: NODE, slNo: '1', fields: [{ fieldId, label: CHOICE_LABEL }] })]);
    const passed = validateForCalculate([part(filled)], document);
    expect(passed.ok).toBe(true);
    // The chosen text goes to the calculation, so it is stored with the row and exported in the new field's column.
    if (passed.ok) expect(passed.parts[0]?.texts[fieldId]).toBe('Fine');
  });

  it('counts a registry default that is one of the options, and does not count one that is not', () => {
    const withDefault = (defaultValue: string): ConfigDocument => ({ ...document, fields: document.fields.map((field) => (field.id === fieldId && field.kind === 'input' ? { ...field, defaultValue } : field)) });
    const noValue = without(filled, fieldId);
    const goodDefault = validateForCalculate([part(noValue)], withDefault('Mirror'));
    expect(goodDefault.ok).toBe(true);
    if (goodDefault.ok) expect(goodDefault.parts[0]?.texts[fieldId]).toBe('Mirror');
    expect(blocked(validateForCalculate([part(noValue)], withDefault('Not an option')))).toHaveLength(1);
  });

  it('is the same count the form and the tree use: the part reader names the field as missing, and it is on the form', () => {
    const reader = createPartReader(document);
    expect(reader.fieldIds).toContain(fieldId);
    expect(reader.read(without(filled, fieldId)).missing).toContainEqual({ fieldId, label: CHOICE_LABEL });
    expect(reader.read(filled).missing).toEqual([]);
    expect(buildFormSections(document).flatMap((section) => section.fields.map((field) => field.id))).toContain(fieldId);
    // The seed part is complete without the new field only on the seed registry; the new mandatory input is the one thing missing here.
    expect(fieldIdOf('material-in-drawing', document)).toBeDefined();
    expect(filled[fieldIdOf('material-in-drawing', document)]).toBe(INVENTED_MATERIAL_ID);
  });
});

describe('the seed registry is unchanged by the new rule', () => {
  it('has no choice field, and every section of the form is one of the eight', () => {
    expect(buildFormSections(seedConfig).flatMap((section) => section.fields).some((field) => field.rule.type === 'choice')).toBe(false);
    expect(buildFormSections(seedConfig).map((section) => section.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
