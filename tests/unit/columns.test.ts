import { describe, expect, it } from 'vitest';

import {
  ColumnReferenceError,
  columnLetterToIndex,
  indexToColumnLetter,
  isColumnLetters,
  MAX_COLUMN_LETTERS,
} from '@/lib/columns';
import { isAppError } from '@/lib/errors';

import { thrownAs } from '../support/thrown';

/** AC-1 (FR-021): letters are derived from position with the Excel algorithm, and the inverse holds. */

// Letters are written out here on purpose: tests are one of the two places they may be (coding standards).
const KNOWN_PAIRS: ReadonlyArray<readonly [number, string]> = [
  [1, 'A'],
  [2, 'B'],
  [26, 'Z'],
  [27, 'AA'],
  [28, 'AB'],
  [52, 'AZ'],
  [53, 'BA'],
  [67, 'BO'],
  [702, 'ZZ'],
  [703, 'AAA'],
  [16_384, 'XFD'],
];

describe('indexToColumnLetter (AC-1)', () => {
  it.each(KNOWN_PAIRS)('AC-1: position %i is %s', (position, letters) => {
    expect(indexToColumnLetter(position)).toBe(letters);
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['non-integer', 1.5],
    ['NaN', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
    ['beyond the safe integers', Number.MAX_SAFE_INTEGER + 1],
  ])('AC-1: throws a typed error for %s input', (_name, position) => {
    expect(() => indexToColumnLetter(position)).toThrow(ColumnReferenceError);
  });

  it('AC-1: the error is an application error with a stable code and no echo of the input', () => {
    const error = thrownAs(() => indexToColumnLetter(-7), ColumnReferenceError);
    expect(isAppError(error)).toBe(true);
    expect(error).toMatchObject({ code: 'COLUMN_REFERENCE_INVALID', httpStatus: 422 });
    expect(error.message).not.toContain('-7');
  });
});

describe('columnLetterToIndex (AC-1)', () => {
  it.each(KNOWN_PAIRS)('AC-1: %i is the inverse of %s', (position, letters) => {
    expect(columnLetterToIndex(letters)).toBe(position);
  });

  it.each([
    ['empty', ''],
    ['lower case', 'a'],
    ['mixed case', 'Ab'],
    ['a digit', 'A1'],
    ['a space', 'A '],
    ['a symbol', 'A-'],
    ['a non-latin letter', 'Ä'],
    ['too long to convert exactly', 'A'.repeat(MAX_COLUMN_LETTERS + 1)],
  ])('AC-1: throws a typed error for %s input', (_name, letters) => {
    expect(() => columnLetterToIndex(letters)).toThrow(ColumnReferenceError);
  });
});

describe('round trip (AC-1, property)', () => {
  it('AC-1: indexToColumnLetter then columnLetterToIndex returns the position for 1 to 1,000', () => {
    for (let position = 1; position <= 1_000; position += 1) {
      expect(columnLetterToIndex(indexToColumnLetter(position))).toBe(position);
    }
  });

  it('AC-1: every position in 1 to 1,000 gets a different, capital-letter string, in increasing order', () => {
    const seen = new Set<string>();
    let previous = '';
    for (let position = 1; position <= 1_000; position += 1) {
      const letters = indexToColumnLetter(position);
      expect(letters).toMatch(/^[A-Z]+$/);
      expect(seen.has(letters)).toBe(false);
      seen.add(letters);
      // A longer string is later; of two of equal length, the later in the alphabet is later.
      expect(letters.length > previous.length || (letters.length === previous.length && letters > previous)).toBe(true);
      previous = letters;
    }
  });

  it('AC-1: the longest accepted letter string converts exactly and back', () => {
    const longest = 'Z'.repeat(MAX_COLUMN_LETTERS);
    const position = columnLetterToIndex(longest);
    expect(Number.isSafeInteger(position)).toBe(true);
    expect(indexToColumnLetter(position)).toBe(longest);
  });
});

describe('isColumnLetters', () => {
  it('accepts capital letters and nothing else, without throwing', () => {
    expect(isColumnLetters('BO')).toBe(true);
    expect(isColumnLetters('')).toBe(false);
    expect(isColumnLetters('bo')).toBe(false);
    expect(isColumnLetters('B0')).toBe(false);
    expect(isColumnLetters('A'.repeat(MAX_COLUMN_LETTERS + 1))).toBe(false);
  });
});
