import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import { loadWorkbook } from '../support/xlsx-parts';

import { saveCanaryQuantity, setCanaryQuantity, useFreshAddress } from './support/auth';
import { calculateAnywayWithoutThePage, engineerWithEstimate, signInAs, signInAsLead } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';
import { withExportTurn } from './support/export-slot';

/**
 * STORY-07.06 (AC-1 to AC-7; FR-104; NFR-002, NFR-016 to NFR-018; A-24; UX spec SCR-10 "Quantity warning on this calculation", UX-47), at 360x800, 768x1024 and 1366x768: a Lead (or the Admin) opens the Excel
 * export of a calculation the Engineer went ahead with **a real row that has 0 in QTY per Assy** (AC-6: the e2e seed's part is typed 0 and goes through the real Calculate anyway; no mock "wording preview" is built)
 * and reads the notice that names who went ahead, when and the row, the mark "Quantity 0" on the row, "The file holds no warning" and "No warning cell"; the one workbook of the test (DL-229: at most two) then holds
 * the row as it is, with H 0 and BG 0, and the warning in no cell and no sheet (A-24). There is no notice once an input changed (AC-3), the summary carries the warning only while current and only for a Lead or an
 * Admin (AC-4), and an Engineer gets a 403 with the canary scan green (AC-5, `canary-scan.spec.ts`). Each test makes an Engineer of its own. The words are the UX spec's, written out here, not imported. Every
 * name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const NOTICE_TITLE = 'Quantity warning on this calculation.';
const NOTICE_MEANING = 'This row costs 0 in this estimate. Approving is not stopped. Check that the zeros are meant.';
const NO_WARNING_IN_FILE = 'The file holds no warning: it keeps the rows as they are, with H 0 and BG 0.';
const WENT_AHEAD = /went ahead on \d{2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} IST with 0 in QTY per Assy on 1 row: 1 Invented text\./;

const notice = (page: Page) => page.getByRole('status').filter({ hasText: NOTICE_TITLE });
const rowsRegion = (page: Page) => page.getByRole('region', { name: 'The rows in the file' });
const downloadButton = (page: Page) => page.getByRole('button', { name: 'Download .xlsx' });

/** An Engineer of the test's own whose one part ("1 Invented text") has 0 in QTY per Assy and who went ahead past the warning, so the calculation holds it (AC-6). */
async function warnedCalculation(page: Page, testInfo: Parameters<typeof engineerWithEstimate>[0]) {
  const made = await engineerWithEstimate(testInfo);
  await setCanaryQuantity(made.owner.id, '0');
  await calculateAnywayWithoutThePage(page, made.owner);
  return made;
}

