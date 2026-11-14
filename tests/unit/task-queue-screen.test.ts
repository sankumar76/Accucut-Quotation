import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { QueueList } from '@/components/features/queues/queue-list';
import { QueueScreen } from '@/components/features/queues/queue-screen';
import { descriptionFor, emptyTextFor } from '@/components/features/queues/queue-texts';
import type { RoleName } from '@/lib/auth/roles';
import { QUEUE_TABS } from '@/lib/tasks/queue';
import type { QueuePageData, QueueRowData } from '@/lib/tasks/queue-client';

/**
 * STORY-04.02 T4, T5 (AC-1, AC-3, AC-4, AC-6): what SCR-03 draws, rendered to markup with no browser: the tabs with counts and the sort note, the columns of each
 * role, the one link of a row, "Not chosen yet", the deadline in IST, and the empty-state words of each role and tab. The words are the UX spec's and the story's,
 * written out here and not imported, so a changed sentence fails a test. The behaviour in a browser (the tabs by keyboard, the widths, axe) is
 * `tests/e2e/task-queue.spec.ts`. Every name, path and date is invented.
 */

const row = (overrides: Partial<QueueRowData> = {}): QueueRowData => ({
  id: '00000000-0000-4000-8000-000000000001',
  code: 'Q-2026-0042',
  title: 'Hopper cover',
  engineerName: 'Invented Arjun',
  customerName: null,
  folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
  folderUrl: 'file:////invented-server/invented-share/RFQ-1',
  deadlineAt: '2026-11-12T11:30:00.000Z',
  status: 'DRAFT',
  assignedByName: 'Invented Boss',
  ...overrides,
});

/** The instant the server judged overdue at: three days before the deadline of `row()`, so no default row is overdue. */
const AS_OF = '2026-11-09T04:00:00.000Z';

const page = (tasks: ReadonlyArray<QueueRowData>, overrides: Partial<QueuePageData> = {}): QueuePageData => ({
  tab: 'open',
  tasks,
  counts: { open: tasks.length, closed: 1, overdue: 2 },
  nextCursor: null,
  asOf: AS_OF,
  ...overrides,
});

const screen = (role: RoleName, data: QueuePageData, assignedByMe = false): string => renderToStaticMarkup(createElement(QueueScreen, { role, initialPage: data, assignedByMe }));
const list = (role: RoleName, tasks: ReadonlyArray<QueueRowData>, asOf: string = AS_OF): string => renderToStaticMarkup(createElement(QueueList, { role, tasks, asOf }));
const occurrences = (html: string, text: string): number => html.split(text).length - 1;

describe('AC-1: three tabs with counts, and the sort note', () => {
  it('has a tablist of Open, Closed and Overdue, each with its count, and the first one selected', () => {
    const html = screen('LEAD', page([row()], { counts: { open: 5, closed: 1, overdue: 2 } }));
    expect(html).toContain('role="tablist"');
    expect(occurrences(html, 'role="tab"')).toBe(3);
    expect(html).toMatch(/aria-selected="true"[^>]*>Open<span[^>]*>5<\/span>/);
    expect(html).toMatch(/>Closed<span[^>]*>1<\/span>/);
    expect(html).toMatch(/Overdue<span[^>]*>2<\/span>/);
    expect(html).toContain('role="tabpanel"');
  });

  it('says how the list is sorted, and that an overdue task stays in Open', () => {
    expect(screen('ENGINEER', page([row()]))).toContain('Sorted by deadline, earliest first. Overdue tasks stay in Open as well.');
  });

  it('is titled "My tasks" for an Engineer and "Task queue" for a Lead and an Admin, with the words of each', () => {
    expect(screen('ENGINEER', page([row()]))).toContain('<h1');
    expect(screen('ENGINEER', page([row()]))).toMatch(/>My tasks<\/h1>/);
    for (const role of ['LEAD', 'ADMIN'] as const) expect(screen(role, page([row()]))).toMatch(/>Task queue<\/h1>/);
    expect(descriptionFor('ENGINEER')).toBe('Tasks assigned to you. Open one to start entering part data.');
    expect(descriptionFor('LEAD')).toBe('All tasks assigned to Engineers.');
  });

  it('knows the three tabs it draws', () => {
    expect(QUEUE_TABS).toHaveLength(3);
  });
});

