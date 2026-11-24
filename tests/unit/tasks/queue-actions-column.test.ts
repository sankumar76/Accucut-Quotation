import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { QueueList } from '@/components/features/queues/queue-list';
import type { RoleName } from '@/lib/auth/roles';
import type { DownloadMarkers } from '@/lib/tasks/download-markers-client';
import type { QueueRowData } from '@/lib/tasks/queue-client';

/**
 * DEF-077 (AQP-420; DL-357; UX 13044): the Lead's and Admin's task table keeps its Actions column at the region's right edge. Rendered to markup with no browser: five columns whose last one is the sticky,
 * opaque Actions column of the masters tables (`sticky right-0`, a fixed width, wrapping headings), the Customer, Folder and Assigned by moved into the Task and Engineer cells as text once each (never a hidden
 * column), the overdue tint carried over to the sticky cell, and the Engineer's list, which has no Actions column, left as it was. What a browser measures (the actions inside the region at 768 to 1440 px, a Tab to
 * each action) is `tests/e2e/queue-actions-visible.spec.ts`. Every name and path is invented.
 */

const row = (overrides: Partial<QueueRowData> = {}): QueueRowData => ({
  id: '00000000-0000-4000-8000-000000000001',
  code: 'Q-2026-0042',
  title: 'Hopper cover',
  engineerName: 'Invented Arjun',
  customerName: 'Invented Customer Ltd',
  folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
  folderUrl: 'file:////invented-server/invented-share/RFQ-1',
  deadlineAt: '2026-11-12T11:30:00.000Z',
  status: 'DRAFT',
  assignedByName: 'Invented Boss',
  ignoredRemarks: null,
  ...overrides,
});

/** After the deadline of `row()`: its open row is overdue. */
const LATE = '2026-11-15T04:00:00.000Z';
/** Before it: nothing is overdue. */
const EARLY = '2026-11-09T04:00:00.000Z';

const MARKERS: DownloadMarkers = { '00000000-0000-4000-8000-000000000001': { kind: 'downloaded', count: 1, last: { byName: 'Invented Lead', at: '2026-11-13T05:00:00.000Z' } } };

const list = (role: RoleName, tasks: ReadonlyArray<QueueRowData>, asOf: string = EARLY, markers?: DownloadMarkers): string =>
  renderToStaticMarkup(createElement(QueueList, { role, tasks, asOf, markers }));
const tableOf = (html: string): string => html.slice(html.indexOf('<table'), html.indexOf('</table>'));
const occurrences = (html: string, text: string): number => html.split(text).length - 1;
/** The cells of the first body row, each as its opening tag and markup. */
const cellsOfFirstRow = (table: string): ReadonlyArray<string> => {
  const body = table.slice(table.indexOf('<tbody'));
  return Array.from(body.slice(0, body.indexOf('</tr>')).matchAll(/<td[^>]*>.*?(?=<td|$)/g), (match) => match[0]);
};

describe('the Actions column is the sticky one of the masters tables (UX spec 6.0 part 2)', () => {
  it.each(['LEAD', 'ADMIN'] as const)('%s: the table is a masters-style table, its Actions heading and every Actions cell are sticky at the right edge and opaque, and the visible word "Actions" stays', (role) => {
    const table = tableOf(list(role, [row(), row({ id: '00000000-0000-4000-8000-000000000002', code: 'Q-2026-0043', status: 'PREPARED' })]));
    expect(table).toMatch(/<th[^>]*sticky right-0[^>]*>Actions<\/th>/);
    expect(table).toMatch(/<th[^>]*bg-surface-2[^>]*sticky|<th[^>]*sticky[^>]*bg-surface-2/);
    expect(occurrences(table, 'sticky right-0')).toBe(3);
    const cells = Array.from(table.matchAll(/<td[^>]*sticky right-0[^>]*>/g), (match) => match[0]);
    expect(cells).toHaveLength(2);
    for (const cell of cells) expect(cell).toContain('bg-surface');
  });

  it('the region is the isolated one that keeps focus clear of the sticky column, with a fixed Actions width of 200 px and headings that wrap', () => {
    const html = list('LEAD', [row()]);
    const region = html.slice(html.indexOf('data-slot="table-container"'), html.indexOf('<table'));
    expect(region).toContain('isolate');
    expect(region).toContain('scroll-pe-(--actions-w)');
    expect(region).toContain('[--actions-w:200px]');
    expect(html.slice(html.indexOf('<table'), html.indexOf('<caption'))).toContain('[&amp;_th]:whitespace-normal');
  });

  it('an overdue row repeats its tint on the sticky cell, and a row that is not overdue does not', () => {
    const late = tableOf(list('LEAD', [row()], LATE));
    expect(late).toMatch(/<tr[^>]*bg-accent-soft/);
    expect(late).toMatch(/<td[^>]*sticky right-0[^>]*bg-accent-soft/);
    const early = tableOf(list('LEAD', [row()], EARLY));
    expect(early).not.toContain('bg-accent-soft');
    expect(early).toMatch(/<td[^>]*sticky right-0[^>]*bg-surface/);
  });

  it('a closed row\'s sticky cell holds the word "Closed" and the whole Downloaded chip, and an ignored row\'s holds "Open to restore"', () => {
    const closed = row({ status: 'APPROVED' });
    const cells = cellsOfFirstRow(tableOf(list('LEAD', [closed], EARLY, MARKERS)));
    const actions = cells[cells.length - 1] ?? '';
    expect(actions).toContain('sticky right-0');
    expect(actions).toContain('data-closed-action');
    expect(actions).toContain('data-slot="download-chip"');
    expect(actions).toContain('Downloaded 1×');
    const ignored = cellsOfFirstRow(tableOf(list('LEAD', [row({ status: 'IGNORED', ignoredRemarks: 'Set aside.' })])));
    expect(ignored[ignored.length - 1]).toContain('Open to restore');
  });
});

