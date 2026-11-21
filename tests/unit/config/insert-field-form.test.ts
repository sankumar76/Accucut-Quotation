import { describe, expect, it } from 'vitest';

import type { InsertOptions } from '@/lib/config/insert-field-client';
import {
  buildSpec,
  applyInputPatch,
  controlId,
  fieldOrder,
  formatFor,
  initialForm,
  insertCount,
  issueItems,
  letterRows,
  newFieldNames,
  parseWidth,
  placeKey,
  strayMessages,
  withTypedLabels,
  type InsertForm,
} from '@/lib/config/insert-field-form';

/**
 * STORY-08.03 AC-2 (the three steps hold what is typed), AC-3 (the table of letters) and AC-7 (an error links to its control) without a browser: how the typed form becomes the body of the preview and the
 * save, and how the server's answers are laid out. Nothing here decides a rule: a wrong label or width goes to the server as typed. Every name is invented.
 */

const OPTIONS: InsertOptions = {
  version: 9,
  columns: [
    { id: 'c-a', letter: 'ZA', label: 'Invented Length', kind: 'input', watchable: true, hideable: true },
    { id: 'c-b', letter: 'ZB', label: 'Invented Cost', kind: 'output', watchable: false, hideable: false },
  ],
  sections: [{ id: 's-1', number: 1, name: 'Invented Section' }],
  stages: [{ id: 'g-1', number: 3, name: 'Invented Stage', subHeadings: ['Invented Heading'] }],
  numberFormats: ['@', '0.00', '#,##0.00'],
};

const form = (patch: Partial<InsertForm> = {}): InsertForm => ({ ...initialForm(OPTIONS, 'c-a'), ...patch });

describe('the form as it opens', () => {
  it('is an input after the column named in the address, with every control at its default (AC-1, AC-2)', () => {
    const opened = initialForm(OPTIONS, 'c-b');
    expect(opened.kind).toBe('input');
    expect(opened.afterFieldId).toBe('c-b');
    expect(opened.input).toMatchObject({ dataType: 'number', numFmt: '0.00', width: '12', visibility: 'always', label: '' });
    expect(opened.cost).toMatchObject({ position: 'after-input', hideWhenInputIsZero: true, numFmt: '#,##0.00' });
  });

  it('starts with no column when the address names none, or one the worksheet does not have', () => {
    expect(initialForm(OPTIONS, null).afterFieldId).toBe('');
    expect(initialForm(OPTIONS, 'no-such-column').afterFieldId).toBe('');
  });

  it('falls back to the first format the worksheet uses when the usual one is not among them', () => {
    expect(initialForm({ ...OPTIONS, numberFormats: ['General'] }, null).input.numFmt).toBe('General');
  });

  it('starts a text input in the text format and a number in the number format', () => {
    expect(formatFor(OPTIONS, 'text')).toBe('@');
    expect(formatFor(OPTIONS, 'number')).toBe('0.00');
  });

  it('counts one field, or two for a pair (the button says "Insert 2 fields")', () => {
    expect([insertCount('input'), insertCount('output'), insertCount('pair')]).toEqual([1, 1, 2]);
  });
});

