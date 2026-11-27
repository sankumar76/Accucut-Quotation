import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TaskCards } from '@/components/features/estimate-workspace/task-cards';
import type { WorkspaceHeaderView } from '@/components/features/estimate-workspace/workspace-header';

/**
 * AQP-453 (DEF-096; UX spec SCR-05 and the mock-up `SCR-05.html`, CR-01 items 1 and 6): the task's customer, subject, folder and notes are ONE compact card of three rows, not two tall cards. Row 1: the task
 * folder (the link in mono, Copy path, the note on blocked links); row 2: the customer with its short name, the subject, and the line that says who set the customer and who can change it; row 3: the notes from the Lead
 * who assigned the task. The labels are the short capital ones of the design ("Task folder", "Customer", "Subject", "Notes from <Lead>"). Rendered to markup with no browser. Every name is invented.
 */

const VIEW: WorkspaceHeaderView = {
  code: 'Q-2026-0318',
  status: 'DRAFT',
  deadlineLabel: '06 Nov 2026, 17:00 IST',
  folderPath: '\\\\invented-server\\invented-share\\RFQ-0318',
  folderUrl: 'file:///invented-server/invented-share/RFQ-0318',
  title: 'Control cabinet CC-40',
  subject: 'CC-40 cabinet',
  customer: { name: 'Brightwater Controls', shortName: 'BWC' },
  notes: 'Quote the cabinet and the mounting bracket kit together.',
  assignedByName: 'Kiran Bose',
};

const render = (over: Partial<WorkspaceHeaderView> = {}): string => renderToStaticMarkup(createElement(TaskCards, { view: { ...VIEW, ...over } }));
const text = (html: string): string => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const count = (html: string, part: string): number => html.split(part).length - 1;

describe('AQP-453: one compact card of three rows', () => {
  it('is one card, with the three rows in the order of the design', () => {
    const html = render();
    expect(count(html, 'data-slot="card"')).toBe(1);
    expect(count(html, 'data-task-row=')).toBe(3);
    const t = text(html);
    expect(t.indexOf('Task folder')).toBeLessThan(t.indexOf('Customer'));
    expect(t.indexOf('Customer')).toBeLessThan(t.indexOf('Subject'));
    expect(t.indexOf('Subject')).toBeLessThan(t.indexOf('Notes from Kiran Bose'));
  });

  it('row 1: the folder path as a mono link, Copy path, and the note on blocked links', () => {
    const html = render();
    expect(html).toMatch(/<a[^>]*href="file:\/\/\/invented-server\/invented-share\/RFQ-0318"[^>]*class="[^"]*font-mono/);
    expect(html).toContain('Copy path');
    expect(text(html)).toContain('Your browser may block links to network folders. If nothing opens, choose Copy path and paste it into File Explorer.');
  });

  it('row 1 with a path the server did not link: the path as text, with its own note, and Copy path', () => {
    const html = render({ folderUrl: null });
    expect(html).not.toContain('file:///');
    expect(text(html)).toContain('\\\\invented-server\\invented-share\\RFQ-0318');
    expect(html).toContain('Copy path');
  });

  it('row 2: the customer with its short name, the subject, and the lock line', () => {
    const t = text(render());
    expect(t).toContain('Customer Brightwater Controls (BWC)');
    expect(t).toContain('Subject CC-40 cabinet');
    expect(t).toContain('Set by Kiran Bose. Only a Lead or Admin can change the customer.');
  });

  it('the old long labels and the "Task folder" card heading are gone', () => {
    const html = render();
    for (const gone of ['Customer Name', 'Customer Short Name', 'Subject (project name)']) expect(html, gone).not.toContain(gone);
    expect(html).not.toContain('estimate-folder-title');
    expect(html).not.toMatch(/<dl[ >]/);
  });

  it('row 3: the notes from the Lead, and no third row when there are none', () => {
    const t = text(render());
    expect(t).toContain('Notes from Kiran Bose Quote the cabinet and the mounting bracket kit together.');
    const without = render({ notes: null });
    expect(count(without, 'data-task-row='), 'two rows').toBe(2);
    expect(text(without)).not.toContain('Notes from');
  });

  it('an estimate with no customer says so in the neutral words, with no short name and the lock line still there', () => {
    const t = text(render({ customer: null }));
    expect(t).toContain('Customer ');
    expect(t).not.toContain('(BWC)');
    expect(t).toContain('Only a Lead or Admin can change the customer.');
  });

  it('a long name or path wraps instead of scrolling the page sideways', () => {
    const html = render({ subject: 'S'.repeat(80), folderPath: `\\\\${'a'.repeat(120)}` });
    expect(html).toMatch(/break-words|\[overflow-wrap:anywhere\]|break-all/);
  });
});
