import { expect, test } from '@playwright/test';

import { PERSISTENT_MENU_MIN_WIDTH } from '../../src/lib/design-tokens';

import {
  DRAWER_TAB_PRESSES,
  FOCUS_SCAN_PRESSES,
  HOME,
  isDesktopProject,
  PAGE,
  openDrawer,
  expectNoAxeViolations,
  ROW_TARGET,
  TOUCH_TARGET,
  tokenColour,
  widthOf,
} from './support/design-system';

/**
 * STORY-10.02: the page frame, seen on /design-system at 360x800, 768x1024 and 1366x768. AC-4 the persistent menu from
 * 1024 px, the drawer below, the bell and account menu, the skip link, focus never under the sticky bar and on the title
 * after navigation (QLT-02), AC-6 the drawer under reduced motion, AC-8 the 44 px targets and a keyboard-only menu.
 * Tests that depend on the layout sit in a `describe` that is skipped on the other projects, so each test has one path
 * through it (G6 STD-13). The page itself is in `design-system.spec.ts`.
 */

/** How far a measured box may exceed a token in CSS pixels: less than one device pixel, more than float noise. */
const SUB_PIXEL_TOLERANCE = 0.5;

test.describe('page frame, every width', () => {
  test('AC-4: the bell and the account menu stay in the top bar at every width', async ({ page }) => {
    await page.goto(PAGE);
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: /Overdue tasks/ })).toBeVisible();
    await expect(header.getByRole('button', { name: /Account menu/ })).toBeVisible();
  });

  test('AC-4: the skip link is the first stop and moves focus to the main landmark', async ({ page }) => {
    await page.goto(PAGE);
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
  });

  test('AC-4: focus is never hidden behind the sticky top bar (measured offset)', async ({ page }) => {
    await page.goto(PAGE);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--sticky-top'))).toMatch(/^\d+px$/);

    for (let press = 0; press < FOCUS_SCAN_PRESSES; press += 1) {
      await page.keyboard.press('Shift+Tab');
      const { top, headerBottom, tallerThanScreen, inHeader, isAppElement } = await page.evaluate(() => {
        const active = document.activeElement;
        const header = document.querySelector('header');
        const box = active === null ? new DOMRect() : active.getBoundingClientRect();
        return {
          top: box.top,
          headerBottom: header === null ? 0 : header.getBoundingClientRect().bottom,
          // A scroll region taller than the screen has its top edge off screen whenever its content is in view.
          tallerThanScreen: box.height > window.innerHeight / 2,
          inHeader: header?.contains(active) ?? false,
          // The framework's own dev overlay is not part of the page.
          isAppElement: active !== null && active.tagName !== 'NEXTJS-PORTAL',
        };
      });
      if (isAppElement && !inHeader && !tallerThanScreen) expect(top).toBeGreaterThanOrEqual(headerBottom);
    }
  });
});

