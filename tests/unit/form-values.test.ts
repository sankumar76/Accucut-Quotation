import { describe, expect, it } from 'vitest';

import { NUMBER_RULE_MESSAGE } from '@/lib/estimate/validation';
import { fieldVisibility, isSectionComplete, lengthProblem, readTyped, sectionProgress, shownSections, shownText, sumProgress, textOf, watchersOf } from '@/lib/estimates/form-values';

import { defined } from '../support/defined';

/**
 * STORY-05.03 T6 (AC-4): the screen reads a typed value by its field's rule before it asks the server, with the same words as the server. Every name and ID is invented.
 */

const NUMBER = { type: 'number', decimals: 2 } as const;
const TEXT = { type: 'text', maxLength: 200, multiline: false } as const;
const MULTILINE = { type: 'text', maxLength: 200, multiline: true } as const;
const SELECT = { type: 'select', source: 'materials' } as const;
const DERIVED = { type: 'derived', from: null } as const;

describe('readTyped', () => {
  it('reads a number: a valid one as the text the server stores, a wrong one with the words of the rule, a blank as nothing', () => {
    expect(readTyped(NUMBER, '12.5')).toEqual({ ok: true, value: '12.50' });
    expect(readTyped(NUMBER, '-1')).toEqual({ ok: false, message: NUMBER_RULE_MESSAGE });
    expect(readTyped(NUMBER, '1.234')).toEqual({ ok: false, message: NUMBER_RULE_MESSAGE });
    expect(readTyped(NUMBER, 'abc')).toEqual({ ok: false, message: NUMBER_RULE_MESSAGE });
    expect(readTyped(NUMBER, ' ')).toEqual({ ok: true, value: null });
  });

  it('reads a text by its line rule', () => {
    expect(readTyped(TEXT, '  FR-1 ')).toEqual({ ok: true, value: 'FR-1' });
    expect(readTyped(TEXT, 'a\nb').ok).toBe(false);
    expect(readTyped(MULTILINE, 'a\nb')).toEqual({ ok: true, value: 'a\nb' });
  });

  it('reads a choice as its ID in lower case, and a blank as no choice', () => {
    expect(readTyped(SELECT, ' 00000000-0000-4000-8000-000500000C01 ')).toEqual({ ok: true, value: '00000000-0000-4000-8000-000500000c01' });
    expect(readTyped(SELECT, '')).toEqual({ ok: true, value: null });
  });

  it('never sends a derived field', () => {
    expect(readTyped(DERIVED, 'anything')).toEqual({ ok: true, value: null });
  });
});

describe('shownText', () => {
  it('shows what is held, and nothing for a value that is not there', () => {
    expect(shownText('12.50')).toBe('12.50');
    expect(shownText(undefined)).toBe('');
  });
});

describe('STORY-05.04 AC-4: a text is read by its field\'s own length', () => {
  const REMARKS = { type: 'text', maxLength: 1000, multiline: true } as const;

  it('reads 1,000 characters of Remarks and refuses 1,001 with the visible message', () => {
    expect(readTyped(REMARKS, 'a'.repeat(1000)).ok).toBe(true);
    expect(readTyped(REMARKS, 'a'.repeat(1001))).toEqual({ ok: false, message: 'Use 1,000 characters or fewer.' });
  });

  it('a single-line text of the old limit of 200 is refused at 201 with the words of 200', () => {
    expect(readTyped(TEXT, 'a'.repeat(201))).toEqual({ ok: false, message: 'Use 200 characters or fewer.' });
  });

  it('tells a person at once that a long text is too long, while they are still typing, and says nothing of a text that fits or a field that is not a text', () => {
    expect(lengthProblem(REMARKS, 'a'.repeat(1001))).toBe('Use 1,000 characters or fewer.');
    expect(lengthProblem(REMARKS, `${'a'.repeat(1000)}   `)).toBeUndefined();
    expect(lengthProblem(REMARKS, 'short')).toBeUndefined();
    expect(lengthProblem(NUMBER, '1'.repeat(5000))).toBeUndefined();
    expect(lengthProblem(SELECT, 'x'.repeat(5000))).toBeUndefined();
  });
});

describe('STORY-05.04 AC-3: textOf, the text a field shows', () => {
  const FASTENERS = { id: 'fasteners', defaultValue: 'None' };
  const LENGTH = { id: 'length', defaultValue: null };

  it('shows what the person typed or the server holds, even a blank they typed over the default', () => {
    expect(textOf(FASTENERS, { fasteners: 'M6 bolt' })).toBe('M6 bolt');
    expect(textOf(FASTENERS, { fasteners: '' })).toBe('');
  });

  it('shows the default while nothing is held, and nothing for a field with no default', () => {
    expect(textOf(FASTENERS, {})).toBe('None');
    expect(textOf(LENGTH, {})).toBe('');
  });
});

