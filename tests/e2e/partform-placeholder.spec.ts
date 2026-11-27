import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { FORM_LOADING } from '../../src/components/features/estimate-workspace/estimate-texts';
import { defined } from '../support/defined';

import { assignedEstimate } from './support/assigned-estimate';
import { changePrivateMaterial, E2E_ENGINEER, insertPrivateMaterial } from './support/auth';
import { signInAs } from './support/calculated-estimate';
import { holdFieldsChunk } from './support/hold-fields-chunk';

/**
 * DEF-145 (DL-465; Jira AQP-502): **the part form's placeholder holds the form's space.** The review of a Lead or an Admin and the Engineer's workspace draw the same `PartForm`; until its fields' code has
 * arrived (a chunk fetched after the page is up) it shows a placeholder, and the form then replaces it. A placeholder much shorter than the form pushes everything under it down by the difference at a moment the
 * person does not choose: on the Lead's page `#review-actions` (Recalculate, Approve) sits under the form, so a jump to `#review-calculate` made before the swap (the rates-changed notice's link, Enter) ended
 * with the button below the screen (`rates-changed.spec.ts:263`, flaky since #827 put the swap right after hydration; that case stays as it is).
 *
 * The chunk is held with a route, so the swap happens when the test says and not when the network does. What is measured is the **document position** of the block under the form before and after the swap, which
 * must differ by no more than 8 px, at 360, 768 and 1366, for a Draft and a Prepared estimate; then the jump to `#review-calculate` made before the swap must end with the button on the screen. The same move check is
 * made on the Engineer's workspace (the same placeholder).
 *
 * **The person ledger is +0 (DL-422):** no person is made. The set-up's Lead makes a task for the set-up's Engineer through `POST /api/v1/tasks` and adds its rows through the API, the Engineer's inputs are
 * stored by one statement (`makeEstimateCalculable`) and the set-up's Engineer presses Calculate through the portal's own request. Every name and path is invented.
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

/** PF-1, PF-9: the ghost is the one busy status region of the form area, drawn in the first paint. */
async function placeholderIsShown(page: Page): Promise<void> {
  await expect(page.locator('[data-part-ghost]')).toBeVisible();
  await expect(page.locator('[data-part-ghost]').first()).toContainText(FORM_LOADING);
}

/** PF-14c: the form is drawn and no ghost is left in the page. */
async function formIsDrawn(page: Page): Promise<void> {
  await expect(page.locator('form[data-part-form]')).toBeVisible();
  await expect(page.locator('[data-part-ghost]')).toHaveCount(0);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByRole('status', { name: FORM_LOADING })).toHaveCount(0);
}

interface Box {
  readonly top: number;
  readonly width: number;
}

/** The cards in the area, in order, with their document top and width: the ghost's (`[data-ghost-grid]`) before the swap, the form's (`[data-part-grid]`) after it (PF-14a, PF-14b). */
async function cardBoxes(page: Page, grid: string): Promise<ReadonlyArray<Box>> {
  return page.locator(`${grid} > div`).evaluateAll((cards) =>
    cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return { top: rect.top + window.scrollY, width: rect.width };
    }),
  );
}

/** The distinct rows of cards (cards whose tops are within 2 px share a row): PF-14b, the same cards in the same rows. */
const rowsOf = (boxes: ReadonlyArray<Box>): number => boxes.reduce<number[]>((rows, box) => (rows.some((top) => Math.abs(top - box.top) <= 2) ? rows : [...rows, box.top]), []).length;