describe('the request built from the form', () => {
  it('sends a typed width as a number and text that is not a number as 0, for the server to refuse in its own words', () => {
    expect(parseWidth(' 18 ')).toBe(18);
    expect(parseWidth('7.5')).toBe(7.5);
    for (const text of ['', 'abc', '-3', '1e3', '12 chars']) expect(parseWidth(text)).toBe(0);
  });

  it('builds an input with its visibility rule, and "Always" is no field to watch', () => {
    const always = buildSpec(form({ input: { ...form().input, label: 'Length', visibility: 'always', watchFieldId: 'c-b' } }));
    expect(always).toMatchObject({ kind: 'input', afterFieldId: 'c-a', input: { label: 'Length', watchFieldId: null, width: 12 } });
    const waiting = buildSpec(form({ input: { ...form().input, visibility: 'when', watchFieldId: 'c-b' } }));
    expect(waiting).toMatchObject({ input: { watchFieldId: 'c-b' } });
  });

  it('sends "only when" with no field chosen as an empty ID, which the server refuses with "Choose the field to watch."', () => {
    expect(buildSpec(form({ input: { ...form().input, visibility: 'when', watchFieldId: '' } }))).toMatchObject({ input: { watchFieldId: '' } });
  });

  it('builds a single output with no sub-heading and no hiding input as null (AC-2)', () => {
    const body = buildSpec(form({ kind: 'output', output: { ...form().output, label: 'Rework', formula: 'ZA * 2', stageId: 'g-1', group: '', hideWhenZeroFieldId: '' } }));
    expect(body).toEqual({
      kind: 'output',
      afterFieldId: 'c-a',
      output: { label: 'Rework', formula: 'ZA * 2', stageId: 'g-1', group: null, width: 14, numFmt: '#,##0.00', hideWhenZeroFieldId: null },
    });
    const named = buildSpec(form({ kind: 'output', output: { ...form().output, group: 'Invented Heading', hideWhenZeroFieldId: 'c-a' } }));
    expect(named).toMatchObject({ output: { group: 'Invented Heading', hideWhenZeroFieldId: 'c-a' } });
  });

  it('builds a pair whose cost column is right after the new input by default (no column) and hides the line when the input is 0', () => {
    const body = buildSpec(form({ kind: 'pair', cost: { ...form().cost, label: 'Rework cost', formula: 'ZA' } }));
    expect(body).toMatchObject({ kind: 'pair', cost: { afterFieldId: null, hideWhenInputIsZero: true, label: 'Rework cost' } });
  });

  it('sends the other column a pair names, and an empty one for "after another column" with none chosen', () => {
    const other = buildSpec(form({ kind: 'pair', cost: { ...form().cost, position: 'other', afterFieldId: 'c-b', hideWhenInputIsZero: false } }));
    expect(other).toMatchObject({ cost: { afterFieldId: 'c-b', hideWhenInputIsZero: false } });
    expect(buildSpec(form({ kind: 'pair', cost: { ...form().cost, position: 'other', afterFieldId: '' } }))).toMatchObject({ cost: { afterFieldId: '' } });
  });

  it('keeps what decides the places in one key, so the live list asks again only when they change', () => {
    const base = form();
    expect(placeKey({ ...base, input: { ...base.input, label: 'typed' } })).toBe(placeKey(base));
    expect(placeKey({ ...base, afterFieldId: 'c-b' })).not.toBe(placeKey(base));
    expect(placeKey({ ...base, kind: 'pair' })).not.toBe(placeKey(base));
    const pair = { ...base, kind: 'pair' as const };
    expect(placeKey({ ...pair, cost: { ...pair.cost, position: 'other' } })).not.toBe(placeKey(pair));
    expect(placeKey({ ...pair, cost: { ...pair.cost, label: 'typed' } })).toBe(placeKey(pair));
  });
});

describe('choosing the type of value (review SQR-01)', () => {
  const pair = (): InsertForm => ({ ...form(), kind: 'pair' });

  it('turns "hide the line when this input is 0" off for Text, which holds no number to be 0, and takes the format of text', () => {
    const next = applyInputPatch(pair(), { dataType: 'text' }, OPTIONS);
    expect(next.input).toMatchObject({ dataType: 'text', numFmt: '@' });
    expect(next.cost.hideWhenInputIsZero).toBe(false);
  });

  it('turns it back on, as it opens, when Number is chosen again', () => {
    const text = applyInputPatch(pair(), { dataType: 'text' }, OPTIONS);
    const number = applyInputPatch(text, { dataType: 'number' }, OPTIONS);
    expect(number.input).toMatchObject({ dataType: 'number', numFmt: '0.00' });
    expect(number.cost.hideWhenInputIsZero).toBe(true);
  });

  it('leaves the choice alone for any other change of the input, and keeps a format typed in the same patch', () => {
    const off = applyInputPatch(pair(), { dataType: 'text' }, OPTIONS);
    expect(applyInputPatch(off, { label: 'Typed' }, OPTIONS).cost.hideWhenInputIsZero).toBe(false);
    expect(applyInputPatch(pair(), { dataType: 'text', numFmt: '0.00' }, OPTIONS).input.numFmt).toBe('0.00');
  });
});

