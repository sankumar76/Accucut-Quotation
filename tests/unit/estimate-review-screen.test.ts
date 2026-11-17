import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EstimateReview } from '@/components/features/estimate-review/estimate-review';
import type { WorkspaceHeaderView } from '@/components/features/estimate-workspace/workspace-header';
import type { CostsView } from '@/server/views/schemas/costs';

import { defined } from '../support/defined';
import { createReviewWorld, nodeIdOfRow, REVIEW_ESTIMATE_ID, type ReviewWorldOptions } from '../support/review-world';

import { QUANTITY_CASES } from './quantity/quantity-cases';

/**
 * STORY-06.02 AC-1, AC-2, AC-3 and AC-6 without a browser: what SCR-06 draws from the strict answer of `GET /costs`, for the constructed cases CE-1, CE-2, CE-4 and CE-12 of test strategy section 5.2,
 * and for the two states without a figure. The words are written out here from the UX spec and the story, not imported from the product, so a changed sentence fails a test. Layouts at 360, 768 and
 * 1366 px, axe and the keyboard are `tests/e2e/estimate-review.spec.ts`. Every name and number is invented.
 */

// The Recalculate control (STORY-06.04) and the Approve button (STORY-06.06) read the router and the path; a static render has neither, and the draw does not use them.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }), usePathname: () => '/estimates/Q-2026-0318' }));

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

const render = (
  costs: CostsView,
  customer: { id: string; name: string } | null = { id: 'c1', name: 'Invented Customer' },
  header: WorkspaceHeaderView = HEADER,
  viewerRole: 'ADMIN' | 'LEAD' = 'LEAD',
): string =>
  renderToStaticMarkup(createElement(EstimateReview, { header, estimateId: REVIEW_ESTIMATE_ID, customer, costs, calculatedAt: costs.calculatedAt === null ? null : '05 Nov 2026, 10:42 IST', viewerRole }));

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

describe('STORY-06.06 AC-1: Approve and lock is on only while the guard would let the press through', () => {
  const approveButton = (html: string): string => defined(/<button[^>]*id="review-approve"[^>]*>/.exec(html))[0];

  it('a submitted estimate with current figures: the button is on (not disabled), opens a dialog, and the page holds no dialog code', async () => {
    const html = render(await current());
    const button = approveButton(html);
    expect(button).not.toContain(' disabled=""');
    expect(button).toContain('aria-haspopup="dialog"');
    expect(button).toContain('data-early-intent="review-approve"');
    expect(html).not.toContain('Approved Quote Price (BO)');
    expect(html).not.toContain('Enter a price in rupees');
    expect(html).not.toContain('Approving is not available yet');
  });

  it.each([
    ['never calculated', { calculated: false }, 'Calculate first. Approving is available once the figures have been calculated.'],
    ['cleared by an input change', { inputsRevision: 4 }, 'Recalculate first. Approving is available once the figures have been calculated again.'],
  ])('%s: the button is off, named by its reason', async (_name, options, reason) => {
    const html = render(await current(options));
    expect(approveButton(html)).toContain(' disabled=""');
    expect(approveButton(html)).toContain('aria-describedby="review-approve-reason"');
    expect(html).toContain(reason);
  });

  it('current figures on an estimate that is not submitted (a draft after an unlock, STORY-06.08): the button stays off, with the words of ux-spec v0.31', async () => {
    const html = render(await current(), undefined, { ...HEADER, status: 'DRAFT' });
    expect(approveButton(html)).toContain(' disabled=""');
    expect(html).toContain('Recalculate first. Approving is available once this Draft has been calculated again.');
  });
});

