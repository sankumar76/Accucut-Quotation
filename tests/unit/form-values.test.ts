import { describe, expect, it } from 'vitest';

import { NUMBER_RULE_MESSAGE } from '@/lib/estimate/validation';
import { isSectionComplete, lengthProblem, readTyped, sectionProgress, shownText, textOf } from '@/lib/estimates/form-values';

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
});
