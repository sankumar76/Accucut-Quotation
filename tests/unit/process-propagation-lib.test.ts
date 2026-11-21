import { describe, expect, it } from 'vitest';

import {
  applyAllLabel,
  applyLabel,
  choicesNotice,
  savedTitle,
  customers,
  differBody,
  differTitle,
  dismissedNotice,
  haveDifferentValue,
  hadAndNowHave,
  keepAllLabel,
  keepLabel,
  movedNotice,
  SHOWN_VALUE_PATTERN,
} from '@/lib/masters/default-propagation';

/**
 * STORY-02.08 (AC-1, AC-2, AC-3, AC-5): the words and the counts of the changed-default flow, as the page and the dialog say them. Pure, so no
 * database and no page. Every name and number is invented.
 */

describe('AC-1: the notice after a save that moved customers on its own', () => {
  it('says how many customers moved, from and to which value, and that the audit log has the change', () => {
    expect(movedNotice('Cutting-Rate-per-Sec', 17, 'per second', '0.47', '0.52')).toBe(
      'Cutting-Rate-per-Sec saved. 17 customers had 0.47 and now have 0.52. The change is in the audit log.',
    );
  });

  it('uses the singular for one customer', () => {
    expect(hadAndNowHave(1, 'per kg', '0.47', '0.52')).toBe('1 customer had 0.47 and now has 0.52.');
  });

  it('says only that the rate was saved when no customer moved', () => {
    expect(movedNotice('Cutting-Rate-per-Sec', 0, 'per second', '0.47', '0.52')).toBe('Cutting-Rate-per-Sec saved. The change is in the audit log.');
  });

  it('keeps the percent sign of a percentage rate', () => {
    expect(hadAndNowHave(2, '%', '11.00', '12.00')).toBe('2 customers had 11.00 % and now have 12.00 %.');
  });
});

describe('AC-2: the dialog "Customers differ"', () => {
  it('titles it with the old and the new value', () => {
    expect(differTitle('Cutting-Rate-per-Sec', 'per second', '0.47', '0.52')).toBe('Cutting-Rate-per-Sec changed from 0.47 to 0.52');
  });

  it('says in one paragraph what moved, who differs and what is asked (the words of the story)', () => {
    expect(differBody(17, 3, 'per second', '0.47', '0.52')).toBe(
      '17 customers had 0.47 and now have 0.52. 3 customers have a different value. Choose what to do for each one.',
    );
  });

  it('reads right for one customer and for nobody having moved', () => {
    expect(differBody(0, 1, 'per second', '0.47', '0.52')).toBe('No customer had 0.47. 1 customer has a different value. Choose what to do for it.');
    expect(haveDifferentValue(1)).toBe('1 customer has a different value.');
  });

  it('labels the two radios of a customer with the value each would leave it at', () => {
    expect(applyLabel('per second', '0.52')).toBe('Apply 0.52');
    expect(keepLabel('per second', '0.50')).toBe('Keep 0.50');
    expect(keepLabel('%', '12.50')).toBe('Keep 12.50 %');
  });

  it('counts the buttons that set every radio: "Keep all 3", "Apply to all 3", and the singular', () => {
    expect(keepAllLabel(3)).toBe('Keep all 3');
    expect(applyAllLabel(3)).toBe('Apply to all 3');
    expect(keepAllLabel(1)).toBe('Keep it');
    expect(applyAllLabel(1)).toBe('Apply to it');
  });
});

describe('AC-3: the notice after Save choices', () => {
  it('says the counts that are not zero, and that the audit log has the change when a customer changed', () => {
    expect(choicesNotice({ applied: 2, kept: 1, skipped: 0 }, 'per second', '0.52')).toBe(
      '2 customers now have 0.52. 1 customer kept its own value. The changes are in the audit log.',
    );
  });

  it('counts a customer changed since it was listed apart (AC-4) and uses the singular', () => {
    expect(choicesNotice({ applied: 1, kept: 0, skipped: 1 }, 'per second', '0.52')).toBe(
      '1 customer now has 0.52. 1 customer changed since you looked, so it was left alone. The changes are in the audit log.',
    );
  });

  it('does not mention the audit log when nobody changed (a kept or skipped customer writes no entry)', () => {
    expect(choicesNotice({ applied: 0, kept: 3, skipped: 0 }, 'per second', '0.52')).toBe('3 customers kept their own value.');
  });

  it('opens the notice with the save and how many customers moved by themselves', () => {
    expect(savedTitle('Cutting-Rate-per-Sec', 17, 'per second', '0.47', '0.52')).toBe('Cutting-Rate-per-Sec saved. 17 customers had 0.47 and now have 0.52.');
    expect(savedTitle('Cutting-Rate-per-Sec', 0, 'per second', '0.47', '0.52')).toBe('Cutting-Rate-per-Sec saved.');
  });
});

describe('AC-5: the notice when the dialog is dismissed', () => {
  it('says the customers kept their own value and where to change it, in the words of the story', () => {
    expect(dismissedNotice(3)).toBe("3 customers kept their own value. Their rates change only when you edit them on the customer's page.");
    expect(dismissedNotice(1)).toBe("1 customer kept its own value. Its rate changes only when you edit it on the customer's page.");
  });
});

describe('counts and the shown value', () => {
  it('counts customers in the singular and the plural', () => {
    expect([customers(0), customers(1), customers(2)]).toEqual(['0 customers', '1 customer', '2 customers']);
  });

  it.each([
    ['0.52', true],
    ['12', true],
    ['0.4750', true],
    ['0.12345', false],
    ['-1', false],
    ['1e3', false],
    ['', false],
    [' 0.5', false],
  ])('judges the shown value %j as %s', (text, valid) => {
    expect(SHOWN_VALUE_PATTERN.test(text)).toBe(valid);
  });
});
