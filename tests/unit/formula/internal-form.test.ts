import { describe, expect, it } from 'vitest';

import { indexToColumnLetter } from '@/lib/columns';
import {
  extractReferences,
  FormulaError,
  formatReference,
  toDisplayForm,
  toInternalForm,
  type ReferenceContext,
} from '@/lib/formula';

import {
  CONTEXT,
  fieldAt,
  fieldIdOf,
  RATE_AMPERSAND,
  RATE_COLUMN_PREFIX,
  RATE_HYPHENS,
  RATE_PERCENT,
  RATE_PLAIN,
  RATE_SPACED,
} from '../../support/formula-fixtures';
import { thrownAs } from '../../support/thrown';

/**
 * AC-6 (the one converter, on the tokenizer) and AC-1 (names resolve as they do in the parser). Invented IDs
 * and rate names only; no rate value exists in this file.
 */

const A = fieldAt('A');
const B = fieldAt('B');
const C = fieldAt('C');

describe('toInternalForm (AC-6)', () => {
  it.each([
    ['a column letter', 'A', `{{f:${A}}}`],
    ['a later letter', 'C', `{{f:${C}}}`],
    ['two letters', 'AB', `{{f:${fieldAt('AB')}}}`],
    ['a rate name', 'Test-Rate-per-kg', `{{rate:${RATE_PLAIN}}}`],
    ['a rate name with a space', 'Test Spaced Rate', `{{rate:${RATE_SPACED}}}`],
    ['a rate name ending in a percent sign', 'Test Share %', `{{rate:${RATE_PERCENT}}}`],
    ['a rate name with an ampersand', 'Inspection & Packing %', `{{rate:${RATE_AMPERSAND}}}`],
    ['a hyphenated rate name, not a subtraction', 'Cutting-Rate-per-Sec', `{{rate:${RATE_HYPHENS}}}`],
    ['a rate name that begins with a column\'s letters', 'OH Profit %', `{{rate:${RATE_COLUMN_PREFIX}}}`],
    ['the price per kg', 'Material-Price-per-kg', '{{mat:pricePerKg}}'],
    ['the specific gravity', 'Material-Specific-Gravity', '{{mat:specificGravity}}'],
    ['the scrap rate', 'Material-Scrap-Rate', '{{mat:scrapRate}}'],
    ['an exchange rate', 'ExchangeRate-USD', '{{fx:USD}}'],
    ['the euro rate', 'ExchangeRate-EUR', '{{fx:EUR}}'],
    ['numbers, operators and brackets', '(A * 2) / 645', `({{f:${A}}} * 2) / 645`],
    ['a decimal literal', 'A * 0.5', `{{f:${A}}} * 0.5`],
    ['a function call', 'SUM(B)', `SUM({{f:${B}}})`],
    ['a function call with a space before the bracket', 'SUM (B)', `SUM ({{f:${B}}})`],
    ['a comparison', 'IF(A >= 1, B, 0)', `IF({{f:${A}}} >= 1, {{f:${B}}}, 0)`],
    ['a name that ends the text', 'A * Test Spaced Rate', `{{f:${A}}} * {{rate:${RATE_SPACED}}}`],
    ['a name followed by an operator with no space', 'Test Share %*A', `{{rate:${RATE_PERCENT}}}*{{f:${A}}}`],
    ['empty text', '', ''],
  ])('AC-6: stores %s as a reference', (_name, display, internal) => {
    expect(toInternalForm(display, CONTEXT)).toBe(internal);
  });

  it('AC-6: copies spaces, tabs and line breaks around the operands unchanged', () => {
    expect(toInternalForm('  A \t+\n B  ', CONTEXT)).toBe(`  {{f:${A}}} \t+\n {{f:${B}}}  `);
  });

  it('AC-1: a name beats a shorter name or a column that it contains, whichever order the rates are listed', () => {
    const rates = [
      { id: fieldIdOf(901), name: 'Foam' },
      { id: fieldIdOf(902), name: 'Foam Cost' },
    ];
    for (const list of [rates, [...rates].reverse()]) {
      const context: ReferenceContext = { fieldIds: CONTEXT.fieldIds, rates: list };
      expect(toInternalForm('Foam Cost', context)).toBe(`{{rate:${fieldIdOf(902)}}}`);
      expect(toInternalForm('Foam', context)).toBe(`{{rate:${fieldIdOf(901)}}}`);
    }
  });

  it('AC-5: refuses a column the registry does not have, naming it in the issue and not in the message', () => {
    const error = thrownAs(() => toInternalForm('A + ZZZ', CONTEXT), FormulaError);
    expect(error.issue).toMatchObject({ code: 'UNKNOWN_COLUMN', name: 'ZZZ', position: 5 });
    expect(error.message).not.toContain('ZZZ');
  });

  it('AC-5: refuses a word that is no column, rate or material name', () => {
    expect(thrownAs(() => toInternalForm('A * Mystery', CONTEXT), FormulaError).issue).toMatchObject({ code: 'UNKNOWN_NAME', name: 'Mystery' });
    expect(thrownAs(() => toInternalForm('A * Test-Rate-per-kgs', CONTEXT), FormulaError).issue.code).toBe('UNKNOWN_NAME');
    expect(thrownAs(() => toInternalForm('A * a', CONTEXT), FormulaError).issue.code).toBe('UNKNOWN_NAME');
  });

  it('refuses a character that is not part of a formula, and braces typed by hand', () => {
    expect(thrownAs(() => toInternalForm('A # B', CONTEXT), FormulaError).issue.code).toBe('INVALID_CHARACTER');
    expect(thrownAs(() => toInternalForm('{{f:x}}', CONTEXT), FormulaError).issue.code).toBe('BRACES_IN_DISPLAY_FORM');
  });

  it('carries a stable error code and the validation status', () => {
    expect(thrownAs(() => toInternalForm('#', CONTEXT), FormulaError)).toMatchObject({ code: 'FORMULA_INVALID', httpStatus: 422 });
  });
});

