import { describe, expect, it } from 'vitest';

import { isOverridePrice, MAX_REASON_LENGTH, priceDifference, prefillPrice, REASON_TOO_LONG_MESSAGE, validateReason } from '@/lib/estimate/approve-price';
import { TEXT_CHARACTERS_MESSAGE } from '@/lib/estimate/validation';

/**
 * STORY-06.07 (AQP-324; FR-103, FR-011, FR-062; D-18; architecture section 5.1 and assumption A-12): the pure rules of a price that differs from the calculated total (BL) and of its optional reason. Both
 * sides of the comparison are BL's and the price's value in rupees and paise, rounded by the one rule the dialog pre-fills with (`toTwoPlaces`, half away from zero), so a Lead who accepts the pre-filled
 * price is never recorded as an override. Every figure and text is invented.
 */

const CALCULATED = '12629.99';

describe('AC-5: a price is an override only when it differs from BL at rupees and paise', () => {
  it.each([
    ['the same price', '12629.99', '12629.99'],
    ['the same price with trailing zeros (12629.99 and 12629.9900)', '12629.99', '12629.9900'],
    ['the same price with leading zeros', '012629.99', '12629.99'],
    ['whole rupees against BL with zero paise', '12630', '12630.00'],
    ['the pre-filled price, where BL has more places (12.34495 rounds to 12.34)', '12.34', '12.34495'],
    ['the pre-filled price of a tie, rounded away from zero (0.005 gives 0.01)', '0.01', '0.005'],
    ['a price of 0 against a BL that rounds to 0 (0.00495)', '0', '0.00495'],
    ['surrounding spaces', ' 12629.99 ', '12629.99'],
  ])('is not an override: %s', (_name, price, total) => {
    expect(isOverridePrice(price, total)).toBe(false);
    expect(priceDifference(price, total)).toBeNull();
  });

  it.each([
    ['one paisa lower', '12629.98', CALCULATED],
    ['one paisa higher', '12630.00', CALCULATED],
    ['the rounded-down total when BL rounds up (12.34495 shown as 12.34, price 12.35 is different)', '12.35', '12.34495'],
    ['a price of 0 (AC-8)', '0', CALCULATED],
    ['a huge price of 12 digits', '999999999999.99', CALCULATED],
  ])('is an override: %s', (_name, price, total) => {
    expect(isOverridePrice(price, total)).toBe(true);
    expect(priceDifference(price, total)).not.toBeNull();
  });

  it('is not an override when either text is no decimal (the dialog hides the reason while the price is not a price)', () => {
    expect(isOverridePrice('', CALCULATED)).toBe(false);
    expect(isOverridePrice('abc', CALCULATED)).toBe(false);
    expect(isOverridePrice('12600.00', 'not a number')).toBe(false);
  });
});

describe('AC-1: the difference the warning names', () => {
  it('says how much lower, in rupees and paise (the sample estimate: BL 12,629.99 and a price of 12,600.00 is 29.99 lower)', () => {
    expect(priceDifference('12600.00', CALCULATED)).toEqual({ direction: 'lower', amount: '29.99' });
  });

  it('says higher when the price is above BL', () => {
    expect(priceDifference('12630.01', CALCULATED)).toEqual({ direction: 'higher', amount: '0.02' });
  });

  it('is computed with whole-number arithmetic, so a value no JavaScript number holds is exact', () => {
    expect(priceDifference('999999999999.99', '0.01')).toEqual({ direction: 'higher', amount: '999999999999.98' });
    expect(priceDifference('0', '999999999999.99')).toEqual({ direction: 'lower', amount: '999999999999.99' });
  });

  it('measures the difference from BL as it is kept (rounded to paise), not from its full value', () => {
    expect(priceDifference('12.35', '12.34495')).toEqual({ direction: 'higher', amount: '0.01' });
  });

  it('keeps the single digit of the paise (0.05 is "0.05", not "0.5")', () => {
    expect(priceDifference('12629.94', CALCULATED)).toEqual({ direction: 'lower', amount: '0.05' });
  });
});

describe('the pre-filled price is the one rule the comparison uses', () => {
  it.each(['12629.99', '12.34495', '0.005', '0.00495', '1234567.895', '100.00495'])('the pre-fill of %s is never an override against it', (total) => {
    expect(isOverridePrice(prefillPrice(total), total)).toBe(false);
  });
});

