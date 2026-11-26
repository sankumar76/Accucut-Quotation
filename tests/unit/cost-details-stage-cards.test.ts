import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CostDetails } from '@/components/features/cost-details/cost-details';
import type { NodeCostsView } from '@/server/views/schemas/node-costs';

import { COST_ESTIMATE_ID, COST_FIRST_NODE_ID, createCostWorld } from '../support/cost-details-world';

/**
 * AQP-475 (DEF-114; UX spec SCR-07 "Layout", the mock-up's `.stage`, `.stage-row` and `.section-no`, conformance C-07-02): the six stages are numbered collapsible cards, not flat panels. Each card's line holds a
 * numbered badge, the heading "N · Name", the stage total at the right and a chevron that turns when the card is open; the lines are rows of one card, in the design's grid (tag, bold name, value, with the mono formula
 * and the worked line under the name); the line of the stage total is shaded, the line of the price stays dark; the sub-headings are capitals. The words and the order of the text are those of AQP-320. Layouts at three
 * widths are `tests/e2e/cost-details.spec.ts`. Every name and number is invented.
 */

const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;

async function page(): Promise<string> {
  const view: NodeCostsView = await createCostWorld({}).service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID);
  return renderToStaticMarkup(createElement(CostDetails, { view, code: 'Q-2026-0320', calculatedAt: '05 Nov 2026, 10:42 IST' }));
}

/** The markup of one stage's card, from its opening tag to the next card or the end. */
const stageOf = (html: string, number: number): string => {
  const from = html.indexOf(`data-stage="${number}"`);
  const next = html.indexOf('data-stage="', from + 1);
  return html.slice(from, next === -1 ? undefined : next);
};

describe('AQP-475: the stage is a numbered collapsible card', () => {
  it('has a numbered badge that screen readers skip, then the heading "N · Name", then the total, then a chevron, all in the summary', async () => {
    const card = stageOf(await page(), 2);
    const summary = card.slice(card.indexOf('<summary'), card.indexOf('</summary>'));
    expect(summary).toMatch(/<span[^>]*aria-hidden="true"[^>]*data-stage-number[^>]*>2<\/span>/);
    expect(summary).toContain('2 · Material Cost');
    expect(summary.indexOf('2 · Material Cost')).toBeGreaterThan(summary.indexOf('data-stage-number'));
    expect(summary.indexOf('15.99')).toBeGreaterThan(summary.indexOf('2 · Material Cost'));
    expect(summary.indexOf('<svg')).toBeGreaterThan(summary.indexOf('15.99'));
  });

  it('shows no "Stage total:" words on screen, only the figure at the right, and keeps the words for a screen reader', async () => {
    const card = stageOf(await page(), 2);
    const summary = card.slice(card.indexOf('<summary'), card.indexOf('</summary>'));
    expect(summary).toMatch(/<span class="sr-only">Stage total: <\/span>15\.99/);
  });

  it('turns the chevron when the card is open, by CSS alone, and is a `group` so that it can', async () => {
    const card = stageOf(await page(), 3);
    expect(card.slice(0, 400)).toContain('group/stage');
    expect(card.slice(card.indexOf('<svg'), card.indexOf('</svg>'))).toContain('group-open/stage:rotate-180');
  });

  it('is one card: the lines are rows of it, separated by a line, and not a card each', async () => {
    const card = stageOf(await page(), 2);
    const rows = [...card.matchAll(/<li[^>]*>/g)].map((match) => match[0]);
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) {
      expect(row).toContain('border-t');
      expect(row).toMatch(/grid-cols-\[/);
      expect(row).not.toContain('rounded-md');
    }
  });

  it('shades the line of the stage total (AK in stage 2) and leaves the other line plain', async () => {
    const card = stageOf(await page(), 2);
    const rows = [...card.matchAll(/<li[^>]*>[\s\S]*?<\/li>/g)].map((match) => match[0]);
    const total = rows.find((row) => row.includes('Material Cost')) ?? '';
    const reference = rows.find((row) => row.includes('Material Rate')) ?? '';
    const tag = (row: string): string => /^<li[^>]*>/.exec(row)?.[0] ?? '';
    expect(tag(total)).toContain('bg-surface-2');
    expect(tag(reference)).not.toContain('bg-surface-2');
  });

  it('keeps the dark line of the price in stage 6', async () => {
    const card = stageOf(await page(), 6);
    expect(card).toContain('bg-nav');
  });

  it('puts the name, the value, the formula and the working in the design\'s cells, in the same order of text as before', async () => {
    const row = stageOf(await page(), 2).match(/<li[^>]*>[\s\S]*?Material Cost[\s\S]*?<\/li>/)?.[0] ?? '';
    const at = (needle: string): number => row.indexOf(needle);
    // Tag, name, value, then the formula and the working under the name: the text reads as it did, the grid places it.
    expect(at('Material Cost')).toBeLessThan(at('15.99'));
    expect(at('AK = (M * I)')).toBeGreaterThan(at('15.99'));
    expect(row).toMatch(/col-start-2[^"]*row-start-2[^>]*>AK = \(M \* I\)/);
    expect(row).toMatch(/col-start-3[^>]*>[^<]*15\.99/);
  });

  it('writes the sub-headings in capitals by style, with the text unchanged, in a band across the card', async () => {
    const html = await page();
    const card = stageOf(html, 3);
    const heading = /<h3[^>]*>Cutting<\/h3>/.exec(card)?.[0] ?? '';
    expect(heading).toContain('uppercase');
    expect(card).toMatch(/<(?:li|div)[^>]*bg-bg[^>]*>\s*<h3/);
  });
});