describe('a refusal and the controls it is about (AC-7, AC-10)', () => {
  it('makes a control id from a server field name', () => {
    expect(controlId('input.label')).toBe('insert-input-label');
    expect(controlId('afterFieldId')).toBe('insert-afterFieldId');
    expect(controlId('cost.afterFieldId')).toBe('insert-cost-afterFieldId');
  });

  it('draws every field of a kind once, in the order of the form', () => {
    for (const kind of ['input', 'output', 'pair'] as const) {
      expect(new Set(fieldOrder(kind)).size).toBe(fieldOrder(kind).length);
    }
    expect(fieldOrder('pair')).toEqual(expect.arrayContaining([...fieldOrder('input'), 'cost.formula']));
    expect(fieldOrder('input')).not.toContain('output.label');
  });

  it('lists the messages in the order of the form, each with the id of its control', () => {
    const items = issueItems('pair', { 'cost.formula': 'Enter a formula.', 'input.label': 'Enter a label.', afterFieldId: 'Choose the column to insert after.' });
    expect(items.map((item) => item.message)).toEqual(['Enter a label.', 'Choose the column to insert after.', 'Enter a formula.']);
    expect(items.map((item) => item.fieldId)).toEqual(['insert-input-label', 'insert-afterFieldId', 'insert-cost-formula']);
  });

  it('leaves out a message for a control this kind does not draw, and gives it as a stray one', () => {
    const errors = { 'output.label': 'Enter a label.', document: 'The field registry would not be valid with this field, so nothing was inserted.' };
    expect(issueItems('input', errors)).toEqual([]);
    expect(strayMessages('input', errors)).toEqual(['Enter a label.', 'The field registry would not be valid with this field, so nothing was inserted.']);
    expect(strayMessages('output', errors)).toEqual(['The field registry would not be valid with this field, so nothing was inserted.']);
  });
});

describe('the table of letters (AC-3, SPEC 14.6)', () => {
  const preview = {
    inserted: [{ letter: 'AY', label: 'Rework allowance', kind: 'input' as const }],
    moved: [
      { label: 'Total Process Cost', from: 'AY', to: 'AZ' },
      { label: 'Total Unit Production Price', from: 'BL', to: 'BM' },
      { label: 'Approved Quote Price', from: 'BO', to: 'BP' },
    ],
    productCells: [
      { label: 'Total Unit Production Price', from: 'BL2', to: 'BM2' },
      { label: 'Approved Quote Price', from: 'BO2', to: 'BP2' },
    ],
  };

  it('lists the new field first, then every moved column, and joins a product cell to its column', () => {
    const rows = letterRows(preview);
    expect(rows.map((row) => [row.was, row.becomes, row.isNew])).toEqual([
      [null, 'AY', true],
      ['AY', 'AZ', false],
      ['BL', 'BM', false],
      ['BO', 'BP', false],
    ]);
    expect(rows[1]?.cell).toBeNull();
    expect(rows[2]?.cell).toEqual({ from: 'BL2', to: 'BM2' });
    expect(rows[3]?.cell).toEqual({ from: 'BO2', to: 'BP2' });
  });

  it('does not join a cell of another column that only starts with the same letters, and gives a cell with no column a row of its own', () => {
    const rows = letterRows({
      inserted: [],
      moved: [{ label: 'Same name', from: 'B', to: 'C' }],
      productCells: [
        { label: 'Same name', from: 'BL2', to: 'BM2' },
        { label: 'Other', from: 'B2', to: 'C2' },
      ],
    });
    expect(rows.map((row) => [row.was, row.becomes, row.cell])).toEqual([
      ['B', 'C', null],
      ['BL2', 'BM2', null],
      ['B2', 'C2', null],
    ]);
  });

  it('is the new fields alone when nothing moves (an insert after the last column)', () => {
    expect(letterRows({ inserted: preview.inserted, moved: [], productCells: [] }).map((row) => row.becomes)).toEqual(['AY']);
  });

  it('puts the labels typed since the list was asked for in place of the name the server gave, in the order of the new fields, and keeps the name for a label not typed yet', () => {
    const rows = letterRows({
      inserted: [
        { letter: 'AY', label: 'New field', kind: 'input' },
        { letter: 'AZ', label: 'New field', kind: 'output' },
      ],
      moved: [{ label: 'Invented Total', from: 'AY', to: 'BA' }],
      productCells: [],
    });
    expect(withTypedLabels(rows, ['  Rework allowance ', '']).map((row) => row.label)).toEqual(['Rework allowance', 'New field', 'Invented Total']);
    expect(withTypedLabels(rows, []).map((row) => row.label)).toEqual(['New field', 'New field', 'Invented Total']);
  });

  it('names the new fields for the lead line of step 3', () => {
    expect(newFieldNames({ inserted: [...preview.inserted, { letter: 'AZ', label: 'Rework cost', kind: 'output' }] })).toEqual(['AY Rework allowance', 'AZ Rework cost']);
  });
});
