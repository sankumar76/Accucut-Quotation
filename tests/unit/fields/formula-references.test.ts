import { describe, expect, it } from 'vitest';

import {
  extractReferences,
  FormulaReferenceError,
  referenceFromParts,
  toDisplayForm,
  toInternalForm,
  type ReferenceContext,
} from '@/lib/fields/formula-references';

/** AC-5: stable references in storage, letters and names on screen, and the two forms convert both ways. */

// Invented IDs and names; no rate value exists in this file.
const FIELD_A = '00000000-0000-4000-8000-0aaa00000001';
const FIELD_B = '00000000-0000-4000-8000-0aaa00000002';
const FIELD_C = '00000000-0000-4000-8000-0aaa00000003';
const RATE_X = '00000000-0000-4000-8000-0bbb00000001';
const RATE_SPACED = '00000000-0000-4000-8000-0bbb00000002';
const RATE_PERCENT = '00000000-0000-4000-8000-0bbb00000003';

const context: ReferenceContext = {
  fieldIds: [FIELD_A, FIELD_B, FIELD_C],
  rates: [
    { id: RATE_X, name: 'Test-Rate-per-kg' },
    { id: RATE_SPACED, name: 'Test Spaced Rate' },
    { id: RATE_PERCENT, name: 'Test Share %' },
  ],
};

describe('toInternalForm (AC-5)', () => {
  it.each([
    ['a column letter', 'A', `{{f:${FIELD_A}}}`],
    ['the third letter', 'C', `{{f:${FIELD_C}}}`],
    ['a rate name', 'Test-Rate-per-kg', `{{rate:${RATE_X}}}`],
    ['a rate name with a space', 'Test Spaced Rate', `{{rate:${RATE_SPACED}}}`],
    ['a rate name ending in a percent sign', 'Test Share %', `{{rate:${RATE_PERCENT}}}`],
    ['a material operand', 'Material-Scrap-Rate', '{{mat:scrapRate}}'],
    ['the price per kg', 'Material-Price-per-kg', '{{mat:pricePerKg}}'],
    ['the specific gravity', 'Material-Specific-Gravity', '{{mat:specificGravity}}'],
    ['an exchange rate', 'ExchangeRate-USD', '{{fx:USD}}'],
    ['the euro rate', 'ExchangeRate-EUR', '{{fx:EUR}}'],
    ['a number, an operator and brackets', '(A * 2) / 645', `({{f:${FIELD_A}}} * 2) / 645`],
    ['a decimal literal', 'A * 0.5', `{{f:${FIELD_A}}} * 0.5`],
    ['a function call', 'SUM(B)', `SUM({{f:${FIELD_B}}})`],
    ['a function call with a space before the bracket', 'SUM (B)', `SUM ({{f:${FIELD_B}}})`],
    ['a comparison', 'IF(A >= 1, B, 0)', `IF({{f:${FIELD_A}}} >= 1, {{f:${FIELD_B}}}, 0)`],
    ['a name that ends the text', 'A * Test Spaced Rate', `{{f:${FIELD_A}}} * {{rate:${RATE_SPACED}}}`],
  ])('stores %s as a reference', (_name, display, internal) => {
    expect(toInternalForm(display, context)).toBe(internal);
  });

  it('refuses a column the registry does not have', () => {
    expect(() => toInternalForm('D', context)).toThrow(FormulaReferenceError);
  });

  it('refuses a word that is no column, rate or material name, and says which', () => {
    expect(() => toInternalForm('A * Mystery', context)).toThrow('"Mystery"');
    expect(() => toInternalForm('A * Test-Rate-per-kgs', context)).toThrow(FormulaReferenceError);
    expect(() => toInternalForm('A * a', context)).toThrow(FormulaReferenceError);
  });

  it('refuses a character that is not part of a formula, and braces typed by hand', () => {
    expect(() => toInternalForm('A # B', context)).toThrow(/not allowed/);
    expect(() => toInternalForm('{{f:x}}', context)).toThrow(/braces/);
  });
});

describe('toDisplayForm (AC-5)', () => {
  it('shows letters from the fields\' current positions', () => {
    const stored = `{{f:${FIELD_A}}} + {{f:${FIELD_C}}}`;
    expect(toDisplayForm(stored, context)).toBe('A + C');
    // Insert a field at the front: every later letter moves one on, with the stored text unchanged.
    const shifted = { ...context, fieldIds: ['00000000-0000-4000-8000-0ccc00000001', ...context.fieldIds] };
    expect(toDisplayForm(stored, shifted)).toBe('B + D');
  });

  it('shows a renamed rate by its new name', () => {
    const stored = `A * {{rate:${RATE_X}}}`.replace('A', `{{f:${FIELD_A}}}`);
    const renamed = { ...context, rates: [{ id: RATE_X, name: 'Renamed rate' }] };
    expect(toDisplayForm(stored, renamed)).toBe('A * Renamed rate');
  });

  it('round-trips: display, internal, display', () => {
    for (const display of ['A', 'SUM(B) / C', 'IF(Material-Specific-Gravity > 0, A - B, 0)', 'ExchangeRate-USD * Test Share %', '0']) {
      expect(toDisplayForm(toInternalForm(display, context), context)).toBe(display);
    }
  });

  it.each([
    ['a field that is not in the registry', '{{f:00000000-0000-4000-8000-0ddd00000000}}'],
    ['a rate that is not in the Process Master', '{{rate:00000000-0000-4000-8000-0ddd00000000}}'],
    ['a material value that does not exist', '{{mat:density}}'],
    ['an exchange rate that does not exist', '{{fx:JPY}}'],
    ['a malformed reference', '{{f:'],
  ])('refuses %s', (_name, stored) => {
    expect(() => toDisplayForm(stored, context)).toThrow(FormulaReferenceError);
  });
});

describe('extractReferences', () => {
  it('lists every reference in order and ignores everything else', () => {
    expect(extractReferences(`IF({{mat:specificGravity}} > 0, {{f:${FIELD_A}}} * {{rate:${RATE_X}}}, {{fx:EUR}})`)).toEqual([
      { kind: 'material', key: 'specificGravity' },
      { kind: 'field', id: FIELD_A },
      { kind: 'rate', id: RATE_X },
      { kind: 'exchange', currency: 'EUR' },
    ]);
    expect(extractReferences('0')).toEqual([]);
  });

  it('refuses text with a brace that is not part of a reference', () => {
    expect(() => extractReferences('A } B')).toThrow(FormulaReferenceError);
    expect(() => extractReferences('{{unknown:1}}')).toThrow(FormulaReferenceError);
  });

  it('STD-04: reads each of the four prefixes by name, and refuses a fifth rather than guessing exchange rate', () => {
    expect(referenceFromParts('f', 'x')).toEqual({ kind: 'field', id: 'x' });
    expect(referenceFromParts('rate', 'x')).toEqual({ kind: 'rate', id: 'x' });
    expect(referenceFromParts('mat', 'x')).toEqual({ kind: 'material', key: 'x' });
    expect(referenceFromParts('fx', 'USD')).toEqual({ kind: 'exchange', currency: 'USD' });
    expect(() => referenceFromParts('tax', 'x')).toThrow(FormulaReferenceError);
  });

  it('carries a stable error code', () => {
    try {
      extractReferences('{');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toMatchObject({ code: 'FORMULA_REFERENCE_INVALID', httpStatus: 422 });
    }
  });
});
