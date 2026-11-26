import { expect, test, type Page, type Response } from '@playwright/test';

import { createDisposableUser, E2E_ADMIN, readEstimateState, readWarningRecord, saveCanaryQuantity, setCanaryQuantity, useFreshAddress, type E2eUser } from './support/auth';
import { calculateAnywayWithoutThePage, engineerWithEstimate, signInAs } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';

/**
 * STORY-06.10 (AC-1 to AC-5, AC-7, AC-8; FR-104; NFR-002, NFR-016 to NFR-018): the quantity warning for a Lead and an Admin, SCR-06 and SCR-08, at 360x800, 768x1024 and 1366x768. Each test makes an Engineer of its
 * own with an estimate (the recipe of the confidentiality scan) **whose one part has 0 in QTY per Assy** (AC-7: the e2e seed has a row with H 0, so the real states are tested and no mock "preview" is built), has the
 * Engineer go ahead past the warning through the portal, and opens the same address as a Lead. What it checks: a Recalculate is asked about the 0 even though the Engineer already went ahead, in the Engineer's
 * words plus the sentence of A-26; "Go back" and Escape change nothing; "Recalculate anyway" makes the Lead's own calculation (the Lead's name, its own list, one more audit entry); a new list is shown with the
 * words that say so; the notice and the mark "Quantity 0" on the calculation in view, naming the Engineer or the Lead; no notice once the figures are cleared; the one line of the approval dialog, with Approve not
 * stopped; and keyboard, focus, no sideways scroll and no axe violation. The words are the UX spec's (v0.30), written out here and not imported. What the database holds is judged in
 * `tests/integration/calc/lead-warning.test.ts`. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const DIALOG_TITLE = 'Check the quantity on 1 row';
const DIALOG_DESCRIPTION = 'You can go back and change the count, or go ahead.';
const LEAD_NOTE = 'You are asked each time you press Calculate or Recalculate, even if the Engineer already went ahead.';
const ROW_LINE = 'QTY per Assy is 0 on 1 Invented text. That row will cost 0 in this estimate.';
const CHANGED = 'The list changed. Something changed after you pressed Calculate, so this is the new list. Check it again.';
const NOTICE_TITLE = 'Quantity warning on this calculation.';
const NOTICE_MEANING = 'This row costs 0 in this estimate. Approving is not stopped. Check that the zeros are meant.';
const APPROVE_LINE = 'This calculation has a quantity warning. 1 Invented text costs 0 in this estimate. Approving is not stopped, and there is no box to tick.';
const WENT_AHEAD = /went ahead on \d{2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} IST with 0 in QTY per Assy on 1 row: 1 Invented text\./;

const recalculateButton = (page: Page) => page.locator('#review-calculate');
const dialog = (page: Page) => page.getByRole('alertdialog');
const goBack = (page: Page) => dialog(page).getByRole('button', { name: 'Go back', exact: true });
const goAhead = (page: Page, label: 'Recalculate anyway' | 'Calculate anyway' = 'Recalculate anyway') => dialog(page).getByRole('button', { name: label, exact: true });
const notice = (page: Page) => page.getByRole('status').filter({ hasText: NOTICE_TITLE });
const marks = (page: Page) => page.locator('[data-quantity-tag]');
// The mark of the tree: "How the total is built" is above the tree and closed (AQP-488), so the first mark in the page is no longer one that can be seen.
const treeMark = (page: Page) => page.locator('[data-review-tree] [data-quantity-tag]').first();
const isRecalculate = (response: Response): boolean => response.request().method() === 'POST' && /\/api\/v1\/estimates\/[^/]+\/recalculate$/.test(new URL(response.url()).pathname);
/** True for the press that carries the acknowledgement ("Recalculate anyway"), false for the first press. */
const isAcknowledged = (request: { postData(): string | null }): boolean => request.postData()?.includes('acknowledge') === true;

/** An Engineer of the test's own whose canary estimate is ready to calculate and whose one part ("1 Invented text") has 0 in QTY per Assy. */
async function warnedEstimate(testInfo: Parameters<typeof engineerWithEstimate>[0]) {
  const made = await engineerWithEstimate(testInfo);
  await setCanaryQuantity(made.owner.id, '0');
  return made;
}

