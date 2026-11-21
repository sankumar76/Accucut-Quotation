import { expect, test, type Page } from '@playwright/test';

import { createDisposableUser, expectOnQueue, signInThroughThePage, unknownEmail, useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { countResetTokens, insertResetToken } from './support/reset-link';
import { PRODUCTION_URL } from './support/servers';

/**
 * STORY-09.07, SCR-02 (the request and the reset) at 360x800, 768x1024 and 1366x768, against the PRODUCTION build (`next start`), with a real database. The servers run with `FEATURE_EMAIL` off and no
 * worker, so no mail is sent here: a reset link is put into the database the way the server would store it (`support/reset-link.ts`), and the path of the real e-mail (request, outbox, Mailpit, the
 * link, the reset, the new sign-in) is `tests/integration/auth/password-reset.test.ts`. Each test starts signed out, from a client address of its own, and makes the person it needs, so nobody else's
 * password, sessions or counts are touched. One page is opened for each case, and at most one accessibility scan is made in it (the E2E budget).
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

const NEW_PASSWORD = 'Pr9$kWd3!Rx-fresh';
const INVALID_LINK = 'This link has already been used or has expired. Ask for a new link.';
const ACCEPTED = 'Check your e-mail. If that address is registered, a reset link is on its way. It can be used once.';
const JSON_HEADERS = { origin: PRODUCTION_URL, 'content-type': 'application/json' } as const;

/** The live regions of a notice. Next.js has a live region of its own with the same role, so the role alone is ambiguous. */
const noticeOf = (page: Page) => page.locator('[data-slot="alert"]');

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

async function openRequest(page: Page): Promise<void> {
  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { level: 1, name: 'Forgot your password?' })).toBeVisible();
  await waitUntilHydrated(page, 'form[aria-label="Request a reset link"]', 'onSubmit');
}

