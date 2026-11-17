import { describe, expect, it } from 'vitest';

import { diffRates, nothingChanged, type RateDiffSnapshot } from '@/lib/estimate/rate-diff';

/**
 * STORY-06.08 AC-8 (FR-063; architecture sections 4.2 and 4.8): `rate-diff` compares the snapshot a calculation stored with one made from the masters now, for the entries that calculation used, and answers counts
 * by kind. Every ID, name and number is invented.
 */

const RATE_A = '00000000-0000-4000-8000-0000000000a1';
const RATE_B = '00000000-0000-4000-8000-0000000000b2';
const UNUSED_RATE = '00000000-0000-4000-8000-0000000000c3';
const MATERIAL_ONE = '00000000-0000-4000-8000-0000000000d1';
const MATERIAL_TWO = '00000000-0000-4000-8000-0000000000d2';
const REFERENCED = [RATE_A, RATE_B] as const;

const snapshot = (overrides: Partial<RateDiffSnapshot> = {}): RateDiffSnapshot => ({
  rates: [
    { id: RATE_A, value: '12.50' },
    { id: RATE_B, value: '3' },
  ],
  materials: [
    { id: MATERIAL_ONE, pricePerKg: '80.5', specificGravity: '7.85', scrapRate: '10' },
    { id: MATERIAL_TWO, pricePerKg: '90.5', specificGravity: '2.7', scrapRate: '40' },
  ],
  exchangeRates: { usd: '83.25', eur: '90.1' },
  ...overrides,
});

describe('AC-8: counts by kind, nothing else', () => {
  it('counts one of each when one process rate, one material price and one exchange rate changed', () => {
    const now = snapshot({
      rates: [
        { id: RATE_A, value: '13.00' },
        { id: RATE_B, value: '3' },
      ],
      materials: [
        { id: MATERIAL_ONE, pricePerKg: '81', specificGravity: '7.85', scrapRate: '10' },
        { id: MATERIAL_TWO, pricePerKg: '90.5', specificGravity: '2.7', scrapRate: '40' },
      ],
      exchangeRates: { usd: '84', eur: '90.1' },
    });
    expect(diffRates(snapshot(), now, REFERENCED)).toEqual({ processRates: 1, materialPrices: 1, exchangeRates: 1 });
  });

  it('answers three counts and no other key, so no old or new value can leave it', () => {
    const counts = diffRates(snapshot(), snapshot({ exchangeRates: { usd: '1', eur: '2' } }), REFERENCED);
    expect(Object.keys(counts).sort()).toEqual(['exchangeRates', 'materialPrices', 'processRates']);
    expect(JSON.stringify(counts)).not.toMatch(/\d{2}\.\d/);
  });

  it('counts nothing when nothing changed, and says so', () => {
    const counts = diffRates(snapshot(), snapshot(), REFERENCED);
    expect(counts).toEqual({ processRates: 0, materialPrices: 0, exchangeRates: 0 });
    expect(nothingChanged(counts)).toBe(true);
  });

  it('nothingChanged is false as soon as any kind changed', () => {
    expect(nothingChanged({ processRates: 0, materialPrices: 1, exchangeRates: 0 })).toBe(false);
    expect(nothingChanged({ processRates: 0, materialPrices: 0, exchangeRates: 2 })).toBe(false);
    expect(nothingChanged({ processRates: 3, materialPrices: 0, exchangeRates: 0 })).toBe(false);
  });

  it('counts each exchange rate once, so both changing is 2', () => {
    expect(diffRates(snapshot(), snapshot({ exchangeRates: { usd: '1', eur: '2' } }), REFERENCED).exchangeRates).toBe(2);
  });

  it('counts a material once, whichever of its three numbers changed or how many did', () => {
    const now = snapshot({
      materials: [
        { id: MATERIAL_ONE, pricePerKg: '1', specificGravity: '2', scrapRate: '3' },
        { id: MATERIAL_TWO, pricePerKg: '90.5', specificGravity: '2.7', scrapRate: '41' },
      ],
    });
    expect(diffRates(snapshot(), now, REFERENCED).materialPrices).toBe(2);
  });
});

