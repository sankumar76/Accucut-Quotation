import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EstimateExport } from '@/components/features/estimate-export/estimate-export';
import { BUILDING_LINE, COLUMNS_RANGE, PARTS, PICTURES, REFERENCE_LINE } from '@/components/features/estimate-export/export-texts';
import { exportSummarySchema, type ExportFiguresView, type ExportSummaryView } from '@/server/views/schemas/export';

/**
 * STORY-07.01 AC-6 without a browser: what SCR-10 draws from the strict answer of `GET /export-summary`: the file card, the rows of the file, and the Empty state. The words are written out here from the
 * UX spec, not imported from the product, so a changed sentence fails a test. Layouts at 360, 768 and 1366 px, axe and the button are `tests/e2e/export.spec.ts`. Every name and number is invented.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const ESTIMATE_ID = '00000000-0000-4000-8000-0000000e5701';
const CODE = 'Q-2026-0701';

const summary = (overrides: Partial<ExportSummaryView> = {}): ExportSummaryView => ({
  fileName: 'Quotation_Acme_Tools_Q-2026-0701_2026-11-14.xlsx',
  partCount: 3,
  pictureCount: 1,
  columns: { first: 'A', last: 'BO', count: 67 },
  rows: [
    { slNo: '1', name: 'Base frame', count: '2' },
    { slNo: '1.1', name: '', count: null },
    { slNo: '2', name: 'Lid', count: '24.50' },
  ],
  state: 'none',
  figures: null,
  warning: null,
  ...overrides,
});

const render = (view: ExportSummaryView): string => renderToStaticMarkup(createElement(EstimateExport, { summary: view, estimateId: ESTIMATE_ID, code: CODE }));

describe('the file card', () => {
  it('shows the file name as real text, the number of rows, the columns A to BO and an enabled Download .xlsx button', () => {
    const html = render(summary());
    expect(html).toContain('>Quotation_Acme_Tools_Q-2026-0701_2026-11-14.xlsx</dd>');
    expect(html).toContain('3 parts');
    expect(html).toContain('A to BO');
    expect(html).toMatch(/<button[^>]*id="export-download"[^>]*>Download \.xlsx<\/button>/);
    expect(html).not.toMatch(/<button[^>]*id="export-download"[^>]*disabled/);
  });

  it('says "1 part" for one part', () => {
    expect(render(summary({ partCount: 1, rows: [{ slNo: '1', name: 'Base', count: null }] }))).toContain('1 part<');
  });

  it('links back to the estimate by its code', () => {
    expect(render(summary())).toContain(`href="/estimates/${CODE}"`);
  });
});

describe('the rows of the file', () => {
  it('lists each part with its Sl. No, its name and its count, a dash for a missing count and "No name yet" for a part with no name, in a focusable, named region', () => {
    const html = render(summary());
    expect(html).toContain('aria-label="The rows in the file"');
    expect(html).toContain('tabindex="0"');
    for (const text of ['Base frame', 'Lid', 'No name yet', '24.5', '1.1']) expect(html).toContain(text);
    expect(html).toContain('—');
  });

  it('holds no rupee sign and no cost word: the summary has no figure', () => {
    const html = render(summary());
    expect(html).not.toContain('₹');
    expect(html).not.toMatch(/\bcost\b/i);
  });

  it('wraps a long unbroken name, so the page never scrolls sideways', () => {
    const html = render(summary({ rows: [{ slNo: '1', name: 'X'.repeat(200), count: null }], partCount: 1 }));
    expect(html).toContain('[overflow-wrap:anywhere]');
    expect(html).toContain('X'.repeat(200));
  });
});

describe('the Empty state', () => {
  it('says "Nothing to export yet" in a status region and draws no file card, no button and no table', () => {
    const html = render(summary({ partCount: 0, pictureCount: 0, rows: [] }));
    expect(html).toContain('Nothing to export yet');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('Download .xlsx');
    expect(html).not.toContain('<table');
  });
});

describe('the words of the states, as the UX spec writes them', () => {
  it('Building: "Building the file. 10 parts, 1 picture. This usually takes a few seconds."', () => {
    expect(BUILDING_LINE(10, 1)).toBe('Building the file. 10 parts, 1 picture. This usually takes a few seconds.');
    expect(BUILDING_LINE(1, 0)).toBe('Building the file. 1 part, 0 pictures. This usually takes a few seconds.');
    expect(BUILDING_LINE(2000, 2)).toBe('Building the file. 2,000 parts, 2 pictures. This usually takes a few seconds.');
  });

  it('the small pieces', () => {
    expect(PARTS(1)).toBe('1 part');
    expect(PICTURES(1)).toBe('1 picture');
    expect(COLUMNS_RANGE('A', 'BO')).toBe('A to BO');
    expect(REFERENCE_LINE('req-0a1b2c3d')).toBe('Reference: req-0a1b2c3d');
  });
});


/**
 * STORY-07.03 AC-9 (UX spec SCR-10): the figures of a current calculation. The words are written out here from the UX spec, not imported. The figures are invented and shaped like the spec's own example: the lines
 * of the BG column as shown add to 12,630.01 while the total is 12,629.99.
 */
