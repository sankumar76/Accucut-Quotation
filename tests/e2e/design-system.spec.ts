import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * STORY-10.02: the app shell and /design-system (SCR-00) at 360x800, 768x1024 and 1366x768 (the three
 * Playwright projects). AC-2 header, AC-3 fonts in the browser, AC-4 shell, AC-6 reduced motion and text
 * spacing, AC-8 no sideways scroll, 44 px targets, axe with 0 violations, keyboard-only menu and skip link.
 */

const PAGE = '/design-system';
const PERSISTENT_MENU_MIN_WIDTH = 1024;
const TOUCH_TARGET = 44;
const ROW_TARGET = 36;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
/** Width at which the page must still reflow without sideways scroll (WCAG 1.4.10; 200 percent zoom of 640 px). */
const REFLOW_WIDTH = 320;

const isDesktopProject = (name: string): boolean => name === 'desktop';

async function widthOf(page: Page): Promise<number> {
  return page.evaluate(() => window.innerWidth);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
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

test.describe('design system page and shell', () => {
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
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(await widthOf(page) >= PERSISTENT_MENU_MIN_WIDTH ? 1 : 0);
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

  test('AC-2: the header shows the real logo, the company name in Tinos and the portal name', async ({ page }) => {
    await page.goto(PAGE);
    const header = page.getByRole('banner');
    const logo = header.getByRole('img', { name: 'AccuCut logo' });
    await expect(logo).toBeVisible();
    expect(await logo.getAttribute('src')).toContain('accucut-logo.jpg');

    const name = header.getByText('ACCUCUT LASERS');
    await expect(name).toBeVisible();
    const style = await name.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { weight: computed.fontWeight, family: computed.fontFamily, colour: computed.color };
    });
    expect(style.weight).toBe('700');
    expect(style.family).toMatch(/Tinos|nf-tinos|__/i);
    const primary = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--primary)';
      document.body.append(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    });
    expect(style.colour).toBe(primary);

    if ((await widthOf(page)) >= 768) await expect(header.getByText('Quotation Portal')).toBeVisible();
    const headerBackground = await header.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(headerBackground).toBe('rgb(255, 255, 255)');
  });

  test('AC-4: the bell and the account menu stay in the top bar at every width', async ({ page }) => {
    await page.goto(PAGE);
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: /Overdue tasks/ })).toBeVisible();
    await expect(header.getByRole('button', { name: /Account menu/ })).toBeVisible();
  });

  test('AC-4: a persistent side menu from 1024 px, a menu button and drawer below', async ({ page }) => {
    await page.goto(PAGE);
    const persistent = (await widthOf(page)) >= PERSISTENT_MENU_MIN_WIDTH;
    const sideMenu = page.getByRole('navigation', { name: 'Main' });
    const menuButton = page.getByRole('button', { name: 'Open menu' });
    if (persistent) {
      await expect(sideMenu).toBeVisible();
      await expect(sideMenu.getByRole('link', { name: 'Design system' })).toHaveAttribute('aria-current', 'page');
      await expect(menuButton).toBeHidden();
    } else {
      await expect(sideMenu).toHaveCount(0);
      await menuButton.click();
      const drawer = page.getByRole('dialog', { name: 'Menu' });
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole('navigation', { name: 'Main' })).toBeVisible();
      const box = await drawer.boundingBox();
      expect(box?.width ?? 0).toBeLessThanOrEqual(288);
    }
  });

  test('AC-4, AC-8: the menu button, the drawer and the skip link work by keyboard only', async ({ page }) => {
    await page.goto(PAGE);
    test.skip((await widthOf(page)) >= PERSISTENT_MENU_MIN_WIDTH, 'The drawer exists below 1024 px');

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();

    await page.keyboard.press('Tab');
    const menuButton = page.getByRole('button', { name: 'Open menu' });
    await expect(menuButton).toBeFocused();
    await page.keyboard.press('Enter');
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(drawer).toBeVisible();

    // Focus is trapped in the drawer: it never reaches the page behind.
    for (let press = 0; press < 6; press += 1) {
      await page.keyboard.press('Tab');
      expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(menuButton).toBeFocused();
  });

  test('AC-4: the skip link moves focus to the main landmark', async ({ page }) => {
    await page.goto(PAGE);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
  });

  test('AC-4: focus is never hidden behind the sticky top bar (measured offset)', async ({ page }) => {
    await page.goto(PAGE);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--sticky-top'))).toMatch(/^\d+px$/);

    for (let press = 0; press < 14; press += 1) {
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

  test('AC-8: every control is at least 44 px (row icon buttons 36 px) on the touch projects', async ({ page }, testInfo) => {
    test.skip(isDesktopProject(testInfo.project.name), 'The 44 px rule is checked on the touch projects');
    await page.goto(PAGE);
    const controls = await page.evaluate(() => {
      const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="checkbox"], [role="switch"], [role="combobox"]';
      return Array.from(document.querySelectorAll<HTMLElement>(selector))
        .map((element) => {
          const box = element.getBoundingClientRect();
          return {
            name: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40) ?? element.tagName,
            width: Math.round(box.width * 10) / 10,
            height: Math.round(box.height * 10) / 10,
            onScreen: box.bottom > 0 && box.right > 0 && box.width > 0 && box.height > 0,
            hiddenInput: element.getAttribute('aria-hidden') === 'true' || element.tabIndex === -1,
          };
        })
        .filter((control) => control.onScreen && !control.hiddenInput);
    });
    expect(controls.length).toBeGreaterThan(5);
    const tooSmall = controls.filter((control) => {
      const needed = control.name === 'Edit row' ? ROW_TARGET : TOUCH_TARGET;
      return control.width < needed || control.height < needed;
    });
    expect(tooSmall).toEqual([]);
  });

  test('AC-8: axe finds 0 violations (WCAG 2.0, 2.1 and 2.2 A and AA)', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('AC-8: axe finds 0 violations with the drawer open, and with the account menu open', async ({ page }) => {
    await page.goto(PAGE);
    if ((await widthOf(page)) < PERSISTENT_MENU_MIN_WIDTH) {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
      await expectNoAxeViolations(page);
      await page.keyboard.press('Escape');
    }
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

    await page.evaluate(() => document.querySelector('[data-probe]')?.removeAttribute('data-probe'));
    const rupee = page.getByText('₹ 1,234.50', { exact: true });
    await rupee.evaluate((element) => element.setAttribute('data-probe', 'rupee'));
    const session = await page.context().newCDPSession(page);
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-probe="rupee"]' });
    const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.filter((font) => !font.isCustomFont)).toEqual([]);
  });

  test('AC-6: with reduced motion on, shimmer and spin are off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(PAGE);
    const animations = await page.evaluate(() => {
      const names = (selector: string): string[] =>
        Array.from(document.querySelectorAll(selector)).map((element) => getComputedStyle(element).animationName);
      return { skeleton: names('[data-slot="skeleton"]'), spinner: names('[data-slot="button"] svg') };
    });
    expect(animations.skeleton.length).toBeGreaterThan(0);
    expect([...animations.skeleton, ...animations.spinner].every((name) => name === 'none')).toBe(true);
  });

  test('AC-6 (control): with motion allowed the shimmer runs, so the check above can fail', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(PAGE);
    const name = await page.locator('[data-slot="skeleton"]').first().evaluate((element) => getComputedStyle(element).animationName);
    expect(name).not.toBe('none');
  });

  test('AC-6: at 320 px with the text spacing of WCAG 1.4.12 the page does not scroll sideways', async ({ page }) => {
    await page.setViewportSize({ width: REFLOW_WIDTH, height: 640 });
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
});
