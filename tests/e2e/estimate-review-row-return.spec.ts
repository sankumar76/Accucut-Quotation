import { expect, test, type Page } from '@playwright/test';

import { assignedEstimate } from './support/assigned-estimate';
import { isPatchOfInputs } from './support/part-form';

/**
 * DL-470 (3): the Lead's page is seeded with the open row's data (DEF-141, #827) and editable (DEF-131, #806). **A row that is edited, left, and opened again shows what was saved, and the next save is accepted.** The
 * form of a row is keyed by the row, so opening a row again mounts it afresh; if that mount started from the page's first snapshot (the seed) it would show the values from before the edit, and the next save would be
 * refused 409 because it carries the revision of the snapshot. This is the case as a Lead on a Prepared estimate: edit row 1 and let it save, open row 1.1, open row 1 again, expect the saved value and a second
 * save that goes through.
 *
 * The estimate is made through the API by the set-up Lead for the set-up Engineer (**no person is made**, DL-422) and is Prepared (a Lead may correct the inputs of a Prepared estimate).
 */

const FIRST = 'Invented description, first save';
const SECOND = 'Invented description, second save';
const description = (page: Page) => page.getByRole('textbox', { name: /Description/ }).first();
const treePanel = (page: Page) => page.locator('[data-review-tree]');
const rowLink = (page: Page, row: string) => treePanel(page).locator(`a[href*="row=${row}#row-inputs"]`).first();
/** Below 1024 px the panel folds once a row is open, and its summary says which: it is opened before a row is chosen. */
async function chooseRow(page: Page, row: string): Promise<void> {
  const open = await treePanel(page).evaluate((panel) => (panel as HTMLDetailsElement).open);
  if (!open) await treePanel(page).locator('summary').click();
  await rowLink(page, row).click();
}
/** A write of the row's inputs: the answer to the form's save of a value. */
const savedAnswer = (page: Page) => page.waitForResponse((response) => response.request().method() !== 'GET' && /\/api\/v1\/estimates\/[^/]+\/nodes\/[^/]+(\/inputs)?$/.test(new URL(response.url()).pathname));

test.describe('DL-470 (3): a row opened again shows what was saved', () => {
  test('edit row 1 and save, open row 1.1, open row 1 again: the saved text is shown, and a further save is not refused', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await page.goto(`/estimates/${code}`);
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await expect(page.locator('#part-form-title')).toContainText('1');

    // Edit row 1 and let it save (leaving the box saves it).
    const first = savedAnswer(page);
    await description(page).fill(FIRST);
    await description(page).blur();
    expect((await first).status(), 'the first save').toBe(200);

    // Open the part under it, then row 1 again.
    await chooseRow(page, '1.1');
    await expect(page).toHaveURL(/row=1\.1/);
    await expect(page.locator('#part-form-title')).toContainText('1.1');
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await chooseRow(page, '1');
    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('form[data-part-form]')).toBeVisible();

    // The form shows what was saved, not the page's first snapshot.
    await expect(description(page)).toHaveValue(FIRST);

    // And the next save carries the right revision: it is accepted.
    const second = savedAnswer(page);
    await description(page).fill(SECOND);
    await description(page).blur();
    const answer = await second;
    expect(answer.status(), 'the second save (409 would be a stale revision)').toBe(200);
    await expect(description(page)).toHaveValue(SECOND);
  });
});

test.describe('The island follows the address and the leave guard still asks', () => {
  /** What the guard says and its two answers (the Engineer's own cases hold the words: estimate-save.spec.ts). */
  const leaveDialog = (page: Page) => page.getByRole('alertdialog', { name: 'Leave without saving?' });

  test('Back with a value typed and not saved asks "Leave without saving?", keeps the typed value and the open row after "Keep editing", and leaves after "Leave without saving"', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await page.goto('/queue');
    await page.goto('/estimates/' + code);
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    // A save that cannot go through keeps the value typed and not saved, which is what arms the guard.
    await page.route((url) => isPatchOfInputs(url.toString(), 'PATCH'), (route) => (route.request().method() === 'PATCH' ? route.abort() : route.continue()));
    await description(page).fill(FIRST);
    await description(page).blur();
    await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();

    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await expect(page).toHaveURL(new RegExp('/estimates/' + code));
    await leaveDialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(leaveDialog(page)).toHaveCount(0);
    await expect(description(page)).toHaveValue(FIRST);
    await expect(page.locator('#part-form-title')).toContainText('1');

    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true }).click();
    await expect(page).toHaveURL(/\/queue/);
  });
});
