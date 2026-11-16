import { expect, test, type Locator, type Page } from '@playwright/test';

import { readEstimateState, saveCanaryQuantity, useFreshAddress } from './support/auth';
import { calculateAsEngineer, engineerWithEstimate, signInAs, signInAsLead } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';

/**
 * STORY-06.06 (AC-1, AC-2, AC-4, AC-5, AC-8; FR-062, NFR-002, NFR-016 to NFR-018): Approve and lock, SCR-06 and SCR-08, for a Lead at `/estimates/<code>`, at 360x800, 768x1024 and 1366x768. Each test makes an
 * Engineer of its own with an estimate (the recipe of the confidentiality scan), has the Engineer calculate it through the portal, and opens the same address as a Lead. What it checks: the dialog opens from the
 * enabled button with the field set to the calculated total and focus on it, a price that is not rupees shows the spec's sentence and sends nothing, Escape closes the dialog and gives focus back, the "Approving"
 * state, a good approval (the page shows the approved state, BO, Unlock in place of Approve, and focus on the notice), the two states of a page that went out of date while the dialog was open ("Estimate changed
 * while open" and "Figures recalculated while open", in the UX spec's words), what the Engineer sees afterwards ("Approved and locked." and no price), and no sideways scroll and no axe violation with the dialog
 * open. The words are the UX spec's (v0.30), written out here and not imported. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const CHANGED_COUNT = '7';
const SLOW_MILLISECONDS = 800;
const APPROVE_ROUTE = '**/api/v1/estimates/*/approve';
const RUPEES = /^₹ [\d,]+\.\d{2}$/;
const PRICE_MESSAGE = 'Enter a price in rupees, 0 or more, with up to 2 decimals.';
const OUT_OF_DATE_ALERT = 'An input changed while this window was open. The total is cleared, so nothing was approved. Press Recalculate, then approve and lock again.';
const RECALCULATED_ALERT = 'The figures were calculated again after this page was loaded, so nothing was approved. Show the new figures and check the total before you approve.';

const tiles = (page: Page) => page.getByRole('region', { name: 'Totals' });
const approveButton = (page: Page) => page.locator('#review-approve');
const dialogOf = (page: Page) => page.getByRole('dialog', { name: 'Approve and lock' });
const priceField = (page: Page) => dialogOf(page).locator('#approve-price');
const submitOf = (page: Page) => dialogOf(page).getByRole('button', { name: /^(Approve and lock|Approving)$/ });

/** A calculated estimate opened as a Lead, with the figures current and Approve and lock on. */
async function openedAsLead(page: Page, testInfo: Parameters<typeof signInAsLead>[1]) {
  const { owner, code } = await engineerWithEstimate(testInfo);
  await calculateAsEngineer(page, owner, code);
  await signInAsLead(page, testInfo);
  const response = await page.goto(`/estimates/${code}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
  await expect(approveButton(page)).toBeEnabled();
  await waitUntilHydrated(page, '#review-approve');
  return { owner, code };
}

/** The calculated total as the BL tile shows it, without the rupee sign and the grouping: what the field starts as. */
async function totalOnTheTile(page: Page): Promise<string> {
  const text = await tiles(page).getByText(RUPEES).first().innerText();
  return text.replace('₹ ', '').replaceAll(',', '');
}

async function openDialog(page: Page): Promise<Locator> {
  await approveButton(page).click();
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('AC-1: the dialog', () => {
  test('opens from the enabled button with the field set to the calculated total and focus on it, and says what an override is', async ({ page }, testInfo) => {
    await openedAsLead(page, testInfo);
    const total = await totalOnTheTile(page);
    const dialog = await openDialog(page);

    await expect(priceField(page)).toHaveValue(total);
    await expect(priceField(page)).toBeFocused();
    await expect(dialog).toContainText('Approved Quote Price');
    await expect(dialog).toContainText('If you change the price, the difference is recorded as an override. You can add a reason for it; the reason is optional.');
    await expect(submitOf(page)).toBeEnabled();
  });

  test('a price that is not rupees shows the spec\'s sentence under the field, sends nothing, and keeps what was typed; Escape closes and gives focus back', async ({ page }, testInfo) => {
    const { owner } = await openedAsLead(page, testInfo);
    let sent = 0;
    await page.route(APPROVE_ROUTE, async (route) => {
      sent += 1;
      await route.continue();
    });
    await openDialog(page);
    await priceField(page).fill('12.345');
    await submitOf(page).click();

    await expect(dialogOf(page).getByText(PRICE_MESSAGE)).toBeVisible();
    await expect(priceField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(priceField(page)).toHaveValue('12.345');
    await expect(priceField(page)).toBeFocused();
    expect(sent).toBe(0);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });

    await page.keyboard.press('Escape');
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(approveButton(page)).toBeFocused();
  });
});

test.describe('AC-8: the dialog at this width', () => {
  test('is keyboard operable, has no sideways scroll and no axe violation, and shows "Approving" while the request is under way', async ({ page }, testInfo) => {
    const { owner } = await openedAsLead(page, testInfo);
    await page.route(APPROVE_ROUTE, async (route) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, SLOW_MILLISECONDS);
      });
      await route.continue();
    });
    await approveButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(dialogOf(page)).toBeVisible();
    await expect(priceField(page)).toBeFocused();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    // Tab stays inside the dialog: price, Cancel, Approve and lock, and round again.
    const inside = dialogOf(page).locator(':focus');
    for (let press = 0; press < 5; press += 1) {
      await page.keyboard.press('Tab');
      await expect(inside).toHaveCount(1);
    }

    await priceField(page).focus();
    await page.keyboard.press('Enter');
    await expect(dialogOf(page).getByRole('button', { name: 'Approving' })).toBeDisabled();
    // The dialog cannot be dismissed while the request is under way.
    await page.keyboard.press('Escape');
    await expect(dialogOf(page)).toBeVisible();
    await expect(page.locator('#review-approved-notice')).toBeVisible();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'APPROVED', calculations: 1 });
  });
});

test.describe('AC-2, AC-5: a good approval', () => {
  test('locks the estimate: the page shows the approved state with BO, Unlock in place of Approve and lock, and focus on the notice; the Engineer then sees "Approved and locked." and no price', async ({ page }, testInfo) => {
    const { owner, code } = await openedAsLead(page, testInfo);
    await openDialog(page);
    await priceField(page).fill('48271.37');
    const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/estimates/${owner.id}/approve`));
    await submitOf(page).click();
    const response = await answered;
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'APPROVED', approvedPrice: '48271.37' });

    await expect(dialogOf(page)).toHaveCount(0);
    const notice = page.locator('#review-approved-notice');
    await expect(notice).toContainText('Approved and locked on');
    await expect(notice).toContainText('Locked. Values stay as approved even if rates change later.');
    await expect(notice).toContainText('Only the Admin can cancel an approval.');
    await expect(notice).toBeFocused();
    await expect(tiles(page)).toContainText('₹ 48,271.37');
    await expect(tiles(page)).toContainText('Approved by');
    await expect(approveButton(page)).toHaveCount(0);
    await expect(page.locator('#review-unlock')).toBeDisabled();
    await expect(page.locator('#review-download')).toBeDisabled();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'APPROVED', calculations: 1 });

    // The Engineer, on the same address, is told it is approved and locked and sees no price (NFR-002).
    await signInAs(page, owner);
    const own = await page.goto(`/estimates/${code}`);
    expect(own?.status()).toBe(200);
    await expect(page.getByText('Approved and locked.', { exact: true })).toBeVisible();
    await expect(page.getByText('48,271.37')).toHaveCount(0);
    await expect(page.getByText('Approved Quote Price')).toHaveCount(0);
    await expect(page.locator('#calculate-button')).toHaveCount(0);
  });
});

