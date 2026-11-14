import { expect, test, type Locator, type Page } from '@playwright/test';
import { z } from 'zod';

import { createDisposableUser, E2E_ENGINEER, E2E_PASSWORD, expectOnQueue, signInThroughThePage, useFreshAddress, type E2eUser } from './support/auth';
import {
  expectNoAxeViolations,
  horizontalOverflow,
  isDesktopProject,
  openDrawer,
  TOUCH_TARGET,
  waitUntilAccountMenuIsLive,
} from './support/design-system';

/**
 * STORY-01.02, T7 (AC-4, AC-6, AC-7, AC-8, AC-9): role navigation and the system pages at 360x800, 768x1024 and
 * 1366x768, on the development server (so `/design-system` is in the menu). The saved browser state is the Lead's; an
 * Engineer signs in through the page. The menu is the one the manifest gives the role, an Engineer sees no Admin or Lead
 * item, `GET /api/v1/me` returns the same list, a signed-out API call is a 401 problem and not a redirect, and the
 * system pages pass axe, do not scroll sideways and have 44 px controls. Sign-out ends every session of a person, so the
 * test that signs out makes a person of its own.
 *
 * The words of SCR-26 are written out here, from the UX spec, and not imported from the product, so a changed sentence
 * fails a test.
 */

const NOT_FOUND_TITLE = 'We could not find that page';
const NO_ACCESS_TITLE = 'You do not have access to this page';
const NO_ACCESS_TEXT = 'Your role does not include this page. If you think it should, ask the Admin.';
const ERROR_TITLE = 'Something went wrong on our side';
const ERROR_TEXT =
  'Your work is saved up to your last save. Try again in a moment. If it keeps happening, give the Admin this reference: req-7f3a91.';
/** UX spec v0.12: the button is named for the viewer's role (the Lead here, the Engineer in the Engineer's tests). */
const LEAD_HOME_ACTION = 'Go to the task queue';
const ENGINEER_HOME_ACTION = 'Go to my tasks';

const ADMIN_AND_LEAD_ITEMS = ['Assign task', 'Process master', 'Customers', 'Materials and lists', 'Fields and formulas', 'Checkpoints', 'Users', 'Settings', 'Audit log'];
const IMPLEMENTED_MENU = ['Home', 'Design system'];

const meSchema = z.strictObject({
  name: z.string(),
  email: z.string(),
  role: z.enum(['ADMIN', 'LEAD', 'ENGINEER']),
  navigation: z.array(z.strictObject({ group: z.string(), label: z.string(), href: z.string() })),
  overdueCount: z.number(),
});

const problemSchema = z.object({ type: z.literal('about:blank'), title: z.string(), status: z.number(), code: z.string(), requestId: z.string().regex(/^req-[0-9a-f]{8}$/) });

/** The menu of the page, wherever the width puts it: the side menu from 1024 px, the drawer below. */
async function openMenu(page: Page, testInfo: { project: { name: string } }): Promise<Locator> {
  if (isDesktopProject(testInfo.project.name)) return page.getByRole('navigation', { name: 'Main' });
  return (await openDrawer(page)).getByRole('navigation', { name: 'Main' });
}

async function menuLabels(menu: Locator): Promise<string[]> {
  return (await menu.getByRole('link').allTextContents()).map((text) => text.trim());
}

/** Signs in through the page. The test group has set a client address of its own (`useFreshAddress` in its `beforeEach`). */
async function signInAs(page: Page, user: E2eUser, queueTitle: string): Promise<void> {
  await page.goto('/sign-in');
  await signInThroughThePage(page, user.email, E2E_PASSWORD);
  await expectOnQueue(page, queueTitle);
}

async function expectControlsLargeEnough(controls: Locator): Promise<void> {
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const box = await controls.nth(index).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
  }
}

