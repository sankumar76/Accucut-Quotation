import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EstimateReview, type EstimateReviewProps } from '@/components/features/estimate-review/estimate-review';
import { inputsNotice, showingInputs } from '@/components/features/estimate-review/review-texts';
import { selectedRow } from '@/components/features/estimate-review/selected-row';
import type { WorkspaceHeaderView } from '@/components/features/estimate-workspace/workspace-header';
import type { CostsView } from '@/server/views/schemas/costs';

import { defined } from '../support/defined';
import { createReviewWorld, REVIEW_ESTIMATE_ID } from '../support/review-world';

import { QUANTITY_CASES } from './quantity/quantity-cases';

/**
 * AQP-488 (DEF-131 Stage 1; UX ruling `lead-admin-edit-inputs-2026-11-27.md` section 3, RO-1, RO-2, RO-9, RO-10, RO-16, RO-18): the Lead's and the Admin's view of one row's inputs on SCR-06, rendered to markup
 * with no browser (the first paint). The tree's rows are links to `?row=<Sl. No>#row-inputs` and the open one is `aria-current`; with no `row`, or one that is not in the tree, the first row is open; the block has
 * the words of its notice by status, with the Ignored layer first, and the row line (`This row: ...`) with the row's own figure, or `Cleared` or a dash; an estimate with no rows has no block; "How the total
 * is built" is above the two columns. The form inside is the Engineer's, with the review look (`review-look-part-fields.test.ts`) and is judged in a browser (`tests/e2e/estimate-review-inputs.spec.ts`).
 * Every name is invented.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }), usePathname: () => '/estimates/Q-2026-0318' }));

const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;
const CE1 = defined(QUANTITY_CASES.find((candidate) => candidate.id === 'CE-1'));

const HEADER: WorkspaceHeaderView = {
  code: 'Q-2026-0318',
  status: 'PREPARED',
  deadlineLabel: '12 Nov 2026, 17:00 IST',
  folderPath: '\\\\invented-server\\invented-share\\RFQ-0318',
  folderUrl: null,
  title: 'Invented cabinet',
  subject: 'Invented subject',
  customer: { name: 'Invented Customer', shortName: 'INV' },
  notes: null,
  assignedByName: 'Invented Lead',
};

type WorldOptions = Parameters<typeof createReviewWorld>[0];

async function costsOf(options: WorldOptions = { rows: CE1.rows, bl: CE1.bl }): Promise<CostsView> {
  return createReviewWorld(options).service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
}

const render = (costs: CostsView, over: Partial<EstimateReviewProps> = {}): string =>
  renderToStaticMarkup(
    createElement(EstimateReview, {
      header: HEADER,
      estimateId: REVIEW_ESTIMATE_ID,
      customer: { id: 'c1', name: 'Invented Customer', shortName: 'INV' },
      costs,
      calculatedAt: costs.calculatedAt === null ? null : '05 Nov 2026, 10:42 IST',
      viewerRole: 'LEAD',
      download: { kind: 'none' },
      quoted: null,
      ignored: null,
      engineerName: 'Invented Engineer',
      deadlinePassed: false,
      ...over,
    }),
  );

const text = (html: string): string => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

describe('selectedRow: the row of the address, else the first (RO-16)', () => {
  const nodes = [
    { id: 'a', slNo: '1' },
    { id: 'b', slNo: '1.1' },
    { id: 'c', slNo: '2' },
  ];
  it('finds the row named by `row`', () => {
    expect(selectedRow(nodes, '1.1')?.id).toBe('b');
  });
  it('takes the first row when there is no `row` or it is not in the tree, with no error', () => {
    expect(selectedRow(nodes, undefined)?.id).toBe('a');
    expect(selectedRow(nodes, '9.9')?.id).toBe('a');
    expect(selectedRow(nodes, '')?.id).toBe('a');
  });
  it('is null for an estimate with no rows', () => {
    expect(selectedRow([], '1')).toBeNull();
  });
});

describe('RO-1, RO-2: the tree rows are links to the row\'s inputs', () => {
  it('every row\'s first line is a link to ?row=<Sl. No>#row-inputs, and the first row is current by default', async () => {
    const costs = await costsOf();
    const html = render(costs);
    for (const node of costs.nodes) expect(html).toContain(`href="/estimates/Q-2026-0318?row=${encodeURIComponent(node.slNo)}#row-inputs"`);
    expect(html.match(/aria-current="true"/g)?.length).toBe(1);
    const first = defined(costs.nodes[0]);
    expect(html).toMatch(new RegExp(`<a[^>]*href="[^"]*row=${encodeURIComponent(first.slNo)}#row-inputs"[^>]*aria-current="true"|<a[^>]*aria-current="true"[^>]*href="[^"]*row=${encodeURIComponent(first.slNo)}#row-inputs"`));
  });

  it('marks the row of the address as current and no other', async () => {
    const costs = await costsOf();
    const second = costs.nodes[1];
    if (second === undefined) return;
    const html = render(costs, { row: second.slNo });
    expect(html.match(/aria-current="true"/g)?.length).toBe(1);
    expect(html).toMatch(new RegExp(`<a[^>]*row=${encodeURIComponent(second.slNo)}#row-inputs[^>]*aria-current="true"|<a[^>]*aria-current="true"[^>]*row=${encodeURIComponent(second.slNo)}#row-inputs`));
  });

  it('keeps the Cost details link of each row, as built (two links per row)', async () => {
    const costs = await costsOf();
    const html = render(costs);
    for (const node of costs.nodes) expect(html).toContain(`href="/estimates/Q-2026-0318/costs/${encodeURIComponent(node.slNo)}"`);
  });

  it('under 1024 px the tree summary reads "Parts tree" and the open row, and from 1024 px the row part is hidden', async () => {
    const costs = await costsOf();
    const first = defined(costs.nodes[0]);
    const html = render(costs);
    expect(html).toMatch(/<summary[^>]*>Parts tree<span[^>]*min-\[1024px\]:hidden[^>]*>[^<]*·[^<]*/);
    expect(text(html)).toContain(`Parts tree · ${first.slNo}`);
  });
});