describe('STORY-06.06 AC-5: the approved state', () => {
  const APPROVED_HEADER: WorkspaceHeaderView = { ...HEADER, status: 'APPROVED' };

  it('the notice names the approver and the time, BO shows the price, and Unlock replaces Approve and lock', async () => {
    const html = render(await current({ approval: { price: '12600.00', approverName: 'Invented Kiran' } }), undefined, APPROVED_HEADER);
    expect(html).toContain('Approved and locked on 05 Nov 2026, 11:20 IST by Invented Kiran.');
    expect(html).toContain('Locked. Values stay as approved even if rates change later.');
    expect(html).toContain('Only the Admin can cancel an approval.');
    expect(html).toContain('id="review-approved-notice"');
    expect(html).toContain('₹ 12,600.00');
    expect(html).toContain('Approved by Invented Kiran, 05 Nov 2026, 11:20 IST.');
    expect(countOf(html, 'File cell BO2')).toBe(1);
    expect(countOf(html, 'Not set yet')).toBe(0);
    expect(html).not.toContain('id="review-approve"');
    // Unlock works from STORY-06.08: it is on, opens a dialog, and the page holds none of the dialog's code (NFR-009).
    const unlock = defined(/<button[^>]*id="review-unlock"[^>]*>/.exec(html))[0];
    expect(unlock).not.toContain(' disabled=""');
    expect(unlock).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain('Unlocking is not available yet.');
    expect(html).not.toContain('Reason for unlocking');
  });

  it('Download is not affected by the approval: it is the same control with the same reason as before', async () => {
    const html = render(await current({ approval: { price: '12600.00' } }), undefined, APPROVED_HEADER);
    expect(html).toMatch(/<button[^>]*id="review-download"/);
    expect(html).toContain('The Excel download is not available yet.');
  });

  it('an approved estimate with no approvals row says only that it is approved and locked, and BO stays "Not set yet"', async () => {
    const html = render(await current(), undefined, APPROVED_HEADER);
    expect(html).toContain('Approved and locked.');
    expect(countOf(html, 'Not set yet')).toBe(1);
  });
});

describe('STORY-06.07 AC-3 (UX spec SCR-06 "Content"): BO shows the difference from the calculated total and the reason given, or "No reason given."', () => {
  const APPROVED_HEADER: WorkspaceHeaderView = { ...HEADER, status: 'APPROVED' };
  const LOWER = { price: '12600.00', calculatedTotal: '12629.99', isOverride: true, approverName: 'Invented Kiran' };
  const REASON = 'Rounded down to a whole hundred for the customer quote.';

  it('a lower price with a reason: "₹ 29.99 lower than the calculated total (₹ 12,629.99)." and "Reason given: …", under the approver line', async () => {
    const html = render(await current({ approval: { ...LOWER, reason: REASON } }), undefined, APPROVED_HEADER);
    expect(html).toContain('₹ 12,600.00');
    expect(html).toContain('Approved by Invented Kiran, 05 Nov 2026, 11:20 IST.');
    expect(html).toContain('₹ 29.99 lower than the calculated total (₹ 12,629.99).');
    expect(html).toContain(`Reason given: ${REASON}`);
    expect(html).not.toContain('No reason given.');
    expect(html.indexOf('Approved by Invented Kiran')).toBeLessThan(html.indexOf('lower than the calculated total'));
    expect(countOf(html, 'File cell BO2')).toBe(1);
  });

  it('a higher price says "higher"', async () => {
    const html = render(await current({ approval: { price: '12630.01', calculatedTotal: '12629.99', isOverride: true } }), undefined, APPROVED_HEADER);
    expect(html).toContain('₹ 0.02 higher than the calculated total (₹ 12,629.99).');
  });

  it('a price of 0 is "₹ 12,629.99 lower than the calculated total (₹ 12,629.99)." (AC-8)', async () => {
    const html = render(await current({ approval: { price: '0.00', calculatedTotal: '12629.99', isOverride: true } }), undefined, APPROVED_HEADER);
    expect(html).toContain('₹ 12,629.99 lower than the calculated total (₹ 12,629.99).');
    expect(html).toContain('No reason given.');
  });

  it('an override with no reason says "No reason given."', async () => {
    const html = render(await current({ approval: LOWER }), undefined, APPROVED_HEADER);
    expect(html).toContain('₹ 29.99 lower than the calculated total (₹ 12,629.99).');
    expect(html).toContain('No reason given.');
    expect(html).not.toContain('Reason given:');
  });

  it('an approval at the calculated total shows neither a difference nor a reason line', async () => {
    const html = render(await current({ approval: { price: '12629.99', calculatedTotal: '12629.99' } }), undefined, APPROVED_HEADER);
    expect(html).toContain('₹ 12,629.99');
    expect(html).not.toContain('than the calculated total');
    expect(html).not.toContain('No reason given.');
    expect(html).not.toContain('Reason given:');
  });

  it('shows a reason as text: markup and a line break are kept as typed and a long word wraps', async () => {
    const html = render(await current({ approval: { ...LOWER, reason: '<b>bold</b> =SUM(A1)\nSecond line' } }), undefined, APPROVED_HEADER);
    expect(html).toContain('Reason given: &lt;b&gt;bold&lt;/b&gt; =SUM(A1)\nSecond line');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('whitespace-pre-line');
    expect(html).toContain('[overflow-wrap:anywhere]');
  });

  it('BO keeps the line whatever the state of the figures: it is the approval row\'s, like the price (AC-9)', async () => {
    const world = createReviewWorld({ rows: CE1.rows, bl: CE1.bl, inputsRevision: 4, approval: { ...LOWER, reason: REASON } });
    const html = render(await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID), undefined, APPROVED_HEADER);
    expect(html).toContain('₹ 29.99 lower than the calculated total (₹ 12,629.99).');
    expect(html).toContain(`Reason given: ${REASON}`);
  });

  it('before any approval there is no such line', async () => {
    const html = render(await current());
    expect(html).not.toContain('than the calculated total');
    expect(html).not.toContain('No reason given.');
  });
});

