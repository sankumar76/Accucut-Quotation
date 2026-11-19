import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import { formatFigure, formatRupees } from '../../src/lib/money';
import { loadWorkbook } from '../support/xlsx-parts';

import { useFreshAddress } from './support/auth';
import { calculateWithoutThePage, engineerWithEstimate, signInAsLead } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';
import { withExportTurn } from './support/export-slot';

/**
 * STORY-07.03 AC-1, AC-3, AC-6, AC-9 (FR-069; D-05, D-16; SPEC section 10; UX spec SCR-10), at 360x800, 768x1024 and 1366x768: a Lead opens the Excel export of a calculated estimate and reads the cards of the
 * figures, then downloads the one file of the test (one workbook, within the limit of two a test, DL-229) and finds in it what the page says: BL2, BN2 and the total Tool Cost in their cells, the part's own BG
 * and Tool Cost, and the BG column added up to BL2. Each test makes an Engineer of its own with an estimate (the recipe of the confidentiality scan). The words are the UX spec's, written out here, not imported. The
 * Engineer's refusal and the scan of the file for cost values are `export.spec.ts` and `canary-scan.spec.ts`. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const downloadButton = (page: Page) => page.getByRole('button', { name: 'Download .xlsx' });

async function openExport(page: Page, code: string): Promise<void> {
  const response = await page.goto(`/estimates/${code}/export`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Excel export');
}

/** The text beside a name in the checklist "What the file holds": the `dd` that follows the `dt`. */
const valueOf = (page: Page, name: string) => page.locator('dt', { hasText: new RegExp(`^${name}$`) }).locator('xpath=following-sibling::dd[1]');

test.describe('AC-9: the cards of SCR-10 for a calculation that is current', () => {
  test('the page names the rows with the file\'s own BG and Tool Cost, adds the BG column up to BL2, and the figures are the ones in the downloaded file', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await signInAsLead(page, testInfo);
    await openExport(page, code);

    // The rows card: the three added headings, the part's row, the BG column added up (AC-2, D-16) and the Total Tool Cost row (AC-3, D-05).
    const region = page.getByRole('region', { name: 'The rows in the file' });
    for (const heading of ['Qty (H), for the whole order', 'In the file: BG', 'In the file: Tool Cost (BM)']) await expect(region.getByRole('columnheader', { name: heading })).toBeVisible();
    await expect(region.getByText('BG column added up: BL2, the same as the total on screen')).toBeVisible();
    await expect(region.getByText(/^Total Tool Cost: file row 4, one empty row below the last part, with the label in the cell to the left of the Tool Cost column$/)).toBeVisible();

    // The other two cards.
    await expect(page.getByRole('heading', { name: 'How BL2 is made' })).toBeVisible();
    await expect(page.getByText('Add the BG column of the file. That gives BL2, at any quantity.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What the file holds' })).toBeVisible();
    await expect(page.getByText('BL2, BN2 and BO2 appear once, in row 2, and the file has no per-item totals.')).toBeVisible();
    // Never approved: BO2 is empty (AC-4).
    await expect(valueOf(page, 'BO2')).toHaveText('Empty until approved, and empty after the Admin cancels an approval');

    // One workbook: the figures the page shows are the cells of the file.
    const [download] = await withExportTurn(() => Promise.all([page.waitForEvent('download'), downloadButton(page).click()]));
    const sheet = (await loadWorkbook(new Uint8Array(await readFile(await download.path())))).worksheets[0];
    const bl = sheet?.getCell('BL2').value;
    const bg = sheet?.getCell('BG2').value;
    const toolCost = sheet?.getCell('BM4').value;
    expect(typeof bl).toBe('number');
    // AC-2: one part, so its own BG is the whole BL, which is BL2 (D-16: one total, once, in row 2).
    expect(bl).toBe(bg);
    expect(sheet?.getCell('BL4').value).toBe('Total Tool Cost');
    expect(typeof toolCost).toBe('number');
    // AC-1: no per-item total and no BO: the three product columns hold nothing else.
    expect([sheet?.getCell('BO2').value ?? null, sheet?.getCell('BL3').value ?? null, sheet?.getCell('BN3').value ?? null, sheet?.getCell('BO3').value ?? null]).toEqual([null, null, null, null]);

    // What the page says is what the file holds, to the paisa (the page prints two decimals, the cell holds the full figure).
    await expect(valueOf(page, 'BL2')).toHaveText(formatRupees(String(bl)));
    await expect(region.getByRole('cell', { name: formatFigure(String(bg)), exact: true }).first()).toBeVisible();
    await expect(valueOf(page, 'Total Tool Cost')).toHaveText(`${formatRupees(String(toolCost))}, in the Tool Cost column of row 4`);
    if (sheet?.getCell('BN2').value === null) await expect(valueOf(page, 'BN2')).toHaveText('No figure: an empty cell');
    else await expect(valueOf(page, 'BN2')).toHaveText(formatFigure(String(sheet?.getCell('BN2').value)));
  });

  test('the new cards cause no sideways scroll, the table stays in its own focusable region, and axe finds nothing', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await signInAsLead(page, testInfo);
    await openExport(page, code);
    await expect(page.getByRole('heading', { name: 'What the file holds' })).toBeVisible();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    const region = page.getByRole('region', { name: 'The rows in the file' });
    await expect(region).toHaveAttribute('tabindex', '0');
    await expectNoAxeViolations(page);
  });
});

test.describe('AC-8: the summary holds figures only while the calculation is current', () => {
  test('a never-calculated estimate has none: the page draws no figure card and no rupee sign, and the summary says its state', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await signInAsLead(page, testInfo);
    await openExport(page, code);
    await expect(page.getByRole('heading', { name: 'How BL2 is made' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'What the file holds' })).toHaveCount(0);
    await expect(page.getByText('₹')).toHaveCount(0);
    const summary = await page.evaluate(async (id) => (await fetch(`/api/v1/estimates/${id}/export-summary`)).json(), owner.id);
    expect(summary).toMatchObject({ state: 'none', figures: null });
  });
});
