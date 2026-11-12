import { randomBytes } from 'node:crypto';

import { expect, test, type APIRequestContext, type Browser, type Locator, type Page, type PlaywrightWorkerArgs, type TestInfo } from '@playwright/test';

// `useFreshAddress` is a helper of this suite whose name starts with `use` but is not a React hook; the alias keeps the hooks rule from reading it as one.
import { createDisposableUser, E2E_PASSWORD, signInThroughThePage, useFreshAddress as setFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilAccountMenuIsLive, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-01.05 T6 (AC-2, AC-3, AC-5, AC-6, AC-7): SCR-23 "Account" at 360x800, 768x1024 and 1366x768 on the development server. Each test
 * works on a person made for it (kind `password`, or one the Admin adds), so the three screen sizes and the retries never meet on one,
 * and what the change does to sessions and to the attempt count reaches nobody else. The words are the UX spec's (v0.27, "SCR-23 Account:
 * final words"), written out here. One test, the block (AC-6), reads no layout and runs at one width (test strategy section 10.5, architect
 * ruling on AQP-81, DL-191 F9); the other three read layout and run at three.
 *
 *   - the change: a wrong current password and a mismatch are named, the right ones change the password, the browser that made the change
 *     stays signed in, another device is signed out, the old password is refused at sign-in and the new one accepted;
 *   - the rule: every part of it is named under New password, with the hint; no sideways scroll, 44 px controls, axe 0 violations,
 *     `autocomplete`, paste, the show and hide toggle, keyboard only;
 *   - the block: five wrong current passwords block the form for 15 minutes and sign-in still works;
 *   - "Set a new password": a person the Admin added or reset is sent there from every page, sees no side menu or profile, and goes
 *     home once the password is set.
 */

test.use({ storageState: { cookies: [], origins: [] } });

const FIRST_PASSWORD = 'invented-first-password-1';
const TEMPORARY_PASSWORD = 'invented-temporary-password-2';
const NEW_PASSWORD = 'Pr9$kWd3!Rx-fresh';
const WRONG_PASSWORD = 'Not-the-current-1!';

const CHANGE_PATH = '**/api/v1/account/password';
const HINT = 'At least 10 and at most 128 characters, with at least one number and one symbol, such as ! # $ or %.';
const CURRENT_WRONG = 'Your current password is not correct.';
const MISMATCH = 'The two new passwords do not match.';
const SAME_AS_CURRENT = 'Choose a new password that is different from your current one.';
const BLOCKED_BODY = 'Try again in 15 minutes, or ask the Admin to reset your password. Your password has not been changed.';
const FAILED_BODY = 'Check your connection and try again. If you are asked to sign in, try your new password first.';
const CHANGED_ELSEWHERE = 'Your password was just changed somewhere else. Enter the newest password as your current password and try again.';
const SUCCESS_TITLE = 'Your password has been changed.';
const SUCCESS_BODY = 'Use the new one the next time you sign in.';
const MUST_CHANGE_NOTICE =
  'The password you were given is only for your first sign-in. Until you change it, every page opens this one. After that you go straight to your work.';

interface Person {
  readonly id?: string;
  readonly name: string;
  readonly email: string;
}

async function signIn(page: Page, person: Person, password: string): Promise<void> {
  await setFreshAddress(page.context());
  await page.goto('/sign-in');
  await signInThroughThePage(page, person.email, password);
}

async function openAccount(page: Page): Promise<void> {
  await page.goto('/account');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // The form is plain HTML until React has attached its handlers; a press before that is a plain form post (DEF-011).
  await waitUntilHydrated(page, 'form[aria-label="Change password"]', 'onSubmit');
}

const current = (page: Page): Locator => page.getByLabel('Current password', { exact: true });
const newPassword = (page: Page): Locator => page.getByLabel('New password', { exact: true });
const repeat = (page: Page): Locator => page.getByLabel('Repeat new password', { exact: true });
const submit = (page: Page): Locator => page.getByRole('button', { name: 'Change password', exact: true });

