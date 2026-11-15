import { describe, expect, it } from 'vitest';

import { forbiddenCalculated, numericScalars } from '../support/calculated-values';

/**
 * Review SQR-02 of AQP-317: the Calculate journey of the confidentiality scan looks for the figures of the estimate's own calculation after the press. This is the list it builds: which figures
 * are watched, in which forms, and which are skipped and why. Every figure here is invented.
 */

const texts = (list: ReturnType<typeof forbiddenCalculated>): string[] => list.map((entry) => entry.text);

describe('numericScalars: the figures inside what the database holds', () => {
  it('finds numbers and numeric text at any depth, and leaves names, nulls and booleans out', () => {
    expect(numericScalars({ a: '1234.5', b: 7, c: { d: ['8', null, true, 'Invented bar', 'Q-2026-9001'] }, e: -3.5, f: Number.NaN })).toEqual(['1234.5', '7', '8', '-3.5']);
  });

  it('leaves out a scalar at the top that is not a figure', () => {
    expect(numericScalars('not a figure')).toEqual([]);
    expect(numericScalars(null)).toEqual([]);
  });
});

describe('forbiddenCalculated: the figures of the calculation that are looked for', () => {
  it('a figure of three integer digits or more is looked for in plain digits, two decimals, Indian grouping and grouping of three', () => {
    // The first four are the figure itself; the last three are its whole-rupee rounding (review SQR-12 of AQP-317, STORY-06.02).
    expect(texts(forbiddenCalculated([{ totalPrice: '1234567.891' }]))).toEqual(['1234567.891', '1234567.89', '12,34,567.89', '1,234,567.89', '12,34,568', '1,234,568', '1234568']);
  });

  it('SQR-12: the whole-rupee rounding is half up, and a grouped form is looked for from 1,000 up, a plain one from six digits', () => {
    // 1234.5 rounds up to 1,235 (Indian and Western grouping agree below 1,00,000, so it is listed once); the plain 1235 has four digits and is not looked for.
    expect(texts(forbiddenCalculated([{ a: '1234.5' }]))).toEqual(['1234.5', '1234.50', '1,234.50', '1,235']);
    // 345.67 rounds to 346: no comma, and fewer than six digits, so nothing of the rounding is added.
    expect(texts(forbiddenCalculated([{ a: '345.67' }]))).toEqual(['345.67']);
    // 99999.5 rounds to 100,000 (a comma, so looked for), and the plain 100000 has six digits, so it is looked for too.
    expect(texts(forbiddenCalculated([{ a: '99999.5' }]))).toEqual(['99999.5', '99999.50', '99,999.50', '1,00,000', '100,000', '100000']);
  });

  it('SQR-12: each rounded form says what it is, and is listed once even when two figures round to the same rupee', () => {
    const list = forbiddenCalculated([{ a: '1234567.1' }, { b: '1234567.4' }]);
    const rounded = list.filter((entry) => entry.reason.includes('rounded to the whole rupee'));
    expect(rounded.map((entry) => entry.text)).toEqual(['12,34,567', '1,234,567', '1234567']);
    expect(rounded[0]?.reason).toBe("a figure of this estimate's own calculation (rounded to the whole rupee, Indian grouping)");
  });

  it('a figure under 100 is not looked for (0, 0.00, 1 and 18.75 appear on screens and in scripts for no reason)', () => {
    expect(forbiddenCalculated([{ a: '0', b: '0.00', c: 1, d: '18.75', e: '99.99' }])).toEqual([]);
  });

  it('100.5 is looked for: the smallest size watched is 100', () => {
    expect(texts(forbiddenCalculated([{ a: '100.5' }]))).toEqual(['100.5', '100.50']);
  });

  it('a whole number is not looked for, whatever its spelling (300, 1000.0000): it is the likeliest to be on a page for another reason', () => {
    expect(forbiddenCalculated([{ a: '300', b: '1000.0000', c: 250 }])).toEqual([]);
  });

  it('a figure the Engineer typed (compared as a number, whatever its spelling) is not looked for', () => {
    expect(forbiddenCalculated([{ a: '200.50' }, [250.5]], [{ length: '200.5' }, { qty: 250.50 }])).toEqual([]);
  });

  it('a figure that is not typed stays, even when others are', () => {
    expect(texts(forbiddenCalculated([{ a: '200.50', b: '512.25' }], [{ length: '200.5' }]))).toEqual(['512.25']);
  });

  it('a negative figure is looked for by its size', () => {
    expect(texts(forbiddenCalculated([{ a: '-345.67' }]))).toEqual(['345.67']);
  });

  it('the same figure in two places is listed once, and each entry says where it comes from', () => {
    const list = forbiddenCalculated([{ a: '345.67' }, { b: '345.67' }]);
    expect(texts(list)).toEqual(['345.67']);
    expect(list[0]?.reason).toBe("a figure of this estimate's own calculation (plain digits)");
  });

  it('nothing to watch gives an empty list, which the journey refuses', () => {
    expect(forbiddenCalculated([])).toEqual([]);
  });
});