describe('STORY-05.04 AC-1, AC-6: sectionProgress, the "n of m complete" of a card', () => {
  const field = (id: string, overrides: Record<string, unknown> = {}) => ({ id, editable: true, required: true, defaultValue: null, ...overrides });
  const section = { fields: [field('p'), field('q'), field('s', { defaultValue: 'None' }), field('f', { editable: false }), field('opt', { required: false })] };

  it('counts the fields a person must fill: not a read-only field, not one that is optional', () => {
    expect(sectionProgress(section, {}, {})).toEqual({ complete: 1, total: 3 });
  });

  it('counts a field with a value, and the default of Fasteners counts as a value', () => {
    expect(sectionProgress(section, { p: '1.00' }, {})).toEqual({ complete: 2, total: 3 });
    expect(sectionProgress(section, { p: '1.00', q: '0.00', s: 'M6' }, {})).toEqual({ complete: 3, total: 3 });
  });

  it('a blank or a text of spaces is not complete, and a value with an error under it is not complete either', () => {
    expect(sectionProgress(section, { p: '   ', q: '' }, {})).toEqual({ complete: 1, total: 3 });
    expect(sectionProgress(section, { p: 'abc', q: '2.00' }, { p: 'Enter 0 or more, with up to 2 decimals.' })).toEqual({ complete: 2, total: 3 });
  });

  it('a field the person cleared that has a default is blank, not the default', () => {
    expect(sectionProgress(section, { s: '' }, {})).toEqual({ complete: 0, total: 3 });
  });

  it('a card with no field to fill (the placeholder cards) is 0 of 0 and not complete', () => {
    expect(sectionProgress({ fields: [] }, {}, {})).toEqual({ complete: 0, total: 0 });
    expect(isSectionComplete({ complete: 0, total: 0 })).toBe(false);
    expect(isSectionComplete({ complete: 3, total: 3 })).toBe(true);
    expect(isSectionComplete({ complete: 2, total: 3 })).toBe(false);
  });

  it("STORY-05.11 AC-1: the part count is the sum of the card counts, and a part with no card to fill is 0 of 0", () => {
    expect(sumProgress([
      { complete: 2, total: 4 },
      { complete: 0, total: 0 },
      { complete: 3, total: 3 },
    ])).toEqual({ complete: 5, total: 7 });
    expect(sumProgress([])).toEqual({ complete: 0, total: 0 });
  });
});

describe('STORY-05.05 AC-1, AC-2: which fields show for what is typed', () => {
  const FASTENERS_ID = '00000000-0000-4000-8000-000100000013';
  const HIDING = { fieldId: FASTENERS_ID, values: ['None', ''] };
  const base = { kind: 'input', letter: 'X', label: 'X', unit: null, hint: null, required: true, editable: true, rule: NUMBER } as const;
  const fasteners = { ...base, id: FASTENERS_ID, letter: 'S', defaultValue: 'None', visibleWhen: null, rule: TEXT };
  const quantity = { ...base, id: 'quantity', letter: 'T', defaultValue: null, visibleWhen: HIDING };
  const cost = { ...base, id: 'cost', letter: 'U', defaultValue: null, visibleWhen: HIDING };
  const length = { ...base, id: 'length', letter: 'J', defaultValue: null, visibleWhen: null };
  const fields = [length, fasteners, quantity, cost];
  const section = { id: 's5', number: 5, name: 'Fasteners', shortName: 'Fasteners', columnRange: 'S–U', fields };

  it('Qty and Cost are hidden while Fasteners shows its default "None", and while a person has typed "none", " NONE " or nothing', () => {
    for (const texts of [{}, { [FASTENERS_ID]: 'None' }, { [FASTENERS_ID]: 'none' }, { [FASTENERS_ID]: ' NONE ' }, { [FASTENERS_ID]: '' }, { [FASTENERS_ID]: '   ' }]) {
      const shown = fieldVisibility(fields, texts);
      expect(fields.filter(shown).map((field) => field.letter), JSON.stringify(texts)).toEqual(['J', 'S']);
    }
  });

  it('Qty and Cost show for anything else typed in Fasteners, and the values typed into them are the person\'s (kept while they are hidden)', () => {
    const texts = { [FASTENERS_ID]: 'M6 bolt', quantity: '5.00', cost: '3.50' };
    expect(fields.filter(fieldVisibility(fields, texts)).map((field) => field.letter)).toEqual(['J', 'S', 'T', 'U']);
    // Back to "None": hidden, and the text typed under them is still in the texts the form holds (AC-2: "keep any value typed earlier").
    const back = { ...texts, [FASTENERS_ID]: 'None' };
    expect(fields.filter(fieldVisibility(fields, back)).map((field) => field.letter)).toEqual(['J', 'S']);
    expect(textOf(quantity, back)).toBe('5.00');
  });

  it('a rule that watches a field the form does not carry reads what is typed under that ID, and a blank counts as blank', () => {
    const lone = { ...quantity, visibleWhen: { fieldId: 'elsewhere', values: [''] } };
    expect(fieldVisibility([lone], {})(lone)).toBe(false);
    expect(fieldVisibility([lone], { elsewhere: 'x' })(lone)).toBe(true);
  });

  it('shownSections leaves the hidden fields out of each card, and keeps the rest of the card as it is', () => {
    const [hidden] = shownSections([section], {});
    expect(hidden?.fields.map((field) => field.letter)).toEqual(['J', 'S']);
    expect(hidden?.name).toBe('Fasteners');
    const [shown] = shownSections([section], { [FASTENERS_ID]: 'Rivets' });
    expect(shown?.fields.map((field) => field.letter)).toEqual(['J', 'S', 'T', 'U']);
  });

  it('the "n of m" of a card does not count a hidden field, and counts it once it shows', () => {
    const [hidden] = shownSections([section], {});
    expect(sectionProgress(defined(hidden), {}, {})).toEqual({ complete: 1, total: 2 });
    const typed = { [FASTENERS_ID]: 'Rivets' };
    expect(sectionProgress(defined(shownSections([section], typed)[0]), typed, {})).toEqual({ complete: 1, total: 4 });
    const filled = { ...typed, quantity: '2.00', cost: '0.00', length: '1.00' };
    expect(sectionProgress(defined(shownSections([section], filled)[0]), filled, {})).toEqual({ complete: 4, total: 4 });
  });

  it('watchersOf names the fields that watch one: the fields a change of it can show or hide', () => {
    expect(watchersOf(fields, FASTENERS_ID).map((field) => field.letter)).toEqual(['T', 'U']);
    expect(watchersOf(fields, 'length')).toEqual([]);
  });
});
