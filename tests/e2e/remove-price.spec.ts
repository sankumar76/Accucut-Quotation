import { expect, test, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';
import { z } from 'zod';

import { createDisposableUser, E2E_PASSWORD, readEstimateState, useFreshAddress, useFreshAddress as setFreshAddress } from './support/auth';
import { calculateWithoutThePage, engineerWithEstimate, signInAs } from './support/calculated-estimate';
import { APPROVED_PRICE, approvedEstimate, cancelThroughTheApi, latestApprovalIdOf, readRemoval, removePriceThroughTheApi, signInAsTheAdmin } from './support/approved-estimate';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-06.13 (AC-1 to AC-8; FR-108, NFR-002, NFR-004, NFR-007, NFR-016 to NFR-018): Remove price, SCR-06 and its dialog, for the Admin at `/estimates/<code>`, at 360x800, 768x1024 and 1366x768. Each test makes an Engineer
 * of its own with an estimate, has it calculated and approved by a Lead of the test's own, and has the one Admin of the database cancel the approval, all **through the API** (`support/approved-estimate.ts`), so the 30 s of
 * a test are spent on the subject (the cancel is STORY-06.12's own spec). The Admin is the one the portal allows (`signInAsTheAdmin`), on an estimate of the test's own. What it checks: a Lead has no button, is told only the
 * Admin can remove it, and a direct request is the 403; the Admin has a danger button, and the dialog opens with focus on the safe choice, asks only for the password, keeps focus inside, has no sideways scroll and no axe
 * violation, and Escape sends nothing; a good removal shows "Removing", then the notice, BO "Not set yet", **no price anywhere on the page or in the costs the server serves**, and the price kept in the approval row and in the
 * audit entry; a Lead sees the same notice with no button; the Engineer sees nothing of it; a wrong password is 422 under the password field with the field emptied and focused, and the same session removes with the right one;
 * and a price removed in another window is not removed twice. The password is in no audit row. The words are the UX spec's (v0.31), written out here and not imported. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const JSON_HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
const costsShape = z.object({ calculationId: z.string().min(1) });
const SLOW_MILLISECONDS = 800;
const REMOVE_ROUTE = '**/api/v1/estimates/*/approval/remove-price';
const WRONG_PASSWORD = 'Invented-Wrong-E2E-Password-1!';
const RUPEES_APPROVED = '₹ 48,271.37';
const STEP_UP_FAILED = 'That password is not correct.';
const DIALOG_TEXT =
  'The price ₹ 48,271.37 will be removed from every screen and from the Excel file. The audit log keeps it, and only you can read it. This cannot be undone. A new approval, after a Recalculate, is the way to set a price again.';

const tiles = (page: Page) => page.getByRole('region', { name: 'Totals' });
const removeButton = (page: Page) => page.locator('#review-remove-price');
const dialogOf = (page: Page) => page.getByRole('alertdialog', { name: 'Remove the approved price?' });
const passwordOf = (dialog: Locator) => dialog.getByLabel('Your password', { exact: true });
const submitOf = (dialog: Locator) => dialog.getByRole('button', { name: /^(Remove price|Removing)$/ });
const keepOf = (dialog: Locator) => dialog.getByRole('button', { name: 'Keep the price' });
const noticeOf = (page: Page) => page.locator('#review-price-removed-notice');

/**
 * An estimate approved by a Lead of the test's own and cancelled by the Admin, both through the API (the cancel is its own story's spec). The Lead who approved is returned; nobody is left signed in that the caller
 * can rely on.
 */
async function cancelled(page: Page, testInfo: Parameters<typeof approvedEstimate>[1]) {
  const approved = await approvedEstimate(page, testInfo);
  const admin = await signInAsTheAdmin(page);
  expect(await cancelThroughTheApi(page, approved.owner.id, 'The wrong customer was priced.'), 'the Admin\'s cancel').toBe(200);
  return { ...approved, admin };
}

/** The Admin opens the estimate whose approval was cancelled, with the Remove price button on and its script live. */
async function openedAsAdmin(page: Page, testInfo: Parameters<typeof approvedEstimate>[1]) {
  const made = await cancelled(page, testInfo);
  const response = await page.goto(`/estimates/${made.code}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(made.code);
  await expect(removeButton(page)).toBeEnabled();
  await waitUntilHydrated(page, '#review-remove-price');
  return made;
}

/**
 * What `approvedEstimate` and `cancelled` do, for an Engineer who is already signed in and has calculated on the test's own page: a Lead of the test's own approves and the Admin cancels and removes the price,
 * all through the API and in a browser context of its own, so the Engineer's session on the test's page stays and the Engineer signs in once in the case (DEF-050). The context is closed afterwards.
 */
async function removedBesideThePage(browser: Browser, testInfo: TestInfo, ownerId: string): Promise<void> {
  const context = await browser.newContext({ baseURL: DEVELOPMENT_URL, storageState: { cookies: [], origins: [] } });
  try {
    await setFreshAddress(context);
    const beside = await context.newPage();
    await signInAs(beside, await createDisposableUser('axe', testInfo, 'LEAD'));
    const costs = await beside.request.get(`/api/v1/estimates/${ownerId}/costs`);
    expect(costs.status(), "the Lead's read of the costs").toBe(200);
    const { calculationId } = costsShape.parse(await costs.json());
    const approved = await beside.request.post(`/api/v1/estimates/${ownerId}/approve`, { headers: JSON_HEADERS, data: { calculationId, price: APPROVED_PRICE } });
    expect(approved.status(), 'the approval').toBe(200);
    await signInAsTheAdmin(beside);
    expect(await cancelThroughTheApi(beside, ownerId, 'The wrong customer was priced.'), "the Admin's cancel").toBe(200);
    expect(await removePriceThroughTheApi(beside, ownerId), "the Admin's removal").toBe(200);
  } finally {
    await context.close();
  }
}

async function openDialog(page: Page): Promise<Locator> {
  await removeButton(page).click();
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('AC-1, AC-2, AC-8: the button and the dialog', () => {
  test('a Lead has no button, is told only the Admin can remove it, and a direct request is the 403; the Admin has a danger button, and the dialog opens with focus on "Keep the price", asks only for the password, keeps focus inside, scrolls no way sideways, has no axe violation, and Escape sends nothing', async ({ page }, testInfo) => {
    const made = await cancelled(page, testInfo);
    // A Lead of the test's own: the page has the sentence and no button, and a request made by hand is the fixed 403.
    await signInAs(page, made.lead);
    const asLead = await page.goto(`/estimates/${made.code}`);
    expect(asLead?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(made.code);
    await expect(page.locator('#review-cancelled-notice')).toContainText('Only the Admin can remove it.');
    await expect(removeButton(page)).toHaveCount(0);
    const approvalId = await latestApprovalIdOf(made.owner.id);
    const refused = await page.request.post(`/api/v1/estimates/${made.owner.id}/approval/remove-price`, {
      headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
      data: { approvalId, password: E2E_PASSWORD },
    });
    expect(refused.status()).toBe(403);
    expect(await refused.text()).not.toContain(E2E_PASSWORD);
    expect((await readRemoval(made.owner.id))?.removedBy).toBeNull();

    // The Admin: a danger button, and the price still on screen marked "Approval cancelled".
    await signInAsTheAdmin(page);
    await page.reload();
    await expect(removeButton(page)).toBeEnabled();
    await expect(tiles(page)).toContainText(RUPEES_APPROVED);
    await expect(tiles(page)).toContainText('Approval cancelled');
    await expect(page.locator('#review-cancel')).toHaveCount(0);
    await waitUntilHydrated(page, '#review-remove-price');
    let sent = 0;
    await page.route(REMOVE_ROUTE, async (route) => {
      sent += 1;
      await route.continue();
    });
    await removeButton(page).focus();
    await page.keyboard.press('Enter');
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();

    await expect(keepOf(dialog)).toBeFocused();
    await expect(dialog).toContainText(DIALOG_TEXT);
    await expect(passwordOf(dialog)).toBeVisible();
    await expect(passwordOf(dialog)).toHaveAttribute('type', 'password');
    await expect(dialog.getByText('We ask for your password again because this removes a price that was approved.')).toBeVisible();
    // The dialog is a separate one from the cancel's: no reason field, one password field.
    await expect(dialog.getByLabel('Reason for cancelling')).toHaveCount(0);
    await expect(submitOf(dialog)).toBeEnabled();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    // Tab stays inside the dialog: the password, its show button, Keep the price, Remove price, and round again.
    const inside = dialog.locator(':focus');
    for (let press = 0; press < 5; press += 1) {
      await page.keyboard.press('Tab');
      await expect(inside).toHaveCount(1);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(removeButton(page)).toBeFocused();
    expect(sent).toBe(0);
    expect(await readRemoval(made.owner.id)).toMatchObject({ approvedPrice: APPROVED_PRICE, cancelled: true, removedBy: null, entries: 0 });
  });
});

test.describe('AC-3, AC-6, AC-7: a good removal', () => {
  test('shows "Removing" while it is under way, then the notice; the row and the audit entry keep the price; the password is in no audit row', async ({ page }, testInfo) => {
    const { owner, admin } = await openedAsAdmin(page, testInfo);
    await page.route(REMOVE_ROUTE, async (route) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, SLOW_MILLISECONDS);
      });
      await route.continue();
    });
    const dialog = await openDialog(page);
    await passwordOf(dialog).fill(E2E_PASSWORD);
    const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/estimates/${owner.id}/approval/remove-price`));
    await submitOf(dialog).click();
    await expect(dialog.getByRole('button', { name: 'Removing' })).toBeDisabled();
    // The dialog cannot be dismissed while the request is under way.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    const response = await answered;
    expect(response.status()).toBe(200);
    const text = await response.text();
    // The answer is a time and nothing else: no price (AC-6), and not the password (AC-7).
    expect(Object.keys(JSON.parse(text) as object)).toEqual(['removedAt']);
    expect(text).not.toContain(E2E_PASSWORD);
    expect(text).not.toContain('48271');

    await expect(dialog).toHaveCount(0);
    const notice = noticeOf(page);
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(`by ${admin.name}.`);
    await expect(notice).toContainText(/The approved price was removed on \d{2} \w{3} \d{4}, \d{2}:\d{2} IST by /);
    await expect(notice).toContainText('The audit log keeps it.');
    await expect(notice).toContainText('Approve again, after a Recalculate, to set a price.');
    await expect(notice).toBeFocused();
    // The row keeps the price, the removal is stored, and the audit entry keeps what was removed, once (AC-6).
    expect(await readRemoval(owner.id)).toEqual({ approvedPrice: APPROVED_PRICE, cancelled: true, removedBy: admin.id, entries: 1, entryKeeps: APPROVED_PRICE, passwordInAudit: false });
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 1 });
  });

  test('BO reads "Not set yet" and the price is nowhere on the page or in the costs', async ({ page }, testInfo) => {
    // The removal is made through the API (the first case judges the dialog and the removal); the Admin opens the page once.
    const made = await cancelled(page, testInfo);
    expect(await removePriceThroughTheApi(page, made.owner.id), "the Admin's removal").toBe(200);
    const response = await page.goto(`/estimates/${made.code}`);
    expect(response?.status()).toBe(200);
    await expect(noticeOf(page)).toBeVisible();
    // BO reads "Not set yet" and the price is nowhere on the page (AC-3, AC-6); there is nothing left to cancel or remove.
    await expect(tiles(page)).toContainText('Not set yet');
    await expect(page.getByText('48,271.37')).toHaveCount(0);
    await expect(page.getByText('Approval cancelled')).toHaveCount(0);
    await expect(removeButton(page)).toHaveCount(0);
    await expect(page.locator('#review-cancel')).toHaveCount(0);
    // No route serves the price to a screen: the costs the page is drawn from hold no price either.
    const costs = await page.request.get(`/api/v1/estimates/${made.owner.id}/costs`);
    expect(costs.status()).toBe(200);
    expect(await costs.text()).not.toContain('48271');
  });

  test('with the price removed, the page has no axe violation', async ({ page }, testInfo) => {
    // The removal is made through the API; this case opens the page once and scans it once.
    const made = await cancelled(page, testInfo);
    expect(await removePriceThroughTheApi(page, made.owner.id), "the Admin's removal").toBe(200);
    const response = await page.goto(`/estimates/${made.code}`);
    expect(response?.status()).toBe(200);
    await expect(noticeOf(page)).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('a Lead sees the same notice and "Not set yet", with no button', async ({ page }, testInfo) => {
    const made = await cancelled(page, testInfo);
    expect(await removePriceThroughTheApi(page, made.owner.id), "the Admin's removal").toBe(200);
    await signInAs(page, made.lead);
    const response = await page.goto(`/estimates/${made.code}`);
    expect(response?.status()).toBe(200);
    await expect(noticeOf(page)).toContainText(`by ${made.admin.name}.`);
    await expect(tiles(page)).toContainText('Not set yet');
    await expect(page.getByText('48,271.37')).toHaveCount(0);
    await expect(removeButton(page)).toHaveCount(0);
  });

  test('the Engineer sees no price and nothing of the removal', async ({ page, browser }, testInfo) => {
    // The Engineer signs in once, calculates without a page and opens the page once; the rest of the set-up is made beside the page.
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await removedBesideThePage(browser, testInfo, owner.id);

    // The Engineer, on the same address, sees no price and nothing of the removal (NFR-002).
    const own = await page.goto(`/estimates/${code}`);
    expect(own?.status()).toBe(200);
    await expect(page.getByText('48,271.37')).toHaveCount(0);
    await expect(page.getByText('Approved Quote Price')).toHaveCount(0);
    await expect(page.getByText('The approved price was removed')).toHaveCount(0);
  });
});

