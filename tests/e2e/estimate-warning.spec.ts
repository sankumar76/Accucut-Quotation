import { expect, test, type Page, type Response } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { defined } from '../support/defined';

import { makeCanaryEstimateCalculable, readEstimateState, saveCanaryQuantity, setCanaryQuantity, useFreshAddress } from './support/auth';
import { horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { ALPHA_MATERIAL, control, expectFormAccessible, openForm, partForm } from './support/part-form';

/**
 * STORY-05.12 T5 (AC-6, AC-9; UX-36; FR-104): the quantity warning on SCR-05 for an Engineer, at 360x800, 768x1024 and 1366x768 on the development server. Each test signs in as a person of its own
 * with a complete draft whose one part has 0 in QTY per Assy. The first press is answered with the 409 and the alert dialog "Check the quantity on 1 row" opens with focus on "Go back"; "Go back" and
 * Escape change nothing and leave the estimate a draft; a row's link takes the person to its field; "Calculate anyway" turns the page to "Submitted" with the one message; a list that changed in between
 * is shown with the words that say so and nothing is calculated; axe finds 0 violations with the dialog open; all of it by keyboard alone. The words are the UX spec's and the story's, written out
 * here and not imported, so a changed sentence fails a test. What the database holds is judged in `tests/integration/calc/warn.test.ts`. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const SENTENCE = 'Cost will be calculated based on the input fields and sent for review/approval.';
const DIALOG_TITLE = 'Check the quantity on 1 row';
const DIALOG_DESCRIPTION = 'You can go back and change the count, or go ahead.';
const ROW_LINE = 'QTY per Assy is 0 on 1 Invented text. That row will cost 0 in this estimate.';
const CHANGED = 'The list changed. Something changed after you pressed Calculate, so this is the new list. Check it again.';
const ALPHA_CUSTOMER_ID = defined(CUSTOMER_CANARIES[0]).id;

const calculateButton = (page: Page) => page.locator('#calculate-button');
const dialog = (page: Page) => page.getByRole('alertdialog');
const goBack = (page: Page) => dialog(page).getByRole('button', { name: 'Go back', exact: true });
const goAhead = (page: Page) => dialog(page).getByRole('button', { name: 'Calculate anyway', exact: true });
const isCalculate = (response: Response): boolean => response.request().method() === 'POST' && /\/api\/v1\/estimates\/[^/]+\/calculate$/.test(new URL(response.url()).pathname);

/** Opens the workspace with a complete part that has 0 in QTY per Assy, as the database now has it. */
async function openWarned(page: Page, testInfo: Parameters<typeof openForm>[1]): Promise<{ readonly id: string }> {
  const owner = await openForm(page, testInfo);
  await makeCanaryEstimateCalculable(owner.id, ALPHA_MATERIAL.id, ALPHA_CUSTOMER_ID);
  await setCanaryQuantity(owner.id, '0');
  await page.reload();
  await expect(partForm(page)).toBeVisible();
  await expect(control(page, 'E')).toBeEnabled();
  return owner;
}

/** Presses Calculate with the mouse and waits for the answer. A press before the page has its scripts does nothing (the early tap, DEF-013), so the button is waited for first. */
async function pressAndExpectWarning(page: Page): Promise<void> {
  await waitUntilHydrated(page, '#calculate-button', 'onClick');
  const answered = page.waitForResponse(isCalculate);
  await calculateButton(page).click();
  expect((await answered).status()).toBe(409);
  await expect(dialog(page)).toBeVisible();
}

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  expect(await horizontalOverflow(page), 'the page scrolls sideways').toBeLessThanOrEqual(0);
}

