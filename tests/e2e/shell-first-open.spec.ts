import { expect, test, type Page } from '@playwright/test';

import { PERSISTENT_MENU_MIN_WIDTH } from '../../src/lib/design-tokens';

import { E2E_LEAD, E2E_PASSWORD, signInThroughThePage, useFreshAddress } from './support/auth';
import { isDesktopProject, tokenColour, waitUntilAccountMenuIsLive, waitUntilMenuButtonIsLive } from './support/design-system';
import {
  boxesOf,
  controlsOf,
  layoutShifts,
  openRouteAndSettle,
  ScriptGate,
  SLOW_OPEN_WAIT_MILLISECONDS,
  watchLayoutShift,
} from './support/lazy-load';
import { PRODUCTION_URL } from './support/servers';

/**
 * STORY-10.13 (AQP-188), what happens while the code loads: a slow or failed first open (AC-8) and a tap made before the
 * page is interactive (AC-10, DEF-013). Run on the production build (`next start`) at 360x800, 768x1024 and 1366x768. AC-10 is
 * shown 20 of 20 runs per width with `--repeat-each=20 --retries=0`. What loads and when (AC-3 to AC-7) is in
 * `shell-lazy-load.spec.ts`.
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

// The invented Lead signs in on the production server, as `sign-in.spec.ts` does.
test.beforeEach(async ({ page, context }) => {
  await useFreshAddress(context);
  await page.goto('/sign-in');
  await signInThroughThePage(page, E2E_LEAD.email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/queue$/);
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
      await expect(control.panel).toBeVisible({ timeout: SLOW_OPEN_WAIT_MILLISECONDS });
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
      await expect.poll(() => gate.completed, { timeout: SLOW_OPEN_WAIT_MILLISECONDS }).toBeGreaterThan(completedBefore);
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

test.describe('two controls and the width, while a first open is pending (below 1024 px)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(isDesktopProject(testInfo.project.name), 'The menu button is hidden from 1024 px');
  });

  test('QLT-57: after the page is interactive the last press wins: the account menu is pending, the menu button is pressed, and only the drawer opens', async ({
    page,
  }) => {
    const gate = new ScriptGate();
    await gate.install(page);
    await openRouteAndSettle(page, '/queue');
    gate.mode = 'slow';
    const trigger = page.locator('button[aria-label^="Account menu"]');
    const button = page.locator('button[aria-label="Open menu"]');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-busy', 'true');
    await button.click();
    await expect(trigger).not.toHaveAttribute('aria-busy', 'true');
    await expect(button).toHaveAttribute('aria-busy', 'true');

    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible({ timeout: SLOW_OPEN_WAIT_MILLISECONDS });
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(trigger).not.toHaveAttribute('aria-busy', 'true');
  });

  test('QLT-56: widening to 1024 px while the drawer is still loading cancels the open, so the drawer does not open over the side menu', async ({ page }) => {
    const gate = new ScriptGate();
    await gate.install(page);
    await openRouteAndSettle(page, '/queue');
    gate.mode = 'slow';
    const completedBefore = gate.completed;
    const button = page.locator('button[aria-label="Open menu"]');

    await button.click();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await page.setViewportSize({ width: PERSISTENT_MENU_MIN_WIDTH, height: 800 });
    await expect(button).not.toHaveAttribute('aria-busy', 'true');

    // The drawer's code arrives while the window is wide; the open was cancelled, so nothing opens.
    await expect.poll(() => gate.completed, { timeout: SLOW_OPEN_WAIT_MILLISECONDS }).toBeGreaterThan(completedBefore);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
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
    await expect(page.getByRole('menuitem', { name: 'Change password' })).toBeFocused();
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
    await expect(page.getByRole('menuitem', { name: 'Change password' })).toBeFocused();
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
