import { describe, expect, it } from 'vitest';

import { Decimal, type Value } from '@/lib/decimal';
import { compilePlan, createRateLookup, evaluateProductFormulas, evaluateRowFormulas, type Resolver } from '@/lib/formula';

import { defined } from '../../support/defined';
import { d, show } from '../../support/formula-fixtures';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * The seed configuration (STORY-03.01) run through the engine (AC-4, AC-3, AC-5). This is a smoke test with
 * invented inputs, every input being 1: it shows that the 31 SPEC section 7.4 formulas can be read, ordered and
 * evaluated, and that one division by zero leaves the other outputs of a row in place. The per-formula checks
 * of the SPEC outputs are story 03.03's.
 */

const plan = compilePlan(seedConfig.fields);
const idOf = (letter: string): string => seedFieldAt(letter).id;
const inputIds = new Set(seedConfig.fields.filter((field) => field.kind !== 'output').map((field) => field.id));

/** Every typed or looked-up value is 1; every rate is 1 (a percent rate is then 0.01). */
function seedResolver(options: { usd?: string; columns?: ReadonlyMap<string, ReadonlyArray<Value>> } = {}): Resolver {
  const one = new Decimal(1);
  return {
    fieldValue: (fieldId) => (inputIds.has(fieldId) ? one : null),
    columnValues: (fieldId) => options.columns?.get(fieldId) ?? [],
    rate: createRateLookup(SEED_PROCESS_ITEMS.map((item) => ({ id: item.id, name: item.name, value: one }))),
    material: () => one,
    exchangeRate: (currency) => (currency === 'USD' ? d(options.usd ?? '1') : one),
  };
}

const valueOf = (results: ReadonlyMap<string, Value>, letter: string): string | null => show(results.get(idOf(letter)) ?? null);

describe('the seed formulas, evaluated (AC-4)', () => {
  const results = evaluateRowFormulas(plan, seedResolver());

  it('AC-4: calculates all 29 row outputs from inputs of 1, none without a figure', () => {
    expect(results.size).toBe(29);
    for (const [fieldId, value] of results) expect(value, fieldId).not.toBeNull();
  });

  it('AC-4: works out outputs that were listed after the fields that read them, by hand', () => {
    // M = (L x K x J x specific gravity) / 1,000,000 = 1 / 1,000,000
    expect(valueOf(results, 'M')).toBe('0.000001');
    // O = M - N = 0.000001 - 1 (the gravity is above 0)
    expect(valueOf(results, 'O')).toBe('-0.999999');
    // AK = (M x I) - (O x scrap rate) = 0.000001 + 0.999999
    expect(valueOf(results, 'AK')).toBe('1');
    // AZ = T x U
    expect(valueOf(results, 'AZ')).toBe('1');
    // BC (Rejection) is the constant 0
    expect(valueOf(results, 'BC')).toBe('0');
    // BH and BI read the exchange rates
    expect(valueOf(results, 'BH')).toBe('1');
    expect(valueOf(results, 'BI')).toBe('1');
  });

  it('AC-4: the total process cost adds its thirteen parts', () => {
    const parts = ['AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX'];
    // AP and AU are typed in (inputs of 1); the other eleven are calculated.
    const partValue = (letter: string): Decimal => (results.has(idOf(letter)) ? defined(results.get(idOf(letter)), letter) : new Decimal(1));
    const sum = parts.reduce((total, letter) => total.plus(partValue(letter)), new Decimal(0));
    expect(show(results.get(idOf('AY')) ?? null)).toBe(sum.toFixed());
  });

  it('AC-4: the product formulas read the rows: BL is the sum of BG and BN is BL over the sum of BM', () => {
    const unitPrice = defined(results.get(idOf('BG')));
    const tool = new Decimal(1);
    const columns = new Map<string, ReadonlyArray<Value>>([
      [idOf('BG'), [unitPrice, unitPrice, unitPrice]],
      [idOf('BM'), [tool, tool, tool]],
    ]);
    const product = evaluateProductFormulas(plan, seedResolver({ columns }));
    const three = defined(unitPrice).times(new Decimal(3));
    expect(valueOf(product, 'BL')).toBe(three.toFixed());
    // BN = BL / SUM(BM) = 3 x BG / 3
    expect(valueOf(product, 'BN')).toBe(defined(unitPrice).toFixed());
    expect([...product.keys()].sort()).toEqual([idOf('BL'), idOf('BN')].sort());
  });
});

describe('a division by zero in the seed (AC-3, test strategy CE-8)', () => {
  it('AC-3: an exchange rate of 0 leaves the dollar price without a figure and every other output in place', () => {
    const results = evaluateRowFormulas(plan, seedResolver({ usd: '0' }));
    expect(results.get(idOf('BJ'))).toBeNull();
    expect(valueOf(results, 'BH')).toBe('0');
    const others = [...results.entries()].filter(([fieldId]) => fieldId !== idOf('BJ'));
    expect(others).toHaveLength(28);
    for (const [fieldId, value] of others) expect(value, fieldId).not.toBeNull();
    expect(valueOf(results, 'BK')).not.toBeNull();
  });

  it('AC-3: a row whose unit price has no figure makes BL no figure, never a lower number', () => {
    const one = new Decimal(1);
    const columns = new Map<string, ReadonlyArray<Value>>([[idOf('BG'), [one, null, one]], [idOf('BM'), [one, one, one]]]);
    const product = evaluateProductFormulas(plan, seedResolver({ columns }));
    expect(product.get(idOf('BL'))).toBeNull();
    expect(product.get(idOf('BN'))).toBeNull();
  });
});
