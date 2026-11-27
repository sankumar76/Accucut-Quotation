import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CostDetails } from '@/components/features/cost-details/cost-details';
import type { CostTreeNode } from '@/components/features/cost-details/cost-tree';
import type { NodeCostsView } from '@/server/views/schemas/node-costs';

import { COST_ESTIMATE_ID, COST_FIRST_NODE_ID, createCostWorld } from '../support/cost-details-world';

/**
 * AQP-452 (DEF-113; conformance C-07-01; UX spec SCR-07 "Layout" and "Responsive", the mock-up `SCR-07.html`): the cost details of a row have the estimate's parts tree in a column of the SCR-05 tree's width beside the
 * row, sticky with a scroll of its own from 1024 px and a foldable panel below it, as SCR-06 has (AQP-465). Each row of the tree is the way to that row's own cost details; the row that is open is `aria-current`. The
 * tree is the Lead's and the Admin's view of the estimate's rows (names and kinds, no figure). Every name is invented.
 */

const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;
const CODE = 'Q-2026-0320';

const node = (id: string, parentId: string | null, slNo: string, label: string, nodeKind: CostTreeNode['nodeKind']): CostTreeNode => ({ id, parentId, slNo, label, nodeKind });
const NODES: ReadonlyArray<CostTreeNode> = [
  node('n1', null, '1', 'Invented Bracket', 'MAIN_ASSEMBLY'),
  node('n2', 'n1', '1.1', 'Invented Frame', 'SUB_ASSEMBLY'),
  node('n3', 'n2', '1.1.1', 'Invented Plate', 'PART'),
];

async function html(tree: ReadonlyArray<CostTreeNode> | undefined): Promise<string> {
  const view: NodeCostsView = await createCostWorld({}).service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID);
  return renderToStaticMarkup(createElement(CostDetails, { view, code: CODE, calculatedAt: '05 Nov 2026, 10:42 IST', ...(tree === undefined ? {} : { tree }) }));
}

describe('AQP-452: the parts tree column of SCR-07', () => {
  it('is a panel headed "Parts tree", closed until opened below 1024 px, in a column of the tree\'s width from 1024 px, sticky with a scroll of its own', async () => {
    const page = await html(NODES);
    const tag = /<details[^>]*data-cost-tree[^>]*>/.exec(page)?.[0] ?? '';
    // AQP-491 (DEF-137; ruling scr07-layout, L7-1): the Lead came to read one row, so the panel is closed; from 1024 px the content shows whatever the attribute says (`::details-content`).
    expect(tag).not.toMatch(/ open(=""| |>)/);
    expect(tag).toContain('min-[1024px]:sticky');
    expect(tag).toContain('min-[1024px]:overflow-y-auto');
    expect(page).toMatch(/<summary[^>]*>Parts tree[^<]*(<span[^>]*>[^<]*<\/span>)?<\/summary>/);
    expect(page).toContain('min-[1024px]:grid-cols-[var(--tree-w)_minmax(0,1fr)]');
  });

  it('has a link for every row, to the cost details of that row, and marks the one that is open', async () => {
    const page = await html(NODES);
    for (const slNo of ['1', '1.1', '1.1.1']) expect(page).toContain(`href="/estimates/${CODE}/costs/${slNo}"`);
    // The row of the test world is Sl. No 1.
    expect(page).toMatch(/<a[^>]*href="\/estimates\/Q-2026-0320\/costs\/1"[^>]*aria-current="page"/);
    expect(page.match(/aria-current="page"/g)?.length).toBe(2);
  });

  it('names each row by its number and its name, with the icon of its kind', async () => {
    const page = await html(NODES);
    expect(page).toContain('Invented Frame');
    expect(page).toContain('data-node-kind="SUB_ASSEMBLY"');
  });

  it('draws no figure even if a node carried one: only the number, the name and the kind of a row are read', async () => {
    // A row of the review's costs read has figures; the tree read has none. The column must not draw them if it were ever given such rows.
    const withFigures = NODES.map((row) => ({ ...row, figures: { unitPrice: '1234.56', unitPriceUsd: '14.80', unitPriceEur: '13.60' }, count: '3' }));
    const page = await html(withFigures);
    for (const figure of ['1,234.56', '1234.56', '14.80', '13.60']) expect(page.slice(page.indexOf('data-cost-tree')), figure).not.toContain(figure);
  });

  it('is not drawn when the page was given no tree', async () => {
    const page = await html(undefined);
    expect(page).not.toContain('data-cost-tree');
    expect(page).not.toContain('Parts tree');
  });
});

describe('AQP-491: the tree below 1024 px and at 1366 px (DEF-137, DEF-136; ruling scr07-layout, L7-1, L7-4, L7-6)', () => {
  it('comes before the row heading in the page, so it is first in the reading and tab order below 1024 px, and has no class that moves it to the end', async () => {
    const page = await html(NODES);
    expect(page.indexOf('data-cost-tree')).toBeGreaterThan(-1);
    expect(page.indexOf('data-cost-tree')).toBeLessThan(page.indexOf('Cost details for one row'));
    expect(page).not.toContain('order-last');
  });

  it('says the open row in its summary below 1024 px: "Parts tree · 1 Invented Bracket"', async () => {
    const page = await html(NODES);
    const summary = /<summary[^>]*>([\s\S]*?)<\/summary>/.exec(page.slice(page.indexOf('data-cost-tree')))?.[1] ?? '';
    expect(summary.replace(/<[^>]+>/g, '')).toBe('Parts tree · 1 Invented Bracket');
    expect(summary).toContain('min-[1024px]:hidden');
  });

  it('puts a gap of 8 px between the number and the name of each row, and a space in the text, so they never run together', async () => {
    const page = await html(NODES);
    const row = /<a[^>]*href="\/estimates\/Q-2026-0320\/costs\/1\.1"[\s\S]*?<\/a>/.exec(page)?.[0] ?? '';
    expect(row).toContain('gap-s-2');
    expect(row).toMatch(/<a[^>]*class="[^"]*\bflex\b/);
    expect(row.replace(/<[^>]+>/g, '|')).toMatch(/1\.1\|+ \|+Invented Frame/);
  });

  it('marks the open row with the fill and the 4 px bar of the review tree, and no pink chip', async () => {
    const page = await html(NODES);
    const row = /<a[^>]*aria-current="page"[^>]*>/.exec(page)?.[0] ?? '';
    expect(row).toContain('shadow-[inset_4px_0_0_var(--primary)]');
    expect(row).not.toContain('bg-primary-soft');
  });
});
