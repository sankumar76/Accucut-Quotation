import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StepDetails } from '@/components/features/config/insert-field-steps';
import type { InsertWizard } from '@/components/features/config/use-insert-wizard';
import type { InsertOptions } from '@/lib/config/insert-field-client';
import { applyInputPatch, buildSpec, fieldOrder, formatFor, initialForm, issueItems, NEW_SECTION_VALUE, type InsertForm } from '@/lib/config/insert-field-form';

/**
 * STORY-08.08 AC-6 (SCR-19 step 2) without a browser: "Choice from a list" shows "Choices, one per line"; "Section" offers the sections of the registry and "A new section" with its name and its short name; the
 * typed form becomes the body the server reads (a new section sends no section ID); the controls are in the order the error summary lists them and each error links to its control. The server decides every
 * rule and every sentence of a refusal (`tests/unit/config/field-insert-choice.test.ts`); the keyboard and axe are in `tests/e2e/insert-field.spec.ts`. Every name is invented.
 */

const OPTIONS: InsertOptions = {
  version: 9,
  columns: [{ id: 'c-a', letter: 'ZA', label: 'Invented Length', kind: 'input', watchable: true, hideable: true }],
  sections: [
    { id: 's-1', number: 1, name: 'Invented Section' },
    { id: 's-9', number: 9, name: 'Invented Ninth' },
  ],
  stages: [{ id: 'g-1', number: 3, name: 'Invented Stage', subHeadings: ['Invented Heading'] }],
  numberFormats: ['0.00', '#,##0.00', '@'],
};

const NOOP = (): void => undefined;

function wizardFor(form: InsertForm, errors: Readonly<Record<string, string>> = {}): InsertWizard {
  return {
    step: 2,
    form,
    errors,
    preview: null,
    busy: null,
    notice: null,
    saved: null,
    status: '',
    headingRequest: 0,
    setKind: NOOP,
    setAfter: NOOP,
    patchInput: NOOP,
    patchOutput: NOOP,
    patchCost: NOOP,
    next: NOOP,
    back: NOOP,
    showPreview: () => Promise.resolve(),
    save: () => Promise.resolve(),
  };
}

const opened = (): InsertForm => initialForm(OPTIONS, 'c-a');
const choiceForm = (patch: Partial<InsertForm['input']> = {}): InsertForm => {
  const base = opened();
  return { ...base, input: { ...base.input, dataType: 'select', numFmt: '@', ...patch } };
};
const render = (form: InsertForm, errors: Readonly<Record<string, string>> = {}): string => renderToStaticMarkup(createElement(StepDetails, { wizard: wizardFor(form, errors), options: OPTIONS }));

describe('the controls of a choice input and a new section', () => {
  it('shows "Choices, one per line" with its limits only for a choice from a list', () => {
    const html = render(choiceForm());
    expect(html).toContain('>Choices, one per line</label>');
    expect(html).toContain('From 1 to 50 choices, each up to 100 characters, none the same as another.');
    expect(html).toMatch(/<textarea[^>]*id="insert-input-choices"/);
    expect(render(opened())).not.toContain('Choices, one per line');
  });

  it('offers the sections of the registry, sections above 8 included, and "A new section"', () => {
    const html = render(opened());
    expect(html).toContain('01 Invented Section');
    expect(html).toContain('09 Invented Ninth');
    expect(html).toContain(`<option value="${NEW_SECTION_VALUE}">A new section</option>`);
  });

  it('draws the name and the short name of a new section only when "A new section" is chosen', () => {
    const html = render(choiceForm({ sectionId: NEW_SECTION_VALUE }));
    expect(html).toContain('>Name of the new section</label>');
    expect(html).toContain('>Short name on the section strip</label>');
    expect(html).toContain('The new section is added after the last one. Name up to 100 characters, short name up to 30.');
    expect(render(opened())).not.toContain('Name of the new section');
  });

  it('gives a refusal under the control it is about, linked by its id', () => {
    const html = render(choiceForm({ sectionId: NEW_SECTION_VALUE }), { 'input.choices': 'Enter at least one choice.', 'input.newSectionName': 'Enter a section name.' });
    expect(html).toContain('id="insert-input-choices-error"');
    expect(html).toContain('Enter at least one choice.');
    expect(html).toContain('id="insert-input-newSectionName-error"');
    expect(html).toContain('Enter a section name.');
  });

  it('turns the pair\'s "hide the line" off for a choice, as it does for a Text input', () => {
    const base = { ...opened(), kind: 'pair' as const };
    const html = render({ ...base, input: { ...base.input, dataType: 'select' }, cost: { ...base.cost, hideWhenInputIsZero: false } });
    expect(html).toMatch(/disabled=""[^>]*id="insert-cost-hideWhenInputIsZero"/);
    expect(html).toContain('Only a Number input can hide its line.');
  });
});

describe('the form becomes the body of the preview and the save', () => {
  it('sends the choices and no section ID for a new section, with its names as typed', () => {
    const form = choiceForm({ label: 'Grade', choices: 'Coarse\nFine', sectionId: NEW_SECTION_VALUE, newSectionName: 'Finishing', newSectionShortName: 'Finish' });
    const spec = buildSpec(form);
    expect(spec).toMatchObject({ kind: 'input', input: { dataType: 'select', choices: 'Coarse\nFine', sectionId: '', newSection: { name: 'Finishing', shortName: 'Finish' } } });
  });

  it('sends an existing section as its ID with no new section, and no choices for a Number', () => {
    const form: InsertForm = { ...opened(), input: { ...opened().input, sectionId: 's-1', choices: 'left over\nfrom a list', newSectionName: 'left over' } };
    const spec = buildSpec(form);
    expect(spec).toMatchObject({ input: { dataType: 'number', choices: '', sectionId: 's-1', newSection: null } });
  });

  it('starts a choice in the text format and turns "hide the line" off when the type is chosen', () => {
    expect(formatFor(OPTIONS, 'select')).toBe('@');
    const patched = applyInputPatch({ ...opened(), kind: 'pair' }, { dataType: 'select' }, OPTIONS);
    expect(patched.input.numFmt).toBe('@');
    expect(patched.cost.hideWhenInputIsZero).toBe(false);
    expect(applyInputPatch(patched, { dataType: 'number' }, OPTIONS).cost.hideWhenInputIsZero).toBe(true);
  });
});

describe('the error summary lists the new controls where they are drawn', () => {
  it('orders the choices after the type and the new section\'s names after the section', () => {
    const order = fieldOrder('input');
    expect(order.indexOf('input.choices')).toBe(order.indexOf('input.dataType') + 1);
    expect(order.indexOf('input.newSectionName')).toBe(order.indexOf('input.sectionId') + 1);
    expect(order.indexOf('input.newSectionShortName')).toBe(order.indexOf('input.newSectionName') + 1);
  });

  it('lists a refusal of each with the id of its control', () => {
    const items = issueItems('input', { 'input.choices': 'Enter at least one choice.', 'input.newSectionShortName': 'Enter a short name for the section strip.' });
    expect(items.map((item) => item.fieldId)).toEqual(['insert-input-choices', 'insert-input-newSectionShortName']);
  });
});
