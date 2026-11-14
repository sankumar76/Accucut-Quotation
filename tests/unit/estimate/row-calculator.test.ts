import { describe, expect, it } from 'vitest';

import { calculateRowOutputs, type RowCalculationInput } from '@/lib/estimate/row-calculator';
import { displayStoredValue, storeRowOutputs, type StoredRowOutputs } from '@/lib/estimate/row-outputs';
import { Decimal } from '@/lib/decimal';
import { compilePlan } from '@/lib/formula';

import { defined } from '../../support/defined';
import { EXCHANGE, MATERIAL, NOT_APPLICABLE, ROW, TYPED_RATES, WORKED_2DP, WORKED_6DP } from '../../support/row-oracle';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-03.03 AC-1 to AC-6 (SPEC section 7.4 and section 14 item 2): one row's outputs, M to BK, worked out from invented rates, an
 * invented material and invented exchange rates. The row and every hand-worked expected figure are in `tests/support/row-oracle.ts`, where
 * the working of each stage is written beside it.
 */

const plan = compilePlan(seedConfig.fields);
const idOf = (letter: string): string => seedFieldAt(letter).id;

/** The row without these letters: a value that was never sent. */
const without = (...letters: string[]): Record<string, string> => Object.fromEntries(Object.entries(ROW).filter(([letter]) => !letters.includes(letter)));

interface Overrides {
  readonly row?: Readonly<Record<string, string>>;
  readonly rates?: Readonly<Record<string, string>>;
  readonly material?: { readonly pricePerKg: string; readonly specificGravity: string; readonly scrapRate: string };
  readonly exchange?: { readonly usd: string | null; readonly eur: string | null };
}

const decimalOrNull = (text: string | null) => (text === null ? null : new Decimal(text));

function inputFor(overrides: Overrides = {}): RowCalculationInput {
  const rates = { ...TYPED_RATES, ...overrides.rates };
  const material = overrides.material ?? MATERIAL;
  const exchange = overrides.exchange ?? EXCHANGE;
  return {
    document: seedConfig,
    plan,
    inputs: new Map(Object.entries(overrides.row ?? ROW).map(([letter, text]) => [idOf(letter), new Decimal(text)])),
    rates: SEED_PROCESS_ITEMS.map((item) => ({ id: item.id, name: item.name, value: new Decimal(defined(rates[item.name], item.name)) })),
    material: {
      pricePerKg: new Decimal(material.pricePerKg),
      specificGravity: new Decimal(material.specificGravity),
      scrapRate: new Decimal(material.scrapRate),
    },
    exchange: { usd: decimalOrNull(exchange.usd), eur: decimalOrNull(exchange.eur) },
  };
}

function stored(overrides: Overrides = {}): StoredRowOutputs {
  return storeRowOutputs(calculateRowOutputs(inputFor(overrides)));
}

const storedAt = (outputs: StoredRowOutputs, letter: string): string | null => {
  const value = outputs[idOf(letter)];
  if (value === undefined) throw new Error(`The row has no output for ${letter}.`);
  return value;
};