const figures = (overrides: Partial<ExportFiguresView> = {}): ExportFiguresView => ({
  rows: [
    { slNo: '1', count: '2', bg: '0', toolCost: '0' },
    { slNo: '1.1', count: '4', bg: '3583.99', toolCost: '2800' },
    { slNo: '2', count: '3', bg: '9045.997', toolCost: '600.5' },
  ],
  totals: { bl: '12629.987', bn: '3.714', bo: null, toolCostTotal: '3400.5' },
  letters: { count: 'H', bg: 'BG', toolCost: 'BM' },
  cells: { bl: 'BL2', bn: 'BN2', bo: 'BO2', toolCostTotal: 'BM6' },
  approval: null,
  reconciliation: { columnSum: '12629.987', linesAsShown: '12630.01', total: '12629.987', matches: true },
  ...overrides,
});

const current = (over: Partial<ExportFiguresView> = {}): ExportSummaryView => summary({ state: 'current', figures: figures(over) });

describe('AC-9: the rows table with the file\'s own BG and Tool Cost', () => {
  it('has the headings of the spec, the count, BG and Tool Cost of each row in Indian grouping with two decimals, and the Sl. No and name still', () => {
    const html = render(current());
    for (const text of ['Qty (H), for the whole order', 'In the file: BG', 'In the file: Tool Cost (BM)', '3,583.99', '2,800.00', '9,046.00', '600.50', 'Base frame']) expect(html, text).toContain(text);
    expect(html).toContain('aria-label="The rows in the file"');
    expect(html).toContain('Every row holds its own count for the whole order (H) and its own BG. The file has no per-item totals and nothing is multiplied by the rows above.');
  });

  it('ends with the row "BG column added up: BL2, the same as the total on screen" holding the sum, and the Total Tool Cost row with its place in the file', () => {
    const html = render(current());
    expect(html).toContain('BG column added up: BL2, the same as the total on screen');
    expect(html).toContain('12,629.99');
    expect(html).toContain('Total Tool Cost: file row 6, one empty row below the last part, with the label in the cell to the left of the Tool Cost column');
    expect(html).toContain('3,400.50');
    expect(html).toContain("BN2 divides BL2 by it.");
  });

  it('keeps the table in one focusable, named region and wraps a long name', () => {
    const html = render(summary({ state: 'current', rows: [{ slNo: '1', name: 'X'.repeat(200), count: null }], figures: figures({ rows: [{ slNo: '1', count: '1', bg: '1', toolCost: '0' }] }) }));
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('[overflow-wrap:anywhere]');
  });

  it('says the sum is not the same as BL2 when the server says the column and BL2 differ, and shows a danger notice that names both', () => {
    const html = render(current({ reconciliation: { columnSum: '12629.99', linesAsShown: '12629.99', total: '12631.5', matches: false } }));
    expect(html).not.toContain('the same as the total on screen');
    expect(html).toContain('BG column added up: not the same as BL2');
    expect(html).toContain('The BG column adds up to 12,629.99, but BL2 is not the same.');
  });
});

