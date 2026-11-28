import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { pngOfDimensions } from '../support/pictures';

import { assignedEstimate } from './support/assigned-estimate';
import { FORM_PROP, holdChunks } from './support/hold-fields-chunk';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * DL-465 (3) with the editing island (PF-18 to PF-21; AQP-488 PR 3): **the first paint of a Lead's review holds the room of what the editing island will draw**, so the island replaces the read-only tree and the
 * inputs block with #review-actions (Recalculate, Approve and lock) moving 8 px or less. The island's code is held with a route (the one script that holds the words only the island writes), so the swap is
 * the test's and not the network's: #review-actions is measured in the first paint (ghost up, the tree's reserve in place), after the island is drawn, and again once the picture control has arrived.
 * The three widths are the three projects (360, 768 and 1366 px). A mouse in a window under 1024 px (the tree stacked above the form, a toolbar line under every row) is its own context, and so is a
 * part with a picture. The reserve is inert and invisible; Approved (no island) keeps its 2 px.
 *
 * **The person ledger is +0 (DL-422):** no person is made; the set-up's Lead makes the task through the API (`assignedEstimate`). Every name and path is invented.
 */

const MOVE_AT_MOST_PX = 8;
/** PF-22, G8-C-PICNAME: an invented file name of 200 characters, in wide letters, so it is longer than the picture box at every width. The server keeps the first 100 and the control shows one line, cut; the box is the one-line box the reserve was measured with. */
const LONG_NAME = `${'W'.repeat(196)}.png`;
/** Words only the island writes (`TREE_CLEARED_STATUS`, review-texts.ts): the script that holds them is the island's. */
const ISLAND_MARKER = /The parts changed\. Every calculated figure is cleared/;

async function documentTop(locator: Locator): Promise<number> {
  return locator.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
}

/** The form's own picture control has replaced its placeholder: the form is as tall as it will be. */
async function pictureControlHere(page: Page): Promise<void> {
  await expect(page.locator('form[data-part-form] [data-picture-zone]:not(.skeleton-shimmer)')).toBeVisible();
}

/** PF-21e: the reserve is inert and invisible: it carries no name, no control and nothing that takes the focus. */
async function reserveIsInert(page: Page): Promise<void> {
  const reserves = page.locator('[data-review-tree-reserve]');
  expect(await reserves.count(), 'the first paint holds a reserve').toBeGreaterThan(0);
  await expect(reserves.first()).toHaveAttribute('inert', '');
  for (const reserve of await reserves.all()) {
    await expect(reserve).toHaveAttribute('inert', '');
    await expect(reserve).toHaveAttribute('aria-hidden', 'true');
    expect(await reserve.locator('a, button, input, select, textarea, [tabindex], [id], [role]').count(), 'nothing in a reserve can take the focus or be named').toBe(0);
    expect(await reserve.evaluate((element) => element.hasAttribute('id') || element.hasAttribute('role') || element.hasAttribute('tabindex')), 'the reserve has no id, role or tabindex').toBe(false);
  }
  const serious = (await new AxeBuilder({ page }).include('[data-review-tree]').analyze()).violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(serious, 'axe on the first paint of the tree').toEqual([]);
}

/**
 * The three states of the page, each measured against the first paint: the ghost (both chunks held), the read-only form with its values (the fields chunk let go, the island still held), and the island (let go
 * as well), and once the picture control has arrived. #review-actions' document top is within 8 px of the first paint's at every one.
 */
async function checkSwap(page: Page, code: string, label: string): Promise<void> {
  const held = await holdChunks(page, { island: ISLAND_MARKER, fields: FORM_PROP });
  await page.goto('/estimates/' + code, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => held.island.held(), { message: "the island's code is being held" }).toBeGreaterThan(0);
  await expect.poll(() => held.fields.held(), { message: "the form's fields chunk is being held" }).toBeGreaterThan(0);
  const actions = page.locator('#review-actions');
  await expect(actions).toBeVisible();
  await expect(page.locator('[data-part-ghost]')).toBeVisible();
  await expect(page.locator('[data-part-ghost] > div')).toHaveAttribute('inert', '');
  await reserveIsInert(page);
  const before = await documentTop(actions);
  const within = async (step: string): Promise<void> => {
    const now = await documentTop(actions);
    expect(Math.abs(now - before), label + ': #review-actions moved from ' + String(before) + ' to ' + String(now) + ' px ' + step).toBeLessThanOrEqual(MOVE_AT_MOST_PX);
  };

  // The fields chunk arrives: the read-only form, with the saved values, takes the ghost's place (PF-18: content first). The reserve is still there, the island is not.
  held.fields.release();
  await expect(page.locator('form[data-part-form]')).toBeVisible();
  await expect(page.locator('[data-part-ghost]')).toHaveCount(0);
  await expect(page.locator('[data-review-tree-reserve]').first()).toBeAttached();
  // PF-21d, content first: the read-only form shows the part's values (a saved value is on the page), not a placeholder.
  expect(await page.locator('form[data-part-form] input').evaluateAll((controls) => controls.filter((control) => (control as HTMLInputElement).value !== '').length), 'a saved value is on the page at the read-only stage').toBeGreaterThan(0);
  await within('when the read-only form replaced the ghost');
  await pictureControlHere(page);
  await within('once the read-only picture control had arrived');

  // The island arrives: the reserve is gone and the tree has its toolbars.
  held.island.release();
  await expect(page.locator('[data-review-tree-reserve]')).toHaveCount(0);
  await expect(page.locator('[data-review-tree] [data-row-actions]').first()).toBeAttached();
  await within('when the island was drawn');
  await pictureControlHere(page);
  await within('once the island\'s picture control had arrived');
}