describe('AC-1 (FR-024, SPEC section 14 item 2): every output M to BK equals the hand-worked figure to 2 decimals', () => {
  const outputs = stored();

  it.each(WORKED_2DP)('%s is %s', (letter, expected) => {
    expect(displayStoredValue(storedAt(outputs, letter))).toBe(expected);
  });

  it.each(WORKED_6DP)('%s is %s to 6 decimals', (letter, expected) => {
    expect(new Decimal(defined(storedAt(outputs, letter))).toFixed(6)).toBe(expected);
  });

  it('works out all 29 row outputs of the seed registry and nothing else (the typed fields are not outputs)', () => {
    expect(Object.keys(outputs)).toHaveLength(29);
    for (const letter of ['AP', 'AU', 'H', 'N', 'I']) expect(outputs[idOf(letter)], letter).toBeUndefined();
  });

  it('reads the material rate I from the Material Master: a different price changes Material Cost AK and nothing before it', () => {
    const dearer = stored({ material: { ...MATERIAL, pricePerKg: '70' } });
    // AK = (0.314 x 70) - 2.85 = 21.98 - 2.85 = 19.13
    expect(displayStoredValue(storedAt(dearer, 'AK'))).toBe('19.13');
    expect(storedAt(dearer, 'M')).toBe(storedAt(outputs, 'M'));
    expect(storedAt(dearer, 'AY')).toBe(storedAt(outputs, 'AY'));
  });

  it('applies the count H once, in BB only: with H = 1 every stage after BA is the per-piece figure', () => {
    const one = stored({ row: { ...ROW, H: '1' } });
    expect(storedAt(one, 'BA')).toBe(storedAt(outputs, 'BA'));
    expect(storedAt(one, 'BB')).toBe(storedAt(one, 'BA'));
    // BG = 125.912997 x (1 + 0.12 + 0.025 + 0.05) = 125.912997 x 1.195 = 150.466...
    expect(displayStoredValue(storedAt(one, 'BG'))).toBe('150.47');
  });

  it('is the same row every time: the result does not depend on the order the typed values were listed', () => {
    const reversed = new Map([...inputFor().inputs.entries()].reverse());
    expect(storeRowOutputs(calculateRowOutputs({ ...inputFor(), inputs: reversed }))).toEqual(outputs);
  });
});

describe('AC-2 (FR-028, D-24): a rate named "... %" is typed as a percentage and acts as a fraction', () => {
  // Only Machining Cost is set, so BA = 100, BB = 100 with H = 1, and each percentage of 100 is easy to see.
  const hundred = { H: '1', AP: '100' };

  it('12 acts as 0.12 and 12.5 as 0.125', () => {
    const twelve = stored({ row: hundred, material: NOT_APPLICABLE, rates: { 'OH Profit %': '12' } });
    const twelveAndAHalf = stored({ row: hundred, material: NOT_APPLICABLE, rates: { 'OH Profit %': '12.5' } });
    expect(storedAt(twelve, 'BB')).toBe('100');
    expect(storedAt(twelve, 'BD')).toBe('12');
    expect(storedAt(twelveAndAHalf, 'BD')).toBe('12.5');
  });

  it('feeds Inspection & Packing and Transport the same way, and BG adds the three', () => {
    const outputs = stored({ row: hundred, material: NOT_APPLICABLE });
    expect(storedAt(outputs, 'BE')).toBe('2.5');
    expect(storedAt(outputs, 'BF')).toBe('5');
    // BG = 100 + 0 + 12 + 2.5 + 5
    expect(storedAt(outputs, 'BG')).toBe('119.5');
  });

  it('does not divide a rate that is not a percentage: the cutting rate stays 0.5', () => {
    expect(storedAt(stored({ row: { ...ROW, P: '10' } }), 'AL')).toBe('5');
  });
});

describe('AC-3 (A-07, CE-8): an exchange rate of 0 leaves the price in that currency without a figure and the rest in place', () => {
  it('a USD rate of 0 makes BJ null and leaves BG, BK and every other output as they were', () => {
    const base = stored();
    const noDollar = stored({ exchange: { usd: '0', eur: '90' } });
    expect(noDollar[idOf('BJ')]).toBeNull();
    expect(storedAt(noDollar, 'BH')).toBe('0');
    for (const [fieldId, value] of Object.entries(noDollar)) {
      if (fieldId !== idOf('BJ') && fieldId !== idOf('BH')) expect(value, fieldId).toBe(base[fieldId]);
    }
    expect(displayStoredValue(storedAt(noDollar, 'BG'))).toBe('451.40');
    expect(displayStoredValue(storedAt(noDollar, 'BK'))).toBe('5.02');
  });

  it('a EUR rate of 0 makes BK null and leaves BJ in place', () => {
    const noEuro = stored({ exchange: { usd: '80', eur: '0' } });
    expect(noEuro[idOf('BK')]).toBeNull();
    expect(displayStoredValue(storedAt(noEuro, 'BJ'))).toBe('5.64');
  });

  it('a rate that was never saved (no figure) behaves like 0: its price is null and nothing throws', () => {
    const none = stored({ exchange: { usd: null, eur: null } });
    expect(none[idOf('BH')]).toBeNull();
    expect(none[idOf('BJ')]).toBeNull();
    expect(none[idOf('BK')]).toBeNull();
    expect(displayStoredValue(storedAt(none, 'BG'))).toBe('451.40');
  });
});

