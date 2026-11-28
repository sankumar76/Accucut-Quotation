import { expect, test, type Page } from '@playwright/test';

import { assignedEstimate } from './support/assigned-estimate';
import { isPatchOfInputs } from './support/part-form';

/**
 * DEF-149 (AQP-506; DL-476): **the leave guard keeps count of its own history entry across a link to another row of the same page.** On the Lead's review (the guarded editable form of #806) the guard puts one extra
 * entry of the page's address on top of the history when something is first typed, and stays armed after it is saved. A press on another row's link while it is armed was taken by the guard, which then forgot the
 * entry was there: the next thing typed put a second one on, so the way out of a Back (two steps back) landed on the same estimate page, and "Leave without saving" or "Save draft and leave" did not leave.
 *
 * The case, as the Lead does it: open row 1.1 from the queue, edit a field and leave it (saved), press the link of another row, type into that row (the save cannot go through, so the text stays typed and not
 * saved), press Back (the dialog asks), "Keep editing" (a second Back asks again), and then each way out. The page the person came from is the queue, and it must be the page they are on after "Leave without
 * saving" and after "Save draft and leave" (which saves first). Run at the three widths by the three projects. **The person ledger is +0 (DL-422):** the task is made through the API by the set-up's Lead for the
 * set-up's Engineer. Every name and path is invented.
 */

const FIRST = 'Invented description, first save';
const TYPED = 'Invented text typed in the second row';

const description = (page: Page) => page.getByRole('textbox', { name: /Description/ }).first();
/** The open row's Description while the dialog is up: the dialog hides the rest of the page from the accessibility tree, so the box is found by the tree it is in, hidden or not. */
const descriptionBehindDialog = (page: Page) => page.getByRole('textbox', { name: /Description/, includeHidden: true }).first();
const leaveDialog = (page: Page) => page.getByRole('alertdialog', { name: 'Leave without saving?' });
const treePanel = (page: Page) => page.locator('details').filter({ has: page.locator('summary', { hasText: /^Parts tree/ }) });
const rowLink = (page: Page, row: string) => treePanel(page).locator(`a[href*="row=${row}#row-inputs"]`).first();
const savedAnswer = (page: Page) => page.waitForResponse((response) => response.request().method() !== 'GET' && /\/api\/v1\/estimates\/[^/]+\/nodes\/[^/]+(\/inputs)?$/.test(new URL(response.url()).pathname));

/** Below 1024 px the tree is a foldable panel: it is opened before a row is chosen. */
async function chooseRow(page: Page, row: string): Promise<void> {
  const open = await treePanel(page).evaluate((panel) => (panel as HTMLDetailsElement).open);
  if (!open) await treePanel(page).locator('summary').click();
  await rowLink(page, row).click();
}

/** The saves that cannot go through: what is typed after this stays typed and not saved. Answers the way to let them through again. */
async function failSaves(page: Page): Promise<() => void> {
  let failing = true;
  await page.route(
    (url) => isPatchOfInputs(url.toString(), 'PATCH'),
    (route) => (failing && route.request().method() === 'PATCH' ? route.abort() : route.continue()),
  );
  return () => {
    failing = false;
  };
}

/** Row 1.1 is opened by its address from the queue, edited and saved (the guard has armed itself and stays armed); then another row's link is pressed and text is typed there that cannot be saved. */
async function typedInTheSecondRow(page: Page, code: string): Promise<() => void> {
  await page.goto('/queue');
  await page.goto('/estimates/' + code + '?row=1.1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#part-form-title')).toContainText('1.1');
  await expect(page.locator('form[data-part-form]')).toBeVisible();
  await expect(description(page)).toBeEnabled();
  const saved = savedAnswer(page);
  await description(page).fill(FIRST);
  await description(page).blur();
  expect((await saved).status(), 'the first save').toBe(200);
  await chooseRow(page, '1');
  await expect(page).toHaveURL(/row=1#row-inputs$/);
  await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
  await expect(description(page)).toBeEnabled();
  const allow = await failSaves(page);
  await description(page).fill(TYPED);
  await description(page).blur();
  await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
  return allow;
}