test.describe('PF-18 to PF-21: the first paint holds the island\'s room', () => {
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  for (const prepared of [false, true]) {
    const state = prepared ? 'Prepared' : 'Draft';
    test('the Lead\'s review, ' + state + ': #review-actions moves ' + String(MOVE_AT_MOST_PX) + ' px or less from the first paint to the island and once the picture control is there (PF-21a, PF-21e)', async ({ page }, testInfo) => {
      const { code } = await assignedEstimate(page, testInfo, prepared);
      await checkSwap(page, code, state);
    });
  }

  test('PF-21b: a mouse at 768 px (a fine pointer, the tree stacked above the form, a toolbar line under every row): the same bar', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'tablet', 'one window, 768 px, with a fine pointer: the projects with a touch screen are the other cases');
    const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: false, baseURL: DEVELOPMENT_URL });
    let page: Page | undefined;
    try {
      page = await context.newPage();
      const { code } = await assignedEstimate(page, testInfo, true);
      expect(await page.evaluate(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches), 'this window has a mouse').toBe(true);
      await checkSwap(page, code, 'Prepared, mouse at 768');
    } finally {
      // The route that holds the chunks is the page's, so it is the page that lets it go (a context's `unrouteAll` leaves it): a script still on its way when the test ends must not be answered into a closed context (`route.fetch: Request context disposed`).
      await page?.unrouteAll({ behavior: 'ignoreErrors' });
      await context.close();
    }
  });

  test('PF-21c: with a picture held, the editable picture box is taller than the empty one, and the move is still 8 px or less', async ({ page }, testInfo) => {
    const { code, estimateId } = await assignedEstimate(page, testInfo, false);
    const tree = (await (await page.request.get(DEVELOPMENT_URL + '/api/v1/estimates/' + estimateId + '/tree')).json()) as { nodes: ReadonlyArray<{ id: string; slNo: string }> };
    const first = tree.nodes.find((node) => node.slNo === '1');
    expect(first, 'the first row').toBeDefined();
    const put = await page.request.put(DEVELOPMENT_URL + '/api/v1/estimates/' + estimateId + '/nodes/' + (first?.id ?? '') + '/image', {
      headers: { origin: DEVELOPMENT_URL },
      multipart: { file: { name: LONG_NAME, mimeType: 'image/png', buffer: pngOfDimensions(64, 48) } },
    });
    expect(put.status(), "the Lead's picture is stored").toBeLessThan(300);
    await checkSwap(page, code, 'Draft with a picture');
  });

  test('PF-21f: an Approved estimate has no island and reserves nothing; #review-actions moves 2 px or less from the first paint to the form', async ({ page }, testInfo) => {
    // Approved through the API by the set-up Lead (a price that differs is an override, which needs no reason): no person is made (DL-422).
    const { code, estimateId } = await assignedEstimate(page, testInfo, true);
    const headers = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
    const costs = await page.request.get('/api/v1/estimates/' + estimateId + '/costs');
    expect(costs.status(), "the Lead's read of the costs").toBe(200);
    const { calculationId } = (await costs.json()) as { calculationId: string };
    const approved = await page.request.post('/api/v1/estimates/' + estimateId + '/approve', { headers, data: { calculationId, price: '1.00' } });
    expect(approved.status(), 'the approval').toBe(200);

    const chunk = (await holdChunks(page, { fields: FORM_PROP })).fields;
    await page.goto('/estimates/' + code, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => chunk.held(), { message: 'the fields chunk is being held' }).toBeGreaterThan(0);
    const actions = page.locator('#review-actions');
    await expect(actions).toBeVisible();
    await expect(page.locator('[data-review-tree-reserve]')).toHaveCount(0);
    await expect(page.locator('[data-review-tree-edit]')).toHaveCount(0);
    const before = await documentTop(actions);
    chunk.release();
    await pictureControlHere(page);
    const after = await documentTop(actions);
    expect(Math.abs(after - before), 'Approved: #review-actions moved from ' + String(before) + ' to ' + String(after) + ' px').toBeLessThanOrEqual(2);
  });
});