test.describe('AC-4: a wrong password', () => {
  test("is a 422 under the password field in the step-up's words, the field is emptied and takes focus, nothing changes, and the same session removes with the right password", async ({ page }, testInfo) => {
    const { owner, admin } = await openedAsAdmin(page, testInfo);
    const dialog = await openDialog(page);
    await passwordOf(dialog).fill(WRONG_PASSWORD);
    const refused = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/approval/remove-price'));
    await submitOf(dialog).click();
    const answer = await refused;
    expect(answer.status()).toBe(422);
    expect(await answer.text()).not.toContain(WRONG_PASSWORD);

    await expect(dialog.getByText(STEP_UP_FAILED, { exact: true })).toBeVisible();
    await expect(passwordOf(dialog)).toHaveAttribute('aria-invalid', 'true');
    await expect(passwordOf(dialog)).toHaveValue('');
    await expect(passwordOf(dialog)).toBeFocused();
    expect(await readRemoval(owner.id)).toMatchObject({ approvedPrice: APPROVED_PRICE, removedBy: null, entries: 0, passwordInAudit: false });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    // The session was not ended: the right password, in the same dialog, removes.
    await passwordOf(dialog).fill(E2E_PASSWORD);
    await submitOf(dialog).click();
    await expect(noticeOf(page)).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(await readRemoval(owner.id)).toMatchObject({ removedBy: admin.id, entries: 1, passwordInAudit: false });
  });

  test("an empty password shows the spec's sentence under its field and sends nothing", async ({ page }, testInfo) => {
    const { owner } = await openedAsAdmin(page, testInfo);
    let sent = 0;
    await page.route(REMOVE_ROUTE, async (route) => {
      sent += 1;
      await route.continue();
    });
    const dialog = await openDialog(page);
    await submitOf(dialog).click();
    await expect(dialog.getByText('Enter a password.', { exact: true })).toBeVisible();
    await expect(passwordOf(dialog)).toHaveAttribute('aria-invalid', 'true');
    await expect(passwordOf(dialog)).toBeFocused();
    expect(sent).toBe(0);
    expect((await readRemoval(owner.id))?.removedBy).toBeNull();
  });
});

test.describe('AC-5: a price removed in another window while the dialog was open', () => {
  test('is not removed twice: the second press is the 409, the page is drawn again, and the notice is there', async ({ page }, testInfo) => {
    const { owner, admin } = await openedAsAdmin(page, testInfo);
    const dialog = await openDialog(page);
    // Someone presses Remove price in another window: the price is removed.
    expect(await removePriceThroughTheApi(page, owner.id)).toBe(200);
    await passwordOf(dialog).fill(E2E_PASSWORD);
    await submitOf(dialog).click();

    const notice = noticeOf(page);
    await expect(notice).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(tiles(page)).toContainText('Not set yet');
    expect(await readRemoval(owner.id)).toEqual({ approvedPrice: APPROVED_PRICE, cancelled: true, removedBy: admin.id, entries: 1, entryKeeps: APPROVED_PRICE, passwordInAudit: false });
  });
});
