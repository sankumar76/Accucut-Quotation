import { describe, expect, it } from 'vitest';

import { RATES_HINT, RESET_TYPED_NOTE, resetDescription, resetNotice } from '@/components/features/masters/customer-texts';

/**
 * ux-spec v0.25, SCR-12 (AQP-142, product-owner's amended AC-2 and the Should about typed rates in the reset): the words, one assertion per row.
 * The percent rule itself (`rateProblem`) is in `customers-lib.test.ts`; the dialog's accessible description and the notices on the page are in
 * `tests/e2e/customers.spec.ts`.
 */

describe('the rates hint (ux-spec v0.25, ruling 1)', () => {
  it('says percent rates are plain numbers, with a whole and a decimal example, and no full stop', () => {
    expect(RATES_HINT).toBe('Percent rates are typed as plain numbers: 12 means 12%, 12.5 means 12.5%');
  });
});

describe('the reset dialog (ux-spec v0.25, ruling 2)', () => {
  it('paragraph 1, no saved rate differs: says no saved value will be replaced', () => {
    expect(resetDescription(15, 0)).toBe('All 15 rates already equal the current Process master values, so no saved value will be replaced.');
  });

  it('paragraph 1, some differ: unchanged, with the count of values replaced', () => {
    expect(resetDescription(15, 3)).toBe('All 15 rates return to the current Process master values. The 3 values this customer has now are replaced:');
    expect(resetDescription(15, 1)).toBe('All 15 rates return to the current Process master values. The 1 value this customer has now is replaced:');
  });

  it('paragraph 2, always shown: a rate typed and not yet saved is replaced too, and the details stay as typed', () => {
    expect(RESET_TYPED_NOTE).toBe('A rate value you have typed on this page and not yet saved is replaced too. The details (name, phone, e-mail, address) stay as typed.');
  });
});

describe('the notice after a reset (ux-spec v0.25, ruling 2)', () => {
  it('N replaced: unchanged', () => {
    expect(resetNotice('Invented Works', 2)).toEqual({ tone: 'success', text: 'Invented Works was reset to the defaults. 2 rates were replaced.' });
    expect(resetNotice('Invented Works', 1)).toEqual({ tone: 'success', text: 'Invented Works was reset to the defaults. 1 rate was replaced.' });
  });

  it('none replaced: the title is unchanged, and the sentence says no saved value was replaced and that the rate boxes show the defaults', () => {
    expect(resetNotice('Invented Works', 0)).toEqual({
      tone: 'info',
      title: 'Invented Works is already at the defaults.',
      text: 'Every saved rate already equals its current default, so no saved value was replaced. The rate boxes show the defaults.',
    });
  });
});
