import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EstimateReview } from '@/components/features/estimate-review/estimate-review';
import type { WorkspaceHeaderView } from '@/components/features/estimate-workspace/workspace-header';
import type { CostsView } from '@/server/views/schemas/costs';

import { defined } from '../support/defined';
import { createReviewWorld, REVIEW_ESTIMATE_ID, type ReviewWorldOptions } from '../support/review-world';

import { QUANTITY_CASES } from './quantity/quantity-cases';

/**
 * STORY-06.02 AC-1, AC-2, AC-3 and AC-6 without a browser: what SCR-06 draws from the strict answer of `GET /costs`, for the constructed cases CE-1, CE-2, CE-4 and CE-12 of test strategy section 5.2,
 * and for the two states without a figure. The words are written out here from the UX spec and the story, not imported from the product, so a changed sentence fails a test. Layouts at 360, 768 and
 * 1366 px, axe and the keyboard are `tests/e2e/estimate-review.spec.ts`. Every name and number is invented.
 */

// The Recalculate control (STORY-06.04) reads the router; a static render has none, and the draw does not use it.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;

const HEADER: WorkspaceHeaderView = {
  code: 'Q-2026-0318',
  status: 'SUBMITTED',
  deadlineLabel: '12 Nov 2026, 17:00 IST',
  folderPath: '\\\\invented-server\\invented-share\\RFQ-0318',
  folderUrl: null,
  title: 'Invented cabinet',
  notes: null,
  assignedByName: 'Invented Lead',
};

const caseOf = (id: string) => defined(QUANTITY_CASES.find((candidate) => candidate.id === id));

async function costsOf(options: ReviewWorldOptions): Promise<CostsView> {
  return createReviewWorld(options).service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
}

const render = (costs: CostsView, customer: { id: string; name: string } | null = { id: 'c1', name: 'Invented Customer' }): string =>
  renderToStaticMarkup(createElement(EstimateReview, { header: HEADER, estimateId: REVIEW_ESTIMATE_ID, customer, costs, calculatedAt: costs.calculatedAt === null ? null : '05 Nov 2026, 10:42 IST' }));

const countOf = (html: string, text: string): number => html.split(text).length - 1;

/** The page without the paths of its icons, whose numbers (`d="M12 1.5 ..."`) are not figures. */
const withoutIcons = (html: string): string => html.replace(/<svg[\s\S]*?<\/svg>/g, '');

const CE1 = caseOf('CE-1');
const current = (overrides: Partial<ReviewWorldOptions> = {}) => costsOf({ rows: CE1.rows, bl: CE1.bl, ...overrides });

describe('AC-1: the tiles', () => {
  it('BL in rupees with Indian grouping and two decimals, with its letter tag and its file cell, once', async () => {
    const html = render(await costsOf({ rows: [{ sl: '1', h: '1', cost: '1', bg: '1234567.891' }], bl: '1234567.891' }));
    expect(html).toContain('Total Unit Production Price');
    expect(html).toContain('₹ 12,34,567.89');
    expect(html).toContain('Excel column </span>BL');
    expect(countOf(html, 'File cell BL2')).toBe(1);
  });

  it('BN with its figure when a Tool Cost was entered, and its file cell once', async () => {
    const html = render(await current({ toolCostTotal: '5', pricePerToolCost: '6' }));
    expect(html).toContain('Price per Tool Cost');
    expect(html).toContain('>6.00<');
    expect(html).toContain('BL divided by the total Tool Cost');
    expect(countOf(html, 'File cell BN2')).toBe(1);
  });

  it('BN is a dash with the sentence when no Tool Cost was entered, and the file cell is named once, in the sentence', async () => {
    const html = render(await current({ toolCostTotal: '0', pricePerToolCost: null }));
    expect(html).toContain('No Tool Cost entered on any part, so there is nothing to divide by. File cell BN2 is left empty.');
    expect(html).toContain('>—<');
    expect(countOf(html, 'File cell BN2')).toBe(1);
  });

  it('BO is "Not set yet" before an approval, once, with its file cell once', async () => {
    const html = render(await current());
    expect(countOf(html, 'Not set yet')).toBe(1);
    expect(html).toContain('Approved Quote Price');
    expect(countOf(html, 'File cell BO2')).toBe(1);
  });

  it('the tiles are a labelled group', async () => {
    expect(render(await current())).toContain('aria-label="Totals"');
  });
});

