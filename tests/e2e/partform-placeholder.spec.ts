import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { FORM_LOADING } from '../../src/components/features/estimate-workspace/estimate-texts';
import { defined } from '../support/defined';

import { assignedEstimate } from './support/assigned-estimate';
import { changePrivateMaterial, E2E_ENGINEER, insertPrivateMaterial } from './support/auth';
import { signInAs } from './support/calculated-estimate';
import { holdFieldsChunk } from './support/hold-fields-chunk';
import { showTree, tree } from './support/part-form';
import { DEVELOPMENT_URL } from './support/servers';

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
/** The Engineer's own bar (PF-15): the ghost of a part not yet known is a new part's shape, so it may differ by one wrapped status line plus the 8 px. */
const ENGINEER_MOVE_AT_MOST_PX = 24;

/** The top of the element in the document (not the screen), so a scroll does not count as a move. */
async function documentTop(locator: Locator): Promise<number> {
  return locator.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
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

/** The form's own picture control has replaced its placeholder: the form is as tall as it will be. */
async function pictureControlHere(page: Page): Promise<void> {
  await expect(page.locator('form[data-part-form] [data-picture-zone]:not(.skeleton-shimmer)')).toBeVisible();
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
      // PF-14h: no `[aria-busy=true]` anywhere in the review while the ghost shows (it is there only while Recalculate runs), and the Totals are visible.
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      // PF-14h, QLT-833-05: the review's figures stay visible while the ghost is up (the tiles hide them under any `aria-busy=true` on the page, and the ghost has none).
      if (prepared) await expect(page.getByRole('region', { name: 'Totals' }).getByText(/^₹ [\d,]+\.\d{2}$/).first()).toBeVisible();
      // PF-14d: the drawn blocks are inert and hidden from assistive technology, and the ghost has no accessibility violation of its own. PF-14g: it holds no figure (NFR-002).
      await expect(page.locator('[data-part-ghost] > div')).toHaveAttribute('inert', '');
      await expect(page.locator('[data-part-ghost] > div')).toHaveAttribute('aria-hidden', 'true');
      expect((await new AxeBuilder({ page }).include('[data-part-ghost]').analyze()).violations, 'axe on the ghost').toEqual([]);
      expect(await page.locator('[data-part-ghost]').innerText()).not.toMatch(/[$€₹]/);
      // What the rates-changed notice's link does on Enter: a jump to the Recalculate button, made while the placeholder is still on the page.
      // The button the action row has for this state: Calculate on a Draft, Approve and lock on a Prepared estimate whose figures are current (Recalculate is offered only once they are cleared or the rates changed).
      // Chosen by the state, not found at run time: a Draft that lost its Calculate button must fail here, not jump to Approve (QLT-833-19).
      const target = prepared ? '#review-approve' : '#review-calculate';
      await expect(page.locator(target), `the action row has ${target}`).toHaveCount(1);
      await page.evaluate((id) => {
        window.location.hash = id;
      }, target);
      chunk.release();
      await formIsDrawn(page);

      const after = await documentTop(actions);
      expect(Math.abs(after - before), `#review-actions moved from ${String(before)} to ${String(after)} px at the swap`).toBeLessThanOrEqual(MOVE_AT_MOST_PX);
      await expect(page.locator(target)).toBeInViewport();
      // The form asks for its picture control as soon as it is drawn: the person meets that arrival straight after the swap, so the fully loaded page is held to the same bar (QLT-833-13).
      await pictureControlHere(page);
      const loaded = await documentTop(actions);
      expect(Math.abs(loaded - before), `#review-actions moved from ${String(before)} to ${String(loaded)} px once the picture control had arrived`).toBeLessThanOrEqual(MOVE_AT_MOST_PX);
      await expect(page.locator(target)).toBeInViewport();
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

  test("PF-17: the Lead's review of an Approved estimate (read-only, the picture box is the thumbnail alone): #review-actions moves no more than 8 px at the swap and once the picture control is here", async ({ page }, testInfo) => {
    // Approved through the API by the set-up Lead (a price that differs is an override, which needs no reason): no person is made (DL-422).
    const { code, estimateId } = await assignedEstimate(page, testInfo, true);
    const headers = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
    const costs = await page.request.get(`/api/v1/estimates/${estimateId}/costs`);
    expect(costs.status(), "the Lead's read of the costs").toBe(200);
    const { calculationId } = (await costs.json()) as { calculationId: string };
    const approved = await page.request.post(`/api/v1/estimates/${estimateId}/approve`, { headers, data: { calculationId, price: '1.00' } });
    expect(approved.status(), 'the approval').toBe(200);

    const chunk = await holdFieldsChunk(page);
    await page.goto(`/estimates/${code}`, { waitUntil: 'domcontentloaded' });
    await placeholderIsShown(page);
    await expect.poll(() => chunk.held(), { message: 'the fields chunk is being held' }).toBeGreaterThan(0);
    const actions = page.locator('#review-actions');
    await expect(actions).toBeVisible();
    const before = await documentTop(actions);
    chunk.release();
    await formIsDrawn(page);
    const after = await documentTop(actions);
    expect(Math.abs(after - before), `#review-actions moved from ${String(before)} to ${String(after)} px at the swap`).toBeLessThanOrEqual(MOVE_AT_MOST_PX);
    await pictureControlHere(page);
    const loaded = await documentTop(actions);
    expect(Math.abs(loaded - before), `#review-actions moved from ${String(before)} to ${String(loaded)} px once the picture control had arrived`).toBeLessThanOrEqual(MOVE_AT_MOST_PX);
  });

  // The notice appears in every state that has a current calculation and is not Approved: a Prepared estimate, and a Draft that was unlocked (STORY-06.11 AC-10, rates-changed.spec.ts). The keyboard path runs in both (DL-465 note 7).
  for (const unlocked of [false, true]) {
    const state = unlocked ? 'an unlocked Draft' : 'a Prepared estimate';
    test(`the rates-changed notice's own link, focused and pressed with Enter before the swap, on ${state}, ends with Recalculate on the screen (the keyboard path of DL-465 (3) (i))`, async ({ page }, testInfo) => {
      // The state of rates-changed.spec.ts: calculated on a material of the test's own whose price changed after. No person is made (the set-up Lead and Engineer); the material is not a person.
      const materialId = await insertPrivateMaterial({ pricePerKg: '137.37', specificGravity: '7.37', scrapRate: '27.37' });
      const { code, estimateId } = await assignedEstimate(page, testInfo, true, materialId);
      await changePrivateMaterial(materialId, { pricePerKg: '9137.73', specificGravity: '7.37', scrapRate: '27.37' });
      if (unlocked) {
        // As rates-changed.spec.ts:319: the Lead approves and unlocks through the API; the figures stay current and the rates are still changed.
        const headers = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
        const costs = await page.request.get(`/api/v1/estimates/${estimateId}/costs`);
        expect(costs.status(), "the Lead's read of the costs").toBe(200);
        const { calculationId } = (await costs.json()) as { calculationId: string };
        const approved = await page.request.post(`/api/v1/estimates/${estimateId}/approve`, { headers, data: { calculationId, price: '48271.37' } });
        expect(approved.status(), 'the approval').toBe(200);
        const unlock = await page.request.post(`/api/v1/estimates/${estimateId}/unlock`, { headers, data: { reason: 'The customer asked for a new fixture.' } });
        expect(unlock.status(), 'the unlock').toBe(200);
      }
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
      // And once the picture control has arrived as well (QLT-833-13).
      await pictureControlHere(page);
      await expect(page.locator('#review-calculate')).toBeInViewport();
    });
  }

  test("the Engineer's workspace, whole load (PF-6, PF-7, PF-15), and the second wait of another row (PF-14f): the ghost is on the screen from the first paint while the tree is read, 'Choose a part' is not, and the form area moves no more than 24 px when the form replaces it", async ({ page }, testInfo) => {
    // DEF-085 (DL-469) seeds the Engineer's form with its first row, and the page draws the ghost from the same bodies, so the first wait is the ghost (it was the three bars) and there is no second wait for the first row.
    // The tree is the one read left before the form can be drawn: it is held here, so the first-wait ghost is what is on the screen, and released to measure the swap.
    const { code, estimateId } = await assignedEstimate(page, testInfo, false);
    await signInAs(page, E2E_ENGINEER);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held = 0;
    await page.route(/\/api\/v1\/estimates\/[^/]+\/tree$/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      held += 1;
      await gate;
      await route.continue();
    });
    await page.goto(`/estimates/${code}`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => held, { message: 'the tree read is being held' }).toBeGreaterThan(0);
    // PF-6: drawn by the server, so it is there while the page's own code has read nothing; PF-7: while the tree is unread, the ghost and not the untrue "Choose a part".
    await placeholderIsShown(page);
    await expect(page.getByText('Choose a part')).toHaveCount(0);
    const areaBefore = await page.locator('[data-form-area]').evaluate((element) => element.getBoundingClientRect().height);
    release();
    await formIsDrawn(page);
    // PF-14f, PF-15: the ghost is a new part's shape (the definition's defaults, never the saved values, as PF-15 rules), so the form area changes by at most 24 px (one wrapped status line plus the 8 px) over the whole load.
    const areaAfter = await page.locator('[data-form-area]').evaluate((element) => element.getBoundingClientRect().height);
    expect(Math.abs(areaAfter - areaBefore), `the form area changed from ${String(areaBefore)} to ${String(areaAfter)} px`).toBeLessThanOrEqual(ENGINEER_MOVE_AT_MOST_PX);
    // QLT-836-04: the second wait (the part's values are read, `PartFields`) is still there on every row but the seeded one, and its swap is measured too: the estimate gets a second row with the request the "+" sends
    // (no person), the page is drawn again, the second row is chosen with its `/nodes/{id}` read held, and the form area moves by at most the same 24 px when its form replaces the ghost.
    const added = await page.request.post(`/api/v1/estimates/${estimateId}/nodes`, { headers: { origin: DEVELOPMENT_URL }, data: { parentId: null, nodeKind: 'MAIN_ASSEMBLY' } });
    expect(added.status()).toBe(201);
    await page.reload();
    await formIsDrawn(page);
    let releaseValues: () => void = () => undefined;
    const valuesGate = new Promise<void>((resolve) => {
      releaseValues = resolve;
    });
    let valuesHeld = 0;
    await page.route(/\/api\/v1\/estimates\/[^/]+\/nodes\/[^/]+$/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      valuesHeld += 1;
      await valuesGate;
      await route.continue();
    });
    await showTree(page);
    await tree(page).locator('a[data-part-id]').nth(1).click();
    await expect.poll(() => valuesHeld, { message: "the second row's values read is being held" }).toBeGreaterThan(0);
    await expect(page.locator('[data-part-ghost]')).toBeVisible();
    const secondBefore = await page.locator('[data-form-area]').evaluate((element) => element.getBoundingClientRect().height);
    releaseValues();
    await formIsDrawn(page);
    const secondAfter = await page.locator('[data-form-area]').evaluate((element) => element.getBoundingClientRect().height);
    expect(Math.abs(secondAfter - secondBefore), `the second wait: the form area changed from ${String(secondBefore)} to ${String(secondAfter)} px`).toBeLessThanOrEqual(ENGINEER_MOVE_AT_MOST_PX);
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