test.describe('the page changed while the dialog was open', () => {
  test('an input changed (409 TOTALS_OUT_OF_DATE): the spec\'s alert, Approve and lock off, "Recalculate first" in place of Cancel, and nothing approved', async ({ page }, testInfo) => {
    const { owner } = await openedAsLead(page, testInfo);
    await openDialog(page);
    await saveCanaryQuantity(owner.id, CHANGED_COUNT);
    await submitOf(page).click();

    await expect(dialogOf(page).getByRole('alert').filter({ hasText: OUT_OF_DATE_ALERT })).toBeVisible();
    await expect(submitOf(page)).toBeDisabled();
    await expect(dialogOf(page).getByRole('button', { name: 'Cancel' })).toHaveCount(0);
    const wayOn = dialogOf(page).getByRole('button', { name: 'Recalculate first' });
    await expect(wayOn).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });

    await wayOn.click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'The total is cleared because an input changed.' })).toBeVisible();
    await expect(page.locator('#review-calculate')).toHaveText('Recalculate');
    await expect(approveButton(page)).toBeDisabled();
  });

  test('the figures were calculated again (409 CALCULATION_CHANGED): the alert in the spec\'s words, "Show the new figures" has focus, and the next dialog starts from the new total', async ({ page }, testInfo) => {
    const { owner } = await openedAsLead(page, testInfo);
    await openDialog(page);
    // Someone presses Recalculate in another tab: the estimate stays Submitted with a newer calculation.
    const recalculated = await page.evaluate(async (id) => (await fetch(`/api/v1/estimates/${id}/recalculate`, { method: 'POST' })).status, owner.id);
    expect(recalculated).toBe(200);
    await priceField(page).fill('1.00');
    await submitOf(page).click();

    await expect(dialogOf(page).getByRole('alert').filter({ hasText: RECALCULATED_ALERT })).toBeVisible();
    await expect(submitOf(page)).toBeDisabled();
    const wayOn = dialogOf(page).getByRole('button', { name: 'Show the new figures' });
    await expect(wayOn).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 2 });

    await wayOn.click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page.locator('#review-calculated')).toBeFocused();

    // The new dialog is a new one: the field starts as the total again, and the price typed before is not kept. The page is drawn again first, so the dialog names the new calculation.
    await page.waitForLoadState('networkidle');
    await waitUntilHydrated(page, '#review-approve');
    const total = await totalOnTheTile(page);
    await openDialog(page);
    await expect(priceField(page)).toHaveValue(total);
    await submitOf(page).click();
    await expect(page.locator('#review-approved-notice')).toBeVisible();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'APPROVED', calculations: 2 });
  });
});
