import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BuildTable } from '@/components/features/estimate-review/build-table';
import { nodeKindLabel } from '@/lib/estimate/node-kinds';
import type { CostsView } from '@/server/views/schemas/costs';

import { defined } from '../support/defined';
import { createReviewWorld, REVIEW_ESTIMATE_ID } from '../support/review-world';

import { QUANTITY_CASES } from './quantity/quantity-cases';

/**
 * AQP-468 (DEF-112; UX spec SCR-06 wireframe and the mock-up): "How the total is built" is a collapsible section that says "Show" on its line when it is closed and "Hide" when it is open, and holds the explanation
 * paragraph, the worked example and the per-row table with its total. It is closed until opened and needs no script. Words are written out here from the mock-up, not imported. Every name and number is invented.
 */

const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;
const CE1 = defined(QUANTITY_CASES.find((candidate) => candidate.id === 'CE-1'));

async function build(): Promise<string> {
  const costs: CostsView = await createReviewWorld({ rows: CE1.rows, bl: CE1.bl }).service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
  return renderToStaticMarkup(createElement(BuildTable, { letters: costs.letters, nodes: costs.nodes, totalPrice: costs.totals === null ? null : costs.totals.totalPrice, warned: new Set<string>() }));
}

describe('AQP-468: "How the total is built" is a collapsible section with Show and Hide', () => {
  it('is a details element that is closed until opened, with no script', async () => {
    const html = await build();
    expect(html).toMatch(/^<details(?![^>]* open)/);
    expect(html).not.toContain('<script');
  });

  it('says "Show" on its line while closed and "Hide" while open, each only in its own state, after the heading', async () => {
    const html = await build();
    const line = html.slice(html.indexOf('<summary'), html.indexOf('</summary>'));
    // The heading is exactly "How the total is built" (ux-expert ruling 2026-11-28); the suffix is gone.
    expect(line).toContain('>How the total is built</span>');
    expect(line).not.toContain('added up');
    expect(line).toMatch(/group-open\/build:hidden[^>]*>Show</);
    expect(line).toMatch(/hidden group-open\/build:inline[^>]*>Hide</);
    expect(line.indexOf('Show')).toBeGreaterThan(line.indexOf('How the total is built'));
    expect(html).toMatch(/^<details[^>]*group\/build/);
  });

  it('holds the explanation, then the worked example and the rounding sentence, then the per-row table with its total (AQP-491, DEF-134)', async () => {
    const html = await build();
    const explanation = html.indexOf("The Engineer types the count for the whole order on every row (QTY per Assy, column H). Each row&#x27;s cost (column BG) already includes its own count, so the total is the BG of every row added together. Nothing is multiplied by the rows above.");
    expect(explanation).toBeGreaterThan(html.indexOf('</summary>'));
    expect(explanation).toBeLessThan(html.indexOf('<table'));
    expect(html.indexOf('Worked example:')).toBeGreaterThan(explanation);
    expect(html.indexOf('Worked example:')).toBeLessThan(html.indexOf('<table'));
    expect(html.indexOf('Figures are shown to 2 decimals.')).toBeGreaterThan(html.indexOf('Worked example:'));
    expect(html.indexOf('Figures are shown to 2 decimals.')).toBeLessThan(html.indexOf('<table'));
    expect(html).toContain('Total (the sum of the BG column)');
  });

  it("names the kind of each named row before its name, 'Main Assembly: Control cabinet', and says a nameless row's kind once (AQP-491, DEF-135)", async () => {
    const costs: CostsView = await createReviewWorld({ rows: CE1.rows, bl: CE1.bl }).service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    const named = { ...costs, nodes: costs.nodes.map((node, index) => (index === 0 ? { ...node, name: 'Control cabinet' } : { ...node, name: '' })) };
    const html = renderToStaticMarkup(createElement(BuildTable, { letters: named.letters, nodes: named.nodes, totalPrice: null, warned: new Set<string>() }));
    const cells = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => (match[1] ?? '').replace(/<[^>]+>/g, '').trim());
    const first = defined(named.nodes[0]);
    expect(cells).toContain(`${nodeKindLabel(first, named.nodes)}: Control cabinet`);
    for (const node of named.nodes.slice(1)) {
      const kind = nodeKindLabel(node, named.nodes);
      // No name: the kind is the cell's text, once, as in the tree; never "Part: Part".
      expect(cells.some((cell) => cell.startsWith(kind) && !cell.startsWith(`${kind}: `))).toBe(true);
      expect(html).not.toContain(`${kind}: ${kind}`);
    }
  });
});
