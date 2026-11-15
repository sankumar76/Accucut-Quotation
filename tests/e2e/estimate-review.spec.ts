import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { defined } from '../support/defined';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { MATERIAL_CANARIES } from '../support/material-master-canary';

import {
  createDisposableUser,
  E2E_ADMIN,
  E2E_PASSWORD,
  ensureCanaryCustomers,
  ensureCanaryMaterials,
  makeCanaryEstimateCalculable,
  readEstimateState,
  signInThroughThePage,
  useFreshAddress,
  type E2eUser,
} from './support/auth';
import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';

/**
 * STORY-06.02 T6 (AC-1 to AC-6, AC-9): the estimate review, SCR-06, for a Lead and an Admin at `/estimates/<code>`, at 360x800, 768x1024 and 1366x768 on the development server. Each test makes
 * an Engineer of its own with an estimate (the recipe of the confidentiality scan), has the Engineer calculate it through the portal, and opens the same address as a Lead. What it checks: the three
 * tiles, each with its file cell once; each row's own figure and count; "How the total is built" ending with the figure of the BL tile; the not-calculated state with its disabled buttons and
 * their reasons; that an Engineer who opens the same address gets their own workspace and a 403 from `/costs`; no sideways scroll and no axe violation. The words are the UX spec's and the story's,
 * written out here and not imported. The figures themselves are held by `tests/unit/estimate-review-*.test.ts` against the constructed cases, and the cost scan reads the same page as an Engineer
 * (`canary-scan.spec.ts`). Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const ALPHA_CUSTOMER_ID = defined(CUSTOMER_CANARIES[0]).id;
const ALPHA_MATERIAL_ID = defined(MATERIAL_CANARIES[0]).id;
const PHONE_MAX = 767;
const FIGURE = /^[\d,]+\.\d{2}$/;
const RUPEES = /^₹ [\d,]+\.\d{2}$/;

async function signInAs(page: Page, person: E2eUser): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/sign-in');
  await signInThroughThePage(page, person.email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/queue$/);
}

/** An Engineer with an estimate that can be calculated: the customer chosen and one part holding every input. */
async function engineerWithEstimate(testInfo: TestInfo) {
  await ensureCanaryCustomers();
  await ensureCanaryMaterials();
  const owner = await createDisposableUser('scan', testInfo);
  await makeCanaryEstimateCalculable(owner.id, ALPHA_MATERIAL_ID, ALPHA_CUSTOMER_ID);
  return { owner, code: canaryTaskCodeFor(owner.id) };
}

/** The Engineer presses Calculate through the portal (the same request the button sends), and the estimate is Submitted. */
async function calculateAsEngineer(page: Page, owner: E2eUser & { readonly id: string }, code: string): Promise<void> {
  await signInAs(page, owner);
  await page.goto(`/estimates/${code}`);
  const status = await page.evaluate(async (id) => (await fetch(`/api/v1/estimates/${id}/calculate`, { method: 'POST' })).status, owner.id);
  expect(status).toBe(200);
  expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
}

async function openAsLead(page: Page, testInfo: TestInfo, code: string, role: 'LEAD' | 'ADMIN' = 'LEAD'): Promise<void> {
  // There is one active Admin in the database (the E2E Admin of the setup project), so an Admin is not made for the test.
  const person = role === 'ADMIN' ? E2E_ADMIN : await createDisposableUser('axe', testInfo, role);
  await signInAs(page, person);
  const response = await page.goto(`/estimates/${code}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
}

const tiles = (page: Page) => page.getByRole('region', { name: 'Totals' });
const treePanel = (page: Page) => page.locator('details').filter({ has: page.locator('summary', { hasText: /^Parts tree$/ }) });
const buildPanel = (page: Page) => page.locator('details').filter({ has: page.locator('summary', { hasText: /^How the total is built/ }) });
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1_000) <= PHONE_MAX;

test.describe('AC-1, AC-2, AC-3: a calculated estimate, as a Lead', () => {
  test('AC-1: the tiles show BL in rupees, BN and BO, each with its letter tag and its file cell once', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await openAsLead(page, testInfo, code);

    await expect(tiles(page)).toContainText('Total Unit Production Price');
    await expect(tiles(page)).toContainText('Price per Tool Cost');
    await expect(tiles(page)).toContainText('Approved Quote Price');
    for (const cell of ['File cell BL2', 'File cell BN2', 'File cell BO2']) await expect(tiles(page).getByText(cell)).toHaveCount(1);
    await expect(tiles(page).getByText('Not set yet', { exact: true })).toHaveCount(1);
    for (const letter of ['BL', 'BN', 'BO']) await expect(tiles(page).getByText(`Excel column ${letter}`, { exact: true })).toHaveCount(1);
    const bl = tiles(page).locator('p').filter({ hasText: RUPEES });
    await expect(bl).toHaveCount(1);
  });

  test('AC-2: every row shows its own figure with its count beside it, and the legend says so', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await openAsLead(page, testInfo, code);

    const rows = treePanel(page).locator('li');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(/\d+(\.\d+)? nos/);
    await expect(rows.first().locator('span').filter({ hasText: FIGURE }).last()).toBeVisible();
    await expect(treePanel(page)).toContainText("Each figure is that row's own BG. The count for the whole order (QTY per Assy) is shown beside it and is already included. The estimate total adds every row's BG.");
    await expect(page.getByText('Σ')).toHaveCount(0);
  });

  test('AC-3: "How the total is built" lists the row and ends with the total, which is the figure of the BL tile, under the example and the rounding sentence', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await openAsLead(page, testInfo, code);

    await expect(buildPanel(page)).not.toHaveAttribute('open', '');
    await buildPanel(page).locator('summary').click();
    const table = page.getByRole('region', { name: 'How the total is built, scrollable' });
    await expect(table).toBeVisible();
    for (const heading of ['Sl. No', 'Part', 'QTY per Assy']) await expect(table.getByRole('columnheader', { name: new RegExp(heading, 'i') })).toBeVisible();
    const totalRow = table.getByRole('row').filter({ hasText: 'Total (the sum of the BG column)' });
    const total = (await totalRow.getByRole('cell').last().innerText()).trim();
    expect(total).toMatch(FIGURE);
    await expect(tiles(page)).toContainText(`₹ ${total}`);
    await expect(buildPanel(page)).toContainText('Worked example: if one lid costs 1, one pipe costs 1 and the frame row holds nothing, the total is 24 + 6 + 0 = 30.');
    await expect(buildPanel(page)).toContainText('Figures are shown to 2 decimals. Totals add the unrounded values and round once');
  });

  test('AC-2: an Admin sees the same review', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await openAsLead(page, testInfo, code, 'ADMIN');
    await expect(tiles(page)).toContainText('File cell BL2');
  });
});

test.describe('AC-6: not calculated', () => {
  test('shows the notice as a status, "Not calculated", dashes, Calculate as the primary button, and Approve and Download off with their reasons', async ({ page }, testInfo) => {
    const { code } = await engineerWithEstimate(testInfo);
    await openAsLead(page, testInfo, code);

    const notice = page.getByRole('status').filter({ hasText: 'The Engineer has not calculated this estimate yet.' });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Press Calculate to see costs. Approve and lock and the Excel download stay off until then.');
    await expect(tiles(page)).toContainText('Not calculated');
    await expect(page.getByText('How the total is built')).toHaveCount(0);
    for (const [button, label] of [['review-calculate', 'Calculate'], ['review-approve', 'Approve and lock'], ['review-download', 'Download .xlsx']] as const) {
      const control = page.locator(`#${button}`);
      await expect(control).toHaveText(label);
      await expect(control).toBeDisabled();
      const reasonId = await control.getAttribute('aria-describedby');
      expect(reasonId, button).not.toBeNull();
      await expect(page.locator(`#${reasonId ?? 'missing'}`)).toBeVisible();
    }
    await expect(page.locator('#review-approve-reason')).toHaveText('Calculate first. Approving is available once the figures have been calculated.');
    await expect(page.locator('#review-download-reason')).toHaveText('Calculate or Recalculate first. There is no file until a calculation is current.');
  });
});

