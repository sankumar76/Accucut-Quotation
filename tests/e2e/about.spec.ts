import { expect, test, type Page } from '@playwright/test';

import { ABOUT_COPYRIGHT, ABOUT_DESCRIPTION, ABOUT_TITLE, ABOUT_VERSION } from '../../src/lib/about-text';
import { forbiddenStrings } from '../support/canary-masters';
import { describeFinding, scanResponses } from '../support/scanner';

// `useFreshAddress` is a helper of this suite whose name starts with `use` but is not a React hook; the alias keeps the hooks rule from reading it as one.
import { E2E_ENGINEER, E2E_PASSWORD, signInWithoutThePage, useFreshAddress as setFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, isDesktopProject, openDrawer, TOUCH_TARGET, waitUntilAccountMenuIsLive } from './support/design-system';

/**
 * STORY-01.08 T2 and T3 (AC-1, AC-2, AC-3, AC-5): SCR-24 "About" at 360x800, 768x1024 and 1366x768 on the development server. Three people: the saved Lead (the
 * default state) sees the words and the layout; the Engineer, signed in with the two calls the sign-in screen makes (`signInWithoutThePage`, not the page: the
 * subject here is not that screen), sees the same words and the page is scanned for anything an Engineer must never be sent; a signed-out visitor is sent to the
 * sign-in page. The page is read by its accessible roles and its exact text, which is the approved text (`src/lib/about-text.ts`, pinned to SPEC section 9 by
 * `tests/unit/about-text.test.ts`). The scan of every Engineer page, with the real headers of the production build, is `canary-scan.spec.ts`: it takes this page
 * from the route manifest with no edit.
 */

const ABOUT = '/about';
const LOGO = 'main img[alt="AccuCut logo"]';

/** The words in `main`, each found as the whole text of one element, so an added or lost character fails. */
async function expectTheApprovedWords(page: Page): Promise<void> {
  const main = page.getByRole('main');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(ABOUT_TITLE);
  await expect(main.getByText('ACCUCUT LASERS', { exact: true })).toBeVisible();
  await expect(main.getByText('Quotation Portal', { exact: true })).toBeVisible();
  await expect(main.getByText(ABOUT_DESCRIPTION, { exact: true })).toBeVisible();
  await expect(main.getByText(ABOUT_VERSION, { exact: true })).toBeVisible();
  await expect(main.getByText(ABOUT_COPYRIGHT, { exact: true })).toBeVisible();
  // The logo is the real file: it loaded (a broken image has no width) and says what it is.
  await expect(page.locator(LOGO)).toBeVisible();
  await expect.poll(() => page.locator(LOGO).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
}

test.describe('a signed-in Lead', () => {
  test('AC-1, AC-5: the page shows the approved words, and one h1', async ({ page }) => {
    await page.goto(ABOUT);
    await expectTheApprovedWords(page);
  });

  test('AC-5: no sideways scroll, the controls of the page frame are at least 44 px, and axe finds 0 violations', async ({ page }) => {
    await page.goto(ABOUT);
    await expectTheApprovedWords(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // The page has no control of its own, so its controls are those of the frame: the menu button, the logo link, the bell and the account menu.
    await expect(page.getByRole('main').locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')).toHaveCount(0);
    const controls = await page.getByRole('banner').locator('a, button, summary').all();
    expect(controls.length).toBeGreaterThan(2);
    for (const control of controls) {
      if (!(await control.isVisible())) continue;
      const box = await control.boundingBox();
      const name = (await control.getAttribute('aria-label')) ?? (await control.innerText());
      expect(box?.height ?? 0, `${name} height`).toBeGreaterThanOrEqual(TOUCH_TARGET);
      expect(box?.width ?? 0, `${name} width`).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    await expectNoAxeViolations(page);
  });

  test('AC-5: by keyboard only, the skip link is the first stop and moves focus to the page', async ({ page }) => {
    await page.goto(ABOUT);
    await expectTheApprovedWords(page);
    await waitUntilAccountMenuIsLive(page);
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
  });

  test('AC-1: the menu lists About under Help and marks it as the current page', async ({ page }, testInfo) => {
    await page.goto(ABOUT);
    await expectTheApprovedWords(page);
    // Below 1024 px the menu is a drawer that a button opens; from 1024 px it is on the page.
    const menu = isDesktopProject(testInfo.project.name) ? page.getByRole('navigation', { name: 'Main' }) : (await openDrawer(page)).getByRole('navigation', { name: 'Main' });
    await expect(menu.getByText('Help', { exact: true })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('without the saved Lead', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('AC-2: a signed-out visitor is sent to the sign-in page, which remembers the address', async ({ page }) => {
    await page.goto(ABOUT);
    await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2Fabout$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(ABOUT_DESCRIPTION)).toHaveCount(0);
  });

  test('AC-1, AC-3: an Engineer sees the same words, and the scan of what they are sent finds nothing', async ({ page, context }) => {
    await setFreshAddress(context);
    await signInWithoutThePage(page, E2E_ENGINEER.email, E2E_PASSWORD);
    await page.goto(ABOUT);
    await expectTheApprovedWords(page);

    // What the Engineer's browser is sent for this address, judged by the list of the confidentiality scan (values, rate and operand names, formula markers).
    const answer = await page.request.get(ABOUT);
    expect(answer.status()).toBe(200);
    const recorded = { label: 'GET /about (page)', url: answer.url(), status: answer.status(), headers: answer.headers(), body: await answer.text(), carriedSession: true };
    expect(recorded.body).toContain(ABOUT_VERSION);
    expect(scanResponses([recorded], forbiddenStrings()).map(describeFinding)).toEqual([]);
  });
});
