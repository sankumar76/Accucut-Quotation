import { describe, expect, it } from 'vitest';

import { NUMBER_RULE_MESSAGE } from '@/lib/estimate/validation';
import { readTyped, shownText } from '@/lib/estimates/form-values';

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
