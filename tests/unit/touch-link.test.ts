import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ReviewTree } from '@/components/features/estimate-review/review-tree';
import { QueueList } from '@/components/features/queues/queue-list';
import { TOUCH_LINK } from '@/components/shared/touch-link';
import type { QueueRowData } from '@/lib/tasks/queue-client';
import type { CostsView } from '@/server/views/schemas/costs';

/**
 * DEF-079 (AQP-422; NFR-017 as ruled on 2026-11-24): a standalone link that is the way to open a task or a view is a control, so on a touch layout it is 44 px high with its text unchanged. This reads the markup with no
 * browser: each such link carries `TOUCH_LINK` (a 44 px least height from `--control-h`, restored to the plain inline link with a mouse from 1024 px), and no link of the screens takes a text size from it. The height itself, at the three
 * widths and with a coarse pointer, is measured in a browser by `tests/e2e/queue-actions-visible.spec.ts` and `tests/e2e/estimate-review.spec.ts`. Every name and path is invented.
 */

const CLASSES = TOUCH_LINK.split(' ');

/** The `class` of the first link in the markup whose `href` contains this text, or null. */
function classOfLink(html: string, hrefPart: string): ReadonlyArray<string> | null {
  for (const match of html.matchAll(/<a\b[^>]*>/g)) {
    const tag = match[0];
    if (!tag.includes(hrefPart)) continue;
    const found = /class="([^"]*)"/.exec(tag);
    return found === null ? [] : (found[1] ?? '').split(' ');
  }
  return null;
}

describe('TOUCH_LINK: the rule, written once', () => {
  it('is a 44 px least height (the control height token) with the text centred in it, and the plain inline link again from 1024 px with a mouse', () => {
    expect(CLASSES).toEqual(expect.arrayContaining(['inline-flex', 'min-h-(--control-h)', 'items-center', 'fine-wide:inline', 'fine-wide:min-h-0']));
  });

  it('sets no text size, so the visible text keeps the size it had', () => {
    expect(TOUCH_LINK).not.toMatch(/\btext-/);
  });
});

describe('the task code and "Read all remarks" of the queue (SCR-03)', () => {
  const task: QueueRowData = {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'Q-2026-0042',
    title: 'Hopper cover',
    engineerName: 'Invented Arjun',
    customerName: null,
    folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
    folderUrl: 'file:////invented-server/invented-share/RFQ-1',
    deadlineAt: '2026-11-05T11:30:00.000Z',
    status: 'IGNORED',
    assignedByName: 'Invented Boss',
    ignoredRemarks: 'Not taken forward because the customer chose another supplier, after the second round of prices and a call with their buyer, and asked us to keep the file closed until next year.',
  };
  const html = renderToStaticMarkup(createElement(QueueList, { role: 'LEAD', tasks: [task], asOf: '2026-11-09T04:00:00.000Z' }));

  it('gives the task code the rule in the table and on the phone card (one link each)', () => {
    const links = [...html.matchAll(/<a\b[^>]*href="\/estimates\/Q-2026-0042"[^>]*>Q-2026-0042<\/a>/g)];
    expect(links).toHaveLength(2);
    for (const link of links) for (const name of CLASSES) expect(link[0], name).toContain(name);
  });

  it('gives "Read all remarks" the rule in the table and on the phone card', () => {
    const links = [...html.matchAll(/<a\b[^>]*aria-label="Read all remarks, Q-2026-0042"[^>]*>/g)];
    expect(links).toHaveLength(2);
    for (const link of links) for (const name of CLASSES) expect(link[0], name).toContain(name);
  });
});

describe('"View cost details" of the review (SCR-06)', () => {
  const letters: CostsView['letters'] = { count: 'H', unitPrice: 'BG', unitPriceUsd: 'BJ', unitPriceEur: 'BK', totalPrice: 'BL', pricePerToolCost: 'BN', approvedPrice: 'BO' };
  const nodes: CostsView['nodes'] = [{ id: 'm1', parentId: null, slNo: '1', nodeKind: 'MAIN_ASSEMBLY', name: 'Hopper', count: '2', figures: { unitPrice: '12.50', unitPriceUsd: '0.15', unitPriceEur: '0.14' } }];
  const html = renderToStaticMarkup(createElement(ReviewTree, { code: 'Q-2026-0001', state: 'current', letters, nodes, warned: new Set<string>() }));

  it('gives the link the rule, and keeps its own words and its underline', () => {
    const classes = classOfLink(html, '/estimates/Q-2026-0001/costs/1');
    expect(classes).not.toBeNull();
    for (const name of CLASSES) expect(classes, name).toContain(name);
    expect(classes).toContain('underline');
    expect(html).toContain('View cost details');
  });
});