describe('STORY-06.06 AC-9: BO is the approval row, never the figure state', () => {
  it('with the figures cleared (an input changed after the approval) BO keeps the approved price and BL is cleared', async () => {
    const world = createReviewWorld({ rows: CE1.rows, bl: CE1.bl, inputsRevision: 4, approval: { price: '12600.00' } });
    const costs = await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    const html = render(costs, undefined, { ...HEADER, status: 'APPROVED' });
    expect(costs.state).toBe('out-of-date');
    expect(html).toContain('₹ 12,600.00');
    expect(html).not.toContain('Not set yet');
    // BL is cleared: its tile says so and no calculated figure is on the page; no figure was read at all.
    expect(html).toContain('An input changed, so every calculated figure is cleared.');
    expect(world.reads.figures.calls).toEqual([]);
    expect(world.reads.approvals.calls).toEqual([[REVIEW_ESTIMATE_ID]]);
  });

  it('before any approval BO is the fixed "Not set yet", in every state', async () => {
    for (const options of [{}, { inputsRevision: 4 }, { calculated: false }]) {
      expect(countOf(render(await current(options)), 'Not set yet')).toBe(1);
    }
  });
});

describe('STORY-06.08 AC-11: Recalculate is shown while the status is DRAFT, whatever the state of the figures', () => {
  const recalculate = (html: string): string => defined(/<button[^>]*id="review-calculate"[^>]*>/.exec(html))[0];

  it('a Draft whose figures are current (an unlocked estimate) shows Recalculate, enabled, and Approve and lock stays off', async () => {
    const html = render(await current(), undefined, { ...HEADER, status: 'DRAFT' });
    expect(recalculate(html)).not.toContain(' disabled=""');
    expect(html).toContain('>Recalculate</button>');
    expect(html).not.toContain('>Calculate</button>');
  });

  it('a Submitted estimate with current figures shows no Recalculate button: its way on is Approve and lock', async () => {
    const html = render(await current());
    expect(html).not.toContain('id="review-calculate"');
    expect(html).toContain('id="review-approve"');
  });

  it('an Approved estimate with current figures shows no Recalculate button either', async () => {
    const html = render(await current({ approval: { price: '12600.00' } }), undefined, { ...HEADER, status: 'APPROVED' });
    expect(html).not.toContain('id="review-calculate"');
  });

  it('a Draft that was never calculated still says Calculate, and one whose figures are cleared says Recalculate', async () => {
    expect(render(await current({ calculated: false }), undefined, { ...HEADER, status: 'DRAFT' })).toContain('>Calculate</button>');
    expect(render(await current({ inputsRevision: 4 }), undefined, { ...HEADER, status: 'DRAFT' })).toContain('>Recalculate</button>');
  });
});

