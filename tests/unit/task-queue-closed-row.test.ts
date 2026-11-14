import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { QueueList } from '@/components/features/queues/queue-list';
import { lateTextFor } from '@/components/features/queues/overdue-marker';
import type { RoleName } from '@/lib/auth/roles';
import type { QueueRowData } from '@/lib/tasks/queue-client';

/**
 * STORY-04.05 (AC-2, AC-5, AC-6; UX-20, SCR-03 "Differences by role"): what a Closed row draws, rendered to markup with no browser. A Lead and an Admin read the word
 * "Closed" in the action column of a closed task in place of the row actions (an approved task cannot be reassigned, A-14), and on the phone's card. An Engineer's row
 * has no action column at all and says only the status badge "Approved" (one badge per status: "Closed" is the tab's name, not a badge; STORY-04.04 AC-1). A list that
 * holds no closed row draws no action column (nothing is drawn for an action that does not exist yet, UX spec 6.0). The words are written out here and not imported.
 * Every name, path and date is invented.
 */

const row = (overrides: Partial<QueueRowData> = {}): QueueRowData => ({
  id: '00000000-0000-4000-8000-000000000001',
  code: 'Q-2026-0042',
  title: 'Hopper cover',
  engineerName: 'Invented Arjun',
  customerName: null,
  folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
  folderUrl: 'file:////invented-server/invented-share/RFQ-1',
  deadlineAt: '2026-11-05T11:30:00.000Z',
  status: 'APPROVED',
  assignedByName: 'Invented Boss',
  ...overrides,
});

/** Four days after the deadline of `row()`: the task is long past due. */
const AS_OF = '2026-11-09T04:00:00.000Z';

const list = (role: RoleName, tasks: ReadonlyArray<QueueRowData>): string => renderToStaticMarkup(createElement(QueueList, { role, tasks, asOf: AS_OF }));
const occurrences = (html: string, text: string): number => html.split(text).length - 1;
/** The table half of the markup, without the phone's cards. */
const tableOf = (html: string): string => html.slice(html.indexOf('<table'), html.indexOf('</table>'));
/** The phone's cards, without the table. */
const cardsOf = (html: string): string => html.slice(html.indexOf('<ul'));

describe('AC-5: a Closed row shows the word "Closed" in place of the row actions (Lead and Admin)', () => {
  it.each(['LEAD', 'ADMIN'] as const)('%s: the table has an Actions column, and the closed row says "Closed" in it', (role) => {
    const table = tableOf(list(role, [row()]));
    expect(table).toMatch(/<th[^>]*>Actions<\/th>/);
    expect(table).toMatch(/<td[^>]*><span[^>]*data-closed-action[^>]*>Closed<\/span><\/td>/);
  });

  it.each(['LEAD', 'ADMIN'] as const)('%s: the phone\'s card says "Closed" for a closed task', (role) => {
    expect(cardsOf(list(role, [row()]))).toMatch(/data-closed-action[^>]*>Closed</);
  });

  it('says it once for each closed row in each layout, and not for an open row beside it', () => {
    const html = list('LEAD', [row(), row({ id: '00000000-0000-4000-8000-000000000002', code: 'Q-2026-0043', status: 'SUBMITTED' }), row({ id: '00000000-0000-4000-8000-000000000003', code: 'Q-2026-0044' })]);
    expect(occurrences(tableOf(html), 'data-closed-action')).toBe(2);
    expect(occurrences(cardsOf(html), 'data-closed-action')).toBe(2);
  });

  it('draws no Actions column and no "Closed" for a list with no closed row (nothing is drawn for an action that does not exist yet)', () => {
    const html = list('LEAD', [row({ status: 'DRAFT' }), row({ id: '00000000-0000-4000-8000-000000000002', code: 'Q-2026-0043', status: 'SUBMITTED' })]);
    expect(html).not.toContain('Actions');
    expect(html).not.toContain('Closed');
  });

  it('offers no reassign or other action on a closed row', () => {
    const html = list('ADMIN', [row()]);
    // The action cell holds the word and nothing else (the "Copy path" button belongs to the Folder column).
    expect(html).toMatch(/<td[^>]*><span[^>]*data-closed-action[^>]*>Closed<\/span><\/td><\/tr>/);
    expect(html).not.toMatch(/Reassign/i);
  });
});

describe('AC-6: an Engineer\'s closed task says "Approved", and no price', () => {
  it('has no Actions column and no "Closed" word on the row or the card; the one badge says "Approved"', () => {
    const html = list('ENGINEER', [row()]);
    expect(html).not.toContain('Actions');
    expect(html).not.toContain('data-closed-action');
    expect(html).not.toContain('Closed');
    // One badge in the table and one on the phone's card; only one of the two is shown at any width.
    expect(occurrences(html, '>Approved<')).toBe(2);
  });

  it('draws no money in a closed row, for any role', () => {
    for (const role of ['ENGINEER', 'LEAD', 'ADMIN'] as const) {
      expect(list(role, [row()])).not.toMatch(/₹|\bINR\b|price|cost/i);
    }
  });
});

describe('AC-2: a closed task is never overdue, whatever its deadline', () => {
  it('has no "Overdue by" text for an approved task past its deadline, and has it once the estimate is unlocked back to DRAFT', () => {
    expect(lateTextFor({ deadlineAt: row().deadlineAt, status: 'APPROVED' }, AS_OF)).toBeNull();
    expect(lateTextFor({ deadlineAt: row().deadlineAt, status: 'DRAFT' }, AS_OF)).toBe('3 d 16 h');
    const approved = list('LEAD', [row()]);
    expect(approved).not.toContain('Overdue by');
    expect(list('LEAD', [row({ status: 'DRAFT' })])).toContain('Overdue by 3 d 16 h');
  });
});
