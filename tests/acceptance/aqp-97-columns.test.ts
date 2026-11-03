import { describe, expect, it } from 'vitest';

import {
  ColumnReferenceError,
  columnLetterToIndex,
  indexToColumnLetter,
  isColumnLetters,
  MAX_COLUMN_LETTERS,
} from '../../src/lib/columns';

/**
 * QA acceptance tests for AQP-97 (STORY-03.01) AC-1: column letters.
 *
 * Written from the AC text and an independent oracle (an odometer that counts A..Z, AA..ZZ, AAA.. by
 * string increment, with no arithmetic in common with the implementation). Hostile input is passed
 * through `Reflect.apply`, which accepts any argument list, so no type assertion is needed.
 */

/** The next column label, as a spreadsheet's autofill does it: "Z" -> "AA", "AZ" -> "BA", "ZZ" -> "AAA". */
function nextLabel(label: string): string {
  const characters = label.split('');
  let index = characters.length - 1;
  while (index >= 0) {
    if (characters[index] !== 'Z') {
      characters[index] = String.fromCharCode((characters[index] ?? 'A').charCodeAt(0) + 1);
      return characters.join('');
    }
    characters[index] = 'A';
    index -= 1;
  }
  return `A${characters.join('')}`;
}

function toLetters(value: unknown): unknown {
  return Reflect.apply(indexToColumnLetter, undefined, [value]);
}

function toIndex(value: unknown): unknown {
  return Reflect.apply(columnLetterToIndex, undefined, [value]);
}