async function openReset(page: Page, token: string): Promise<void> {
  await page.goto(`/reset-password?token=${token}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Choose a new password' })).toBeVisible();
}

test.describe('SCR-02 the request page (AC-1 to AC-4, AC-10)', () => {
  test('AC-10: the page does not scroll sideways, every control is at least 44 px, and axe finds no violation', async ({ page }) => {
    await openRequest(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    for (const control of [page.getByLabel('E-mail'), page.getByRole('button', { name: 'Send reset link' })]) {
      expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/sign-in');
    await expectNoAxeViolations(page);
  });

  test('AC-2, AC-3, D-1: a malformed address stays under the field; any valid one gets the one message, and with e-mail off nothing is made', async ({ page }, testInfo) => {
    const person = await createDisposableUser('password', testInfo);
    await openRequest(page);
    await page.getByLabel('E-mail').fill('not-an-address');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('Enter an e-mail address like name@company.com.')).toBeVisible();
    await expect(page.getByLabel('E-mail')).toBeFocused();
    await expect(page.getByLabel('E-mail')).toHaveValue('not-an-address');

    await page.getByLabel('E-mail').fill(person.email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(noticeOf(page)).toContainText(ACCEPTED);
    await expect(page.getByRole('button', { name: 'Send reset link' })).toHaveCount(0);
    // FEATURE_EMAIL is off on these servers: the person is real and active, and still no link was made (decision D-1).
    expect(await countResetTokens(person.id)).toBe(0);

    // The answer for an address nobody has is the same message (FR-001), read from the route.
    const unknown = await page.request.post('/api/v1/account/password/forgot', { headers: JSON_HEADERS, data: { email: unknownEmail(testInfo) } });
    expect(unknown.status()).toBe(202);
    expect(await unknown.json()).toEqual({ message: ACCEPTED });
  });

  test('AC-4: the 6th request for one e-mail in 15 minutes is refused in the server\'s words, and says nothing about the address', async ({ page }, testInfo) => {
    const typed = unknownEmail(testInfo);
    await openRequest(page);
    for (let count = 0; count < 5; count += 1) {
      const answer = await page.request.post('/api/v1/account/password/forgot', { headers: JSON_HEADERS, data: { email: typed } });
      expect(answer.status(), `request ${count + 1}`).toBe(202);
    }
    await page.getByLabel('E-mail').fill(typed);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(noticeOf(page)).toContainText('Too many requests. Try again in 15 minutes.');
    await expect(noticeOf(page)).not.toContainText(typed);
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
  });
});

test.describe('SCR-02 the reset page (AC-5 to AC-9, AC-10)', () => {
  test('AC-5, AC-9, AC-10: a link that works shows New password and Repeat, is never cached or sent on as a Referer, is not indexed, and axe finds no violation', async ({ page }, testInfo) => {
    const person = await createDisposableUser('password', testInfo);
    const token = await insertResetToken(person.id);
    const response = await page.goto(`/reset-password?token=${token}`);
    expect(response?.headers()['cache-control']).toContain('no-store');
    expect(response?.headers()['referrer-policy']).toBe('no-referrer');
    await expect(page.getByRole('heading', { level: 1, name: 'Choose a new password' })).toBeVisible();
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Repeat new password')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    // No script or image comes from another site (AC-9), and the token is not written into the page's text.
    const foreign = await page.evaluate(() => [...document.querySelectorAll('script[src], img[src], link[href]')].map((node) => node.getAttribute('src') ?? node.getAttribute('href') ?? '').filter((address) => /^https?:\/\//.test(address)));
    expect(foreign).toEqual([]);
    expect(await page.locator('main').innerText()).not.toContain(token);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-5, AC-7: an expired link and an unknown token show the same sentence and a link to ask for a new one', async ({ page }, testInfo) => {
    const person = await createDisposableUser('password', testInfo);
    const expired = await insertResetToken(person.id, { expiresInMinutes: -1 });
    await page.goto(`/reset-password?token=${expired}`);
    await expect(noticeOf(page)).toContainText(INVALID_LINK);
    await expect(page.getByRole('link', { name: 'Ask for a new link' })).toHaveAttribute('href', '/forgot-password');
    await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0);
    // Focus is on the heading, as on the sign-in page (AC-10).
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();

    // An unknown token, and a page with no token at all, read the same (the page says nothing about why).
    for (const address of ['/reset-password?token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '/reset-password']) {
      const answer = await page.request.get(address);
      expect(answer.status()).toBe(200);
      expect(await answer.text()).toContain(INVALID_LINK);
    }
  });

  test('AC-6, AC-7, AC-8, AC-10: the rule names its part and keeps the link, the link works once, and the new password signs in', async ({ page }, testInfo) => {
    const person = await createDisposableUser('password', testInfo);
    const token = await insertResetToken(person.id);
    await openReset(page, token);
    await waitUntilHydrated(page, 'form[aria-label="Choose a new password"]', 'onSubmit');
    const fresh = page.getByLabel('New password', { exact: true });
    const repeat = page.getByLabel('Repeat new password');

    // A password that is too short is refused on the page, under the field, with focus on it; nothing was sent.
    await fresh.fill('Ab1!');
    await repeat.fill('Ab1!');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('The new password must be at least 10 characters.').last()).toBeVisible();
    await expect(fresh).toBeFocused();

    // Two that differ.
    await fresh.fill(NEW_PASSWORD);
    await repeat.fill(`${NEW_PASSWORD}x`);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('The two passwords do not match.').last()).toBeVisible();
    await expect(repeat).toBeFocused();

    // The e-mail address as the password: the server names the part (AC-8) and the same link still works.
    await fresh.fill(person.email);
    await repeat.fill(person.email);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('The password cannot be the same as your e-mail address.').last()).toBeVisible();
    await expect(fresh).toBeFocused();

    // A good one, sent with the keyboard.
    await fresh.fill(NEW_PASSWORD);
    await repeat.fill(NEW_PASSWORD);
    await repeat.press('Enter');
    await expect(noticeOf(page)).toContainText('Your password has been changed.');
    await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0);

    // The same link a second time: 400, and nothing changes (AC-7).
    const again = await page.request.post('/api/v1/account/password/reset', { headers: JSON_HEADERS, data: { token, newPassword: 'Another9#password' } });
    expect(again.status()).toBe(400);
    expect(((await again.json()) as { code: string }).code).toBe('RESET_LINK_INVALID');

    // And the new password signs in.
    await page.getByRole('link', { name: 'Sign in' }).click();
    await signInThroughThePage(page, person.email, NEW_PASSWORD);
    await expectOnQueue(page, 'My tasks');
  });
});
