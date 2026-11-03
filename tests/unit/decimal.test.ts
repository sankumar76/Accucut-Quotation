import DecimalJs from 'decimal.js';
import { describe, expect, it } from 'vitest';

import {
  add,
  DECIMAL_PRECISION,
  Decimal,
  divide,
  multiply,
  negate,
  sameValue,
  subtract,
  type Value,
} from '@/lib/decimal';

/**
 * AC-2 (FR-027, BR-025): money is exact, with one configured Decimal. AC-3 (FR-026): `null` is "no figure"
 * and spreads. Every number below is invented and worked by hand.
 */

const show = (value: Value): string | null => (value === null ? null : value.toFixed());

describe('the configured Decimal (AC-2)', () => {
  it('AC-2: keeps 34 significant digits', () => {
    expect(DECIMAL_PRECISION).toBe(34);
    // 1 / 3 to 34 significant digits, worked by hand: 34 threes after "0."
    expect(show(divide(new Decimal(1), new Decimal(3)))).toBe(`0.${'3'.repeat(34)}`);
  });

  it('AC-2: rounds half-up, away from zero on a tie', () => {
    expect(show(new Decimal('2.5').toDecimalPlaces(0))).toBe('3');
    expect(show(new Decimal('-2.5').toDecimalPlaces(0))).toBe('-3');
    expect(show(new Decimal('1.005').toDecimalPlaces(2))).toBe('1.01');
    expect(show(new Decimal('1.004').toDecimalPlaces(2))).toBe('1');
  });

  it('AC-2: is a private clone, so the library default used by other code is not changed', () => {
    expect(DecimalJs.precision).toBe(20);
    expect(DecimalJs.rounding).toBe(DecimalJs.ROUND_HALF_UP);
    expect(Decimal.precision).toBe(34);
  });

  it.each([
    ['a very small value', '0.0000000000000000000000000001', '0.0000000000000000000000000001'],
    ['a small quotient', '1e-10', '0.0000000001'],
    ['a very large value', '123456789012345678901234567890', '123456789012345678901234567890'],
    ['a large product', '1e30', '1000000000000000000000000000000'],
    ['a small negative value', '-0.00000000000000000025', '-0.00000000000000000025'],
  ])('QLT-16: %s is written as a plain decimal string, never in exponent form', (_name, input, expected) => {
    const value = new Decimal(input);
    expect(value.toString()).toBe(expected);
    expect(String(value)).toBe(expected);
    expect(JSON.stringify({ value })).toBe(`{"value":"${expected}"}`);
  });

  it('QLT-16: a result of arithmetic is plain as well', () => {
    expect(String(divide(new Decimal(1), new Decimal('10000000000')))).toBe('0.0000000001');
    expect(String(multiply(new Decimal('1000000000000000'), new Decimal('1000000000000000')))).toBe('1000000000000000000000000000000');
  });

  it('AC-2: 0.1 + 0.2 is exactly 0.3', () => {
    expect(show(add(new Decimal('0.1'), new Decimal('0.2')))).toBe('0.3');
  });

  it('AC-2 (property): adding many decimal strings is exact, as scaled whole-number arithmetic shows', () => {
    // A small deterministic generator (mulberry32), so a failure can be replayed.
    let seed = 0x2f6e2b1;
    const next = (): number => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const SCALE = 1_000_000n;
    for (let round = 0; round < 50; round += 1) {
      let expected = 0n;
      let actual: Value = new Decimal(0);
      for (let step = 0; step < 200; step += 1) {
        const whole = BigInt(Math.floor(next() * 1e9));
        const fraction = BigInt(Math.floor(next() * 1e6));
        const negative = next() < 0.3;
        const text = `${negative ? '-' : ''}${whole}.${fraction.toString().padStart(6, '0')}`;
        expected += (negative ? -1n : 1n) * (whole * SCALE + fraction);
        actual = add(actual, new Decimal(text));
      }
      const sign = expected < 0n ? '-' : '';
      const magnitude = expected < 0n ? -expected : expected;
      const exactText = `${sign}${magnitude / SCALE}.${(magnitude % SCALE).toString().padStart(6, '0')}`;
      expect(actual?.equals(new Decimal(exactText))).toBe(true);
    }
  });
});

describe('null propagation (AC-3)', () => {
  const two = new Decimal(2);
  const zero = new Decimal(0);

  it.each([
    ['add', add],
    ['subtract', subtract],
    ['multiply', multiply],
    ['divide', divide],
  ])('AC-3: %s gives null when either side has no figure', (_name, operation) => {
    expect(operation(null, two)).toBeNull();
    expect(operation(two, null)).toBeNull();
    expect(operation(null, null)).toBeNull();
  });

  it('AC-3: negate gives null for no figure', () => {
    expect(negate(null)).toBeNull();
  });

  it('AC-3: a divisor of 0 gives null, without throwing, and never Infinity or NaN', () => {
    expect(divide(two, zero)).toBeNull();
    expect(divide(zero, zero)).toBeNull();
    expect(divide(new Decimal(-2), new Decimal('-0'))).toBeNull();
  });

  it('works out each operator on invented numbers', () => {
    expect(show(add(new Decimal('7.5'), new Decimal('2.25')))).toBe('9.75');
    expect(show(subtract(new Decimal('7.5'), new Decimal('2.25')))).toBe('5.25');
    expect(show(multiply(new Decimal('7.5'), new Decimal('2.25')))).toBe('16.875');
    expect(show(divide(new Decimal('7.5'), new Decimal('2.5')))).toBe('3');
    expect(show(negate(new Decimal('7.5')))).toBe('-7.5');
  });

  it('compares two values, with "no figure" equal only to itself', () => {
    expect(sameValue(null, null)).toBe(true);
    expect(sameValue(null, zero)).toBe(false);
    expect(sameValue(zero, null)).toBe(false);
    expect(sameValue(new Decimal('2.0'), new Decimal('2'))).toBe(true);
    expect(sameValue(new Decimal('2.1'), new Decimal('2'))).toBe(false);
  });
});
