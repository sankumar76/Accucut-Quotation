import { randomInt } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { createDisposableUser, expectOnQueue, signInThroughThePage, unknownEmail, useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, REFLOW_HEIGHT, REFLOW_WIDTH, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { countResetTokens, insertResetToken } from './support/reset-link';
import { PRODUCTION_URL, SIGNED_IN_STATE } from './support/servers';

/**
 * STORY-09.07, SCR-02 (the request and the reset) at 360x800, 768x1024 and 1366x768, against the PRODUCTION build (`next start`), with a real database. The servers run with `FEATURE_EMAIL` off and no
 * worker, so no mail is sent here, and (STORY-01.10 AC-10, AC-11, DEF-083) `/forgot-password` shows the explanation that says so instead of the form: the request form itself is not on these servers, so its
 * answers are read from the route and its logic is `tests/unit/auth/password-reset-client.test.ts`: a reset link is put into the database the way the server would store it (`support/reset-link.ts`), and the path of the real e-mail (request, outbox, Mailpit, the
 * link, the reset, the new sign-in) is `tests/integration/auth/password-reset.test.ts`. Each test starts signed out, from a client address of its own, and makes the person it needs, so nobody else's
 * password, sessions or counts are touched. One page is opened for each case, and at most one accessibility scan is made in it (the E2E budget).
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

const NEW_PASSWORD = 'Pr9$kWd3!Rx-fresh';
// STORY-01.10 AC-12 (G-2b): with e-mail off the notice says the title and "Ask the Admin to reset your password.", and offers no link to ask for a new one.
const INVALID_LINK_TITLE = 'This link has already been used or has expired.';
const INVALID_LINK_BODY = 'Ask the Admin to reset your password.';
const ACCEPTED = 'Check your e-mail. If that address is registered, a reset link is on its way. It can be used once.';

/**
 * The headers of a call made straight to a route: the portal's own origin (the CSRF check) and a client address of its own, as the proxy would send it, so the limit of 5 requests per address
 * never counts against another test (a call with no address shares one counter with every other call that has none).
 */
function jsonHeaders(): Record<string, string> {
  return { origin: PRODUCTION_URL, 'content-type': 'application/json', 'x-forwarded-for': `198.51.${randomInt(0, 256)}.${randomInt(1, 255)}` };
}

/** The live regions of a notice. Next.js has a live region of its own with the same role, so the role alone is ambiguous. */
const noticeOf = (page: Page) => page.locator('[data-slot="alert"]');

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

async function openReset(page: Page, token: string): Promise<void> {
  await page.goto(`/reset-password?token=${token}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Choose a new password' })).toBeVisible();
}

const EXPLANATION = {
  heading: 'Forgot your password?',
  lead: 'Ask the Admin to reset it.',
  title: 'Reset links are not sent by e-mail yet.',
  first: 'The Admin sets a temporary password and gives it to you in person or by phone. Sign in with it, then choose a password of your own.',
  second: 'If you are the Admin, ask Accucut IT.',
} as const;

test.describe('SCR-02 the request page with e-mail off (STORY-01.10 AC-10, AC-11; DEF-083)', () => {
  test('AC-10a, AC-11b: the page opened by its address says to ask the Admin, shows no form, and has one h1, no live region, a 44 px link back, no sideways scroll at 320 px, and no axe violation', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { level: 1, name: EXPLANATION.heading })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByText(EXPLANATION.lead, { exact: true })).toBeVisible();
    const notice = page.locator('[data-slot="alert"]');
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText(EXPLANATION.title);
    await expect(notice).toContainText(EXPLANATION.first);
    await expect(notice).toContainText(EXPLANATION.second);

    // No form, no field, no button, and nothing that says a link is on its way (G2.1, G2.2).
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.getByLabel('E-mail')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Send reset link' })).toHaveCount(0);
    await expect(page.getByText('Check your e-mail')).toHaveCount(0);
    await expect(page.getByText('on its way')).toHaveCount(0);
    // Nothing changes after the page loads, so nothing is announced (the live region of Next.js itself is outside main).
    await expect(page.locator('main [role="alert"], main [role="status"], main [aria-live]')).toHaveCount(0);

    const back = page.getByRole('link', { name: 'Back to sign in' });
    await expect(back).toHaveAttribute('href', '/sign-in');
    expect((await back.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    await page.setViewportSize({ width: REFLOW_WIDTH, height: REFLOW_HEIGHT });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('AC-10a: "Back to sign in" works, and the sign-in page keeps its sentence', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to sign in' }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    // The sign-in page keeps its sentence, in the same words (G2.7).
    await expect(page.getByText('Forgot your password? Ask the Admin to reset it.')).toBeVisible();
  });

  test('AC-10c, AC-11a: the production build answers per request, the same for everyone: a "mail=on" in the address does nothing and a signed-in person sees the same words', async ({ page, browser }) => {
    await page.goto('/forgot-password?mail=on');
    await expect(page.getByText(EXPLANATION.title)).toBeVisible();
    await expect(page.locator('form')).toHaveCount(0);
    const signedOutText = await page.locator('main').innerText();

    const signedIn = await browser.newContext({ baseURL: PRODUCTION_URL, storageState: SIGNED_IN_STATE });
    try {
      const other = await signedIn.newPage();
      await other.goto('/forgot-password');
      await expect(other.getByText(EXPLANATION.title)).toBeVisible();
      expect(await other.locator('main').innerText()).toBe(signedOutText);
    } finally {
      await signedIn.close();
    }
  });

  test('AC-11a, FR-001, D-1: the route behind the form is unchanged: a real active person and an unknown address get the one 202 message, nothing is made, and the page makes no request of its own', async ({ page }, testInfo) => {
    const person = await createDisposableUser('password', testInfo);
    const posted: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST') posted.push(request.url());
    });
    await page.goto('/forgot-password');
    await expect(page.getByText(EXPLANATION.title)).toBeVisible();
    expect(posted).toEqual([]);

    const real = await page.request.post('/api/v1/account/password/forgot', { headers: jsonHeaders(), data: { email: person.email } });
    expect(real.status()).toBe(202);
    expect(await real.json()).toEqual({ message: ACCEPTED });
    // FEATURE_EMAIL is off on these servers: the person is real and active, and still no link was made (decision D-1).
    expect(await countResetTokens(person.id)).toBe(0);

    // The answer for an address nobody has is the same message (FR-001).
    const unknown = await page.request.post('/api/v1/account/password/forgot', { headers: jsonHeaders(), data: { email: unknownEmail(testInfo) } });
    expect(unknown.status()).toBe(202);
    expect(await unknown.json()).toEqual({ message: ACCEPTED });
  });

  test('AC-4: the 6th request for one e-mail in 15 minutes is refused in the server\'s words, and says nothing about the address', async ({ page }, testInfo) => {
    const typed = unknownEmail(testInfo);
    for (let count = 0; count < 5; count += 1) {
      const answer = await page.request.post('/api/v1/account/password/forgot', { headers: jsonHeaders(), data: { email: typed } });
      expect(answer.status(), `request ${count + 1}`).toBe(202);
    }
    const refused = await page.request.post('/api/v1/account/password/forgot', { headers: jsonHeaders(), data: { email: typed } });
    expect(refused.status()).toBe(429);
    const body = await refused.text();
    expect(body).toContain('Too many requests. Try again in 15 minutes.');
    expect(body).not.toContain(typed);
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

  test('AC-5, AC-7, AC-12: an expired link and an unknown token show the same words, "Ask the Admin to reset your password.", and no link to ask for a new one (e-mail is off)', async ({ page }, testInfo) => {
    const person = await createDisposableUser('password', testInfo);
    const expired = await insertResetToken(person.id, { expiresInMinutes: -1 });
    await page.goto(`/reset-password?token=${expired}`);
    await expect(noticeOf(page)).toContainText(INVALID_LINK_TITLE);
    await expect(noticeOf(page)).toContainText(INVALID_LINK_BODY);
    await expect(page.getByRole('link', { name: 'Ask for a new link' })).toHaveCount(0);
    await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0);
    // Focus is on the heading, as on the sign-in page (AC-10).
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();

    // An unknown token, and a page with no token at all, read the same (the page says nothing about why).
    for (const address of ['/reset-password?token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '/reset-password']) {
      const answer = await page.request.get(address);
      expect(answer.status()).toBe(200);
      const text = await answer.text();
      expect(text).toContain(INVALID_LINK_TITLE);
      expect(text).toContain(INVALID_LINK_BODY);
      expect(text).not.toContain('Ask for a new link');
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
    const again = await page.request.post('/api/v1/account/password/reset', { headers: jsonHeaders(), data: { token, newPassword: 'Another9#password' } });
    expect(again.status()).toBe(400);
    expect(((await again.json()) as { code: string }).code).toBe('RESET_LINK_INVALID');

    // And the new password signs in.
    await page.getByRole('link', { name: 'Sign in' }).click();
    await signInThroughThePage(page, person.email, NEW_PASSWORD);
    await expectOnQueue(page, 'My tasks');
  });
});
