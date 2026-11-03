import AxeBuilder from '@axe-core/playwright';
import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';

import { PERSISTENT_MENU_MIN_WIDTH } from '../../src/lib/design-tokens';

/**
 * STORY-10.02: the app shell and /design-system (SCR-00) at 360x800, 768x1024 and 1366x768 (the three
 * Playwright projects). AC-2 header, AC-3 fonts in the browser, AC-4 shell, AC-6 reduced motion and text
 * spacing, AC-8 no sideways scroll, 44 px targets, axe with 0 violations, keyboard-only menu and skip link.
 * Tests that depend on the layout sit in a `describe` that is skipped on the other projects, so each test has one
 * path through it (G6 STD-13).
 */

const PAGE = '/design-system';
const HOME = '/';
const TABLET_MIN_WIDTH = 768;
const TOUCH_TARGET = 44;
const ROW_TARGET = 36;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
/** Width at which the page must still reflow without sideways scroll (WCAG 1.4.10; 200 percent zoom of 640 px). */
const REFLOW_WIDTH = 320;
const REFLOW_HEIGHT = 640;
/** Tab presses that must stay inside the open drawer (it holds the menu links and the close button). */
const DRAWER_TAB_PRESSES = 6;
/** Shift+Tab presses from the bottom of the page, each checked against the sticky top bar. */
const FOCUS_SCAN_PRESSES = 14;

/** The desktop project is the only one at 1024 px or wider (playwright.config.ts). */
const isDesktopProject = (projectName: string): boolean => projectName === 'desktop';

async function widthOf(page: Page): Promise<number> {
  return page.evaluate(() => window.innerWidth);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** A CSS custom property resolved to the colour the browser paints, so a token is compared with what is drawn. */
async function tokenColour(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, token);
}

/** The platform fonts the browser really used to draw the text of an element (not the declared stack). */
async function platformFonts(page: Page, target: Locator): Promise<Array<{ familyName: string; isCustomFont: boolean }>> {
  await page.evaluate(() => document.fonts.ready);
  await target.evaluate((element) => element.setAttribute('data-probe', 'font'));
  const session: CDPSession = await page.context().newCDPSession(page);
  await session.send('DOM.enable');
  await session.send('CSS.enable');
  const { root } = await session.send('DOM.getDocument');
  const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-probe="font"]' });
  const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
  await target.evaluate((element) => element.removeAttribute('data-probe'));
  return fonts;
}

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target.join(' ')).slice(0, 5),
  }));
  expect(summary).toEqual([]);
}

async function openDrawer(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Open menu' }).click();
  const drawer = page.getByRole('dialog', { name: 'Menu' });
  await expect(drawer).toBeVisible();
  return drawer;
}

