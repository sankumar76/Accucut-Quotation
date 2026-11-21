import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { InsertFieldWizard } from '@/components/features/config/insert-field-wizard';
import { LetterChangesTable, LettersAfterInsert } from '@/components/features/config/insert-field-letters';
import { StepDetails, StepPreview, StepType } from '@/components/features/config/insert-field-steps';
import type { InsertOptions, InsertPreviewView } from '@/lib/config/insert-field-client';
import { initialForm, type InsertForm, type InsertKind } from '@/lib/config/insert-field-form';
import type { InsertWizard } from '@/components/features/config/use-insert-wizard';

/**
 * STORY-08.03 AC-2 (the three steps and every control of step 2), AC-3 (the table of letters with the product cells) and AC-10 (named, focusable regions, the summary, the live status) without a browser: what the
 * wizard draws for each kind of insert. The words are written out here from the UX spec and the story, not imported from the product, so a changed sentence fails a test. The keyboard, the layouts at 360, 768 and
 * 1366 px and axe are `tests/e2e/insert-field.spec.ts`. Every name is invented.
 */

const OPTIONS: InsertOptions = {
  version: 9,
  columns: [
    { id: 'c-a', letter: 'ZA', label: 'Invented Length', kind: 'input', watchable: true, hideable: true },
    { id: 'c-b', letter: 'ZB', label: 'Invented Cost', kind: 'output', watchable: false, hideable: false },
    { id: 'c-d', letter: 'ZD', label: 'Invented Name', kind: 'input', watchable: true, hideable: false },
  ],
  sections: [{ id: 's-1', number: 1, name: 'Invented Section' }],
  stages: [{ id: 'g-1', number: 3, name: 'Invented Stage', subHeadings: ['Invented Heading'] }],
  numberFormats: ['0.00', '#,##0.00', '@'],
};

const NOOP = (): void => undefined;

function wizard(kind: InsertKind, overrides: Partial<InsertWizard> = {}): InsertWizard {
  const form: InsertForm = { ...initialForm(OPTIONS, 'c-a'), kind };
  return {
    step: 2,
    form,
    errors: {},
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
    ...overrides,
  };
}

const details = (kind: InsertKind, overrides: Partial<InsertWizard> = {}): string => renderToStaticMarkup(createElement(StepDetails, { wizard: wizard(kind, overrides), options: OPTIONS }));

describe('AC-2 step 1: what to add', () => {
  const html = renderToStaticMarkup(createElement(StepType, { value: 'input', onChange: NOOP }));

  it('offers the three kinds as one radio group, with the words of the UX spec', () => {
    expect(html).toContain('role="radiogroup"');
    expect((html.match(/role="radio"/g) ?? []).length).toBe(3);
    for (const title of ['Input', 'Output', 'Input and its cost column']) expect(html).toContain(`>${title}</label>`);
    expect(html).toContain('A value the Engineer types. Mandatory and visible to Engineers.');
    expect(html).toContain("A calculated value. Never shown to Engineers. It joins a total only when you edit that total&#x27;s formula.");
    expect(html).toContain('Both in one step. A preview shows how the letters change before you save.');
  });

  it('marks the chosen kind as checked', () => {
    expect(html).toMatch(/aria-checked="true"[^>]*id="insert-type-input"/);
    expect(html).toMatch(/aria-checked="false"[^>]*id="insert-type-pair"/);
  });
});

