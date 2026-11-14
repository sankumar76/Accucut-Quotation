import { describe, expect, it } from 'vitest';

import { ESTIMATE_STATUSES } from '@/lib/estimate/state-machine';
import { APPROVED_LOCKED_LABEL, isTaskClosed, taskStatusOf } from '@/lib/estimate/task-status';

/**
 * STORY-04.04 T1 (AC-1, AC-5): the one place that words the status of a task, from `estimates.status` alone. Pure code: the same words for every role, and
 * nothing in the answer but a word and whether the task is closed (no figure, no approver, no reason: NFR-002). One word for each status, as the G3 screens draw it:
 * "Closed" is the tab's name, never a second word of the status (review SQR-01).
 */

describe('AC-1: Draft, Submitted and Approved (a closed task is the approved one), derived from the status of the estimate', () => {
  it('words a DRAFT estimate as Draft, still open', () => {
    expect(taskStatusOf('DRAFT')).toEqual({ label: 'Draft', closed: false });
  });

  it('words a SUBMITTED estimate as Submitted, still open', () => {
    expect(taskStatusOf('SUBMITTED')).toEqual({ label: 'Submitted', closed: false });
  });

  it('words an APPROVED estimate as Approved, and the task as closed (Closed is the approved estimate, never a status or a word of its own)', () => {
    expect(taskStatusOf('APPROVED')).toEqual({ label: 'Approved', closed: true });
    expect(APPROVED_LOCKED_LABEL).toBe('Approved and locked');
  });

  it('an unlocked estimate is back to DRAFT, so its task is open again with the word Draft', () => {
    // Nothing but `estimates.status` is read: what the unlock leaves behind (an earlier approval) cannot change the words.
    expect(taskStatusOf('DRAFT').closed).toBe(false);
  });

  it('knows every status of the state machine, and each has exactly one word of the three', () => {
    expect(ESTIMATE_STATUSES.map((status) => taskStatusOf(status).label)).toEqual(['Draft', 'Submitted', 'Approved']);
  });
});

describe('SQR-02: one rule for "closed"', () => {
  it('isTaskClosed is true for APPROVED and for no other status, and `closed` is always derived from it', () => {
    expect(ESTIMATE_STATUSES.filter(isTaskClosed)).toEqual(['APPROVED']);
    for (const status of ESTIMATE_STATUSES) expect(taskStatusOf(status).closed, status).toBe(isTaskClosed(status));
  });
});

describe('AC-2: the words carry no figure', () => {
  it('has only a label and a closed flag, and no word has a digit or a currency sign', () => {
    for (const status of ESTIMATE_STATUSES) {
      const view = taskStatusOf(status);
      expect(Object.keys(view).sort()).toEqual(['closed', 'label']);
      expect(view.label).not.toMatch(/[\d₹$€]/);
    }
  });

  it('refuses a status it does not know instead of guessing a word', () => {
    // @ts-expect-error a status outside the state machine, as bad data could carry it
    expect(() => taskStatusOf('CANCELLED')).toThrow('Unhandled task status.');
  });
});
