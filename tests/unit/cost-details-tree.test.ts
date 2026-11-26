import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CostDetails } from '@/components/features/cost-details/cost-details';
import type { CostNode } from '@/server/views/schemas/costs';
import type { NodeCostsView } from '@/server/views/schemas/node-costs';

import { COST_ESTIMATE_ID, COST_FIRST_NODE_ID, createCostWorld } from '../support/cost-details-world';

/**
 * AQP-452 (DEF-113; conformance C-07-01; UX spec SCR-07 "Layout" and "Responsive", the mock-up `SCR-07.html`): the cost details of a row have the estimate's parts tree in a column of the SCR-05 tree's width beside the
 * row, sticky with a scroll of its own from 1024 px and a foldable panel below it, as SCR-06 has (AQP-465). Each row of the tree is the way to that row's own cost details; the row that is open is `aria-current`. The
 * tree is the Lead's and the Admin's view of the estimate's rows (names and kinds, no figure). Every name is invented.
 */

const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;
const CODE = 'Q-2026-0320';

const node = (id: string, parentId: string | null, slNo: string, name: string, nodeKind: CostNode['nodeKind']): CostNode => ({ id, parentId, slNo, name, nodeKind, count: '1', figures: null });
const NODES: ReadonlyArray<CostNode> = [
  node('n1', null, '1', 'Invented Bracket', 'MAIN_ASSEMBLY'),
  node('n2', 'n1', '1.1', 'Invented Frame', 'SUB_ASSEMBLY'),
  node('n3', 'n2', '1.1.1', 'Invented Plate', 'PART'),
];

async function html(tree: ReadonlyArray<CostNode> | undefined): Promise<string> {
  const view: NodeCostsView = await createCostWorld({}).service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID);
  return renderToStaticMarkup(createElement(CostDetails, { view, code: CODE, calculatedAt: '05 Nov 2026, 10:42 IST', ...(tree === undefined ? {} : { tree }) }));
}

describe('AQP-452: the parts tree column of SCR-07', () => {
  it('is a panel headed "Parts tree" that is open, in a column of the tree\'s width from 1024 px, sticky with a scroll of its own', async () => {
    const page = await html(NODES);
    const tag = /<details[^>]*data-cost-tree[^>]*>/.exec(page)?.[0] ?? '';
    expect(tag).toMatch(/ open(=""| |>)/);
    expect(tag).toContain('min-[1024px]:sticky');
    expect(tag).toContain('min-[1024px]:overflow-y-auto');
    expect(page).toMatch(/<summary[^>]*>Parts tree<\/summary>/);
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

  it('is not drawn when the page was given no tree', async () => {
    const page = await html(undefined);
    expect(page).not.toContain('data-cost-tree');
    expect(page).not.toContain('Parts tree');
  });
});
