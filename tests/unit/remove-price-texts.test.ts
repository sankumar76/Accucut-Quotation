import { describe, expect, it } from 'vitest';

import { KEEP_LABEL, PASSWORD_HINT, PASSWORD_LABEL, REMOVE_LABEL, REMOVE_UNCONFIRMED, removeIntro, removeTitle } from '@/components/features/estimate-remove-price/remove-texts';
import {
  PRICE_REMOVED_APPROVE_AGAIN,
  PRICE_REMOVED_AUDIT_KEEPS,
  priceRemovedNoticeTitle,
  REMOVE_PRICE_FIRST_OPEN_FAILED,
  REMOVE_PRICE_LABEL,
} from '@/components/features/estimate-review/review-texts';
import {
  APPROVAL_NOT_CANCELLED_MESSAGE,
  NO_PRICE_TO_REMOVE_MESSAGE,
  PRICE_ALREADY_REMOVED_MESSAGE,
} from '@/lib/estimate/remove-price-words';

/**
 * STORY-06.13 AC-2, AC-3 (UX spec SCR-06 "Remove price (Admin)" and "Price removed"): the words of the Remove price dialog, the notice and the server's sentences. They are written out here from the spec, not copied from
 * the product, so a changed sentence fails a test. Every name is invented.
 */

describe('the dialog (AC-2)', () => {
  it("the title, the sentence, the field and the buttons are the spec's, word for word", () => {
    expect(removeTitle).toBe('Remove the approved price?');
    expect(removeIntro('₹ 12,600.00')).toBe(
      'The price ₹ 12,600.00 will be removed from every screen and from the Excel file. The audit log keeps it, and only you can read it. This cannot be undone. A new approval, after a Recalculate, is the way to set a price again.',
    );
    expect(PASSWORD_LABEL).toBe('Your password');
    expect(KEEP_LABEL).toBe('Keep the price');
    expect(REMOVE_LABEL).toBe('Remove price');
    expect(REMOVE_PRICE_LABEL).toBe('Remove price');
    expect(PASSWORD_HINT).toBe('We ask for your password again because this removes a price that was approved.');
  });

  it('a lost answer claims nothing about what was stored, and says pressing again cannot remove twice', () => {
    expect(REMOVE_UNCONFIRMED).toContain('It may have gone through');
    expect(REMOVE_UNCONFIRMED).toContain('pressing again cannot remove it twice');
    expect(REMOVE_PRICE_FIRST_OPEN_FAILED).toBe('The remove price window did not open. Check your connection and try again.');
  });
});

describe('the notice (AC-3)', () => {
  it("is the spec's sentence: who, when (IST), that the audit log keeps it, and how a price comes back", () => {
    expect(priceRemovedNoticeTitle('05 Nov 2026, 12:20 IST', 'Meera Iyer')).toBe('The approved price was removed on 05 Nov 2026, 12:20 IST by Meera Iyer.');
    expect(PRICE_REMOVED_AUDIT_KEEPS).toBe('The audit log keeps it.');
    expect(PRICE_REMOVED_APPROVE_AGAIN).toBe('Approve again, after a Recalculate, to set a price.');
  });
});

describe('the server sentences (AC-5): each names what is true and holds no figure', () => {
  it.each([
    [APPROVAL_NOT_CANCELLED_MESSAGE, 'This approval has not been cancelled, so its price cannot be removed. Cancel the approval first.'],
    [PRICE_ALREADY_REMOVED_MESSAGE, 'The price of this approval has already been removed.'],
    [NO_PRICE_TO_REMOVE_MESSAGE, 'This estimate has no approved price to remove.'],
  ])('%s', (actual, expected) => {
    expect(actual).toBe(expected);
    expect(actual).not.toMatch(/\d/);
  });
});