test.describe('AC-6: the dialog names the row and offers the two choices', () => {
  test('AC-6: the first press opens "Check the quantity on 1 row" with the sentence, the row as a link, "Go back" and "Calculate anyway", and writes nothing', async ({ page }, testInfo) => {
    const owner = await openWarned(page, testInfo);
    await pressAndExpectWarning(page);

    await expect(dialog(page).getByRole('heading', { name: DIALOG_TITLE })).toBeVisible();
    await expect(dialog(page)).toContainText(DIALOG_DESCRIPTION);
    await expect(dialog(page).getByRole('link', { name: ROW_LINE })).toBeVisible();
    await expect(goBack(page)).toBeVisible();
    await expect(goAhead(page)).toBeVisible();
    await expect(dialog(page)).not.toContainText(CHANGED);
    // The warning says nothing about rates, prices or formulas.
    expect((await dialog(page).innerText()).toLowerCase()).not.toMatch(/rate|price|formula/);

    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 0 });
    await expect(page.locator('[data-slot="status-badge"]').first()).toContainText('Draft');
  });

  test('AC-6: "Go back" closes the dialog, changes nothing, leaves the estimate a draft and puts focus back on Calculate', async ({ page }, testInfo) => {
    const owner = await openWarned(page, testInfo);
    await pressAndExpectWarning(page);
    await goBack(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(calculateButton(page)).toBeFocused();
    await expect(calculateButton(page)).toHaveText('Calculate');
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 0 });
  });

  test('AC-6: a row\'s link takes the person to its QTY per Assy field, and nothing is calculated', async ({ page }, testInfo) => {
    const owner = await openWarned(page, testInfo);
    await pressAndExpectWarning(page);
    await dialog(page).getByRole('link', { name: ROW_LINE }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(control(page, 'H')).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 0 });
  });

  test('AC-6: "Calculate anyway" answers exactly {status, message} and turns the page to "Submitted" with the one message', async ({ page }, testInfo) => {
    const owner = await openWarned(page, testInfo);
    await pressAndExpectWarning(page);
    const answered = page.waitForResponse(isCalculate);
    await goAhead(page).click();
    const response = await answered;
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'SUBMITTED', message: SENTENCE });

    await expect(dialog(page)).toHaveCount(0);
    const notice = page.locator('[data-calculate-submitted]');
    await expect(notice).toBeFocused();
    await expect(notice).toContainText(SENTENCE);
    await expect(page.locator('[data-slot="status-badge"]').first()).toContainText('Submitted');
    await expect(calculateButton(page)).toBeDisabled();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
  });

  test('AC-6 (AC-4): when something changed after the 409, "Calculate anyway" shows the new list with the words that say so, and nothing is calculated; the next press goes through', async ({ page }, testInfo) => {
    const owner = await openWarned(page, testInfo);
    await pressAndExpectWarning(page);
    // A save from another tab: the revision goes up, so the acknowledgement the dialog holds is stale.
    await saveCanaryQuantity(owner.id, '0');
    const asked = page.waitForResponse(isCalculate);
    await goAhead(page).click();
    expect((await asked).status()).toBe(409);
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toContainText(CHANGED);
    await expect(dialog(page).getByRole('link', { name: ROW_LINE })).toBeVisible();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 0 });

    const answered = page.waitForResponse(isCalculate);
    await goAhead(page).click();
    expect((await answered).status()).toBe(200);
    await expect(calculateButton(page)).toHaveText('Submitted');
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
  });
});

test.describe('AC-9: keyboard, focus and accessibility', () => {
  test('AC-9: by keyboard alone: Enter on Calculate opens the dialog with focus on "Go back"; Escape closes it with nothing sent; the next Enter and Tab to "Calculate anyway" submit', async ({ page }, testInfo) => {
    const owner = await openWarned(page, testInfo);
    await waitUntilHydrated(page, '#calculate-button', 'onClick');
    await calculateButton(page).focus();
    const asked = page.waitForResponse(isCalculate);
    await page.keyboard.press('Enter');
    expect((await asked).status()).toBe(409);
    await expect(dialog(page)).toBeVisible();
    // Focus starts on the safe choice.
    await expect(goBack(page)).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(calculateButton(page)).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 0 });

    const askedAgain = page.waitForResponse(isCalculate);
    await page.keyboard.press('Enter');
    expect((await askedAgain).status()).toBe(409);
    await expect(goBack(page)).toBeFocused();
    // The focus stays inside the dialog: Tab goes from "Go back" to "Calculate anyway" (the row link comes before them in the order of the page).
    await page.keyboard.press('Tab');
    await expect(goAhead(page)).toBeFocused();
    const answered = page.waitForResponse(isCalculate);
    await page.keyboard.press('Enter');
    expect((await answered).status()).toBe(200);
    await expect(page.locator('[data-calculate-submitted]')).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
  });

  test('AC-9: axe finds 0 violations with the dialog open and in the list that changed, and the page does not scroll sideways', async ({ page }, testInfo) => {
    const owner = await openWarned(page, testInfo);
    await pressAndExpectWarning(page);
    await expectFormAccessible(page);
    await expectNoSidewaysScroll(page);

    await saveCanaryQuantity(owner.id, '0');
    const asked = page.waitForResponse(isCalculate);
    await goAhead(page).click();
    expect((await asked).status()).toBe(409);
    await expect(dialog(page)).toContainText(CHANGED);
    await expectFormAccessible(page);
    await expectNoSidewaysScroll(page);
  });
});
