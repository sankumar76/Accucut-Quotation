import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { QueueList } from '@/components/features/queues/queue-list';
import { QueueScreen } from '@/components/features/queues/queue-screen';
import { emptyTextFor, ignoredIntroFor } from '@/components/features/queues/queue-texts';
import type { RoleName } from '@/lib/auth/roles';
import { QUEUE_TABS } from '@/lib/tasks/queue';
import type { QueuePageData, QueueRowData } from '@/lib/tasks/queue-client';
import { NO_QUEUE_FILTERS } from '@/lib/tasks/queue-filters';
import { REMARKS_PREVIEW_LENGTH } from '@/lib/tasks/remarks-preview';

/**
 * CR-01 item 7D, AC-3 and AC-10 (AQP-401; the ux-expert's comment 12944 section 1 and checks 1, 3, 4, 5), what SCR-03 draws for the Ignored tab, rendered to markup with no browser: the four tabs and their order, the
 * intro line and the sort note and the empty words of each role, the dashed badge and the remarks as plain text under it, the 140-code-point cut with "Read all remarks", no overdue bar, clock or tint on an ignored row
 * past its deadline, "Open to restore" and no Reassign for a Lead, and no Actions column for an Engineer. The words are written out here from the design of record, not imported, so a changed sentence fails a test. The
 * browser (the 2 by 2 grid at 360 px, the 44 px targets, axe) is `tests/e2e/ignore-restore.spec.ts`. Every name, path and date is invented.
 */

const row = (overrides: Partial<QueueRowData> = {}): QueueRowData => ({
  id: '00000000-0000-4000-8000-000000000001',
  code: 'Q-2026-0305',
  title: 'Hopper cover',
  engineerName: 'Invented Arjun',
  customerName: null,
  folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
  folderUrl: 'file:////invented-server/invented-share/RFQ-1',
  deadlineAt: '2026-11-02T11:30:00.000Z',
  status: 'IGNORED',
  assignedByName: 'Invented Boss',
  ignoredRemarks: 'Not taken forward.',
  ...overrides,
});

/** Past the deadline of every row above (02 Nov), so an open row would be overdue. */
const AS_OF = '2026-11-09T04:00:00.000Z';
const page = (tasks: ReadonlyArray<QueueRowData>, overrides: Partial<QueuePageData> = {}): QueuePageData => ({
  tab: 'ignored',
  tasks,
  counts: { open: 2, closed: 1, overdue: 1, ignored: tasks.length },
  nextCursor: null,
  asOf: AS_OF,
  ...overrides,
});
const screen = (role: RoleName, data: QueuePageData): string => renderToStaticMarkup(createElement(QueueScreen, { role, initialPage: data, initialFilters: NO_QUEUE_FILTERS }));
const list = (role: RoleName, tasks: ReadonlyArray<QueueRowData>): string => renderToStaticMarkup(createElement(QueueList, { role, tasks, asOf: AS_OF }));
const occurrences = (html: string, text: string): number => html.split(text).length - 1;

describe('check 1: the tablist is Open, Closed, Overdue, Ignored, for both roles', () => {
  it.each(['ENGINEER', 'LEAD', 'ADMIN'] as const)('%s: four tabs in that order, each with its count, the Ignored tab last', (role) => {
    expect(QUEUE_TABS).toEqual(['open', 'closed', 'overdue', 'ignored']);
    const html = screen(role, page([row()], { counts: { open: 2, closed: 1, overdue: 1, ignored: 7 } }));
    // The text of each tab with its markup and its count taken off (the Overdue tab has an icon first).
    const names = [...html.matchAll(/<button[^>]*role="tab"[^>]*>(.*?)<\/button>/g)].map((match) => (match[1] ?? '').replace(/<[^>]*>/g, '').replace(/\d+$/, ''));
    expect(names).toEqual(['Open', 'Closed', 'Overdue', 'Ignored']);
    expect(html).toMatch(/aria-selected="true"[^>]*>Ignored<span[^>]*>7<\/span>/);
  });

  it('below 480 px the four tabs are a 2 by 2 grid, and from 480 px one row (the classes of the tablist)', () => {
    const html = screen('LEAD', page([row()]));
    expect(html).toContain('max-[479px]:grid');
    expect(html).toContain('max-[479px]:grid-cols-2');
    expect(html).toContain('max-[479px]:overflow-x-visible');
  });
});

