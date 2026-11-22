import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ReviewTree } from '@/components/features/estimate-review/review-tree';
import { TreeNode } from '@/components/features/estimate-workspace/tree-node';
import { NODE_KIND_ICON, NodeKindIcon } from '@/components/shared/node-kind-icon';
import { PartsTreeList } from '@/components/shared/parts-tree-list';
import { TreeLegend } from '@/components/shared/tree-legend';
import { NODE_KINDS, type NodeKind } from '@/lib/estimate/node-kinds';
import type { PartItem } from '@/lib/estimates/tree-client';
import type { CostNode, CostsView } from '@/server/views/schemas/costs';

/**
 * AQP-404 (CR-01 item 3B; UX spec section 0.9 row 3; SPEC 14.32): what the parts tree draws, rendered to markup with no browser. A row has an arrow, a kind icon (shape first, tint second, its name a tooltip and the
 * spoken name, no text label), the number and the name and the status icon; the tree is `nav` > nested `ul`, not `role="tree"`; a legend names the four icons; the read-only tree of SCR-06 has no button. The
 * behaviour in a browser (Tab order, the open row, axe, the widths) is `tests/e2e/estimate-tree.spec.ts`. Every ID and name is invented.
 */

const part = (id: string, parentId: string | null, slNo: string, nodeKind: NodeKind, label = ''): PartItem => ({ id, parentId, slNo, label, nodeKind, completeness: 'EMPTY', revision: 1 });

/** 1 Main, 1.1 Sub-Assembly (two Parts under it), 1.2 Fastener, 2 Main with one Part: every kind, a leaf and a branch, and a Part that is alone and two that are not. */
const NODES: ReadonlyArray<PartItem> = [
  part('m1', null, '1', 'MAIN_ASSEMBLY', 'Hopper'),
  part('s1', 'm1', '1.1', 'SUB_ASSEMBLY', 'Frame'),
  part('p1', 's1', '1.1.1', 'PART', 'Plate'),
  part('p2', 's1', '1.1.2', 'PART', 'Bracket'),
  part('f1', 'm1', '1.2', 'FASTENER', 'Nut'),
  part('m2', null, '2', 'MAIN_ASSEMBLY', 'Lid'),
  part('p3', 'm2', '2.1', 'PART', 'Hinge'),
];

function workspaceTree(options: { selected?: string; closed?: ReadonlySet<string>; interactive?: boolean } = {}): string {
  const closed = options.closed ?? new Set<string>();
  const row = (node: PartItem, kindLabel: string) => createElement(TreeNode, { part: node, kindLabel, selected: node.id === options.selected, onChoose: () => undefined });
  return renderToStaticMarkup(
    createElement(PartsTreeList<PartItem>, { nodes: NODES, label: 'Parts tree', id: 'parts-tree', renderRow: row, ...(options.interactive === false ? {} : { closed, onToggle: () => undefined }) }),
  );
}

