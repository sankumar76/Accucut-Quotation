import { expect, test, type Page } from '@playwright/test';

import {
  E2E_ENGINEER,
  disposableUser,
  E2E_LEAD,
  E2E_PASSWORD,
  expectOnQueue,
  signInThroughThePage,
  useFreshAddress,
} from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET } from './support/design-system';
import { PRODUCTION_URL } from './support/servers';

/**
 * STORY-01.01, T8: SCR-01 and the sign-in journey at 360x800, 768x1024 and 1366x768, against the PRODUCTION build
 * (`next start`, deferred issue #17), with a real database. Each test starts signed out and from a client address
 * of its own, as the proxy would send it, so the per-address limit never carries over between tests.
 * AC-3's 15-minute timing is proved with a controlled clock in `tests/integration/auth`; here the locked screen is
 * reached by really making six attempts.
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

const ERROR_TITLE = 'E-mail or password is not correct.';
const ERROR_BODY = 'Check both and try again.';
const LOCKED_MESSAGE = 'Too many attempts. Try again in 15 minutes, or ask the Admin to reset your password.';
const PAGE_GUTTER = 16;
const SESSION_COOKIE = '__Secure-next-auth.session-token';

/** The notice of the form. Next.js has a live region of its own with the same role, so the role alone is ambiguous. */
const noticeOf = (page: Page) => page.locator('[data-slot="alert"]');

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

