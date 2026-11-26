import { expect, test, type Locator, type Page } from '@playwright/test';

import { E2E_PASSWORD, readEstimateState, useFreshAddress } from './support/auth';
import { signInAs } from './support/calculated-estimate';
import { APPROVED_PRICE, approvedEstimate, cancelThroughTheApi, latestApprovalIdOf, readCancel, signInAsTheAdmin, unlockThroughTheApi } from './support/approved-estimate';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-06.12 (AC-1 to AC-10; FR-107, NFR-002, NFR-004, NFR-007, NFR-016 to NFR-018): Cancel approval, SCR-06 and its dialog, for the Admin at `/estimates/<code>`, at 360x800, 768x1024 and 1366x768. Each test makes an
 * Engineer of its own with an estimate and has it calculated and approved **through the API** (`support/approved-estimate.ts`), so the 30 s of a test are spent on the subject. The cancels are made by the one Admin of the database
 * (`signInAsTheAdmin`: the portal allows one active Admin, so a test cannot make an Admin of its own), on an estimate of the test's own; the audit screen's tests that filter on Who = E2E Admin use an event no spec writes. What it checks: the Admin has a danger button beside Unlock and a Lead has none and is told who
 * can (and a Lead's direct request is the 403); the dialog opens with focus on the safe choice, asks for a reason and the password with the spec's hints, keeps focus inside, has no sideways scroll and no axe violation,
 * and Escape sends nothing; a good cancel shows "Cancelling", then the notice (who, when, why, the Draft and the queue), BO marked "Approval cancelled", and a Lead sees the same with no button; the Engineer sees no price;
 * a wrong password is 422 under the password field with the field emptied and focused, and the same session cancels with the right one; an approval kept through an unlock is cancelled with the Draft staying a Draft;
 * a deleted customer stops the dialog with the server's sentence; and an approval cancelled in another window is not cancelled twice. The password is in no audit row. The words are the UX spec's (v0.31), written out
 * here and not imported. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const SLOW_MILLISECONDS = 800;
const CANCEL_ROUTE = '**/api/v1/estimates/*/approval/cancel';
const REASON = 'The wrong customer was priced.';
const WRONG_PASSWORD = 'Invented-Wrong-E2E-Password-1!';
const RUPEES_APPROVED = '₹ 48,271.37';
const CUSTOMER_DELETED = 'The customer chosen for this estimate was deleted, so the approval cannot be cancelled. The approval was not changed.';
const STEP_UP_FAILED = 'That password is not correct.';

const tiles = (page: Page) => page.getByRole('region', { name: 'Totals' });
const cancelButton = (page: Page) => page.locator('#review-cancel');
const dialogOf = (page: Page, code: string) => page.getByRole('alertdialog', { name: `Cancel the approval of ${code}?` });
const reasonOf = (dialog: Locator) => dialog.getByLabel('Reason for cancelling');
const passwordOf = (dialog: Locator) => dialog.getByLabel('Your password', { exact: true });
const submitOf = (dialog: Locator) => dialog.getByRole('button', { name: /^(Cancel approval|Cancelling)$/ });
const keepOf = (dialog: Locator) => dialog.getByRole('button', { name: 'Keep the approval' });
const noticeOf = (page: Page) => page.locator('#review-cancelled-notice');

/** An estimate approved through the API by a Lead of the test's own, then opened as an Admin of the test's own, with the Cancel approval button on and its script live. */
async function openedAsAdmin(page: Page, testInfo: Parameters<typeof approvedEstimate>[1], beforeOpening?: (approved: Awaited<ReturnType<typeof approvedEstimate>>) => Promise<void>) {
  const approved = await approvedEstimate(page, testInfo);
  if (beforeOpening !== undefined) await beforeOpening(approved);
  const admin = await signInAsTheAdmin(page);
  const response = await page.goto(`/estimates/${approved.code}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Estimate ${approved.code}`);
  await expect(cancelButton(page)).toBeEnabled();
  await waitUntilHydrated(page, '#review-cancel');
  return { ...approved, admin };
}

async function openDialog(page: Page, code: string): Promise<Locator> {
  await cancelButton(page).click();
  const dialog = dialogOf(page, code);
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * An estimate approved through the API by a Lead of the test's own and then cancelled through the API by the Admin, with the Admin signed in when this returns. It is the world the views of a cancelled approval start
 * from (AC-6, AC-7), so the Lead's case and the Engineer's case spend their 30 s on the view and not on a second cancel through the dialog, which the Admin's case makes (DEF-084).
 */
async function cancelledByTheAdmin(page: Page, testInfo: Parameters<typeof approvedEstimate>[1]) {
  const approved = await approvedEstimate(page, testInfo);
  const admin = await signInAsTheAdmin(page);
  expect(await cancelThroughTheApi(page, approved.owner.id, REASON), 'the Admin\'s cancel').toBe(200);
  return { ...approved, admin };
}

test.describe('AC-1, AC-2, AC-8: the button and the dialog', () => {
  test('a Lead has no button and is told who can, and a direct request is the 403; the Admin has a danger button beside Unlock, and the dialog opens with focus on "Keep the approval", asks for the reason and the password, keeps focus inside, scrolls no way sideways, has no axe violation, and Escape sends nothing', async ({ page }, testInfo) => {
    const approved = await approvedEstimate(page, testInfo);
    // The Lead who approved is signed in: the page has the line and no button, and a request made by hand is the fixed 403.
    const asLead = await page.goto(`/estimates/${approved.code}`);
    expect(asLead?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Estimate ${approved.code}`);
    await expect(page.getByText('Only the Admin can cancel an approval.')).toBeVisible();
    await expect(cancelButton(page)).toHaveCount(0);
    const approvalId = await latestApprovalIdOf(approved.owner.id);
    const refused = await page.request.post(`/api/v1/estimates/${approved.owner.id}/approval/cancel`, {
      headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
      data: { approvalId, reason: REASON, password: E2E_PASSWORD },
    });
    expect(refused.status()).toBe(403);
    expect(await refused.text()).not.toContain(E2E_PASSWORD);
    expect(await readEstimateState(approved.owner.id)).toEqual({ status: 'APPROVED', calculations: 1 });

    // The Admin: a danger button beside Unlock.
    await signInAsTheAdmin(page);
    await page.reload();
    await expect(cancelButton(page)).toBeEnabled();
    await expect(page.locator('#review-unlock')).toBeVisible();
    await waitUntilHydrated(page, '#review-cancel');
    let sent = 0;
    await page.route(CANCEL_ROUTE, async (route) => {
      sent += 1;
      await route.continue();
    });
    await cancelButton(page).focus();
    await page.keyboard.press('Enter');
    const dialog = dialogOf(page, approved.code);
    await expect(dialog).toBeVisible();

    await expect(keepOf(dialog)).toBeFocused();
    await expect(dialog).toContainText('The estimate goes back to Draft and the task returns to');
    await expect(dialog).toContainText(`${approved.owner.name}'s Open queue, as it does when it is unlocked.`);
    await expect(dialog).toContainText('The approved price stays on screen, marked "Approval cancelled", until you remove it. Neither step can be undone.');
    await expect(reasonOf(dialog)).toBeVisible();
    await expect(reasonOf(dialog)).toHaveJSProperty('required', true);
    await expect(dialog.getByText('It is kept in the audit log.')).toBeVisible();
    await expect(passwordOf(dialog)).toBeVisible();
    await expect(passwordOf(dialog)).toHaveAttribute('type', 'password');
    await expect(dialog.getByText('We ask for your password again because this changes a price that was approved.')).toBeVisible();
    await expect(submitOf(dialog)).toBeEnabled();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    // Tab stays inside the dialog: the reason, the password, its show button, Keep the approval, Cancel approval, and round again.
    const inside = dialog.locator(':focus');
    for (let press = 0; press < 6; press += 1) {
      await page.keyboard.press('Tab');
      await expect(inside).toHaveCount(1);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(cancelButton(page)).toBeFocused();
    expect(sent).toBe(0);
    expect(await readEstimateState(approved.owner.id)).toEqual({ status: 'APPROVED', calculations: 1 });
    expect((await readCancel(approved.owner.id))?.cancelledBy).toBeNull();
  });
});

test.describe('AC-3, AC-6, AC-7: a good cancel', () => {
  test('the Admin\'s cancel shows "Cancelling" while it is under way, then the Draft with the notice, BO "Approval cancelled", Recalculate and Approve off; the password is in no audit row', async ({ page }, testInfo) => {
    const { code, owner, admin } = await openedAsAdmin(page, testInfo);
    await page.route(CANCEL_ROUTE, async (route) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, SLOW_MILLISECONDS);
      });
      await route.continue();
    });
    const dialog = await openDialog(page, code);
    await reasonOf(dialog).fill(`  ${REASON}  `);
    await passwordOf(dialog).fill(E2E_PASSWORD);
    const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/estimates/${owner.id}/approval/cancel`));
    await submitOf(dialog).click();
    await expect(dialog.getByRole('button', { name: 'Cancelling' })).toBeDisabled();
    // The dialog cannot be dismissed while the request is under way.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    const response = await answered;
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(Object.keys(JSON.parse(text) as object).sort()).toEqual(['cancelledAt', 'status']);
    expect(text).not.toContain(E2E_PASSWORD);

    await expect(dialog).toHaveCount(0);
    const notice = noticeOf(page);
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(`by ${admin.name}.`);
    await expect(notice).toContainText(/Approval cancelled on \d{2} \w{3} \d{4}, \d{2}:\d{2} IST by /);
    await expect(notice).toContainText(`Reason: ${REASON}`);
    await expect(notice).toContainText(`The estimate is a Draft and the task is back in ${owner.name}'s Open queue.`);
    await expect(notice).toContainText('The price stays on screen, marked "Approval cancelled", and is not in the Excel file.');
    await expect(notice).toBeFocused();
    // BO is the price, marked "Approval cancelled"; Approve is off until the figures are made again; Recalculate is the way on.
    await expect(tiles(page)).toContainText(RUPEES_APPROVED);
    await expect(tiles(page)).toContainText('Approval cancelled');
    await expect(page.locator('#review-approve')).toBeDisabled();
    await expect(page.locator('#review-calculate')).toHaveText('Recalculate');
    await expect(cancelButton(page)).toHaveCount(0);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 1 });
    expect(await readCancel(owner.id)).toEqual({ approvedPrice: APPROVED_PRICE, cancelledBy: admin.id, reason: REASON, unlocked: false, entries: 1, passwordInAudit: false });
    // STORY-07.07: Download is now the link (no reason line under it), so the page is shorter and the focused notice leaves the folder link half behind the sticky top bar at 768 px. The scan reads the page where it stands, so it is made from the top, as after a page load (the same step as insert-field.spec.ts).
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoAxeViolations(page);
  });

  test('AC-6: a Lead sees the same, with no button, and is told only the Admin can remove it', async ({ page }, testInfo) => {
    const { code, lead, admin } = await cancelledByTheAdmin(page, testInfo);
    await signInAs(page, lead);
    await page.goto(`/estimates/${code}`);
    await expect(noticeOf(page)).toContainText(`by ${admin.name}.`);
    await expect(noticeOf(page)).toContainText('Only the Admin can remove it.');
    await expect(tiles(page)).toContainText('Approval cancelled');
    await expect(cancelButton(page)).toHaveCount(0);
  });

  test('AC-7 (NFR-002): the Engineer finds the estimate editable again and sees no price', async ({ page }, testInfo) => {
    const { code, owner } = await cancelledByTheAdmin(page, testInfo);
    await signInAs(page, owner);
    const own = await page.goto(`/estimates/${code}`);
    expect(own?.status()).toBe(200);
    await expect(page.locator('#calculate-button')).toHaveText('Calculate');
    await expect(page.getByText('48,271.37')).toHaveCount(0);
    await expect(page.getByText('Approved Quote Price')).toHaveCount(0);
    await expect(page.getByText('Approval cancelled')).toHaveCount(0);
  });
});