describe('AC-3: the rows', () => {
  it('has the task code as the one link of the task in each layout, to the task\'s page', () => {
    const html = list('LEAD', [row()]);
    // One in the table and one on the phone's card (only one of the two is shown at any width).
    expect(occurrences(html, 'href="/estimates/Q-2026-0042"')).toBe(2);
    expect(html).toContain('>Q-2026-0042</a>');
  });

  it('reads "Not chosen yet" until the Engineer has chosen the customer, then the name', () => {
    expect(list('LEAD', [row()])).toContain('Not chosen yet');
    const chosen = list('LEAD', [row({ customerName: 'Invented Customer Ltd' })]);
    expect(chosen).toContain('Invented Customer Ltd');
    expect(chosen).not.toContain('Not chosen yet');
  });

  it('shows the folder with the shared link and Copy path, and says what a blocked link means once above the list, not under every row', () => {
    const html = list('LEAD', [row(), row({ id: '00000000-0000-4000-8000-000000000002', code: 'Q-2026-0043' })]);
    expect(occurrences(html, 'href="file:////invented-server/invented-share/RFQ-1"')).toBe(4);
    expect(occurrences(html, 'Copy path</button>')).toBe(4);
    expect(occurrences(html, '<p class="px-s-4 pt-s-4 text-label text-ink-2">Your browser may block links to network folders.')).toBe(1);
    expect(occurrences(html, '<p id=')).toBe(0);
  });

  it('shows a stored path that has no link as plain text, with no link and no Copy path', () => {
    const html = list('LEAD', [row({ folderUrl: null })]);
    expect(html).toContain('\\\\invented-server\\invented-share\\RFQ-1');
    expect(html).not.toContain('href="file:');
    expect(html).not.toContain('Copy path</button>');
  });

  it('gives a Lead and an Admin the Engineer and Customer columns and "Assigned by", and the "Assign task" button', () => {
    for (const role of ['LEAD', 'ADMIN'] as const) {
      const html = screen(role, page([row()]));
      expect(html).toMatch(/<th[^>]*>Engineer<\/th>/);
      expect(html).toMatch(/<th[^>]*>Customer<\/th>/);
      expect(html).toMatch(/<th[^>]*>Assigned by<\/th>/);
      expect(html).toContain('Invented Arjun');
      expect(html).toContain('href="/assign"');
      expect(html).toContain('Assign task');
    }
  });

  it('gives an Engineer no Engineer or Customer column, no Assign button and no other person\'s name, but "Assigned by"', () => {
    const html = screen('ENGINEER', page([row()]));
    expect(html).not.toMatch(/<th[^>]*>Engineer<\/th>/);
    expect(html).not.toMatch(/<th[^>]*>Customer<\/th>/);
    expect(html).toMatch(/<th[^>]*>Assigned by<\/th>/);
    expect(html).not.toContain('Invented Arjun');
    expect(html).not.toContain('Not chosen yet');
    expect(html).not.toContain('href="/assign"');
    expect(html).not.toContain('Assign task');
    expect(html).toContain('Invented Boss');
  });

  it('keeps the Task, Engineer, Deadline and Status columns at every width and drops Customer, Folder and Assigned by below 1024 px', () => {
    const html = list('LEAD', [row()]);
    for (const name of ['Customer', 'Folder', 'Assigned by']) expect(html).toMatch(new RegExp(`<th[^>]*hidden lg:table-cell[^>]*>${name}</th>`));
    for (const name of ['Task', 'Engineer', 'Deadline \\(IST\\)', 'Status']) expect(html).toMatch(new RegExp(`<th[^>]*>${name}</th>`));
    expect(html).not.toMatch(/<th[^>]*hidden[^>]*>(Task|Engineer|Deadline|Status)/);
  });

  it('draws a table from 768 px and a card for each task below it', () => {
    const html = list('LEAD', [row()]);
    expect(html).toContain('class="hidden md:block"');
    expect(html).toMatch(/<ul[^>]*class="[^"]*md:hidden/);
    expect(occurrences(html, '<li ')).toBe(1);
  });

  it('writes the status in words, and a title as text so markup in it is not run', () => {
    const html = list('LEAD', [row({ status: 'SUBMITTED', title: '<script>alert(1)</script>' })]);
    expect(html).toContain('Submitted');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('AC-6: deadlines in IST', () => {
  it('shows 23:30 IST on the day it is set for, though that is 18:00 UTC', () => {
    expect(list('LEAD', [row({ deadlineAt: '2026-11-09T18:00:00.000Z' })])).toContain('09 Nov 2026, 23:30 IST');
  });

  it('shows 03:00 IST on its day, which is the evening before in UTC', () => {
    const html = list('ENGINEER', [row({ deadlineAt: '2026-11-08T21:30:00.000Z' })]);
    expect(html).toContain('09 Nov 2026, 03:00 IST');
    expect(html).not.toContain('08 Nov 2026');
  });
});

describe('AC-4: empty states by role and tab', () => {
  it('says what an Engineer\'s empty Open tab says, with no button', () => {
    const html = screen('ENGINEER', page([]));
    expect(html).toContain('Nothing assigned to you right now');
    expect(html).toContain('When a Lead assigns you a task it appears here, with its folder and deadline.');
    expect(html).not.toContain('Assign task');
  });

  it('says what a Lead\'s and an Admin\'s empty Open tab says, with the "Assign task" button', () => {
    for (const role of ['LEAD', 'ADMIN'] as const) {
      const html = screen(role, page([]));
      expect(html).toContain('No open tasks');
      expect(html).toContain('Assign a task to an Engineer and it appears here.');
      expect(occurrences(html, 'href="/assign"')).toBe(2);
    }
  });

  it('is a polite status, and has no table or card when there is nothing to list', () => {
    const html = screen('LEAD', page([]));
    expect(html).toContain('role="status"');
    expect(html).not.toContain('<table');
    expect(html).not.toContain('<li ');
  });

  it('words the Closed and Overdue tabs for each role', () => {
    expect(emptyTextFor('ENGINEER', 'closed').title).toBe('No closed tasks yet');
    expect(emptyTextFor('LEAD', 'closed')).toEqual(emptyTextFor('ADMIN', 'closed'));
    expect(emptyTextFor('ENGINEER', 'overdue').title).toBe('Nothing is overdue');
    expect(emptyTextFor('ADMIN', 'overdue').title).toBe('No overdue tasks');
    expect(emptyTextFor('ADMIN', 'open').title).toBe('No open tasks');
  });

  it('offers more tasks only while the server says more follow', () => {
    expect(screen('LEAD', page([row()], { nextCursor: 'abc' }))).toContain('Show more tasks');
    expect(screen('LEAD', page([row()]))).not.toContain('Show more tasks');
  });
});

/** An instant 1 d 18 h after the deadline of `row()` (11:30 UTC on 12 November): the UX spec's example. */
const LATE = '2026-11-14T05:30:00.000Z';

describe('STORY-04.03 AC-1: an overdue row has the clock icon, "Overdue by", and the amber bar and tint, together', () => {
  it('says "Overdue by 1 d 18 h" with a clock icon, a bar and a tint on the row of the table and on the card', () => {
    const html = list('ENGINEER', [row()], LATE);
    // One in the table and one on the phone's card (only one of the two is shown at any width).
    expect(occurrences(html, 'data-overdue-marker')).toBe(2);
    expect(occurrences(html, 'Overdue by 1 d 18 h')).toBe(2);
    expect(occurrences(html, 'lucide-clock')).toBe(2);
    expect(occurrences(html, 'border-l-accent')).toBe(2);
    expect(occurrences(html, 'bg-accent-soft')).toBe(2);
  });

  it('marks nothing on a row whose deadline has not passed, and on the instant of the deadline itself (strict, as the queue is)', () => {
    for (const asOf of [AS_OF, '2026-11-12T11:30:00.000Z']) {
      const html = list('LEAD', [row()], asOf);
      expect(html).not.toContain('data-overdue-marker');
      expect(html).not.toContain('Overdue by');
      expect(html).not.toContain('bg-accent-soft');
    }
  });

  it('marks it from the next millisecond, and says "less than 1 min" then', () => {
    expect(list('LEAD', [row()], '2026-11-12T11:30:00.001Z')).toContain('Overdue by less than 1 min');
  });

  it('never marks a closed (approved) task, whatever its deadline', () => {
    expect(list('LEAD', [row({ status: 'APPROVED' })], LATE)).not.toContain('Overdue by');
  });

  it('marks the late rows and only them in one list', () => {
    const html = list('LEAD', [row(), row({ id: '00000000-0000-4000-8000-000000000002', code: 'Q-2026-0043', deadlineAt: '2026-11-20T11:30:00.000Z' })], LATE);
    expect(occurrences(html, 'Overdue by 1 d 18 h')).toBe(2);
    expect(occurrences(html, 'data-overdue-marker')).toBe(2);
  });
});

describe('STORY-04.03 AC-1: the Overdue tab says how many tasks are overdue, in the singular where it is 1', () => {
  it('adds the summary notice on the Overdue tab, "1 task is overdue" and "3 tasks are overdue"', () => {
    expect(screen('LEAD', page([row()], { tab: 'overdue', counts: { open: 1, closed: 0, overdue: 1 }, asOf: LATE }))).toContain('1 task is overdue');
    expect(screen('LEAD', page([row()], { tab: 'overdue', counts: { open: 3, closed: 0, overdue: 3 }, asOf: LATE }))).toContain('3 tasks are overdue');
  });

  it('has no summary notice on the other tabs', () => {
    expect(screen('LEAD', page([row()], { tab: 'open', counts: { open: 1, closed: 0, overdue: 3 } }))).not.toContain('tasks are overdue');
  });
});

describe('STORY-04.03 AC-3: the Lead\'s Overdue tab from the bell says it shows the tasks that Lead assigned', () => {
  it('says so, with a way back to every task, only when it is cut that way', () => {
    const cut = screen('LEAD', page([row()], { tab: 'overdue' }), true);
    expect(cut).toContain('Showing only the tasks you assigned.');
    expect(cut).toContain('href="/queue"');
    expect(cut).toContain('Show all tasks');
    expect(screen('LEAD', page([row()], { tab: 'overdue' }))).not.toContain('Showing only the tasks you assigned.');
  });
});
