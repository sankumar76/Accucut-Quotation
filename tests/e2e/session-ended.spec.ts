import { expect, test } from '@playwright/test';

import { createDisposableUser, E2E_PASSWORD, useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { addEndedSession } from './support/ended-session';
import { PRODUCTION_URL } from './support/servers';

/**
 * STORY-01.06 AC-3, AC-4 and AC-6: SCR-26 "Session ended" and the "Session ended" state of SCR-01, at 360x800, 768x1024 and
 * 1366x768, against the PRODUCTION build (`next start`) and a real database. A session of the age that matters is made by writing
 * the cookie with the servers' own invented secret (`support/ended-session.ts`); nothing here waits 12 hours.
 *
 * Three tests, each at all three widths (nine entries), and none of them tagged for one width or limited to the desktop project: the layout
 * checks (no sideways scroll, 44 px, axe) are what AC-6 asks per width, and the journey is one test that goes through both screens
 * with the keyboard alone. The server rules (the 401 `SESSION_ENDED` problem body, the 12-hour boundary, activity not extending
 * it, deactivation and role change) are in `tests/unit/auth-session.test.ts` and `tests/integration/auth/session-expiry.test.ts`.
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

const SESSION_ENDED_TITLE = 'Your session ended';
const SESSION_ENDED_TEXT = 'Sessions last 12 hours from the time you sign in, so you were signed out. Sign in again. Anything you had saved is still there.';
const SIGN_IN_NOTICE = 'Your session ended. Sign in again to continue where you left off.';

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

test.describe('AC-3 and AC-6: SCR-26 "Session ended"', () => {
  test('a page request after the session ended shows it: no sideways scroll, a 44 px action, axe clean, announced, focus on the heading', async ({ page, context }) => {
    await addEndedSession(context, 'expired-token');
    const response = await page.goto('/masters/materials');
    expect(response?.status()).toBe(401);

    const heading = page.getByRole('heading', { level: 1, name: SESSION_ENDED_TITLE });
    await expect(heading).toBeVisible();
    // Next.js has a live region of its own with the same role, so the alert is looked for inside the page's own `main`.
    await expect(page.locator('main [role="alert"]')).toHaveText(SESSION_ENDED_TEXT);
    await expect(heading).toBeFocused();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    const action = await page.getByRole('link', { name: 'Sign in again' }).boundingBox();
    expect(action?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    expect(action?.width ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    await expectNoAxeViolations(page);
  });
});

test.describe('AC-4 and AC-6: SCR-01 in its "Session ended" state', () => {
  test('shows the notice as an alert above the form: no sideways scroll, 44 px controls, axe clean, focus on the heading', async ({ page }) => {
    await page.goto('/sign-in?reason=session-ended');

    const heading = page.getByRole('heading', { level: 1, name: 'Sign in' });
    await expect(heading).toBeVisible();
    const notice = page.locator('[data-slot="alert"]');
    await expect(notice).toHaveText(SIGN_IN_NOTICE);
    await expect(notice).toHaveAttribute('role', 'alert');
    await expect(heading).toBeFocused();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    for (const control of [page.getByLabel('E-mail'), page.getByLabel('Password', { exact: true }), page.getByRole('button', { name: 'Show password' }), page.getByRole('button', { name: 'Sign in' })]) {
      const box = await control.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    await expectNoAxeViolations(page);
  });
});

test.describe('AC-3 and AC-6: from "Session ended" back to the page that was asked for, by keyboard only', () => {
  test('the action leads to SCR-01, and signing in again returns to the requested address', async ({ page, context }, testInfo) => {
    const person = await createDisposableUser('expiry', testInfo);
    // The token can still be read and says the person signed in 13 hours ago: the portal's own 12-hour check refuses it.
    await addEndedSession(context, 'old-sign-in', person.id);

    await page.goto('/');
    const heading = page.getByRole('heading', { level: 1, name: SESSION_ENDED_TITLE });
    await expect(heading).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Sign in again' })).toBeFocused();
    await page.keyboard.press('Enter');
    // The page that was asked for is kept in the address, as a same-origin relative path.
    await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2F$/);

    await waitUntilHydrated(page, 'form[aria-label="Sign in"]', 'onSubmit');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    await page.getByRole('main').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('E-mail')).toBeFocused();
    await page.keyboard.type(person.email);
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
    await page.keyboard.type(E2E_PASSWORD);
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Accucut Quotation Portal' })).toBeVisible();
  });
});
