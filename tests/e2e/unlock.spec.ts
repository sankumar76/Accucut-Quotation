import { expect, test, type Locator, type Page } from '@playwright/test';

import { readEstimateState, saveCanaryQuantity, useFreshAddress } from './support/auth';
import { signInAs } from './support/calculated-estimate';
import { APPROVED_PRICE, approvedEstimate, readUnlock, unlockThroughTheApi } from './support/approved-estimate';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';

/**
 * STORY-06.08 (AC-1 to AC-5, AC-7, AC-9 to AC-12; FR-063, NFR-002, NFR-016 to NFR-018): Unlock, SCR-09 and SCR-06 after it, for a Lead at `/estimates/<code>`, at 360x800, 768x1024 and 1366x768. Each test makes an
 * Engineer of its own with an estimate and has it calculated and approved **through the API** (`support/approved-estimate.ts`), so the 30 s of a test are spent on the unlock and not on the three page loads
 * of the approval. What it checks: the dialog opens from the Unlock button with focus on the safe choice, the required reason and the notice of what changed since the approval, keeps focus inside, has no
 * sideways scroll and no axe violation; an empty reason and a reason over 500 characters show the spec's sentence under the field and send nothing; a good unlock shows "Unlocking", then the Draft with the
 * notice (who, when, why, the figures still the approval's, the price approved earlier, whose queue), BO labelled "Approved earlier", Recalculate as the primary action and Approve off; the Engineer then
 * sees the estimate editable and no price (a test of its own, after the Lead's, on the same estimate: DEF-043); an input changed after the unlock clears every figure but not BO, and a Recalculate brings the estimate back to Prepared; a deleted customer stops the dialog
 * before the reason is typed; and an estimate unlocked in another window while the dialog was open is not unlocked twice. The unlocks are made by Leads of the tests' own, never by the Admin, so the audit
 * screen's list of "Approval cancelled" (no story has raised it yet) is not touched. The words are the UX spec's (v0.31), written out here and not imported. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const SLOW_MILLISECONDS = 800;
const UNLOCK_ROUTE = '**/api/v1/estimates/*/unlock';
const PREVIEW_ROUTE = '**/api/v1/estimates/*/unlock-preview';
const REASON = 'The customer asked for a new fixture.';
const NOTHING_OR_CHANGED = /Nothing has changed in the configuration or the rates since approval\.|Things have changed since this estimate was approved\./;
const FIGURES_CURRENT = 'The figures below are still the ones from the approval.';
const FIGURES_CLEARED = 'An input has changed since, so every calculated figure is cleared. Recalculate to bring them up to date.';
const PRICE_STAYS = 'The price approved earlier stays until a new approval replaces it.';
const CUSTOMER_DELETED = 'The customer chosen for this estimate was deleted, so the estimate cannot be unlocked. The approval was not changed.';
const RUPEES_APPROVED = '₹ 48,271.37';

const tiles = (page: Page) => page.getByRole('region', { name: 'Totals' });
const unlockButton = (page: Page) => page.locator('#review-unlock');
const dialogOf = (page: Page, code: string) => page.getByRole('alertdialog', { name: `Unlock ${code}` });
const reasonOf = (dialog: Locator) => dialog.locator('#unlock-reason');
const submitOf = (dialog: Locator) => dialog.getByRole('button', { name: /^(Unlock|Unlocking)$/ });
const keepLockedOf = (dialog: Locator) => dialog.getByRole('button', { name: 'Keep it locked' });
const noticeOf = (page: Page) => page.locator('#review-unlocked-notice');

/** An estimate approved through the API, then opened as the Lead who approved it, with the Unlock button on and its script live. */
async function openedApproved(page: Page, testInfo: Parameters<typeof approvedEstimate>[1]) {
  const approved = await approvedEstimate(page, testInfo);
  const response = await page.goto(`/estimates/${approved.code}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(approved.code);
  await expect(unlockButton(page)).toBeEnabled();
  await waitUntilHydrated(page, '#review-unlock');
  return approved;
}

async function openDialog(page: Page, code: string): Promise<Locator> {
  await unlockButton(page).click();
  const dialog = dialogOf(page, code);
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('AC-1, AC-9: the dialog', () => {
  test('opens with focus on "Keep it locked", asks for the reason, tells what changed since the approval, keeps focus inside, scrolls no way sideways and has no axe violation; Escape sends nothing and gives focus back', async ({ page }, testInfo) => {
    const { code, owner } = await openedApproved(page, testInfo);
    let sent = 0;
    await page.route(UNLOCK_ROUTE, async (route) => {
      sent += 1;
      await route.continue();
    });
    await unlockButton(page).focus();
    await page.keyboard.press('Enter');
    const dialog = dialogOf(page, code);
    await expect(dialog).toBeVisible();

    await expect(keepLockedOf(dialog)).toBeFocused();
    await expect(dialog).toContainText(`Unlocking returns the estimate to Draft so inputs can be changed, and reopens the task in`);
    await expect(dialog).toContainText(`${owner.name}'s Open queue. The unlock is logged with your reason.`);
    await expect(dialog.getByLabel('Reason for unlocking')).toBeVisible();
    await expect(dialog.getByText('Enter a reason. It is kept in the audit log.')).toBeVisible();
    await expect(reasonOf(dialog)).toHaveJSProperty('required', true);
    // The notice of what changed is the preview's answer: counts and version numbers, never a value. The shared database may have moved since, so either of its two sentences is the right one.
    await expect(dialog.getByText(NOTHING_OR_CHANGED)).toBeVisible();
    await expect(dialog).not.toContainText('₹');
    await expect(keepLockedOf(dialog)).toBeEnabled();
    await expect(submitOf(dialog)).toBeEnabled();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    // Tab stays inside the dialog: the reason, Keep it locked, Unlock, and round again.
    const inside = dialog.locator(':focus');
    for (let press = 0; press < 5; press += 1) {
      await page.keyboard.press('Tab');
      await expect(inside).toHaveCount(1);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(unlockButton(page)).toBeFocused();
    expect(sent).toBe(0);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'APPROVED', calculations: 1 });
  });
});

