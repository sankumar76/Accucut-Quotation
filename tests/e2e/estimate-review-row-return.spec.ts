import { expect, test, type Page } from '@playwright/test';

import { assignedEstimate } from './support/assigned-estimate';

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
const rowLink = (page: Page, row: string) => page.locator(`[data-review-tree] a[href*="row=${row}#row-inputs"]`).first();
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
    await rowLink(page, '1.1').click();
    await expect(page).toHaveURL(/row=1\.1/);
    await expect(page.locator('#part-form-title')).toContainText('1.1');
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await rowLink(page, '1').click();
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