describe('AC-2 step 2: the details of an input', () => {
  const html = details('input');

  it('has every control of the input, each with its label', () => {
    for (const label of ['Label', 'Type of value', 'Default value', 'Insert after column', 'Section of the Engineer form', 'Unit shown beside the input', 'Hint under the input', 'Excel column width', 'Excel number format']) {
      expect(html, label).toContain(`>${label}</label>`);
    }
    expect(html).toContain('When is the input shown to the Engineer?');
    expect(html).toContain('Always');
    expect(html).toContain('Only when another field has a value');
  });

  it('offers Number, Text and, since STORY-08.08, a choice from a list, the sections with "A new section", and the number formats in words', () => {
    expect(html).toContain('Number, 2 decimals');
    expect(html).toContain('>Text</option>');
    expect(html).toContain('>Choice from a list</option>');
    expect(html).toContain('01 Invented Section');
    expect(html).toContain('>A new section</option>');
    expect(html).toContain('Money, 2 decimals');
  });

  it('draws no list of choices and no names of a new section until they are chosen', () => {
    expect(html).not.toContain('Choices, one per line');
    expect(html).not.toContain('Name of the new section');
  });

  it('lists every column as "letter name" and pre-chooses the one named in the address', () => {
    expect(html).toContain('>ZA Invented Length</option>');
    expect(html).toContain('>ZB Invented Cost</option>');
    expect(html).toMatch(/<option value="c-a" selected="">ZA Invented Length<\/option>/);
  });

  it('draws no field of an output and no cost column', () => {
    expect(html).not.toContain('Formula');
    expect(html).not.toContain('Its cost column');
    expect(html).toContain('The input (visible to Engineers)');
  });

  it('says what the Engineer sees and what a new output does, in three notices', () => {
    expect(html).toContain('New inputs are mandatory and visible to Engineers.');
    expect(html).toContain("New outputs are hidden from Engineers and join a total only when that total&#x27;s formula is edited.");
    expect(html).toContain('Approved estimates keep the layout and values they were approved with.');
  });

  it('shows the live list "Letters after this insert" as a named, focusable region (AC-10)', () => {
    expect(html).toContain('Letters after this insert');
    expect(html).toContain('role="region" aria-label="Letters after this insert, scrollable" tabindex="0"');
  });

  it('waits for a column when none is chosen', () => {
    const none = renderToStaticMarkup(createElement(StepDetails, { wizard: wizard('input', { form: { ...initialForm(OPTIONS, null), kind: 'input' } }), options: OPTIONS }));
    expect(none).toContain('Choose the column to insert after to see the new letters.');
  });
});

