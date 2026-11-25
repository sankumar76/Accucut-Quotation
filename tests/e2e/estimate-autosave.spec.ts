import { expect, test, type Page } from '@playwright/test';

import { useFreshAddress } from './support/auth';
import { horizontalOverflow } from './support/design-system';
import { control, expectFormAccessible, isPatchOfInputs, nextSave, NUMBER_RULE, openForm, partForm, waitForForm } from './support/part-form';

/**
 * STORY-05.10 (AC-1 to AC-5, AC-7a to AC-7c, AC-9): the 30-second save, and the save at once when the tab is hidden or the page is left, for an Engineer, at 360x800, 768x1024 and 1366x768. Time is Playwright's clock (`page.clock`), installed before the page opens so the page's one
 * timer is a fake one, and a tick is `fastForward`: no test waits 30 real seconds (AQP-344). Typing is with the keyboard and the field keeps focus the whole time, because the subject is a tick that runs
 * while the person is typing. A save that cannot be sent is made by refusing the route of the save (`route.abort`). The words are the story's, written out here and not imported, so a changed sentence
 * fails a test. What the server does with a value that is equal after normalisation is judged in `tests/integration/estimates/revision-rules.test.ts`; the rest of the rules (a hidden tab, a save in
 * flight, a conflict, Calculate) in `tests/unit/estimate-autosave*.test.ts`. Every name and path is invented.
 *
 * The save on hide and on leaving (QLT-F-05, #687) is the end of the same case: the page is sent `visibilitychange` to hidden and `pagehide` by script, with no clock moved, so a request that follows is not a tick's.
 * Playwright cannot see a request's `keepalive`, so a recorder wrapped round the page's `fetch` says which saves asked for it. Closing a real tab is not used: it raises the browser's own prompt on leaving.
 *
 * Signing in and opening the form is most of a test's time, so this is one case on one page with one axe scan. It is one case and not three also because the shards deal the suite out in groups: the
 * shard-balance guard (`tests/unit/e2e-shards.test.ts`) passes with this file's count and failed with two or three cases (a spread of 2 where it allows 1).
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context }) => {
  test.setTimeout(90_000);
  await useFreshAddress(context);
});

const SAVE_ROUTE = '**/api/v1/estimates/*/nodes/*/inputs';
const TICK_MS = 30_000;
// The recipe's estimate already has a first write (its part is created with one), so the line always begins with the time of the last save.
const SAVED_LINE = /^Last saved .+ IST\. Auto-save every 30 s\.$/;
const FAILED_LINE = /^Last saved .+ IST\. Auto-save every 30 s\. Auto-save could not save at \d{2}:\d{2} IST\. What you typed is kept\. Press Save draft to try again\.$/;

/** The one status line of saving, under the part form's title. */
const statusLine = (page: Page) => partForm(page).locator('[data-last-saved]');

/** The saves this page has sent so far. */
function countSaves(page: Page): { readonly count: () => number } {
  let sent = 0;
  page.on('request', (request) => {
    if (isPatchOfInputs(request.url(), request.method())) sent += 1;
  });
  return { count: () => sent };
}

/** From now on, records in the page whether each save of a part asked to survive the page going away (`keepalive`). A reload takes it away, so it is installed again after one. */
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

/** The page has had time to send something if it was going to: a fast-forwarded tick runs at once, so a short real wait is enough to see that no request followed. */
const settleSilently = (page: Page): Promise<void> => page.waitForTimeout(300);