describe('[AQP-97 AC-1] indexToColumnLetter and columnLetterToIndex', () => {
  it('[AQP-97 AC-1] the named positions: 1 A, 26 Z, 27 AA, 52 AZ, 53 BA, 67 BO, and the inverse of each', () => {
    const named: ReadonlyArray<readonly [number, string]> = [
      [1, 'A'],
      [2, 'B'],
      [25, 'Y'],
      [26, 'Z'],
      [27, 'AA'],
      [28, 'AB'],
      [51, 'AY'],
      [52, 'AZ'],
      [53, 'BA'],
      [67, 'BO'],
    ];
    for (const [position, letters] of named) {
      expect(indexToColumnLetter(position)).toBe(letters);
      expect(columnLetterToIndex(letters)).toBe(position);
    }
  });

  it('[AQP-97 AC-1] boundaries between one, two, three and four letters, and Excel\'s last column', () => {
    const boundaries: ReadonlyArray<readonly [number, string]> = [
      [676, 'YZ'],
      [677, 'ZA'],
      [702, 'ZZ'],
      [703, 'AAA'],
      [16_384, 'XFD'],
      [18_278, 'ZZZ'],
      [18_279, 'AAAA'],
    ];
    for (const [position, letters] of boundaries) {
      expect(indexToColumnLetter(position)).toBe(letters);
      expect(columnLetterToIndex(letters)).toBe(position);
    }
  });

  it('[AQP-97 AC-1] agrees with an independent odometer for every position from 1 to 60,000, in both directions', () => {
    let label = 'A';
    for (let position = 1; position <= 60_000; position += 1) {
      if (indexToColumnLetter(position) !== label) {
        throw new Error(`Position ${position}: expected ${label}, got ${indexToColumnLetter(position)}.`);
      }
      if (columnLetterToIndex(label) !== position) {
        throw new Error(`Letters ${label}: expected ${position}, got ${columnLetterToIndex(label)}.`);
      }
      label = nextLabel(label);
    }
  });

  it('[AQP-97 AC-1] a round trip holds for 1 to 1,000 (the AC) and for 5,000 seeded random positions up to 100 million', () => {
    for (let position = 1; position <= 1_000; position += 1) {
      expect(columnLetterToIndex(indexToColumnLetter(position))).toBe(position);
    }
    // A fixed linear-congruential generator, so the run is repeatable.
    let state = 97;
    for (let count = 0; count < 5_000; count += 1) {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      const position = (state % 100_000_000) + 1;
      expect(columnLetterToIndex(indexToColumnLetter(position))).toBe(position);
    }
  });

  it.each([
    ['zero', 0],
    ['minus one', -1],
    ['minus zero', -0],
    ['a large negative', -1_000_000],
    ['a half', 0.5],
    ['one and a half', 1.5],
    ['just over one', 1.000_000_1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['minus Infinity', Number.NEGATIVE_INFINITY],
    ['an integer beyond the safe range', Number.MAX_SAFE_INTEGER + 1],
    ['a number as text', '5'],
    ['an empty string', ''],
    ['null', null],
    ['undefined', undefined],
    ['true', true],
    ['a bigint', 5n],
    ['an array holding a number', [5]],
    ['an object', {}],
  ])('[AQP-97 AC-1] a position that is %s throws a typed ColumnReferenceError', (_name, value) => {
    expect(() => toLetters(value)).toThrow(ColumnReferenceError);
    try {
      toLetters(value);
    } catch (error) {
      expect(error).toBeInstanceOf(ColumnReferenceError);
      expect(error).toMatchObject({ code: 'COLUMN_REFERENCE_INVALID', httpStatus: 422 });
    }
  });

  it.each([
    ['an empty string', ''],
    ['lower case', 'a'],
    ['lower case, two letters', 'ab'],
    ['mixed case', 'Ab'],
    ['a digit', 'A1'],
    ['only a digit', '1'],
    ['a leading space', ' A'],
    ['a trailing space', 'A '],
    ['an inner space', 'A B'],
    ['a trailing newline', 'A\n'],
    ['a leading newline', '\nA'],
    ['a tab', 'A\t'],
    ['a zero-width space', 'A​'],
    ['a Cyrillic capital that looks like A', 'А'],
    ['a full-width capital A', 'Ａ'],
    ['an accented capital', 'É'],
    ['a dollar sign (an absolute reference)', '$A'],
    ['a range', 'A:B'],
    ['a hyphen', 'A-B'],
    ['a number', 5],
    ['null', null],
    ['undefined', undefined],
    ['an object', {}],
    ['eleven letters, one over the limit', 'A'.repeat(MAX_COLUMN_LETTERS + 1)],
    ['a thousand letters', 'Z'.repeat(1_000)],
  ])('[AQP-97 AC-1] letters that are %s throw a typed ColumnReferenceError', (_name, value) => {
    expect(() => toIndex(value)).toThrow(ColumnReferenceError);
    try {
      toIndex(value);
    } catch (error) {
      expect(error).toMatchObject({ code: 'COLUMN_REFERENCE_INVALID', httpStatus: 422 });
    }
  });

  it('[AQP-97 AC-1] the error message does not echo what was passed in', () => {
    const sentinel = 'zz-sentinel-9f3a';
    for (const call of [() => toIndex(sentinel), () => toLetters(sentinel)]) {
      try {
        call();
        throw new Error('Expected the call to throw.');
      } catch (error) {
        expect(error).toBeInstanceOf(ColumnReferenceError);
        expect(String(error instanceof Error ? error.message : '')).not.toContain(sentinel);
      }
    }
  });

  it('[AQP-97 AC-1] the longest accepted string (10 letters) converts to an exact integer and back', () => {
    const longest = 'Z'.repeat(MAX_COLUMN_LETTERS);
    const position = columnLetterToIndex(longest);
    expect(Number.isSafeInteger(position)).toBe(true);
    expect(indexToColumnLetter(position)).toBe(longest);
    // 26 + 26^2 + ... + 26^10, summed with BigInt so the oracle has no rounding.
    let expected = 0n;
    for (let power = 1n; power <= BigInt(MAX_COLUMN_LETTERS); power += 1n) expected += 26n ** power;
    expect(BigInt(position)).toBe(expected);
    expect(columnLetterToIndex('A'.repeat(MAX_COLUMN_LETTERS))).toBe(Number((26n ** 10n - 1n) / 25n));
  });

  it('[AQP-97 AC-1] isColumnLetters never throws and agrees with columnLetterToIndex', () => {
    const samples = ['A', 'Z', 'AA', 'BO', 'XFD', 'ZZZZZZZZZZ', '', 'a', 'A1', ' A', 'A\n', 'AAAAAAAAAAA', 'А'];
    for (const sample of samples) {
      let accepted = true;
      try {
        columnLetterToIndex(sample);
      } catch {
        accepted = false;
      }
      expect(isColumnLetters(sample)).toBe(accepted);
    }
  });

  it('[AQP-97 AC-1] the functions are pure: the same input gives the same output after a failure in between', () => {
    expect(indexToColumnLetter(67)).toBe('BO');
    expect(() => toLetters(0)).toThrow(ColumnReferenceError);
    expect(indexToColumnLetter(67)).toBe('BO');
    expect(() => toIndex('a')).toThrow(ColumnReferenceError);
    expect(columnLetterToIndex('BO')).toBe(67);
  });
});