describe('AC-2: every row shows its own BG with its count beside it, and a parent only its own row', () => {
  it('CE-1: the rows read 0.00, 6.00 and 24.00 with "2 nos", "6 nos" and "24 nos", each count named for a screen reader', async () => {
    const html = render(await current());
    for (const [figure, count] of [['0.00', '2 nos'], ['6.00', '6 nos'], ['24.00', '24 nos']] as const) {
      expect(html).toContain(`>${figure}</span>`);
      expect(html).toContain(count);
    }
    expect(countOf(html, 'Count for the whole order: ')).toBe(3);
  });

  it('CE-4: the parent shows 10.00 and its child 5.00, and no figure of 15.00 (a sum of the two) is anywhere in the tree', async () => {
    const quantityCase = caseOf('CE-4 (quantities 1)');
    const html = render(await costsOf({ rows: quantityCase.rows, bl: quantityCase.bl }));
    expect(html).toContain('>10.00</span>');
    expect(html).toContain('>5.00</span>');
    // BL is 15.00 and appears in the tile and the total line, never in a row of the tree.
    const tree = html.slice(html.indexOf('Parts tree'), html.indexOf('How the total is built'));
    expect(tree).not.toContain('15.00');
  });

  it('CE-2 A: 600.00 and 240.00 on the two rows, BL 840.00 on the tile', async () => {
    const quantityCase = caseOf('CE-2 A');
    const html = render(await costsOf({ rows: quantityCase.rows, bl: quantityCase.bl }));
    for (const figure of ['600.00', '240.00', '₹ 840.00']) expect(html).toContain(figure);
  });

  it('CE-12 D: a childless item shows its own 1,000.00 and the count 5, and the total is the same figure', async () => {
    const quantityCase = caseOf('CE-12 D');
    const html = render(await costsOf({ rows: quantityCase.rows, bl: quantityCase.bl }));
    expect(html).toContain('5 nos');
    expect(html).toContain('₹ 1,000.00');
  });

  it('draws no sum of the rows below a part, no item total and no Σ, and the legend says what each figure is', async () => {
    const html = render(await current());
    expect(html).not.toMatch(/Σ|item total|Item total|sum of the rows below|Not multiplied|counts it 2 times/);
    expect(html).toContain("Each figure is that row&#x27;s own BG. The count for the whole order (QTY per Assy) is shown beside it and is already included. The estimate total adds every row&#x27;s BG.");
  });

  it('each row also has its figure in US dollars and in euros', async () => {
    const html = render(await costsOf({ rows: [{ sl: '1', h: '1', cost: '1', bg: '800' }], bl: '800' }));
    expect(html).toContain('In US dollars $ 10.00, in euros € 8.89');
  });

  it('shows the Sl. No and the name of each part, and "Part" for one with no name', async () => {
    const html = render(await costsOf({ rows: CE1.rows, bl: CE1.bl, names: { '1.1': 'Invented pipe' } }));
    expect(html).toContain('Invented pipe');
    expect(countOf(html, '>Part<')).toBeGreaterThanOrEqual(2);
    for (const slNo of ['1', '1.1', '1.1.1']) expect(html).toContain(`>${slNo}</span>`);
  });

  it('the tree folds away as a panel that is open: no script is needed for the drawer', async () => {
    const html = render(await current());
    expect(html).toMatch(/<details[^>]*open=""[^>]*>\s*<summary[^>]*>Parts tree<\/summary>/);
    expect(html).not.toContain('<script');
  });
});

