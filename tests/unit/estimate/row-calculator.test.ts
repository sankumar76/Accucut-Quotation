import { describe, expect, it } from 'vitest';

import { calculateRowOutputs, type RowCalculationInput } from '@/lib/estimate/row-calculator';
import { displayStoredValue, storeRowOutputs, type StoredRowOutputs } from '@/lib/estimate/row-outputs';
import { Decimal } from '@/lib/decimal';
import { compilePlan } from '@/lib/formula';

import { defined } from '../../support/defined';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-03.03 AC-1 to AC-6 (SPEC section 7.4 and section 14 item 2): one row's outputs, M to BK, worked out from invented rates, an
 * invented material and invented exchange rates. Every expected figure below was worked out BEFORE the code, in exact fractions (not
 * with the portal's code and not with floating point), from the SPEC formulas, and is written here as text. Nothing here is a real rate,
 * price or exchange rate (ADR-014, NFR-006).
 *
 * The row: a plate 200 x 100 x 2 of invented material (gravity 7.85, 60 a kg, scrap rate 25), a part weight of 0.2 kg, a count of 3 for
 * the whole order, and a mix of processes. The worked figures are in the comments of `WORKED_2DP`.
 */

const plan = compilePlan(seedConfig.fields);
const idOf = (letter: string): string => seedFieldAt(letter).id;

/** Invented rates, typed as the Admin types them: a rate named "... %" is typed as a percentage (12 means 12 %). */
const TYPED_RATES: Readonly<Record<string, string>> = {
  'Cutting-Rate-per-Sec': '0.5',
  'Bending-Rate-per-stroke': '2',
  'Drilling-Tapping-Rate': '3',
  'Welding-rate-per-kg': '40',
  'Dip-Galvanizing-Cost-per-kg': '10',
  'Primer-rate-per-sqft': '6',
  'Shot-Blasting-rate-per-kg': '8',
  'Polishing-rate-per-sqin': '0.25',
  'Plating-rate-per-sqin': '0.1',
  'Powder-rate-per-sqft': '12',
  'Foam Cost': '9',
  'Soft-Anodize-rate-per-sqin': '0.2',
  'OH Profit %': '12',
  'Transport %': '5',
  'Inspection & Packing %': '2.5',
};

const MATERIAL = { pricePerKg: '60', specificGravity: '7.85', scrapRate: '25' } as const;
const NOT_APPLICABLE = { pricePerKg: '0', specificGravity: '0', scrapRate: '0' } as const;
const EXCHANGE = { usd: '80', eur: '90' } as const;

/** The row's typed values by SPEC letter. Z to AG are the treatment flags: 1 selected, 0 not. */
const ROW: Readonly<Record<string, string>> = {
  H: '3',
  J: '200',
  K: '100',
  L: '2',
  N: '0.2',
  P: '10',
  R: '4',
  T: '2',
  U: '5',
  V: '3',
  W: '2',
  X: '1',
  Y: '1',
  Z: '1',
  AA: '0',
  AB: '1',
  AC: '1',
  AE: '1',
  AF: '0',
  AG: '1',
  AP: '15',
  AU: '7',
};

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

/**
 * Stage by stage, to 2 decimals (SPEC section 14 item 2). The comment on a line is the hand working.
 */
const WORKED_2DP: ReadonlyArray<readonly [string, string]> = [
  // Stage 1. M = (2 x 100 x 200 x 7.85) / 1,000,000 = 314,000 / 1,000,000 = 0.314. O = 0.314 - 0.2 = 0.114.
  ['M', '0.31'],
  ['O', '0.11'],
  // AH = (200 x 100 x 2) / 645 = 62.0155..., AI = AH / 144 = 0.43066...
  ['AH', '62.02'],
  ['AI', '0.43'],
  // Stage 2. AK = (0.314 x 60) - (0.114 x 25) = 18.84 - 2.85 = 15.99.
  ['AK', '15.99'],
  // Stage 3. AL = 10 x 0.5. AM = 4 x 2. AN = (2 + 1 + 1) x 3. AO = 0.2 x 40 x 3.
  ['AL', '5.00'],
  ['AM', '8.00'],
  ['AN', '12.00'],
  ['AO', '24.00'],
  // AQ = (0.2 x 10) x 1. AR = (AI x 6) x 0 (flag off). AS = (0.2 x 8) x 1. AT = 1 x ((AH / 2) x 0.25) = 7.7519.
  ['AQ', '2.00'],
  ['AR', '0.00'],
  ['AS', '1.60'],
  ['AT', '7.75'],
  // AV = 1 x (AI x 12) = 5.1680. AW = 0 x AI x 9 (flag off). AX = 1 x (AH x 0.2) = 12.4031.
  ['AV', '5.17'],
  ['AW', '0.00'],
  ['AX', '12.40'],
  // AY = 5 + 8 + 12 + 24 + AP 15 + 2 + 0 + 1.6 + 7.7519 + AU 7 + 5.1680 + 0 + 12.4031 = 99.9230.
  ['AY', '99.92'],
  // Stage 4. AZ = 2 x 5. BA = 15.99 + 99.9230 + 10 = 125.9130. BB = BA x 3 = 377.7390.
  ['AZ', '10.00'],
  ['BA', '125.91'],
  ['BB', '377.74'],
  // Stage 5. BC is seeded 0. BD = BB x 0.12. BE = BB x 0.025. BF = BB x 0.05.
  ['BC', '0.00'],
  ['BD', '45.33'],
  ['BE', '9.44'],
  ['BF', '18.89'],
  // Stage 6. BG = BB + 0 + 45.3287 + 9.4435 + 18.8870 = 451.3981. BJ = BG / 80, BK = BG / 90.
  ['BG', '451.40'],
  ['BH', '80.00'],
  ['BI', '90.00'],
  ['BJ', '5.64'],
  ['BK', '5.02'],
];

/** The figures that come out exactly in 6 decimals, which show that the 2 decimals above are not a rounding of a rounding. */
const WORKED_6DP: ReadonlyArray<readonly [string, string]> = [
  ['M', '0.314000'],
  ['O', '0.114000'],
  ['AK', '15.990000'],
  ['AH', '62.015504'],
  ['AY', '99.922997'],
  ['BA', '125.912997'],
  ['BB', '377.738992'],
  ['BG', '451.398096'],
  ['BJ', '5.642476'],
  ['BK', '5.015534'],
];

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