async function openExport(page: Page, code: string): Promise<void> {
  const response = await page.goto(`/estimates/${code}/export`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Excel export');
}

test.describe('AC-1, AC-2, AC-6: the notice, the mark and the clean file', () => {
  test('AC-1, AC-2, AC-6: the notice names the Engineer, the time and the row, the row carries "Quantity 0", the page says the file holds no warning, and the downloaded file holds H 0 and BG 0 and no warning in any cell or sheet', async ({ page }, testInfo) => {
    const { owner, code } = await warnedCalculation(page, testInfo);
    await signInAsLead(page, testInfo);
    await openExport(page, code);

    // AC-1: the same notice as SCR-06, above the tables, with the sentence about the file.
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText(`${owner.name} went ahead on`);
    await expect(notice(page)).toContainText(WENT_AHEAD);
    await expect(notice(page)).toContainText(NOTICE_MEANING);
    await expect(notice(page)).toContainText(NO_WARNING_IN_FILE);
    const above = await notice(page).boundingBox();
    const table = await rowsRegion(page).boundingBox();
    expect(above?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(table?.y ?? 0);

    // The row of the part carries the mark, with its words, and shows H 0 and BG 0.00 as the file will.
    const tags = rowsRegion(page).locator('[data-quantity-tag]');
    await expect(tags).toHaveCount(1);
    await expect(tags.first()).toContainText('Quantity 0');
    await expect(tags.first()).toBeVisible();
    const row = rowsRegion(page).getByRole('row').filter({ has: page.locator('[data-quantity-tag]') });
    await expect(row.getByRole('cell', { name: '0', exact: true })).toBeVisible();
    await expect(row.getByRole('cell', { name: '0.00', exact: true }).first()).toBeVisible();

    // AC-2: the checklist.
    await expect(page.getByRole('heading', { name: 'What the file holds' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: /^No warning cell$/ })).toBeVisible();

    // AC-2 (A-24): the one workbook of the test. The row shows H 0 and BG 0, there is one sheet, and no cell and no name holds a word of the warning.
    const [download] = await withExportTurn(() => Promise.all([page.waitForEvent('download'), downloadButton(page).click()]));
    const workbook = await loadWorkbook(new Uint8Array(await readFile(await download.path())));
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Quotation']);
    const sheet = workbook.worksheets[0];
    expect(sheet?.getCell('H2').value).toBe(0);
    expect(sheet?.getCell('BG2').value).toBe(0);
    const text: string[] = [];
    sheet?.eachRow((fileRow) => fileRow.eachCell((cell) => text.push(String(cell.value ?? ''), cell.note === undefined ? '' : JSON.stringify(cell.note))));
    for (const word of [NOTICE_TITLE, 'Quantity 0', 'went ahead', 'warning', owner.name]) expect(text.join('\n').toLowerCase(), word).not.toContain(word.toLowerCase());
  });

  test('AC-1: an Admin sees the same notice', async ({ page }, testInfo) => {
    const { owner, code } = await warnedCalculation(page, testInfo);
    await signInAsLead(page, testInfo, 'ADMIN');
    await openExport(page, code);
    await expect(notice(page)).toContainText(`${owner.name} went ahead on`);
    await expect(rowsRegion(page).locator('[data-quantity-tag]')).toHaveCount(1);
  });
});

test.describe('AC-3: no warning unless the calculation is current', () => {
  test('AC-3: after an input changed there is no notice, no mark and no word of the warning on the page or in the summary', async ({ page }, testInfo) => {
    const { owner, code } = await warnedCalculation(page, testInfo);
    // A save from another tab: the count is typed again (still 0), the revision goes up and the figures are out of date.
    await saveCanaryQuantity(owner.id, '0');
    await signInAsLead(page, testInfo);
    await openExport(page, code);
    await expect(notice(page)).toHaveCount(0);
    await expect(page.locator('[data-quantity-tag]')).toHaveCount(0);
    await expect(page.getByText(NOTICE_TITLE)).toHaveCount(0);
    await expect(page.getByText(owner.name)).toHaveCount(0);
    const answer = await page.request.get(`/api/v1/estimates/${owner.id}/export-summary`);
    expect(answer.status()).toBe(200);
    const body = await answer.text();
    expect(JSON.parse(body)).toMatchObject({ state: 'out-of-date', figures: null, warning: null });
    expect(body).not.toContain(owner.name);
  });
});

test.describe('AC-4, AC-5: the summary carries the warning for a Lead and an Admin, and an Engineer gets a 403', () => {
  test('AC-4, AC-5: `GET /export-summary` has who, when and the rows for a Lead and for an Admin, in a strict shape, and the Engineer who owns the estimate is refused with nothing of it', async ({ page }, testInfo) => {
    const { owner } = await warnedCalculation(page, testInfo);
    for (const role of ['LEAD', 'ADMIN'] as const) {
      await signInAsLead(page, testInfo, role);
      const answer = await page.request.get(`/api/v1/estimates/${owner.id}/export-summary`);
      expect(answer.status(), role).toBe(200);
      const { state, warning } = (await answer.json()) as { state: string; warning: { madeBy: string; at: string; rows: Array<Record<string, string>> } };
      expect(state).toBe('current');
      expect(Object.keys(warning).sort()).toEqual(['at', 'madeBy', 'rows']);
      expect(warning.madeBy).toBe(owner.name);
      expect(Number.isNaN(Date.parse(warning.at))).toBe(false);
      expect(warning.rows).toEqual([{ slNo: '1', label: 'Invented text' }]);
    }

    await signInAs(page, owner);
    const refused = await page.request.get(`/api/v1/estimates/${owner.id}/export-summary`);
    expect(refused.status()).toBe(403);
    const body = await refused.text();
    expect(body).not.toContain('went ahead');
    expect(body).not.toContain('Invented text');
    expect(body).not.toContain('warning');
  });
});

test.describe('AC-7: the notice, the tables and accessibility at this width', () => {
  test('AC-7: the notice is a status region, the tables scroll in their own focusable named region, there is no sideways scroll and axe finds nothing', async ({ page }, testInfo) => {
    const { code } = await warnedCalculation(page, testInfo);
    await signInAsLead(page, testInfo);
    await openExport(page, code);
    await expect(notice(page)).toBeVisible();
    await expect(rowsRegion(page).locator('[data-quantity-tag]').first()).toBeVisible();

    await expect(rowsRegion(page)).toHaveAttribute('tabindex', '0');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});