describe('RO-9: the notice of the block', () => {
  it.each([
    ['DRAFT', false, 'Read-only. These are the values saved for this part. The Engineer may still be changing them: reload the page to see the latest.'],
    ['PREPARED', false, 'Read-only. These are the values saved for this part.'],
    ['APPROVED', false, 'Read-only while approved. These are the values the price was approved with.'],
    ['QUOTED', false, 'Read-only while quoted. These are the values the price was approved with.'],
    ['DRAFT', true, 'Read-only while this RFQ is ignored.'],
    ['APPROVED', true, 'Read-only while this RFQ is ignored.'],
  ] as const)('%s (ignored %s)', (status, ignored, words) => {
    expect(inputsNotice(status, ignored)).toBe(words);
  });

  it('says what a choice shows, for the status line', () => {
    expect(showingInputs('1.4', 'Top cover')).toBe('Showing the inputs of 1.4 Top cover. Read-only.');
  });
});

describe('RO-10: the row line', () => {
  it('with the figures current: This row: the row\'s BG with its letter, dollars, euros, the count and a link to its cost details', async () => {
    const costs = await costsOf();
    expect(costs.state).toBe('current');
    const html = render(costs);
    const line = text(html.slice(html.indexOf('data-row-line')));
    expect(line).toMatch(/This row: ₹ [\d,]+\.\d{2} \(B[A-Z]\) · \$ [\d,]+\.\d{2} · € [\d,]+\.\d{2} · count [\d,.]+ nos/);
    expect(html).toMatch(/data-row-line[\s\S]*?View cost details/);
  });

  it('with the figures cleared: "Cleared" and the count, and no figure', async () => {
    const costs = await costsOf({ rows: CE1.rows, bl: CE1.bl, inputsChanged: true } as WorldOptions);
    if (costs.state !== 'out-of-date') return;
    const html = render(costs);
    const line = text(html.slice(html.indexOf('data-row-line')));
    expect(line).toMatch(/This row: Cleared · count [\d,.]+ nos/);
    expect(line).not.toMatch(/₹ \d/);
  });
});

describe('RO-16 and the layout', () => {
  it('draws the block for an estimate with rows, and "How the total is built" above the two columns', async () => {
    const costs = await costsOf();
    const html = render(costs);
    expect(html).toContain('id="row-inputs"');
    expect(html.indexOf('data-build-table') === -1 ? html.indexOf('How the total is built') : html.indexOf('data-build-table')).toBeLessThan(html.indexOf('data-review-columns'));
  });

  it('draws no block and keeps the tree\'s own empty line when there are no rows', async () => {
    const costs = await costsOf();
    const html = render({ ...costs, nodes: [] });
    expect(html).not.toContain('id="row-inputs"');
    expect(html).toContain('No parts yet.');
  });
});