test.describe('DEF-145: the form replaces its placeholder and nothing under it moves', () => {
  // The route that holds the fields chunk answers every script of the page; a script still on its way when the test ends is not what is tested (QLT-833-04).
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  for (const prepared of [false, true]) {
    const state = prepared ? 'Prepared' : 'Draft';
    test(`the Lead's review, ${state}: #review-actions moves no more than ${String(MOVE_AT_MOST_PX)} px when the form is drawn, and a jump to #review-calculate made before the swap still ends on the screen`, async ({ page }, testInfo) => {
      const { code } = await assignedEstimate(page, testInfo, prepared);
      const chunk = await holdFieldsChunk(page);
      await page.goto(`/estimates/${code}`, { waitUntil: 'domcontentloaded' });
      await placeholderIsShown(page);
      await expect.poll(() => chunk.held(), { message: 'the fields chunk is being held' }).toBeGreaterThan(0);

      const actions = page.locator('#review-actions');
      await expect(actions).toBeVisible();
      const before = await documentTop(actions);
      const ghostCards = await cardBoxes(page, '[data-ghost-grid]');
      expect(ghostCards.length, "the ghost draws the form's cards").toBeGreaterThan(0);
      // PF-14d: the drawn blocks are inert and hidden from assistive technology, and the ghost has no accessibility violation of its own. PF-14g: it holds no figure (NFR-002).
      await expect(page.locator('[data-part-ghost] > div')).toHaveAttribute('inert', '');
      await expect(page.locator('[data-part-ghost] > div')).toHaveAttribute('aria-hidden', 'true');
      expect((await new AxeBuilder({ page }).include('[data-part-ghost]').analyze()).violations, 'axe on the ghost').toEqual([]);
      expect(await page.locator('[data-part-ghost]').innerText()).not.toMatch(/[$€₹]/);
      // What the rates-changed notice's link does on Enter: a jump to the Recalculate button, made while the placeholder is still on the page.
      await page.evaluate(() => {
        window.location.hash = '#review-calculate';
      });
      chunk.release();
      await formIsDrawn(page);

      const after = await documentTop(actions);
      expect(Math.abs(after - before), `#review-actions moved from ${String(before)} to ${String(after)} px`).toBeLessThanOrEqual(MOVE_AT_MOST_PX);
      await expect(page.locator('#review-calculate')).toBeInViewport();
      // PF-14a, PF-14b: the same number of cards, each in the place and at the width the form gives it, in the same rows.
      const formCards = await cardBoxes(page, '[data-part-grid]');
      expect(formCards.length, "the form draws the ghost's cards").toBe(ghostCards.length);
      expect(rowsOf(formCards), 'the cards fall into the same rows').toBe(rowsOf(ghostCards));
      formCards.forEach((card, index) => {
        const drawn = defined(ghostCards[index]);
        expect(Math.abs(card.width - drawn.width), `card ${String(index + 1)} width`).toBeLessThanOrEqual(1);
        expect(Math.abs(card.top - drawn.top), `card ${String(index + 1)} top`).toBeLessThanOrEqual(MOVE_AT_MOST_PX);
      });
    });
  }

  test("the rates-changed notice's own link, focused and pressed with Enter before the swap, ends with Recalculate on the screen (the keyboard path of DL-465 (3) (i))", async ({ page }, testInfo) => {
    // The state of rates-changed.spec.ts: calculated on a material of the test's own whose price changed after. No person is made (the set-up Lead and Engineer); the material is not a person.
    const materialId = await insertPrivateMaterial({ pricePerKg: '137.37', specificGravity: '7.37', scrapRate: '27.37' });
    const { code } = await assignedEstimate(page, testInfo, true, materialId);
    await changePrivateMaterial(materialId, { pricePerKg: '9137.73', specificGravity: '7.37', scrapRate: '27.37' });
    const chunk = await holdFieldsChunk(page);
    await page.goto(`/estimates/${code}`, { waitUntil: 'domcontentloaded' });
    await placeholderIsShown(page);
    await expect.poll(() => chunk.held(), { message: 'the fields chunk is being held' }).toBeGreaterThan(0);

    const notice = page.getByRole('status').filter({ hasText: 'Rates changed since this was calculated.' });
    await expect(notice).toBeVisible();
    const link = notice.getByRole('link', { name: 'Recalculate' });
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#review-calculate$/);
    chunk.release();
    await formIsDrawn(page);
    await expect(page.locator('#review-calculate')).toBeInViewport();
  });

  test("the Engineer's workspace: the page under the form moves no more than the same 8 px when the form replaces its placeholder", async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, false);
    await signInAs(page, E2E_ENGINEER);
    const chunk = await holdFieldsChunk(page);
    await page.goto(`/estimates/${code}`, { waitUntil: 'domcontentloaded' });
    await placeholderIsShown(page);
    await expect.poll(() => chunk.held(), { message: 'the fields chunk is being held' }).toBeGreaterThan(0);

    // The tree's own arrival (its skeleton rows become its rows) moves the page too and is not what is measured here (PF-14f): the tree is read first, then the form's swap is.
    await expect(page.locator('#parts-tree li[data-part-row]').first()).toBeVisible();
    const before = await mainBottom(page);
    const areaBefore = await page.locator('[data-form-area]').evaluate((element) => element.getBoundingClientRect().height);
    chunk.release();
    await formIsDrawn(page);
    const after = await mainBottom(page);
    expect(Math.abs(after - before), `the end of the page moved from ${String(before)} to ${String(after)} px`).toBeLessThanOrEqual(MOVE_AT_MOST_PX);
    // PF-14f, PF-15: a new part's ghost is the form's shape, so the form area changes by at most 24 px (one wrapped status line plus the 8 px).
    const areaAfter = await page.locator('[data-form-area]').evaluate((element) => element.getBoundingClientRect().height);
    expect(Math.abs(areaAfter - areaBefore), `the form area changed from ${String(areaBefore)} to ${String(areaAfter)} px`).toBeLessThanOrEqual(24);
  });

  test("PF-14e: with reduced motion the ghost's grey blocks do not move", async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const chunk = await holdFieldsChunk(page);
    await page.goto(`/estimates/${code}`, { waitUntil: 'domcontentloaded' });
    await placeholderIsShown(page);
    await expect.poll(() => chunk.held(), { message: 'the fields chunk is being held' }).toBeGreaterThan(0);
    const names = await page.locator('[data-part-ghost] .skeleton-shimmer').evaluateAll((blocks) => blocks.map((block) => getComputedStyle(block).animationName));
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names)).toEqual(new Set(['none']));
    chunk.release();
    await formIsDrawn(page);
    // The routed scripts still on their way are answered before the test ends: a response the page no longer waits for is an error of the route, not of what is tested here.
    await page.waitForLoadState('networkidle');
  });
});
