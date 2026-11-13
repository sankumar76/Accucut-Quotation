import { randomBytes } from 'node:crypto';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Locator, type Page, type PlaywrightWorkerArgs, type TestInfo } from '@playwright/test';

import { HARNESS_NEXT_PASSWORD } from '../support/harness-password';

// `useFreshAddress` is a helper of this suite whose name starts with `use` but is not a React hook; the alias keeps the hooks rule from reading it as one.
import { createDisposableUser, E2E_PASSWORD, signInThroughThePage, useFreshAddress as setFreshAddress } from './support/auth';
import { AXE_TAGS, expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, DEVELOPMENT_URL } from './support/servers';

/**
 * QA control for AQP-81 (STORY-01.05), G7 on PR 341 head ceb6787, DL-204 (5) (b), (d), (e) and (f). Not for merge: a throwaway branch run in CI only.
 *
 * The project sets the width (mobile 360x800, tablet 768x1024, desktop 1366x768), so each test runs at the three widths of DL-194 (2). Every test works on a
 * person made for it, so the three widths and a retry never meet on one. Output lines start with "QA81" so the evidence can be read from the job log.
 * Invented data only.
 *
 *   - (b) the Blocked state of SCR-23 after five wrong current passwords: the ux-spec v0.27 words, the focus, the fields as typed, the button, no sideways
 *     scroll, and axe with the five NFR-018 tags;
 *   - (d) a stubbed 409 and a stubbed 403 with no field message show the server's title only, never the connection sentence; a dropped connection does
 *     (the control that shows the assertion can fail);
 *   - (e) on the real server, a new password equal to the current one is 422 under `newPassword` in both states and changes nothing;
 *   - (f) a person who must change their password is refused on the three customer routes AQP-142 brought in, and after the change the refusal becomes
 *     the ordinary role refusal. The person is a Lead: the portal holds one active Admin (CONSTRAINT-04) and it is the shared state of the whole suite, so an
 *     Admin who must change cannot be made here. The Admin case is `tests/unit/aqp-81-qa-must-change-customers.test.ts`.
 */

test.use({ storageState: { cookies: [], origins: [] } });

const FIRST_PASSWORD = 'invented-first-password-1';
const NEW_PASSWORD = 'invented-fresh-password-3';
const WRONG_PASSWORD = 'Not-the-current-1!';
const CASE_ONLY_PASSWORD = 'Invented-e2e-password-for-aqp-38';

const CHANGE_PATH = '**/api/v1/account/password';
const CURRENT_WRONG = 'Your current password is not correct.';
const SAME_AS_CURRENT = 'Choose a new password that is different from your current one.';
const BLOCKED_TITLE = 'Too many attempts.';
const BLOCKED_BODY = 'Try again in 15 minutes, or ask the Admin to reset your password. Your password has not been changed.';
const FAILED_TITLE = 'We could not change your password.';
const FAILED_BODY = 'Check your connection and try again. If you are asked to sign in, try your new password first.';
const CHANGED_ELSEWHERE = 'Your password was just changed somewhere else. Enter the newest password as your current password and try again.';
const MUST_CHANGE_TITLE = 'Set a new password to continue.';
const jsonHeaders = (origin: string) => ({ origin, 'content-type': 'application/json' });

/** Evidence for the job log; a QA control only, so the console rule is lifted for this one line. */
function note(line: string): void {
  // eslint-disable-next-line no-console
  console.log(line);
}

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
  await waitUntilHydrated(page, 'form[aria-label="Change password"]', 'onSubmit');
}

const current = (page: Page): Locator => page.getByLabel('Current password', { exact: true });
const newPassword = (page: Page): Locator => page.getByLabel('New password', { exact: true });
const repeat = (page: Page): Locator => page.getByLabel('Repeat new password', { exact: true });

