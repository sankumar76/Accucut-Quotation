import { expect, test, type Page } from '@playwright/test';

import { readEstimateState, saveCanaryQuantity, useFreshAddress } from './support/auth';
import { calculateAsEngineer, engineerWithEstimate, signInAs, signInAsLead } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';

/**
 * STORY-06.04 (AC-1, AC-3, AC-5, AC-7, AC-9, AC-10; NFR-002): Recalculate and the cleared figures, SCR-06, for a Lead and an Admin at `/estimates/<code>`, at 360x800, 768x1024 and 1366x768. Each test makes an
 * Engineer of its own with an estimate (the recipe of the confidentiality scan), has the Engineer calculate it through the portal, and changes an input the way a save from another tab does (the count of the part:
 * the estimate's input revision goes up). What it checks: the figures read **Cleared** in words (italic, never an empty box), the count stays, "How the total is built" is hidden, Approve and Download are off with
 * their reasons, the Recalculate button works from the screen and the figures come back, the first Calculate of a Lead on an estimate nobody calculated, the tile skeleton while the request is under way, a refused
 * request shown in the server's words, that an Engineer at the same address sees no figure state and gets the fixed 403 from the route, and no sideways scroll and no axe violation. The words are the UX spec's
 * (v0.29, "SCR-06 interim and final words"), written out here and not imported. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

/** The count typed after the Engineer's Calculate: any other number than the one the part holds, so the input really changes. */
const CHANGED_COUNT = '7';
const RECALCULATE_ROUTE = '**/api/v1/estimates/*/recalculate';
const SLOW_MILLISECONDS = 800;
const FIGURE = /^[\d,]+\.\d{2}$/;
const RUPEES = /^₹ [\d,]+\.\d{2}$/;

const tiles = (page: Page) => page.getByRole('region', { name: 'Totals' });
const button = (page: Page) => page.locator('#review-calculate');
const clearedNotice = (page: Page) => page.getByRole('status').filter({ hasText: 'The total is cleared because an input changed.' });

