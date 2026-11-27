import { expect, test, type Locator, type Page } from '@playwright/test';

import { FORM_LOADING } from '../../src/components/features/estimate-workspace/estimate-texts';

import { E2E_ADMIN } from './support/auth';
import { calculateWithoutThePage, engineerWithEstimate, signInAs } from './support/calculated-estimate';
import { holdFieldsChunk } from './support/hold-fields-chunk';

/**
 * DEF-145 (DL-465; Jira AQP-502): **the part form's placeholder holds the form's space.** The review of a Lead or an Admin and the Engineer's workspace draw the same `PartForm`; until its fields' code has
 * arrived (a chunk fetched after the page is up) it shows a placeholder, and the form then replaces it. A placeholder much shorter than the form pushes everything under it down by the difference at a moment the
 * person does not choose: on the Lead's page `#review-actions` (Recalculate, Approve) sits under the form, so a jump to `#review-calculate` made before the swap (the rates-changed notice's link, Enter) ended
 * with the button below the screen (`rates-changed.spec.ts:263`, flaky since #827 put the swap right after hydration; that case stays as it is).
 *
 * The chunk is held with a route, so the swap happens when the test says and not when the network does. What is measured is the **document position** of the block under the form before and after the swap, which
 * must differ by no more than 8 px, at 360, 768 and 1366, for a Draft and a Prepared estimate; then the jump to `#review-calculate` made before the swap must end with the button on the screen. The same move check is
 * made on the Engineer's workspace (the same placeholder). **No new person is made beyond the Engineer the other Lead-page specs make** (the Admin of the set-up is the viewer).
 */

const MOVE_AT_MOST_PX = 8;

/** The top of the element in the document (not the screen), so a scroll does not count as a move. */
async function documentTop(locator: Locator): Promise<number> {
  return locator.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
}

/** The bottom of the page's main region in the document: what the form's height pushes. */
async function mainBottom(page: Page): Promise<number> {
  return page.locator('main').first().evaluate((element) => element.getBoundingClientRect().bottom + window.scrollY);
}

async function placeholderIsShown(page: Page): Promise<void> {
  await expect(page.getByRole('status', { name: FORM_LOADING })).toBeVisible();
}

async function formIsDrawn(page: Page): Promise<void> {
  await expect(page.locator('form[data-part-form]')).toBeVisible();
  await expect(page.getByRole('status', { name: FORM_LOADING })).toHaveCount(0);
}

test.describe('DEF-145: the form replaces its placeholder and nothing under it moves', () => {
  for (const state of ['Draft', 'Prepared'] as const) {
    test(`the Lead's review, ${state}: #review-actions moves no more than ${String(MOVE_AT_MOST_PX)} px when the form is drawn, and a jump to #review-calculate made before the swap still ends on the screen`, async ({ page }, testInfo) => {
      const { owner, code } = await engineerWithEstimate(testInfo);
      if (state === 'Prepared') await calculateWithoutThePage(page, owner);
      await signInAs(page, E2E_ADMIN);
      const chunk = await holdFieldsChunk(page);
      await page.goto(`/estimates/${code}`);
      await placeholderIsShown(page);
      await expect.poll(() => chunk.held(), { message: 'the fields chunk is being held' }).toBeGreaterThan(0);

      const actions = page.locator('#review-actions');
      await expect(actions).toBeVisible();
      const before = await documentTop(actions);
      // What the rates-changed notice's link does on Enter: a jump to the Recalculate button, made while the placeholder is still on the page.
      await page.evaluate(() => {
        window.location.hash = '#review-calculate';
      });
      chunk.release();
      await formIsDrawn(page);

      const after = await documentTop(actions);
      expect(Math.abs(after - before), `#review-actions moved from ${String(before)} to ${String(after)} px`).toBeLessThanOrEqual(MOVE_AT_MOST_PX);
      await expect(page.locator('#review-calculate')).toBeInViewport();
    });
  }

  test("the Engineer's workspace: the page under the form moves no more than the same 8 px when the form replaces its placeholder", async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await signInAs(page, owner);
    const chunk = await holdFieldsChunk(page);
    await page.goto(`/estimates/${code}`);
    await placeholderIsShown(page);
    await expect.poll(() => chunk.held(), { message: 'the fields chunk is being held' }).toBeGreaterThan(0);

    const before = await mainBottom(page);
    chunk.release();
    await formIsDrawn(page);
    const after = await mainBottom(page);
    expect(Math.abs(after - before), `the end of the page moved from ${String(before)} to ${String(after)} px`).toBeLessThanOrEqual(MOVE_AT_MOST_PX);
  });
});
