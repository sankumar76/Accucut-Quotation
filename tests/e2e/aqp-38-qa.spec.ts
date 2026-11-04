import { expect, test, type Locator, type Page } from '@playwright/test';
import { Client } from 'pg';

import { assertSafeDatabaseTarget } from '../support/db-guard';
import { createTestHasher } from '../support/builders/user';

import { E2E_ENGINEER, E2E_PASSWORD, expectOnQueue, signInThroughThePage, useFreshAddress } from './support/auth';
import { expectNoAxeViolations } from './support/design-system';
import { PRODUCTION_URL } from './support/servers';

/**
 * QA acceptance checks for AQP-38 (STORY-01.01) AC-4, AC-6 and AC-8 at 360x800, 768x1024 and 1366x768, against the
 * production build, beyond the developer's `sign-in.spec.ts`: a keyboard-only sign-in with no scripted focus, a
 * visible focus indicator at every stop, the skip link actually used, the show and hide toggle by keyboard, field
 * errors wired to their fields, the tree a screen reader reads, axe in the field-error, locked and "could not be
 * checked" states, a stale cookie on a second device, and a signed-in visitor sent a hostile return address.
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

const SESSION_COOKIE = '__Secure-next-auth.session-token';
const LOCKED_MESSAGE = 'Too many attempts. Try again in 15 minutes, or ask the Admin to reset your password.';
const noticeOf = (page: Page) => page.locator('[data-slot="alert"]');

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

async function openSignIn(page: Page, query = ''): Promise<void> {
  await page.goto(`/sign-in${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
}

/** True when the focused element draws a focus indicator: an outline, or a ring drawn as a box-shadow. */
async function hasVisibleFocus(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
    const ring = style.boxShadow !== 'none' && style.boxShadow !== '';
    return outline || ring;
  });
}