async function openAsLead(page: Page, code: string, testInfo: Parameters<typeof signInAsLead>[1]): Promise<void> {
  await signInAsLead(page, testInfo);
  const response = await page.goto(`/estimates/${code}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
}

/** An estimate the Engineer calculated and whose count then changed, opened as a Lead: the figures are cleared. */
async function clearedEstimate(page: Page, testInfo: Parameters<typeof signInAsLead>[1]) {
  const { owner, code } = await engineerWithEstimate(testInfo);
  await calculateAsEngineer(page, owner, code);
  await saveCanaryQuantity(owner.id, CHANGED_COUNT);
  await openAsLead(page, code, testInfo);
  return { owner, code };
}

test.describe('AC-1 and AC-5: the cleared state', () => {
  test('every figure reads Cleared in words, the count stays, the table is hidden, and Approve and Download are off with their reasons', async ({ page }, testInfo) => {
    await clearedEstimate(page, testInfo);

    await expect(clearedNotice(page)).toContainText('Every calculated figure, on every row, is cleared with it. They show again after you press Recalculate. Until then Approve and lock and the Excel download stay off.');
    await expect(tiles(page).getByText('Cleared', { exact: true }).first()).toHaveCSS('font-style', 'italic');
    await expect(tiles(page)).toContainText('An input changed, so every calculated figure is cleared. Press Recalculate to see them again.');
    await expect(tiles(page)).toContainText('Cleared with the total.');
    await expect(tiles(page)).toContainText('You set it when you approve, after Recalculate.');
    await expect(tiles(page).getByText(RUPEES)).toHaveCount(0);
    await expect(page.getByText('Every calculated figure is cleared because an input changed. Press Recalculate to see them again.')).toBeVisible();
    await expect(page.getByText('How the total is built')).toHaveCount(0);
    await expect(page.getByText(/\d nos/).first()).toContainText(CHANGED_COUNT);

    await expect(button(page)).toHaveText('Recalculate');
    await expect(button(page)).toBeEnabled();
    await expect(page.locator('#review-approve')).toBeDisabled();
    await expect(page.locator('#review-download')).toBeDisabled();
    await expect(page.locator('#review-approve-reason')).toHaveText('Recalculate first. Approving is available once the figures have been calculated again.');
    await expect(page.locator('#review-download-reason')).toHaveText('Calculate or Recalculate first. There is no file until a calculation is current.');
    await expect(page.getByText('Calculating from this screen is not available yet.')).toHaveCount(0);
  });

  test('AC-9: no sideways scroll and axe finds nothing in the cleared state', async ({ page }, testInfo) => {
    await clearedEstimate(page, testInfo);
    await expect(clearedNotice(page)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});

test.describe('AC-3: Recalculate from the screen', () => {
  test('the press stores a new calculation, the estimate stays Submitted, and the figures, the Calculated line and the table come back', async ({ page }, testInfo) => {
    const { owner } = await clearedEstimate(page, testInfo);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
    await waitUntilHydrated(page, '#review-calculate');

    const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/estimates/${owner.id}/recalculate`));
    await button(page).click();
    expect((await answered).status()).toBe(200);

    await expect(button(page)).toHaveCount(0);
    await expect(clearedNotice(page)).toHaveCount(0);
    await expect(tiles(page).getByText(RUPEES)).toHaveCount(1);
    await expect(page.getByText(/^Calculated .+ · configuration version \d+$/)).toBeVisible();
    await expect(page.getByText('How the total is built').first()).toBeVisible();
    // Focus goes to the line that says when the figures were calculated, not to the top of the page.
    await expect(page.locator('#review-calculated')).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 2 });
  });

  test('the first press of a Lead on an estimate nobody calculated is a Calculate: the estimate becomes Submitted and the figures show', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await openAsLead(page, code, testInfo);
    await expect(page.getByRole('status').filter({ hasText: 'The Engineer has not calculated this estimate yet.' })).toContainText(
      'The Engineer has not calculated this estimate yet. Press Calculate to see costs.',
    );
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 0 });
    await expect(button(page)).toHaveText('Calculate');
    await waitUntilHydrated(page, '#review-calculate');

    const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/estimates/${owner.id}/recalculate`));
    await button(page).click();
    expect((await answered).status()).toBe(200);

    await expect(tiles(page).getByText(RUPEES)).toHaveCount(1);
    await expect(tiles(page).getByText(FIGURE).first()).toBeVisible();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
  });

  test("a 0 in QTY per Assy is asked about in the Lead's dialog (STORY-06.10), writes nothing and leaves the figures cleared; Go back closes it", async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await saveCanaryQuantity(owner.id, '0');
    await openAsLead(page, code, testInfo);
    await waitUntilHydrated(page, '#review-calculate');

    const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/recalculate'));
    await button(page).click();
    expect((await answered).status()).toBe(409);

    await expect(page.getByRole('alertdialog').getByRole('heading', { name: 'Check the quantity on 1 row' })).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Go back', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(button(page)).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 0 });
  });

  test("a press that the server refuses shows the server's own sentence, writes nothing and leaves the figures cleared", async ({ page }, testInfo) => {
    const { owner } = await clearedEstimate(page, testInfo);
    await waitUntilHydrated(page, '#review-calculate');
    const sentence = 'This estimate is approved and locked. Unlock it first.';
    await page.route(RECALCULATE_ROUTE, (route) =>
      route.fulfill({ status: 409, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: sentence, status: 409, code: 'ESTIMATE_APPROVED_IS_LOCKED', requestId: 'req-00000000' }) }),
    );
    await button(page).click();

    await expect(page.getByRole('alert').filter({ hasText: sentence })).toBeVisible();
    await expect(button(page)).toBeVisible();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
  });
});

test.describe('AC-9: loading', () => {
  test('while the request is under way the button is busy, a line says so and each tile shows a skeleton in place of its figure; when it ends the figures show', async ({ page }, testInfo) => {
    const { owner } = await clearedEstimate(page, testInfo);
    await waitUntilHydrated(page, '#review-calculate');
    await page.route(RECALCULATE_ROUTE, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, SLOW_MILLISECONDS));
      await route.continue();
    });

    const answered = page.waitForResponse((response) => response.url().endsWith(`/api/v1/estimates/${owner.id}/recalculate`));
    await button(page).click();
    await expect(button(page)).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByText('Calculating. This takes a moment.')).toBeVisible();
    await expect(tiles(page).locator('[data-slot="skeleton"]')).toHaveCount(3);
    for (const skeleton of await tiles(page).locator('[data-slot="skeleton"]').all()) await expect(skeleton).toBeVisible();
    expect((await answered).status()).toBe(200);

    await expect(tiles(page).getByText(RUPEES)).toHaveCount(1);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 2 });
  });
});

test.describe('AC-7 (NFR-002): an Engineer', () => {
  test('sees no figure state and no Recalculate button, and the route is the fixed 403 that holds no figure', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await saveCanaryQuantity(owner.id, CHANGED_COUNT);
    await signInAs(page, owner);
    const own = await page.goto(`/estimates/${code}`);
    expect(own?.status()).toBe(200);
    await expect(page.getByText('The total is cleared because an input changed.')).toHaveCount(0);
    await expect(page.getByText('Cleared', { exact: true })).toHaveCount(0);
    await expect(page.locator('#review-calculate')).toHaveCount(0);

    const refused = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/estimates/${id}/recalculate`, { method: 'POST' });
      return { status: response.status, body: await response.text() };
    }, owner.id);
    expect(refused.status).toBe(403);
    expect(JSON.parse(refused.body)).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(refused.body).not.toMatch(/state|totals|figures|totalPrice|nodes/);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
  });
});