describe('AC-2 step 2: the details of an output and of the pair', () => {
  it('an output has the stage, the sub-heading, the hiding input, the width, the format and the formula, in the letters after the insert (D-1)', () => {
    const html = details('output');
    for (const label of ['Label', 'Insert after column', 'Stage in cost details', 'Sub-heading in the stage', 'Hide the line when this input is 0', 'Excel column width', 'Excel number format', 'Formula']) {
      expect(html, label).toContain(`>${label}</label>`);
    }
    expect(html).toContain('3 Invented Stage');
    expect(html).toContain('Never hide');
    expect(html).toContain('Type the formula in the letters the worksheet will have after the insert');
    expect(html).toContain('The output (hidden from Engineers)');
    expect(html).not.toContain('Type of value');
  });

  it('only an input that holds a number may hide the line (review SQR-01): not an output and not a text', () => {
    const html = details('output');
    const hide = html.slice(html.indexOf('id="insert-output-hideWhenZeroFieldId"'));
    const list = hide.slice(0, hide.indexOf('</select>'));
    expect(list).toContain('ZA Invented Length');
    expect(list).not.toContain('ZB Invented Cost');
    expect(list).not.toContain('ZD Invented Name');
  });

  it('an input that holds a value may still be watched by the visibility rule, text or not', () => {
    const form = { ...initialForm(OPTIONS, 'c-a'), kind: 'input' as const };
    const html = renderToStaticMarkup(createElement(StepDetails, { wizard: wizard('input', { form: { ...form, input: { ...form.input, visibility: 'when' } } }), options: OPTIONS }));
    const watch = html.slice(html.indexOf('id="insert-input-watchFieldId"'));
    expect(watch.slice(0, watch.indexOf('</select>'))).toContain('ZD Invented Name');
  });

  it('a pair has the input, then the cost column with its position, "hide the line" on by default and the formula', () => {
    const html = details('pair');
    expect(html).toContain('The input (visible to Engineers)');
    expect(html).toContain('Its cost column (hidden from Engineers)');
    expect(html).toContain('Right after the new input');
    expect(html).toContain('After another column');
    expect(html).toMatch(/aria-checked="true"[^>]*id="insert-cost-hideWhenInputIsZero"/);
    // A hidden line is calculated and exported with its own value, which is 0 only when its formula gives 0 (review SQR-03).
    expect(html).toContain('Hidden lines are still calculated and exported with their calculated value.');
    expect(html).not.toContain('exported as 0');
    expect(html.indexOf('The input (visible')).toBeLessThan(html.indexOf('Its cost column'));
    expect((html.match(/Letters after this insert, scrollable/g) ?? []).length).toBe(1);
  });

  it('turns the checkbox off and disables it for a Text input, and says why (review SQR-01)', () => {
    const base = { ...initialForm(OPTIONS, 'c-a'), kind: 'pair' as const };
    const text = { ...base, input: { ...base.input, dataType: 'text' as const }, cost: { ...base.cost, hideWhenInputIsZero: false } };
    const html = renderToStaticMarkup(createElement(StepDetails, { wizard: wizard('pair', { form: text }), options: OPTIONS }));
    expect(html).toMatch(/aria-checked="false"[^>]*id="insert-cost-hideWhenInputIsZero"/);
    expect(html).toMatch(/disabled=""[^>]*id="insert-cost-hideWhenInputIsZero"/);
    expect(html).toContain('Only a Number input can hide its line.');
    expect(details('pair')).not.toContain('Only a Number input can hide its line.');
    expect(details('pair')).not.toMatch(/disabled=""[^>]*id="insert-cost-hideWhenInputIsZero"/);
  });

  it('shows the sentence of the server under the checkbox when the server refuses the choice', () => {
    const html = details('pair', { errors: { 'cost.hideWhenInputIsZero': 'Hide the line only for a Number input.' } });
    expect(html).toContain('id="insert-cost-hideWhenInputIsZero-error"');
    expect(html).toContain('Hide the line only for a Number input.');
  });

  it('shows the second column only for "after another column"', () => {
    expect(details('pair')).not.toContain('Insert the cost column after');
    const other = { ...initialForm(OPTIONS, 'c-a'), kind: 'pair' as const };
    const html = renderToStaticMarkup(createElement(StepDetails, { wizard: wizard('pair', { form: { ...other, cost: { ...other.cost, position: 'other' } } }), options: OPTIONS }));
    expect(html).toContain('Insert the cost column after');
  });

  it('a stage with no sub-heading chosen offers none until a stage is chosen', () => {
    const html = details('output');
    expect(html).toContain('No sub-heading');
    expect(html).not.toContain('Invented Heading');
  });
});

describe('AC-7 and AC-10: a refusal is under the control it names', () => {
  it('shows the server\'s sentence under the control, with aria-invalid and the control described by it', () => {
    const html = details('input', { errors: { 'input.label': 'Enter a label.', afterFieldId: 'Choose the column to insert after.' } });
    expect(html).toContain('id="insert-input-label-error"');
    expect(html).toContain('Enter a label.');
    expect(html).toMatch(/id="insert-input-label"[^>]*aria-invalid="true"/);
    expect(html).toMatch(/id="insert-afterFieldId"[^>]*aria-invalid="true"/);
  });
});

const PREVIEW: InsertPreviewView = {
  baseVersion: 9,
  inserted: [
    { letter: 'ZA', label: 'Invented Input', kind: 'input' },
    { letter: 'ZB', label: 'Invented Cost Column', kind: 'output' },
  ],
  moved: [
    { label: 'Invented Total', from: 'ZA', to: 'ZC' },
    { label: 'Invented Product Price', from: 'BL', to: 'BN' },
  ],
  productCells: [{ label: 'Invented Product Price', from: 'BL2', to: 'BN2' }],
  formulas: [{ letter: 'ZB', label: 'Invented Cost Column', formula: 'ZA * 2' }],
};

