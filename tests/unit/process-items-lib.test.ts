import { describe, expect, it } from 'vitest';

import { MAX_RATE_NAME_LENGTH } from '@/lib/formula';
import {
  DEFAULT_VALUE_MESSAGE,
  defaultValueProblem,
  formatDefaultValue,
  isProcessUnit,
  nameProblem,
  NAME_REQUIRED_MESSAGE,
  NAME_TOO_LONG_MESSAGE,
  normaliseDefaultValue,
  PROCESS_ITEM_NAME_MAX_LENGTH,
  PROCESS_UNITS,
  unitLabel,
} from '@/lib/masters/process-items';

import { PLACEHOLDER_NUMBER_PATTERN } from '../support/placeholder-pattern';
import { SEED_PROCESS_ITEMS } from '../support/seed-config';

/**
 * STORY-02.01 (AC-2): what SCR-11 checks before it sends anything, and the lists it shares with the server. The server's schemas
 * (`process-items-schemas.test.ts`) import the same limits and words, so these tests are the one place they are pinned.
 */

describe('the units (AC-2)', () => {
  it('are exactly the units the 15 seed items use, in the order of first use: second, stroke, hole, kg, sq ft, sq in, %', () => {
    const used = [...new Set(SEED_PROCESS_ITEMS.map((item) => item.unit))];
    expect(used).toEqual([...PROCESS_UNITS]);
  });

  it('know a unit and no other', () => {
    expect(PROCESS_UNITS.every(isProcessUnit)).toBe(true);
    for (const other of ['', 'per', 'per minute', 'PER KG', 'kg']) expect(isProcessUnit(other), other).toBe(false);
  });

  it('read as "₹ per second" and "%" (SCR-11)', () => {
    expect(unitLabel('per second')).toBe('₹ per second');
    expect(unitLabel('per sq in')).toBe('₹ per sq in');
    expect(unitLabel('%')).toBe('%');
  });
});

describe('the name (AC-2)', () => {
  it('is required, and limited to the length the formula engine allows', () => {
    expect(PROCESS_ITEM_NAME_MAX_LENGTH).toBe(MAX_RATE_NAME_LENGTH);
    expect(nameProblem('')).toBe(NAME_REQUIRED_MESSAGE);
    expect(nameProblem('   ')).toBe(NAME_REQUIRED_MESSAGE);
    expect(nameProblem('x'.repeat(PROCESS_ITEM_NAME_MAX_LENGTH))).toBeNull();
    expect(nameProblem(` ${'x'.repeat(PROCESS_ITEM_NAME_MAX_LENGTH)} `)).toBeNull();
    expect(nameProblem('x'.repeat(PROCESS_ITEM_NAME_MAX_LENGTH + 1))).toBe(NAME_TOO_LONG_MESSAGE);
  });
});

describe('the default value (AC-2: a number of 0 or more with up to 2 decimals)', () => {
  it.each(['0', '0.0', '0.00', '7', '7.5', '12.37', '1234567.89', '999999999999.99', ' 3.37 '])('accepts %j', (text) => {
    expect(defaultValueProblem(text)).toBeNull();
  });

  it.each(['', ' ', '-1', '-0', '+1', '1.234', '1.', '.5', '1,000.00', '1e3', '0x1', 'abc', '1 2', '1000000000000.00', '٣'])('refuses %j with the sentence of SCR-11', (text) => {
    expect(defaultValueProblem(text)).toBe(DEFAULT_VALUE_MESSAGE);
    expect(DEFAULT_VALUE_MESSAGE).toBe('Enter a number, 0 or more, with up to 2 decimals.');
  });

  it('is written to two decimals without leading zeros, so two spellings of one number are one value', () => {
    expect(normaliseDefaultValue('12')).toBe('12.00');
    expect(normaliseDefaultValue('3.37')).toBe('3.37');
    expect(normaliseDefaultValue('003.37')).toBe('3.37');
    expect(normaliseDefaultValue('0')).toBe('0.00');
    expect(normaliseDefaultValue(' 0.37 ')).toBe('0.37');
  });

  it('shows a percentage rate with a percent sign and any other as the number', () => {
    expect(formatDefaultValue('11.37', '%')).toBe('11.37 %');
    expect(formatDefaultValue('11.37', 'per kg')).toBe('11.37');
  });

  it('the pattern of invented numbers accepts what the tests use (n.37, ADR-014)', () => {
    expect(PLACEHOLDER_NUMBER_PATTERN.test('12.37')).toBe(true);
  });
});
