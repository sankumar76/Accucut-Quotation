import { expect, test } from '@playwright/test';

import {
  expectNoAxeViolations,
  horizontalOverflow,
  PAGE,
  platformFonts,
  REFLOW_HEIGHT,
  REFLOW_WIDTH,
  TABLET_MIN_WIDTH,
  tokenColour,
  widthOf,
} from './support/design-system';

/**
 * STORY-10.02: /design-system (SCR-00) at 360x800, 768x1024 and 1366x768 (the three Playwright projects). AC-2 header
 * and brand, AC-3 fonts in the browser, AC-6 reduced motion and text spacing, AC-7 the ten sections, AC-8 no sideways
 * scroll and axe with 0 violations. The page frame (menu, drawer, skip link, focus, touch targets) is in `shell.spec.ts`.
 */

test.describe('design system page, every width', () => {
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