describe('AC-3 step 3: the preview', () => {
  const html = renderToStaticMarkup(createElement(StepPreview, { preview: PREVIEW }));

  it('names the new fields and says what happens to the others', () => {
    expect(html).toContain('New fields: ZA Invented Input and ZB Invented Cost Column.');
    expect(html).toContain('Every later field moves; formulas keep working. They show the new letters and give the same results.');
  });

  it('is a table of Was, Becomes and Field in a named, focusable region', () => {
    expect(html).toContain('aria-label="Letters that change, scrollable"');
    expect(html).toContain('tabindex="0"');
    for (const heading of ['Was', 'Becomes', 'Field']) expect(html).toContain(`>${heading}</th>`);
  });

  it('lists the new fields, then the moved columns, with the product cell beside its column', () => {
    expect(html).toContain('Invented Total');
    expect(html).toContain('Invented Product Price');
    expect(html).toContain('its cell BL2 → BN2');
    expect(html).toContain('(input)');
    expect(html).toContain('(output)');
  });

  it('shows the formula of the new output with its final letters', () => {
    expect(html).toContain('The formula of the new output');
    expect(html).toContain('<code class="font-mono">ZA * 2</code>');
  });

  it('says the file uses the new letters from now on', () => {
    expect(html).toContain('The Excel export uses the new letters for estimates calculated from now on.');
  });

  it('says so when nothing moves (an insert after the last column)', () => {
    const last = renderToStaticMarkup(createElement(StepPreview, { preview: { ...PREVIEW, moved: [], productCells: [] } }));
    expect(last).toContain('The new field goes at the end, so no other column changes its letter.');
  });
});

describe('the live list of letters', () => {
  it('says the letters are being worked out, and that they could not be', () => {
    expect(renderToStaticMarkup(createElement(LettersAfterInsert, { state: { kind: 'loading' }, labels: [] }))).toContain('Working out the letters');
    const failed = renderToStaticMarkup(createElement(LettersAfterInsert, { state: { kind: 'failed' }, labels: [] }));
    expect(failed).toContain('The letters could not be worked out. Nothing was changed.');
    expect(failed).not.toContain('role="region"');
  });

  it('lists the new letter and each shift, and says when no later column moves', () => {
    const ready = renderToStaticMarkup(createElement(LettersAfterInsert, { state: { kind: 'ready', preview: PREVIEW }, labels: ['Typed Input Name'] }));
    expect(ready).toContain('Invented Total');
    expect(ready).toContain('(new)');
    // The first new field is named as typed; the second keeps the server's name.
    expect(ready).toContain('Typed Input Name');
    expect(ready).not.toContain('Invented Input');
    expect(ready).toContain('Invented Cost Column');
    const end = renderToStaticMarkup(createElement(LettersAfterInsert, { state: { kind: 'ready', preview: { ...PREVIEW, moved: [], productCells: [] } }, labels: [] }));
    expect(end).toContain('No later column moves: the new field goes at the end.');
  });

  it('draws the same rows in the table of step 3 as in the list', () => {
    const table = renderToStaticMarkup(createElement(LetterChangesTable, { preview: PREVIEW }));
    expect((table.match(/<tr/g) ?? []).length).toBe(1 + 4);
  });
});

describe('the frame of the wizard (AC-10)', () => {
  const html = renderToStaticMarkup(createElement(InsertFieldWizard, { options: OPTIONS, afterId: 'c-a' }));

  it('opens on step 1 with the three steps listed, the current one marked, and a polite status region', () => {
    expect(html).toContain('<h1');
    expect(html).toContain('Insert field');
    expect(html).toContain('aria-current="step"');
    for (const name of ['What to add', 'Details', 'Preview and save']) expect(html).toContain(name);
    expect(html).toContain('role="status" aria-live="polite"');
    expect(html).toContain('1 · What do you want to add?');
  });

  it('has a breadcrumb back to Fields and formulas, Cancel and Next, and no password field (FR-080)', () => {
    expect(html).toContain('href="/config/fields"');
    expect(html).toContain('>Cancel<');
    expect(html).toContain('Next');
    expect(html).not.toMatch(/password/i);
  });
});
