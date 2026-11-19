import { describe, expect, it } from 'vitest';

import {
  CLOSED_TITLE,
  LOG_NOTICE,
  NOT_ACTIVE_SUFFIX,
  reassignSummaryTitle,
  reassignedTitle,
  REASSIGN_TITLE,
  SUBMIT_REASSIGN,
} from '@/components/features/tasks/reassign-texts';
import { TASK_CLOSED_MESSAGE } from '@/lib/tasks/reassign';

/**
 * STORY-04.07 AC-2, AC-3, AC-6: the words of the edit mode of SCR-04. The notice is the UX spec's, written out here and not imported, so a changed sentence fails a test; the
 * proposed words (title, button, success line) are pinned too, so the ux-expert's ruling at the end review changes one file and these tests. Every name and date is invented.
 */

describe('AC-2: the words of the edit mode', () => {
  it('the notice is the UX spec\'s, to the letter', () => {
    expect(LOG_NOTICE).toBe('Changes are logged. The log records your name, the time, and the old and new values.');
  });

  it('the title and the button read as a change, not as "Assign task"', () => {
    expect(REASSIGN_TITLE).toBe('Reassign or change deadline');
    expect(SUBMIT_REASSIGN).toBe('Save changes');
    expect(SUBMIT_REASSIGN).not.toMatch(/assign task/i);
  });

  it('marks an Engineer who is no longer active in the list', () => {
    expect(NOT_ACTIVE_SUFFIX).toBe(' (not active)');
  });
});

describe('AC-3: the summary and the success line', () => {
  it('counts the things to fix, in the singular for one', () => {
    expect(reassignSummaryTitle(1)).toBe('1 thing needs fixing before this change can be saved.');
    expect(reassignSummaryTitle(2)).toBe('2 things need fixing before this change can be saved.');
  });

  it('names the task, the Engineer and the deadline in IST (23:30 IST is 18:00 UTC on the same day)', () => {
    expect(reassignedTitle('Q-2026-0324', 'Invented Meera', new Date('2026-11-04T06:30:00.000Z'))).toBe('Task Q-2026-0324 is now with Invented Meera, due 04 Nov 2026, 12:00 IST.');
    expect(reassignedTitle('Q-2026-0324', 'Invented Meera', new Date('2026-11-09T18:00:00.000Z'))).toContain('09 Nov 2026, 23:30 IST');
  });
});

describe('AC-6: an approved task', () => {
  it('says the server\'s own sentence, so the page and the 409 cannot differ', () => {
    expect(CLOSED_TITLE).toBe(TASK_CLOSED_MESSAGE);
    expect(TASK_CLOSED_MESSAGE).toBe('This task is approved, so its Engineer and deadline can no longer be changed.');
  });
});