describe('a change is a different number, not different text', () => {
  it('21.30 and 21.3 are the same value, so a master saved again with the same value counts for nothing', () => {
    const then = snapshot({ rates: [{ id: RATE_A, value: '21.30' }], exchangeRates: { usd: '83.2500', eur: null } });
    const now = snapshot({ rates: [{ id: RATE_A, value: '21.3' }], exchangeRates: { usd: '83.25', eur: null } });
    expect(diffRates(then, now, [RATE_A])).toEqual({ processRates: 0, materialPrices: 0, exchangeRates: 0 });
  });

  it('a value that was missing then and is there now is a change, and so is the other way round', () => {
    expect(diffRates(snapshot({ rates: [] }), snapshot(), REFERENCED).processRates).toBe(2);
    expect(diffRates(snapshot(), snapshot({ rates: [] }), REFERENCED).processRates).toBe(2);
    expect(diffRates(snapshot({ exchangeRates: { usd: null, eur: '90.1' } }), snapshot(), REFERENCED).exchangeRates).toBe(1);
    expect(diffRates(snapshot(), snapshot({ exchangeRates: { usd: '83.25', eur: null } }), REFERENCED).exchangeRates).toBe(1);
  });

  it('a rate that is missing then and now is no change', () => {
    expect(diffRates(snapshot({ rates: [] }), snapshot({ rates: [] }), REFERENCED).processRates).toBe(0);
  });

  it('text that is not a number counts as a change only when the text differs, and never throws', () => {
    expect(diffRates(snapshot({ exchangeRates: { usd: 'n/a', eur: null } }), snapshot({ exchangeRates: { usd: 'n/a', eur: null } }), []).exchangeRates).toBe(0);
    expect(diffRates(snapshot({ exchangeRates: { usd: 'n/a', eur: null } }), snapshot({ exchangeRates: { usd: '83.25', eur: null } }), []).exchangeRates).toBe(1);
  });

  it('a material the calculation used that is not in the current snapshot is a change', () => {
    const now = snapshot({ materials: [{ id: MATERIAL_ONE, pricePerKg: '80.5', specificGravity: '7.85', scrapRate: '10' }] });
    expect(diffRates(snapshot(), now, REFERENCED).materialPrices).toBe(1);
  });

  it('compares IDs without regard to letter case, as PostgreSQL does', () => {
    const then = snapshot({ rates: [{ id: RATE_A.toUpperCase(), value: '5' }], materials: [{ id: MATERIAL_ONE.toUpperCase(), pricePerKg: '1', specificGravity: '1', scrapRate: '1' }] });
    const now = snapshot({ rates: [{ id: RATE_A, value: '5' }], materials: [{ id: MATERIAL_ONE, pricePerKg: '1', specificGravity: '1', scrapRate: '1' }] });
    expect(diffRates(then, now, [RATE_A])).toEqual({ processRates: 0, materialPrices: 0, exchangeRates: 0 });
  });
});

describe('rates are restricted to the set the calculation read (architecture section 4.2, #432)', () => {
  const withUnused = (value: string) => snapshot({ rates: [{ id: RATE_A, value: '12.50' }, { id: RATE_B, value: '3' }, { id: UNUSED_RATE, value }] });

  it('a record of the older shape, which keeps every rate, counts zero when only a rate no formula reads has changed', () => {
    expect(diffRates(withUnused('1'), withUnused('2'), REFERENCED).processRates).toBe(0);
  });

  it('and counts one when a referenced rate has changed', () => {
    const now = snapshot({ rates: [{ id: RATE_A, value: '99' }, { id: RATE_B, value: '3' }, { id: UNUSED_RATE, value: '1' }] });
    expect(diffRates(withUnused('1'), now, REFERENCED).processRates).toBe(1);
  });

  it('counts a referenced rate once, even when the set names it twice', () => {
    const now = snapshot({ rates: [{ id: RATE_A, value: '99' }, { id: RATE_B, value: '3' }] });
    expect(diffRates(snapshot(), now, [RATE_A, RATE_A.toUpperCase(), RATE_B]).processRates).toBe(1);
  });

  it('with no referenced rate no process rate counts', () => {
    expect(diffRates(snapshot(), snapshot({ rates: [{ id: RATE_A, value: '99' }] }), []).processRates).toBe(0);
  });

  it('a formula-only change changes nothing in the snapshots, so nothing is counted', () => {
    expect(nothingChanged(diffRates(snapshot(), snapshot(), REFERENCED))).toBe(true);
  });
});
