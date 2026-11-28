import { expect, test, type Page, type Request, type Response } from '@playwright/test';

import { assignedEstimate } from './support/assigned-estimate';

/**
 * DEF-150 PROBE ON MASTER (AQP-507; DL-482 (6c)). **DO NOT MERGE.** Tests only: no product code is changed, so every case runs against master as it is. The question the probe answers: does DEF-150 (a refresh
 * asked for after the Lead's first real save overwrites a row link pressed after it) exist on master, in CI, at the three widths? **Red** (the row reverted, or the typed text missing) means DEF-150 is real on master
 * and #847 resumes with that red first. **Green** means the widening is withdrawn.
 *
 * Natural timing throughout: no timer is held, no refresh is held, and no fix is assumed. Each case runs three times at each width (`repeat 1..3` in the title), with no retry (`retries: 0`), so a red is an attempt-1
 * red. What each run saw is printed as one `DEF150-PROBE` line (the width, the case, the repeat, the page-data requests with their times, and the final address, row and text) so a green can be read too.
 *
 *   Case 1: a row link is pressed INSIDE the 300 ms window after the first real save (the click is made in the page the moment the save's answer reaches the test), then text is typed in the second row.
 *   Case 2: the page for the pressed row is SLOW to arrive (held at a route past the quiet period), then let go; then text is typed in the second row.
 *   Case 3: QA's case C (qa-u2 `def150-c.spec.ts`, adapted): as case 1, then the page is watched, Back is pressed (the leave guard asks), "Keep editing" is chosen and the row and the text are read again.
 *
 * The person ledger is +0 (DL-422): the task is made through the API by the set-up's Lead for the set-up's Engineer. Every name and path is invented.
 */

const OLD_ROW = '1.1';
const NEW_ROW = '1';
const FIRST = 'Invented description, first save';
const TYPED = 'Invented text typed in the second row';
const REPEATS = [1, 2, 3] as const;
/** The time the page is watched after the text is typed: the quiet period is 300 ms, so this is ten times it, for a refresh that comes late. */
const WATCH_MS = 3000;

const description = (page: Page) => page.getByRole('textbox', { name: /Description/ }).first();
const treePanel = (page: Page) => page.locator('details').filter({ has: page.locator('summary', { hasText: /^Parts tree/ }) });
const rowLink = (page: Page, row: string) => treePanel(page).locator(`a[href*="row=${row}#row-inputs"]`).first();
const isSave = (response: Response): boolean => response.request().method() !== 'GET' && /\/api\/v1\/estimates\/[^/]+\/nodes\/[^/]+(\/inputs)?$/.test(new URL(response.url()).pathname);

/** A request for the page's own data (the router's RSC fetch, not a prefetch). */
const isPageData = (request: Request): boolean => {
  const url = new URL(request.url());
  return request.method() === 'GET' && url.pathname.startsWith('/estimates/') && url.searchParams.has('_rsc') && request.headers()['next-router-prefetch'] === undefined;
};
const isPageDataFor = (request: Request, row: string): boolean => isPageData(request) && new URL(request.url()).searchParams.get('row') === row;

/** Below 1024 px the tree is a foldable panel: it is opened before the save, so pressing a row link needs no other click. */
async function openTree(page: Page): Promise<void> {
  const open = await treePanel(page).evaluate((panel) => (panel as HTMLDetailsElement).open);
  if (!open) await treePanel(page).locator('summary').click();
  await expect(rowLink(page, NEW_ROW)).toBeVisible();
}

/** Two animation frames: the page has drawn what it was given. */
const drawn = (page: Page): Promise<unknown> => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

/** Waits in the page for `ms`: the quiet period, and a refresh that comes late, are timers in the page, and the probe watches them run. */
const watch = (page: Page, ms: number): Promise<unknown> => page.evaluate((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)), ms);