test.describe('STORY-05.10: autosave every 30 seconds', () => {
  test('AC-1 to AC-5, AC-9: a typed value is saved by the tick while the field keeps focus; nothing unsaved sends nothing; a value the rule refuses is not sent and has no message until the field is left; a failed tick says so once in a status, not an alert, and the next good tick clears it', async ({ page }, testInfo) => {
    await page.clock.install();
    await openForm(page, testInfo);
    const saves = countSaves(page);

    // AC-4, AC-9: the one status line is a polite live region from the first paint and holds the words; it wraps inside the header with no sideways scroll; axe finds nothing.
    await expect(statusLine(page)).toHaveAttribute('role', 'status');
    await expect(statusLine(page)).toHaveText(SAVED_LINE);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectFormAccessible(page);

    // AC-1, AC-3: a value that is typed and not left is saved by the tick; focus stays and the text is not rewritten (12.5 is not shown as 12.50 until the field is left); nothing is said under any field.
    await control(page, 'J').fill('12.5');
    const saved = nextSave(page, 'J');
    await page.clock.fastForward(TICK_MS);
    expect(await saved).toBe(200);
    await expect(statusLine(page)).toHaveText(SAVED_LINE);
    await expect(control(page, 'J')).toBeFocused();
    await expect(control(page, 'J')).toHaveValue('12.5');
    await expect(partForm(page).getByRole('alert')).toHaveCount(0);
    expect(saves.count()).toBe(1);

    // AC-2: nothing is unsaved now, so the next tick sends nothing.
    await page.clock.fastForward(TICK_MS);
    await settleSilently(page);
    expect(saves.count()).toBe(1);

    // AC-1: after a reload the value is there.
    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('12.50');
    await expect(statusLine(page)).toHaveText(SAVED_LINE);

    // AC-3: three decimals is refused by the rule, but it is still being typed: nothing is sent, nothing is said, focus stays; the message comes when the field is left.
    await control(page, 'J').fill('1.234');
    await page.clock.fastForward(TICK_MS);
    await settleSilently(page);
    expect(saves.count()).toBe(1);
    await expect(partForm(page).getByText(NUMBER_RULE)).toHaveCount(0);
    await expect(control(page, 'J')).toBeFocused();
    await control(page, 'J').blur();
    await expect(partForm(page).getByText(NUMBER_RULE)).toBeVisible();

    // AC-5: a good value is typed, and the connection is lost when the tick runs: what was typed stays, and one polite status says so. It is not an alert.
    await page.route(SAVE_ROUTE, (route) => route.abort('failed'));
    await control(page, 'J').fill('7');
    await page.clock.fastForward(TICK_MS);
    await expect(statusLine(page)).toHaveText(FAILED_LINE);
    await expect(statusLine(page)).toHaveAttribute('role', 'status');
    await expect(partForm(page).getByRole('alert')).toHaveCount(0);
    await expect(control(page, 'J')).toHaveValue('7');
    await expect(control(page, 'J')).toBeFocused();

    // The connection is back: the next tick saves it, and the failure goes.
    await page.unroute(SAVE_ROUTE);
    const savedAgain = nextSave(page, 'J');
    await page.clock.fastForward(TICK_MS);
    expect(await savedAgain).toBe(200);
    await expect(statusLine(page)).toHaveText(SAVED_LINE);
    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('7.00');

    // AC-7a, AC-7c: the tab becomes hidden with a value typed and no tick due: it is saved at once, by a request that asked to survive the page going away; focus stays and nothing is said. The page is then
    // left as a closing tab does (hidden, then pagehide): the same text is not sent twice. After a reload the value is there.
    await recordKeepalive(page);
    await control(page, 'J').fill('8');
    const before = saves.count();
    const savedOnHide = nextSave(page, 'J');
    await tabHidden(page);
    expect(await savedOnHide).toBe(200);
    await expect(control(page, 'J')).toBeFocused();
    await expect(partForm(page).getByRole('alert')).toHaveCount(0);
    await pageLeft(page);
    await settleSilently(page);
    expect(saves.count()).toBe(before + 1);
    expect(await recordedKeepalive(page)).toEqual([true]);
    await tabShown(page);
    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('8.00');

    // AC-7a, AC-7f: a tab that is hidden with nothing unsaved sends nothing.
    await recordKeepalive(page);
    const quiet = saves.count();
    await tabHidden(page);
    await tabShown(page);
    await settleSilently(page);
    expect(saves.count()).toBe(quiet);

    // AC-7b: the page is left (pagehide) with a value typed: it is saved at once, with a request that asked to survive, and after a reload it is there.
    await control(page, 'J').fill('9');
    const savedOnLeave = nextSave(page, 'J');
    await pageLeft(page);
    expect(await savedOnLeave).toBe(200);
    expect(await recordedKeepalive(page)).toEqual([true]);
    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('9.00');
  });
});