test.describe('persistent side menu (1024 px and wider)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!isDesktopProject(testInfo.project.name), 'The side menu is persistent from 1024 px');
  });

  test('AC-4: the side menu is shown, marks the current page, and there is no menu button', async ({ page }) => {
    await page.goto(PAGE);
    expect(await widthOf(page)).toBeGreaterThanOrEqual(PERSISTENT_MENU_MIN_WIDTH);
    const sideMenu = page.getByRole('navigation', { name: 'Main' });
    await expect(sideMenu).toBeVisible();
    await expect(sideMenu.getByRole('link', { name: 'Design system' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeHidden();
  });

  test('QLT-02: choosing a page in the side menu moves focus to that page\'s title', async ({ page }) => {
    await page.goto(PAGE);
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(HOME);
    await expect(page.getByRole('heading', { level: 1, name: 'Accucut Quotation Portal' })).toBeFocused();
  });
});

test.describe('menu drawer (below 1024 px)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(isDesktopProject(testInfo.project.name), 'The drawer exists below 1024 px');
  });

  test('AC-4: a menu button opens the drawer, which holds the menu and is no wider than the drawer token', async ({ page }) => {
    await page.goto(PAGE);
    expect(await widthOf(page)).toBeLessThan(PERSISTENT_MENU_MIN_WIDTH);
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);

    const drawer = await openDrawer(page);
    await expect(drawer.getByRole('navigation', { name: 'Main' })).toBeVisible();
    const drawerWidth = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--drawer-w')));
    // The box is read while the slide-in transform may still be running, so it carries floating-point noise of a few
    // millionths of a pixel (288.0000038). Half a pixel tolerates that and still catches a drawer one pixel too wide (DEF-004).
    expect((await drawer.boundingBox())?.width ?? 0).toBeLessThanOrEqual(drawerWidth + SUB_PIXEL_TOLERANCE);
  });

  test('AC-4, AC-8: the menu button, the drawer and the skip link work by keyboard only', async ({ page }) => {
    await page.goto(PAGE);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();

    await page.keyboard.press('Tab');
    const menuButton = page.getByRole('button', { name: 'Open menu' });
    await expect(menuButton).toBeFocused();
    await page.keyboard.press('Enter');
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(drawer).toBeVisible();

    // Focus is trapped in the drawer: it never reaches the page behind.
    for (let press = 0; press < DRAWER_TAB_PRESSES; press += 1) {
      await page.keyboard.press('Tab');
      expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(menuButton).toBeFocused();
  });

  test('QLT-02: choosing a page in the drawer moves focus to that page\'s title, not back to the menu button', async ({ page }) => {
    await page.goto(PAGE);
    const drawer = await openDrawer(page);
    await drawer.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(HOME);
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'Accucut Quotation Portal' })).toBeFocused();
  });

  test('QLT-01: the menu button in the top bar has a visible border', async ({ page }) => {
    await page.goto(PAGE);
    const colour = await page.getByRole('button', { name: 'Open menu' }).evaluate((element) => getComputedStyle(element).borderTopColor);
    expect(colour).toBe(await tokenColour(page, '--border-strong'));
  });

  test('AC-8: axe finds 0 violations with the drawer open', async ({ page }) => {
    await page.goto(PAGE);
    await openDrawer(page);
    await expectNoAxeViolations(page);
  });

  test('AC-6: with reduced motion on, the drawer does not slide or fade; with motion allowed it does', async ({ page }) => {
    const animationNames = async (): Promise<string[]> =>
      page.evaluate(() =>
        ['[data-slot="sheet-content"]', '[data-slot="sheet-overlay"]'].map((selector) => {
          const element = document.querySelector(selector);
          return element === null ? 'missing' : getComputedStyle(element).animationName;
        }),
      );

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(PAGE);
    await openDrawer(page);
    expect(await animationNames()).toEqual(['none', 'none']);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(PAGE);
    await openDrawer(page);
    const moving = await animationNames();
    expect(moving).not.toContain('none');
    expect(moving).not.toContain('missing');
  });
});

test.describe('touch targets (the touch projects)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(isDesktopProject(testInfo.project.name), 'The 44 px rule is checked on the touch projects (AC-8)');
  });

  test('AC-8: every control is at least 44 px, and a row icon button at least 36 px', async ({ page }) => {
    await page.goto(PAGE);
    const controls = await page.evaluate(() => {
      const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="checkbox"], [role="switch"], [role="combobox"], [role="tab"], [role="menuitem"]';
      return Array.from(document.querySelectorAll<HTMLElement>(selector))
        .map((element) => {
          const box = element.getBoundingClientRect();
          return {
            name: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40) ?? element.tagName,
            width: Math.round(box.width * 10) / 10,
            height: Math.round(box.height * 10) / 10,
            rowButton: element.getAttribute('data-size') === 'icon-row',
            onScreen: box.bottom > 0 && box.right > 0 && box.width > 0 && box.height > 0,
            // Not a target: hidden from assistive technology (Radix keeps a hidden native control beside a custom one) or inert.
            notATarget: element.closest('[aria-hidden="true"], [inert]') !== null,
          };
        })
        .filter((control) => control.onScreen && !control.notATarget);
    });
    expect(controls.length).toBeGreaterThan(5);
    expect(controls.some((control) => control.rowButton)).toBe(true);
    const tooSmall = controls.filter((control) => {
      const needed = control.rowButton ? ROW_TARGET : TOUCH_TARGET;
      return control.width < needed || control.height < needed;
    });
    expect(tooSmall).toEqual([]);
  });
});
