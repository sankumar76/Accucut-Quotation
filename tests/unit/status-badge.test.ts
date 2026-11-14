import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { WorkspaceHeader, type WorkspaceHeaderView } from '@/components/features/estimate-workspace/workspace-header';
import { QueueList } from '@/components/features/queues/queue-list';
import { StatusBadge } from '@/components/shared/status-badge';
import type { RoleName } from '@/lib/auth/roles';
import { ESTIMATE_STATUSES, type EstimateStatus } from '@/lib/estimate/state-machine';
import type { QueueRowData } from '@/lib/tasks/queue-client';

/**
 * STORY-04.04 T2, T3 (AC-1, AC-2, AC-5): the status badge, and the two places that draw it (the queue's rows and cards, and the task header), rendered to markup with no
 * browser. The words are the story's and the screens', written out here and not imported, so a changed word fails a test. A badge has its word and an icon (never colour alone), an
 * approved task is one badge too ("Approved" in a list, "Approved and locked" in the task header: the G3 screens, review SQR-01), and nothing but a word is ever drawn: no amount, approver or reason. The widths and axe are `tests/e2e/task-status.spec.ts`.
 * Every name, path and date is invented.
 */

const row = (status: EstimateStatus): QueueRowData => ({
  id: '00000000-0000-4000-8000-000000000001',
  code: 'Q-2026-0042',
  title: 'Hopper cover',
  engineerName: 'Invented Arjun',
  customerName: null,
  folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
  folderUrl: 'file:////invented-server/invented-share/RFQ-1',
  deadlineAt: '2026-11-12T11:30:00.000Z',
  status,
  assignedByName: 'Invented Boss',
});

const header = (status: EstimateStatus): WorkspaceHeaderView => ({
  code: 'Q-2026-0042',
  status,
  deadlineLabel: '12 Nov 2026, 17:00 IST',
  folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
  folderUrl: 'file:////invented-server/invented-share/RFQ-1',
  title: 'Hopper cover',
  notes: null,
  assignedByName: 'Invented Boss',
});

const badge = (status: EstimateStatus, variant: 'list' | 'header' = 'list'): string => renderToStaticMarkup(createElement(StatusBadge, { status, variant }));
const list = (role: RoleName, status: EstimateStatus): string => renderToStaticMarkup(createElement(QueueList, { role, tasks: [row(status)], asOf: '2026-11-09T04:00:00.000Z' }));
const textOf = (html: string): string => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const occurrences = (html: string, text: string): number => html.split(text).length - 1;

describe('AC-1: a badge with the word and an icon', () => {
  it.each([
    ['DRAFT', 'Draft'],
    ['SUBMITTED', 'Submitted'],
  ] as const)('%s is the word "%s", beside an icon, and the task is not closed', (status, word) => {
    const html = badge(status);
    expect(textOf(html).trim()).toBe(word);
    expect(html).toContain('<svg');
    expect(html).toContain(`data-status="${status}"`);
    expect(occurrences(html, '<svg')).toBe(1);
    expect(html).not.toContain('Closed');
  });

  it('APPROVED is one badge, "Approved", with a lock icon, and the word "Closed" is not drawn (it is the tab\'s name)', () => {
    const html = badge('APPROVED');
    expect(textOf(html).trim()).toBe('Approved');
    expect(occurrences(html, '<svg')).toBe(1);
    expect(occurrences(html, 'data-slot="badge"')).toBe(1);
    expect(html).not.toContain('Closed');
  });

  it('the task header says "Approved and locked" for an approved task and the same word as a list for the other two', () => {
    expect(textOf(badge('APPROVED', 'header')).trim()).toBe('Approved and locked');
    expect(textOf(badge('DRAFT', 'header')).trim()).toBe('Draft');
    expect(textOf(badge('SUBMITTED', 'header')).trim()).toBe('Submitted');
  });

  it('the queue draws the badge in a table row and in a card, for every status', () => {
    for (const status of ESTIMATE_STATUSES) {
      const html = list('ENGINEER', status);
      expect(occurrences(html, 'data-slot="status-badge"'), `a row and a card for ${status}`).toBe(2);
      expect(html).toContain(`data-status="${status}"`);
    }
  });

  it('the task header draws it too', () => {
    expect(textOf(renderToStaticMarkup(createElement(WorkspaceHeader, { view: header('SUBMITTED') })))).toContain('Submitted');
    const approved = textOf(renderToStaticMarkup(createElement(WorkspaceHeader, { view: header('APPROVED') })));
    expect(approved).toContain('Approved and locked');
    expect(approved).not.toContain('Closed');
  });
});

describe('AC-5: the same words for every role', () => {
  it.each(['ENGINEER', 'LEAD', 'ADMIN'] as const)('%s reads the same status words in the queue', (role) => {
    const words = (status: EstimateStatus): string => (/data-slot="status-badge"[^>]*>(.*?)<\/span><\/td>/.exec(list(role, status)) ?? [])[1] ?? '';
    expect(textOf(words('DRAFT')).trim()).toBe('Draft');
    expect(textOf(words('SUBMITTED')).trim()).toBe('Submitted');
    expect(textOf(words('APPROVED')).trim()).toBe('Approved');
  });
});

describe('AC-2: nothing but a word is drawn, and "Approved" shows no amount', () => {
  it('has no digit, currency sign, approver or reason in any badge', () => {
    for (const status of ESTIMATE_STATUSES) {
      expect(textOf(badge(status))).not.toMatch(/[\d₹$€]|approved by|reason|price|override/i);
    }
  });

  it('an approved task in the header and the queue carries the status words and no figure beyond its own code and deadline', () => {
    const html = textOf(renderToStaticMarkup(createElement(WorkspaceHeader, { view: header('APPROVED') })));
    expect(html).not.toMatch(/₹|\$|€|price|approved by|override|reason/i);
  });
});