/** What the page's data requests were, with the time from the start of the case: the page-data requests of the refresh and of the navigation, in order. */
function recordPageData(page: Page): { readonly lines: () => string[]; readonly inFlight: () => number } {
  const started = Date.now();
  const lines: string[] = [];
  let inFlight = 0;
  page.on('request', (request) => {
    if (!isPageData(request)) return;
    inFlight += 1;
    lines.push(`+${Date.now() - started}ms row=${new URL(request.url()).searchParams.get('row') ?? '-'}`);
  });
  const done = (request: Request): void => {
    if (isPageData(request)) inFlight -= 1;
  };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  return { lines: () => lines, inFlight: () => inFlight };
}

/** Where the page is and what it shows: the address, the row the form is drawn for, and the text in the Description box. */
async function readState(page: Page): Promise<{ readonly url: string; readonly title: string; readonly text: string }> {
  const url = await page.evaluate(() => `${location.pathname}${location.search}${location.hash}`);
  const title = (await page.locator('#part-form-title').textContent()) ?? '';
  const text = await description(page).inputValue();
  return { url, title: title.trim(), text };
}

/** The probe's one result line: grep `DEF150-PROBE` in the CI log. */
function report(testInfo: { readonly project: { readonly name: string } }, label: string, requests: readonly string[], state: { readonly url: string; readonly title: string; readonly text: string }): void {
  process.stdout.write(`DEF150-PROBE ${testInfo.project.name} | ${label} | page-data requests ${JSON.stringify(requests)} | url ${state.url} | form "${state.title}" | text "${state.text}"\n`);
}

