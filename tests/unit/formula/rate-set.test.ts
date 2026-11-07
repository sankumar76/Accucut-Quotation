import { describe, expect, it } from 'vitest';

import { rateSetIssues, toDisplayForm, toInternalForm, type ReferenceContext } from '@/lib/formula';

import { FIELD_IDS } from '../../support/formula-fixtures';
import { SEED_PROCESS_ITEMS } from '../../support/seed-config';

/**
 * DEF-006 (GitHub #49) for the whole set of names (QLT-01 of the G6 of AQP-113): a name that reads as other names and an operator is
 * a problem whichever of them was added first. `rateNameIssues` judges one new name against the others (`rate-names.test.ts`); these
 * tests hold the rule that judges every name against the rest, so an existing name that a new one makes ambiguous is found too.
 * Every name is invented.
 */

const codesOfSet = (names: ReadonlyArray<string>): string[] => rateSetIssues(names).map((issue) => issue.code);

describe('a set of rate names read together', () => {
  it('finds nothing wrong with the 15 seed names: they form a safe set', () => {
    expect(rateSetIssues(SEED_PROCESS_ITEMS.map((item) => item.name))).toEqual([]);
  });

  it('finds nothing wrong with the seed names plus a rate the Admin added, or with an empty or one-name set', () => {
    expect(rateSetIssues([...SEED_PROCESS_ITEMS.map((item) => item.name), 'Buffing-rate-per-sqin'])).toEqual([]);
    expect(rateSetIssues([])).toEqual([]);
    expect(rateSetIssues(['Cost'])).toEqual([]);
  });

  it.each([
    ['the compound was added first, then both parts (the reverse order)', ['Cost-Waste', 'Cost', 'Waste']],
    ['the parts were added first, then the compound (the forward order)', ['Cost', 'Waste', 'Cost-Waste']],
    ['the parts are renamed into the names the compound reads as', ['Gamma', 'Delta', 'Gamma-Delta']],
    ['the compound has spaces around its operator', ['Cost - Waste', 'Cost', 'Waste']],
    ['one part is a column and the other a rate', ['AB-Waste', 'Waste']],
  ])('finds the name that %s, once, whatever order the names are listed in', (_what, names) => {
    expect(codesOfSet(names)).toEqual(['RATE_SET_AMBIGUOUS']);
    expect(codesOfSet([...names].reverse())).toEqual(['RATE_SET_AMBIGUOUS']);
  });

  it('is safe when only one of the two parts is there, or when a word of the compound is not a rate', () => {
    expect(codesOfSet(['Cost-Waste', 'Cost'])).toEqual([]);
    expect(codesOfSet(['Cost-Waste', 'Waste'])).toEqual([]);
    expect(codesOfSet(['Cost-Handling', 'Cost', 'Waste'])).toEqual([]);
    expect(codesOfSet(['Cost basis', 'Cost'])).toEqual([]);
  });

  it('judges names as the formula engine does, exactly: a change of letter case does not make a set unsafe', () => {
    expect(codesOfSet(['cost-waste', 'Cost', 'Waste'])).toEqual([]);
  });

  it('leaves a name of the wrong shape and an exact duplicate to rateNameIssues', () => {
    expect(codesOfSet(['Rate (old)', 'Rate'])).toEqual([]);
    expect(codesOfSet(['Cost', 'Cost'])).toEqual([]);
  });

  it('STD-05: the message names no rate', () => {
    const [issue] = rateSetIssues(['Wombat-Aardvark', 'Wombat', 'Aardvark']);
    expect(issue?.message).toBeDefined();
    expect(issue?.message).not.toMatch(/Wombat|Aardvark/);
  });

  it('is what the round trip needs: in the set it flags, a stored formula is shown as the compound and read back as another rate', () => {
    const rates = [
      { id: '00000000-0000-4000-8000-0aaa00000001', name: 'Cost' },
      { id: '00000000-0000-4000-8000-0aaa00000002', name: 'Waste' },
      { id: '00000000-0000-4000-8000-0aaa00000003', name: 'Cost-Waste' },
    ];
    const stored = `{{rate:${rates[0]?.id}}}-{{rate:${rates[1]?.id}}}`;
    const context: ReferenceContext = { fieldIds: FIELD_IDS, rates };
    expect(codesOfSet(rates.map((rate) => rate.name))).toEqual(['RATE_SET_AMBIGUOUS']);
    expect(toDisplayForm(stored, context)).toBe('Cost-Waste');
    expect(toInternalForm(toDisplayForm(stored, context), context)).not.toBe(stored);
  });

  it('reads a hundred rates (the scale PRF-06 assumes) without a finding, and finds the one compound planted among them', () => {
    const names = Array.from({ length: 100 }, (_, index) => `Invented-rate-${index}-per-kg`);
    expect(rateSetIssues(names)).toEqual([]);
    expect(rateSetIssues([...names, 'Invented-rate-1-per-kg - Invented-rate-2-per-kg'])).toHaveLength(1);
  });
});
