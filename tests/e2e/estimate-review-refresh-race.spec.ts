import { expect, test, type Page, type Request } from '@playwright/test';

import { assignedEstimate } from './support/assigned-estimate';

/**
 * DEF-150 (AQP-507; DL-481): **a refresh never overwrites a navigation made after it was asked for.** The first real save on a Prepared estimate takes its figures from current to cleared, and the Lead's form asks
 * for the page to be drawn again (a quiet period of 300 ms, then ``router.refresh()`). A row link pressed while that refresh is on its way draws the page for the new row; when the refresh, sent for the old address, commits
 * after it, Next writes the router's last address over the new one and the page shows the earlier row again, with whatever the person typed in the row they had chosen.
 *
 * The refresh is held with a route (a deterministic hold, not a wait): the RSC request for the old address is answered only when the test lets it go. In between a row link is pressed and text is typed in the row it
 * opens. After the refresh has been answered and the page has drawn, the row that was pressed is still open, with the address of that row and the text still in its box. **The person ledger is +0 (DL-422):** the
 * task is made through the API by the set-up's Lead for the set-up's Engineer. Every name and path is invented.
 */

const FIRST = 'Invented description, first save';
const TYPED = 'Invented text typed in the second row';

const description = (page: Page) => page.getByRole('textbox', { name: /Description/ }).first();
const treePanel = (page: Page) => page.locator('details').filter({ has: page.locator('summary', { hasText: /^Parts tree/ }) });
const rowLink = (page: Page, row: string) => treePanel(page).locator(`a[href*="row=${row}#row-inputs"]`).first();
const savedAnswer = (page: Page) => page.waitForResponse((response) => response.request().method() !== 'GET' && /\/api\/v1\/estimates\/[^/]+\/nodes\/[^/]+(\/inputs)?$/.test(new URL(response.url()).pathname));

/** A request for the page's own data (the router's RSC fetch) for this estimate and this row. */
const isPageDataFor = (request: Request, code: string, row: string): boolean => {
  const url = new URL(request.url());
  return request.method() === 'GET' && url.pathname === `/estimates/${code}` && url.searchParams.has('_rsc') && url.searchParams.get('row') === row;
};

/** Below 1024 px the tree is a foldable panel: it is opened before a row is chosen. */
async function chooseRow(page: Page, row: string): Promise<void> {
  const open = await treePanel(page).evaluate((panel) => (panel as HTMLDetailsElement).open);
  if (!open) await treePanel(page).locator('summary').click();
  await rowLink(page, row).click();
}

/** Two animation frames: the page has drawn what it was given (a commit is not "the response headers"). */
const drawn = (page: Page): Promise<unknown> => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test.describe('DEF-150: a late refresh does not take the page back to the earlier row', () => {
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('a row link is pressed while the refresh after the first save is on its way: the pressed row stays open, with its address and the text typed in it', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    // The refresh for the address the form is drawn at (row 1.1) is held until the test lets it go.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held = false;
    await page.route(
      (url) => url.pathname === `/estimates/${code}` && url.searchParams.has('_rsc'),
      async (route) => {
        if (!held && isPageDataFor(route.request(), code, '1.1')) {
          held = true;
          await gate;
        }
        await route.continue();
      },
    );
    await page.goto(`/estimates/${code}?row=1.1`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await expect(description(page)).toBeEnabled();

    // The first save of a Prepared estimate asks for the page to be drawn again; its request reaches the route and waits there.
    const refreshAsked = page.waitForRequest((request) => isPageDataFor(request, code, '1.1'));
    const saved = savedAnswer(page);
    await description(page).fill(FIRST);
    await description(page).blur();
    expect((await saved).status(), 'the first save').toBe(200);
    await refreshAsked;

    // While it is held, another row is pressed and text is typed there.
    await chooseRow(page, '1');
    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    await expect(description(page)).toBeEnabled();
    await description(page).fill(TYPED);

    // The refresh is let go and answered, and the page draws what it was given.
    const answered = page.waitForResponse((response) => isPageDataFor(response.request(), code, '1.1'));
    release();
    await answered;
    await drawn(page);
    await drawn(page);

    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    await expect(description(page)).toHaveValue(TYPED);
  });

  test('a row link pressed straight after the first save (inside the quiet period) also stays: the page is not taken back', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await page.goto(`/estimates/${code}?row=1.1`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await expect(description(page)).toBeEnabled();
    const saved = savedAnswer(page);
    await description(page).fill(FIRST);
    await description(page).blur();
    expect((await saved).status(), 'the first save').toBe(200);
    await chooseRow(page, '1');
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    // Whatever the page does next (a refresh for the old address must not be sent), it ends on the pressed row.
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await drawn(page);
    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
  });
});
