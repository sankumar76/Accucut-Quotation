import { describe, expect, it } from 'vitest';

import { NOTHING_CHANGED, previewNotice, REASON_HINT, REASON_LABEL, unlockIntro, unlockTitle } from '@/components/features/estimate-unlock/unlock-texts';

/**
 * STORY-06.08 AC-1 (UX spec SCR-09 "Fields" and its mock-up): the words of the Unlock dialog, and the one paragraph that says what changed since the approval. Counts by kind and the two version numbers are
 * all the preview carries, so they are all it can say (NFR-002). Every number is invented.
 */

const NONE = { processRates: 0, materialPrices: 0, exchangeRates: 0 } as const;

describe('previewNotice (AC-1)', () => {
  it('says that nothing changed when the versions are the same and every count is 0', () => {
    expect(previewNotice({ configuration: { approved: 7, current: 7 }, changed: NONE })).toBe(NOTHING_CHANGED);
    expect(NOTHING_CHANGED).toBe('Nothing has changed in the configuration or the rates since approval. Recalculating gives the same result unless you change an input.');
  });

  it('names the two configuration versions when they differ (7 to 9), and that recalculating uses the current values', () => {
    const text = previewNotice({ configuration: { approved: 7, current: 9 }, changed: NONE });
    expect(text).toContain('Things have changed since this estimate was approved.');
    expect(text).toContain('Field and formula configuration: version 7 at approval, version 9 now.');
    expect(text).toContain('If you recalculate after unlocking, the current values are used.');
    expect(text).not.toContain('Rates:');
  });

  it('counts the rates by kind, with the singular for one and the plural for more, and "has" for a single change and "have" for more', () => {
    expect(previewNotice({ configuration: { approved: 7, current: 7 }, changed: { processRates: 1, materialPrices: 0, exchangeRates: 0 } })).toContain('Rates: 1 customer rate has changed.');
    expect(previewNotice({ configuration: { approved: 7, current: 7 }, changed: { processRates: 2, materialPrices: 1, exchangeRates: 1 } })).toContain(
      'Rates: 2 customer rates, 1 material price and 1 exchange rate have changed.',
    );
    expect(previewNotice({ configuration: { approved: 7, current: 7 }, changed: { processRates: 0, materialPrices: 3, exchangeRates: 2 } })).toContain('Rates: 3 material prices and 2 exchange rates have changed.');
  });

  it('puts the versions and the rates in one paragraph when both moved, and leaves out a kind that did not change', () => {
    const text = previewNotice({ configuration: { approved: 7, current: 9 }, changed: { processRates: 0, materialPrices: 1, exchangeRates: 0 } });
    expect(text).toContain('version 7 at approval, version 9 now.');
    expect(text).toContain('Rates: 1 material price has changed.');
    expect(text).not.toContain('customer rate');
    expect(text).not.toContain('exchange rate');
  });

  it('holds no figure but the counts and the version numbers: no rupee sign and no decimal', () => {
    const text = previewNotice({ configuration: { approved: 7, current: 9 }, changed: { processRates: 2, materialPrices: 1, exchangeRates: 1 } });
    expect(text).not.toContain('₹');
    expect(text).not.toMatch(/\d\.\d/);
  });
});

describe('the words of the dialog (AC-1)', () => {
  it('the title names the task, and the intro names the Engineer once the preview has said who it is', () => {
    expect(unlockTitle('Q-2026-0318')).toBe('Unlock Q-2026-0318');
    expect(unlockIntro('Invented Engineer')).toBe(
      "Unlocking returns the estimate to Draft so inputs can be changed, and reopens the task in Invented Engineer's Open queue. The unlock is logged with your reason.",
    );
    expect(unlockIntro(null)).toContain("reopens the task in the Engineer's Open queue.");
  });

  it('the field is "Reason for unlocking", with the hint that it is kept in the audit log', () => {
    expect(REASON_LABEL).toBe('Reason for unlocking');
    expect(REASON_HINT).toBe('Enter a reason. It is kept in the audit log.');
  });
});
