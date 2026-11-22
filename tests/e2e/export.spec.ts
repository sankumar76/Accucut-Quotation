import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import { istDayMonthYearOf } from '../../src/lib/time';
import { loadWorkbook, readXlsxParts } from '../support/xlsx-parts';

import { createDisposableUser, putPictureOnCanaryPart, setCanarySubject, useFreshAddress } from './support/auth';
import { calculateWithoutThePage, engineerWithEstimate, signInAs, signInAsLead } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';
import { withExportTurn } from './support/export-slot';

/**
 * STORY-07.01 (AC-2 to AC-7; NFR-002, NFR-027): the Excel export, SCR-10, for a Lead and an Admin at `/estimates/<code>/export`, at 360x800, 768x1024 and 1366x768. Each test makes an Engineer of its own with an
 * estimate (the recipe of the confidentiality scan) and opens the page as a Lead. What it checks: a real download whose name, type and layout are the story's (the file is read back, its columns A to BO
 * and its header row); the Building and Error states of the button, with the reference; that the Engineer gets the fixed 403 with no file from both routes and SCR-26 from the page; the table's own
 * focusable, named region, no sideways scroll, the button stacking on a phone, and no axe violation. The words are the UX spec's, written out here and not imported. The cost scan reads the same routes and
 * page as an Engineer (`canary-scan.spec.ts`). Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const PHONE_MAX = 767;
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const FILE_NAME = /^[^\s/\\:*?"<>|]+_\d{2}-\d{2}-\d{4}\.xlsx$/u;
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1_000) <= PHONE_MAX;
const downloadButton = (page: Page) => page.getByRole('button', { name: 'Download .xlsx' });

async function openExport(page: Page, code: string): Promise<void> {
  const response = await page.goto(`/estimates/${code}/export`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Excel export');
}

test.describe('AC-2, AC-4, AC-6: a Lead downloads the file', () => {
  test('the page shows the file card and the rows, and the button downloads a workbook named <short name>_<subject>_<date>, with columns A to BO', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    // The file is of the calculation, so the Engineer presses Calculate first (without the pages), then the Lead opens the export. The part has its picture (AC-4).
    await putPictureOnCanaryPart(owner.id);
    await calculateWithoutThePage(page, owner);
    await signInAsLead(page, testInfo);
    await openExport(page, code);

    const card = page.locator('[data-slot="card"]').filter({ hasText: 'File name' });
    await expect(card.getByText(FILE_NAME)).toBeVisible();
    await expect(card).toContainText('1 part');
    await expect(card).toContainText('A to BO');
    await expect(page.getByRole('region', { name: 'The rows in the file' })).toBeVisible();

    const [download] = await withExportTurn(() => Promise.all([page.waitForEvent('download'), downloadButton(page).click()]));
    expect(download.suggestedFilename()).toMatch(FILE_NAME);
    // CR-01 item 9: the short name of the customer, the subject of the task (`Canary subject`), the IST date; the task code is no longer in the name.
    expect(download.suggestedFilename()).toContain('_Canary-subject_');
    expect(download.suggestedFilename()).not.toContain(code);
    const path = await download.path();
    const bytes = new Uint8Array(await readFile(path));
    // The zip is a workbook, and ExcelJS reads it back with the registry's 67 columns, A to BO, in row 1.
    expect(readXlsxParts(bytes).has('xl/workbook.xml')).toBe(true);
    const sheet = (await loadWorkbook(bytes)).worksheets[0];
    expect(sheet?.columnCount).toBe(67);
    expect(sheet?.getCell('A1').value).toBe('Sl. No');
    expect(sheet?.getCell('BO1').value).toBe('Approved Quote Price');
    // STORY-07.02 AC-1, AC-2: the part's own row below the header, its Sl. No as text, its figures from the record, and a hidden line present as 0 (Fasteners Qty, T).
    // Header, the one part, and (STORY-07.03) the footer of the total Tool Cost two rows below it: 3 rows hold values.
    expect(sheet?.actualRowCount).toBe(3);
    expect(sheet?.getCell('A2').value).toBe('1');
    expect(sheet?.getCell('BG2').value).toEqual(expect.any(Number));
    expect(sheet?.getCell('T2').value).toBe(0);
    // STORY-07.02 AC-4: the part's picture, built by the real thread, is embedded in column C of its own row (zero-based column 2, row 1), over an empty cell.
    expect(sheet?.getCell('C2').value).toBeNull();
    const pictures = sheet?.getImages() ?? [];
    expect(pictures).toHaveLength(1);
    expect(pictures.map((picture) => [Math.floor(picture.range.tl.col), Math.floor(picture.range.tl.row)])).toEqual([[2, 1]]);
    expect([...readXlsxParts(bytes).keys()].filter((name) => name.startsWith('xl/media/') && !name.endsWith('/'))).toHaveLength(1);
  });

  test('AQP-391 AC-1, AC-5, AC-6: a subject with a space, a slash and a non-ASCII letter is cleaned, the header carries both name parameters, and the saved name equals the name on the card', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    const shortName = await setCanarySubject(owner.id, 'Kühler 40/B 工场');
    await calculateWithoutThePage(page, owner);
    await signInAsLead(page, testInfo);
    // The date is the IST date of the download: either side of the call, in case it runs over IST midnight.
    const before = istDayMonthYearOf(new Date());
    await openExport(page, code);
    const card = page.locator('[data-slot="card"]').filter({ hasText: 'File name' });
    const nameOnCard = await card.getByText(FILE_NAME).innerText();
    expect(nameOnCard).toMatch(new RegExp(`^${shortName}_Kühler-40-B-工场_\\d{2}-\\d{2}-\\d{4}\\.xlsx$`, 'u'));

    const [download] = await withExportTurn(() => Promise.all([page.waitForEvent('download'), downloadButton(page).click()]));
    const after = istDayMonthYearOf(new Date());
    expect(download.suggestedFilename()).toBe(nameOnCard);
    expect([before, after].map((date) => `${shortName}_Kühler-40-B-工场_${date}.xlsx`)).toContain(download.suggestedFilename());

    const header = await withExportTurn(async () => (await page.request.get(`/api/v1/estimates/${owner.id}/export`)).headers()['content-disposition']);
    expect(header).toMatch(/^attachment; filename="[A-Za-z0-9._-]+\.xlsx"; filename\*=UTF-8''[A-Za-z0-9._%-]+\.xlsx$/);
    expect(header).toContain('K%C3%BChler-40-B-%E5%B7%A5%E5%9C%BA');
  });

  test('the route answers an attachment of the right type with `no-store`, and an Admin gets the same', async ({ page }, testInfo) => {
    const { owner } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await signInAsLead(page, testInfo, 'ADMIN');
    await page.goto('/queue');
    const answer = await withExportTurn(() =>
      page.evaluate(async (id) => {
        const response = await fetch(`/api/v1/estimates/${id}/export`);
        return { status: response.status, type: response.headers.get('content-type'), disposition: response.headers.get('content-disposition'), cache: response.headers.get('cache-control'), size: (await response.arrayBuffer()).byteLength };
      }, owner.id),
    );
    expect(answer.status).toBe(200);
    expect(answer.type).toBe(XLSX_TYPE);
    expect(answer.disposition).toMatch(/^attachment; filename="[A-Za-z0-9._-]+\.xlsx"; filename\*=UTF-8''[A-Za-z0-9._%-]+\.xlsx$/);
    expect(answer.cache).toContain('no-store');
    expect(answer.size).toBeGreaterThan(1_000);
  });
});

test.describe('STORY-07.02: no file unless the calculation is current (architecture section 4.6)', () => {
  test('the file route refuses an estimate that was never calculated with 409 NOT_CALCULATED, fixed words and no file', async ({ page }, testInfo) => {
    const { owner } = await engineerWithEstimate(testInfo);
    await signInAsLead(page, testInfo);
    await page.goto('/queue');
    const refused = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/estimates/${id}/export`);
      return { status: response.status, type: response.headers.get('content-type'), disposition: response.headers.get('content-disposition'), body: await response.text() };
    }, owner.id);
    expect(refused.status).toBe(409);
    expect(refused.type).toContain('application/problem+json');
    expect(refused.disposition).toBeNull();
    expect(JSON.parse(refused.body)).toMatchObject({ status: 409, code: 'NOT_CALCULATED' });
    expect(refused.body).not.toMatch(/^PK/);
  });
});

test.describe('AC-6: the Building and Error states of the button', () => {
  test('Building: the button is disabled and the line names the parts and pictures while the file is built, and the button is back afterwards', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await signInAsLead(page, testInfo);
    await openExport(page, code);

    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/v1/estimates/*/export', async (route) => {
      await held;
      await route.continue();
    });
    const downloaded = page.waitForEvent('download');
    await downloadButton(page).click();
    await expect(downloadButton(page)).toBeDisabled();
    await expect(page.getByText('Building the file. 1 part, 0 pictures. This usually takes a few seconds.')).toBeVisible();
    // The held request reaches the server when it is released, so the build is taken in its turn from here.
    await withExportTurn(async () => {
      release();
      await downloaded;
    });
    await expect(downloadButton(page)).toBeEnabled();
    await expect(page.getByText(/^Building the file/)).toHaveCount(0);
  });

  test('Error: a failed build shows the notice with the reference of the answer, and the button can be pressed again', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    // The page draws the button only while a calculation is current (STORY-07.04 AC-5).
    await calculateWithoutThePage(page, owner);
    await signInAsLead(page, testInfo);
    await openExport(page, code);

    await page.route('**/api/v1/estimates/*/export', (route) =>
      route.fulfill({ status: 500, contentType: 'application/problem+json', headers: { 'X-Request-Id': 'req-0a1b2c3d' }, body: JSON.stringify({ status: 500, code: 'INTERNAL', title: 'Something went wrong.' }) }),
    );
    await downloadButton(page).click();
    const notice = page.getByRole('alert').filter({ hasText: 'We could not build the file' });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Try again.');
    await expect(notice).toContainText('Reference: req-0a1b2c3d');
    await expect(downloadButton(page)).toBeEnabled();
  });
});

