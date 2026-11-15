import { describe, expect, it } from 'vitest';

import {
  MAX_LONG_TEXT_LENGTH,
  MAX_PART_TEXT_LENGTH,
  NUMBER_RULE_MESSAGE,
  NUMBER_TOO_LARGE_MESSAGE,
  TEXT_TOO_LONG_MESSAGE,
  TEXT_CHARACTERS_MESSAGE,
  textTooLongMessage,
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

  it.each([['-1'], ['1.234'], ['abc'], ['1e3'], ['1,000'], ['12 5'], ['+5'], ['.5'], ['5.'], ['1.2.3'], ['NaN'], ['Infinity'], ['٣']])(
    'refuses %j with the words of the rule and says nothing else',
    (typed) => {
      expect(validateNumberInput(typed)).toEqual({ ok: false, message: NUMBER_RULE_MESSAGE });
    },
  );

  it('a number with the right shape but more than 12 digits before the point says so, and is not told its decimals are wrong (review SQR-11)', () => {
    expect(validateNumberInput('1000000000000')).toEqual({ ok: false, message: NUMBER_TOO_LARGE_MESSAGE });
    expect(validateNumberInput('1000000000000.5')).toEqual({ ok: false, message: NUMBER_TOO_LARGE_MESSAGE });
    expect(NUMBER_TOO_LARGE_MESSAGE).toBe('Use 12 digits or fewer before the point.');
    // Too many digits and a wrong shape together is still the rule of the shape.
    expect(validateNumberInput('1000000000000.123')).toEqual({ ok: false, message: NUMBER_RULE_MESSAGE });
    expect(validateNumberInput('999999999999.99').ok).toBe(true);
  });

  it('the words are the words of the screen', () => {
    expect(NUMBER_RULE_MESSAGE).toBe('Enter 0 or more, with up to 2 decimals.');
  });

  it.each([[''], ['   ']])('a blank (%j) is allowed: it clears the value', (typed) => {
    expect(validateNumberInput(typed)).toEqual({ ok: true, value: null });
  });
});

