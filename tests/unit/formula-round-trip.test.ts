import { describe, expect, it } from 'vitest';

import { fieldsBrokenByChange, fieldsThatDoNotRoundTrip } from '@/lib/fields/formula-round-trip';
import { ambiguousRateNames } from '@/lib/formula';

import { configurationWithFormula, rateRef } from '../support/formula-config';
import { SEED_PROCESS_ITEMS, seedConfig } from '../support/seed-config';

/**
 * QLT-15 and QLT-17 of the G6 of AQP-113 (DEF-006): the property that keeps a stored formula meaning what it meant, held directly. A
 * formula round-trips when `toInternalForm(toDisplayForm(f))` is `f` under the current rate names; a change is judged by the formulas
 * it newly breaks. Pure, so these need no service. Every name and ID is invented.
 */

const A = '00000000-0000-4000-8000-0ddd00000001';
const B = '00000000-0000-4000-8000-0ddd00000002';
const FORMULA = `${rateRef(A)}-${rateRef(B)}`;
const document = configurationWithFormula(FORMULA);
/** The 15 seed rates (the seed formulas refer to them) and the given ones. */
const rates = (...named: ReadonlyArray<readonly [string, string]>) => [
  ...SEED_PROCESS_ITEMS.map(({ id, name }) => ({ id, name })),
  ...named.map(([id, name]) => ({ id, name })),
];

describe('which formulas round-trip', () => {
  it('every formula of the seed registry round-trips under the 15 seed rates', () => {
    expect([...fieldsThatDoNotRoundTrip(seedConfig, SEED_PROCESS_ITEMS)]).toEqual([]);
  });

  it('a stored A-B round-trips under the names Cost and Waste-Fee, and with no compound name that reads over them', () => {
    expect([...fieldsThatDoNotRoundTrip(document, rates([A, 'Cost'], [B, 'Waste-Fee']))]).toEqual([]);
    expect([...fieldsThatDoNotRoundTrip(document, rates([A, 'Cost'], [B, 'Waste-Fee'], ['00000000-0000-4000-8000-0ddd00000003', 'Fee']))]).toEqual([]);
  });

  it.each([
    ['a longer name hides a valid split (set a)', ['Cost-Waste-Fee']],
    ['overlapping names (set b)', ['Cost-Waste', 'Fee']],
    ['the compound alone, which cannot be read to the end', ['Cost-Waste']],
  ])('does not round-trip with %s', (_what, extra) => {
    const set = [...rates([A, 'Cost'], [B, 'Waste-Fee']), ...extra.map((name, index) => ({ id: `00000000-0000-4000-8000-0ddd0000010${index}`, name }))];
    expect([...fieldsThatDoNotRoundTrip(document, set)]).toHaveLength(1);
  });

  it('does not round-trip a formula that refers to a rate the set does not hold', () => {
    expect([...fieldsThatDoNotRoundTrip(document, rates([A, 'Cost']))]).toHaveLength(1);
  });
});

describe('which formulas a change breaks (QLT-17)', () => {
  const before = rates([A, 'Cost'], [B, 'Waste-Fee']);

  it('names the field that the change newly breaks, and none when it breaks nothing', () => {
    const broken = fieldsBrokenByChange(document, before, [...before, { id: '00000000-0000-4000-8000-0ddd00000101', name: 'Cost-Waste' }]);
    expect(broken).toHaveLength(1);
    expect(fieldsBrokenByChange(document, before, [...before, { id: '00000000-0000-4000-8000-0ddd00000102', name: 'Other-rate' }])).toEqual([]);
  });

  it('does not count a formula that was already broken before the change', () => {
    const already = [...before, { id: '00000000-0000-4000-8000-0ddd00000103', name: 'Cost-Waste-Fee' }];
    expect(fieldsBrokenByChange(document, already, [...already, { id: '00000000-0000-4000-8000-0ddd00000104', name: 'Other-rate' }])).toEqual([]);
  });
});

describe('which names of a set are ambiguous', () => {
  it('names them, once each, and none for a safe set or the 15 seed names', () => {
    expect(ambiguousRateNames(['Cost-Waste', 'Cost', 'Waste'])).toEqual(['Cost-Waste']);
    expect(ambiguousRateNames(['Cost-Waste', 'Cost'])).toEqual([]);
    expect(ambiguousRateNames(SEED_PROCESS_ITEMS.map((item) => item.name))).toEqual([]);
  });
});