async function fillAndSend(page: Page, values: { readonly current: string; readonly next: string }): Promise<void> {
  await current(page).fill(values.current);
  await newPassword(page).fill(values.next);
  await repeat(page).fill(values.next);
  await repeat(page).press('Enter');
}

async function adminApi(playwright: PlaywrightWorkerArgs['playwright']): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL: DEVELOPMENT_URL, storageState: ADMIN_STATE });
}

async function addPerson(admin: APIRequestContext, label: string, role: 'LEAD' | 'ENGINEER', testInfo: TestInfo): Promise<Person> {
  const suffix = randomBytes(3).toString('hex');
  const person = { name: `E2E ${label} ${suffix}`, email: `e2e.${label}.${testInfo.project.name}.${suffix}@example.test` };
  const response = await admin.post('/api/v1/users', { headers: jsonHeaders(DEVELOPMENT_URL), data: { ...person, role, password: FIRST_PASSWORD } });
  expect(response.status()).toBe(201);
  const body: unknown = await response.json();
  const id = typeof body === 'object' && body !== null && 'id' in body && typeof body.id === 'string' ? body.id : '';
  expect(id).not.toBe('');
  return { ...person, id };
}

/** What has focus, and whether the notice (the `alert`) is inside it. */
async function focusReading(page: Page): Promise<{ readonly tag: string; readonly tabindex: string; readonly holdsAlert: boolean }> {
  return page.evaluate(() => {
    const active = document.activeElement;
    return {
      tag: active?.tagName ?? '',
      tabindex: active?.getAttribute('tabindex') ?? '',
      holdsAlert: active !== null && active.querySelector('[role="alert"]') !== null,
    };
  });
}

