import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CostDetails } from '@/components/features/cost-details/cost-details';
import type { NodeCostsView } from '@/server/views/schemas/node-costs';

import { COST_CALCULATION_REVISION, COST_ESTIMATE_ID, COST_FIRST_NODE_ID, createCostWorld, type CostWorldOptions } from '../support/cost-details-world';

/**
 * AQP-452 (DEF-113; conformance C-G-03 and C-07-01; UX spec SCR-07 and the mock-up `SCR-07.html`): the head of the cost details is the page head of the estimate's pages: a breadcrumb "Task queue / <code> / Cost details <Sl. No>", the
 * h1 "Cost details", the sentence "Every calculated value for this row, in six stages, each with its formula. Lead and Admin only.", and the way back. Under it the row has its heading, the eyebrow "Cost details for one row"
 * over "<Sl. No> · <name>", and its one box, "This row, on screen and in the Excel row", with its price, what the count is, the dollar and euro figures and the rounding rule. The words are written out from the
 * mock-up. The parts tree column of the design needs the whole estimate's tree and is not in this change. Every name and number is invented.
 */

const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;
const CODE = 'Q-2026-0320';

async function viewOf(options: CostWorldOptions = {}): Promise<NodeCostsView> {
  return createCostWorld(options).service.getNodeCosts(LEAD, COST_ESTIMATE_ID, COST_FIRST_NODE_ID);
}

const render = (view: NodeCostsView): string => renderToStaticMarkup(createElement(CostDetails, { view, code: CODE, calculatedAt: view.details === null ? null : '05 Nov 2026, 10:42 IST' }));
const text = (html: string): string =>
  html
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

describe('AQP-452: the head of SCR-07', () => {
  it('has the breadcrumb "Task queue / <code> / Cost details <Sl. No>": two links and the page itself', async () => {
    const html = render(await viewOf());
    expect(html).toMatch(/<nav aria-label="Breadcrumb"/);
    expect(html).toMatch(/<a[^>]*href="\/queue"[^>]*>Task queue<\/a>/);
    expect(html).toMatch(new RegExp(`<a[^>]*href="/estimates/${CODE}"[^>]*>${CODE}</a>`));
    expect(html).toMatch(/<span aria-current="page"[^>]*>Cost details 1<\/span>/);
    expect(html.indexOf('aria-label="Breadcrumb"')).toBeLessThan(html.indexOf('<h1'));
  });

  it('keeps the h1 "Cost details" and has the description of the mock-up under it, and the way back at the right', async () => {
    const html = render(await viewOf());
    expect(html).toContain('>Cost details</h1>');
    expect(text(html)).toContain('Every calculated value for this row, in six stages, each with its formula. Lead and Admin only.');
    expect(html.indexOf('Every calculated value')).toBeLessThan(html.indexOf('Back to the estimate'));
  });

  it('is the same head in the two states without a stage', async () => {
    for (const options of [{ calculated: false }, { inputsRevision: COST_CALCULATION_REVISION + 1 }]) {
      const html = render(await viewOf(options));
      expect(html).toMatch(/<span aria-current="page"[^>]*>Cost details 1<\/span>/);
      expect(text(html)).toContain('Every calculated value for this row');
    }
  });
});

describe('AQP-452: the row of SCR-07', () => {
  it('has the eyebrow "Cost details for one row" over the heading "<Sl. No> · <name>", in every state', async () => {
    for (const options of [{}, { calculated: false }, { inputsRevision: COST_CALCULATION_REVISION + 1 }]) {
      const html = render(await viewOf(options));
      expect(html).toMatch(/Cost details for one row<\/span><h2[^>]*>[\s\S]*?>1<\/span> · [\s\S]*?Invented Bracket/);
    }
  });

  it('has the box "This row, on screen and in the Excel row" with its price and the sentence that says what the count is', async () => {
    const html = render(await viewOf());
    expect(text(html)).toContain('This row, on screen and in the Excel row');
    expect(html).toContain('₹ 451.40');
    expect(text(html)).toMatch(/Unit Production Price \(BG\) for this row\. Its count for the whole order, QTY per Assy 3, is already included\. The estimate total adds every row's BG; nothing is multiplied by the rows above\./);
  });

  it('says the dollar and euro figures of the row and the rounding rule', async () => {
    const t = text(render(await viewOf()));
    expect(t).toMatch(/In US dollars \$ [\d,]+\.\d{2}, in euros € [\d,]+\.\d{2} \(BJ and BK of this row\)\./);
    expect(t).toContain('Figures are shown to 2 decimals. Totals add the unrounded values and round once, so adding the shown figures by hand can differ by a few hundredths.');
  });
});

describe('AQP-496 (DEF-139, RO-18): the "View inputs" link of SCR-07', () => {
  it("is in the row header, in every state, and goes to the Lead's inputs view of this row on the estimate page", async () => {
    for (const options of [{}, { calculated: false }, { inputsRevision: COST_CALCULATION_REVISION + 1 }]) {
      const html = render(await viewOf(options));
      const link = html.match(/<a[^>]*href="(\/estimates\/[^"]*)"[^>]*>View inputs<\/a>/);
      expect(link, 'a link named View inputs').not.toBeNull();
      expect(link?.[1]).toBe(`/estimates/${CODE}?row=1#row-inputs`);
      // It sits with the row's heading (after the eyebrow, before the first stage or message), not in the page head.
      expect(html.indexOf('Cost details for one row')).toBeLessThan(html.indexOf('>View inputs<'));
      expect(html.indexOf('>View inputs<')).toBeGreaterThan(html.indexOf('Back to the estimate'));
    }
  });

  it('writes the row as the address says (the Sl. No of the view, encoded) and names the row for a screen reader', async () => {
    const view = await viewOf();
    const html = render({ ...view, row: { ...view.row, slNo: '1.2' } });
    expect(html).toContain('href="/estimates/' + CODE + '?row=1.2#row-inputs"');
    expect(html).toMatch(/<a[^>]*aria-label="View inputs of 1\.2[^"]*"[^>]*>View inputs<\/a>/);
  });
});
