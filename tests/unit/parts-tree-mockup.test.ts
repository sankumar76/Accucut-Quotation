import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ReviewTree } from '@/components/features/estimate-review/review-tree';
import { AddNodeMenuPanel } from '@/components/features/estimate-workspace/add-node-menu-panel';
import { TreeNode } from '@/components/features/estimate-workspace/tree-node';
import { NodeKindIcon } from '@/components/shared/node-kind-icon';
import { TreeLegend } from '@/components/shared/tree-legend';
import { TREE_ROW_NUMBER } from '@/components/shared/tree-row-number';
import { NODE_KINDS, type NodeKind } from '@/lib/estimate/node-kinds';
import type { PartItem } from '@/lib/estimates/tree-client';
import type { CostsView } from '@/server/views/schemas/costs';

import { renderHook } from '../support/hook-harness';

// The "+" menu is called as a function and the elements it returns are read (no DOM), as in `add-node-menu-unavailable.test.ts`.
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), ...(await import('../support/hook-harness')).reactHooks }));

/**
 * DEF-081 (AQP-424; UX ruling `docs/03-ux/rulings/parts-tree-vs-scr05-2026-11-24.md`): the parts tree rows look as the SCR-05 mock-up draws them, which the customer reviewed. Styling only: a class or a token
 * is the contract here, so these read the classes in the rendered markup. The glyph carries the kind (NFR-018: shape first); the tile and its tint are the second cue, so no test says the tint tells the kinds
 * apart. Every ID and name is invented.
 */

const TILE = ['inline-flex', 'size-s-5', 'shrink-0', 'items-center', 'justify-center', 'rounded-sm'];

/** Ruling points 2 and 3: the glyph and the tile's fill and ink of each kind. */
const KIND_LOOK: Readonly<Record<NodeKind, { readonly glyph: string; readonly fill: string; readonly ink: string }>> = {
  MAIN_ASSEMBLY: { glyph: 'boxes', fill: 'bg-primary-soft', ink: 'text-primary-ink' },
  SUB_ASSEMBLY: { glyph: 'blocks', fill: 'bg-accent-soft', ink: 'text-accent-ink' },
  PART: { glyph: 'box', fill: 'bg-surface-2', ink: 'text-ink-2' },
  FASTENER: { glyph: 'bolt', fill: 'bg-info-soft', ink: 'text-info-ink' },
};

const part = (id: string, nodeKind: NodeKind, completeness: PartItem['completeness'] = 'EMPTY'): PartItem => ({ id, parentId: null, slNo: '1.2', label: 'Plate', nodeKind, completeness, revision: 1 });
const row = (node: PartItem, selected = false): string => renderToStaticMarkup(createElement(TreeNode, { part: node, kindLabel: 'Part', selected, onChoose: () => undefined }));

const classesOf = (html: string, opening: RegExp): string[] => (html.match(opening)?.[1] ?? '').split(/\s+/).filter((name) => name !== '');
const tileOf = (html: string): string[] => classesOf(html, /^<span class="([^"]*)"/);
const svgOf = (html: string, attribute: string): string => html.match(new RegExp(`<svg[^>]*${attribute}[^>]*>`))?.[0] ?? '';
const count = (html: string, text: string): number => html.split(text).length - 1;

describe('ruling 1: the kind icon is a 24 px tile with an 18 px glyph', () => {
  it.each(NODE_KINDS)('draws %s as a tile with the glyph inside it, at 18 px and stroke 1.75', (kind) => {
    const html = renderToStaticMarkup(createElement(NodeKindIcon, { kind, label: 'Name' }));
    expect(tileOf(html)).toEqual(expect.arrayContaining(TILE));
    const svg = svgOf(html, 'data-node-kind');
    expect(svg).toContain(`data-node-kind="${kind}"`);
    expect(svg).toContain('width="18"');
    expect(svg).toContain('height="18"');
    expect(svg).toContain('stroke-width="1.75"');
  });

  it('keeps the name on the glyph (role, spoken name and tooltip), not on the tile', () => {
    const html = renderToStaticMarkup(createElement(NodeKindIcon, { kind: 'FASTENER', label: 'Fastener' }));
    expect(html.match(/^<span class="[^"]*"[^>]*>/)?.[0]).not.toMatch(/role=|aria-label/);
    expect(svgOf(html, 'role="img"')).toContain('aria-label="Fastener"');
    expect(html).toContain('<title>Fastener</title>');
  });

  it('is the same tile in the legend, so the legend looks like the rows it names', () => {
    const html = renderToStaticMarkup(createElement(TreeLegend));
    expect(count(html, 'size-s-5')).toBe(4);
    expect(count(html, 'width="18"')).toBe(4);
  });

  it('is the same tile in the "+" menu, one for each kind it offers', () => {
    const tree = renderHook(AddNodeMenuPanel, { label: 'Add under 1 Hopper', nodeKinds: ['SUB_ASSEMBLY', 'PART', 'FASTENER'], onChoose: vi.fn(), keyboard: false } as Parameters<typeof AddNodeMenuPanel>[0]).render();
    const seen: NodeKind[] = [];
    const walk = (node: ReactNode): void => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (typeof node === 'object' && node !== null && 'props' in node) {
        const element = node as ReactElement<{ kind?: NodeKind; children?: ReactNode }>;
        if (element.type === NodeKindIcon && element.props.kind !== undefined) seen.push(element.props.kind);
        walk(element.props.children);
      }
    };
    walk(tree);
    expect(seen).toEqual(['SUB_ASSEMBLY', 'PART', 'FASTENER']);
  });
});