describe('AC-9: the card "How BL2 is made"', () => {
  it('says to add the BG column to get BL2 at any quantity, gives the example 2, 6 and 24, and keeps the rounding sentence', () => {
    const html = render(current());
    expect(html).toContain('How BL2 is made');
    expect(html).toContain('Add the BG column of the file. That gives BL2, at any quantity.');
    expect(html).toContain('for 2 frames, 6 pipes and 24 lids the Engineer types 2, 6 and 24.');
    expect(html).toContain('Figures are shown to 2 decimals. Totals add the unrounded values and round once, so adding the shown figures by hand can differ by a few hundredths.');
  });

  it('names the two sums only where the lines as shown differ from the total: 12,630.01 against 12,629.99', () => {
    expect(render(current())).toContain('The lines of the table above add to 12,630.01 as shown, and the total is 12,629.99.');
    expect(render(current({ reconciliation: { columnSum: '12629.99', linesAsShown: '12629.99', total: '12629.99', matches: true } }))).not.toContain('The lines of the table above add to');
  });
});

describe('AC-9: the checklist "What the file holds"', () => {
  it('lists BL2 in rupees, BN2 as a figure, and the Total Tool Cost with its row, from the cell addresses the server names', () => {
    const html = render(current());
    expect(html).toContain('What the file holds');
    expect(html).toContain('>BL2<');
    expect(html).toContain('₹ 12,629.99');
    expect(html).toContain('>BN2<');
    expect(html).toContain('3.71');
    expect(html).toContain('₹ 3,400.50, in the Tool Cost column of row 6');
    expect(html).toContain('BL2, BN2 and BO2 appear once, in row 2, and the file has no per-item totals');
  });

  it('says an empty cell for a figure that could not be worked out (BN2 with no Tool Cost)', () => {
    expect(render(current({ totals: { bl: '12629.987', bn: null, bo: null, toolCostTotal: '0' } }))).toContain('No figure: an empty cell');
  });

  it('BO2 is empty until approved, and empty after the Admin cancels an approval', () => {
    expect(render(current())).toContain('Empty until approved, and empty after the Admin cancels an approval');
  });

  it('BO2 approved at a different price: the price, when it was approved (IST), how far it is from the calculated total, the reason, and that the reason is not written into the file', () => {
    const html = render(
      current({
        totals: { bl: '12629.987', bn: '3.714', bo: '12600', toolCostTotal: '3400.5' },
        approval: { price: '12600.00', approvedAt: '2026-11-05T05:50:00.000Z', earlier: false, calculatedTotal: '12629.99', difference: { direction: 'lower', amount: '29.99' }, reason: 'Rounded down for the customer quote' },
      }),
    );
    for (const text of [
      '₹ 12,600.00',
      '₹ 12,600.00, approved on 05 Nov 2026, 11:20 IST.',
      '₹ 29.99 lower than the calculated total.',
      'The price ₹ 12,600.00 was set against the calculated total ₹ 12,629.99.',
      'Reason given: Rounded down for the customer quote',
      'The reason is shown here, on the estimate and in the audit log. It is not written into the file, because the file follows the worksheet layout.',
    ]) {
      expect(html, text).toContain(text);
    }
    expect(html).not.toContain('Empty until approved');
  });

  it('BO2 after an unlock: the price approved earlier, and that it stays until a new approval replaces it', () => {
    const html = render(
      current({
        totals: { bl: '12629.987', bn: '3.714', bo: '12600', toolCostTotal: '3400.5' },
        approval: { price: '12600.00', approvedAt: '2026-11-05T05:50:00.000Z', earlier: true, calculatedTotal: '12600.00', difference: null, reason: null },
      }),
    );
    expect(html).toContain('₹ 12,600.00, approved earlier on 05 Nov 2026, 11:20 IST. It stays until a new approval replaces it.');
    // At the calculated total there is no difference and no reason to show.
    expect(html).not.toContain('than the calculated total');
    expect(html).not.toContain('Reason given');
  });

  it('says "No reason given." when a different price came with none', () => {
    const html = render(
      current({
        totals: { bl: '12629.987', bn: '3.714', bo: '12600', toolCostTotal: '3400.5' },
        approval: { price: '12600.00', approvedAt: '2026-11-05T05:50:00.000Z', earlier: false, calculatedTotal: '12629.99', difference: { direction: 'lower', amount: '29.99' }, reason: null },
      }),
    );
    expect(html).toContain('No reason given.');
  });
});