/**
 * The Engineer presses Calculate, is asked about the 0 and goes ahead, with the requests the button and the dialog send and without loading a page (`calculateAnywayWithoutThePage`): every case that needs the
 * Engineer's going ahead only as a set-up opens a page for the Lead next, so the Engineer's own page open is not made (DEF-051: one page open in a case).
 */
async function engineerWentAhead(page: Page, owner: E2eUser & { readonly id: string }): Promise<void> {
  await calculateAnywayWithoutThePage(page, owner);
}

async function openAs(page: Page, person: E2eUser, code: string): Promise<void> {
  await signInAs(page, person);
  const response = await page.goto(`/estimates/${code}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
}

/** The Engineer went ahead, an input then changed (so the figures are cleared and the Lead may Recalculate), and a Lead opens the estimate. */
async function clearedForLead(page: Page, testInfo: Parameters<typeof engineerWithEstimate>[0]) {
  const { owner, code } = await warnedEstimate(testInfo);
  await engineerWentAhead(page, owner);
  // A save from another tab: the count is typed again (still 0), the revision goes up and every figure is cleared.
  await saveCanaryQuantity(owner.id, '0');
  const lead = await createDisposableUser('axe', testInfo, 'LEAD');
  await openAs(page, lead, code);
  await expect(recalculateButton(page)).toHaveText('Recalculate');
  await waitUntilHydrated(page, '#review-calculate');
  return { owner, code, lead };
}

/** Presses Recalculate with the mouse and waits for the 409 and the dialog. */
async function pressAndExpectDialog(page: Page): Promise<void> {
  const answered = page.waitForResponse(isRecalculate);
  await recalculateButton(page).click();
  expect((await answered).status()).toBe(409);
  await expect(dialog(page)).toBeVisible();
}

test.describe('AC-1: the Lead is asked again, even though the Engineer already went ahead', () => {
  test('AC-1: Recalculate opens "Check the quantity on 1 row" with the Engineer\'s words, the sentence of A-26, the row, "Go back" and "Recalculate anyway", and writes nothing', async ({ page }, testInfo) => {
    const { owner } = await clearedForLead(page, testInfo);
    await pressAndExpectDialog(page);

    await expect(dialog(page).getByRole('heading', { name: DIALOG_TITLE })).toBeVisible();
    await expect(dialog(page)).toContainText(DIALOG_DESCRIPTION);
    await expect(dialog(page)).toContainText(LEAD_NOTE);
    await expect(dialog(page).getByRole('list', { name: 'Rows with a QTY per Assy of 0' })).toContainText(ROW_LINE);
    await expect(goBack(page)).toBeVisible();
    await expect(goAhead(page)).toBeVisible();
    await expect(dialog(page)).not.toContainText(CHANGED);
    // The warning says nothing about rates, prices or formulas.
    expect((await dialog(page).innerText()).toLowerCase()).not.toMatch(/\brates?\b|\bprice\b|formula/);

    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 1 });
  });

  test('AC-1: focus starts on "Go back"; "Go back" closes the dialog, changes nothing and puts focus back on Recalculate', async ({ page }, testInfo) => {
    const { owner } = await clearedForLead(page, testInfo);
    await pressAndExpectDialog(page);
    await expect(goBack(page)).toBeFocused();
    await goBack(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(recalculateButton(page)).toBeFocused();
    await expect(recalculateButton(page)).toHaveText('Recalculate');
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 1 });
  });

  test('AC-1: on an estimate nobody calculated, the first press of the Lead is "Calculate" and the way on is "Calculate anyway"', async ({ page }, testInfo) => {
    const { owner, code } = await warnedEstimate(testInfo);
    const lead = await createDisposableUser('axe', testInfo, 'LEAD');
    await openAs(page, lead, code);
    await expect(recalculateButton(page)).toHaveText('Calculate');
    await waitUntilHydrated(page, '#review-calculate');
    await pressAndExpectDialog(page);
    await expect(dialog(page)).toContainText(LEAD_NOTE);
    await expect(goAhead(page, 'Calculate anyway')).toBeVisible();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 0 });

    const answered = page.waitForResponse(isRecalculate);
    await goAhead(page, 'Calculate anyway').click();
    expect((await answered).status()).toBe(200);
    await expect(dialog(page)).toHaveCount(0);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 1 });
  });

  test('AC-1 (AC-4 of AQP-318): when something changed after the 409, "Recalculate anyway" shows the new list with the words that say so, and nothing is calculated', async ({ page }, testInfo) => {
    const { owner } = await clearedForLead(page, testInfo);
    await pressAndExpectDialog(page);
    // A save from another tab: the revision goes up, so the acknowledgement the dialog holds is stale.
    await saveCanaryQuantity(owner.id, '0');
    const asked = page.waitForResponse(isRecalculate);
    await goAhead(page).click();
    expect((await asked).status()).toBe(409);
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toContainText(CHANGED);
    await expect(dialog(page).getByRole('alert')).toContainText(CHANGED);
    await expect(goBack(page)).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 1 });
  });

  test('AC-1: when the acknowledged press fails, the dialog closes, the page says so and focus is on Recalculate', async ({ page }, testInfo) => {
    const { owner } = await clearedForLead(page, testInfo);
    await pressAndExpectDialog(page);
    await page.route('**/api/v1/estimates/*/recalculate', (route) => (isAcknowledged(route.request()) ? route.abort() : route.continue()));
    await goAhead(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole('alert').filter({ hasText: 'We could not calculate this estimate.' })).toBeVisible();
    await expect(recalculateButton(page)).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 1 });
  });
});

test.describe('AC-2, AC-3: "Recalculate anyway" makes the Lead\'s own calculation, and the review says who went ahead', () => {
  test('AC-2, AC-3: the answer is the current costs view, the page shows the Lead\'s name and time and the mark on the row, and the record holds the Engineer\'s and the Lead\'s own lists and two entries', async ({ page }, testInfo) => {
    const { owner, lead } = await clearedForLead(page, testInfo);
    await pressAndExpectDialog(page);
    const answered = page.waitForResponse((response) => isRecalculate(response) && response.status() !== 409);
    await goAhead(page).click();
    const response = await answered;
    expect(response.status()).toBe(200);
    const costs = (await response.json()) as { state: string; warning: { madeBy: string; rows: Array<{ slNo: string; label: string }> } };
    expect(costs.state).toBe('current');
    expect(costs.warning.madeBy).toBe(lead.name);
    expect(costs.warning.rows.map((row) => [row.slNo, row.label])).toEqual([['1', 'Invented text']]);

    await expect(dialog(page)).toHaveCount(0);
    await expect(recalculateButton(page)).toHaveCount(0);
    await expect(page.locator('#review-calculated')).toBeFocused();
    await expect(notice(page)).toContainText(`${lead.name} went ahead on`);
    await expect(notice(page)).toContainText(WENT_AHEAD);
    await expect(notice(page)).toContainText(NOTICE_MEANING);
    // The mark is in the tree and in "How the total is built" (closed, so counted and not looked at), with its words.
    // The tree, the table and, since AQP-488, the row line of the open row (the warned item is the first row).
    await expect(marks(page)).toHaveCount(3);
    await expect(treeMark(page)).toContainText('Quantity 0');
    await expect(treeMark(page)).toBeVisible();

    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 2 });
    const record = await readWarningRecord(owner.id);
    expect(record.warnings).toHaveLength(2);
    expect(record.audit.map((entry) => entry.event)).toEqual(['calculation.warning_acknowledged', 'calculation.warning_acknowledged']);
  });

  test('AC-3: while the Engineer\'s calculation is the one in view, the notice names the Engineer, and `GET /costs` carries the same list', async ({ page }, testInfo) => {
    const { owner, code } = await warnedEstimate(testInfo);
    await engineerWentAhead(page, owner);
    const lead = await createDisposableUser('axe', testInfo, 'LEAD');
    await openAs(page, lead, code);

    await expect(recalculateButton(page)).toHaveCount(0);
    await expect(notice(page)).toContainText(`${owner.name} went ahead on`);
    await expect(notice(page)).toContainText(WENT_AHEAD);
    await expect(marks(page)).toHaveCount(3);
    const costs = await page.request.get(`/api/v1/estimates/${owner.id}/costs`);
    expect(costs.status()).toBe(200);
    expect(((await costs.json()) as { warning: { madeBy: string } }).warning.madeBy).toBe(owner.name);
  });

  test('AC-3: an Admin sees the same notice', async ({ page }, testInfo) => {
    const { owner, code } = await warnedEstimate(testInfo);
    await engineerWentAhead(page, owner);
    await openAs(page, E2E_ADMIN, code);
    await expect(notice(page)).toContainText(`${owner.name} went ahead on`);
  });

  test('AC-4: once an input changed there is no notice and no mark (the list may be stale), and Recalculate asks afresh', async ({ page }, testInfo) => {
    await clearedForLead(page, testInfo);
    await expect(notice(page)).toHaveCount(0);
    await expect(marks(page)).toHaveCount(0);
    await expect(page.getByText(NOTICE_TITLE)).toHaveCount(0);
  });
});

test.describe('AC-5: the approval dialog says so, and Approve is not stopped', () => {
  test('AC-5: one line names the row, there is no box to tick, and Approve and lock approves the calculation that carries the warning', async ({ page }, testInfo) => {
    const { owner, code } = await warnedEstimate(testInfo);
    await engineerWentAhead(page, owner);
    const lead = await createDisposableUser('axe', testInfo, 'LEAD');
    await openAs(page, lead, code);
    await expect(page.locator('#review-approve')).toBeEnabled();
    await waitUntilHydrated(page, '#review-approve');
    await page.locator('#review-approve').click();

    const approve = page.getByRole('dialog', { name: 'Approve and lock' });
    await expect(approve).toBeVisible();
    await expect(approve).toContainText(APPROVE_LINE);
    await expect(approve.getByRole('checkbox')).toHaveCount(0);
    const submit = approve.getByRole('button', { name: 'Approve and lock', exact: true });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.locator('#review-approved-notice')).toBeVisible();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'APPROVED', calculations: 1 });
    // Approved: the notice and the mark stay with what was approved.
    await expect(notice(page)).toContainText(`${owner.name} went ahead on`);
  });
});

test.describe('AC-8: keyboard, focus and accessibility at this width', () => {
  test('AC-8: by keyboard alone: Enter on Recalculate opens the dialog with focus on "Go back"; Escape closes it with nothing sent; the next Enter and Tab to "Recalculate anyway" go ahead', async ({ page }, testInfo) => {
    const { owner } = await clearedForLead(page, testInfo);
    await recalculateButton(page).focus();
    const asked = page.waitForResponse(isRecalculate);
    await page.keyboard.press('Enter');
    expect((await asked).status()).toBe(409);
    await expect(dialog(page)).toBeVisible();
    await expect(goBack(page)).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(recalculateButton(page)).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 1 });

    const askedAgain = page.waitForResponse(isRecalculate);
    await page.keyboard.press('Enter');
    expect((await askedAgain).status()).toBe(409);
    await expect(goBack(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(goAhead(page)).toBeFocused();
    const answered = page.waitForResponse((response) => isRecalculate(response) && response.status() !== 409);
    await page.keyboard.press('Enter');
    expect((await answered).status()).toBe(200);
    await expect(page.locator('#review-calculated')).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 2 });
  });

  test('AC-8: no sideways scroll and no axe violation with the dialog open', async ({ page }, testInfo) => {
    await clearedForLead(page, testInfo);
    await pressAndExpectDialog(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-8: no sideways scroll and no axe violation with the notice and the marks on the page', async ({ page }, testInfo) => {
    const { owner, code } = await warnedEstimate(testInfo);
    await engineerWentAhead(page, owner);
    const lead = await createDisposableUser('axe', testInfo, 'LEAD');
    await openAs(page, lead, code);
    await expect(notice(page)).toBeVisible();
    await expect(treeMark(page)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});