test.describe('AC-4: the reason', () => {
  test('an empty reason and a reason over 500 characters show the spec\'s sentence under the field, send nothing, and keep what was typed; focus goes to the field', async ({ page }, testInfo) => {
    const { code, owner } = await openedApproved(page, testInfo);
    let sent = 0;
    await page.route(UNLOCK_ROUTE, async (route) => {
      sent += 1;
      await route.continue();
    });
    const dialog = await openDialog(page, code);
    await submitOf(dialog).click();
    await expect(dialog.getByText('Enter a reason.', { exact: true })).toBeVisible();
    await expect(reasonOf(dialog)).toHaveAttribute('aria-invalid', 'true');
    await expect(reasonOf(dialog)).toBeFocused();

    const tooLong = 'x'.repeat(501);
    await reasonOf(dialog).fill(tooLong);
    await submitOf(dialog).click();
    await expect(dialog.getByText('Use 500 characters or fewer.', { exact: true })).toBeVisible();
    await expect(reasonOf(dialog)).toHaveValue(tooLong);
    await expect(reasonOf(dialog)).toBeFocused();
    expect(sent).toBe(0);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'APPROVED', calculations: 1 });
    expect((await readUnlock(owner.id))?.unlockedBy).toBeNull();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('AC-2, AC-3, AC-7, AC-11: a good unlock', () => {
  // DEF-043 (AQP-346, DL-370): one test did the Lead's unlock through the dialog and then the Engineer's page load, and at 360 px on a loaded runner the whole of it passed 30 s at the Engineer's
  // last step (`#calculate-button`). The two halves are now two tests, each with its own 30 s, and every assertion of the one test is in one of them. They are a serial group because the Engineer half
  // reads the estimate the Lead half unlocked: a test of its own would make two more people (an Engineer and a Lead) in a shard whose `users.spec.ts:58` counts every person made before it (DEF-053,
  // DL-367). A serial group retries together, so a retry makes its estimate again. No other test of the file reads the variable.
  let unlocked: { readonly code: string; readonly owner: Awaited<ReturnType<typeof approvedEstimate>>['owner'] } | undefined;

  test.describe('the Lead, then the Engineer', () => {
    test.describe.configure({ mode: 'serial' });

    test('shows "Unlocking" while it is under way, then the Draft with the notice, BO "Approved earlier", Recalculate and Approve off', async ({ page }, testInfo) => {
      const { code, owner, lead } = await openedApproved(page, testInfo);
      await page.route(UNLOCK_ROUTE, async (route) => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, SLOW_MILLISECONDS);
        });
        await route.continue();
      });
      const dialog = await openDialog(page, code);
      await reasonOf(dialog).fill(`  ${REASON}  `);
      const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/estimates/${owner.id}/unlock`));
      await submitOf(dialog).click();
      await expect(dialog.getByRole('button', { name: 'Unlocking' })).toBeDisabled();
      // The dialog cannot be dismissed while the request is under way.
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      const response = await answered;
      expect(response.status()).toBe(200);
      expect(Object.keys((await response.json()) as object).sort()).toEqual(['status', 'unlockedAt']);

      await expect(dialog).toHaveCount(0);
      const notice = noticeOf(page);
      await expect(notice).toBeVisible();
      await expect(notice).toContainText(`by ${lead.name}.`);
      await expect(notice).toContainText(/Unlocked on \d{2} \w{3} \d{4}, \d{2}:\d{2} IST by /);
      await expect(notice).toContainText(`Reason: ${REASON}`);
      await expect(notice).toContainText(FIGURES_CURRENT);
      await expect(notice).toContainText(PRICE_STAYS);
      await expect(notice).toContainText(`The task is back in ${owner.name}'s Open queue.`);
      await expect(notice).toBeFocused();
      // BO is the price approved earlier, labelled so; Approve is off until the figures are made again; Recalculate is the way on, though the figures are current (AC-11).
      await expect(tiles(page)).toContainText(RUPEES_APPROVED);
      await expect(tiles(page)).toContainText('Approved earlier');
      await expect(page.locator('#review-approve')).toBeDisabled();
      await expect(page.locator('#review-calculate')).toHaveText('Recalculate');
      await expect(page.locator('#review-calculate')).toBeEnabled();
      await expect(unlockButton(page)).toHaveCount(0);
      expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 1 });
      expect(await readUnlock(owner.id)).toEqual({ approvedPrice: APPROVED_PRICE, unlockedBy: lead.id, reason: REASON, entries: 1 });
      unlocked = { code, owner };
      // STORY-07.07: Download is now the link (no reason line under it), so the page is shorter and the focused notice leaves the folder link half behind the sticky top bar at 768 px. The scan reads the page where it stands, so it is made from the top, as after a page load (the same step as insert-field.spec.ts).
      await page.evaluate(() => window.scrollTo(0, 0));
      await expectNoAxeViolations(page);
    });

    test('AC-7: the Engineer finds the estimate the Lead unlocked editable again and sees no price', async ({ page }) => {
      const left = unlocked;
      if (left === undefined) throw new Error('The Lead half left no unlocked estimate to read.');
      const { code, owner } = left;
      // AC-7: the Engineer, on an address of its own and with no page of the Lead's before it, finds the estimate editable again and sees no price (NFR-002).
      await signInAs(page, owner);
      const own = await page.goto(`/estimates/${code}`);
      expect(own?.status()).toBe(200);
      await expect(page.locator('#calculate-button')).toHaveText('Calculate');
      await expect(page.getByText('Approved and locked.', { exact: true })).toHaveCount(0);
      await expect(page.getByText('48,271.37')).toHaveCount(0);
      await expect(page.getByText('Approved Quote Price')).toHaveCount(0);
      await expect(page.getByText('Approved earlier')).toHaveCount(0);
    });
  });

  test('an input changed after the unlock clears every figure but not BO; a Recalculate brings the estimate back to Prepared with Approve on', async ({ page }, testInfo) => {
    const { code, owner } = await openedApproved(page, testInfo);
    // Another window unlocks, and an input changes: the page is read after both.
    expect(await unlockThroughTheApi(page, owner.id, REASON)).toBe(200);
    await saveCanaryQuantity(owner.id, '7');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);

    const notice = noticeOf(page);
    await expect(notice).toContainText(FIGURES_CLEARED);
    await expect(notice).not.toContainText(FIGURES_CURRENT);
    // AC-12: BO still shows the price approved earlier, while BL and every calculated figure is cleared.
    await expect(tiles(page)).toContainText(RUPEES_APPROVED);
    await expect(tiles(page)).toContainText('Approved earlier');
    await expect(page.locator('#review-approve')).toBeDisabled();
    await expect(page.locator('#review-calculate')).toHaveText('Recalculate');
    await waitUntilHydrated(page, '#review-calculate');

    await page.locator('#review-calculate').click();
    await expect(page.locator('#review-approve')).toBeEnabled();
    await expect(notice).toHaveCount(0);
    await expect(tiles(page)).toContainText('Approved earlier');
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 2 });
  });
});

