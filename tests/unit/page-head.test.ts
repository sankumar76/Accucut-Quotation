import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ReviewHead } from '@/components/features/estimate-review/review-head';
import { TaskCards } from '@/components/features/estimate-workspace/task-cards';
import { WorkspaceHeader, type WorkspaceHeaderView } from '@/components/features/estimate-workspace/workspace-header';
import { copyMessage, FolderPath } from '@/components/shared/folder-path';
import { PageHead } from '@/components/shared/page-head';

/**
 * AQP-452 (DEF-095 SCR-05, DEF-110 SCR-06, DEF-113 SCR-07; conformance C-G-03, C-05-03, C-06-03, C-07-01; UX spec section 6.0 "Page frame" and the mock-ups `SCR-05.html`, `SCR-06.html`, `SCR-07.html`): one
 * page head for the pages of an estimate. A breadcrumb that ends with the page; the `h1` "Estimate <code>" with the status badge (and the download marker on SCR-06) on the same line; under it, on SCR-05 the title
 * and the sentence of the form, on SCR-06 one meta line; at the right the due pill and, on SCR-06, Open folder and Copy path. The words are written out from the mock-ups. Static render, no browser: the widths, axe and
 * the buttons at work are in the E2E specs. Every name is invented.
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
  notes: 'Quote the cabinet and the bracket kit together.',
  assignedByName: 'Kiran Bose',
};

const text = (html: string): string =>
  html
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

describe('PageHead', () => {
  const head = renderToStaticMarkup(
    createElement(PageHead, {
      crumbs: [{ label: 'Task queue', href: '/queue' }, { label: 'Q-2026-0318', href: '/estimates/Q-2026-0318' }, { label: 'Cost details 1.4' }],
      title: 'Cost details',
      badges: createElement('span', { 'data-badge': '' }, 'Prepared'),
      description: 'A sentence.',
      actions: createElement('a', { href: '/back' }, 'Back'),
    }),
  );

  it('has a breadcrumb that ends with the page, the earlier steps as links and the last as the current page, with hidden slashes between', () => {
    expect(head).toMatch(/<nav aria-label="Breadcrumb"/);
    expect(head).toMatch(/<a[^>]*href="\/queue"[^>]*>Task queue<\/a>/);
    expect(head).toMatch(/<a[^>]*href="\/estimates\/Q-2026-0318"[^>]*>Q-2026-0318<\/a>/);
    expect(head).toMatch(/<span aria-current="page"[^>]*>Cost details 1\.4<\/span>/);
    expect(head.match(/aria-hidden="true"[^>]*>\/</g)).toHaveLength(2);
    expect(head).not.toMatch(/<a[^>]*>Cost details 1\.4<\/a>/);
  });

  it('puts the h1 and its badges on one line, the description under it and the actions after', () => {
    const line = head.slice(head.indexOf('<h1'), head.indexOf('A sentence.'));
    expect(line).toMatch(/<h1[^>]*>Cost details<\/h1><span data-badge="">Prepared<\/span><\/div>/);
    expect(head.indexOf('A sentence.')).toBeLessThan(head.indexOf('href="/back"'));
    expect(head.indexOf('aria-label="Breadcrumb"')).toBeLessThan(head.indexOf('<h1'));
  });
});

describe('the head of SCR-05 (DEF-095)', () => {
  const html = renderToStaticMarkup(createElement(WorkspaceHeader, { view: VIEW }));
  const head = html.slice(0, html.indexOf('data-slot="card"'));

  it('has the breadcrumb "My tasks / <code>", the h1 "Estimate <code>" and the status badge on the h1\'s line', () => {
    expect(head).toMatch(/<a[^>]*href="\/queue"[^>]*>My tasks<\/a>/);
    expect(head).toMatch(/<span aria-current="page"[^>]*>Q-2026-0318<\/span>/);
    expect(head).toMatch(/<h1[^>]*>Estimate Q-2026-0318<\/h1><span data-slot="status-badge"[^>]*>[\s\S]*?Draft/);
  });

  it('has the title and the sentence of the form as its subtitle, and the due pill at the right', () => {
    expect(text(head)).toContain('Control cabinet CC-40 · Every field is needed to Calculate. Enter 0 where a part needs nothing. Numbers allow up to 2 decimals.');
    expect(text(head)).toContain('Due 06 Nov 2026, 17:00 IST');
    expect(head.indexOf('Every field is needed')).toBeLessThan(head.indexOf('Due 06 Nov'));
  });

  it('draws the cards it is handed under the head, and keeps the customer and the folder cards as the page hands them (DEF-096 is another change)', () => {
    const withCards = renderToStaticMarkup(createElement(WorkspaceHeader, { view: VIEW, cards: createElement(TaskCards, { view: VIEW }) }));
    expect(withCards).toContain('Customer Name');
    expect(withCards).toContain('Task folder');
    expect(withCards.indexOf('Due 06 Nov')).toBeLessThan(withCards.indexOf('Customer Name'));
    // The head alone draws no card: the cards are the server's element.
    expect(html).not.toContain('Customer Name');
  });
});

describe('the head of SCR-06 (DEF-110)', () => {
  const html = renderToStaticMarkup(
    createElement(ReviewHead, {
      view: { ...VIEW, status: 'PREPARED' },
      engineerName: 'Priya Nair',
      noCustomerText: 'Not set',
      notice: null,
      customerAction: createElement('button', { id: 'review-change-customer', type: 'button' }, 'Change customer'),
      downloadMarker: createElement('span', { 'data-chip': '' }, 'Not downloaded'),
    }),
  );
  const head = html.slice(0, html.indexOf('Quote the cabinet') === -1 ? undefined : html.indexOf('Quote the cabinet'));

  it('has the breadcrumb "Task queue / <code>" and the h1 "Estimate <code>" with the status and the download marker on its line', () => {
    expect(head).toMatch(/<a[^>]*href="\/queue"[^>]*>Task queue<\/a>/);
    expect(head).toMatch(/<h1[^>]*>Estimate Q-2026-0318<\/h1><span data-slot="status-badge"[\s\S]*?Prepared[\s\S]*?<span data-chip="">Not downloaded<\/span>/);
  });

  it('has one meta line: title, subject, customer with its short name and Change customer, who entered it and who assigned it', () => {
    const meta = text(head.slice(head.indexOf('Control cabinet CC-40')));
    expect(meta).toContain('Control cabinet CC-40 · Subject: CC-40 cabinet · Brightwater Controls (BWC) Change customer · Entered by Priya Nair · Assigned by Kiran Bose');
    expect(head).toMatch(/<strong[^>]*>CC-40 cabinet<\/strong>/);
  });

  it('has the due pill, Open folder (a link to the folder) and Copy path at the right', () => {
    expect(text(head)).toContain('Due 06 Nov 2026, 17:00 IST');
    expect(head).toMatch(/<a[^>]*href="file:\/\/\/invented-server\/invented-share\/RFQ-0318"[^>]*>[\s\S]*?Open folder<\/a>/);
    expect(text(head)).toContain('Copy path');
  });

  it('no longer draws the three-column customer card or the Task folder card, and keeps the notes', () => {
    expect(html).not.toContain('Customer Name');
    expect(html).not.toContain('Customer Short Name');
    expect(html).not.toContain('Task folder');
    expect(text(html)).toContain('Notes from Kiran Bose: Quote the cabinet and the bracket kit together.');
  });

  it('says "Not set" and offers the action when the estimate has no customer', () => {
    const none = renderToStaticMarkup(createElement(ReviewHead, { view: { ...VIEW, customer: null }, engineerName: 'Priya Nair', noCustomerText: 'Not set', notice: null, customerAction: null, downloadMarker: null }));
    expect(text(none)).toContain('Not set');
  });
});

describe('QLT-789-03: the description is not a paragraph, so a block inside it (the alert of the Change customer button) nests validly', () => {
  it('draws a node description in a div', () => {
    const html = renderToStaticMarkup(createElement(PageHead, { crumbs: [{ label: 'Here' }], title: 'T', description: createElement('div', { role: 'alert' }, 'No') }));
    expect(html).toContain('<div class="text-ink-2"><div role="alert">No</div></div>');
    expect(html).not.toMatch(/<p[^>]*class="text-ink-2"/);
  });
});

describe('QLT-789-08: the copy-only Copy path shows its result to everyone', () => {
  it('draws the button and a polite status that is not visually hidden', () => {
    const html = renderToStaticMarkup(createElement(FolderPath, { path: VIEW.folderPath, url: '', copyOnly: true }));
    expect(html).toContain('Copy path');
    expect(html).toMatch(/<span role="status" class="(?![^"]*sr-only)[^"]*"><\/span>/);
  });
});

describe('QLT-789-10: a failed copy with no path on screen shows the path', () => {
  it('says the path in the message of the copy-only button so it can be selected, and keeps the short sentence where the path is drawn', () => {
    expect(copyMessage('failed', VIEW.folderPath, true)).toBe(`The path could not be copied. Select it and copy it yourself. ${VIEW.folderPath}`);
    expect(copyMessage('failed', VIEW.folderPath, false)).toBe('The path could not be copied. Select it and copy it yourself.');
    expect(copyMessage('copied', VIEW.folderPath, true)).toBe('Path copied to the clipboard.');
    expect(copyMessage('idle', VIEW.folderPath, true)).toBe('');
  });
});

describe("AQP-452 (NFR-009): SCR-05's customer and folder cards are a server module handed to the client workspace", () => {
  const read = (path: string): string => readFileSync(fileURLToPath(new URL(`../../src/${path}`, import.meta.url)), 'utf8');
  it('TaskCards starts with import server-only, and the client chain (the workspace and its head) holds none of its words', () => {
    expect(read('components/features/estimate-workspace/task-cards.tsx').trimStart()).toMatch(/^import 'server-only';/);
    for (const file of ['estimate-workspace.tsx', 'workspace-header.tsx']) expect(read(`components/features/estimate-workspace/${file}`), file).not.toMatch(/task-cards|Customer Name|CUSTOMER_NAME_LABEL|FOLDER_TITLE/);
  });
  it('the page draws them and hands them in as `cards`', () => {
    const page = read('app/(portal)/estimates/[code]/page.tsx');
    expect(page).toContain("from '@/components/features/estimate-workspace/task-cards'");
    expect(page).toContain('cards={<TaskCards view={header} />}');
  });
});

describe("QLT-789-07: SCR-06's head is a server module, outside the client import chain", () => {
  const read = (path: string): string => readFileSync(fileURLToPath(new URL(`../../src/components/features/${path}`, import.meta.url)), 'utf8');
  it('starts with import server-only in the head and in its words, so a client import fails the build', () => {
    for (const file of ['review-head.tsx', 'review-head-texts.ts']) expect(read(`estimate-review/${file}`).trimStart(), file).toMatch(/^import 'server-only';/);
  });
  it("is imported by the review, and the Engineer's workspace head holds none of its words", () => {
    expect(read('estimate-review/estimate-review.tsx')).toContain("from './review-head'");
    expect(read('estimate-workspace/workspace-header.tsx')).not.toMatch(/Open folder|OPEN_FOLDER_LABEL|SUBJECT_META_PREFIX|review-head/);
  });
});
