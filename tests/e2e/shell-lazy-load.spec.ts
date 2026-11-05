import { expect, test, type Page } from '@playwright/test';

import { PERSISTENT_MENU_MIN_WIDTH } from '../../src/lib/design-tokens';

import { E2E_LEAD, E2E_PASSWORD, signInThroughThePage, useFreshAddress } from './support/auth';
import {
  expectNoAxeViolations,
  isDesktopProject,
  tokenColour,
  waitUntilAccountMenuIsLive,
  waitUntilMenuButtonIsLive,
  widthOf,
} from './support/design-system';
import {
  ACCOUNT_MARKER,
  boxesOf,
  controlsOf,
  DRAWER_MARKER,
  layoutShifts,
  openRouteAndSettle,
  pathOf,
  ROUTES,
  ScriptGate,
  scriptsNamedInHtml,
  SLOW_REQUEST_MILLISECONDS,
  urlsContaining,
  watchLayoutShift,
} from './support/lazy-load';
import { PRODUCTION_URL } from './support/servers';

/**
 * STORY-10.13 (AQP-188): the account menu and the menu drawer load on their first open, a tap made before the page is
 * interactive is kept (DEF-013), and nothing else about them changes. Run on the production build (`next start`), because
 * the chunks are the build's own, at 360x800, 768x1024 and 1366x768, on `/` and `/queue` (`/design-system` is not in a
 * production build). AC-10 is shown 20 of 20 runs per width with `--repeat-each=20 --retries=0`.
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

// The invented Lead signs in on the production server, as `sign-in.spec.ts` does.
test.beforeEach(async ({ page, context }) => {
  await useFreshAddress(context);
  await page.goto('/sign-in');
  await signInThroughThePage(page, E2E_LEAD.email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/queue$/);
});

for (const route of ROUTES) {
  test.describe(`first open on ${route}`, () => {
    test('AC-3: nothing of the two overlays is requested or preloaded before the first open; each open requests its own code once', async ({ page }, testInfo) => {
      const gate = new ScriptGate();
      await gate.install(page);
      await openRouteAndSettle(page, route);

      const named = await scriptsNamedInHtml(page, route);
      const atLoad = [...gate.urls, ...named.map((path) => new URL(path, PRODUCTION_URL).href)];
      expect(await urlsContaining(page, atLoad, ACCOUNT_MARKER), 'account menu code requested or named at load').toEqual([]);
      expect(await urlsContaining(page, atLoad, DRAWER_MARKER), 'drawer code requested or named at load').toEqual([]);

      for (const control of controlsOf(page, testInfo.project.name)) {
        const before = gate.urls.length;
        await control.button.click();
        await expect(control.panel).toBeVisible();
        const requested = gate.urls.slice(before);
        const lazy = await urlsContaining(page, requested, control.marker);
        expect(lazy.length, `${control.name}: its code is requested by the first open`).toBeGreaterThan(0);
        expect(lazy.map(pathOf).filter((path) => named.includes(path)), `${control.name}: not named in the HTML`).toEqual([]);

        // Close it and open it again: nothing more is requested.
        await page.keyboard.press('Escape');
        await expect(control.panel).toBeHidden();
        const afterFirst = gate.urls.length;
        await control.button.click();
        await expect(control.panel).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(control.panel).toBeHidden();
        expect(gate.urls.length, `${control.name}: a later open requests nothing`).toBe(afterFirst);
      }

      if (isDesktopProject(testInfo.project.name)) {
        expect(await widthOf(page)).toBeGreaterThanOrEqual(PERSISTENT_MENU_MIN_WIDTH);
        expect(await urlsContaining(page, gate.urls, DRAWER_MARKER), 'at 1024 px and wider the drawer code is never requested').toEqual([]);
      }
    });

    test('AC-7: opening each control for the first time moves nothing and records no layout shift', async ({ page }, testInfo) => {
      await openRouteAndSettle(page, route);
      for (const control of controlsOf(page, testInfo.project.name)) {
        const before = await boxesOf(page);
        await watchLayoutShift(page);
        await control.button.click();
        await expect(control.panel).toBeVisible();
        expect(await boxesOf(page), `${control.name}: boxes after the first open`).toEqual(before);
        expect(await layoutShifts(page), `${control.name}: layout-shift entries`).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(control.panel).toBeHidden();
      }
    });

    test('AC-4, AC-5: before the first open each trigger has its role, name, aria-haspopup and aria-expanded', async ({ page }, testInfo) => {
      await openRouteAndSettle(page, route);
      const [account, drawer] = controlsOf(page, testInfo.project.name);
      if (account === undefined) throw new Error('the account menu control is always there');
      await expect(account.button).toHaveAttribute('aria-haspopup', 'menu');
      await expect(account.button).toHaveAttribute('aria-expanded', 'false');
      await expect(account.button).toHaveAccessibleName(/^Account menu, .+, Lead$/);
      if (drawer === undefined) return;
      await expect(drawer.button).toHaveAttribute('aria-haspopup', 'dialog');
      await expect(drawer.button).toHaveAttribute('aria-expanded', 'false');
      await drawer.button.click();
      await expect(drawer.panel).toBeVisible();
      await expect(page.locator('button[aria-label="Open menu"]')).toHaveAttribute('aria-expanded', 'true');
    });

    test('AC-4: the account menu opens by keyboard (Enter, Space, ArrowDown) with focus on the first enabled item; Escape returns focus to the trigger', async ({ page }) => {
      await openRouteAndSettle(page, route);
      const trigger = page.getByRole('button', { name: /^Account menu/ });
      for (const key of ['Enter', 'Space', 'ArrowDown']) {
        await trigger.focus();
        await page.keyboard.press(key);
        await expect(page.getByRole('menu')).toBeVisible();
        // "Change password" is disabled until story 01.05, so the first enabled item is "Sign out".
        await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('menu')).toBeHidden();
        await expect(trigger).toBeFocused();
      }
    });

    test('AC-4: a pointer open leaves focus on the menu, not on an item, and the menu is not modal', async ({ page }) => {
      await openRouteAndSettle(page, route);
      await page.getByRole('button', { name: /^Account menu/ }).click();
      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible();
      await expect(menu).toBeFocused();
      await expect(page.getByRole('menuitem', { name: 'Change password' })).toBeDisabled();
      await expect(page.getByRole('main')).not.toHaveAttribute('aria-hidden', 'true');
    });

    test('AC-6: axe finds 0 violations with the account menu closed and open, and with the drawer closed and open', async ({ page }, testInfo) => {
      await openRouteAndSettle(page, route);
      for (const control of controlsOf(page, testInfo.project.name)) {
        await expectNoAxeViolations(page);
        await control.button.click();
        await expect(control.panel).toBeVisible();
        await expectNoAxeViolations(page);
        await page.keyboard.press('Escape');
        await expect(control.panel).toBeHidden();
      }
      await expectNoAxeViolations(page);
    });
  });
}

test.describe('the drawer (below 1024 px)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(isDesktopProject(testInfo.project.name), 'The menu button is hidden from 1024 px');
  });

  test('AC-5: focus returns to the menu button on Escape, on the close button and on choosing the current page; choosing another page puts focus on its title', async ({ page }) => {
    await openRouteAndSettle(page, '/queue');
    const button = page.getByRole('button', { name: 'Open menu' });
    const drawer = page.getByRole('dialog', { name: 'Menu' });

    await button.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    await drawer.getByRole('button', { name: 'Close menu' }).click();
    await expect(drawer).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    await drawer.getByRole('link', { name: 'Task queue' }).click();
    await expect(drawer).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    await drawer.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(`${PRODUCTION_URL}/`);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });

  test('AC-5: the data-slot names of the drawer stay', async ({ page }) => {
    await openRouteAndSettle(page, '/queue');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.locator('[data-slot="sheet-content"]')).toBeVisible();
    await expect(page.locator('[data-slot="sheet-overlay"]')).toBeVisible();
  });

  test('AC-5: widening to 1024 px closes the open drawer', async ({ page }) => {
    await openRouteAndSettle(page, '/queue');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(drawer).toBeVisible();
    await page.setViewportSize({ width: PERSISTENT_MENU_MIN_WIDTH, height: 800 });
    await expect(drawer).toBeHidden();
  });

  test('AC-6: with reduced motion nothing in the first-open path animates; with motion allowed the drawer slides and fades', async ({ page }) => {
    const animationNames = async (): Promise<string[]> =>
      page.evaluate(() =>
        ['[data-slot="sheet-content"]', '[data-slot="sheet-overlay"]'].map((selector) => {
          const element = document.querySelector(selector);
          return element === null ? 'missing' : getComputedStyle(element).animationName;
        }),
      );

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openRouteAndSettle(page, '/queue');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    expect(await animationNames()).toEqual(['none', 'none']);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openRouteAndSettle(page, '/queue');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    const moving = await animationNames();
    expect(moving).not.toContain('none');
    expect(moving).not.toContain('missing');
  });
});

test.describe('slow and failed first open (AC-8)', () => {
  test('a slow request: the control is pending, a second press does nothing, then the panel opens', async ({ page }, testInfo) => {
    const gate = new ScriptGate();
    await gate.install(page);
    await openRouteAndSettle(page, '/queue');
    for (const control of controlsOf(page, testInfo.project.name)) {
      gate.mode = 'slow';
      const before = gate.urls.length;
      await control.button.click();
      await expect(control.button).toHaveAttribute('aria-busy', 'true');
      await expect(control.button).toBeEnabled();
      expect(await control.button.evaluate((element) => getComputedStyle(element).backgroundColor), `${control.name}: the pressed fill is held`).toBe(
        await tokenColour(page, '--border'),
      );
      await control.button.click({ force: true });
      await expect(control.panel).toBeVisible({ timeout: SLOW_REQUEST_MILLISECONDS * 3 });
      await expect(control.button).not.toHaveAttribute('aria-busy', 'true');
      const requested = gate.urls.slice(before);
      expect(new Set(requested).size, `${control.name}: no script was requested twice`).toBe(requested.length);
      await page.keyboard.press('Escape');
      await expect(control.panel).toBeHidden();
      gate.mode = 'pass';
    }
  });

  test('a slow request and Escape: the open is cancelled, the code arrives, the panel stays closed, the next press opens it at once', async ({ page }, testInfo) => {
    const gate = new ScriptGate();
    await gate.install(page);
    await openRouteAndSettle(page, '/queue');
    for (const control of controlsOf(page, testInfo.project.name)) {
      gate.mode = 'slow';
      const completedBefore = gate.completed;
      await control.button.click();
      await expect(control.button).toHaveAttribute('aria-busy', 'true');
      await page.keyboard.press('Escape');
      await expect(control.button).not.toHaveAttribute('aria-busy', 'true');
      await expect.poll(() => gate.completed, { timeout: SLOW_REQUEST_MILLISECONDS * 3 }).toBeGreaterThan(completedBefore);
      await page.waitForLoadState('networkidle');
      await expect(control.panel).toBeHidden();

      gate.mode = 'pass';
      const requestedBefore = gate.urls.length;
      await control.button.click();
      await expect(control.panel).toBeVisible();
      expect(gate.urls.length, `${control.name}: the code was already here`).toBe(requestedBefore);
      await page.keyboard.press('Escape');
      await expect(control.panel).toBeHidden();
    }
  });

  test('a failed request: one alert under the control, nothing moves, the control stays usable; pressing again retries and opens it', async ({ page }, testInfo) => {
    const gate = new ScriptGate();
    await gate.install(page);
    await openRouteAndSettle(page, '/queue');
    for (const control of controlsOf(page, testInfo.project.name)) {
      const boxes = await boxesOf(page);
      await watchLayoutShift(page);
      gate.mode = 'fail';
      await control.button.click();

      const alert = page.getByRole('alert').filter({ hasText: 'did not open' });
      await expect(alert).toHaveText(control.failureText);
      await expect(alert).toHaveCount(1);
      await expect(control.button).toBeEnabled();
      await expect(control.button).not.toHaveAttribute('aria-busy', 'true');
      await expect(control.button).toHaveAttribute('aria-describedby', /.+/);
      expect(await boxesOf(page), `${control.name}: the failure line moved nothing`).toEqual(boxes);
      expect(await layoutShifts(page), `${control.name}: layout-shift entries`).toEqual([]);
      // The line is under its control.
      const lineBox = await alert.boundingBox();
      const controlBox = await control.button.boundingBox();
      expect(lineBox && controlBox && lineBox.y >= controlBox.y + controlBox.height).toBe(true);

      gate.mode = 'pass';
      await control.button.click();
      await expect(alert).toHaveCount(0);
      await expect(control.panel).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(control.panel).toBeHidden();
      // The page still works.
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // Load the page again for the next control, whose first open has not happened.
      await openRouteAndSettle(page, '/queue');
    }
  });

  test('a failed request: Escape clears the line', async ({ page }) => {
    const gate = new ScriptGate();
    await gate.install(page);
    await openRouteAndSettle(page, '/queue');
    gate.mode = 'fail';
    await page.getByRole('button', { name: /^Account menu/ }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'did not open' });
    await expect(alert).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(alert).toHaveCount(0);
  });
});

test.describe('a tap before the page is interactive (AC-10, DEF-013)', () => {
  /** Paints the page with every script held back, so the HTML is on screen and React has not run. */
  async function paintWithScriptsHeld(page: Page, gate: ScriptGate, route: string): Promise<void> {
    gate.mode = 'hold';
    await page.goto(route, { waitUntil: 'commit' });
    await expect(page.getByRole('button', { name: /^Account menu/ })).toBeVisible();
  }

  test('a click on the account trigger is kept: pending at once, and the menu opens with no second tap once the scripts arrive', async ({ page }) => {
    const gate = new ScriptGate();
    await gate.install(page);
    await paintWithScriptsHeld(page, gate, '/queue');
    const trigger = page.locator('button[aria-label^="Account menu"]');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-busy', 'true');
    expect(await trigger.isEnabled()).toBe(true);
    expect(await trigger.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(await tokenColour(page, '--border'));

    gate.release();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Account menu/ })).toHaveAttribute('aria-expanded', 'true');
  });

  test('Enter on the account trigger is kept, and focus goes to the first enabled item', async ({ page }) => {
    const gate = new ScriptGate();
    await gate.install(page);
    await paintWithScriptsHeld(page, gate, '/');
    const trigger = page.locator('button[aria-label^="Account menu"]');
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-busy', 'true');

    gate.release();
    await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeFocused();
  });

  test('Space on the account trigger is kept', async ({ page }) => {
    const gate = new ScriptGate();
    await gate.install(page);
    await paintWithScriptsHeld(page, gate, '/');
    const trigger = page.locator('button[aria-label^="Account menu"]');
    await trigger.focus();
    await page.keyboard.press('Space');
    await expect(trigger).toHaveAttribute('aria-busy', 'true');

    gate.release();
    await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeFocused();
  });

  test('Escape before the scripts arrive cancels: no pending look, and the menu stays closed', async ({ page }) => {
    const gate = new ScriptGate();
    await gate.install(page);
    await paintWithScriptsHeld(page, gate, '/queue');
    const trigger = page.locator('button[aria-label^="Account menu"]');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-busy', 'true');
    await page.keyboard.press('Escape');
    await expect(trigger).not.toHaveAttribute('aria-busy', 'true');

    gate.release();
    await waitUntilAccountMenuIsLive(page);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(trigger).not.toHaveAttribute('aria-busy', 'true');
  });

  test('a click on the menu button is kept: the drawer opens with no second tap, with focus inside it', async ({ page }, testInfo) => {
    test.skip(isDesktopProject(testInfo.project.name), 'The menu button is hidden from 1024 px');
    const gate = new ScriptGate();
    await gate.install(page);
    await paintWithScriptsHeld(page, gate, '/queue');
    const button = page.locator('button[aria-label="Open menu"]');
    await button.click();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    expect(await button.isEnabled()).toBe(true);
    expect(await button.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(await tokenColour(page, '--border'));

    gate.release();
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(drawer).toBeVisible();
    expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(button).toBeFocused();
  });

  test('Escape before the scripts arrive cancels the menu button too', async ({ page }, testInfo) => {
    test.skip(isDesktopProject(testInfo.project.name), 'The menu button is hidden from 1024 px');
    const gate = new ScriptGate();
    await gate.install(page);
    await paintWithScriptsHeld(page, gate, '/queue');
    const button = page.locator('button[aria-label="Open menu"]');
    await button.click();
    await page.keyboard.press('Escape');
    await expect(button).not.toHaveAttribute('aria-busy', 'true');

    gate.release();
    await waitUntilMenuButtonIsLive(page);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
  });

  test('if both controls are tapped, the last one wins', async ({ page }, testInfo) => {
    test.skip(isDesktopProject(testInfo.project.name), 'The menu button is hidden from 1024 px');
    const gate = new ScriptGate();
    await gate.install(page);
    await paintWithScriptsHeld(page, gate, '/queue');
    const button = page.locator('button[aria-label="Open menu"]');
    const trigger = page.locator('button[aria-label^="Account menu"]');
    await button.click();
    await trigger.click();
    await expect(button).not.toHaveAttribute('aria-busy', 'true');
    await expect(trigger).toHaveAttribute('aria-busy', 'true');

    gate.release();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
    await expect(button).not.toHaveAttribute('aria-busy', 'true');
  });

});
