import { describe, expect, it } from 'vitest';

import { exportFileName, isExportFileName } from '@/lib/export/file-name';
import { CUSTOMER_SHORT_NAME_MAX_LENGTH } from '@/lib/masters/customers';
import { SUBJECT_MAX_LENGTH } from '@/lib/tasks/assign';
import { istDayMonthYearOf, istIsoDateOf } from '@/lib/time';

/**
 * The name of the exported workbook (CR-01 item 9, AQP-391): `<Short Name>_<Subject>_<DD-MM-YYYY>.xlsx`. Every value is invented. There is no length cut (OQ-PM-11 answered by the delivery lead: "Don't limit the characters"); the field limits of AQP-390 bound the name.
 */

const TASK_CODE = 'Q-2026-0001';
/** 21 Nov 2026, 12:00 UTC: 17:30 IST the same day. */
const NOON_UTC = new Date('2026-11-21T12:00:00.000Z');
const DATE = '21-11-2026';

const nameOf = (customerShortName: string | null, subject: string | null, now: Date = NOON_UTC, taskCode: string = TASK_CODE): string => exportFileName({ customerShortName, subject, taskCode, now });
const stemOf = (name: string): string => name.slice(0, -'.xlsx'.length);
const lengthOf = (text: string): number => Array.from(text).length;

describe('exportFileName pattern (AQP-391 AC-1)', () => {
  it('is <ShortName>_<Subject>_<DD-MM-YYYY>.xlsx, with no task code and no "Quotation"', () => {
    expect(nameOf('MAS', 'Feed-hopper')).toBe('MAS_Feed-hopper_21-11-2026.xlsx');
    expect(nameOf('MAS', 'Feed hopper')).not.toMatch(/Q-2026|Quotation/);
  });
});

