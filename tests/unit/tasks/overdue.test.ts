import { describe, expect, it } from 'vitest';

import { bellHrefFor, isOverdue, overdueBy, overdueSummary } from '@/lib/tasks/overdue';
import { createFixedClock, MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE, parseIstDateTime } from '@/lib/time';

/**
 * STORY-04.03 T1 (AC-1, AC-3, AC-6; FR-036, NFR-015): the pure rules of "overdue". A task is overdue when its deadline is strictly before the instant it is judged
 * at (the decision of STORY-04.02: a deadline exactly now is not overdue yet, one millisecond ago is), so "flips exactly at the deadline instant" means the state
 * changes between the last instant that is not past it and the first that is. The wording is the UX spec's ("Overdue by 1 d 18 h"; the minutes under an hour; the
 * singular "1 task is overdue"), written out here and not imported. Every date is invented and every instant is built through `lib/time.ts`.
 */

const DEADLINE = new Date('2026-11-09T04:00:00.000Z');
const after = (milliseconds: number): Date => new Date(DEADLINE.getTime() + milliseconds);

describe('AC-6: overdue flips exactly at the deadline instant, on the controlled clock', () => {
  it('is not overdue before the deadline, nor at the deadline, and is overdue from the next millisecond', () => {
    expect(isOverdue(DEADLINE, after(-1))).toBe(false);
    expect(isOverdue(DEADLINE, after(0))).toBe(false);
    expect(isOverdue(DEADLINE, after(1))).toBe(true);
  });

  it('judges a deadline of midnight IST at 23:59:59 and at 00:00:01 IST around it, whatever the machine zone', () => {
    const midnightIst = parseIstDateTime('2026-11-10', '00:00');
    if (midnightIst === null) throw new Error('The deadline did not parse.');
    const clock = createFixedClock(new Date(midnightIst.getTime() - 1_000));
    expect(clock.now().toISOString()).toBe('2026-11-09T18:29:59.000Z');
    expect(isOverdue(midnightIst, clock.now())).toBe(false);
    expect(overdueBy(midnightIst, clock.now())).toBeNull();
    clock.advance(2_000);
    expect(clock.now().toISOString()).toBe('2026-11-09T18:30:01.000Z');
    expect(isOverdue(midnightIst, clock.now())).toBe(true);
    expect(overdueBy(midnightIst, clock.now())).toBe('less than 1 min');
  });
});

describe('AC-1: "Overdue by" is days and hours, and the minutes under an hour', () => {
  it('says nothing for a task that is not overdue', () => {
    expect(overdueBy(DEADLINE, after(-MILLISECONDS_PER_DAY))).toBeNull();
    expect(overdueBy(DEADLINE, after(0))).toBeNull();
  });

  it('says days and hours from a day on, as in the UX spec: 1 d 18 h', () => {
    expect(overdueBy(DEADLINE, after(MILLISECONDS_PER_DAY + 18 * MILLISECONDS_PER_HOUR))).toBe('1 d 18 h');
    expect(overdueBy(DEADLINE, after(10 * MILLISECONDS_PER_DAY + 59 * MILLISECONDS_PER_MINUTE))).toBe('10 d 0 h');
    expect(overdueBy(DEADLINE, after(MILLISECONDS_PER_DAY))).toBe('1 d 0 h');
  });

  it('says whole hours under a day', () => {
    expect(overdueBy(DEADLINE, after(5 * MILLISECONDS_PER_HOUR + 59 * MILLISECONDS_PER_MINUTE))).toBe('5 h');
    expect(overdueBy(DEADLINE, after(MILLISECONDS_PER_HOUR))).toBe('1 h');
    expect(overdueBy(DEADLINE, after(MILLISECONDS_PER_DAY - 1))).toBe('23 h');
  });

  it('says minutes under an hour, and "less than 1 min" under a minute', () => {
    expect(overdueBy(DEADLINE, after(MILLISECONDS_PER_HOUR - 1))).toBe('59 min');
    expect(overdueBy(DEADLINE, after(42 * MILLISECONDS_PER_MINUTE))).toBe('42 min');
    expect(overdueBy(DEADLINE, after(MILLISECONDS_PER_MINUTE))).toBe('1 min');
    expect(overdueBy(DEADLINE, after(MILLISECONDS_PER_MINUTE - 1))).toBe('less than 1 min');
    expect(overdueBy(DEADLINE, after(1))).toBe('less than 1 min');
  });
});

describe('AC-1: the count is worded in the singular where it is 1', () => {
  it.each([
    [0, '0 tasks are overdue'],
    [1, '1 task is overdue'],
    [2, '2 tasks are overdue'],
    [12, '12 tasks are overdue'],
  ])('%i -> %s', (count, words) => {
    expect(overdueSummary(count)).toBe(words);
  });
});

describe('AC-3: the bell opens the Overdue tab, for a Lead the tasks that Lead assigned', () => {
  it('goes to /queue?tab=overdue for an Engineer and an Admin, and adds assignedBy=me for a Lead', () => {
    expect(bellHrefFor('ENGINEER')).toBe('/queue?tab=overdue');
    expect(bellHrefFor('ADMIN')).toBe('/queue?tab=overdue');
    expect(bellHrefFor('LEAD')).toBe('/queue?tab=overdue&assignedBy=me');
  });
});