/** Back asks with the text still there; "Keep editing"; a second Back asks again. */
async function backTwiceAsks(page: Page): Promise<void> {
  await page.evaluate(() => window.history.back());
  await expect(leaveDialog(page)).toBeVisible();
  await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
  await leaveDialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(description(page)).toHaveValue(TYPED);
  await page.evaluate(() => window.history.back());
  await expect(leaveDialog(page)).toBeVisible();
  await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
}

/**
 * The row link is pressed **before anything is typed**, so the guard is not armed and the page's own link takes the click: it replaces the page's entry (the row links of the tree replace; they never stack an entry of the
 * same page below the one the guard's push sits on). Then text is typed that cannot be saved, Back asks, and each way out lands on the page the test came from.
 */
async function typedAfterAnEarlyRowLink(page: Page, code: string): Promise<() => void> {
  await page.goto('/queue');
  await page.goto('/estimates/' + code + '?row=1.1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#part-form-title')).toContainText('1.1');
  await expect(page.locator('form[data-part-form]')).toBeVisible();
  await expect(description(page)).toBeEnabled();
  await chooseRow(page, '1');
  await expect(page).toHaveURL(/row=1#row-inputs$/);
  await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
  await expect(description(page)).toBeEnabled();
  const allow = await failSaves(page);
  await description(page).fill(TYPED);
  await description(page).blur();
  await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
  return allow;
}

test.describe('DEF-149: a row link pressed before anything is typed', () => {
  test('Back, then "Leave without saving": the queue, not the earlier row of the same page', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await typedAfterAnEarlyRowLink(page, code);
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
    await leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true }).click();
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('Back, then "Save draft and leave": the queue, with the typed text saved first', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    const allowSaves = await typedAfterAnEarlyRowLink(page, code);
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
    allowSaves();
    const saved = savedAnswer(page);
    await leaveDialog(page).getByRole('button', { name: 'Save draft and leave', exact: true }).click();
    expect((await saved).status(), 'the typed text is saved on the way out').toBe(200);
    await expect(page).toHaveURL(/\/queue$/);
  });
});

test.describe('DEF-149: Back after a link to another row of the same page', () => {
  // The landing address is exact: the page before the estimate page is the queue, so a way out that goes one entry too far (to the page before the queue) is a failure and not "the page is left" (DL-476 note 7).
  test('Back, then "Leave without saving": the queue, and no entry further back', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await typedInTheSecondRow(page, code);
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true }).click();
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('Back, Back again with the dialog up, then "Leave without saving": the queue, not the entry before it (the overshoot)', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await typedInTheSecondRow(page, code);
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true }).click();
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('Back, then "Save draft and leave": the queue, and the typed text is saved first', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    const allowSaves = await typedInTheSecondRow(page, code);
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    allowSaves();
    const saved = savedAnswer(page);
    await leaveDialog(page).getByRole('button', { name: 'Save draft and leave', exact: true }).click();
    expect((await saved).status(), 'the typed text is saved on the way out').toBe(200);
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('"Leave without saving" leaves the page: the one before is shown', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await typedInTheSecondRow(page, code);
    await backTwiceAsks(page);
    await leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true }).click();
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('"Save draft and leave" saves what was typed and leaves the page', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    const allowSaves = await typedInTheSecondRow(page, code);
    await backTwiceAsks(page);
    allowSaves();
    await leaveDialog(page).getByRole('button', { name: 'Save draft and leave', exact: true }).click();
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('"Keep editing" keeps the guard armed: the page stays, the text stays, and a later Back asks again', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await typedInTheSecondRow(page, code);
    await backTwiceAsks(page);
    await leaveDialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(leaveDialog(page)).toHaveCount(0);
    await expect(description(page)).toHaveValue(TYPED);
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await expect(page).toHaveURL(/\/estimates\//);
  });
});
