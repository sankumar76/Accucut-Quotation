import { describe, expect, it } from 'vitest';

import { approveRatesLine, changedKinds, RATES_CHANGED_AFTER_LINK, RATES_CHANGED_LINK, RATES_CHANGED_TITLE, ratesChangedSentence } from '@/lib/estimate/rates-changed-copy';
import { diffRates } from '@/lib/estimate/rate-diff';

import { FIXTURE_REFERENCED, mastersNow, ONE_OF_EACH, ONE_OF_EACH_COUNTS, storedSnapshot } from '../../support/rate-change-fixture';
import { readMasters } from '@/server/services/calculation-masters';

/**
 * STORY-06.11 AC-1, AC-2 (UX-62; FR-106): the words of the "Rates changed" notice and of the one line of the approval dialog, written out here from the story and the UX spec and not imported from
 * the product, so a changed sentence fails a test. The counts in the sentences are the counts of the one pure function `rate-diff` made from the one shared fixture (AC-8). Every number is invented.
 */

const AT = '10:42 IST';

describe('AC-1: the notice says what changed, by kind, and nothing else', () => {
  it('the story\'s case, a process rate, a material price and an exchange rate, is "2 rates and 1 material price" (the rates are the process and the exchange rates together)', () => {
    expect(changedKinds(ONE_OF_EACH_COUNTS)).toBe('2 rates and 1 material price');
  });

  it('the whole notice, word for word, with the link between its two halves', () => {
    const text = [RATES_CHANGED_TITLE, ratesChangedSentence(ONE_OF_EACH_COUNTS, AT), RATES_CHANGED_LINK, RATES_CHANGED_AFTER_LINK].join(' ');
    expect(text).toBe('Rates changed since this was calculated. 2 rates and 1 material price changed since this was calculated at 10:42 IST. Recalculate to use them. Approving is not blocked.');
  });

  it.each([
    [{ processRates: 1, materialPrices: 0, exchangeRates: 0 }, '1 rate'],
    [{ processRates: 0, materialPrices: 0, exchangeRates: 1 }, '1 rate'],
    [{ processRates: 3, materialPrices: 0, exchangeRates: 0 }, '3 rates'],
    [{ processRates: 0, materialPrices: 1, exchangeRates: 0 }, '1 material price'],
    [{ processRates: 0, materialPrices: 4, exchangeRates: 0 }, '4 material prices'],
    [{ processRates: 1, materialPrices: 2, exchangeRates: 2 }, '3 rates and 2 material prices'],
    [{ processRates: 0, materialPrices: 1, exchangeRates: 2 }, '2 rates and 1 material price'],
  ])('%j reads "%s"', (counts, expected) => {
    expect(changedKinds(counts)).toBe(expected);
  });

  it('a kind that did not change is not named, so no sentence says "0 rates"', () => {
    expect(changedKinds({ processRates: 0, materialPrices: 2, exchangeRates: 0 })).not.toMatch(/\b0\b/);
    expect(changedKinds({ processRates: 2, materialPrices: 0, exchangeRates: 0 })).not.toContain('material');
  });

  it('the sentences hold the counts and the time and no other number: no old or new value can reach them', () => {
    const counts = { processRates: 7, materialPrices: 9, exchangeRates: 5 };
    const digits = [ratesChangedSentence(counts, AT), approveRatesLine(counts)].join(' ').replaceAll(AT, '');
    expect([...digits.matchAll(/\d+/g)].map((match) => match[0])).toEqual(['12', '9', '12', '9']);
  });
});

describe('AC-2: the line of the approval dialog says the same in short, and approving is not blocked', () => {
  it('is the UX spec\'s line for SCR-08, with the counts', () => {
    expect(RATES_CHANGED_TITLE).toBe('Rates changed since this was calculated.');
    expect(approveRatesLine(ONE_OF_EACH_COUNTS)).toBe('2 rates and 1 material price changed since this was calculated. Approving is not blocked. Close this window and Recalculate first if you want them used.');
  });
});

describe('AC-8: the counts the sentences are made from are the ones the unlock preview shows, from one fixture', () => {
  it('the same changes in the masters give the same counts to `rate-diff` here as to the unlock preview (tests/unit/approval/unlock.test.ts)', async () => {
    const now = await readMasters(mastersNow(ONE_OF_EACH).masters, storedSnapshot().customer.id, storedSnapshot().materials.map((material) => material.id), FIXTURE_REFERENCED);
    const counts = diffRates(storedSnapshot(), now.snapshot, FIXTURE_REFERENCED);
    expect(counts).toEqual(ONE_OF_EACH_COUNTS);
    expect(changedKinds(counts)).toBe('2 rates and 1 material price');
  });
});
