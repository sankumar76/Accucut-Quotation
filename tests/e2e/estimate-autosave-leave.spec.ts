import { expect, test, type Page } from '@playwright/test';

import { useFreshAddress } from './support/auth';
import { control, nextSave, openForm, partForm, waitForForm } from './support/part-form';

/**
 * STORY-05.10 AC-7a to AC-7c (amended 2026-11-25, QLT-F-05, #687): the save at once when the tab is hidden and when the page is left, for an Engineer, at 360x800, 768x1024 and 1366x768. It is a case of its
 * own, apart from the 30-second tick's (`estimate-autosave.spec.ts`, unchanged), so this case keeps the project's default time (no `setTimeout`, DL-404 (1)): one sign-in, one part form, two saves and one reload, and no wait on time.
 * The page is sent `visibilitychange` to hidden and `pagehide` by script, and no clock is moved, so a request that follows is not a tick's. Playwright cannot see a request's `keepalive`, so a recorder
 * wrapped round the page's `fetch` says which saves asked for it. Closing a real tab is not used: it raises the browser's own prompt on leaving. What a hide with nothing unsaved, a duplicate, a
 * conflict, a failure and a read-only estimate do is judged in `tests/unit/estimate-autosave*.test.ts`. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

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

test.describe('STORY-05.10: autosave on hide and on leaving', () => {
  test('AC-7a to AC-7c: a typed value is saved at once when the tab is hidden and again when the page is left, each by a request that asked to survive, with no tick, no focus move and no message; a hide then a leave of the same text is one request; after a reload the value is there', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await recordKeepalive(page);

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

    // AC-7b: a new value is typed and the page is left: it is saved at once, by a request that asked to survive the page going away.
    await control(page, 'J').fill('9');
    const savedOnLeave = nextSave(page, 'J');
    await pageLeft(page);
    expect(await savedOnLeave).toBe(200);
    expect(await recordedKeepalive(page)).toEqual([true, true]);

    // After a reload the last value is there.
    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('9.00');
  });
});