test.describe('AC-4: a wrong password', () => {
  test('is a 422 under the password field in the step-up\'s words, the field is emptied and takes focus, the reason is kept, nothing changes, and the same session cancels with the right password', async ({ page }, testInfo) => {
    const { code, owner, admin } = await openedAsAdmin(page, testInfo);
    const dialog = await openDialog(page, code);
    await reasonOf(dialog).fill(REASON);
    await passwordOf(dialog).fill(WRONG_PASSWORD);
    const refused = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/approval/cancel'));
    await submitOf(dialog).click();
    const answer = await refused;
    expect(answer.status()).toBe(422);
    expect(await answer.text()).not.toContain(WRONG_PASSWORD);

    await expect(dialog.getByText(STEP_UP_FAILED, { exact: true })).toBeVisible();
    await expect(passwordOf(dialog)).toHaveAttribute('aria-invalid', 'true');
    await expect(passwordOf(dialog)).toHaveValue('');
    await expect(passwordOf(dialog)).toBeFocused();
    await expect(reasonOf(dialog)).toHaveValue(REASON);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'APPROVED', calculations: 1 });
    expect(await readCancel(owner.id)).toMatchObject({ cancelledBy: null, entries: 0, passwordInAudit: false });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    // The session was not ended: the right password, in the same dialog, cancels.
    await passwordOf(dialog).fill(E2E_PASSWORD);
    await submitOf(dialog).click();
    await expect(noticeOf(page)).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(await readCancel(owner.id)).toMatchObject({ cancelledBy: admin.id, reason: REASON, entries: 1, passwordInAudit: false });
  });

  test('an empty reason and an empty password show the spec\'s sentences under their fields and send nothing', async ({ page }, testInfo) => {
    const { code, owner } = await openedAsAdmin(page, testInfo);
    let sent = 0;
    await page.route(CANCEL_ROUTE, async (route) => {
      sent += 1;
      await route.continue();
    });
    const dialog = await openDialog(page, code);
    await submitOf(dialog).click();
    await expect(dialog.getByText('Enter a reason.', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Enter a password.', { exact: true })).toBeVisible();
    await expect(reasonOf(dialog)).toHaveAttribute('aria-invalid', 'true');
    await expect(reasonOf(dialog)).toBeFocused();
    expect(sent).toBe(0);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'APPROVED', calculations: 1 });
  });
});

