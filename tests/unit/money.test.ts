import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { formatCount, formatFigure, formatRupees, groupIndian, NO_FIGURE, toTwoPlaces } from '@/lib/money';

/**
 * STORY-06.02 AC-1 (BL in rupees, Indian grouping, 2 decimals), FR-027: how a stored figure is written on a screen. The rounding is held against `decimal.js` (half away from zero, as Excel
 * does) for a spread of invented figures, so the string arithmetic cannot drift from the calculator's own. Every number is invented.
 */

describe('groupIndian: the last three digits, then pairs', () => {
  it.each([
    ['0', '0'],
    ['999', '999'],
    ['1000', '1,000'],
    ['12345', '12,345'],
    ['123456', '1,23,456'],
    ['1234567', '12,34,567'],
    ['12345678', '1,23,45,678'],
    ['123456789012', '1,23,45,67,89,012'],
  ])('%s is written %s', (digits, written) => {
    expect(groupIndian(digits)).toBe(written);
  });
});

describe('toTwoPlaces: half away from zero, on text', () => {
  it.each([
    ['0', '0.00'],
    ['30', '30.00'],
    ['12629.99', '12629.99'],
    ['1234.565', '1234.57'],
    ['1234.564999', '1234.56'],
    ['0.005', '0.01'],
    ['0.004', '0.00'],
    ['99.995', '100.00'],
    ['-1234.565', '-1234.57'],
    ['-0.004', '0.00'],
    ['0012.5', '12.50'],
    ['7.999999999', '8.00'],
  ])('%s gives %s', (stored, written) => {
    expect(toTwoPlaces(stored)).toBe(written);
  });

  it('gives null for text that is no decimal, and never throws', () => {
    for (const text of ['', 'abc', '1e5', '1,5', '--1', '.5', '5.', 'NaN']) expect(toTwoPlaces(text)).toBeNull();
  });

  it('agrees with decimal.js (half away from zero) for a spread of figures', () => {
    const samples = ['1.005', '2.675', '10.555', '123456.785', '0.995', '5.5', '0.001', '99999999.995', '3.14159265358979', '1000000.5', '-2.675', '-0.995'];
    for (const sample of samples) {
      expect(toTwoPlaces(sample)).toBe(new Decimal(sample).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2).replace(/^-0\.00$/, '0.00'));
    }
  });
});

describe('formatFigure and formatRupees (AC-1)', () => {
  it('writes two decimals with Indian grouping and the rupee sign', () => {
    expect(formatFigure('1234567.891')).toBe('12,34,567.89');
    expect(formatRupees('1234567.891')).toBe('₹ 12,34,567.89');
    expect(formatRupees('12629.99')).toBe('₹ 12,629.99');
    expect(formatRupees('30')).toBe('₹ 30.00');
  });

  it('keeps the sign of a negative figure', () => {
    expect(formatFigure('-1234.5')).toBe('-1,234.50');
  });

  it('writes a dash for no figure, and for text that is no decimal', () => {
    expect(formatFigure(null)).toBe(NO_FIGURE);
    expect(formatRupees(null)).toBe(NO_FIGURE);
    expect(formatFigure('abc')).toBe(NO_FIGURE);
    expect(formatRupees('abc')).toBe(NO_FIGURE);
  });
});

describe('formatCount: a count as typed', () => {
  it.each([
    ['24.00', '24'],
    ['2', '2'],
    ['2.50', '2.5'],
    ['0.00', '0'],
    ['1200', '1,200'],
    ['007', '7'],
    ['-3.0', '-3'],
  ])('%s is written %s', (stored, written) => {
    expect(formatCount(stored)).toBe(written);
  });

  it('writes a dash when there is none or it is no decimal', () => {
    expect(formatCount(null)).toBe(NO_FIGURE);
    expect(formatCount('abc')).toBe(NO_FIGURE);
  });
});