test.describe('the Lead (saved browser state)', () => {
  test('AC-6: the menu lists the pages that exist for a Lead, under their groups, and no Admin item', async ({ page }, testInfo) => {
    await page.goto('/queue');
    await expect(page.getByRole('heading', { level: 1, name: 'Task queue' })).toBeVisible();
    const menu = await openMenu(page, testInfo);
    // "Assign task" (STORY-04.01) is the Lead's and the Admin's first working page, so it is in the Lead's menu now, under Work, after the queue.
    // STORY-08.01: Fields and formulas is the Lead's too, under Configuration, and its label says the page is view only (AC-4).
    expect(await menuLabels(menu)).toEqual(['Task queue', 'Assign task', 'Home', 'Fields and formulas (view only)', 'Design system']);
    await expect(menu.getByText('Work', { exact: true })).toBeVisible();
    await expect(menu.getByText('Review', { exact: true })).toBeVisible();
    for (const hidden of ADMIN_AND_LEAD_ITEMS.filter((item) => item !== 'Assign task' && item !== 'Fields and formulas')) await expect(menu.getByRole('link', { name: hidden })).toHaveCount(0);
  });

  test('AC-6: the top bar has the logo, the name, the bell and the account menu, and the account menu shows who is signed in', async ({ page }) => {
    await page.goto('/queue');
    const header = page.getByRole('banner');
    await expect(header.getByAltText('AccuCut logo')).toBeVisible();
    await expect(header.getByText('ACCUCUT LASERS')).toBeVisible();
    await expect(header.getByRole('link', { name: /Overdue tasks/ })).toBeVisible();
    await waitUntilAccountMenuIsLive(page);
    await header.getByRole('button', { name: /^Account menu/ }).click();
    const menu = page.getByRole('menu');
    await expect(menu).toContainText('E2E Lead');
    await expect(menu).toContainText('e2e.lead@example.test');
    await expect(menu).toContainText('Lead');
    await expect(menu.getByRole('menuitem', { name: 'Change password' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  });

  test('AC-7: GET /api/v1/me returns the person, the same menu and an overdue count of 0, in a strict shape, not cached', async ({ page }, testInfo) => {
    await page.goto('/queue');
    const response = await page.request.get('/api/v1/me');
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('private, no-store');
    expect(response.headers()['x-request-id']).toMatch(/^req-[0-9a-f]{8}$/);
    const me = meSchema.parse(await response.json());
    expect(me).toMatchObject({ name: 'E2E Lead', email: 'e2e.lead@example.test', role: 'LEAD', overdueCount: 0 });
    expect(me.navigation.map((item) => item.label)).toEqual(await menuLabels(await openMenu(page, testInfo)));
    expect(JSON.stringify(me)).not.toMatch(/cost|rate|price/i);
  });
});

test.describe('the system pages (AC-8, AC-9)', () => {
  test('AC-8: an address no route serves shows "not found" with HTTP 404 and one action, and passes axe', async ({ page }) => {
    const response = await page.goto('/there-is-no-such-page');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: NOT_FOUND_TITLE })).toBeVisible();
    const action = page.getByRole('link', { name: LEAD_HOME_ACTION });
    await expect(action).toHaveAttribute('href', '/queue');
    await expectControlsLargeEnough(action);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    await action.click();
    await expectOnQueue(page, 'Task queue');
  });

  // The two boundaries that need a refused role or a failed render cannot be reached from a real page yet (every implemented
  // page is open to every role, and a page does not fail on purpose). Their wording and markup are held by
  // `tests/unit/system-pages.test.ts`; here the real card of the not-found page is given each wording, so axe, the width
  // and the 44 px rule are checked on the same elements, styles and widths with the longer sentences.
  for (const variant of [
    { name: 'no access', title: NO_ACCESS_TITLE, text: NO_ACCESS_TEXT },
    { name: 'server error', title: ERROR_TITLE, text: ERROR_TEXT },
  ]) {
    test(`AC-8, AC-9: the card of "${variant.name}" fits every width, has an h1 and one 44 px action, and passes axe`, async ({ page }) => {
      await page.goto('/there-is-no-such-page');
      // Change the words only after React has hydrated the card: a change made before it is undone when React takes the page
      // over (it re-renders what the server sent). React marks every node it has hydrated with a `__reactProps$` property,
      // the same signal `waitUntilHydrated` reads for a control (QLT-50 names the dependency on that internal).
      await page.waitForFunction(() => {
        const heading = document.querySelector('main h1');
        return heading !== null && Object.keys(heading).some((key) => key.startsWith('__reactProps$'));
      });
      await page.evaluate(({ title, text }) => {
        const heading = document.querySelector('main h1');
        const sentence = document.querySelector('main p');
        if (heading === null || sentence === null) throw new Error('the card was not found');
        heading.textContent = title;
        sentence.textContent = text;
      }, variant);
      await expect(page.getByRole('heading', { level: 1, name: variant.title })).toBeVisible();
      await expect(page.getByRole('main').getByRole('link')).toHaveCount(1);
      await expectControlsLargeEnough(page.getByRole('main').getByRole('link'));
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      await expectNoAxeViolations(page);
    });
  }
});

