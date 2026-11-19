import { expect, test, type Page } from '@playwright/test';

import { saveCanaryQuantity, useFreshAddress } from './support/auth';
import { calculateWithoutThePage, engineerWithEstimate, signInAs, signInAsLead } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';
import { withExportTurn } from './support/export-slot';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-07.04 (AC-1 to AC-9; FR-070, FR-100, FR-101; D-28, D-37; NFR-002, NFR-016 to NFR-018; architecture section 4.6), at 360x800, 768x1024 and 1366x768: the Excel download is refused while no calculation is
 * current, and SCR-10 says so. A Lead opens `/estimates/<code>/export` of an estimate never calculated and of one whose count changed after Calculate: the notice with the UX spec's words, an empty state with a
 * link to the estimate (keyboard-operable), **no file card and no table**, no sideways scroll, no axe violation; the file route answers 409 `NOT_CALCULATED` or `EXPORT_OUT_OF_DATE` with the same words and no file;
 * the rest of the portal is not blocked (the estimate opens, Recalculate is on, SCR-06's Download is off with its reason). After Recalculate the file comes back for a Lead and an Admin, an Engineer is still 403
 * and nobody signed in gets 401. A page drawn while the figures were current and a press after an input changed ends in the refusal, never in a file (AC-4). Each test makes an Engineer of its own with an estimate
 * (the recipe of the confidentiality scan); one workbook at most per test (DL-229). The words are the UX spec's, written out here and not imported. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

/** Any other count than the one the part holds, so the input really changes and the estimate's input revision goes up (STORY-06.04's recipe). */
const CHANGED_COUNT = '7';
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NOT_CALCULATED = 'There is no file to download yet. This estimate has not been calculated. The download stays off until a calculation is current.';
const CLEARED = 'The total is cleared because an input changed. There is no file to download until you press Recalculate.';

const downloadButton = (page: Page) => page.getByRole('button', { name: 'Download .xlsx' });
const refusal = (page: Page, lead: string) => page.getByRole('status').filter({ hasText: lead });
const fileCard = (page: Page) => page.locator('[data-slot="card"]').filter({ hasText: 'File name' });

async function openExport(page: Page, code: string): Promise<void> {
  const response = await page.goto(`/estimates/${code}/export`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Excel export');
}

/** What the file route answers a signed-in caller of this page, read in the page's own session. */
async function askForTheFile(page: Page, estimateId: string) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/v1/estimates/${id}/export`);
    return { status: response.status, type: response.headers.get('content-type'), disposition: response.headers.get('content-disposition'), body: await response.text() };
  }, estimateId);
}

/** No file card, no table, no Download button and no part: the two refused states draw none of them (AC-5). */
async function expectNoFileAndNoTable(page: Page): Promise<void> {
  await expect(fileCard(page)).toHaveCount(0);
  await expect(downloadButton(page)).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'The rows in the file' })).toHaveCount(0);
  await expect(page.getByText('A to BO')).toHaveCount(0);
}

test.describe('AC-1, AC-5, AC-9: an estimate that was never calculated', () => {
  test('the page says there is no file yet, shows no file card and no table, and its link to Calculate works from the keyboard; the file route is 409 NOT_CALCULATED with the same words and no file', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await signInAsLead(page, testInfo);
    await openExport(page, code);

    const notice = refusal(page, 'There is no file to download yet.');
    await expect(notice).toBeVisible();
    // The bold line and the sentence under it are two lines of the notice, so each is read on its own; the 409 below carries them as one text.
    await expect(notice).toContainText('This estimate has not been calculated. The download stays off until a calculation is current.');
    await expect(notice).toContainText('Calculate first');
    await expect(notice).toContainText('The file holds the rows and the totals of a calculation. There is none yet.');
    await expectNoFileAndNoTable(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    // AC-1: the same refusal at the file route, with fixed words and no file; the summary says why (the state), and holds no figure.
    const answer = await askForTheFile(page, owner.id);
    expect(answer.status).toBe(409);
    expect(answer.type).toContain('application/problem+json');
    expect(answer.disposition).toBeNull();
    expect(answer.body).not.toMatch(/^PK/);
    expect(JSON.parse(answer.body)).toMatchObject({ status: 409, code: 'NOT_CALCULATED', title: NOT_CALCULATED });

    // AC-9: the link is a real link, reached and used with the keyboard alone, and it leads to the estimate, where Calculate is.
    const link = page.getByRole('link', { name: 'Go to the estimate to Calculate' });
    await expect(link).toHaveAttribute('href', `/estimates/${code}`);
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/estimates/${code}$`));
  });
});