/** STORY-05.04 AC-4 (assumption A-1): a single-line text is 200 characters at most and the multi-line Remarks 1,000, each with its own words on the screen. */
describe('AC-4: the length of a text is the field\'s own', () => {
  it('names the limits: 200 for Part No., Description and Fasteners, 1,000 for Remarks', () => {
    expect(MAX_PART_TEXT_LENGTH).toBe(200);
    expect(MAX_LONG_TEXT_LENGTH).toBe(1000);
  });

  it('says the limit in words, with a thousands separator, and keeps the 200-character words as they were', () => {
    expect(textTooLongMessage(1000)).toBe('Use 1,000 characters or fewer.');
    expect(textTooLongMessage(MAX_PART_TEXT_LENGTH)).toBe(TEXT_TOO_LONG_MESSAGE);
    expect(TEXT_TOO_LONG_MESSAGE).toBe('Use 200 characters or fewer.');
  });

  it('allows 1,000 characters in Remarks and refuses 1,001 with the visible message', () => {
    const rule = { multiline: true, maxLength: MAX_LONG_TEXT_LENGTH };
    expect(validateTextInput('a'.repeat(MAX_LONG_TEXT_LENGTH), rule)).toEqual({ ok: true, value: 'a'.repeat(MAX_LONG_TEXT_LENGTH) });
    expect(validateTextInput('a'.repeat(MAX_LONG_TEXT_LENGTH + 1), rule)).toEqual({ ok: false, message: 'Use 1,000 characters or fewer.' });
  });

  it('counts a line break as one character, so "\\r\\n" typed on Windows is not two', () => {
    const rule = { multiline: true, maxLength: 5 };
    expect(validateTextInput('ab\r\ncd', rule)).toEqual({ ok: true, value: 'ab\ncd' });
    expect(validateTextInput('ab\r\ncde', rule)).toEqual({ ok: false, message: textTooLongMessage(5) });
  });

  it('a field without its own limit keeps the 200 of Part No.', () => {
    expect(validateTextInput('a'.repeat(MAX_PART_TEXT_LENGTH + 1), { multiline: false })).toEqual({ ok: false, message: TEXT_TOO_LONG_MESSAGE });
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

  it.each([
    ['a C1 control (next line)', 'A\u0085B'],
    ['the line separator', 'x\u2028y'],
    ['the paragraph separator', 'x\u2029y'],
    ['a right-to-left override', 'FR\u202E321'],
    ['a left-to-right embedding', 'FR\u202A321'],
    ['a right-to-left isolate', 'FR\u2067321'],
    ['a pop directional isolate', 'FR\u2069321'],
  ])('refuses %s, which can make a part number display other than it is stored (review SQR-04)', (_name, typed) => {
    expect(validateTextInput(typed, { multiline: false })).toEqual({ ok: false, message: TEXT_CHARACTERS_MESSAGE });
    expect(validateTextInput(typed, { multiline: true })).toEqual({ ok: false, message: TEXT_CHARACTERS_MESSAGE });
  });

  it.each([
    ['the zero-width space (U+200B)', 'FR\u200B321'],
    ['the zero-width non-joiner (U+200C)', 'FR\u200C321'],
    ['the zero-width joiner (U+200D)', 'FR\u200D321'],
    ['the left-to-right mark (U+200E)', 'FR\u200E321'],
    ['the right-to-left mark (U+200F)', 'FR\u200F321'],
    ['the Arabic letter mark (U+061C)', 'FR\u061C321'],
    ['the word joiner (U+2060)', 'FR\u2060321'],
    ['the invisible times (U+2062)', 'FR\u2062321'],
    ['the invisible plus (U+2064)', 'FR\u2064321'],
    ['the byte order mark (U+FEFF)', 'FR\uFEFF321'],
    ['the soft hyphen (U+00AD)', 'FR\u00AD321'],
  ])('refuses %s, an invisible character that could spoof a part number (security review)', (_name, typed) => {
    expect(validateTextInput(typed, { multiline: false })).toEqual({ ok: false, message: TEXT_CHARACTERS_MESSAGE });
    expect(validateTextInput(typed, { multiline: true })).toEqual({ ok: false, message: TEXT_CHARACTERS_MESSAGE });
  });

  it('refuses an invisible character at the end of a text too, where trimming does not remove it', () => {
    expect(validateTextInput(`FR321${String.fromCharCode(0x200b)}`, { multiline: false })).toEqual({ ok: false, message: TEXT_CHARACTERS_MESSAGE });
  });

  it('still accepts text in other scripts and an accented letter', () => {
    expect(validateTextInput('Cover é नमस्ते 中文', { multiline: false }).ok).toBe(true);
  });

  it('a multi-line field keeps a line break and still refuses the other control characters', () => {
    expect(validateTextInput('one\ntwo', { multiline: true })).toEqual({ ok: true, value: 'one\ntwo' });
    expect(validateTextInput('one\r\ntwo', { multiline: true })).toEqual({ ok: true, value: 'one\ntwo' });
    expect(validateTextInput('nul\u0000byte', { multiline: true })).toEqual({ ok: false, message: TEXT_CHARACTERS_MESSAGE });
  });

  it('a lone UTF-16 surrogate is refused with the words of the rule, and a valid pair (an emoji) is not (review SQR-13)', () => {
    expect(validateTextInput('FR\uD800321', { multiline: false })).toEqual({ ok: false, message: TEXT_CHARACTERS_MESSAGE });
    expect(validateTextInput('FR\uDC00321', { multiline: true })).toEqual({ ok: false, message: TEXT_CHARACTERS_MESSAGE });
    expect(validateTextInput('FR\u{1F600}', { multiline: false })).toEqual({ ok: true, value: 'FR\u{1F600}' });
  });

  it('keeps text that looks like a formula, as typed: the export neutralises it, not this rule', () => {
    expect(validateTextInput('=1+1', { multiline: false })).toEqual({ ok: true, value: '=1+1' });
  });
});