describe('toDisplayForm (AC-6)', () => {
  it('AC-6: shows letters from the fields\' current positions', () => {
    const stored = `{{f:${A}}} + {{f:${C}}}`;
    expect(toDisplayForm(stored, CONTEXT)).toBe('A + C');
  });

  it('AC-6: re-lettering: a field inserted at the front moves every later letter on, with no rewrite of the stored text', () => {
    const stored = `{{f:${A}}} + {{f:${C}}}`;
    const inserted: ReferenceContext = { ...CONTEXT, fieldIds: [fieldIdOf(9001), ...CONTEXT.fieldIds] };
    expect(toDisplayForm(stored, inserted)).toBe('B + D');
    // And a field deleted from the front moves them back.
    const deleted: ReferenceContext = { ...CONTEXT, fieldIds: CONTEXT.fieldIds.slice(1) };
    expect(toDisplayForm(`{{f:${B}}}`, deleted)).toBe('A');
  });

  it('AC-6: shows a renamed rate by its new name, with no change to the stored text', () => {
    const stored = `{{f:${A}}} * {{rate:${RATE_PLAIN}}}`;
    const renamed: ReferenceContext = { ...CONTEXT, rates: [{ id: RATE_PLAIN, name: 'Renamed rate' }] };
    expect(toDisplayForm(stored, renamed)).toBe('A * Renamed rate');
  });

  it('AC-6: the round trip is exact, spaces and all', () => {
    for (const display of [
      'A',
      'SUM(B) / C',
      'IF(Material-Specific-Gravity > 0, A - B, 0)',
      'ExchangeRate-USD * Test Share %',
      '0',
      '  A  +\tB ',
      'IF (A <> B , 1 , 2)',
      'Cutting-Rate-per-Sec*OH Profit %-Inspection & Packing %',
      '-(A + B) / 3.50',
    ]) {
      const stored = toInternalForm(display, CONTEXT);
      expect(toDisplayForm(stored, CONTEXT)).toBe(display);
      expect(toInternalForm(toDisplayForm(stored, CONTEXT), CONTEXT)).toBe(stored);
    }
  });

  it('AC-6: letters stay exact for fields far along the registry', () => {
    for (const position of [26, 27, 52, 53, 67, 100, 400]) {
      const letters = indexToColumnLetter(position);
      expect(toDisplayForm(`{{f:${fieldIdOf(position)}}}`, CONTEXT)).toBe(letters);
      expect(toInternalForm(letters, CONTEXT)).toBe(`{{f:${fieldIdOf(position)}}}`);
    }
  });

  it.each([
    ['a field that is not in the registry', '{{f:00000000-0000-4000-8000-0ddd00000000}}', 'BAD_FIELD_REFERENCE'],
    ['a rate that is not in the Process Master', '{{rate:00000000-0000-4000-8000-0ddd00000000}}', 'UNKNOWN_RATE'],
    ['a material value that does not exist', '{{mat:density}}', 'BAD_MATERIAL_REFERENCE'],
    ['an exchange rate that does not exist', '{{fx:JPY}}', 'BAD_EXCHANGE_REFERENCE'],
    ['a malformed reference', '{{f:', 'BAD_REFERENCE'],
  ])('AC-6: refuses %s', (_name, stored, code) => {
    expect(thrownAs(() => toDisplayForm(stored, CONTEXT), FormulaError).issue.code).toBe(code);
  });

  it('STD-05: an error about a stored reference does not repeat the ID', () => {
    const id = '00000000-0000-4000-8000-0ddd00000000';
    expect(thrownAs(() => toDisplayForm(`{{f:${id}}}`, CONTEXT), FormulaError).message).not.toContain(id);
    expect(thrownAs(() => toDisplayForm(`{{rate:${id}}}`, CONTEXT), FormulaError).message).not.toContain(id);
  });
});