describe('STORY-06.08 AC-3, AC-12 (UX spec SCR-06 "Draft after unlock" and "Unlocked and changed"): the notice, and BO labelled "Approved earlier"', () => {
  const DRAFT_HEADER: WorkspaceHeaderView = { ...HEADER, status: 'DRAFT' };
  const UNLOCK = { unlockedAt: new Date('2026-11-05T06:35:00.000Z'), byName: 'Invented Kiran', reason: 'The customer changed the quantity.', engineerName: 'Invented Priya' };
  const OVERRIDE = { price: '12600.00', calculatedTotal: '12629.99', isOverride: true, reason: 'Rounded down to a whole hundred for the customer quote.', approverName: 'Invented Meera' };

  it('Draft after unlock, the figures still current: the notice names who, when (IST), the reason, the figures, the price and the queue, in a live region that takes focus', async () => {
    const html = render(await current({ approval: { price: '12600.00', approverName: 'Invented Meera', unlock: UNLOCK } }), undefined, DRAFT_HEADER);
    expect(html).toContain('id="review-unlocked-notice"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('Unlocked on 05 Nov 2026, 12:05 IST by Invented Kiran.');
    expect(html).toContain('Reason: The customer changed the quantity.');
    expect(html).toContain('The figures below are still the ones from the approval. As soon as you change an input every calculated figure is cleared. Recalculate to bring them up to date.');
    expect(html).toContain('The price approved earlier stays until a new approval replaces it.');
    expect(html).toContain('The task is back in Invented Priya&#x27;s Open queue.');
    expect(html).not.toContain('An input has changed since');
  });

  it('Unlocked and changed: the same notice with the sentence that an input has changed, and BL is cleared', async () => {
    const html = render(await current({ inputsRevision: 4, approval: { price: '12600.00', unlock: UNLOCK } }), undefined, DRAFT_HEADER);
    expect(html).toContain('Unlocked on 05 Nov 2026, 12:05 IST by Invented Kiran.');
    expect(html).toContain('An input has changed since, so every calculated figure is cleared. Recalculate to bring them up to date.');
    expect(html).not.toContain('The figures below are still the ones from the approval.');
    expect(html).toContain('An input changed, so every calculated figure is cleared.');
  });

  it('a reason that was not kept draws no reason line; the reason is drawn as text, markup and all', async () => {
    const none = render(await current({ approval: { price: '12600.00', unlock: { ...UNLOCK, reason: null } } }), undefined, DRAFT_HEADER);
    expect(none).not.toContain('Reason:');
    const markup = render(await current({ approval: { price: '12600.00', unlock: { ...UNLOCK, reason: '<b>bold</b>' } } }), undefined, DRAFT_HEADER);
    expect(markup).toContain('Reason: &lt;b&gt;bold&lt;/b&gt;');
    expect(markup).not.toContain('<b>bold</b>');
  });

  it('BO shows the price approved earlier, labelled so, with who approved it and when, and the file cell once', async () => {
    const html = render(await current({ approval: { price: '12600.00', approverName: 'Invented Meera', unlock: UNLOCK } }), undefined, DRAFT_HEADER);
    expect(html).toContain('₹ 12,600.00');
    expect(countOf(html, 'Approved earlier')).toBe(1);
    expect(html).toContain('Approved by Invented Meera, 05 Nov 2026, 11:20 IST.');
    expect(html).toContain('It stays until a new approval replaces it.');
    expect(countOf(html, 'File cell BO2')).toBe(1);
    expect(html).not.toContain('Not set yet');
  });

  it('AC-12: after the unlock an input changed, so BL is cleared, and BO still shows the price approved earlier, read from the approvals row and never through the figure state', async () => {
    const world = createReviewWorld({ rows: CE1.rows, bl: CE1.bl, inputsRevision: 4, approval: { price: '12600.00', unlock: UNLOCK } });
    const costs = await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    const html = render(costs, undefined, DRAFT_HEADER);
    expect(costs.state).toBe('out-of-date');
    expect(costs.totals).toBeNull();
    expect(html).toContain('₹ 12,600.00');
    expect(countOf(html, 'Approved earlier')).toBe(1);
    expect(html).not.toContain('Not set yet');
    expect(world.reads.figures.calls).toEqual([]);
  });

  it('SQR-05 of the AQP-324 review: after an unlock BO does not compare the old price with the old total, and does not repeat the old reason', async () => {
    const before = render(await current({ approval: OVERRIDE }), undefined, { ...HEADER, status: 'APPROVED' });
    expect(before).toContain('₹ 29.99 lower than the calculated total (₹ 12,629.99).');
    const after = render(await current({ approval: { ...OVERRIDE, unlock: UNLOCK } }), undefined, DRAFT_HEADER);
    expect(after).toContain('Approved earlier');
    expect(after).not.toContain('lower than the calculated total');
    expect(after).not.toContain('Reason given');
    expect(after).not.toContain('No reason given.');
    expect(after).not.toContain('12,629.99');
  });

  it('while the approval stands there is no unlock notice and no "Approved earlier"', async () => {
    const html = render(await current({ approval: { price: '12600.00' } }), undefined, { ...HEADER, status: 'APPROVED' });
    expect(html).not.toContain('review-unlocked-notice');
    expect(html).not.toContain('Approved earlier');
  });

  it("a Submitted estimate whose approval was unlocked earlier keeps the label on BO but no longer says the task is in the Engineer's queue", async () => {
    const html = render(await current({ approval: { price: '12600.00', unlock: UNLOCK } }));
    expect(countOf(html, 'Approved earlier')).toBe(1);
    expect(html).not.toContain('review-unlocked-notice');
    expect(html).not.toContain('Open queue');
  });

  it('the Unlock button is gone once the estimate is a Draft, and nothing of the dialog is in the page', async () => {
    const html = render(await current({ approval: { price: '12600.00', unlock: UNLOCK } }), undefined, DRAFT_HEADER);
    expect(html).not.toContain('id="review-unlock"');
    expect(html).not.toContain('Keep it locked');
  });
});

describe('STORY-06.12 AC-1, AC-6, AC-10 (UX spec SCR-06 "Approved (Admin)", "Approval cancelled (Admin)" and "(Lead)", "Cancel approval on a Draft or Submitted estimate")', () => {
  const APPROVED_HEADER: WorkspaceHeaderView = { ...HEADER, status: 'APPROVED' };
  const DRAFT_HEADER: WorkspaceHeaderView = { ...HEADER, status: 'DRAFT' };
  const UNLOCK = { unlockedAt: new Date('2026-11-05T06:35:00.000Z'), byName: 'Invented Kiran', reason: 'The customer changed the quantity.', engineerName: 'Invented Priya' };
  const CANCEL = { cancelledAt: new Date('2026-11-05T07:35:00.000Z'), byName: 'Invented Meera', reason: 'The wrong customer was priced.', engineerName: 'Invented Priya' };
  const STANDING = { price: '12600.00', approverName: 'Invented Kiran' };

  it('AC-1: an approved estimate gives the Admin a danger button "Cancel approval", and a Lead no button (the notice says who can)', async () => {
    const admin = render(await current({ approval: STANDING }), undefined, APPROVED_HEADER, 'ADMIN');
    expect(admin).toContain('id="review-cancel"');
    expect(admin).toContain('>Cancel approval</button>');
    expect(admin).toContain('bg-danger');
    // Unlock is still there, beside it.
    expect(admin).toContain('id="review-unlock"');
    const lead = render(await current({ approval: STANDING }), undefined, APPROVED_HEADER, 'LEAD');
    expect(lead).not.toContain('id="review-cancel"');
    expect(lead).not.toContain('Cancel approval');
    expect(lead).toContain('Only the Admin can cancel an approval.');
    // Nothing of the dialog is in the first load of the page.
    for (const html of [admin, lead]) {
      expect(html).not.toContain('Keep the approval');
      expect(html).not.toContain('Your password');
    }
  });

  it('AC-10: the Admin has the same button on a Draft or a Submitted estimate whose approval was kept through an unlock; a Lead has none and is told who can', async () => {
    for (const header of [DRAFT_HEADER, HEADER]) {
      const admin = render(await current({ approval: { ...STANDING, unlock: UNLOCK } }), undefined, header, 'ADMIN');
      expect(admin).toContain('id="review-cancel"');
      expect(countOf(admin, '>Cancel approval</button>')).toBe(1);
      const lead = render(await current({ approval: { ...STANDING, unlock: UNLOCK } }), undefined, header, 'LEAD');
      expect(lead).not.toContain('id="review-cancel"');
      expect(countOf(lead, 'Only the Admin can cancel an approval.')).toBe(1);
    }
  });

  it('no approval, no button and no line: BO is "Not set yet"', async () => {
    for (const role of ['ADMIN', 'LEAD'] as const) {
      const html = render(await current(), undefined, HEADER, role);
      expect(html).not.toContain('id="review-cancel"');
      expect(html).not.toContain('Only the Admin can cancel an approval.');
    }
  });

  it('AC-6: a cancelled approval from an approved estimate (now a Draft): the notice names who, when (IST), the reason, the Draft and the queue, the price stays marked "Approval cancelled", and there is no button', async () => {
    const html = render(await current({ approval: { ...STANDING, cancel: CANCEL } }), undefined, DRAFT_HEADER, 'ADMIN');
    expect(html).toContain('id="review-cancelled-notice"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('Approval cancelled on 05 Nov 2026, 13:05 IST by Invented Meera.');
    expect(html).toContain('Reason: The wrong customer was priced.');
    expect(html).toContain('The estimate is a Draft and the task is back in Invented Priya&#x27;s Open queue.');
    expect(html).toContain('The price stays on screen, marked &quot;Approval cancelled&quot;, and is not in the Excel file.');
    expect(html).toContain('₹ 12,600.00');
    expect(html).not.toContain('Not set yet');
    expect(html).not.toContain('id="review-cancel"');
    // The admin's version has no "Only the Admin can remove it": the Remove price button is the story that follows.
    expect(html).not.toContain('Only the Admin can remove it.');
    expect(html).not.toContain('review-unlocked-notice');
  });

  it('AC-6: BO is labelled "Approval cancelled" once, with its approver, and the file cell once; "Approved earlier" is gone', async () => {
    const html = render(await current({ approval: { ...STANDING, cancel: CANCEL } }), undefined, DRAFT_HEADER, 'ADMIN');
    // Once in the tile and once in the notice's sentence about the price (with its quotes) and its title: count the label alone, in bold.
    expect(countOf(html, '<strong class="block text-ink">Approval cancelled</strong>')).toBe(1);
    expect(html).toContain('Approved by Invented Kiran, 05 Nov 2026, 11:20 IST.');
    expect(countOf(html, 'File cell BO2')).toBe(1);
    expect(html).not.toContain('Approved earlier');
    expect(html).not.toContain('It stays until a new approval replaces it.');
  });

  it('AC-6: a Lead sees the same, with no button and "Only the Admin can remove it."', async () => {
    const html = render(await current({ approval: { ...STANDING, cancel: CANCEL } }), undefined, DRAFT_HEADER, 'LEAD');
    expect(html).toContain('Approval cancelled on 05 Nov 2026, 13:05 IST by Invented Meera.');
    expect(html).toContain('Only the Admin can remove it.');
    expect(html).not.toContain('id="review-cancel"');
    expect(html).not.toContain('Only the Admin can cancel an approval.');
  });

  it('AC-10 (ux-expert, v0.29): a cancel that did not move the estimate says it stays a Draft, or stays Submitted, and the task does not change', async () => {
    const draft = render(await current({ approval: { ...STANDING, unlock: UNLOCK, cancel: CANCEL } }), undefined, DRAFT_HEADER, 'ADMIN');
    expect(draft).toContain('The estimate stays a Draft and its task does not change.');
    expect(draft).not.toContain('Open queue');
    const submitted = render(await current({ approval: { ...STANDING, unlock: UNLOCK, cancel: CANCEL } }), undefined, HEADER, 'ADMIN');
    expect(submitted).toContain('The estimate stays Submitted and its task does not change.');
    // The unlocked notice gives way to the cancelled one.
    expect(draft).not.toContain('review-unlocked-notice');
    expect(draft).not.toContain('Unlocked on');
    expect(countOf(draft, 'Approval cancelled</strong>')).toBe(1);
  });

  it('a Submitted estimate whose approval was cancelled from Approved (and then recalculated) says nothing that is no longer true about its status or its queue', async () => {
    const html = render(await current({ approval: { ...STANDING, cancel: CANCEL } }), undefined, HEADER, 'ADMIN');
    expect(html).toContain('Approval cancelled on 05 Nov 2026, 13:05 IST by Invented Meera.');
    expect(html).not.toContain('The estimate is a Draft');
    expect(html).not.toContain('Open queue');
  });

  it('a reason that was not kept draws no reason line; the reason is drawn as text, markup and all', async () => {
    const none = render(await current({ approval: { ...STANDING, cancel: { ...CANCEL, reason: null } } }), undefined, DRAFT_HEADER, 'ADMIN');
    expect(none).not.toContain('Reason:');
    const markup = render(await current({ approval: { ...STANDING, cancel: { ...CANCEL, reason: '<b>bold</b>' } } }), undefined, DRAFT_HEADER, 'ADMIN');
    expect(markup).toContain('Reason: &lt;b&gt;bold&lt;/b&gt;');
    expect(markup).not.toContain('<b>bold</b>');
  });

  it('the cancelled price stays whatever the state of the figures: cleared figures change nothing about BO or the notice', async () => {
    const html = render(await current({ inputsRevision: 4, approval: { ...STANDING, cancel: CANCEL } }), undefined, DRAFT_HEADER, 'ADMIN');
    expect(html).toContain('₹ 12,600.00');
    expect(html).toContain('Approval cancelled on 05 Nov 2026, 13:05 IST by Invented Meera.');
  });
});

describe('STORY-06.10 AC-3, AC-4: the quantity warning on the calculation in view', () => {
  // CE-1 has a 0 on its item (Sl. No 1): the one warned row. The words are the UX spec's (v0.30, SCR-06 "Warning on this calculation").
  const WARNED = [{ code: 'QTY_ZERO', nodeId: nodeIdOfRow(CE1.rows, '1'), slNo: '1', label: 'Invented frame' }];
  const NOTICE_WHEN = 'Invented Lead went ahead on 05 Nov 2026, 10:42 IST with 0 in QTY per Assy on 1 row: 1 Invented frame.';
  const NOTICE_MEANING = 'This row costs 0 in this estimate. Approving is not stopped. Check that the zeros are meant.';
  const notice = (html: string): string => defined(/<div[^>]*role="status"[^>]*>(?:(?!<\/div><\/div>)[\s\S])*?Quantity warning on this calculation\.[\s\S]*?<\/div><\/div>/.exec(html))[0];

  it('a current calculation with a warning gets a warn notice above the tiles that names who went ahead, when and the rows, in a live region', async () => {
    const html = render(await current({ warnings: WARNED, madeBy: 'Invented Lead' }));
    expect(html).toContain('Quantity warning on this calculation.');
    expect(notice(html)).toContain(NOTICE_WHEN);
    expect(notice(html)).toContain(NOTICE_MEANING);
    expect(notice(html)).toContain('border-l-accent');
    expect(html.indexOf('Quantity warning on this calculation.')).toBeLessThan(html.indexOf('aria-label="Totals"'));
  });

  it('names a Lead who recalculated with that calculation\'s own time (the Lead\'s name comes from the view; the time is the calculation\'s)', async () => {
    const html = render(await current({ warnings: WARNED, madeBy: 'Invented Meera' }));
    expect(html).toContain('Invented Meera went ahead on 05 Nov 2026, 10:42 IST');
    expect(html).not.toContain('Invented Lead went ahead');
  });

  it('each warned row carries the mark "Quantity 0" (icon and words) in the tree and in "How the total is built", and a row that did not go ahead does not', async () => {
    const html = render(await current({ warnings: WARNED }));
    // The tree and the table: one mark each, and only on the warned row (the item), not on 1.1 and 1.1.1.
    expect(countOf(html, 'data-quantity-tag=""')).toBe(2);
    expect(countOf(html, 'Quantity 0')).toBe(2);
    const tree = html.slice(html.indexOf('Parts tree'), html.indexOf('How the total is built'));
    expect(countOf(tree, 'Quantity 0')).toBe(1);
    expect(tree.indexOf('Quantity 0')).toBeLessThan(tree.indexOf('1.1'));
  });

  it('a calculation with no warning has no notice and no mark', async () => {
    const html = render(await current());
    expect(html).not.toContain('Quantity warning on this calculation.');
    expect(html).not.toContain('Quantity 0');
  });

  it.each([
    ['cleared by an input change (out-of-date)', { inputsRevision: 4 }],
    ['never calculated (none)', { calculated: false }],
  ])('AC-4: %s: no notice and no mark, because the list may be stale and the costs view holds none', async (_name, options) => {
    const html = render(await current({ warnings: WARNED, ...options }));
    expect(html).not.toContain('Quantity warning on this calculation.');
    expect(html).not.toContain('Quantity 0');
  });

  it('AC-4: even a view that carries a warning in a state that is not `current` draws none (the notice checks the state itself)', async () => {
    const cleared = { ...(await current({ inputsRevision: 4 })), warning: { madeBy: 'Invented Lead', rows: [{ nodeId: nodeIdOfRow(CE1.rows, '1'), slNo: '1', label: 'Invented frame' }] } };
    const html = render(cleared);
    expect(html).not.toContain('Quantity warning on this calculation.');
    expect(html).not.toContain('Quantity 0');
  });

  it('shows the warning on an approved estimate too (the Approved case of AC-3), and no more than once', async () => {
    const html = render(await current({ warnings: WARNED, approval: { price: '12600.00' } }), undefined, { ...HEADER, status: 'APPROVED' });
    expect(countOf(html, 'Quantity warning on this calculation.')).toBe(1);
    expect(html).toContain('Approved and locked');
  });

  it('says nothing about a rate, a price or a formula in the notice, and names no figure', async () => {
    const html = render(await current({ warnings: WARNED, madeBy: 'Invented Lead' }));
    const words = notice(html).replace(/<[^>]*>/g, ' ').toLowerCase();
    expect(words).not.toMatch(/rate|formula|₹|\$|€/);
  });
});

describe('STORY-06.10 AC-5: the approval dialog is told the rows of the warning, and Approve is not stopped', () => {
  const approveButton = (html: string): string => defined(/<button[^>]*id="review-approve"[^>]*>/.exec(html))[0];

  it('the button is on with a warning exactly as it is without one', async () => {
    const warned = [{ code: 'QTY_ZERO', nodeId: nodeIdOfRow(CE1.rows, '1'), slNo: '1', label: 'Invented frame' }];
    const html = render(await current({ warnings: warned }));
    expect(approveButton(html)).not.toContain(' disabled=""');
    expect(approveButton(html)).toContain('aria-haspopup="dialog"');
    // The dialog's own line is in the dialog's code, fetched on the first press: the page holds none of it.
    expect(html).not.toContain('This calculation has a quantity warning.');
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
