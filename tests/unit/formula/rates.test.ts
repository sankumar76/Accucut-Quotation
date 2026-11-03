import { describe, expect, it } from 'vitest';

import { Decimal } from '@/lib/decimal';
import { createRateLookup, formulaRateValue, isPercentRate, type RateValue } from '@/lib/formula';

import { d, show } from '../../support/formula-fixtures';

/** AC-2 and FR-028: a rate whose name ends in " %" is divided by 100 in one place. Invented names and values. */

describe('isPercentRate (FR-028)', () => {
  it.each([
    ['Test Share %', true],
    ['OH Profit %', true],
    ['Inspection & Packing %', true],
    ['Test-Rate-per-kg', false],
    // The rule is " %" at the end, as SPEC section 4.1 names them: no space, no percentage.
    ['Share%', false],
    ['Test % Share', false],
    ['', false],
  ])('%s is a percent rate: %s', (name, expected) => {
    expect(isPercentRate(name)).toBe(expected);
  });
});

describe('formulaRateValue (AC-2, FR-028)', () => {
  it('AC-2: a typed 12 is 0.12 for a percent rate', () => {
    expect(show(formulaRateValue('Test Share %', d('12')))).toBe('0.12');
  });

  it('AC-2: a decimal percentage is scaled exactly', () => {
    expect(show(formulaRateValue('Test Share %', d('2.5')))).toBe('0.025');
    expect(show(formulaRateValue('Test Share %', d('0.07')))).toBe('0.0007');
  });

  it('AC-2: a percent rate typed as 0 stays 0', () => {
    expect(show(formulaRateValue('Test Share %', d('0')))).toBe('0');
  });

  it('AC-2: any other rate is unchanged', () => {
    expect(show(formulaRateValue('Test-Rate-per-kg', d('12')))).toBe('12');
  });

  it('AC-3: no value stays no value, percent or not', () => {
    expect(formulaRateValue('Test Share %', null)).toBeNull();
    expect(formulaRateValue('Test-Rate-per-kg', null)).toBeNull();
  });
});

describe('createRateLookup (AC-2)', () => {
  const rates: RateValue[] = [
    { id: 'rate-plain', name: 'Test-Rate-per-kg', value: new Decimal('3') },
    { id: 'rate-percent', name: 'Test Share %', value: new Decimal('12') },
    { id: 'rate-empty', name: 'Test Empty Rate', value: null },
  ];
  const lookup = createRateLookup(rates);

  it('applies the percent rule in this one place', () => {
    expect(show(lookup('rate-plain'))).toBe('3');
    expect(show(lookup('rate-percent'))).toBe('0.12');
  });

  it('gives no figure for a rate with no value, and for a rate that is not in the list', () => {
    expect(lookup('rate-empty')).toBeNull();
    expect(lookup('rate-missing')).toBeNull();
  });
});
