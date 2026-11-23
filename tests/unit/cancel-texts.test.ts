import { describe, expect, it } from 'vitest';

import {
  CANCEL_LABEL,
  CANCEL_UNCONFIRMED,
  cancelIntro,
  cancelTitle,
  KEEP_LABEL,
  PASSWORD_HINT,
  PASSWORD_LABEL,
  REASON_HINT,
  REASON_LABEL,
} from '@/components/features/estimate-cancel/cancel-texts';
import {
  APPROVAL_ALREADY_CANCELLED_MESSAGE,
  APPROVAL_CHANGED_MESSAGE,
  CANCEL_CUSTOMER_DELETED_MESSAGE,
  CANCEL_MATERIAL_DELETED_MESSAGE,
  CANCEL_REASON_MAX,
  checkCancelReason,
  NO_APPROVAL_TO_CANCEL_MESSAGE,
} from '@/lib/estimate/cancel-words';
import { checkUnlockReason } from '@/lib/estimate/unlock-words';

/**
 * STORY-06.12 AC-2, AC-9, AC-10 (UX spec v0.31 SCR-06 "Cancel approval (Admin)", "Cancel approval on a Draft or Prepared estimate" and "customer or material deleted, final words"): the words of the Cancel approval dialog
 * and of the server's sentences. They are written out here from the spec, not copied from the product, so a changed sentence fails a test. Every name is invented.
 */

describe('the dialog (AC-2)', () => {
  it('the title names the task, and the fields, hints and buttons are the spec\'s', () => {
    expect(cancelTitle('Q-2026-0318')).toBe('Cancel the approval of Q-2026-0318?');
    expect(REASON_LABEL).toBe('Reason for cancelling');
    expect(REASON_HINT).toBe('It is kept in the audit log.');
    expect(PASSWORD_LABEL).toBe('Your password');
    expect(PASSWORD_HINT).toBe('We ask for your password again because this changes a price that was approved.');
    expect(KEEP_LABEL).toBe('Keep the approval');
    expect(CANCEL_LABEL).toBe('Cancel approval');
  });

  it('an approved estimate: it goes back to Draft and the task returns to the Engineer\'s Open queue, as an unlock does', () => {
    expect(cancelIntro('APPROVED', 'Priya Nair')).toBe(
      'The estimate goes back to Draft and the task returns to Priya Nair\'s Open queue, as it does when it is unlocked. The approved price stays on screen, marked "Approval cancelled", until you remove it. Neither step can be undone. A new approval, after a Recalculate, brings a price back.',
    );
  });

  it('AC-10: a Draft or a Prepared estimate keeps its status and its task, in the ux-expert\'s words (v0.29)', () => {
    expect(cancelIntro('DRAFT', 'Priya Nair')).toBe(
      'The estimate stays a Draft and its task does not change. The approved price stays on screen, marked "Approval cancelled", until you remove it. Neither step can be undone. A new approval brings a price back.',
    );
    expect(cancelIntro('PREPARED', 'Priya Nair')).toBe(
      'The estimate stays Prepared and its task does not change. The approved price stays on screen, marked "Approval cancelled", until you remove it. Neither step can be undone. A new approval brings a price back.',
    );
  });

  it('a status that is none is refused, never worded', () => {
    expect(() => cancelIntro('CLOSED' as never, 'Priya Nair')).toThrow('Unhandled cancel status.');
  });

  it('a lost answer claims nothing about what was stored, and says pressing again cannot cancel twice', () => {
    expect(CANCEL_UNCONFIRMED).toContain('It may have gone through');
    expect(CANCEL_UNCONFIRMED).toContain('cannot cancel it twice');
    expect(CANCEL_UNCONFIRMED).not.toContain('Nothing was changed');
  });
});

describe('the server\'s sentences (AC-5, AC-9)', () => {
  it('AC-9: the two deleted-master sentences are the ux-expert\'s final words, name the approval, and mention no Excel file', () => {
    expect(CANCEL_CUSTOMER_DELETED_MESSAGE).toBe('The customer chosen for this estimate was deleted, so the approval cannot be cancelled. The approval was not changed.');
    expect(CANCEL_MATERIAL_DELETED_MESSAGE).toBe('A material chosen for a part of this estimate was deleted, so the approval cannot be cancelled. The approval was not changed.');
    expect(`${CANCEL_CUSTOMER_DELETED_MESSAGE}${CANCEL_MATERIAL_DELETED_MESSAGE}`).not.toContain('Excel');
  });

  it('the three 409 sentences of the approval itself hold no figure, no ID and no name', () => {
    for (const sentence of [APPROVAL_CHANGED_MESSAGE, APPROVAL_ALREADY_CANCELLED_MESSAGE, NO_APPROVAL_TO_CANCEL_MESSAGE]) {
      expect(sentence).toMatch(/^[A-Z][^0-9₹]*\.$/);
    }
  });
});

describe('the reason (AC-5)', () => {
  it('is the unlock\'s rule, said the same way: trimmed, 1 to 500 characters, no hidden character', () => {
    expect(CANCEL_REASON_MAX).toBe(500);
    for (const text of ['', '  \n ', 'x'.repeat(500), 'x'.repeat(501), '😀'.repeat(500), '😀'.repeat(501), 'Round​ed', '  Trimmed.  ', 'First.\r\nSecond.']) {
      expect(checkCancelReason(text)).toEqual(checkUnlockReason(text));
    }
    expect(checkCancelReason('  Trimmed.  ')).toEqual({ ok: true, reason: 'Trimmed.' });
  });
});