describe('the three columns that dropped out are lines of the cells, visible text once each (never a hidden column)', () => {
  it('the Task cell holds the code, the title, "Customer: <name>" ("Not chosen yet" when empty) and the folder once, with one Copy path; the Engineer cell holds the name and "Assigned by: <name>"', () => {
    for (const role of ['LEAD', 'ADMIN'] as const) {
      const table = tableOf(list(role, [row()]));
      const cells = cellsOfFirstRow(table);
      expect(cells).toHaveLength(5);
      expect(cells[0]).toContain('Q-2026-0042');
      expect(cells[0]).toContain('Hopper cover');
      expect(cells[0]).toMatch(/Customer: (<!-- -->)?<span[^>]*>Invented Customer Ltd<\/span>/);
      expect(cells[0]).toContain('href="file:////invented-server/invented-share/RFQ-1"');
      expect(occurrences(cells[0] ?? '', 'Copy path</button>')).toBe(1);
      expect(cells[1]).toContain('Invented Arjun');
      expect(cells[1]).toMatch(/Assigned by: (<!-- -->)?Invented Boss/);
      expect(occurrences(table, 'Customer: ')).toBe(1);
      expect(occurrences(table, 'Assigned by: ')).toBe(1);
      expect(occurrences(table, 'Copy path</button>')).toBe(1);
      expect(table).not.toContain('hidden');
    }
  });

  it('says "Customer: Not chosen yet" for a task with no customer, and shows a stored path that has no link as plain text, with no Copy path', () => {
    const table = tableOf(list('LEAD', [row({ customerName: null, folderUrl: null })]));
    expect(table).toMatch(/Customer: (<!-- -->)?<span[^>]*>Not chosen yet<\/span>/);
    expect(table).toContain('\\\\invented-server\\invented-share\\RFQ-1');
    expect(table).not.toContain('Copy path</button>');
  });

  it('the deadline wraps at its spaces and the overdue line sits under it', () => {
    const table = tableOf(list('LEAD', [row()], LATE));
    const deadline = cellsOfFirstRow(table)[2] ?? '';
    expect(deadline).toContain('12 Nov 2026, 17:00 IST');
    expect(deadline).not.toContain('whitespace-nowrap');
    expect(deadline).toContain('data-overdue-marker');
  });

  it('the remarks of an Ignored row wrap in the Status column within 240 px', () => {
    const table = tableOf(list('LEAD', [row({ status: 'IGNORED', ignoredRemarks: 'Set aside.' })]));
    expect(table).toContain('max-w-[240px]');
    expect(table).not.toContain('max-w-[280px]');
  });
});

describe('the Engineer\'s list is as it was: no Actions column, no sticky cell, the columns that drop out below 1024 px', () => {
  it('has no sticky class, no fixed Actions width and no Customer or Engineer line in its cells', () => {
    const table = tableOf(list('ENGINEER', [row()]));
    expect(table).not.toContain('sticky');
    expect(table).not.toContain('--actions-w');
    expect(table).not.toContain('Customer: ');
    expect(table).not.toContain('Assigned by: ');
    expect(Array.from(table.matchAll(/<th\s[^>]*>(.*?)<\/th>/g), (match) => match[1])).toEqual(['Task', 'Folder', 'Deadline (IST)', 'Status', 'Assigned by']);
  });
});
