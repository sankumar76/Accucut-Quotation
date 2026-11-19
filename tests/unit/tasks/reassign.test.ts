import { describe, expect, it } from 'vitest';

import { DEADLINE_MESSAGE, ENGINEER_MESSAGE } from '@/lib/tasks/assign';
import { checkReassign, type StoredAssignment } from '@/lib/tasks/reassign';

/**
 * STORY-04.07 (AC-3): the pure rules of "Reassign or change deadline", written once for the form and the server. The words are the UX spec's (SCR-04 "Form
 * fields"), written out here and not imported, so a changed sentence fails a test. Every ID and date is invented.
 */

const NOW = new Date('2026-11-09T04:00:00.000Z');
const ARJUN = '00000000-0000-4000-8000-0000000000e1';
const PRIYA = '00000000-0000-4000-8000-0000000000e2';
/** 17:00 IST on 12 November: later than NOW. */
const STORED: StoredAssignment = { engineerId: ARJUN, deadlineAt: new Date('2026-11-12T11:30:00.000Z') };
/** The same task, three days past its deadline: the common case of moving an overdue task to someone else. */
const OVERDUE: StoredAssignment = { engineerId: ARJUN, deadlineAt: new Date('2026-11-06T11:30:00.000Z') };

describe('AC-3: the messages are the ones of assigning', () => {
  it('uses the UX spec’s words', () => {
    expect(ENGINEER_MESSAGE).toBe('Choose an Engineer.');
    expect(DEADLINE_MESSAGE).toBe('Choose a deadline later than now.');
  });
});

describe('AC-3: what changes', () => {
  it('a new Engineer alone changes the Engineer and not the deadline', () => {
    expect(checkReassign({ engineerId: PRIYA }, STORED, NOW)).toEqual({ ok: true, changes: { engineerId: PRIYA, deadlineAt: null } });
  });

  it('a later deadline alone changes the deadline and not the Engineer, read as the UTC instant it is', () => {
    const result = checkReassign({ deadlineAt: '2026-11-13T06:30:00.000Z' }, STORED, NOW);
    expect(result).toEqual({ ok: true, changes: { engineerId: null, deadlineAt: new Date('2026-11-13T06:30:00.000Z') } });
  });

  it('both together change both', () => {
    expect(checkReassign({ engineerId: PRIYA, deadlineAt: '2026-11-13T06:30:00Z' }, STORED, NOW)).toEqual({
      ok: true,
      changes: { engineerId: PRIYA, deadlineAt: new Date('2026-11-13T06:30:00.000Z') },
    });
  });

  it('trims the Engineer and compares IDs without regard to letter case, so the stored ID is "unchanged" however it is typed', () => {
    const stored: StoredAssignment = { engineerId: 'aaaaaaaa-0000-4000-8000-0000000000e1', deadlineAt: STORED.deadlineAt };
    expect(checkReassign({ engineerId: ' AAAAAAAA-0000-4000-8000-0000000000E1 ' }, stored, NOW)).toEqual({ ok: true, changes: { engineerId: null, deadlineAt: null } });
  });
});

describe('AC-3: nothing to change', () => {
  it('a body with neither field changes nothing', () => {
    expect(checkReassign({}, STORED, NOW)).toEqual({ ok: true, changes: { engineerId: null, deadlineAt: null } });
  });

  it('the values already stored change nothing', () => {
    expect(checkReassign({ engineerId: ARJUN, deadlineAt: STORED.deadlineAt.toISOString() }, STORED, NOW)).toEqual({ ok: true, changes: { engineerId: null, deadlineAt: null } });
  });
});

describe('AC-3 (D-3): the deadline is judged only when it differs from the stored one', () => {
  it('accepts an unchanged deadline that is already in the past, so an overdue task can be given to another Engineer', () => {
    expect(checkReassign({ engineerId: PRIYA, deadlineAt: OVERDUE.deadlineAt.toISOString() }, OVERDUE, NOW)).toEqual({
      ok: true,
      changes: { engineerId: PRIYA, deadlineAt: null },
    });
  });

  it('refuses a changed deadline that is not later than now, whatever the stored one was', () => {
    expect(checkReassign({ deadlineAt: '2026-11-08T11:30:00.000Z' }, STORED, NOW)).toEqual({ ok: false, errors: { deadlineAt: DEADLINE_MESSAGE } });
    expect(checkReassign({ deadlineAt: '2026-11-08T11:30:00.000Z' }, OVERDUE, NOW)).toEqual({ ok: false, errors: { deadlineAt: DEADLINE_MESSAGE } });
  });

  it('refuses a deadline exactly at now (it must be later), and accepts one a millisecond after', () => {
    expect(checkReassign({ deadlineAt: NOW.toISOString() }, STORED, NOW)).toEqual({ ok: false, errors: { deadlineAt: DEADLINE_MESSAGE } });
    expect(checkReassign({ deadlineAt: '2026-11-09T04:00:00.001Z' }, STORED, NOW).ok).toBe(true);
  });

  it('judges a 23:30 IST deadline as the instant it is (18:00 UTC), not as a date', () => {
    expect(checkReassign({ deadlineAt: '2026-11-09T18:00:00.000Z' }, STORED, NOW)).toEqual({
      ok: true,
      changes: { engineerId: null, deadlineAt: new Date('2026-11-09T18:00:00.000Z') },
    });
  });
});

describe('AC-3: what is not an Engineer or a deadline', () => {
  it.each(['', '   '])('an Engineer given as %j is "Choose an Engineer."', (engineerId) => {
    expect(checkReassign({ engineerId }, STORED, NOW)).toEqual({ ok: false, errors: { engineerId: ENGINEER_MESSAGE } });
  });

  it.each(['', 'tomorrow', '2026-11-13', '2026-11-13T10:00', '2026-02-31T10:00:00.000Z', '2026-13-01T10:00:00.000Z', '2026-11-13T25:00:00.000Z'])(
    'a deadline written as %j is "Choose a deadline later than now."',
    (deadlineAt) => {
      expect(checkReassign({ deadlineAt }, STORED, NOW)).toEqual({ ok: false, errors: { deadlineAt: DEADLINE_MESSAGE } });
    },
  );

  it('names every problem at once', () => {
    expect(checkReassign({ engineerId: '', deadlineAt: 'tomorrow' }, STORED, NOW)).toEqual({
      ok: false,
      errors: { engineerId: ENGINEER_MESSAGE, deadlineAt: DEADLINE_MESSAGE },
    });
  });
});