describe('check 5 and AC-3: the intro line, the sort note and the empty words, per role', () => {
  it('the Engineer\'s intro line and the Lead\'s and the Admin\'s', () => {
    expect(ignoredIntroFor('ENGINEER')).toBe('Tasks that a Lead or Admin set aside. You can read them but not change them.');
    for (const role of ['LEAD', 'ADMIN'] as const) expect(ignoredIntroFor(role)).toBe('RFQs that were not taken forward. They are out of Open and Overdue. Open one to restore it.');
    expect(screen('ENGINEER', page([row()]))).toContain('Tasks that a Lead or Admin set aside. You can read them but not change them.');
    expect(screen('LEAD', page([row()]))).toContain('RFQs that were not taken forward. They are out of Open and Overdue. Open one to restore it.');
  });

  it('the Ignored tab\'s sort note drops the clause about Overdue, and the other tabs keep it', () => {
    const ignored = screen('LEAD', page([row()]));
    expect(ignored).toContain('Sorted by deadline, earliest first.');
    expect(ignored).not.toContain('Overdue tasks stay in Open as well.');
    expect(screen('LEAD', page([row({ status: 'DRAFT', ignoredRemarks: null })], { tab: 'open' }))).toContain('Overdue tasks stay in Open as well.');
  });

  it('the empty states: an Engineer\'s and a manager\'s, each with the intro line above', () => {
    expect(emptyTextFor('ENGINEER', 'ignored')).toEqual({ title: 'Nothing has been ignored', description: 'If a Lead or Admin sets one of your tasks aside, it appears here with their remarks.' });
    for (const role of ['LEAD', 'ADMIN'] as const) expect(emptyTextFor(role, 'ignored')).toEqual({ title: 'No ignored tasks', description: 'An RFQ you ignore leaves Open and appears here. You can restore it from its page.' });
    const engineer = screen('ENGINEER', page([], { counts: { open: 0, closed: 0, overdue: 0, ignored: 0 } }));
    expect(engineer).toContain('Nothing has been ignored');
    expect(engineer).toContain('If a Lead or Admin sets one of your tasks aside, it appears here with their remarks.');
    expect(engineer).toContain('Tasks that a Lead or Admin set aside.');
    const manager = screen('LEAD', page([], { counts: { open: 0, closed: 0, overdue: 0, ignored: 0 } }));
    expect(manager).toContain('No ignored tasks');
    expect(manager).toContain('An RFQ you ignore leaves Open and appears here. You can restore it from its page.');
    // No "Assign task" button in the empty Ignored tab: that action belongs to the Open tab.
    expect(manager.match(/Assign task/g)?.length ?? 0).toBe(1);
  });
});

describe('check 4: an Ignored row past its deadline has no overdue treatment, and the Lead\'s action is a link to the page', () => {
  it.each(['LEAD', 'ADMIN'] as const)('%s: the dashed Ignored badge, the remarks, "Open to restore" with the task in its name, and no Reassign', (role) => {
    const html = list(role, [row()]);
    expect(html).toContain('data-status="IGNORED"');
    expect(html).toContain('border-dashed');
    expect(html).toContain('>Ignored<');
    expect(html).toContain('Not taken forward.');
    expect(html).toContain('>Open to restore<');
    expect(html).toContain('aria-label="Open to restore, Q-2026-0305"');
    expect(html).toContain('href="/estimates/Q-2026-0305"');
    expect(html).not.toMatch(/Reassign|data-reassign-action|Closed<|Restore as|>Restore</);
  });

  it('is past its deadline and still has no clock, no "Overdue by", no bar and no tint; an open row past its deadline has all three', () => {
    const ignored = list('LEAD', [row()]);
    expect(ignored).not.toMatch(/data-overdue-marker|Overdue by|border-l-accent|bg-accent-soft/);
    const open = list('LEAD', [row({ status: 'DRAFT', ignoredRemarks: null })]);
    expect(open).toMatch(/data-overdue-marker/);
    expect(open).toContain('Overdue by');
  });

  it('an ignored Approved task shows the Ignored badge and no download chip or "Closed" word', () => {
    const html = list('LEAD', [row()]);
    expect(html).not.toContain('Not downloaded');
    expect(html).not.toContain('data-closed-action');
  });

  it('an Engineer\'s list has no Actions column and no link to restore, and still has the badge and the remarks', () => {
    const html = list('ENGINEER', [row()]);
    expect(html).not.toMatch(/Actions|Open to restore|Reassign|data-restore-link/);
    expect(html).toContain('Not taken forward.');
    expect(html).toContain('data-status="IGNORED"');
  });

  it('the task code is the one link to the task in each layout for an Engineer', () => {
    expect(occurrences(list('ENGINEER', [row()]), 'href="/estimates/Q-2026-0305"')).toBe(2);
  });
});

describe('check 3: the remarks in a row, whole up to 140 code points and cut beyond with a link to the task', () => {
  it('140 code points are shown whole, with no "Read all remarks"', () => {
    const remarks = 'x'.repeat(REMARKS_PREVIEW_LENGTH);
    const html = list('LEAD', [row({ ignoredRemarks: remarks })]);
    expect(html).toContain(remarks);
    expect(html).not.toContain('Read all remarks');
  });

  it('141 are cut at a word with an ellipsis and the link "Read all remarks" naming the task, to the task page', () => {
    const remarks = `${'abcdefghi '.repeat(14)}abcdefghi and a long tail that is cut`;
    const html = list('LEAD', [row({ ignoredRemarks: remarks })]);
    expect(html).toContain('…');
    expect(html).not.toContain('a long tail that is cut');
    expect(html).toContain('>Read all remarks<');
    expect(html).toContain('aria-label="Read all remarks, Q-2026-0305"');
    expect(html).toContain('href="/estimates/Q-2026-0305"');
  });

  it('line breaks become spaces', () => {
    const html = list('LEAD', [row({ ignoredRemarks: 'First line.\nSecond line.' })]);
    expect(html).toContain('First line. Second line.');
  });

  it('shows markup as typed: <b>x</b> is text, never an element, and no link is made of an address in it', () => {
    const html = list('LEAD', [row({ ignoredRemarks: '<b>x</b> https://invented.example.test/a' })]);
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt; https://invented.example.test/a');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('href="https://invented.example.test');
  });

  it('a row of the other tabs, which carries no remarks, draws none', () => {
    const html = list('LEAD', [row({ status: 'DRAFT', ignoredRemarks: null })]);
    expect(html).not.toContain('data-ignored-remarks');
  });
});
