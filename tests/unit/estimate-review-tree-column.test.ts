import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EstimateReview } from '@/components/features/estimate-review/estimate-review';
import type { WorkspaceHeaderView } from '@/components/features/estimate-workspace/workspace-header';
import type { CostsView } from '@/server/views/schemas/costs';

import { defined } from '../support/defined';
import { createReviewWorld, REVIEW_ESTIMATE_ID } from '../support/review-world';

import { QUANTITY_CASES } from './quantity/quantity-cases';

/**
 * AQP-465 (DEF-108; UX spec SCR-06 wireframe, the AQP-319 SQR-10 (1) follow-up and the ux-expert's ruling of 2026-11-28): from 1024 px the parts tree of SCR-06 is a column of the width of the SCR-05 tree (`--tree-w`,
 * 320 px) beside "How the total is built", sticky below the top bar with a scroll of its own; the tiles stay above both at full width; below 1024 px the two are stacked and the tree is the foldable panel it was.
 * The widths and the scroll are judged in a browser (`tests/e2e/estimate-review.spec.ts`); this pins the structure and the classes that make them. Every name is invented.
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

async function review(options: Parameters<typeof createReviewWorld>[0] = { rows: CE1.rows, bl: CE1.bl }): Promise<string> {
  const costs: CostsView = await createReviewWorld(options).service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
  return renderToStaticMarkup(
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
    }),
  );
}

/** The opening tag of the element that holds both columns. */
const columnsTag = (html: string): string => /<div[^>]*data-review-columns[^>]*>/.exec(html)?.[0] ?? '';
const treeTag = (html: string): string => /<details[^>]*data-review-tree[^>]*>/.exec(html)?.[0] ?? '';

describe('AQP-465: the parts tree is a column beside "How the total is built" from 1024 px', () => {
  it('holds the tree and then the build panel in one two-column grid, the first column as wide as the SCR-05 tree, and puts the tiles above it', async () => {
    const html = await review();
    const tag = columnsTag(html);
    expect(tag).toContain('min-[1024px]:grid-cols-[var(--tree-w)_minmax(0,1fr)]');
    expect(tag).toContain('min-[1024px]:grid');
    // The gap is the page's own (main: gap-s-4, md:gap-s-5), so the spacing of the rows does not change.
    expect(tag).toContain('gap-s-4 md:gap-s-5');
    expect(tag).toContain('min-[1024px]:items-start');
    expect(html.indexOf('aria-label="Totals"')).toBeLessThan(html.indexOf('data-review-columns'));
    // AQP-488 (UX ruling 2026-11-27 section 3.8): "How the total is built" is above the two columns, and the columns are the tree and the inputs of the open row.
    expect(html.indexOf('How the total is built')).toBeLessThan(html.indexOf('data-review-columns'));
    expect(html.indexOf('data-review-columns')).toBeLessThan(html.indexOf('data-review-tree'));
    expect(html.indexOf('data-review-tree')).toBeLessThan(html.indexOf('id="row-inputs"'));
  });

  it('makes the tree sticky below the top bar with a scroll of its own from 1024 px, and not a panel that folds away', async () => {
    const tag = treeTag(await review());
    expect(tag).toContain('min-[1024px]:sticky');
    expect(tag).toContain('min-[1024px]:overflow-y-auto');
    expect(tag).toMatch(/min-\[1024px\]:max-h-\[calc\(100dvh-/);
    expect(tag).toMatch(/min-\[1024px\]:top-\[var\(--sticky-top/);
    // The panel is open, and from 1024 px the folding is off: its content is shown even if the element were closed.
    expect(tag).toMatch(/ open(=""| |>)/);
    expect(tag).toContain('min-[1024px]:[&amp;::details-content]:[content-visibility:visible]');
  });

  it('keeps the foldable panel below 1024 px: the summary is a button-like control there and a plain heading from 1024 px', async () => {
    const html = await review();
    const summary = /<summary[^>]*>/.exec(html.slice(html.indexOf('data-review-tree')))?.[0] ?? '';
    expect(summary).toContain('cursor-pointer');
    expect(summary).toContain('min-[1024px]:pointer-events-none');
    expect(summary).toContain('min-[1024px]:cursor-default');
  });

  it('draws the column only with the tree: a state without figures has the tree and no build panel, in the same grid', async () => {
    const html = await review({ rows: CE1.rows, bl: CE1.bl, calculated: false });
    expect(columnsTag(html)).not.toBe('');
    expect(html).not.toContain('How the total is built');
  });
});
