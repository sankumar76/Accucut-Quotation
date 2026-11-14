import { describe, expect, it } from 'vitest';

import { CLOSED_LABEL, taskStatusOf, TASK_STATUS_WORDS } from '@/lib/estimate/task-status';
import { ESTIMATE_STATUSES } from '@/lib/estimate/state-machine';

/**
 * STORY-04.04 T1 (AC-1, AC-5): the one place that words the status of a task, from `estimates.status` alone. Pure code: the same words for every role, and
 * nothing in the answer but a word and whether the task is closed (no figure, no approver, no reason: NFR-002).
 */

describe('AC-1: Draft, Submitted, Approved and Closed, derived from the status of the estimate', () => {
  it('words a DRAFT estimate as Draft, still open', () => {
    expect(taskStatusOf('DRAFT')).toEqual({ label: 'Draft', closed: false });
  });

  it('words a SUBMITTED estimate as Submitted, still open', () => {
    expect(taskStatusOf('SUBMITTED')).toEqual({ label: 'Submitted', closed: false });
  });

  it('words an APPROVED estimate as Approved, and the task as Closed (Closed is the approved estimate, never a status of its own)', () => {
    expect(taskStatusOf('APPROVED')).toEqual({ label: 'Approved', closed: true });
    expect(CLOSED_LABEL).toBe('Closed');
  });

  it('an unlocked estimate is back to DRAFT, so its task is open again with the word Draft', () => {
    // Nothing but `estimates.status` is read: what the unlock leaves behind (an earlier approval) cannot change the words.
    expect(taskStatusOf('DRAFT').closed).toBe(false);
  });

  it('knows every status of the state machine, and the four words are the whole vocabulary', () => {
    const words = new Set(ESTIMATE_STATUSES.flatMap((status) => [taskStatusOf(status).label, ...(taskStatusOf(status).closed ? [CLOSED_LABEL] : [])]));
    expect([...words].sort()).toEqual([...TASK_STATUS_WORDS].sort());
    expect(TASK_STATUS_WORDS).toEqual(['Draft', 'Submitted', 'Approved', 'Closed']);
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
