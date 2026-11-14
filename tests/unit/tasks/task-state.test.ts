import { describe, expect, it } from 'vitest';

import { ESTIMATE_STATUSES, decideTransition } from '@/lib/estimate/state-machine';
import { isTaskClosed } from '@/lib/estimate/task-status';
import { tabsOf, taskTab } from '@/lib/tasks/task-state';

/**
 * STORY-04.05 (AC-1, AC-2, AC-3, AC-4): which tabs a task is in, from the status of its estimate and its deadline, and from nothing else. A table over every status and
 * three deadlines (past, exactly now, ahead); the rule of "closed" is the one `isTaskClosed` and `taskTab` is built on it. The SQL form of the same rule is held to this
 * table by `tests/integration/tasks/close-reopen.test.ts`. Every date is invented.
 */

const NOW = new Date('2026-11-09T04:00:00.000Z');
const PAST = new Date('2026-11-08T04:00:00.000Z');
const AHEAD = new Date('2026-11-10T04:00:00.000Z');

describe('AC-1, AC-2: the status x deadline matrix', () => {
  it.each([
    ['DRAFT', 'past', PAST, 'open', ['open', 'overdue']],
    ['DRAFT', 'exactly now', NOW, 'open', ['open']],
    ['DRAFT', 'ahead', AHEAD, 'open', ['open']],
    ['SUBMITTED', 'past', PAST, 'open', ['open', 'overdue']],
    ['SUBMITTED', 'exactly now', NOW, 'open', ['open']],
    ['SUBMITTED', 'ahead', AHEAD, 'open', ['open']],
    // AC-2: an approved task is Closed, and never Overdue, even long past its deadline.
    ['APPROVED', 'past', PAST, 'closed', ['closed']],
    ['APPROVED', 'exactly now', NOW, 'closed', ['closed']],
    ['APPROVED', 'ahead', AHEAD, 'closed', ['closed']],
  ] as const)('%s, deadline %s: the tab is %s and it is listed in %j', (status, _when, deadlineAt, tab, tabs) => {
    expect(taskTab(status)).toBe(tab);
    expect(tabsOf(status, deadlineAt, NOW)).toEqual(tabs);
  });

  it('covers every status the machine has, so a new status fails here until its tab is decided', () => {
    for (const status of ESTIMATE_STATUSES) {
      expect(['open', 'closed']).toContain(taskTab(status));
    }
  });
});

describe("AC-3: an unlock or the Admin's cancel puts an approved task back in Open (and Overdue if late)", () => {
  it.each([
    ['UNLOCK', 'LEAD'],
    ['UNLOCK', 'ADMIN'],
    ['CANCEL', 'ADMIN'],
  ] as const)('%s by %s: APPROVED leads to a status whose task is open, and overdue again past the deadline', (event, role) => {
    const decision = decideTransition('APPROVED', event, role);
    if (!decision.allowed) throw new Error('The state machine should allow this event.');
    expect(taskTab('APPROVED')).toBe('closed');
    expect(taskTab(decision.to)).toBe('open');
    expect(tabsOf(decision.to, PAST, NOW)).toEqual(['open', 'overdue']);
    expect(tabsOf(decision.to, AHEAD, NOW)).toEqual(['open']);
  });
});

describe('AC-4: one rule', () => {
  it('takes its answer from isTaskClosed for every status', () => {
    for (const status of ESTIMATE_STATUSES) {
      expect(taskTab(status) === 'closed').toBe(isTaskClosed(status));
    }
  });

  it('counts consistently: open + closed is the number of tasks, and every overdue task is also an open one', () => {
    const tasks = ESTIMATE_STATUSES.flatMap((status) => [PAST, NOW, AHEAD].map((deadlineAt) => ({ status, deadlineAt })));
    const inTab = (tab: 'open' | 'closed' | 'overdue') => tasks.filter((task) => tabsOf(task.status, task.deadlineAt, NOW).includes(tab));
    expect(inTab('open').length + inTab('closed').length).toBe(tasks.length);
    expect(inTab('overdue')).toHaveLength(2);
    expect(inTab('overdue').every((task) => inTab('open').includes(task))).toBe(true);
  });
});