/** Fills the three fields and presses Enter in the last one, as a person who does not use a pointer does. */
async function fillAndSend(page: Page, values: { readonly current: string; readonly next: string; readonly repeat?: string }): Promise<void> {
  await current(page).fill(values.current);
  await newPassword(page).fill(values.next);
  await repeat(page).fill(values.repeat ?? values.next);
  await repeat(page).press('Enter');
}

/** The Admin, through the API and the saved Admin state (the Users screen's own calls). */
async function adminApi(playwright: PlaywrightWorkerArgs['playwright']): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL: DEVELOPMENT_URL, storageState: ADMIN_STATE });
}

async function addPerson(admin: APIRequestContext, label: string, testInfo: TestInfo): Promise<Person> {
  const suffix = randomBytes(3).toString('hex');
  const person = { name: `E2E ${label} ${suffix}`, email: `e2e.${label}.${testInfo.project.name}.${suffix}@example.test` };
  const response = await admin.post('/api/v1/users', {
    headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
    data: { ...person, role: 'ENGINEER', password: FIRST_PASSWORD },
  });
  expect(response.status()).toBe(201);
  const body: unknown = await response.json();
  const id = typeof body === 'object' && body !== null && 'id' in body && typeof body.id === 'string' ? body.id : '';
  expect(id).not.toBe('');
  return { ...person, id };
}

async function signedInOnAnotherDevice(browser: Browser, person: Person, password: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: DEVELOPMENT_URL });
  const page = await context.newPage();
  await signIn(page, person, password);
  await expect(page).toHaveURL(/\/queue$/);
  return page;
}