describe('exportFileName sanitising (AQP-391 AC-3)', () => {
  it.each([
    ['a space', 'Feed hopper', 'Feed-hopper'],
    ['a slash', 'a/b', 'a-b'],
    ['a backslash', 'a\\b', 'a-b'],
    ['a colon', 'a:b', 'a-b'],
    ['an asterisk', 'a*b', 'a-b'],
    ['a question mark', 'a?b', 'a-b'],
    ['a double quote', 'a"b', 'a-b'],
    ['a less-than sign', 'a<b', 'a-b'],
    ['a greater-than sign', 'a>b', 'a-b'],
    ['a vertical bar', 'a|b', 'a-b'],
  ])('turns %s into one hyphen', (_label, subject, expected) => {
    expect(nameOf('MAS', subject)).toBe(`MAS_${expected}_${DATE}.xlsx`);
  });

  it.each([
    ['a tab', 'a\tb'],
    ['a line feed', 'a\nb'],
    ['a carriage return', 'a\rb'],
    ['a no-break space', 'a b'],
    ['an ideographic space', 'a　b'],
    ['a line separator', 'a b'],
  ])('turns %s into one hyphen (whitespace of every kind)', (_label, subject) => {
    expect(nameOf('MAS', subject)).toBe(`MAS_a-b_${DATE}.xlsx`);
  });

  it('does not collapse runs: the rule is literal', () => {
    expect(nameOf('MAS', 'a  b/ c')).toBe(`MAS_a--b--c_${DATE}.xlsx`);
  });

  it('removes control characters and format characters, including a bidirectional override that could turn xlsx.exe into exe.xlsx', () => {
    expect(nameOf('MAS', 'a\u0000b\u0007c\u007fd')).toBe(`MAS_abcd_${DATE}.xlsx`);
    expect(nameOf('MAS', 'ab\u202Excl.exe')).toBe(`MAS_abxcl.exe_${DATE}.xlsx`);
    expect(nameOf('MAS', 'a\u200Bb\u2060c\u200Dd')).toBe(`MAS_abcd_${DATE}.xlsx`);
  });

  it('removes a lone surrogate, so a header builder can always encode the name', () => {
    expect(nameOf('MAS', 'a\ud800b')).toBe(`MAS_ab_${DATE}.xlsx`);
  });

  it('keeps letters, digits, underscore, hyphen, dot and non-ASCII letters', () => {
    expect(nameOf('MAS', 'Kühler_Ø-40.5-工场')).toBe(`MAS_Kühler_Ø-40.5-工场_${DATE}.xlsx`);
  });

  it('puts the name in Unicode NFC (a decomposed u with a diaeresis becomes one character)', () => {
    expect(nameOf('MAS', 'Kühler')).toBe(`MAS_Kühler_${DATE}.xlsx`);
  });

  it('cleans the short name in the same way', () => {
    expect(nameOf('M A/S', 'x')).toBe(`M-A-S_x_${DATE}.xlsx`);
  });

  it('is only hyphens, and valid, when a subject holds only forbidden characters', () => {
    expect(nameOf('MAS', '///')).toBe(`MAS_---_${DATE}.xlsx`);
  });

  it('cannot carry a quote, a semicolon, a line break or a path into the name, whatever a person types', () => {
    const name = nameOf('MAS"\r\n', 'a"\r\nX: y; filename=evil.exe/../..\\');
    expect(name).not.toMatch(/["\r\n/\\ ]/);
    expect(isExportFileName(name)).toBe(true);
  });
});

describe('exportFileName is never cut (OQ-PM-11 answered: "Don\'t limit the characters"; AQP-391)', () => {
  it('keeps every character of the longest short name and the longest subject the forms allow', () => {
    const shortName = 'S'.repeat(CUSTOMER_SHORT_NAME_MAX_LENGTH);
    const subject = 'x'.repeat(SUBJECT_MAX_LENGTH);
    const name = nameOf(shortName, subject);
    expect(name).toBe(`${shortName}_${subject}_${DATE}.xlsx`);
    // The two parts, the two separators and the date: nothing is cut, and the date is whole.
    expect(lengthOf(stemOf(name))).toBe(CUSTOMER_SHORT_NAME_MAX_LENGTH + SUBJECT_MAX_LENGTH + 2 + DATE.length);
    expect(isExportFileName(name)).toBe(true);
  });

  it('keeps every character at the database ceilings as well (a short name of 20, a subject of 200)', () => {
    const name = nameOf('S'.repeat(20), 'y'.repeat(200));
    expect(name).toBe(`${'S'.repeat(20)}_${'y'.repeat(200)}_${DATE}.xlsx`);
    expect(isExportFileName(name)).toBe(true);
  });

  it('keeps every code point outside the BMP of both parts', () => {
    const name = nameOf('🔧'.repeat(CUSTOMER_SHORT_NAME_MAX_LENGTH), '🔩'.repeat(SUBJECT_MAX_LENGTH));
    expect(name).toBe(`${'🔧'.repeat(CUSTOMER_SHORT_NAME_MAX_LENGTH)}_${'🔩'.repeat(SUBJECT_MAX_LENGTH)}_${DATE}.xlsx`);
  });

  it('does not cut a text longer than any form allows: the builder holds no limit, the fields do (the name is the parts, the separators and the date)', () => {
    const subject = 'z'.repeat(5000);
    expect(nameOf('MAS', subject)).toBe(`MAS_${subject}_${DATE}.xlsx`);
  });

  it('does not cut the task code that stands in for a missing subject', () => {
    const code = `Q-${'9'.repeat(150)}`;
    expect(nameOf('MAS', null, NOON_UTC, code)).toBe(`MAS_${code}_${DATE}.xlsx`);
  });

  it('keeps the date whole at the end whatever the parts', () => {
    expect(nameOf('S'.repeat(300), 'y'.repeat(300)).endsWith(`_${DATE}.xlsx`)).toBe(true);
  });
});

describe('exportFileName invisible characters (AQP-391 review QLT-01)', () => {
  it.each([
    ['a Hangul filler (U+3164)', '\u3164'],
    ['a halfwidth Hangul filler (U+FFA0)', '\uFFA0'],
    ['a combining grapheme joiner (U+034F)', '\u034F'],
    ['a variation selector (U+FE0F)', '\uFE0F'],
    ['a soft hyphen (U+00AD)', '\u00AD'],
  ])('a subject of only %s falls back to the task code, so no part looks empty', (_label, character) => {
    expect(nameOf('MAS', character)).toBe(`MAS_${TASK_CODE}_${DATE}.xlsx`);
    expect(nameOf(character, 'Feed')).toBe(`Customer_Feed_${DATE}.xlsx`);
  });

  it('removes such a character from inside a part', () => {
    expect(nameOf('MAS', 'a\uFE0Fb\u3164c')).toBe(`MAS_abc_${DATE}.xlsx`);
  });

  it('is refused by isExportFileName', () => {
    for (const character of ['\u3164', '\u034F', '\uFE0F', '\uFFA0']) expect(isExportFileName(`M${character}_x_${DATE}.xlsx`), character).toBe(false);
  });
});

describe('exportFileName leading dot (AQP-391 review QLT-02)', () => {
  it('turns each leading dot of the short name into a hyphen, so the name is not hidden and the browser saves what the card shows', () => {
    expect(nameOf('.MAS', 'x')).toBe(`-MAS_x_${DATE}.xlsx`);
    expect(nameOf('..', 'x')).toBe(`--_x_${DATE}.xlsx`);
    expect(nameOf('...M.A', 'x')).toBe(`---M.A_x_${DATE}.xlsx`);
  });

  it('keeps a dot that is not leading, and a dot at the start of the subject (it is not the start of the name)', () => {
    expect(nameOf('M.A.S', '.x.')).toBe(`M.A.S_.x._${DATE}.xlsx`);
  });

  it('is refused by isExportFileName when the stem starts with a dot', () => {
    expect(isExportFileName(`.a_x_${DATE}.xlsx`)).toBe(false);
    expect(isExportFileName(`..a_x_${DATE}.xlsx`)).toBe(false);
    expect(isExportFileName(`a._x_${DATE}.xlsx`)).toBe(true);
  });
});

describe('exportFileName fallbacks (AQP-391 AC-7)', () => {
  it('uses "Customer" for no short name, and the task code for no subject', () => {
    expect(nameOf(null, null)).toBe('Customer_Q-2026-0001_21-11-2026.xlsx');
  });

  it('uses "Customer" for a short name that is empty after clean-up (only invisible characters)', () => {
    expect(nameOf('\u200B\u0000', 'Feed')).toBe('Customer_Feed_21-11-2026.xlsx');
    expect(nameOf('', 'Feed')).toBe('Customer_Feed_21-11-2026.xlsx');
  });

  it('uses the task code for a subject that is empty after clean-up', () => {
    expect(nameOf('MAS', '\u200B\u202E')).toBe('MAS_Q-2026-0001_21-11-2026.xlsx');
    expect(nameOf('MAS', '')).toBe('MAS_Q-2026-0001_21-11-2026.xlsx');
  });

  it('does not use the fallback for a subject of only hyphens (it is valid)', () => {
    expect(nameOf('MAS', ' ')).toBe('MAS_-_21-11-2026.xlsx');
  });

  it('never holds "null", "undefined" or an empty part', () => {
    for (const name of [nameOf(null, null), nameOf('', ''), nameOf('\u200B', '\u200B')]) {
      expect(name).not.toMatch(/null|undefined|__|^_|_\./);
    }
  });

  it('cleans the task code that stands in for the subject, so no code can carry a character into a header', () => {
    expect(nameOf('MAS', null, NOON_UTC, 'Q-2026-0001"\r\nX: y')).toBe('MAS_Q-2026-0001---X--y_21-11-2026.xlsx');
  });

  it('refuses a task code with nothing usable in it when it has to stand in (a mistake in the code)', () => {
    expect(() => nameOf('MAS', null, NOON_UTC, '\u200B')).toThrow(RangeError);
  });
});

describe('exportFileName date (AQP-391 AC-2)', () => {
  it.each([
    ['2026-11-14T18:29:59.999Z', '14-11-2026'],
    ['2026-11-14T18:30:00.000Z', '15-11-2026'],
    ['2026-12-31T18:29:59.999Z', '31-12-2026'],
    ['2026-12-31T18:30:00.000Z', '01-01-2027'],
    ['2026-02-28T18:30:00.000Z', '01-03-2026'],
    ['2028-02-28T18:29:59.999Z', '28-02-2028'],
    ['2028-02-28T18:30:00.000Z', '29-02-2028'],
  ])('puts %s on the IST date %s', (instant, expected) => {
    expect(nameOf('MAS', 'x', new Date(instant))).toBe(`MAS_x_${expected}.xlsx`);
  });

  it('refuses a date that is not one', () => {
    expect(() => nameOf('MAS', 'x', new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe('isExportFileName (AQP-391 AC-8)', () => {
  it('accepts the names the builder makes, including non-ASCII ones and hyphens and dots', () => {
    expect(isExportFileName('MAS_Feed-hopper_21-11-2026.xlsx')).toBe(true);
    expect(isExportFileName('M_Kühler-Ø-40.5-工场_21-11-2026.xlsx')).toBe(true);
    expect(isExportFileName('a.xlsx')).toBe(true);
  });

  it('holds no length limit: a long name is a name (the fields bound it, not the check)', () => {
    expect(isExportFileName(`${'a'.repeat(5000)}.xlsx`)).toBe(true);
    expect(isExportFileName(`${'🔧'.repeat(300)}.xlsx`)).toBe(true);
  });

  it.each([
    ['no extension', 'MAS_x_21-11-2026'],
    ['another extension', 'MAS_x_21-11-2026.exe'],
    ['an upper-case extension', 'MAS_x_21-11-2026.XLSX'],
    ['a second extension after the first', 'MAS_x.xlsx.exe'],
    ['an empty stem', '.xlsx'],
    ['an empty name', ''],
    ['a space', 'MAS x.xlsx'],
    ['a tab', 'MAS\tx.xlsx'],
    ['a line feed', 'MAS\nx.xlsx'],
    ['a carriage return', 'MAS\rx.xlsx'],
    ['a NUL', 'MAS\u0000x.xlsx'],
    ['a bidirectional override', 'MAS\u202Ex.xlsx'],
    ['a zero-width space', 'MAS\u200Bx.xlsx'],
    ['a lone surrogate', 'MAS\ud800x.xlsx'],
    ['a slash', 'MAS/x.xlsx'],
    ['a backslash', 'MAS\\x.xlsx'],
    ['a colon', 'C:x.xlsx'],
    ['an asterisk', 'MAS*x.xlsx'],
    ['a question mark', 'MAS?x.xlsx'],
    ['a double quote', 'MAS"x.xlsx'],
    ['a less-than sign', 'MAS<x.xlsx'],
    ['a greater-than sign', 'MAS>x.xlsx'],
    ['a vertical bar', 'MAS|x.xlsx'],
  ])('refuses %s', (_label, name) => {
    expect(isExportFileName(name)).toBe(false);
  });

  it('accepts a semicolon, a percent sign and an apostrophe: the header builder encodes them, so they cannot end a parameter', () => {
    expect(isExportFileName("MAS_a;b%c'd_21-11-2026.xlsx")).toBe(true);
  });
});

describe('property: any text a person types gives a valid name (AQP-391 Testing Notes)', () => {
  /** A small deterministic generator, so a failure can be reproduced. */
  function random(seed: number): () => number {
    let state = seed;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }
  const ALPHABET = ['a', 'Z', '0', '_', '-', '.', ' ', '/', '\\', ':', '*', '?', '"', '<', '>', '|', ';', '\r', '\n', '\t', '\u0000', '\u202E', '\u200B', ' ', 'ü', 'Ø', '工', '🔧', '\ud800', '\udc00', 'ü'];

  it('is a name that passes isExportFileName, whatever the length', () => {
    const next = random(391);
    const text = (): string => Array.from({ length: Math.floor(next() * 140) }, () => ALPHABET[Math.floor(next() * ALPHABET.length)]).join('');
    for (let index = 0; index < 500; index += 1) {
      const name = nameOf(next() < 0.2 ? null : text().slice(0, 25), next() < 0.2 ? null : text());
      expect(isExportFileName(name), JSON.stringify(name)).toBe(true);
      expect(name.endsWith(`_${istDayMonthYearOf(NOON_UTC)}.xlsx`)).toBe(true);
    }
  });
});

describe('istDayMonthYearOf (AQP-391 AC-2)', () => {
  it('reads an instant in IST as DD-MM-YYYY, with two digits for the day and the month', () => {
    expect(istDayMonthYearOf(new Date('2026-03-04T05:00:00.000Z'))).toBe('04-03-2026');
  });

  it('is the same calendar date as istIsoDateOf, written the other way round', () => {
    for (const instant of ['2026-11-14T18:29:59.999Z', '2026-11-14T18:30:00.000Z', '2026-12-31T18:30:00.000Z', '2028-02-28T18:30:00.000Z']) {
      const [year, month, day] = istIsoDateOf(new Date(instant)).split('-');
      expect(istDayMonthYearOf(new Date(instant))).toBe(`${day}-${month}-${year}`);
    }
  });

  it('refuses a date that is not one', () => {
    expect(() => istDayMonthYearOf(new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe('istIsoDateOf', () => {
  it('reads an instant in IST', () => {
    expect(istIsoDateOf(new Date('2026-12-31T18:29:59.999Z'))).toBe('2026-12-31');
    expect(istIsoDateOf(new Date('2026-12-31T18:30:00.000Z'))).toBe('2027-01-01');
  });

  it('refuses a date that is not one', () => {
    expect(() => istIsoDateOf(new Date(Number.NaN))).toThrow(RangeError);
  });
});