/** The words a person sees: the markup with the tags and every `<title>` (the hover tooltip, not visible text) taken out. */
const visibleText = (html: string): string =>
  html
    .replace(/<title>[^<]*<\/title>/g, '')
    .replace(/<span class="sr-only">[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const count = (html: string, text: string): number => html.split(text).length - 1;

describe('AC-2 (NFR-018): the kind icons', () => {
  it('draws a different shape for Main Assembly, Sub-Assembly, Part and Fastener, so the kind is told with no colour at all', () => {
    const shapes = NODE_KINDS.map((kind) => renderToStaticMarkup(createElement(NodeKindIcon, { kind })).match(/lucide-([a-z-]+)/)?.[1]);
    expect(new Set(shapes).size).toBe(4);
    expect(shapes).toEqual(['layers', 'boxes', 'box', 'nut']);
    expect(Object.keys(NODE_KIND_ICON).sort()).toEqual([...NODE_KINDS].sort());
  });

  it('adds a tint as the second cue, a different one for each kind', () => {
    const tints = NODE_KINDS.map((kind) => renderToStaticMarkup(createElement(NodeKindIcon, { kind })).match(/text-[a-z0-9-]+/)?.[0]);
    expect(new Set(tints).size).toBe(4);
  });

  it('says its name as an image for a screen reader and as the tooltip on hover when it has one, and is hidden from assistive technology when it has none', () => {
    const named = renderToStaticMarkup(createElement(NodeKindIcon, { kind: 'FASTENER', label: 'Fastener' }));
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="Fastener"');
    expect(named).toContain('<title>Fastener</title>');
    const bare = renderToStaticMarkup(createElement(NodeKindIcon, { kind: 'FASTENER' }));
    expect(bare).toContain('aria-hidden="true"');
    expect(bare).not.toContain('aria-label');
    expect(bare).not.toContain('<title>');
  });
});

describe('AC-1, AC-4 (14.32): the workspace tree is a list of links, not a tree', () => {
  it('is a nav of nested lists with a link for each row, and has none of the tree roles or counts', () => {
    const html = workspaceTree();
    expect(html).toMatch(/^<nav aria-label="Parts tree" id="parts-tree"><ul/);
    for (const gone of ['role="tree"', 'role="treeitem"', 'aria-level', 'aria-posinset', 'aria-setsize', 'aria-selected', 'tabindex']) expect(html, gone).not.toContain(gone);
    expect(count(html, '<a ')).toBe(NODES.length);
    // Four rows hold rows: 1, 1.1 and 2 are branches, so three nested lists below the top one.
    expect(count(html, '<ul')).toBe(1 + 3);
  });

  it('puts aria-current="true" on the open row and on no other', () => {
    const html = workspaceTree({ selected: 'p2' });
    expect(count(html, 'aria-current="true"')).toBe(1);
    expect(html).toMatch(/data-part-id="p2"[^>]*aria-current="true"|aria-current="true"[^>]*data-part-id="p2"/);
  });

  it('reads each row as the kind icon, the number and the name, with no text label for the kind', () => {
    const html = workspaceTree();
    const text = visibleText(html);
    expect(text).toContain('1 Hopper');
    expect(text).toContain('1.1 Frame');
    for (const label of ['Main Assembly', 'Sub-Assembly', 'Fastener', 'Sub-part']) expect(text, label).not.toContain(label);
    // The kind is the icon's name: the spoken name and the tooltip.
    expect(count(html, 'aria-label="Main Assembly"')).toBe(2);
    expect(count(html, 'aria-label="Sub-Assembly"')).toBe(1);
    expect(count(html, 'aria-label="Fastener"')).toBe(1);
  });

  it('names a Part "Sub-part" while its parent holds two or more Parts, and "Part" when it is the only one (14.31)', () => {
    const html = workspaceTree();
    expect(count(html, 'aria-label="Sub-part"')).toBe(2);
    expect(count(html, '<title>Sub-part</title>')).toBe(2);
    expect(count(html, 'aria-label="Part"')).toBe(1);
  });

  it('gives a branch an arrow button that says what it does and whether it is open, and a leaf row the same space with no button', () => {
    const html = workspaceTree();
    expect(count(html, 'data-branch-arrow="open"')).toBe(3);
    expect(count(html, 'data-branch-arrow="none"')).toBe(4);
    expect(html).toContain('aria-label="Close branch 1.1"');
    expect(count(html, 'aria-expanded="true"')).toBe(3);
    expect(count(html, '<button')).toBe(3);
  });

  it('shows a closed branch as closed: the arrow says "Open branch" and its rows are not drawn', () => {
    const html = workspaceTree({ closed: new Set(['s1']) });
    expect(html).toContain('aria-label="Open branch 1.1"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('data-part-id="p1"');
    expect(html).not.toContain('data-part-id="p2"');
    expect(html).toContain('data-part-id="f1"');
  });

  it('marks each level by a guide line along the nested list, thin and drawn from a token', () => {
    const html = workspaceTree();
    expect(count(html, 'border-l border-border')).toBe(3);
  });

  it('keeps an empty toolbar slot at the end of every row for 3C and 3D, so neither lays a row out again (AC-9)', () => {
    const html = workspaceTree();
    expect(count(html, 'data-row-toolbar=""')).toBe(NODES.length);
    expect(html).toMatch(/<div data-row-toolbar="" class="[^"]*"><\/div>/);
  });

  it('never indents a legacy tree deeper than the kinds allow any further, so it cannot grow wider than its panel', () => {
    const deep: PartItem[] = Array.from({ length: 12 }, (_, index) => part(`d${String(index)}`, index === 0 ? null : `d${String(index - 1)}`, String(index + 1), index === 0 ? 'MAIN_ASSEMBLY' : 'PART'));
    const row = (node: PartItem, kindLabel: string) => createElement(TreeNode, { part: node, kindLabel, selected: false, onChoose: () => undefined });
    const html = renderToStaticMarkup(createElement(PartsTreeList<PartItem>, { nodes: deep, label: 'Parts tree', renderRow: row }));
    expect(count(html, 'border-l border-border')).toBe(4);
    expect(count(html, '<ul')).toBe(12);
  });
});

describe('AC-3: the legend', () => {
  it('names the four icons, with the icons decorative beside their words', () => {
    const html = renderToStaticMarkup(createElement(TreeLegend));
    const text = visibleText(html);
    for (const words of ['Main Assembly', 'Sub-Assembly', 'Part or Sub-part', 'Fastener']) expect(text, words).toContain(words);
    expect(count(html, '<svg')).toBe(4);
    expect(count(html, 'aria-hidden="true"')).toBe(4);
    expect(html).not.toContain('role="img"');
  });
});

describe('AC-6 (NFR-002): the review tree is the same row, read-only', () => {
  const node = (id: string, parentId: string | null, slNo: string, nodeKind: NodeKind, name: string): CostNode => ({
    id,
    parentId,
    slNo,
    nodeKind,
    name,
    count: '2',
    figures: { unitPrice: '12.50', unitPriceUsd: '0.15', unitPriceEur: '0.14' },
  });
  const costs: CostsView['nodes'] = [node('m1', null, '1', 'MAIN_ASSEMBLY', 'Hopper'), node('s1', 'm1', '1.1', 'SUB_ASSEMBLY', 'Frame'), node('p1', 's1', '1.1.1', 'PART', 'Plate'), node('f1', 'm1', '1.2', 'FASTENER', 'Nut')];
  const letters: CostsView['letters'] = { count: 'H', unitPrice: 'BG', unitPriceUsd: 'BJ', unitPriceEur: 'BK', totalPrice: 'BL', pricePerToolCost: 'BN', approvedPrice: 'BO' };
  const html = renderToStaticMarkup(createElement(ReviewTree, { code: 'Q-2026-0001', state: 'current', letters, nodes: costs, warned: new Set(['p1']) }));

  it('has icons and arrows and numbers, the arrows only marks, and no button of any kind in the tree', () => {
    const tree = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    expect(count(tree, '<button')).toBe(0);
    expect(count(tree, 'data-branch-arrow="open"')).toBe(2);
    expect(count(tree, 'role="img"')).toBe(4);
    expect(tree).toContain('aria-label="Main Assembly"');
    expect(tree).toContain('aria-label="Fastener"');
    for (const gone of ['role="tree"', 'treeitem', 'aria-level', 'aria-posinset', 'aria-setsize']) expect(html, gone).not.toContain(gone);
  });

  it('puts the number and name on the first line and the figures, the count, the warning mark and the link on the second, with the legend of the icons at the foot', () => {
    const row = html.slice(html.indexOf('data-part-row="p1"'));
    expect(row.indexOf('Plate')).toBeLessThan(row.indexOf('12.50'));
    expect(row.indexOf('12.50')).toBeLessThan(row.indexOf('Quantity 0'));
    expect(html.indexOf('</nav>')).toBeLessThan(html.indexOf('data-tree-legend'));
  });

  it('has no text label for the kind on a row', () => {
    const tree = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    const text = visibleText(tree);
    for (const label of ['Main Assembly', 'Sub-Assembly', 'Fastener']) expect(text, label).not.toContain(label);
  });
});