test.describe('the change (AC-2, AC-3)', () => {
  test('names a wrong current password and a mismatch, then changes the password: the old one is refused, the new one signs in, this browser stays in and another device is out', async ({ page, browser }, testInfo) => {
    const person = await createDisposableUser('password', testInfo);
    await signIn(page, person, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/queue$/);
    const otherDevice = await signedInOnAnotherDevice(browser, person, E2E_PASSWORD);

    // From the account menu, as a person finds it.
    await waitUntilAccountMenuIsLive(page);
    await page.getByRole('button', { name: /^Account menu/ }).click();
    await page.getByRole('menuitem', { name: 'Change password' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
    // The profile the Admin set, read only.
    const profile = page.getByRole('heading', { level: 2, name: 'Profile' }).locator('xpath=ancestor::*[@data-slot="card"][1]');
    await expect(profile).toContainText(person.name);
    await expect(profile).toContainText(person.email);
    await expect(profile).toContainText('Engineer');
    await waitUntilHydrated(page, 'form[aria-label="Change password"]', 'onSubmit');

    // Nothing typed: the three empty-field messages and the summary, and nothing is sent.
    await submit(page).click();
    await expect(page.getByRole('alert').filter({ hasText: '3 things need fixing.' })).toBeVisible();
    await expect(page.locator('#current-password-error')).toHaveText('Enter your current password.');
    await expect(page.locator('#new-password-error')).toHaveText('Enter a new password.');
    await expect(page.locator('#repeat-password-error')).toHaveText('Repeat the new password.');

    // A wrong current password: named under its field, in the summary, and focus goes there.
    await fillAndSend(page, { current: WRONG_PASSWORD, next: NEW_PASSWORD });
    await expect(page.getByRole('alert').filter({ hasText: '1 thing needs fixing.' })).toContainText(CURRENT_WRONG);
    await expect(page.locator('#current-password-error')).toHaveText(CURRENT_WRONG);
    await expect(current(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(current(page)).toBeFocused();

    // A mismatch is the screen's own check; nothing is sent.
    await fillAndSend(page, { current: E2E_PASSWORD, next: NEW_PASSWORD, repeat: `${NEW_PASSWORD}x` });
    await expect(page.locator('#repeat-password-error')).toHaveText(MISMATCH);
    await expect(repeat(page)).toBeFocused();
    await expect(page.getByRole('alert').filter({ hasText: '1 thing needs fixing.' }).getByRole('link', { name: MISMATCH })).toBeVisible();

    // Right: the notice, the fields cleared, and still signed in after a reload.
    await fillAndSend(page, { current: E2E_PASSWORD, next: NEW_PASSWORD });
    const saved = page.getByRole('status').filter({ hasText: SUCCESS_TITLE });
    await expect(saved).toContainText(SUCCESS_BODY);
    await expect(current(page)).toHaveValue('');
    await expect(newPassword(page)).toHaveValue('');
    await expect(repeat(page)).toHaveValue('');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
    expect((await page.request.get('/api/v1/me')).status()).toBe(200);

    // Tokens issued before the change are refused: the other device is out.
    expect((await otherDevice.request.get('/api/v1/me', { maxRedirects: 0 })).status()).toBe(401);
    await otherDevice.context().close();

    // The old password is refused at sign-in, the new one accepted.
    await page.context().clearCookies();
    await signIn(page, person, E2E_PASSWORD);
    await expect(page.getByText('E-mail or password is not correct.')).toBeVisible();
    await signIn(page, person, NEW_PASSWORD);
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('AC-2, AC-7: names every part of the rule under New password with the hint; paste is allowed, the fields are labelled, the toggle shows the text; no sideways scroll, 44 px controls, axe 0 violations', async ({ page }, testInfo) => {
    const person = await createDisposableUser('password', testInfo);
    await signIn(page, person, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/queue$/);
    await openAccount(page);

    // Labels, hint and the attributes a password manager reads.
    await expect(newPassword(page)).toHaveAccessibleDescription(HINT);
    await expect(page.getByText(HINT)).toBeVisible();
    await expect(current(page)).toHaveAttribute('autocomplete', 'current-password');
    await expect(newPassword(page)).toHaveAttribute('autocomplete', 'new-password');
    await expect(repeat(page)).toHaveAttribute('autocomplete', 'new-password');

    // Paste is never blocked (WCAG 3.3.8): nothing cancels the paste event.
    const defaultPrevented = await newPassword(page).evaluate((element) => {
      const event = new Event('paste', { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(defaultPrevented).toBe(false);

    // The toggle is a button that says what it does and shows the text.
    await newPassword(page).fill(NEW_PASSWORD);
    const toggle = page.getByRole('button', { name: 'Show password' }).nth(1);
    await expect(newPassword(page)).toHaveAttribute('type', 'password');
    await toggle.click();
    await expect(newPassword(page)).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(newPassword(page)).toHaveAttribute('type', 'password');

    // Every part of the rule, in the UX spec's words. The first six are the screen's own checks; the last is the server's.
    const rule: ReadonlyArray<readonly [string, string]> = [
      ['Short1!x', 'The new password must be at least 10 characters.'],
      [`Aa1!${'x'.repeat(125)}`, 'Use 128 characters or fewer.'],
      ['abcdefghijkl', 'Add at least one number and one symbol, such as ! # $ or %.'],
      ['abcdef-ghijkl', 'Add at least one number.'],
      ['abcdefghij77', 'Add at least one symbol, such as ! # $ or %.'],
      [person.email.toUpperCase(), 'The password cannot be the same as your e-mail address.'],
      ['Password1!', 'That password is too common. Choose a different one.'],
    ];
    for (const [password, message] of rule) {
      await fillAndSend(page, { current: E2E_PASSWORD, next: password });
      await expect(page.locator('#new-password-error')).toHaveText(message);
      await expect(newPassword(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(newPassword(page)).toBeFocused();
    }

    // QLT-01: the new password is the current one. Nothing is sent; the rule's own messages come first; another letter case is a different password, which the unit tests hold (sending it would change the password).
    const posts: string[] = [];
    page.on('request', (request) => void (request.method() === 'POST' && request.url().includes('/api/v1/account/password') && posts.push(request.url())));
    await fillAndSend(page, { current: E2E_PASSWORD, next: E2E_PASSWORD });
    await expect(page.locator('#new-password-error')).toHaveText(SAME_AS_CURRENT);
    await expect(page.getByRole('alert').filter({ hasText: '1 thing needs fixing.' }).getByRole('link', { name: SAME_AS_CURRENT })).toBeVisible();
    await expect(newPassword(page)).toBeFocused();
    expect(posts).toEqual([]);
    await fillAndSend(page, { current: 'Short1!x', next: 'Short1!x' });
    await expect(page.locator('#new-password-error')).toHaveText('The new password must be at least 10 characters.');
    await fillAndSend(page, { current: E2E_PASSWORD, next: E2E_PASSWORD.toUpperCase() });
    await expect(page.locator('#new-password-error')).toHaveCount(0);

    // The error state, as a person sees it: it fits the width, its controls are large enough, and axe finds nothing.
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    for (const field of [current(page), newPassword(page), repeat(page)]) {
      expect((await field.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    expect((await submit(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    for (const button of await page.getByRole('button', { name: /^(Show|Hide) password$/ }).all()) {
      const box = await button.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    await expectNoAxeViolations(page);
  });
});

test.describe('the block (AC-6)', () => {
  test('five wrong current passwords block the form for 15 minutes, and the person can still sign in', { tag: '@one-width' }, async ({ page }, testInfo) => {
    const person = await createDisposableUser('password', testInfo);
    await signIn(page, person, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/queue$/);
    await openAccount(page);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await fillAndSend(page, { current: `${WRONG_PASSWORD}${attempt}`, next: NEW_PASSWORD });
      await expect(page.locator('#current-password-error')).toHaveText(CURRENT_WRONG);
    }
    // The sixth is refused whatever it holds, even the right current password.
    await fillAndSend(page, { current: E2E_PASSWORD, next: NEW_PASSWORD });
    const blocked = page.getByRole('alert').filter({ hasText: 'Too many attempts.' });
    await expect(blocked).toContainText(BLOCKED_BODY);
    // The fields keep what was typed and the button stays enabled (UX spec SCR-23 "final words", Blocked).
    await expect(current(page)).toHaveValue(E2E_PASSWORD);
    await expect(submit(page)).toBeEnabled();

    // The answers a test cannot get from the real server, stubbed in turn (rows 5 to 7 of the spec's tests): each shows its own words in one alert
    // and never the connection sentence when the connection worked, and the fields keep their values.
    const problem = (status: number, code: string, title: string) => JSON.stringify({ type: 'about:blank', title, status, code, requestId: 'req-00000000' });
    const answerWith = async (answer: { readonly status: number; readonly code: string; readonly title: string } | 'no-answer'): Promise<void> => {
      await page.unroute(CHANGE_PATH);
      await page.route(CHANGE_PATH, (route) =>
        answer === 'no-answer'
          ? route.abort('connectionreset')
          : route.fulfill({ status: answer.status, contentType: 'application/problem+json', body: problem(answer.status, answer.code, answer.title) }),
      );
      await repeat(page).press('Enter');
    };
    await answerWith({ status: 409, code: 'PASSWORD_CHANGED_ELSEWHERE', title: CHANGED_ELSEWHERE });
    await expect(page.getByRole('alert').filter({ hasText: CHANGED_ELSEWHERE })).toHaveCount(1);
    await expect(page.getByText('Check your connection')).toHaveCount(0);
    await expect(current(page)).toHaveValue(E2E_PASSWORD);
    await answerWith({ status: 403, code: 'PASSWORD_CHANGE_REQUIRED', title: 'Set a new password to continue.' });
    await expect(page.getByRole('alert').filter({ hasText: 'Set a new password to continue.' })).toHaveCount(1);
    await expect(page.getByText('Check your connection')).toHaveCount(0);
    await answerWith('no-answer');
    const failed = page.getByRole('alert').filter({ hasText: 'We could not change your password.' });
    await expect(failed).toContainText(FAILED_BODY);
    await expect(newPassword(page)).toHaveValue(NEW_PASSWORD);
    await page.unroute(CHANGE_PATH);

    // Mistyping here never locks the person out of signing in: it has a key of its own.
    await page.context().clearCookies();
    await signIn(page, person, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/queue$/);
  });
});

test.describe('"Set a new password" (AC-5, AC-7)', () => {
  test('a person the Admin adds, and one whose password the Admin resets, is sent to it from every page, sees no side menu or profile, and goes home once the password is set', async ({ page, playwright }, testInfo) => {
    const admin = await adminApi(playwright);
    const person = await addPerson(admin, 'mustchange', testInfo);

    await signIn(page, person, FIRST_PASSWORD);
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeVisible();
    await expect(page.getByText('You must do this before you can use the portal.')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Choose a new password to continue.' })).toContainText(MUST_CHANGE_NOTICE);
    await expect(page.getByRole('heading', { level: 2, name: 'Profile' })).toHaveCount(0);
    // No side menu and no menu button: the portal has nothing else to offer until the password is set.
    await expect(page.locator('aside')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open menu' })).toHaveCount(0);
    await waitUntilHydrated(page, 'form[aria-label="Change password"]', 'onSubmit');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    // Every other page opens this one, and every other API route says so.
    await page.goto('/queue');
    await expect(page).toHaveURL(/\/account$/);
    await page.goto('/users');
    await expect(page).toHaveURL(/\/account$/);
    const me = await page.request.get('/api/v1/me');
    expect(me.status()).toBe(403);
    expect(await me.json()).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });

    // QLT-01: typing the temporary password again keeps them here (the page refuses it; so does the server, and the duty stays).
    await waitUntilHydrated(page, 'form[aria-label="Change password"]', 'onSubmit');
    await fillAndSend(page, { current: FIRST_PASSWORD, next: FIRST_PASSWORD });
    await expect(page.locator('#new-password-error')).toHaveText(SAME_AS_CURRENT);
    await expect(page).toHaveURL(/\/account$/);
    const sameByApi = await page.request.post('/api/v1/account/password', {
      headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
      data: { currentPassword: FIRST_PASSWORD, newPassword: FIRST_PASSWORD },
    });
    expect(sameByApi.status()).toBe(422);
    expect(await sameByApi.json()).toMatchObject({ code: 'PASSWORD_RULE', errors: [{ field: 'newPassword', message: SAME_AS_CURRENT }] });
    expect((await page.request.get('/api/v1/me')).status()).toBe(403);

    // A password that does not meet the rule keeps them here; one that does takes them to their work, with the menu.
    await fillAndSend(page, { current: FIRST_PASSWORD, next: 'Short1!x' });
    await expect(page.locator('#new-password-error')).toHaveText('The new password must be at least 10 characters.');
    await fillAndSend(page, { current: FIRST_PASSWORD, next: NEW_PASSWORD });
    await expect(page).toHaveURL(/\/queue$/);
    await expect(page.getByRole('heading', { level: 1, name: 'My tasks' })).toBeVisible();
    await expect(page.locator('aside')).toHaveCount(1);
    expect((await page.request.get('/api/v1/me')).status()).toBe(200);

    // The Admin resets the password: the person's sessions end, the temporary password signs in, and the page is "Set a new password" again.
    const reset = await admin.post(`/api/v1/users/${person.id ?? ''}/password-reset`, {
      headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
      data: { password: TEMPORARY_PASSWORD },
    });
    expect(reset.status()).toBe(204);
    expect((await page.request.get('/api/v1/me', { maxRedirects: 0 })).status()).toBe(401);
    await page.context().clearCookies();
    await signIn(page, person, TEMPORARY_PASSWORD);
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeVisible();
    await admin.dispose();
  });
});