test.describe('AC-5 (NFR-002): an Engineer at the same address', () => {
  test('the owner gets their own workspace and no review; `/costs` is the fixed 403 and holds no figure; another Engineer gets "not found"', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);

    const own = await page.goto(`/estimates/${code}`);
    expect(own?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
    await expect(page.getByText('Total Unit Production Price')).toHaveCount(0);
    await expect(page.getByText('File cell')).toHaveCount(0);
    await expect(page.locator('#review-approve')).toHaveCount(0);

    const refused = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/estimates/${id}/costs`);
      return { status: response.status, body: await response.text() };
    }, owner.id);
    expect(refused.status).toBe(403);
    expect(JSON.parse(refused.body)).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(refused.body).not.toMatch(/state|totals|figures|totalPrice|nodes/);

    const other = await createDisposableUser('scan', testInfo);
    await signInAs(page, other);
    const foreign = await page.goto(`/estimates/${code}`);
    expect(foreign?.status()).toBe(404);
    await expect(page.getByText('Total Unit Production Price')).toHaveCount(0);
  });

  test('a Lead is answered by `/costs` with the state and the figures, and nobody signed in is 401', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await openAsLead(page, testInfo, code);
    const answer = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/estimates/${id}/costs`);
      return { status: response.status, body: await response.text() };
    }, owner.id);
    expect(answer.status).toBe(200);
    expect(JSON.parse(answer.body)).toMatchObject({ state: 'current', configurationNumber: expect.any(Number), totals: { totalPrice: expect.stringMatching(/^\d+(\.\d+)?$/) } });

    await page.context().clearCookies();
    const signedOut = await page.request.get(`/api/v1/estimates/${owner.id}/costs`);
    expect(signedOut.status()).toBe(401);
  });
});

test.describe('AC-9: layout and accessibility', () => {
  test('a calculated estimate: no sideways scroll, tiles stack on a phone and sit side by side from 768, the tree folds away, axe finds nothing', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await openAsLead(page, testInfo, code);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    const box = async (index: number) => defined(await tiles(page).locator('[data-slot="card"]').nth(index).boundingBox());
    const first = await box(0);
    const second = await box(1);
    const third = await box(2);
    if (isPhone(page)) {
      expect(second.y).toBeGreaterThanOrEqual(first.y + first.height - 1);
      expect(third.y).toBeGreaterThanOrEqual(second.y + second.height - 1);
    } else {
      expect(Math.abs(second.y - first.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(third.y - first.y)).toBeLessThanOrEqual(1);
    }

    const rows = treePanel(page).locator('li');
    await expect(rows.first()).toBeVisible();
    await treePanel(page).locator('summary').click();
    await expect(rows.first()).toBeHidden();
    await treePanel(page).locator('summary').click();
    await expect(rows.first()).toBeVisible();

    await buildPanel(page).locator('summary').click();
    await expect(page.getByRole('region', { name: 'How the total is built, scrollable' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('not calculated: no sideways scroll and axe finds nothing', async ({ page }, testInfo) => {
    const { code } = await engineerWithEstimate(testInfo);
    await openAsLead(page, testInfo, code);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});