test.describe('design system page and shell, every width', () => {
  test('AC-8: the page does not scroll sideways, and the document is set up for assistive technology', async ({ page }) => {
    const consoleProblems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(message.text().split('\n')[0] ?? '');
    });
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: 'Design system' })).toBeVisible();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-IN');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page).toHaveTitle(/^Design system · Accucut Quotation Portal$/);
    expect(consoleProblems).toEqual([]);
  });

  test('AC-7: all ten sections are on the page, in order, each with a heading', async ({ page }) => {
    await page.goto(PAGE);
    const headings = await page.getByRole('heading', { level: 2 }).allTextContents();
    expect(headings.slice(0, 10)).toEqual([
      'Brand: Red Leads',
      'Colour tokens',
      'Type scale',
      'Spacing',
      'Buttons',
      'Form controls and column letters',
      'Status badges and notices',
      'Node status icons',
      'Loading, empty and error patterns (FR-088)',
      'Component map for shadcn/ui',
    ]);
  });

  test('AC-2: the header shows the real logo, the company name drawn in Tinos Bold in the logo red, on a white bar', async ({ page }) => {
    await page.goto(PAGE);
    const header = page.getByRole('banner');
    const logo = header.getByRole('img', { name: 'AccuCut logo' });
    await expect(logo).toBeVisible();
    expect(await logo.getAttribute('src')).toContain('accucut-logo.jpg');

    const name = header.getByText('ACCUCUT LASERS');
    await expect(name).toBeVisible();
    const style = await name.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { weight: computed.fontWeight, colour: computed.color };
    });
    expect(style.weight).toBe('700');
    expect(style.colour).toBe(await tokenColour(page, '--primary'));

    // The face that really drew the letters, not the declared stack (QLT-05): it must be the shipped Tinos file.
    const fonts = await platformFonts(page, name);
    expect(fonts.map((font) => font.familyName)).toEqual(['Tinos']);
    expect(fonts.every((font) => font.isCustomFont)).toBe(true);

    if ((await widthOf(page)) >= TABLET_MIN_WIDTH) await expect(header.getByText('Quotation Portal')).toBeVisible();
    expect(await header.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(await tokenColour(page, '--surface'));
  });

  test('AC-4: the bell and the account menu stay in the top bar at every width', async ({ page }) => {
    await page.goto(PAGE);
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: /Overdue tasks/ })).toBeVisible();
    await expect(header.getByRole('button', { name: /Account menu/ })).toBeVisible();
  });

  test('QLT-01: a secondary button has a visible border in the strong-border colour', async ({ page }) => {
    await page.goto(PAGE);
    const border = await page
      .getByRole('button', { name: 'Add part' })
      .evaluate((element) => ({ colour: getComputedStyle(element).borderTopColor, width: getComputedStyle(element).borderTopWidth }));
    expect(border.colour).toBe(await tokenColour(page, '--border-strong'));
    expect(border.width).toBe('1px');
    // The primary button keeps its transparent border, so the check above is about the variant and not every button.
    const primary = await page.getByRole('button', { name: 'Calculate' }).evaluate((element) => getComputedStyle(element).borderTopColor);
    expect(primary).toBe('rgba(0, 0, 0, 0)');
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

  test('AC-8: axe finds 0 violations (WCAG 2.0, 2.1 and 2.2 A and AA)', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('AC-8: axe finds 0 violations with the account menu open, and Escape returns focus to its button', async ({ page }) => {
    await page.goto(PAGE);
    await page.getByRole('button', { name: /Account menu/ }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /Account menu/ })).toBeFocused();
  });

  test('AC-3: no request goes to a font host, the rupee glyph comes from a project font, three fonts are preloaded', async ({ page }) => {
    const hosts = new Set<string>();
    page.on('request', (request) => hosts.add(new URL(request.url()).hostname));
    const fontUrls: string[] = [];
    page.on('response', (response) => {
      if (/\.woff2(\?|$)/.test(response.url())) fontUrls.push(response.url());
    });
    await page.goto(PAGE, { waitUntil: 'networkidle' });

    expect([...hosts]).toEqual(['localhost']);
    expect(fontUrls.length).toBeGreaterThan(0);
    await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(3);

    const fonts = await platformFonts(page, page.getByText('₹ 1,234.50', { exact: true }));
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.filter((font) => !font.isCustomFont)).toEqual([]);
  });

  test('AC-6: at 320 px with the text spacing of WCAG 1.4.12 the page does not scroll sideways', async ({ page }) => {
    await page.setViewportSize({ width: REFLOW_WIDTH, height: REFLOW_HEIGHT });
    await page.goto(PAGE);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await page.addStyleTag({
      content:
        '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
    });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    // The brand name and the account button are still inside the top bar.
    const clipped = await page.evaluate(() => {
      const header = document.querySelector('header');
      if (header === null) return ['no header'];
      const bar = header.getBoundingClientRect();
      return Array.from(header.querySelectorAll<HTMLElement>('a, button'))
        .filter((element) => element.getBoundingClientRect().right > bar.right + 1)
        .map((element) => element.textContent?.trim() ?? element.tagName);
    });
    expect(clipped).toEqual([]);
  });

  test('QLT-03: the "Loading" announcement is a live region beside the busy container, not inside it', async ({ page }) => {
    await page.goto(PAGE);
    expect(await page.locator('[aria-busy="true"] [role="status"]').count()).toBe(0);
    await expect(page.getByRole('status').filter({ hasText: 'Loading' })).toHaveText('Loading …');
  });

  test('AC-6: with reduced motion on, shimmer and spinner are off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(PAGE);
    const animations = await page.evaluate(() => {
      const names = (selector: string): string[] =>
        Array.from(document.querySelectorAll(selector)).map((element) => getComputedStyle(element).animationName);
      return { skeleton: names('[data-slot="skeleton"]'), spinner: names('[aria-busy="true"] svg.animate-spin') };
    });
    expect(animations.skeleton.length).toBeGreaterThan(0);
    expect(animations.spinner.length).toBeGreaterThan(0);
    expect([...animations.skeleton, ...animations.spinner].every((name) => name === 'none')).toBe(true);
  });

  test('AC-6 (control): with motion allowed the shimmer and the spinner run, so the check above can fail', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(PAGE);
    const names = await page.evaluate(() => ({
      skeleton: getComputedStyle(document.querySelector('[data-slot="skeleton"]') ?? document.body).animationName,
      spinner: getComputedStyle(document.querySelector('[aria-busy="true"] svg.animate-spin') ?? document.body).animationName,
    }));
    expect(names.skeleton).not.toBe('none');
    expect(names.spinner).not.toBe('none');
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
    expect((await drawer.boundingBox())?.width ?? 0).toBeLessThanOrEqual(drawerWidth);
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