describe('AC-9: while the calculation is not current the page holds no figure', () => {
  it.each(['none', 'out-of-date'] as const)('%s: no BG column, no "How BL2 is made", no checklist and no rupee sign', (state) => {
    const html = render(summary({ state, figures: null }));
    for (const text of ['In the file: BG', 'How BL2 is made', 'What the file holds', 'BG column added up', 'Total Tool Cost', '₹']) expect(html, text).not.toContain(text);
  });
});

describe('AC-9: a long reason wraps, so the page never scrolls sideways', () => {
  it('holds an unbroken reason of 500 characters in a wrapping line', () => {
    const reason = 'R'.repeat(500);
    const html = render(
      current({
        totals: { bl: '12629.987', bn: '3.714', bo: '12600', toolCostTotal: '3400.5' },
        approval: { price: '12600.00', approvedAt: '2026-11-05T05:50:00.000Z', earlier: false, calculatedTotal: '12629.99', difference: { direction: 'lower', amount: '29.99' }, reason },
      }),
    );
    expect(html).toContain(`<span class="block [overflow-wrap:anywhere]">Reason given: ${reason}</span>`);
  });

  it('shows a reason that looks like markup as text and never as markup', () => {
    const html = render(
      current({
        totals: { bl: '12629.987', bn: '3.714', bo: '12600', toolCostTotal: '3400.5' },
        approval: { price: '12600.00', approvedAt: '2026-11-05T05:50:00.000Z', earlier: false, calculatedTotal: '12629.99', difference: { direction: 'lower', amount: '29.99' }, reason: '<img src=x onerror=alert(1)>' },
      }),
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

/**
 * STORY-07.06 (UX spec SCR-10 "Quantity warning on this calculation", UX-47; A-24): the notice above the tables, the mark "Quantity 0" on each warned row, the sentence that the file holds no warning and the
 * checklist line "No warning cell". The words are written out here from the UX spec, not imported. The names and rows are invented.
 */
const WARNING = {
  madeBy: 'Invented Engineer',
  at: '2026-11-05T05:20:00.000Z',
  rows: [
    { slNo: '1.1', label: 'Support arm' },
    { slNo: '2', label: '' },
  ],
} as const;

const warned = (state: ExportSummaryView['state'] = 'current'): ExportSummaryView => summary({ state, figures: state === 'current' ? figures() : null, warning: state === 'current' ? WARNING : null });

/** The cells of each table row, as markup. */
const tableRows = (html: string): string[] => [...html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map((match) => match[1] ?? '');

describe('STORY-07.06 AC-1: the notice above the tables', () => {
  it('is a status region with the title, who went ahead, when (IST) and the rows, and says the zeros may be meant and approving is not stopped', () => {
    const html = render(warned());
    expect(html).toMatch(/role="status"(?:(?!<\/div>).)*Quantity warning on this calculation\./s);
    expect(html).toContain('Invented Engineer went ahead on 05 Nov 2026, 10:50 IST with 0 in QTY per Assy on 2 rows: 1.1 Support arm and 2.');
    expect(html).toContain('Each of these rows costs 0 in this estimate. Approving is not stopped. Check that the zeros are meant.');
  });

  it('says that the file holds no warning and keeps the rows as they are, with H 0 and BG 0 (A-24), the letters from the registry', () => {
    expect(render(warned())).toContain('The file holds no warning: it keeps the rows as they are, with H 0 and BG 0.');
    const moved = summary({ state: 'current', figures: figures({ letters: { count: 'K', bg: 'BX', toolCost: 'BM' } }), warning: WARNING });
    expect(render(moved)).toContain('The file holds no warning: it keeps the rows as they are, with K 0 and BX 0.');
  });

  it('is above the tables: it comes before "The rows in the file" and before "How BL2 is made"', () => {
    const html = render(warned());
    const notice = html.indexOf('Quantity warning on this calculation.');
    expect(notice).toBeGreaterThan(-1);
    expect(notice).toBeLessThan(html.indexOf('<table'));
    expect(notice).toBeLessThan(html.indexOf('How BL2 is made'));
  });

  it('puts the mark "Quantity 0" (an icon and the words) on each warned row of "The rows in the file", and on no other', () => {
    const html = render(warned());
    expect(html.match(/data-quantity-tag=""/g)).toHaveLength(2);
    const tagged = tableRows(html).filter((row) => row.includes('data-quantity-tag'));
    expect(tagged.map((row) => /<td[^>]*>([^<]+)<\/td>/.exec(row)?.[1])).toEqual(['1.1', '2']);
    for (const row of tagged) {
      expect(row).toContain('Quantity 0');
      expect(row).toContain('<svg');
    }
  });

  it('keeps a warned row\'s name beside its mark, and "No name yet" for a part with none', () => {
    expect(render(warned())).toMatch(/<td[^>]*>No name yet <span data-quantity-tag/);
  });

  it('names a single row in the singular', () => {
    const html = render(summary({ state: 'current', figures: figures(), warning: { madeBy: 'Invented Lead', at: WARNING.at, rows: [{ slNo: '1.1', label: 'Support arm' }] } }));
    expect(html).toContain('Invented Lead went ahead on 05 Nov 2026, 10:50 IST with 0 in QTY per Assy on 1 row: 1.1 Support arm.');
    expect(html).toContain('This row costs 0 in this estimate.');
    expect(html.match(/data-quantity-tag=""/g)).toHaveLength(1);
  });

  it('shows a name or a row label that looks like markup as text, and wraps a long one', () => {
    const html = render(summary({ state: 'current', figures: figures(), warning: { madeBy: '<img src=x onerror=alert(1)>', at: WARNING.at, rows: [{ slNo: '1.1', label: 'L'.repeat(300) }] } }));
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('L'.repeat(300));
    expect(html.slice(html.indexOf('Quantity warning on this calculation.') - 400)).toContain('[overflow-wrap:anywhere]');
  });
});

describe('STORY-07.06 AC-2: the checklist says there is no warning cell', () => {
  it('"What the file holds" lists "No warning cell", with or without a warning on the calculation', () => {
    expect(render(warned())).toContain('<li>No warning cell</li>');
    expect(render(current())).toContain('<li>No warning cell</li>');
  });

  it('and the rows still show H and BG as the file holds them: a row with H 0 shows 0 and BG 0.00', () => {
    const zero = summary({
      state: 'current',
      figures: figures({ rows: [{ slNo: '1.1', count: '0', bg: '0', toolCost: '0' }] }),
      rows: [{ slNo: '1.1', name: 'Support arm', count: '0' }],
      warning: { madeBy: 'Invented Engineer', at: WARNING.at, rows: [{ slNo: '1.1', label: 'Support arm' }] },
    });
    const row = tableRows(render(zero)).find((candidate) => candidate.includes('data-quantity-tag')) ?? '';
    expect(row).toContain('>0</td>');
    expect(row).toContain('>0.00</td>');
  });
});

describe('STORY-07.06 AC-3: no notice and no mark unless the calculation is current', () => {
  it.each(['none', 'out-of-date'] as const)('%s: no notice, no mark, no word of the warning', (state) => {
    const html = render(warned(state));
    for (const text of ['Quantity warning on this calculation.', 'data-quantity-tag', 'Quantity 0', 'went ahead', 'The file holds no warning', 'No warning cell']) expect(html, text).not.toContain(text);
  });

  it('a current calculation with no warning has no notice and no mark either', () => {
    const html = render(current());
    expect(html).not.toContain('Quantity warning on this calculation.');
    expect(html).not.toContain('data-quantity-tag');
  });
});

describe('STORY-07.06 AC-4: the summary schema carries a warning only while the state is current', () => {
  it('refuses a warning on a state that is not current, and any key that is not named', () => {
    expect(exportSummarySchema.safeParse(warned()).success).toBe(true);
    expect(exportSummarySchema.safeParse({ ...warned(), state: 'out-of-date', figures: null }).success).toBe(false);
    expect(exportSummarySchema.safeParse({ ...warned(), warning: { ...WARNING, code: 'QTY_ZERO' } }).success).toBe(false);
    expect(exportSummarySchema.safeParse({ ...warned(), warning: { ...WARNING, rows: [{ slNo: '1.1', label: 'x', nodeId: 'n' }] } }).success).toBe(false);
    expect(exportSummarySchema.safeParse({ ...warned(), warning: { ...WARNING, rows: [] } }).success).toBe(false);
  });
});
