import { describe, expect, it } from 'vitest';

import { remarksPreview, REMARKS_PREVIEW_LENGTH } from '@/lib/tasks/remarks-preview';

/**
 * AQP-401 AC-3 and the ux-expert's check 3 (comment 12944): the remarks of an Ignored row, whole up to 140 code points, cut at the last space before 140 with an ellipsis beyond it, line breaks as spaces. Every text is invented.
 */

const WORD = 'abcdefghi'; // 9 letters, so word + space = 10
/** A text of `count` code points made of 9-letter words with one space between them. */
const words = (count: number): string => `${WORD} `.repeat(Math.ceil(count / 10)).slice(0, count);

describe('the limit is one named value', () => {
  it('is 140 code points', () => {
    expect(REMARKS_PREVIEW_LENGTH).toBe(140);
  });
});

describe('a text of 140 code points or fewer is shown whole', () => {
  it('shows exactly 140 whole, with no ellipsis', () => {
    const text = 'x'.repeat(REMARKS_PREVIEW_LENGTH);
    expect(remarksPreview(text)).toEqual({ text, cut: false });
  });

  it('counts code points, so 140 emoji are whole', () => {
    const text = '\u{1F600}'.repeat(REMARKS_PREVIEW_LENGTH);
    expect(remarksPreview(text)).toEqual({ text, cut: false });
  });

  it('shows a short text as it is', () => {
    expect(remarksPreview('Customer chose another supplier.')).toEqual({ text: 'Customer chose another supplier.', cut: false });
  });
});

describe('a longer text is cut at the last space before 140, then an ellipsis', () => {
  it('cuts 141 code points at a word and says so', () => {
    const text = words(141);
    const shown = remarksPreview(text);
    expect(shown.cut).toBe(true);
    expect(shown.text.endsWith('…')).toBe(true);
    // Whole words only, and never past the limit.
    const body = shown.text.slice(0, -1);
    expect(Array.from(body).length).toBeLessThanOrEqual(REMARKS_PREVIEW_LENGTH);
    expect(body.split(' ').every((word) => word === WORD || WORD.startsWith(word))).toBe(true);
    expect(text.startsWith(body)).toBe(true);
    expect(body.endsWith(' ')).toBe(false);
  });

  it('keeps the whole last word when the letter after the limit is a space', () => {
    // 139 letters, then a word ending exactly at 140, then a space and more: the head already ends on a word.
    const text = `${'a'.repeat(139)}b more words follow`;
    expect(remarksPreview(text)).toEqual({ text: `${'a'.repeat(139)}b…`, cut: true });
  });

  it('cuts a text with no space at the limit', () => {
    expect(remarksPreview('x'.repeat(200))).toEqual({ text: `${'x'.repeat(REMARKS_PREVIEW_LENGTH)}…`, cut: true });
  });

  it('does not split an emoji', () => {
    const shown = remarksPreview('\u{1F600}'.repeat(200));
    expect(shown).toEqual({ text: `${'\u{1F600}'.repeat(REMARKS_PREVIEW_LENGTH)}…`, cut: true });
  });
});

describe('line breaks become spaces', () => {
  it('turns each line break, however many in a row, into one space', () => {
    expect(remarksPreview('First line.\nSecond line.\r\n\r\nThird line.')).toEqual({ text: 'First line. Second line. Third line.', cut: false });
  });

  it('trims the ends', () => {
    expect(remarksPreview('\n  Kept.  \n')).toEqual({ text: 'Kept.', cut: false });
  });

  it('counts the spaces that replaced the line breaks', () => {
    const text = `${'a'.repeat(70)}\n${'b'.repeat(69)}`;
    expect(remarksPreview(text).cut).toBe(false);
    expect(remarksPreview(`${text}c`).cut).toBe(true);
  });
});

describe('the text is never markup', () => {
  it('returns a plain string for a text that looks like it, untouched', () => {
    expect(remarksPreview('<b>x</b> & <script>')).toEqual({ text: '<b>x</b> & <script>', cut: false });
  });
});
