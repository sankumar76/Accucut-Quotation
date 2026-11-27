import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { useFreshAddress } from './support/auth';
import { control, nextSave, openForm, partForm, waitForForm } from './support/part-form';

/**
 * STORY-05.10 AC-7a to AC-7c (amended 2026-11-25, QLT-F-05, #687): the save at once when the tab is hidden and when the page is left, for an Engineer, at 360x800, 768x1024 and 1366x768. It is a case of its
 * own, apart from the 30-second tick's (`estimate-autosave.spec.ts`, unchanged), so these cases keep the project's default time (no `setTimeout`, DL-404 (1)): one sign-in, one part form, two saves and one reload, and no wait on time.
 * The page is sent `visibilitychange` to hidden and `pagehide` by script, and no clock is moved, so a request that follows is not a tick's. Playwright cannot see a request's `keepalive`, so a recorder
 * wrapped round the page's `fetch` says which saves asked for it. Closing a real tab is not used: it raises the browser's own prompt on leaving. What a hide with nothing unsaved, a duplicate, a
 * conflict, a failure and a read-only estimate do is judged in `tests/unit/estimate-autosave*.test.ts`. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

/** From now on, records in the page whether each save of a part asked to survive the page going away (`keepalive`). A reload takes it away. */
const recordKeepalive = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const recorded: boolean[] = [];
    const scope = window as unknown as { __savesKeepalive: boolean[] };
    scope.__savesKeepalive = recorded;
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (init?.method === 'PATCH' && String(input).endsWith('/inputs')) recorded.push(init.keepalive === true);
      return original(input, init);
    };
  });
const recordedKeepalive = (page: Page): Promise<boolean[]> => page.evaluate(() => (window as unknown as { __savesKeepalive: boolean[] }).__savesKeepalive);

/** The tab becomes hidden: the browser's `visibilitychange` with `visibilityState` hidden, and back. */
const tabHidden = (page: Page): Promise<void> =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
const tabShown = (page: Page): Promise<void> =>
  page.evaluate(() => {
    Reflect.deleteProperty(document, 'visibilityState');
    document.dispatchEvent(new Event('visibilitychange'));
  });
/** The page is left: the browser's `pagehide`. */
const pageLeft = (page: Page): Promise<void> => page.evaluate(() => void window.dispatchEvent(new Event('pagehide')));

/**
 * DEF-146 (AQP-503; DL-430, DL-466): the old case was one test that signed an Engineer in, loaded the part form (the costly step), then did the hide, the leave and the reload. It is now **three cases on one page**, in
 * one serial group, split where the old case's steps already fell: the page is made and loaded once, in `beforeAll` (the sign-in, the form load and the start of the keepalive record, in the old case's order), with the
 * same address (`useFreshAddress`), storage state, viewport and touch setting as the project gives every case. Case A is AC-7a and AC-7c (the hide, the save, the leave, the one request); case B is AC-7b (a new value
 * and the leave); case C is the reload and the value that is there. Each starts from the page as the case before it left it, as the old case went on. A failure of one skips the ones after it and a retry runs the whole
 * group again from `beforeAll`, so the retry and coverage semantics are the old case's. Every assertion is kept, in its order. No timeout, wait, force or budget is set, raised or lowered anywhere here.
 */
test.describe('STORY-05.10: autosave on hide and on leaving: one page, three steps', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }, testInfo) => {
    const { baseURL, viewport, hasTouch } = testInfo.project.use;
    context = await browser.newContext({ storageState: { cookies: [], origins: [] }, ...(baseURL === undefined ? {} : { baseURL }), ...(viewport === undefined ? {} : { viewport }), ...(hasTouch === undefined ? {} : { hasTouch }) });
    await useFreshAddress(context);
    page = await context.newPage();
    await openForm(page, testInfo);
    await recordKeepalive(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('AC-7a and AC-7c: a typed value is saved at once when the tab is hidden, with no tick, no focus move and no message; a hide then a leave of the same text is one request', async () => {
    // AC-7a: a value is typed and the tab becomes hidden. No tick is due (the clock is the real one and 30 s have not passed): the value is saved at once. Focus stays and nothing is said.
    await control(page, 'J').fill('8');
    const savedOnHide = nextSave(page, 'J');
    await tabHidden(page);
    expect(await savedOnHide).toBe(200);
    await expect(control(page, 'J')).toBeFocused();
    await expect(partForm(page).getByRole('alert')).toHaveCount(0);

    // AC-7c: the page is then left, as a closing tab does (hidden, then pagehide): the same text is not sent again.
    await pageLeft(page);
    // A request the page sends after the leave and that is answered: any save the leave had queued has been sent by then, so the record is complete without a wait on time.
    expect(await page.evaluate(() => window.fetch('/api/v1/options/materials').then((answer) => answer.status))).toBe(200);
    expect(await recordedKeepalive(page)).toEqual([true]);
    await tabShown(page);
  });

  test('AC-7b: a new value is saved at once when the page is left, by a request that asked to survive', async () => {
    // AC-7b: a new value is typed and the page is left: it is saved at once, by a request that asked to survive the page going away.
    await control(page, 'J').fill('9');
    const savedOnLeave = nextSave(page, 'J');
    await pageLeft(page);
    expect(await savedOnLeave).toBe(200);
    expect(await recordedKeepalive(page)).toEqual([true, true]);
  });

  test('after a reload the last value is there', async () => {
    // After a reload the last value is there.
    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('9.00');
  });
});
