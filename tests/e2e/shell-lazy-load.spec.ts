import { expect, test } from '@playwright/test';

import { PERSISTENT_MENU_MIN_WIDTH } from '../../src/lib/design-tokens';

import { E2E_LEAD, E2E_PASSWORD, signInThroughThePage, useFreshAddress } from './support/auth';
import {
  expectNoAxeViolations,
  isDesktopProject,
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
  urlsContaining,
  watchLayoutShift,
} from './support/lazy-load';
import { PRODUCTION_URL } from './support/servers';

/**
 * STORY-10.13 (AQP-188), what loads and when: the account menu and the menu drawer load on their first open and nothing else
 * about them changes (AC-3 to AC-7). Run on the production build (`next start`), because the chunks are the build's own, at
 * 360x800, 768x1024 and 1366x768, on `/` and `/queue` (`/design-system` is not in a production build). The slow and failed first
 * open (AC-8) and the early tap (AC-10) are in `shell-first-open.spec.ts`.
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
      await expect(account.button).toHaveAccessibleName(/^Account menu, [A-Z]{1,2}, .+, Lead$/);
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

    test('QLT-55: after a keyboard first open, a later pointer open leaves focus on the menu, not on an item', async ({ page }) => {
      await openRouteAndSettle(page, route);
      const trigger = page.locator('button[aria-label^="Account menu"]');
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).toBeHidden();

      await trigger.click();
      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible();
      await expect(menu).toBeFocused();
      await expect(page.getByRole('menuitem', { name: 'Sign out' })).not.toBeFocused();
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
