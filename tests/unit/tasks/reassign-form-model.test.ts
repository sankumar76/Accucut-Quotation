import { describe, expect, it } from 'vitest';

import {
  engineerOptionsFor,
  reassignErrorsOf,
  reassignInputOf,
  reassignValuesOf,
  serverReassignErrors,
  type ReassignTaskData,
} from '@/components/features/tasks/reassign-form-model';
import { checkReassign } from '@/lib/tasks/reassign';

/**
 * STORY-04.07 AC-2, AC-3: what the edit form of SCR-04 holds and what it sends, with no browser. The form is filled with the stored Engineer and the deadline in IST; it sends
 * only what the person changed, as the server reads it (an ID and a UTC instant); and the messages of the rules and of the server are put under the controls of the form. Every
 * name and date is invented.
 */

const ARJUN = { id: '00000000-0000-4000-8000-0000000000e1', name: 'Invented Arjun' };
const MEERA = { id: '00000000-0000-4000-8000-0000000000e2', name: 'Invented Meera' };
const GONE = { id: '00000000-0000-4000-8000-0000000000e3', name: 'Invented Gone' };

/** 17:00 IST on 12 November. */
const TASK: ReassignTaskData = {
  id: '00000000-0000-4000-8000-000000000001',
  code: 'Q-2026-0042',
  engineer: ARJUN,
  deadlineAt: '2026-11-12T11:30:00.000Z',
  folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
  folderUrl: 'file:////invented-server/invented-share/RFQ-1',
  title: 'Hopper cover',
  notes: 'Invented notes.',
  status: 'DRAFT',
  ignored: false,
};

describe('AC-2: the form is filled with what the task holds', () => {
  it('has the Engineer selected, and the deadline as the IST date and time of two controls', () => {
    expect(reassignValuesOf(TASK)).toEqual({ engineerId: ARJUN.id, customerId: '', folderPath: '', deadlineDate: '2026-11-12', deadlineTime: '17:00', title: '', subject: '', notes: '' });
  });

  it('keeps a 23:30 IST deadline on its own IST day, where UTC is 18:00', () => {
    expect(reassignValuesOf({ ...TASK, deadlineAt: '2026-11-09T18:00:00.000Z' })).toMatchObject({ deadlineDate: '2026-11-09', deadlineTime: '23:30' });
  });

  it('offers the active Engineers, and the current one even when they are not active, marked so, so the control shows the truth', () => {
    expect(engineerOptionsFor(TASK, [ARJUN, MEERA])).toEqual([ARJUN, MEERA]);
    expect(engineerOptionsFor({ ...TASK, engineer: GONE }, [ARJUN, MEERA])).toEqual([ARJUN, MEERA, { id: GONE.id, name: 'Invented Gone (not active)' }]);
  });
});

describe('AC-3: only what changed is sent, in the form the server reads', () => {
  const saved = reassignValuesOf(TASK);

  it('sends nothing for a form that was not changed', () => {
    expect(reassignInputOf(saved, saved)).toEqual({});
  });

  it('sends the new Engineer alone', () => {
    expect(reassignInputOf({ ...saved, engineerId: MEERA.id }, saved)).toEqual({ engineerId: MEERA.id });
  });

  it('sends a new date or time as the UTC instant it is in IST: 12:00 IST on 13 November is 06:30 UTC', () => {
    expect(reassignInputOf({ ...saved, deadlineDate: '2026-11-13', deadlineTime: '12:00' }, saved)).toEqual({ deadlineAt: '2026-11-13T06:30:00.000Z' });
    expect(reassignInputOf({ ...saved, deadlineTime: '23:30' }, saved)).toEqual({ deadlineAt: '2026-11-12T18:00:00.000Z' });
  });

  it('sends both when both changed', () => {
    expect(reassignInputOf({ ...saved, engineerId: MEERA.id, deadlineDate: '2026-11-13' }, saved)).toEqual({ engineerId: MEERA.id, deadlineAt: '2026-11-13T11:30:00.000Z' });
  });

  it('sends an emptied date or time as an empty deadline, which the rules refuse in the spec\'s words', () => {
    for (const cleared of [{ deadlineDate: '' }, { deadlineTime: '' }]) {
      const input = reassignInputOf({ ...saved, ...cleared }, saved);
      expect(input).toEqual({ deadlineAt: '' });
      expect(checkReassign(input, { engineerId: ARJUN.id, deadlineAt: new Date(TASK.deadlineAt) }, new Date('2026-11-09T04:00:00.000Z'))).toEqual({
        ok: false,
        errors: { deadlineAt: 'Choose a deadline later than now.' },
      });
    }
  });

  it('sends a cleared Engineer as an empty choice, which the rules refuse as "Choose an Engineer."', () => {
    expect(reassignInputOf({ ...saved, engineerId: '' }, saved)).toEqual({ engineerId: '' });
  });
});

describe('AC-3: the messages are put under the controls of the form', () => {
  it('names the date control for a deadline message: the rules call the field deadlineAt, the form\'s field is deadline', () => {
    expect(reassignErrorsOf({ engineerId: 'Choose an Engineer.', deadlineAt: 'Choose a deadline later than now.' })).toEqual({
      engineerId: 'Choose an Engineer.',
      deadline: 'Choose a deadline later than now.',
    });
    expect(reassignErrorsOf({})).toEqual({});
  });

  it('takes the server\'s messages for the two fields the form has, and nothing else the server names', () => {
    expect(serverReassignErrors({ engineerId: 'Choose an Engineer.', deadlineAt: 'Choose a deadline later than now.', folderPath: 'x' })).toEqual({
      engineerId: 'Choose an Engineer.',
      deadline: 'Choose a deadline later than now.',
    });
    expect(serverReassignErrors({ folderPath: 'x' })).toEqual({});
  });
});