describe('rulings 2 and 3: the glyph and the tint of each kind', () => {
  it.each(NODE_KINDS)('gives %s its glyph and its fill and ink', (kind) => {
    const html = renderToStaticMarkup(createElement(NodeKindIcon, { kind }));
    const look = KIND_LOOK[kind];
    expect(html).toMatch(new RegExp(`lucide-${look.glyph}(?![a-z-])`));
    expect(tileOf(html)).toEqual(expect.arrayContaining([look.fill, look.ink]));
  });

  it('draws no Layers or Nut glyph any more', () => {
    const html = NODE_KINDS.map((kind) => renderToStaticMarkup(createElement(NodeKindIcon, { kind }))).join('');
    expect(html).not.toMatch(/lucide-(layers|nut)\b/);
  });
});

describe('ruling 4: the open row is a grey fill with a 4 px bar in the brand red, still in 600', () => {
  const link = row(part('p1', 'MAIN_ASSEMBLY'), true).match(/^<a [^>]*>/)?.[0] ?? '';
  const classes = (link.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/);

  it('fills the row with the surface tone and draws the bar as an inset shadow on its left', () => {
    expect(classes).toContain('aria-[current=true]:bg-surface-2');
    expect(classes).toContain('aria-[current=true]:shadow-[inset_var(--s-1)_0_0_var(--primary)]');
    expect(classes).toContain('aria-[current=true]:font-semibold');
    expect(classes).toContain('hover:bg-surface-2');
    expect(link).toContain('aria-current="true"');
  });

  it('has no pink fill, no pink edge and no transparent border that would push the bar in', () => {
    const joined = classes.join(' ');
    expect(joined).not.toContain('border-primary-line');
    expect(joined).not.toContain('bg-primary-soft');
    expect(classes).not.toContain('border');
    expect(classes).not.toContain('border-transparent');
  });

  it('keeps the 44 px row on touch and below 1024 px', () => {
    expect(classes).toContain('min-h-(--control-h)');
    expect(classes).toContain('fine-wide:min-h-(--compact-field-h)');
  });
});

describe('ruling 5: the row number is one shared class, in mono 12 px', () => {
  const costs: CostsView['nodes'] = [{ id: 'm1', parentId: null, slNo: '1', nodeKind: 'MAIN_ASSEMBLY', name: 'Hopper', count: '2', figures: { unitPrice: '12.50', unitPriceUsd: '0.15', unitPriceEur: '0.14' } }];
  const letters: CostsView['letters'] = { count: 'H', unitPrice: 'BG', unitPriceUsd: 'BJ', unitPriceEur: 'BK', totalPrice: 'BL', pricePerToolCost: 'BN', approvedPrice: 'BO' };

  it('is shrink-0, font-mono, text-label and text-ink-2, with no tabular-nums', () => {
    expect(TREE_ROW_NUMBER.split(' ').sort()).toEqual(['font-mono', 'shrink-0', 'text-ink-2', 'text-label']);
  });

  it('is on the number of a workspace row and of a review row, the same class on both', () => {
    const workspace = classesOf(row(part('p1', 'PART')), /<span data-sl-no="" class="([^"]*)"/).join(' ');
    const review = classesOf(renderToStaticMarkup(createElement(ReviewTree, { code: 'Q-2026-0001', state: 'current', letters, nodes: costs, warned: new Set<string>() })), /<span data-sl-no="" class="([^"]*)"/).join(' ');
    expect(workspace).toBe(TREE_ROW_NUMBER);
    expect(review).toBe(TREE_ROW_NUMBER);
  });
});

describe('ruling 6: the status icons are 18 px circles that differ by shape, with the words kept', () => {
  const STATUS = [
    { completeness: 'COMPLETE', glyph: 'circle-check', ink: 'text-success', words: 'All inputs entered' },
    { completeness: 'PARTIAL', glyph: 'contrast', ink: 'text-ink-2', words: 'Some inputs entered' },
    { completeness: 'EMPTY', glyph: 'circle', ink: 'text-ink-3', words: 'No inputs yet' },
  ] as const;

  it.each(STATUS)('draws $completeness as $glyph in $ink at 18 px, hidden from assistive technology', ({ completeness, glyph, ink }) => {
    const svg = svgOf(row(part('p1', 'PART', completeness)), `data-completeness="${completeness}"`);
    expect(svg).toMatch(new RegExp(`lucide-${glyph}(?![a-z-])`));
    expect(classesOf(svg, /class="([^"]*)"/)).toContain(ink);
    expect(svg).toContain('width="18"');
    expect(svg).toContain('aria-hidden="true"');
  });

  it.each(STATUS)('keeps the words for a screen reader beside the $completeness icon', ({ completeness, words }) => {
    const html = row(part('p1', 'PART', completeness));
    expect(html).toContain(`<span class="sr-only">${words}</span>`);
  });

  it('keeps the three shapes different, so the state is never told by colour alone', () => {
    const shapes = STATUS.map(({ completeness }) => svgOf(row(part('p1', 'PART', completeness)), `data-completeness="${completeness}"`).match(/lucide-([a-z-]+)/)?.[1]);
    expect(new Set(shapes).size).toBe(3);
  });
});
