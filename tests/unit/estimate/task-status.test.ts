import { describe, expect, it } from 'vitest';

import { ESTIMATE_STATUSES, isLocked } from '@/lib/estimate/state-machine';
import { APPROVED_LOCKED_LABEL, displayStatusOf, isTaskClosed, isTaskOpen, taskStatusOf } from '@/lib/estimate/task-status';

/**
 * STORY-04.04 T1 (AC-1, AC-5) and CR-01 item 7B (AQP-399 AC-6): the one place that words the status of a task, from `estimates.status` and `estimates.ignored_at` alone. Pure code: the
 * same words for every role, and nothing in the answer but a word and whether the task is closed (no figure, no approver, no reason: NFR-002). One word for each status, as the G3 screens
 * draw it: "Closed" is the tab's name, never a second word of the status (review SQR-01).
 */

const IGNORED_AT = new Date('2026-11-23T10:00:00.000Z');

describe('AC-1: Draft, Prepared, Approved and Quoted (a closed task is an approved or a quoted one), derived from the status of the estimate', () => {
  it('words a DRAFT estimate as Draft, still open', () => {
    expect(taskStatusOf('DRAFT')).toEqual({ label: 'Draft', closed: false });
  });

  it('words a PREPARED estimate as Prepared, still open', () => {
    expect(taskStatusOf('PREPARED')).toEqual({ label: 'Prepared', closed: false });
  });

  it('words an APPROVED estimate as Approved, and the task as closed (Closed is the approved estimate, never a status or a word of its own)', () => {
    expect(taskStatusOf('APPROVED')).toEqual({ label: 'Approved', closed: true });
    expect(APPROVED_LOCKED_LABEL).toBe('Approved and locked');
  });

  it('words a QUOTED estimate as Quoted, and the task as closed (AQP-399 AC-6)', () => {
    expect(taskStatusOf('QUOTED')).toEqual({ label: 'Quoted', closed: true });
  });

  it('words an ignored estimate as Ignored, and the task as not closed: it is in neither Open nor Closed', () => {
    expect(taskStatusOf('IGNORED')).toEqual({ label: 'Ignored', closed: false });
  });

  it('an unlocked estimate is back to DRAFT, so its task is open again with the word Draft', () => {
    // Nothing but `estimates.status` is read: what the unlock leaves behind (an earlier approval) cannot change the words.
    expect(taskStatusOf('DRAFT').closed).toBe(false);
  });

  it('knows every status of the state machine, and each has exactly one word', () => {
    expect(ESTIMATE_STATUSES.map((status) => taskStatusOf(status).label)).toEqual(['Draft', 'Prepared', 'Approved', 'Quoted']);
  });
});

describe('AQP-399 AC-6: displayStatusOf', () => {
  it.each(ESTIMATE_STATUSES)('answers %s when the estimate is not ignored', (status) => {
    expect(displayStatusOf({ status, ignoredAt: null })).toBe(status);
  });

  it.each(['DRAFT', 'PREPARED', 'APPROVED'] as const)('answers IGNORED when ignoredAt is set, whatever the status underneath (%s)', (status) => {
    expect(displayStatusOf({ status, ignoredAt: IGNORED_AT })).toBe('IGNORED');
  });

  it('reads the time as a Date or as the text a view carries, and answers IGNORED for both', () => {
    expect(displayStatusOf({ status: 'PREPARED', ignoredAt: IGNORED_AT.toISOString() })).toBe('IGNORED');
  });
});

describe('SQR-02 and AQP-399 AC-6: one rule for "closed" and one for "open"', () => {
  it('isTaskClosed is true for APPROVED and QUOTED and for no other status, and `closed` is always derived from it', () => {
    expect(ESTIMATE_STATUSES.filter((status) => isTaskClosed(status, false))).toEqual(['APPROVED', 'QUOTED']);
    for (const status of ESTIMATE_STATUSES) expect(taskStatusOf(status).closed, status).toBe(isTaskClosed(status, false));
  });

  it('closed is the same set as locked: the lock helper and the tab agree', () => {
    for (const status of ESTIMATE_STATUSES) expect(isTaskClosed(status, false), status).toBe(isLocked(status));
  });

  it('an ignored task is never closed, and never open: it is in the Ignored tab alone', () => {
    for (const status of ESTIMATE_STATUSES) {
      expect(isTaskClosed(status, true), status).toBe(false);
      expect(isTaskOpen(status, true), status).toBe(false);
    }
  });

  it('isTaskOpen is true for DRAFT and PREPARED that are not ignored, and for no other', () => {
    expect(ESTIMATE_STATUSES.filter((status) => isTaskOpen(status, false))).toEqual(['DRAFT', 'PREPARED']);
    for (const status of ESTIMATE_STATUSES) expect(isTaskOpen(status, false) !== isTaskClosed(status, false), status).toBe(true);
  });
});

describe('AC-2: the words carry no figure', () => {
  it('has only a label and a closed flag, and no word has a digit or a currency sign', () => {
    for (const status of [...ESTIMATE_STATUSES, 'IGNORED'] as const) {
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
