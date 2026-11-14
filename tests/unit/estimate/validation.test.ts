import { describe, expect, it } from 'vitest';

import {
  MAX_PART_TEXT_LENGTH,
  NUMBER_RULE_MESSAGE,
  TEXT_TOO_LONG_MESSAGE,
  TEXT_CHARACTERS_MESSAGE,
  validateNumberInput,
  validateTextInput,
} from '@/lib/estimate/validation';

/**
 * STORY-05.03 T1 (AC-4; SPEC section 7.3): the rule of one typed number and one typed text, as the browser and the server both read it. A blank is allowed while
 * saving (it removes the value; the mandatory check is the Calculate story's), a number is plain digits with up to 2 decimals and no sign, and two spellings of one
 * number compare equal because the stored text is normalised.
 */

describe('AC-4: validateNumberInput', () => {
  it.each([
    ['0', '0.00'],
    ['0.00', '0.00'],
    ['12', '12.00'],
    ['12.5', '12.50'],
    ['1.50', '1.50'],
    ['003.37', '3.37'],
    ['  12.5  ', '12.50'],
    ['999999999999.99', '999999999999.99'],
  ])('accepts %j and stores it as %j', (typed, stored) => {
    expect(validateNumberInput(typed)).toEqual({ ok: true, value: stored });
  });

  it('two spellings of one number give one stored text, so "1.50" and "1.5" are no change', () => {
    expect(validateNumberInput('1.5')).toEqual(validateNumberInput('1.50'));
    expect(validateNumberInput('01.5')).toEqual(validateNumberInput('1.50'));
  });

  it.each([['-1'], ['1.234'], ['abc'], ['1e3'], ['1,000'], ['12 5'], ['+5'], ['.5'], ['5.'], ['1.2.3'], ['NaN'], ['Infinity'], ['٣'], ['1000000000000']])(
    'refuses %j with the words of the rule and says nothing else',
    (typed) => {
      expect(validateNumberInput(typed)).toEqual({ ok: false, message: NUMBER_RULE_MESSAGE });
    },
  );

  it('the words are the words of the screen', () => {
    expect(NUMBER_RULE_MESSAGE).toBe('Enter 0 or more, with up to 2 decimals.');
  });

  it.each([[''], ['   ']])('a blank (%j) is allowed: it clears the value', (typed) => {
    expect(validateNumberInput(typed)).toEqual({ ok: true, value: null });
  });
});

describe('validateTextInput', () => {
  it('trims the text and stores what is left', () => {
    expect(validateTextInput('  Base frame  ', { multiline: false })).toEqual({ ok: true, value: 'Base frame' });
  });

  it('a blank clears the value', () => {
    expect(validateTextInput('   ', { multiline: false })).toEqual({ ok: true, value: null });
  });

  it('allows the longest text and refuses one character more, counted in characters', () => {
    expect(validateTextInput('a'.repeat(MAX_PART_TEXT_LENGTH), { multiline: false })).toEqual({ ok: true, value: 'a'.repeat(MAX_PART_TEXT_LENGTH) });
    expect(validateTextInput('a'.repeat(MAX_PART_TEXT_LENGTH + 1), { multiline: false })).toEqual({ ok: false, message: TEXT_TOO_LONG_MESSAGE });
    expect(validateTextInput('é'.repeat(MAX_PART_TEXT_LENGTH), { multiline: false }).ok).toBe(true);
  });

  it.each([['line\nbreak'], ['tab\there'], ['nul\u0000byte'], ['bell\u0007'], ['del\u007f']])('a single-line field refuses a control character: %j', (typed) => {
    expect(validateTextInput(typed, { multiline: false })).toEqual({ ok: false, message: TEXT_CHARACTERS_MESSAGE });
  });

  it('a multi-line field keeps a line break and still refuses the other control characters', () => {
    expect(validateTextInput('one\ntwo', { multiline: true })).toEqual({ ok: true, value: 'one\ntwo' });
    expect(validateTextInput('one\r\ntwo', { multiline: true })).toEqual({ ok: true, value: 'one\ntwo' });
    expect(validateTextInput('nul\u0000byte', { multiline: true })).toEqual({ ok: false, message: TEXT_CHARACTERS_MESSAGE });
  });

  it('keeps text that looks like a formula, as typed: the export neutralises it, not this rule', () => {
    expect(validateTextInput('=1+1', { multiline: false })).toEqual({ ok: true, value: '=1+1' });
  });
});