test.describe('the Engineer (signs in through the page)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ context }) => {
    await useFreshAddress(context);
  });

  test('AC-6: the menu holds no Admin or Lead item, not even a disabled one, and the page frame passes axe', async ({ page }, testInfo) => {
    await signInAs(page, E2E_ENGINEER, 'My tasks');
    const menu = await openMenu(page, testInfo);
    expect(await menuLabels(menu)).toEqual(['My tasks', ...IMPLEMENTED_MENU]);
    for (const hidden of ADMIN_AND_LEAD_ITEMS) {
      await expect(menu.getByText(hidden, { exact: true })).toHaveCount(0);
    }
    await expect(menu.locator('[aria-disabled="true"]')).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-6, AC-7: the account menu names the Engineer, and GET /api/v1/me gives the same menu with no cost field', async ({ page }, testInfo) => {
    await signInAs(page, E2E_ENGINEER, 'My tasks');
    await waitUntilAccountMenuIsLive(page);
    await page.getByRole('button', { name: /^Account menu/ }).click();
    await expect(page.getByRole('menu')).toContainText('E2E Engineer');
    await expect(page.getByRole('menu')).toContainText('e2e.engineer@example.test');
    await expect(page.getByRole('menu')).toContainText('Engineer');
    await page.keyboard.press('Escape');

    const response = await page.request.get('/api/v1/me');
    const me = meSchema.parse(await response.json());
    expect(me.role).toBe('ENGINEER');
    expect(me.navigation.map((item) => item.label)).toEqual(await menuLabels(await openMenu(page, testInfo)));
    expect(me.navigation.map((item) => item.href)).not.toContain('/users');
  });

  test('AC-8: an unknown address shows the "not found" card to an Engineer, with the button named "Go to my tasks"', async ({ page }) => {
    await signInAs(page, E2E_ENGINEER, 'My tasks');
    const response = await page.goto('/there-is-no-such-page');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: NOT_FOUND_TITLE })).toBeVisible();
    const action = page.getByRole('link', { name: ENGINEER_HOME_ACTION });
    await expect(action).toHaveAttribute('href', '/queue');
    await expect(page.getByRole('main').getByRole('link')).toHaveCount(1);
    await expectNoAxeViolations(page);
  });

  test('AC-8, UX-22: the card is the same for two different addresses, so it cannot show whether an address exists', async ({ page }) => {
    await signInAs(page, E2E_ENGINEER, 'My tasks');
    const textOf = async (path: string): Promise<string> => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: NOT_FOUND_TITLE })).toBeVisible();
      return page.getByRole('main').innerText();
    };
    expect(await textOf('/there-is-no-such-page')).toBe(await textOf('/estimates/Q-2026-0001/costs/1'));
  });
});

test.describe('signed out (AC-4)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a signed-out API call is 401 with a problem body, not a redirect to the sign-in page', async ({ page }) => {
    const response = await page.request.get('/api/v1/me', { maxRedirects: 0 });
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/problem+json');
    expect(response.headers()['cache-control']).toBe('private, no-store');
    expect(problemSchema.parse(await response.json())).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  test('a signed-out page request goes to the sign-in page and remembers the address', async ({ page }) => {
    await page.goto('/design-system');
    await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2Fdesign-system$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  });
});

test.describe('sign-out by keyboard only (AC-9)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ context }) => {
    await useFreshAddress(context);
  });

  test('the account menu opens with Enter, Escape returns focus to the trigger, and Sign out ends the session', async ({ page }, testInfo) => {
    const person = await createDisposableUser('sign-out', testInfo);
    await signInAs(page, person, 'My tasks');
    await waitUntilAccountMenuIsLive(page);
    const trigger = page.getByRole('button', { name: /^Account menu/ });

    await trigger.focus();
    await page.keyboard.press('Enter');
    // Focus starts on the first enabled item, "Change password" (SCR-23 exists from story 01.05); Sign out is the next one.
    await expect(page.getByRole('menuitem', { name: 'Change password' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Change password' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/sign-in$/);

    // The session is over for good: the portal asks for a sign-in again, and the API says 401.
    await page.goto('/queue');
    await expect(page).toHaveURL(/\/sign-in/);
    expect((await page.request.get('/api/v1/me', { maxRedirects: 0 })).status()).toBe(401);
  });
});
