import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { QueueList } from '@/components/features/queues/queue-list';
import type { RoleName } from '@/lib/auth/roles';
import type { QueueRowData } from '@/lib/tasks/queue-client';

/**
 * STORY-04.07 AC-1 (UX-20, SCR-03 "Interactions"): what the rows of the queue offer, rendered to markup with no browser. Each open row has the action "Reassign or change
 * deadline" for a Lead and an Admin, a link to SCR-04 in edit mode for that task; a closed row says "Closed" and has none; an Engineer sees no action and no Actions column.
 * The accessible name keeps the visible words and adds the task code, so the same action on many rows is told apart (WCAG 2.5.3). The words are written out here and not
 * imported. Every name, path and date is invented.
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

const AS_OF = '2026-11-09T04:00:00.000Z';
const list = (role: RoleName, tasks: ReadonlyArray<QueueRowData>): string => renderToStaticMarkup(createElement(QueueList, { role, tasks, asOf: AS_OF }));
const occurrences = (html: string, text: string): number => html.split(text).length - 1;
const tableOf = (html: string): string => html.slice(html.indexOf('<table'), html.indexOf('</table>'));
const cardsOf = (html: string): string => html.slice(html.indexOf('<ul'));

const SECOND = row({ id: '00000000-0000-4000-8000-000000000002', code: 'Q-2026-0043', status: 'PREPARED' });

describe('AC-1: an open row has the action, for a Lead and an Admin', () => {
  it.each(['LEAD', 'ADMIN'] as const)('%s: the table has an Actions column and each open row links to SCR-04 in edit mode for its own task', (role) => {
    const table = tableOf(list(role, [row(), SECOND]));
    expect(table).toMatch(/<th[^>]*>Actions<\/th>/);
    expect(table).toContain('href="/assign?task=00000000-0000-4000-8000-000000000001"');
    expect(table).toContain('href="/assign?task=00000000-0000-4000-8000-000000000002"');
    expect(occurrences(table, 'data-reassign-action')).toBe(2);
  });

  it.each(['LEAD', 'ADMIN'] as const)('%s: the phone\'s card has the action too, once for each open task', (role) => {
    const cards = cardsOf(list(role, [row(), SECOND]));
    expect(occurrences(cards, 'data-reassign-action')).toBe(2);
    expect(cards).toContain('href="/assign?task=00000000-0000-4000-8000-000000000001"');
  });

  it('shows the visible words "Reassign or change deadline", and names the task in the accessible name so the same words on many rows are told apart', () => {
    const table = tableOf(list('LEAD', [row(), SECOND]));
    expect(table).toMatch(/<a[^>]*aria-label="Reassign or change deadline, Q-2026-0042"[^>]*>Reassign or change deadline<\/a>/);
    expect(table).toMatch(/<a[^>]*aria-label="Reassign or change deadline, Q-2026-0043"[^>]*>Reassign or change deadline<\/a>/);
  });

  it('shows the action on an overdue open row as well (a late task is the commonest one to reassign)', () => {
    const html = list('LEAD', [row({ deadlineAt: '2026-11-01T11:30:00.000Z' })]);
    expect(occurrences(tableOf(html), 'data-reassign-action')).toBe(1);
  });

  it('draws the Actions column for a list with no closed row: there is an action to put in it now', () => {
    expect(tableOf(list('LEAD', [row()]))).toMatch(/<th[^>]*>Actions<\/th>/);
  });
});

describe('AC-1 (UX-20): a closed row has "Closed" and no action', () => {
  it.each(['LEAD', 'ADMIN'] as const)('%s: an approved row says "Closed" in the Actions column and has no link to SCR-04, beside an open row that has one', (role) => {
    const closed = row({ id: '00000000-0000-4000-8000-000000000003', code: 'Q-2026-0044', status: 'APPROVED' });
    const html = list(role, [row(), closed]);
    expect(occurrences(tableOf(html), 'data-closed-action')).toBe(1);
    expect(occurrences(tableOf(html), 'data-reassign-action')).toBe(1);
    expect(html).not.toContain('assign?task=00000000-0000-4000-8000-000000000003');
    expect(html).not.toContain('Reassign or change deadline, Q-2026-0044');
  });

  it('a list of closed rows alone has no action at all', () => {
    expect(list('ADMIN', [row({ status: 'APPROVED' })])).not.toContain('data-reassign-action');
  });
});

describe('AC-1: an Engineer sees none', () => {
  it('draws no action, no link to SCR-04 and no Actions column, whatever the status', () => {
    for (const status of ['DRAFT', 'PREPARED', 'APPROVED'] as const) {
      const html = list('ENGINEER', [row({ status })]);
      expect(html, status).not.toContain('data-reassign-action');
      expect(html, status).not.toContain('/assign');
      expect(html, status).not.toContain('Reassign');
      expect(html, status).not.toContain('Actions');
    }
  });
});