test.describe('AC-2, AC-3, AC-5, AC-6, AC-7, AC-9: an estimate whose count changed after Calculate', () => {
  test('the page says the total is cleared and links to Recalculate with no file card and no table; the file route is 409 EXPORT_OUT_OF_DATE; the rest of the portal works; after Recalculate the file comes back', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await saveCanaryQuantity(owner.id, CHANGED_COUNT);
    await signInAsLead(page, testInfo);
    await openExport(page, code);

    const notice = refusal(page, 'The total is cleared because an input changed.');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('There is no file to download until you press Recalculate.');
    await expect(notice).toContainText('Recalculate first');
    await expect(notice).toContainText('The file would hold figures that no longer match the inputs, so the portal does not build one. After Recalculate the download comes back.');
    await expectNoFileAndNoTable(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    const answer = await askForTheFile(page, owner.id);
    expect(answer.status).toBe(409);
    expect(answer.disposition).toBeNull();
    expect(answer.body).not.toMatch(/^PK/);
    expect(JSON.parse(answer.body)).toMatchObject({ status: 409, code: 'EXPORT_OUT_OF_DATE', title: CLEARED });

    // AC-6, AC-7: only the download is refused. The estimate opens, Recalculate is on, and SCR-06's Download is off, described by its reason.
    const link = page.getByRole('link', { name: 'Go to the estimate to Recalculate' });
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/estimates/${code}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
    await expect(page.locator('#review-calculate')).toHaveText('Recalculate');
    await expect(page.locator('#review-calculate')).toBeEnabled();
    await expect(page.locator('#review-download')).toBeDisabled();
    await expect(page.locator('#review-download')).toHaveAttribute('aria-describedby', 'review-download-reason');
    await expect(page.locator('#review-download-reason')).toHaveText('Calculate or Recalculate first. There is no file until a calculation is current.');

    // AC-3: after Recalculate (the Lead's own request, as the button sends it) the file is given to the Lead, and the page draws the file card again.
    const recalculated = await page.request.post(`/api/v1/estimates/${owner.id}/recalculate`, { headers: { origin: DEVELOPMENT_URL } });
    expect(recalculated.status()).toBe(200);
    await openExport(page, code);
    await expect(fileCard(page)).toBeVisible();
    await expect(downloadButton(page)).toBeEnabled();
    await expect(page.getByText('There is no file to download yet.')).toHaveCount(0);
    await expect(page.getByText('The total is cleared because an input changed.')).toHaveCount(0);
    const file = await withExportTurn(() => page.request.get(`/api/v1/estimates/${owner.id}/export`));
    expect(file.status()).toBe(200);
    expect(file.headers()['content-type']).toBe(XLSX_TYPE);
    expect(file.headers()['content-disposition']).toMatch(/^attachment; filename="Quotation_[A-Za-z0-9_-]+\.xlsx"$/);

    // AC-3: an Engineer is still refused, and nobody signed in gets 401 (and is not told the state).
    await signInAs(page, owner);
    expect((await page.request.get(`/api/v1/estimates/${owner.id}/export`)).status()).toBe(403);
    await page.context().clearCookies();
    const stranger = await page.request.get(`/api/v1/estimates/${owner.id}/export`);
    expect(stranger.status()).toBe(401);
    expect(await stranger.text()).not.toMatch(/NOT_CALCULATED|EXPORT_OUT_OF_DATE/);
  });
});

test.describe('AC-4: the state is read again when the button is pressed', () => {
  test('a page drawn while the figures were current, then an input changed: the press is refused with the same words, and no file is offered', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await signInAsLead(page, testInfo);
    await openExport(page, code);
    await expect(fileCard(page)).toBeVisible();

    // Someone changes an input between the summary the page was drawn from and the press.
    await saveCanaryQuantity(owner.id, CHANGED_COUNT);
    let downloaded = false;
    page.on('download', () => {
      downloaded = true;
    });
    await downloadButton(page).click();

    const notice = page.getByRole('alert').filter({ hasText: CLEARED });
    await expect(notice).toBeVisible();
    await expect(downloadButton(page)).toBeEnabled();
    expect(downloaded).toBe(false);
  });
});