test.describe('AC-3 (NFR-002): an Engineer gets nothing', () => {
  test('both routes are the fixed 403 with no file and the page is "no access" with HTTP 403, before anything is read; a Lead gets the answers; nobody signed in gets 401', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await signInAs(page, owner);

    const own = await page.goto(`/estimates/${code}`);
    expect(own?.status()).toBe(200);
    await expect(page.getByText(/Excel export|Download \.xlsx/)).toHaveCount(0);

    for (const name of ['export', 'export-summary']) {
      const refused = await page.evaluate(
        async ({ id, route }) => {
          const response = await fetch(`/api/v1/estimates/${id}/${route}`);
          return { status: response.status, type: response.headers.get('content-type'), disposition: response.headers.get('content-disposition'), body: await response.text() };
        },
        { id: owner.id, route: name },
      );
      expect(refused.status, name).toBe(403);
      expect(refused.type, name).toContain('application/problem+json');
      expect(refused.disposition, name).toBeNull();
      expect(JSON.parse(refused.body), name).toMatchObject({ status: 403, code: 'FORBIDDEN' });
      expect(refused.body, name).not.toMatch(/PK|fileName|partCount|columns|rows/);
    }

    const page403 = await page.goto(`/estimates/${code}/export`);
    expect(page403?.status()).toBe(403);
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Excel export');
    await expect(page.getByRole('button', { name: 'Download .xlsx' })).toHaveCount(0);

    // Another Engineer, on this one's estimate: still the refusal.
    const other = await createDisposableUser('scan', testInfo);
    await signInAs(page, other);
    expect((await page.goto(`/estimates/${code}/export`))?.status()).toBe(403);
    expect(await page.evaluate(async (id) => (await fetch(`/api/v1/estimates/${id}/export`)).status, owner.id)).toBe(403);

    await signInAsLead(page, testInfo);
    const allowed = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/estimates/${id}/export-summary`);
      return { status: response.status, body: await response.text() };
    }, owner.id);
    expect(allowed.status).toBe(200);
    expect(JSON.parse(allowed.body)).toMatchObject({ partCount: 1, columns: { first: 'A', last: 'BO', count: 67 } });

    await page.context().clearCookies();
    expect((await page.request.get(`/api/v1/estimates/${owner.id}/export`)).status()).toBe(401);
    expect((await page.request.get(`/api/v1/estimates/${owner.id}/export-summary`)).status()).toBe(401);
  });
});

test.describe('AC-7: layout and accessibility', () => {
  test('no sideways scroll, the rows table scrolls inside its own focusable, named region, the button stacks full width on a phone, and axe finds nothing', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await signInAsLead(page, testInfo);
    await openExport(page, code);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    const region = page.getByRole('region', { name: 'The rows in the file' });
    await expect(region).toHaveAttribute('tabindex', '0');
    await region.focus();
    await expect(region).toBeFocused();

    const button = await downloadButton(page).boundingBox();
    const card = await page.locator('[data-slot="card"]').filter({ hasText: 'File name' }).boundingBox();
    expect(button).not.toBeNull();
    expect(card).not.toBeNull();
    if (isPhone(page) && button !== null && card !== null) expect(button.width).toBeGreaterThan(card.width * 0.7);

    await expectNoAxeViolations(page);
  });
});