test.describe('AC-10: an approval kept through an unlock', () => {
  test('the Admin cancels it on a Draft: the dialog and the notice say the Draft stays a Draft and its task does not change, and the status stays DRAFT', async ({ page }, testInfo) => {
    const { code, owner, admin } = await openedAsAdmin(page, testInfo, async (approved) => {
      // The Lead who approved is signed in: the unlock is theirs.
      expect(await unlockThroughTheApi(page, approved.owner.id, 'The customer asked for a new fixture.')).toBe(200);
    });
    await expect(tiles(page)).toContainText('Approved earlier');
    const dialog = await openDialog(page, code);
    await expect(dialog).toContainText('The estimate stays a Draft and its task does not change. The approved price stays on screen, marked "Approval cancelled", until you remove it. Neither step can be undone. A new approval brings a price back.');
    await expect(dialog).not.toContainText('Open queue');
    await reasonOf(dialog).fill(REASON);
    await passwordOf(dialog).fill(E2E_PASSWORD);
    await submitOf(dialog).click();

    const notice = noticeOf(page);
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('The estimate stays a Draft and its task does not change.');
    await expect(notice).not.toContainText('Open queue');
    await expect(tiles(page)).toContainText('Approval cancelled');
    await expect(tiles(page)).not.toContainText('Approved earlier');
    await expect(cancelButton(page)).toHaveCount(0);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 1 });
    expect(await readCancel(owner.id)).toEqual({ approvedPrice: APPROVED_PRICE, cancelledBy: admin.id, reason: REASON, unlocked: true, entries: 1, passwordInAudit: false });
  });
});