test.describe('AC-10: a customer deleted after the approval', () => {
  test('the preview\'s 409 stops the dialog before the reason is typed: the server\'s sentence in a danger alert with focus on it, Unlock off, and "Keep it locked" is the way out', async ({ page }, testInfo) => {
    const { code, owner } = await openedApproved(page, testInfo);
    await page.route(PREVIEW_ROUTE, async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/problem+json',
        body: JSON.stringify({ type: 'about:blank', title: CUSTOMER_DELETED, status: 409, code: 'CUSTOMER_DELETED' }),
      });
    });
    const dialog = await openDialog(page, code);
    const alert = dialog.locator('#unlock-blocked-alert');
    await expect(alert).toContainText(CUSTOMER_DELETED);
    await expect(alert).toBeFocused();
    await expect(submitOf(dialog)).toBeDisabled();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    await keepLockedOf(dialog).click();
    await expect(dialog).toHaveCount(0);
    await expect(unlockButton(page)).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'APPROVED', calculations: 1 });
  });
});

test.describe('AC-5: an estimate unlocked in another window while the dialog was open', () => {
  test('is not unlocked twice: the second press is the 409, the page is drawn again, and the notice holds the first reason', async ({ page }, testInfo) => {
    const { code, owner, lead } = await openedApproved(page, testInfo);
    const dialog = await openDialog(page, code);
    await expect(dialog.getByText(NOTHING_OR_CHANGED)).toBeVisible();
    // Someone presses Unlock in another window: the estimate is a Draft.
    expect(await unlockThroughTheApi(page, owner.id, 'Done in another window.')).toBe(200);
    await reasonOf(dialog).fill('Done in this window.');
    await submitOf(dialog).click();

    const notice = noticeOf(page);
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Reason: Done in another window.');
    await expect(notice).not.toContainText('Done in this window.');
    await expect(dialog).toHaveCount(0);
    expect(await readUnlock(owner.id)).toEqual({ approvedPrice: APPROVED_PRICE, unlockedBy: lead.id, reason: 'Done in another window.', entries: 1 });
  });
});