/** A person of QA's own for one screen size, so signing them out never touches the developer's E2E people. */
async function ensureQaPerson(email: string): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') throw new Error('DATABASE_URL is not set.');
  assertSafeDatabaseTarget({ ...process.env, DATABASE_URL: url });
  const hash = await createTestHasher().hash(E2E_PASSWORD);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, must_change_password)
       VALUES ('QA stale-cookie person', $1, $2, 'ENGINEER'::user_role, true, false)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true, session_version = 0`,
      [email, hash],
    );
  } finally {
    await client.end();
  }
}

test.describe('[AQP-38 AC-8] keyboard and screen reader on SCR-01', () => {
  test('[AQP-38 AC-8] keyboard only: Tab reaches the fields in order, every stop shows focus, Space toggles the password, Enter signs in', async ({ page }) => {
    await openSignIn(page);
    const order: string[] = [];
    // Real Tab presses from the top of the page, no scripted focus, until the e-mail field has focus.
    for (let press = 0; press < 8; press += 1) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      order.push(await focused.evaluate((element) => element.getAttribute('aria-label') ?? element.getAttribute('name') ?? element.textContent?.trim() ?? element.tagName));
      expect(await hasVisibleFocus(focused), `focus indicator on stop ${press + 1}`).toBe(true);
      if (await page.getByLabel('E-mail').evaluate((element) => element === document.activeElement)) break;
    }
    expect(order[0]).toBe('Skip to main content');
    expect(order.at(-1)).toBe('email');

    await page.keyboard.type(E2E_ENGINEER.email);
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
    expect(await hasVisibleFocus(page.getByLabel('Password', { exact: true }))).toBe(true);
    await page.keyboard.type(E2E_PASSWORD);

    await page.keyboard.press('Tab');
    const toggle = page.getByRole('button', { name: 'Show password' });
    await expect(toggle).toBeFocused();
    expect(await hasVisibleFocus(toggle)).toBe(true);
    await page.keyboard.press('Space');
    const hide = page.getByRole('button', { name: 'Hide password' });
    await expect(hide).toBeFocused();
    await expect(hide).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue(E2E_PASSWORD);
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Show password' })).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.press('Tab');
    const submit = page.getByRole('button', { name: 'Sign in' });
    await expect(submit).toBeFocused();
    expect(await hasVisibleFocus(submit)).toBe(true);
    await page.keyboard.press('Enter');
    await expectOnQueue(page, 'My tasks');
  });

  test('[AQP-38 AC-8] the skip link, used with Enter, moves focus to the main content, and the next Tab is the e-mail field', async ({ page }) => {
    await openSignIn(page);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('E-mail')).toBeFocused();
  });

  test('[AQP-38 AC-8] the screen-reader tree of the form names every control, and the toggle reports its state', async ({ page }) => {
    await openSignIn(page);
    await expect(page.getByRole('main')).toMatchAriaSnapshot(`
      - heading "Sign in" [level=1]
      - paragraph: Use the e-mail and password you were given.
      - form "Sign in":
        - text: E-mail
        - textbox "E-mail"
        - text: Password
        - textbox "Password"
        - button "Show password" [pressed=false]
        - button "Sign in"
        - paragraph: Forgot your password? Ask the Admin to reset it.
    `);
    await expect(page.getByLabel('E-mail')).toHaveAttribute('type', 'email');
    await expect(page.getByLabel('E-mail')).toHaveAttribute('autocomplete', 'username');
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'current-password');
  });

  test('[AQP-38 AC-8] an empty and a malformed e-mail show their messages, wired to the field (aria-invalid, aria-describedby), with focus on the field, and axe finds nothing', async ({ page }) => {
    await openSignIn(page);
    await page.getByRole('button', { name: 'Sign in' }).click();
    const email = page.getByLabel('E-mail');
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toHaveAccessibleDescription(/Enter your e-mail address\./);
    await expect(page.getByLabel('Password', { exact: true })).toHaveAccessibleDescription(/Enter your password\./);
    await expectNoAxeViolations(page);

    await email.fill('not-an-address');
    await page.getByLabel('Password', { exact: true }).fill('x');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(email).toHaveAccessibleDescription(/Enter an e-mail address like name@company\.com\./);
    await expect(email).toBeFocused();
  });
});

test.describe('[AQP-38 AC-3, AC-8] the locked and "could not be checked" states', () => {
  test('[AQP-38 AC-3] the locked notice: exact text, an alert, focus moved to it, the e-mail kept, and axe finds nothing', async ({ page }, testInfo) => {
    const email = `qa38.locked.${testInfo.project.name}.${Date.now()}@example.test`;
    await openSignIn(page);
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      await signInThroughThePage(page, email, `wrong-${attempt}`);
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    }
    await expect(noticeOf(page)).toHaveText(LOCKED_MESSAGE);
    await expect(noticeOf(page)).toHaveAttribute('role', 'alert');
    await expect(page.locator(':focus')).toContainText(LOCKED_MESSAGE);
    await expect(page.getByLabel('E-mail')).toHaveValue(email);
    await expectNoAxeViolations(page);
  });

  test('[AQP-38] a sign-in the server could not check (503) shows "We could not sign you in.", not the wrong-password text, and axe finds nothing', async ({ page }) => {
    await page.route('**/api/auth/callback/credentials', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ url: '/sign-in?error=unavailable' }) }),
    );
    await openSignIn(page);
    await signInThroughThePage(page, E2E_ENGINEER.email, E2E_PASSWORD);
    await expect(noticeOf(page)).toContainText('We could not sign you in.');
    await expect(noticeOf(page)).not.toContainText('E-mail or password is not correct.');
    await expectNoAxeViolations(page);
  });

  test('[AQP-38] a network failure during sign-in shows the same "could not sign you in" notice and leaves the form usable', async ({ page }) => {
    await page.route('**/api/auth/callback/credentials', (route) => route.abort('internetdisconnected'));
    await openSignIn(page);
    await signInThroughThePage(page, E2E_ENGINEER.email, E2E_PASSWORD);
    await expect(noticeOf(page)).toContainText('We could not sign you in.');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });
});

test.describe('[AQP-38 AC-4, AC-6] sessions and return addresses in the browser', () => {
  test('[AQP-38 AC-4] a copied cookie on a second device is dead after sign-out on the first: it is sent to sign in, the page renders, and it can sign in again', async ({ browser, page, context }, testInfo) => {
    const email = `qa38.stale.${testInfo.project.name}@example.test`;
    await ensureQaPerson(email);
    await openSignIn(page);
    await signInThroughThePage(page, email, E2E_PASSWORD);
    await expectOnQueue(page, 'My tasks');
    const copied = (await context.cookies()).filter((cookie) => cookie.name === SESSION_COOKIE);
    expect(copied).toHaveLength(1);

    const second = await browser.newContext({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });
    try {
      await second.addCookies(copied);
      const other = await second.newPage();
      await other.goto('/queue');
      await expect(other.getByRole('heading', { level: 1, name: 'My tasks' })).toBeVisible();

      await page.getByRole('button', { name: /Account menu/ }).click();
      await page.getByRole('menuitem', { name: 'Sign out' }).click();
      await expect(page).toHaveURL(/\/sign-in$/);

      // The second device still holds the old cookie; the proxy lets it through, the page refuses it.
      await other.goto('/queue');
      await expect(other).toHaveURL(/\/sign-in/);
      await expect(other.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
      await expect(other.getByRole('heading', { level: 1, name: 'My tasks' })).toHaveCount(0);
      await signInThroughThePage(other, email, E2E_PASSWORD);
      await expectOnQueue(other, 'My tasks');
    } finally {
      await second.close();
    }
  });

  test('[AQP-38 AC-6] a signed-in visitor sent to /sign-in with a hostile return address is taken home, not away', async ({ page }) => {
    await openSignIn(page);
    await signInThroughThePage(page, E2E_ENGINEER.email, E2E_PASSWORD);
    await expectOnQueue(page, 'My tasks');
    for (const hostile of ['//evil.example', 'https://evil.example', '/\\evil.example', '/.//evil.example', 'javascript:alert(1)']) {
      await page.goto(`/sign-in?callbackUrl=${encodeURIComponent(hostile)}`);
      await expectOnQueue(page, 'My tasks');
      expect(new URL(page.url()).origin, hostile).toBe(PRODUCTION_URL);
    }
  });

  test('[AQP-38 AC-6] signing in from a link with a hostile return address lands at home on this site', async ({ page }) => {
    // Each hostile address and where the person must land: home, or (for an encoded one that is still a path) that
    // path on this site, which is not found. Never another site.
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['/.//evil.example', '/queue'],
      ['/%2F%2Fevil.example', '/%2F%2Fevil.example'],
      ['javascript:alert(1)', '/queue'],
    ];
    for (const [hostile, landing] of cases) {
      await page.context().clearCookies();
      await openSignIn(page, `?callbackUrl=${encodeURIComponent(hostile)}`);
      await signInThroughThePage(page, E2E_ENGINEER.email, E2E_PASSWORD);
      // Wait for the sign-in to finish: the page must have left /sign-in. (A check that only matched this site's origin
      // also matched the sign-in page itself, so the loop went on while the sign-in was still in flight and its late
      // session cookie redirected the next visit to /sign-in away from the page: the CI failure on run 41852484231.)
      await expect(page).not.toHaveURL(/\/sign-in(?:\?|$)/);
      const landed = new URL(page.url());
      expect(landed.origin, hostile).toBe(PRODUCTION_URL);
      expect(landed.pathname, hostile).toBe(landing);
      expect((await page.context().cookies()).some((cookie) => cookie.name === SESSION_COOKIE), hostile).toBe(true);
    }
  });
});