test.describe('AC-9: a customer deleted after the approval', () => {
  test('the server\'s 409 stops the dialog: its sentence in a danger alert with focus on it, Cancel approval off, the password emptied and the reason kept; "Keep the approval" is the way out', async ({ page }, testInfo) => {
    const { code, owner } = await openedAsAdmin(page, testInfo);
    await page.route(CANCEL_ROUTE, async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/problem+json',
        body: JSON.stringify({ type: 'about:blank', title: CUSTOMER_DELETED, status: 409, code: 'CUSTOMER_DELETED' }),
      });
    });
    const dialog = await openDialog(page, code);
    await reasonOf(dialog).fill(REASON);
    await passwordOf(dialog).fill(E2E_PASSWORD);
    await submitOf(dialog).click();

    const alert = dialog.locator('#cancel-alert');
    await expect(alert).toContainText(CUSTOMER_DELETED);
    await expect(alert).toBeFocused();
    await expect(submitOf(dialog)).toBeDisabled();
    await expect(passwordOf(dialog)).toHaveValue('');
    await expect(reasonOf(dialog)).toHaveValue(REASON);
    await expect(dialog).not.toContainText('Excel');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    await keepOf(dialog).click();
    await expect(dialog).toHaveCount(0);
    await expect(cancelButton(page)).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'APPROVED', calculations: 1 });
  });
});

test.describe('AC-5: an approval cancelled in another window while the dialog was open', () => {
  test('is not cancelled twice: the second press is the 409, the page is drawn again, and the notice holds the first reason', async ({ page }, testInfo) => {
    const { code, owner, admin } = await openedAsAdmin(page, testInfo);
    const dialog = await openDialog(page, code);
    // Someone presses Cancel approval in another window: the estimate is a Draft and the approval is cancelled.
    expect(await cancelThroughTheApi(page, owner.id, 'Done in another window.')).toBe(200);
    await reasonOf(dialog).fill('Done in this window.');
    await passwordOf(dialog).fill(E2E_PASSWORD);
    await submitOf(dialog).click();

    const notice = noticeOf(page);
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Reason: Done in another window.');
    await expect(notice).not.toContainText('Done in this window.');
    await expect(dialog).toHaveCount(0);
    expect(await readCancel(owner.id)).toEqual({ approvedPrice: APPROVED_PRICE, cancelledBy: admin.id, reason: 'Done in another window.', unlocked: false, entries: 1, passwordInAudit: false });
  });
});