describe('AC-3: "How the total is built"', () => {
  it('CE-1: one line for each row (Sl. No, part, count, BG) ending with the total, 30.00, which is the BL tile', async () => {
    const html = render(await current());
    const table = html.slice(html.indexOf('How the total is built'));
    expect(table).toContain('How the total is built (the BG of every row added up)');
    for (const heading of ['Sl. No', 'Part', 'QTY per Assy', 'Excel column </span>BG']) expect(table).toContain(heading);
    for (const figure of ['0.00', '6.00', '24.00']) expect(table).toContain(`>${figure}</td>`);
    expect(table).toContain('Total (the sum of the BG column)');
    expect(table).toContain('>30.00</td>');
    expect(html).toContain('₹ 30.00');
  });

  it('carries the worked example and the rounding sentence', async () => {
    const html = render(await current());
    expect(html).toContain('Worked example: if one lid costs 1, one pipe costs 1 and the frame row holds nothing, the total is 24 + 6 + 0 = 30.');
    expect(html).toContain('Figures are shown to 2 decimals. Totals add the unrounded values and round once, so adding the shown figures by hand can differ by a few hundredths.');
  });

  it('the table scrolls inside a named, focusable region and has a caption', async () => {
    const html = render(await current());
    expect(html).toContain('aria-label="How the total is built, scrollable"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('One line for each row, with its count and its own figure, ending with the total');
  });

  it('the total is the figure the calculation stored: a record whose BL differs from its rows shows BL, not a sum made on the screen', async () => {
    const html = render(await costsOf({ rows: CE1.rows, bl: '31' }));
    expect(html).toContain('>31.00</td>');
  });

  it('the line "Calculated … · configuration version …" is in the bar', async () => {
    expect(render(await current())).toContain('Calculated 05 Nov 2026, 10:42 IST · configuration version 9');
  });
});

describe('AC-6: not calculated', () => {
  it('says so in an info notice that is a live region, shows "Not calculated" on BL, dashes in the tree and no table, and shows no figure', async () => {
    const html = render(await current({ calculated: false }));
    // AC-10 (STORY-06.04; ux-spec v0.29 "SCR-06 interim and final words"): exactly two sentences, the second naming the button that now works. The 0.28 third sentence is withdrawn (the two disabled buttons say it).
    expect(html).toContain('The Engineer has not calculated this estimate yet. Press Calculate to see costs.');
    expect(html).not.toContain('stay off until then');
    expect(html).not.toContain('Costs show once it is calculated');
    expect(html).toMatch(/role="status"[^>]*>[\s\S]*The Engineer has not calculated/);
    expect(html).toContain('Not calculated');
    expect(html).not.toContain('How the total is built');
    expect(withoutIcons(html)).not.toMatch(/\d+\.\d\d/);
    expect(html).not.toContain('₹');
    expect(countOf(html, '>—<')).toBeGreaterThanOrEqual(4);
  });

  it('the primary button is Calculate and it works (AC-10: enabled, with no "not available yet" reason), and Approve and Download are disabled, each described by its reason', async () => {
    const html = render(await current({ calculated: false }));
    const calculate = html.match(/<button[^>]*id="review-calculate"[^>]*>/)?.[0] ?? '';
    expect(calculate).not.toContain('disabled=""');
    expect(calculate).not.toContain('aria-describedby');
    for (const id of ['review-approve', 'review-download']) {
      const button = html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`))?.[0] ?? '';
      expect(button, id).toContain('disabled=""');
      const reasonId = button.match(/aria-describedby="([^"]+)"/)?.[1];
      expect(reasonId, id).toBeDefined();
      expect(html).toContain(`id="${reasonId}"`);
    }
    expect(html).toContain('>Calculate</button>');
    expect(html).toContain('Calculate first. Approving is available once the figures have been calculated.');
    expect(html).toContain('Calculate or Recalculate first. There is no file until a calculation is current.');
    expect(html).not.toContain('Calculating from this screen is not available yet.');
    expect(html).not.toContain('Calculated 05 Nov');
  });
});

describe('AC-1, AC-4 and AC-5: the cleared state', () => {
  it('says the total is cleared, shows "Cleared" on BL and in the tree, the count stays, and not one figure of the record is drawn', async () => {
    const html = render(await current({ bl: '1234567.89', inputsRevision: 4 }));
    expect(html).toContain('The total is cleared because an input changed.');
    expect(html).toContain('Every calculated figure, on every row, is cleared with it. They show again after you press Recalculate. Until then Approve and lock and the Excel download stay off.');
    expect(html).toContain('Cleared with the total.');
    expect(html).toContain('You set it when you approve, after Recalculate.');
    expect(countOf(html, '>Cleared<')).toBeGreaterThanOrEqual(4);
    expect(html).toContain('24 nos');
    expect(withoutIcons(html)).not.toMatch(/\d+\.\d\d/);
    expect(html).not.toContain('How the total is built');
    expect(html).toContain('>Recalculate</button>');
    expect(html).toContain('Recalculate first. Approving is available once the figures have been calculated again.');
  });

  it('AC-5: the notice is a live region with its title and body; the primary Recalculate is enabled; Approve and Download are disabled, each described by its reason', async () => {
    const html = render(await current({ bl: '1234567.89', inputsRevision: 4 }));
    expect(html).toMatch(/role="status"[^>]*>[\s\S]*The total is cleared because an input changed\./);
    const recalculate = html.match(/<button[^>]*id="review-calculate"[^>]*>/)?.[0] ?? '';
    expect(recalculate).not.toContain('disabled=""');
    for (const id of ['review-approve', 'review-download']) {
      const button = html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`))?.[0] ?? '';
      expect(button, id).toContain('disabled=""');
      expect(button, id).toMatch(/aria-describedby="[^"]+"/);
    }
    expect(html).toContain('Calculate or Recalculate first. There is no file until a calculation is current.');
    expect(html).not.toContain('Calculating from this screen is not available yet.');
  });

  it('AC-10: the BL tile carries the cleared line with the button named, and the parts tree line names it too (the final words of ux-spec v0.29)', async () => {
    const html = render(await current({ bl: '1234567.89', inputsRevision: 4 }));
    expect(html).toContain('An input changed, so every calculated figure is cleared. Press Recalculate to see them again.');
    expect(html).toContain('Every calculated figure is cleared because an input changed. Press Recalculate to see them again.');
    expect(html).not.toContain('once the estimate is calculated again');
    expect(html).not.toContain('Approving is not available yet');
  });

  it('AC-1: while the figures are current there is no cleared line and no Recalculate button', async () => {
    const html = render(await current());
    expect(html).not.toContain('Press Recalculate');
    expect(html).not.toContain('id="review-calculate"');
  });
});

describe('AC-9: the tiles show a skeleton while a recalculation is under way, with no script', () => {
  it('each tile figure is drawn with a hidden-while-busy figure and a skeleton that appears when the bar is busy (a CSS rule, so nothing is sent to the browser)', async () => {
    const html = render(await current({ bl: '1234567.89', inputsRevision: 4 }));
    expect(countOf(html, 'data-slot="skeleton"')).toBe(3);
    expect(html).toContain('group-has-[[aria-busy=true]]/review');
  });
});

describe('the header and the customer', () => {
  it('shows the task, its status and the customer by name, or "Not chosen yet"', async () => {
    const costs = await current();
    expect(render(costs)).toContain('Q-2026-0318');
    expect(render(costs)).toContain('Invented Customer');
    expect(render(costs, null)).toContain('Not chosen yet');
  });
});