describe('AC-4 (FR-027): values are full-precision decimal text, never a JavaScript number', () => {
  const outputs = stored();

  it('every stored value is a string or null', () => {
    for (const value of Object.values(outputs)) expect(value === null || typeof value === 'string').toBe(true);
  });

  it('keeps 34 significant digits, rounded half-up: AH = 8000 / 129', () => {
    expect(storedAt(outputs, 'AH')).toBe('62.01550387596899224806201550387597');
  });

  it('never writes an exponent, a leading plus, or a negative zero', () => {
    for (const value of Object.values(outputs)) expect(value ?? '0').toMatch(/^-?\d+(\.\d+)?$/);
    const small = stored({ row: { ...ROW, J: '1', K: '1', L: '1' }, material: { ...MATERIAL, specificGravity: '0.0001' } });
    for (const value of Object.values(small)) expect(value ?? '0').toMatch(/^-?\d+(\.\d+)?$/);
    expect(Object.values(stored({ row: {} })).filter((value) => value === '-0')).toEqual([]);
  });

  it('a stored value differs from the value shown only by rounding to 2 decimals', () => {
    for (const [fieldId, value] of Object.entries(outputs)) {
      if (value === null) continue;
      const difference = new Decimal(value).minus(new Decimal(displayStoredValue(value))).abs();
      expect(difference.lte(new Decimal('0.005')), fieldId).toBe(true);
    }
  });
});

describe('AC-5 (G3 condition 10): a "Not applicable" material has all material values 0', () => {
  const outputs = stored({ material: NOT_APPLICABLE });

  it('Scrap Weight O is 0 (the guard), not minus the Part Weight', () => {
    expect(storedAt(outputs, 'M')).toBe('0');
    expect(storedAt(outputs, 'O')).toBe('0');
  });

  it('Material Cost AK is 0, and the process costs are as before', () => {
    expect(storedAt(outputs, 'AK')).toBe('0');
    expect(storedAt(outputs, 'AY')).toBe(storedAt(stored(), 'AY'));
  });

  it('a real material with a Part Weight above the Blank Weight still gives M - N (negative), as the SPEC says', () => {
    const heavy = stored({ row: { ...ROW, N: '0.5' } });
    // O = 0.314 - 0.5 = -0.186
    expect(storedAt(heavy, 'O')).toBe('-0.186');
  });
});

describe('AC-6: an unselected treatment flag gives 0, and the output is still in the result', () => {
  const treatments: ReadonlyArray<readonly [string, string]> = [
    ['AQ', 'Z'],
    ['AR', 'AA'],
    ['AS', 'AB'],
    ['AT', 'AC'],
    ['AV', 'AE'],
    ['AW', 'AF'],
    ['AX', 'AG'],
  ];

  it.each(treatments)('%s is 0 and present when %s is 0', (output, flag) => {
    const outputs = stored({ row: { ...ROW, [flag]: '0' } });
    expect(Object.prototype.hasOwnProperty.call(outputs, idOf(output))).toBe(true);
    expect(storedAt(outputs, output)).toBe('0');
  });

  it('a flag that was never sent counts as not selected', () => {
    expect(storedAt(stored({ row: without('Z') }), 'AQ')).toBe('0');
  });

  it('Fasteners Qty and Cost that are hidden (never sent) give BO Cost / Fasteners AZ = 0', () => {
    expect(storedAt(stored({ row: without('T', 'U') }), 'AZ')).toBe('0');
  });

  it('all seven lines are 0 together when no flag is selected, and the other costs stay', () => {
    const none = stored({ row: { ...ROW, Z: '0', AA: '0', AB: '0', AC: '0', AE: '0', AF: '0', AG: '0' } });
    for (const [output] of treatments) expect(storedAt(none, output), output).toBe('0');
    // AY = 5 + 8 + 12 + 24 + 15 + 7 = 71
    expect(storedAt(none, 'AY')).toBe('71');
  });
});