/** Opens the review of a Prepared estimate at the old row, with the form ready to take a value. */
async function openReview(page: Page, code: string): Promise<void> {
  await page.goto(`/estimates/${code}?row=${OLD_ROW}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('form[data-part-form]')).toBeVisible();
  await expect(description(page)).toBeEnabled();
  await openTree(page);
}

/** The first real save takes the figures from current to cleared, and the Lead's form asks for the page to be drawn again after a quiet period of 300 ms. */
async function firstSave(page: Page): Promise<void> {
  const saved = page.waitForResponse(isSave);
  await description(page).fill(FIRST);
  await description(page).blur();
  expect((await saved).status(), 'the first save').toBe(200);
}

/**
 * Presses the row link IN THE PAGE the moment the save's answer reaches the test (no waiting for the link to be actionable), so the press is inside the 300 ms window. Answers how many milliseconds the press took
 * to run after the answer reached the test. Register it before the save is made.
 */
function pressOnSaveAnswer(page: Page, row: string): Promise<number> {
  return new Promise((resolve) => {
    const onResponse = (response: Response): void => {
      if (!isSave(response)) return;
      page.off('response', onResponse);
      const answered = Date.now();
      void page.evaluate((selector) => (document.querySelector(selector) as HTMLAnchorElement | null)?.click(), `a[href*="row=${row}#row-inputs"]`).then(() => resolve(Date.now() - answered));
    };
    page.on('response', onResponse);
  });
}

/** The pressed row is the one shown, at its address, with the text typed in it. The label says which moment is being read, so a red says where. */
async function expectRowAndText(page: Page, label: string): Promise<void> {
  const state = await readState(page);
  expect(state.url, `${label}: the address`).toMatch(/row=1#row-inputs$/);
  expect(state.title, `${label}: the row the form is drawn for`).toMatch(/^1 ·/);
  expect(state.text, `${label}: the text typed in the second row`).toBe(TYPED);
}

test.describe('DEF-150 probe on master (DO NOT MERGE)', () => {
  // A red is an attempt-1 red (DL-482 (6c)): no retry hides it.
  test.describe.configure({ retries: 0 });

  for (const repeat of REPEATS) {
    test(`case 1: a row link pressed inside the 300 ms window after the first save, then text typed (repeat ${repeat})`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      const { code } = await assignedEstimate(page, testInfo, true);
      await openReview(page, code);
      const requests = recordPageData(page);

      const pressed = pressOnSaveAnswer(page, NEW_ROW);
      await firstSave(page);
      const after = await pressed;
      await expect(page).toHaveURL(/row=1#row-inputs$/);
      await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
      await expect(description(page)).toBeEnabled();
      await description(page).fill(TYPED);
      await watch(page, WATCH_MS);
      await expect.poll(() => requests.inFlight(), { message: 'page-data requests still in flight' }).toBe(0);
      await drawn(page);
      await drawn(page);

      report(testInfo, `case 1 repeat ${repeat} (link pressed ${after} ms after the save answer)`, requests.lines(), await readState(page));
      await expectRowAndText(page, 'after the watch');
    });

    test(`case 2: the page for the pressed row is slow to arrive, past the quiet period, then text typed (repeat ${repeat})`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      const { code } = await assignedEstimate(page, testInfo, true);
      // The page for the pressed row is held at the route until the probe lets it go; every other request goes on.
      let release: () => void = () => undefined;
      const slow = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(
        (url) => url.pathname === `/estimates/${code}` && url.searchParams.has('_rsc'),
        async (route) => {
          if (isPageDataFor(route.request(), NEW_ROW)) await slow;
          await route.continue();
        },
      );
      await openReview(page, code);
      const requests = recordPageData(page);

      await firstSave(page);
      const newPageAsked = page.waitForRequest((request) => isPageDataFor(request, NEW_ROW));
      await rowLink(page, NEW_ROW).click();
      await newPageAsked;
      // The new page is on its way and has not arrived; the quiet period (300 ms) runs out meanwhile, and the probe watches for a refresh that is sent in that time.
      await watch(page, WATCH_MS);
      const arrived = page.waitForResponse((response) => isPageDataFor(response.request(), NEW_ROW));
      release();
      await arrived;
      await expect(page).toHaveURL(/row=1#row-inputs$/);
      await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
      await expect(description(page)).toBeEnabled();
      await description(page).fill(TYPED);
      await watch(page, WATCH_MS);
      await expect.poll(() => requests.inFlight(), { message: 'page-data requests still in flight' }).toBe(0);
      await drawn(page);
      await drawn(page);

      report(testInfo, `case 2 repeat ${repeat}`, requests.lines(), await readState(page));
      await expectRowAndText(page, 'after the watch');
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });

    test(`case 3 (QA's C): a link pressed inside the window, text typed, watched, Back, Keep editing (repeat ${repeat})`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      const { code } = await assignedEstimate(page, testInfo, true);
      await openReview(page, code);
      const requests = recordPageData(page);

      const pressed = pressOnSaveAnswer(page, NEW_ROW);
      await firstSave(page);
      const after = await pressed;
      await expect(page).toHaveURL(/row=1#row-inputs$/);
      await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
      await expect(description(page)).toBeEnabled();
      await description(page).fill(TYPED);
      await watch(page, WATCH_MS);
      await expect.poll(() => requests.inFlight(), { message: 'page-data requests still in flight' }).toBe(0);
      await drawn(page);
      const beforeBack = await readState(page);
      report(testInfo, `case 3 repeat ${repeat} before Back (link pressed ${after} ms after the save answer)`, requests.lines(), beforeBack);
      await expectRowAndText(page, 'before Back');

      // Back with the text unsaved: the leave guard asks, and "Keep editing" is chosen. What the guard does on its own is #845's, so a missing dialog is reported and not failed here.
      await page.evaluate(() => window.history.back());
      const keep = page.getByRole('alertdialog').getByRole('button', { name: 'Keep editing', exact: true });
      const asked = await keep.waitFor({ state: 'visible', timeout: 5000 }).then(
        () => true,
        () => false,
      );
      if (!asked) {
        // The page may have left the estimate: only where it is now is read, and nothing is asserted about the row or the text.
        process.stdout.write(`DEF150-PROBE ${testInfo.project.name} | case 3 repeat ${repeat} after Back (no dialog appeared) | url ${await page.evaluate(() => `${location.pathname}${location.search}${location.hash}`)}\n`);
        return;
      }
      await keep.click();
      await drawn(page);
      await drawn(page);
      report(testInfo, `case 3 repeat ${repeat} after Back and Keep editing`, requests.lines(), await readState(page));
      await expectRowAndText(page, 'after Back and Keep editing');
    });
  }
});