describe('extractReferences and formatReference', () => {
  it('lists every reference in order, repeats included, and ignores everything else', () => {
    expect(extractReferences(`IF({{mat:specificGravity}} > 0, {{f:${A}}} * {{rate:${RATE_PLAIN}}}, {{fx:EUR}}) + {{f:${A}}}`)).toEqual([
      { kind: 'material', key: 'specificGravity' },
      { kind: 'field', id: A },
      { kind: 'rate', id: RATE_PLAIN },
      { kind: 'exchange', currency: 'EUR' },
      { kind: 'field', id: A },
    ]);
    expect(extractReferences('0')).toEqual([]);
  });

  it('refuses text with a brace that is not part of a reference', () => {
    expect(thrownAs(() => extractReferences('1 } 2'), FormulaError).issue.code).toBe('BAD_REFERENCE');
    expect(thrownAs(() => extractReferences('{{unknown:1}}'), FormulaError).issue.code).toBe('BAD_REFERENCE');
  });

  it('writes each of the four kinds as it is stored', () => {
    expect(formatReference({ kind: 'field', id: A })).toBe(`{{f:${A}}}`);
    expect(formatReference({ kind: 'rate', id: RATE_PLAIN })).toBe(`{{rate:${RATE_PLAIN}}}`);
    expect(formatReference({ kind: 'material', key: 'pricePerKg' })).toBe('{{mat:pricePerKg}}');
    expect(formatReference({ kind: 'exchange', currency: 'USD' })).toBe('{{fx:USD}}');
  });

  it('reading what formatReference wrote gives the same reference back', () => {
    const references = [
      { kind: 'field', id: A },
      { kind: 'rate', id: RATE_PLAIN },
      { kind: 'material', key: 'scrapRate' },
      { kind: 'exchange', currency: 'EUR' },
    ] as const;
    for (const reference of references) expect(extractReferences(formatReference(reference))).toEqual([reference]);
  });
});