describe('AC-4: the reason is optional, trimmed and at most 500 characters', () => {
  it('has the limit of the story and the words of the spec', () => {
    expect(MAX_REASON_LENGTH).toBe(500);
    expect(REASON_TOO_LONG_MESSAGE).toBe('Use 500 characters or fewer.');
  });

  it.each([
    ['empty', ''],
    ['spaces only', '   '],
    ['a tab and line breaks only', '\t\r\n \n'],
  ])('%s is no reason: nothing is kept', (_name, typed) => {
    expect(validateReason(typed)).toEqual({ ok: true, value: null });
  });

  it('is trimmed, and keeps what is inside as typed', () => {
    expect(validateReason('  Rounded down to a whole hundred for the customer quote.  ')).toEqual({ ok: true, value: 'Rounded down to a whole hundred for the customer quote.' });
    expect(validateReason('=SUM(A1:A2) and 50% off')).toEqual({ ok: true, value: '=SUM(A1:A2) and 50% off' });
  });

  it('may run over several lines, and a carriage return is folded into a line feed', () => {
    expect(validateReason('First line.\r\nSecond line.\rThird line.')).toEqual({ ok: true, value: 'First line.\nSecond line.\nThird line.' });
  });

  it('accepts 500 characters and refuses 501, after trimming', () => {
    expect(validateReason('a'.repeat(500))).toEqual({ ok: true, value: 'a'.repeat(500) });
    expect(validateReason(`  ${'a'.repeat(500)}  `)).toEqual({ ok: true, value: 'a'.repeat(500) });
    expect(validateReason('a'.repeat(501))).toEqual({ ok: false, message: REASON_TOO_LONG_MESSAGE });
  });

  it('counts characters, not UTF-16 units, as the column does (500 emoji are 500 characters; 501 are not)', () => {
    expect(validateReason('😀'.repeat(500))).toEqual({ ok: true, value: '😀'.repeat(500) });
    expect(validateReason('😀'.repeat(501))).toEqual({ ok: false, message: REASON_TOO_LONG_MESSAGE });
  });

  it('counts a letter written with a combining mark as the code points it has, so the column never refuses what this accepted', () => {
    // "é" as e + U+0301 is two code points; PostgreSQL's char_length counts code points too.
    expect(validateReason('é'.normalize('NFD').repeat(250))).toEqual({ ok: true, value: 'é'.normalize('NFD').repeat(250) });
    expect(validateReason('é'.normalize('NFD').repeat(251))).toEqual({ ok: false, message: REASON_TOO_LONG_MESSAGE });
  });
});

describe('DL-219: the reason refuses every control, format, separator and lone surrogate character, as the shared text rule does', () => {
  it.each([
    ['a zero-width space (U+200B)', 'Round​ed'],
    ['a zero-width joiner (U+200D)', 'a‍b'],
    ['a zero-width non-joiner (U+200C)', 'a‌b'],
    // Inside the text: JavaScript's `trim` counts U+FEFF as white space, so one at an end is trimmed away before the rule looks.
    ['a byte order mark (U+FEFF)', 'Round﻿ed'],
    ['a right-to-left override (U+202E)', 'Rounded ‮down'],
    ['a soft hyphen (U+00AD)', 'Round­ed'],
    ['a NUL control character', 'Round\u0000ed'],
    ['a C1 control character (U+0085)', 'Round\u0085ed'],
    ['a vertical tab', 'Round\u000Bed'],
    ['a line separator (U+2028)', 'one two'],
    ['a paragraph separator (U+2029)', 'one two'],
    ['a lone surrogate', 'half \uD800 pair'],
  ])('%s', (_name, typed) => {
    expect(validateReason(typed)).toEqual({ ok: false, message: TEXT_CHARACTERS_MESSAGE });
  });

  it('lets a line feed through (the field has several lines) and ordinary punctuation, rupee sign and Indian script letters', () => {
    expect(validateReason('Line one.\nLine two: ₹ 29.99 — “rounded”, नमस्ते')).toEqual({ ok: true, value: 'Line one.\nLine two: ₹ 29.99 — “rounded”, नमस्ते' });
  });

  it('refuses a hidden character even when the text is also too long: the length is said first, as the shared rule does', () => {
    expect(validateReason(`${'a'.repeat(501)}​`)).toEqual({ ok: false, message: REASON_TOO_LONG_MESSAGE });
  });

  it('a hidden character that trimming would remove is refused: the trim only takes whitespace, and U+200B is not whitespace', () => {
    expect(validateReason('​  ')).toEqual({ ok: false, message: TEXT_CHARACTERS_MESSAGE });
  });
});