test.describe('(b) the Blocked state of SCR-23', () => {
  test('QA81 (b): five wrong current passwords block the form: the v0.27 words in an alert that holds focus, the fields as typed, the button enabled, page overflow 0, axe 0 violations', async ({ page }, testInfo) => {
    const width = page.viewportSize()?.width ?? 0;
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
    const blocked = page.getByRole('alert').filter({ hasText: BLOCKED_TITLE });
    await expect(blocked).toBeVisible();
    await expect(blocked).toContainText(BLOCKED_BODY);
    const words = (await blocked.innerText()).replaceAll(/\s+/g, ' ').trim();
    expect(words).toBe(`${BLOCKED_TITLE} ${BLOCKED_BODY}`);
    await expect(blocked).toHaveAttribute('role', 'alert');

    // Focus is on the notice: the wrapper of the alert takes it, once the alert is in the page.
    await expect.poll(async () => (await focusReading(page)).holdsAlert).toBe(true);
    const focus = await focusReading(page);
    expect(focus.tabindex).toBe('-1');

    // The fields keep what was typed, the button stays enabled, and nothing was cleared.
    await expect(current(page)).toHaveValue(E2E_PASSWORD);
    await expect(newPassword(page)).toHaveValue(NEW_PASSWORD);
    await expect(repeat(page)).toHaveValue(NEW_PASSWORD);
    await expect(page.getByRole('button', { name: 'Change password', exact: true })).toBeEnabled();
    expect(await page.locator('#current-password-error').count()).toBe(0);

    const overflow = await horizontalOverflow(page);
    expect(overflow).toBeLessThanOrEqual(0);
    const innerWidth = await page.evaluate(() => window.innerWidth);

    // axe with the five NFR-018 tags: the shared helper asserts none, and the same scan is read here so the count is in the log.
    await expectNoAxeViolations(page);
    const scan = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    note(`QA81 (b) ${JSON.stringify({ project: testInfo.project.name, width, innerWidth, words, focus, overflow, axeTags: AXE_TAGS, violations: scan.violations.length, passes: scan.passes.length })}`);
    expect(AXE_TAGS).toEqual(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
    expect(scan.violations).toEqual([]);

    // The block is on its own key: the person can still sign in.
    await page.context().clearCookies();
    await signIn(page, person, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/queue$/);
  });
});

test.describe('(d) a refusal with no field message shows the title only', () => {
  const problem = (status: number, code: string, title: string) => JSON.stringify({ type: 'about:blank', title, status, code, requestId: 'req-00000000' });
  const cases = [
    { name: '409', status: 409, code: 'PASSWORD_CHANGED_ELSEWHERE', title: CHANGED_ELSEWHERE },
    { name: '403', status: 403, code: 'PASSWORD_CHANGE_REQUIRED', title: MUST_CHANGE_TITLE },
  ] as const;

  for (const answer of cases) {
    test(`QA81 (d): a stubbed ${answer.name} with no field message shows "${answer.title}" as the title, with no body and not the connection sentence`, async ({ page }, testInfo) => {
      const person = await createDisposableUser('password', testInfo);
      await signIn(page, person, E2E_PASSWORD);
      await expect(page).toHaveURL(/\/queue$/);
      await openAccount(page);
      await page.route(CHANGE_PATH, (route) => route.fulfill({ status: answer.status, contentType: 'application/problem+json', body: problem(answer.status, answer.code, answer.title) }));

      await fillAndSend(page, { current: E2E_PASSWORD, next: NEW_PASSWORD });
      const shown = page.getByRole('alert').filter({ hasText: answer.title });
      await expect(shown).toHaveCount(1);
      const words = (await shown.innerText()).replaceAll(/\s+/g, ' ').trim();
      note(`QA81 (d) ${JSON.stringify({ project: testInfo.project.name, status: answer.status, words })}`);
      expect(words, 'the title only: no body under it').toBe(answer.title);
      await expect(page.getByText(FAILED_TITLE)).toHaveCount(0);
      await expect(page.getByText('Check your connection')).toHaveCount(0);
      // No field message and no summary: the refusal has no field to put it under.
      await expect(page.locator('#current-password-error')).toHaveCount(0);
      await expect(page.locator('#new-password-error')).toHaveCount(0);
      await expect(page.locator('#repeat-password-error')).toHaveCount(0);
      await expect(page.getByRole('alert').filter({ hasText: /things? needs? fixing/ })).toHaveCount(0);
      // The values stay, and the notice has focus.
      await expect(current(page)).toHaveValue(E2E_PASSWORD);
      await expect(newPassword(page)).toHaveValue(NEW_PASSWORD);
      await expect.poll(async () => (await focusReading(page)).holdsAlert).toBe(true);
    });
  }

  test('QA81 (d) control: a dropped connection does show the connection sentence, so the two tests above can fail', async ({ page }, testInfo) => {
    const person = await createDisposableUser('password', testInfo);
    await signIn(page, person, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/queue$/);
    await openAccount(page);
    await page.route(CHANGE_PATH, (route) => route.abort('connectionreset'));
    await fillAndSend(page, { current: E2E_PASSWORD, next: NEW_PASSWORD });
    const failed = page.getByRole('alert').filter({ hasText: FAILED_TITLE });
    await expect(failed).toContainText(FAILED_BODY);
    note(`QA81 (d) control ${JSON.stringify({ project: testInfo.project.name, words: (await failed.innerText()).replaceAll(/\s+/g, ' ').trim() })}`);
  });
});

test.describe('(e) a new password equal to the current one, on the real server', () => {
  test('QA81 (e): 422 under newPassword in the ordinary state; no cookie is set, the session stays, and the same password still signs in; another letter case is a different password', async ({ page }, testInfo) => {
    const person = await createDisposableUser('password', testInfo);
    await signIn(page, person, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/queue$/);

    const same = await page.request.post('/api/v1/account/password', {
      headers: jsonHeaders(DEVELOPMENT_URL),
      data: { currentPassword: E2E_PASSWORD, newPassword: E2E_PASSWORD },
    });
    expect(same.status()).toBe(422);
    expect(same.headers()['set-cookie']).toBeUndefined();
    const body: unknown = await same.json();
    expect(body).toMatchObject({ code: 'PASSWORD_RULE', errors: [{ field: 'newPassword', message: SAME_AS_CURRENT }] });
    note(`QA81 (e) ordinary ${JSON.stringify({ project: testInfo.project.name, status: same.status(), body })}`);
    // Nothing changed: the session is still the same version, and the password still signs in.
    expect((await page.request.get('/api/v1/me', { maxRedirects: 0 })).status()).toBe(200);
    await page.context().clearCookies();
    await signIn(page, person, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/queue$/);

    // The same letters in another case are a different password: it is accepted (204).
    const caseOnly = await page.request.post('/api/v1/account/password', {
      headers: jsonHeaders(DEVELOPMENT_URL),
      data: { currentPassword: E2E_PASSWORD, newPassword: CASE_ONLY_PASSWORD },
    });
    expect(caseOnly.status()).toBe(204);
    note(`QA81 (e) case-only ${JSON.stringify({ project: testInfo.project.name, status: caseOnly.status() })}`);
  });

  test('QA81 (e): 422 under newPassword in "Set a new password"; the duty stays and the temporary password still signs in', async ({ page, playwright }, testInfo) => {
    const admin = await adminApi(playwright);
    const person = await addPerson(admin, 'qa81same', 'ENGINEER', testInfo);
    await signIn(page, person, FIRST_PASSWORD);
    await expect(page).toHaveURL(/\/account$/);

    const same = await page.request.post('/api/v1/account/password', {
      headers: jsonHeaders(DEVELOPMENT_URL),
      data: { currentPassword: FIRST_PASSWORD, newPassword: FIRST_PASSWORD },
    });
    expect(same.status()).toBe(422);
    expect(same.headers()['set-cookie']).toBeUndefined();
    const body: unknown = await same.json();
    expect(body).toMatchObject({ code: 'PASSWORD_RULE', errors: [{ field: 'newPassword', message: SAME_AS_CURRENT }] });
    note(`QA81 (e) must-change ${JSON.stringify({ project: testInfo.project.name, status: same.status(), body })}`);
    const me = await page.request.get('/api/v1/me');
    expect(me.status(), 'the duty to change the password stays').toBe(403);
    expect(await me.json()).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
    await page.context().clearCookies();
    await signIn(page, person, FIRST_PASSWORD);
    await expect(page).toHaveURL(/\/account$/);
    await admin.dispose();
  });
});

test.describe('(f) a person who must change their password, on the customer routes of AQP-142', () => {
  test('QA81 (f): /masters/customers goes to /account, and the customer APIs answer 403 PASSWORD_CHANGE_REQUIRED, until the password is set; then the refusal is the ordinary role refusal', async ({ page, playwright }, testInfo) => {
    const admin = await adminApi(playwright);
    const person = await addPerson(admin, 'qa81customers', 'LEAD', testInfo);
    await signIn(page, person, FIRST_PASSWORD);
    await expect(page).toHaveURL(/\/account$/);

    const refused: Record<string, unknown> = {};
    await page.goto('/masters/customers');
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeVisible();
    refused['page /masters/customers'] = new URL(page.url()).pathname;
    for (const [method, path] of [
      ['GET', '/api/v1/options/customers'],
      ['GET', '/api/v1/customers'],
      ['POST', '/api/v1/customers'],
    ] as const) {
      const response =
        method === 'GET'
          ? await page.request.get(path)
          : await page.request.post(path, { headers: jsonHeaders(DEVELOPMENT_URL), data: { name: 'Invented Customer' } });
      expect(response.status(), `${method} ${path}`).toBe(403);
      expect(await response.json()).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED', title: MUST_CHANGE_TITLE });
      refused[`${method} ${path}`] = response.status();
    }
    note(`QA81 (f) must-change ${JSON.stringify({ project: testInfo.project.name, refused })}`);

    // Set the password. A Lead's home is the task queue.
    await waitUntilHydrated(page, 'form[aria-label="Change password"]', 'onSubmit');
    await fillAndSend(page, { current: FIRST_PASSWORD, next: HARNESS_NEXT_PASSWORD });
    await expect(page).toHaveURL(/\/queue$/);

    // After the change the options route opens for every role, and the Admin-only routes refuse the Lead for their role, not for the duty.
    const options = await page.request.get('/api/v1/options/customers');
    expect(options.status()).toBe(200);
    const list = await page.request.get('/api/v1/customers');
    expect(list.status()).toBe(403);
    expect(await list.json()).not.toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
    const customersPage = await page.goto('/masters/customers');
    expect(customersPage?.status(), 'a Lead gets SCR-26 "no access", not a redirect to /account').toBe(403);
    expect(new URL(page.url()).pathname).toBe('/masters/customers');
    note(`QA81 (f) settled ${JSON.stringify({ project: testInfo.project.name, options: options.status(), list: list.status(), page: customersPage?.status() })}`);
    await admin.dispose();
  });
});

test.describe('AC-7 keyboard only', () => {
  /** Where focus is, by what a person hears: the label of a field, or the name of a button; and whether it draws a focus indicator. */
  async function stop(page: Page): Promise<{ readonly name: string; readonly indicator: boolean }> {
    return page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement)) return { name: '', indicator: false };
      const label = element instanceof HTMLInputElement ? (element.labels?.[0]?.textContent ?? '') : '';
      const style = getComputedStyle(element);
      return {
        name: (element.getAttribute('aria-label') ?? (label || (element.textContent ?? ''))).trim(),
        indicator: style.outlineStyle !== 'none' || style.boxShadow !== 'none',
      };
    });
  }

  test('QA81 AC-7: the whole change is made with the keyboard: Tab reaches every field, every toggle and the button in order, Space shows and hides, Enter sends, and a success notice follows', async ({ page }, testInfo) => {
    const person = await createDisposableUser('password', testInfo);
    await signIn(page, person, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/queue$/);
    await openAccount(page);

    await current(page).focus();
    const walked = [await stop(page)];
    // Typing by keyboard, then Tab to the next stop.
    await page.keyboard.type(E2E_PASSWORD);
    for (let step = 1; step <= 6; step += 1) {
      await page.keyboard.press('Tab');
      walked.push(await stop(page));
      if (step === 2) await page.keyboard.type(NEW_PASSWORD);
      if (step === 4) await page.keyboard.type(NEW_PASSWORD);
    }
    const names = walked.map((entry) => entry.name);
    note(`QA81 AC-7 keyboard ${JSON.stringify({ project: testInfo.project.name, walked })}`);
    expect(names).toEqual(['Current password', 'Show password', 'New password', 'Show password', 'Repeat new password', 'Show password', 'Change password']);
    expect(walked.every((entry) => entry.indicator), 'every stop draws a focus indicator').toBe(true);
    await expect(current(page)).toHaveValue(E2E_PASSWORD);
    await expect(newPassword(page)).toHaveValue(NEW_PASSWORD);
    await expect(repeat(page)).toHaveValue(NEW_PASSWORD);

    // Space shows the text of New password and again hides it, with the keyboard only (Shift+Tab back to the second toggle, the one beside New password).
    for (let back = 0; back < 3; back += 1) await page.keyboard.press('Shift+Tab');
    expect(await stop(page)).toMatchObject({ name: 'Show password' });
    await expect(page.getByRole('button', { name: 'Show password' }).nth(1)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(newPassword(page)).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(newPassword(page)).toHaveAttribute('type', 'password');

    // On to the button and Enter.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect((await stop(page)).name).toBe('Change password');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'Your password has been changed.' })).toBeVisible();
    await expect.poll(async () => (await focusReading(page)).tag).toBe('DIV');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