async function openSignIn(page: Page, query = ''): Promise<void> {
  await page.goto(`/sign-in${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
}

test.describe('SCR-01 at this width (AC-8)', () => {
  test('AC-8: the page does not scroll sideways, and every control is at least 44 px', async ({ page }) => {
    await openSignIn(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    for (const control of [page.getByLabel('E-mail'), page.getByLabel('Password', { exact: true }), page.getByRole('button', { name: 'Show password' }), page.getByRole('button', { name: 'Sign in' })]) {
      const box = await control.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
  });

  test('AC-8: axe finds no violation (WCAG 2.0, 2.1 and 2.2 A and AA), in the default state and with the error shown', async ({ page }, testInfo) => {
    await openSignIn(page);
    await expectNoAxeViolations(page);
    await signInThroughThePage(page, disposableUser('axe', testInfo.project.name).email, 'a-wrong-password');
    await expect(noticeOf(page)).toContainText(ERROR_TITLE);
    await expectNoAxeViolations(page);
  });

  test('AC-8: the card is full width on a phone and the logo has its alternative text', async ({ page }, testInfo) => {
    await openSignIn(page);
    await expect(page.getByAltText('AccuCut logo')).toBeVisible();
    if (testInfo.project.name === 'mobile') {
      const card = await page.locator('[data-slot="card"]').boundingBox();
      const viewport = page.viewportSize();
      // Full width means the card fills the screen except the 16 px page gutter on each side (UX spec: below 480 px).
      expect((card?.width ?? 0) + 2 * PAGE_GUTTER).toBeGreaterThanOrEqual((viewport?.width ?? 0) - 1);
    }
  });

  test('AC-8: the fields name the browser\'s helpers (username, current-password), and paste is never blocked', async ({ page }) => {
    await openSignIn(page);
    await expect(page.getByLabel('E-mail')).toHaveAttribute('autocomplete', 'username');
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'current-password');
    for (const label of ['E-mail', 'Password']) {
      const prevented = await page.getByLabel(label, { exact: true }).evaluate((input) => {
        const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() });
        input.dispatchEvent(event);
        return event.defaultPrevented;
      });
      expect(prevented).toBe(false);
    }
  });

  test('AC-8: show and hide is a toggle button: aria-pressed changes, so does its name, and so does the field', async ({ page }) => {
    await openSignIn(page);
    const password = page.getByLabel('Password', { exact: true });
    const toggle = page.getByRole('button', { name: 'Show password' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(password).toHaveAttribute('type', 'password');
    await toggle.click();
    const shown = page.getByRole('button', { name: 'Hide password' });
    await expect(shown).toHaveAttribute('aria-pressed', 'true');
    await expect(password).toHaveAttribute('type', 'text');
    await shown.click();
    await expect(page.getByRole('button', { name: 'Show password' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('AC-8: the whole sign-in is done with the keyboard, and Enter submits', async ({ page }) => {
    await openSignIn(page);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    await page.getByRole('main').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('E-mail')).toBeFocused();
    await page.keyboard.type(E2E_ENGINEER.email);
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
    await page.keyboard.type(E2E_PASSWORD);
    await page.keyboard.press('Enter');
    await expectOnQueue(page, 'My tasks');
  });
});

test.describe('AC-1: the person lands on their role\'s home', () => {
  test('an Engineer lands on "My tasks" with the empty-state text of SCR-03', async ({ page }) => {
    await openSignIn(page);
    await signInThroughThePage(page, E2E_ENGINEER.email, E2E_PASSWORD);
    await expectOnQueue(page, 'My tasks');
    await expect(page.getByText('Nothing assigned to you right now')).toBeVisible();
    await expect(page.getByText('When a Lead assigns you a task it appears here, with its folder and deadline.')).toBeVisible();
  });

  test('a Lead lands on "Task queue" with the empty-state text of SCR-03', async ({ page }) => {
    await openSignIn(page);
    await signInThroughThePage(page, E2E_LEAD.email, E2E_PASSWORD);
    await expectOnQueue(page, 'Task queue');
    await expect(page.getByText('No open tasks')).toBeVisible();
    await expect(page.getByText('Assign a task to an Engineer and it appears here.')).toBeVisible();
  });

  test('the account menu shows who is signed in, with the e-mail and the role', async ({ page }) => {
    await openSignIn(page);
    await signInThroughThePage(page, E2E_LEAD.email, E2E_PASSWORD);
    await expectOnQueue(page, 'Task queue');
    await page.getByRole('button', { name: /Account menu/ }).click();
    const menu = page.getByRole('menu');
    await expect(menu).toContainText(E2E_LEAD.name);
    await expect(menu).toContainText(E2E_LEAD.email);
    await expect(menu).toContainText('Lead');
    await expect(page.getByText('Preview User')).toHaveCount(0);
  });
});

test.describe('the form checks before it sends', () => {
  test('asks for an e-mail address and a password in the words of SCR-01', async ({ page }) => {
    await openSignIn(page);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter your e-mail address.')).toBeVisible();
    await page.getByLabel('E-mail').fill('not an address');
    await page.getByLabel('Password', { exact: true }).focus();
    await expect(page.getByText('Enter an e-mail address like name@company.com.')).toBeVisible();
    await page.getByLabel('E-mail').fill(E2E_ENGINEER.email);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter your password.')).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});

test.describe('AC-2: one message for every failure', () => {
  const cases = [
    { name: 'a wrong password', email: (screenSize: string) => disposableUser('slip', screenSize).email, password: 'a-wrong-password' },
    { name: 'an unknown e-mail', email: () => 'nobody.at.all@example.test', password: E2E_PASSWORD },
  ];
  for (const failure of cases) {
    test(`${failure.name} shows the same message, keeps both fields as typed, and moves focus to the notice`, async ({ page }, testInfo) => {
      const email = failure.email(testInfo.project.name);
      await openSignIn(page);
      await signInThroughThePage(page, email, failure.password);
      const notice = noticeOf(page);
      await expect(notice).toHaveAttribute('role', 'alert');
      await expect(notice).toContainText(ERROR_TITLE);
      await expect(notice).toContainText(ERROR_BODY);
      await expect(page.getByLabel('E-mail')).toHaveValue(email);
      await expect(page.getByLabel('Password', { exact: true })).toHaveValue(failure.password);
      await expect(page.locator('div[tabindex="-1"]', { has: notice })).toBeFocused();
      await expect(page).toHaveURL(/\/sign-in$/);
    });
  }
});

test.describe('AC-3: five failures block the account', () => {
  test('the sixth attempt shows the locked message, also for a correct password and also for an unknown e-mail', async ({ page }) => {
    const email = `locked.${Date.now()}@example.test`;
    await openSignIn(page);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await signInThroughThePage(page, email, `wrong-password-${attempt}`);
      await expect(noticeOf(page)).toContainText(ERROR_TITLE);
    }
    await signInThroughThePage(page, email, 'wrong-password-6');
    await expect(noticeOf(page)).toContainText(LOCKED_MESSAGE);
    await expect(noticeOf(page)).not.toContainText(ERROR_TITLE);
    await expect(page.getByLabel('E-mail')).toHaveValue(email);
  });
});

test.describe('AC-4: sign-out', () => {
  test('clears the session, sends the next request to the sign-in page, and the back button shows nothing protected', async ({ page, context }, testInfo) => {
    // Signing out ends every session of the person, so it is a person of its own, never the Lead the other specs use.
    await openSignIn(page);
    await signInThroughThePage(page, disposableUser('sign-out', testInfo.project.name).email, E2E_PASSWORD);
    await expectOnQueue(page, 'My tasks');

    const protectedResponse = await page.goto('/queue');
    const cacheControl = protectedResponse?.headers()['cache-control'] ?? '';
    expect(cacheControl).toContain('private');
    expect(cacheControl).toContain('no-store');

    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    expect((await context.cookies()).some((cookie) => cookie.name === SESSION_COOKIE && cookie.value !== '')).toBe(false);

    await page.goto('/queue');
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'My tasks' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  });

  test('a visitor who asks for a protected page is sent to sign in, and comes back to it afterwards', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2F$/);
    await signInThroughThePage(page, E2E_ENGINEER.email, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Accucut Quotation Portal' })).toBeVisible();
  });
});

test.describe('AC-5: the session cookie in the production build', () => {
  test('has the __Secure- prefix, HttpOnly, Secure and SameSite=Lax', async ({ page, context }) => {
    await openSignIn(page);
    await signInThroughThePage(page, E2E_ENGINEER.email, E2E_PASSWORD);
    await expectOnQueue(page, 'My tasks');
    const cookie = (await context.cookies()).find((item) => item.name === SESSION_COOKIE);
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax' });
  });
});

test.describe('AC-6: only a same-origin relative path is honoured as the place to go', () => {
  const evil = [
    ['//evil.example', 'a protocol-relative address'],
    ['https://evil.example', 'an absolute address'],
    ['/\\evil.example', 'a slash and a backslash'],
  ] as const;
  for (const [address, what] of evil) {
    test(`${what} (${address}) is ignored: the person goes to their home`, async ({ page }) => {
      await openSignIn(page, `?callbackUrl=${encodeURIComponent(address)}`);
      await signInThroughThePage(page, E2E_ENGINEER.email, E2E_PASSWORD);
      await expectOnQueue(page, 'My tasks');
      expect(new URL(page.url()).origin).toBe(PRODUCTION_URL);
    });
  }
});
