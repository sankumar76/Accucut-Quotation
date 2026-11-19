import { expect, test, type Locator, type Page } from '@playwright/test';

import { connectToTestDatabase, createDisposableUser, E2E_ADMIN, E2E_ENGINEER, E2E_LEAD, E2E_PASSWORD } from './support/auth';
import { signInAs } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, DEVELOPMENT_URL, SIGNED_IN_STATE } from './support/servers';

/**
 * STORY-01.09 (AC-1, AC-2, AC-5, AC-6, AC-10; FR-006, NFR-004, NFR-016 to NFR-018): "Hand over Admin role" on SCR-14, at 360x800, 768x1024 and 1366x768, on the development server, signed in as the one E2E Admin (the saved
 * state of the set-up project, as `users.spec.ts` does).
 *
 * **Why no test here commits a hand-over.** The portal allows exactly one active Admin, and the whole suite shares one: the E2E Admin, whom the specs of every other Admin action (cancel approval, remove price, Users, Audit)
 * sign in as, at three widths and in four workers at once. A committed hand-over would make the E2E Admin a Lead and end their sessions in the middle of those specs, so it cannot run in this shared database. The part of a
 * hand-over only a database can prove (the swap in one transaction, exactly one Admin at every moment, the sessions, the one audit entry, the two requests at once, the rolled-back fault) is `tests/integration/users/admin-handover.test.ts`
 * (real PostgreSQL), and the route's order and refusals are `tests/unit/admin-handover-route.test.ts`. What this file proves is the part of the browser: the dialog and its choice (AC-1), the wrong password and the
 * refusals of the real server, none of which changes a row (AC-2, AC-5), the Saving state and the browser's leaving for the sign-in page when the server answers 204 (AC-3, the one answer stubbed), and who may call (AC-6).
 * Each test leaves the E2E Admin as the Admin with the sessions they had.
 *
 * The step-up count of the Admin is shared with the other step-up specs (a wrong password adds to it, a right one clears it). Each test here that makes a wrong password clears the count at the end, with a request that
 * passes the step-up and is refused after it (the Admin as the target: 409), so no run leaves the Admin one step from the block. Words are the UX spec's, written out here and not imported.
 */

test.use({ storageState: ADMIN_STATE });

const WRONG_PASSWORD = 'Invented-Wrong-E2E-Password-1!';
const WRONG_PASSWORD_MESSAGE = 'That password is not correct. Try again.';
const PASSWORD_HINT = 'We ask for your password again because this is the biggest change in the portal.';
const WARNING =
  'The person you choose becomes the Admin. You become a Lead and are signed out straight away. The new Admin signs in again to hold the role. There is only ever one Admin.';
const INACTIVE_MESSAGE = 'That person is deactivated, so they cannot take the Admin role. Choose another person.';
const SLOW_MILLISECONDS = 800;
const HANDOVER_ROUTE = '**/api/v1/users/*/admin-handover';
const JSON_HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' } as const;

const handOverButton = (page: Page) => page.locator('main button[data-action="handover"]');
const dialogOf = (page: Page) => page.getByRole('alertdialog', { name: 'Hand over the Admin role?' });
const choiceOf = (dialog: Locator) => dialog.getByRole('combobox', { name: 'New Admin' });
const passwordOf = (dialog: Locator) => dialog.getByLabel('Your password', { exact: true });
const submitOf = (dialog: Locator) => dialog.getByRole('button', { name: /^(Hand over|Handing over)$/ });
const cancelOf = (dialog: Locator) => dialog.getByRole('button', { name: 'Cancel' });

async function openUsers(page: Page): Promise<void> {
  const response = await page.goto('/users');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  // The buttons are plain HTML until React has attached their handlers; a press before that is lost (DEF-011).
  await waitUntilHydrated(page, 'main button[data-action="handover"]');
}

/** Opens the dialog from the button with the keyboard, the way a person who does not use a pointer does. */
async function openDialog(page: Page): Promise<Locator> {
  await handOverButton(page).focus();
  await page.keyboard.press('Enter');
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Chooses the person whose choice reads `label` ("E2E Lead (Lead)"). The list is in a layer of its own, outside the dialog. */
async function choose(page: Page, dialog: Locator, label: string): Promise<void> {
  await choiceOf(dialog).click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await expect(choiceOf(dialog)).toContainText(label);
}

interface Stored {
  readonly role: string;
  readonly isActive: boolean;
  readonly sessionVersion: number;
}

/** The E2E Admin's row and the number of hand-over entries, as the owner reads them: what a refusal must leave alone. */
async function adminState(): Promise<{ readonly id: string; readonly row: Stored; readonly entries: number }> {
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ id: string; role: string; is_active: boolean; session_version: number }>('SELECT id::text, role::text, is_active, session_version FROM users WHERE email = $1', [E2E_ADMIN.email]);
    const found = rows[0];
    if (found === undefined) throw new Error('The E2E Admin does not exist yet: the set-up project makes it.');
    const entries = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE event = 'user.admin_handed_over'");
    return { id: found.id, row: { role: found.role, isActive: found.is_active, sessionVersion: found.session_version }, entries: entries.rows[0]?.n ?? 0 };
  } finally {
    await client.end();
  }
}

async function idOf(email: string): Promise<string> {
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ id: string }>('SELECT id::text FROM users WHERE email = $1', [email]);
    const id = rows[0]?.id;
    if (id === undefined) throw new Error('The person does not exist yet.');
    return id;
  } finally {
    await client.end();
  }
}

async function deactivate(email: string): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    await client.query('UPDATE users SET is_active = false, session_version = session_version + 1 WHERE email = $1', [email]);
  } finally {
    await client.end();
  }
}

/** Gives the Admin's step-up count back to zero: the right password, passing the step-up, with the Admin as the target, which is refused 409 after it and changes nothing. */
async function clearStepUpCount(page: Page, adminId: string): Promise<void> {
  const answer = await page.request.post(`/api/v1/users/${adminId}/admin-handover`, { headers: JSON_HEADERS, data: { password: E2E_PASSWORD } });
  expect(answer.status(), 'the request that clears the count').toBe(409);
  expect(await answer.json()).toMatchObject({ code: 'CANNOT_HAND_OVER_TO_SELF' });
}

test.describe('AC-1, AC-10: the button and the dialog', () => {
  test('the Admin presses Hand over Admin role: the dialog offers the other active people, a Lead and an Engineer, never themself or a deactivated person; focus starts on Cancel; the warning and the password hint are there; Tab stays inside; no sideways scroll, no axe violation; Escape sends nothing and focus returns', async ({
    page,
  }, testInfo) => {
    const gone = await createDisposableUser('managed', testInfo);
    await deactivate(gone.email);
    const before = await adminState();
    await openUsers(page);
    let sent = 0;
    await page.route(HANDOVER_ROUTE, async (route) => {
      sent += 1;
      await route.continue();
    });

    const dialog = await openDialog(page);
    await expect(cancelOf(dialog)).toBeFocused();
    await expect(dialog).toContainText(WARNING);
    await expect(passwordOf(dialog)).toHaveAttribute('type', 'password');
    await expect(passwordOf(dialog)).toHaveAttribute('autocomplete', 'current-password');
    await expect(passwordOf(dialog)).toHaveAccessibleDescription(PASSWORD_HINT);
    await expect(dialog.getByText(PASSWORD_HINT)).toBeVisible();
    await expect(submitOf(dialog)).toBeEnabled();

    // The choice: a Lead and an Engineer are offered, whatever their role; the Admin themself and a deactivated person are not.
    await choiceOf(dialog).click();
    await expect(page.getByRole('option', { name: `${E2E_LEAD.name} (Lead)`, exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: `${E2E_ENGINEER.name} (Engineer)`, exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: new RegExp(`^${E2E_ADMIN.name} `) })).toHaveCount(0);
    await expect(page.getByRole('option', { name: gone.name })).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('option').first()).toBeHidden();
    await expect(dialog).toBeVisible();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    // Tab stays inside the dialog: the choice, the password, its show button, Cancel, Hand over, and round again.
    const inside = dialog.locator(':focus');
    for (let press = 0; press < 6; press += 1) {
      await page.keyboard.press('Tab');
      await expect(inside).toHaveCount(1);
    }

    // Nothing chosen and nothing typed: the two messages, each under its field, and nothing is sent.
    await submitOf(dialog).click();
    await expect(dialog.getByText('Choose the person who becomes the Admin.')).toBeVisible();
    await expect(dialog.getByText('Enter a password.')).toBeVisible();
    await expect(passwordOf(dialog)).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(handOverButton(page)).toBeFocused();
    expect(sent).toBe(0);
    expect(await adminState()).toEqual(before);
  });

  test('a reopened dialog starts empty: no choice kept, no password kept', async ({ page }) => {
    await openUsers(page);
    let dialog = await openDialog(page);
    await choose(page, dialog, `${E2E_LEAD.name} (Lead)`);
    await passwordOf(dialog).fill(WRONG_PASSWORD);
    await cancelOf(dialog).click();
    await expect(dialog).toHaveCount(0);
    dialog = await openDialog(page);
    await expect(choiceOf(dialog)).toContainText('Choose a person');
    await expect(passwordOf(dialog)).toHaveValue('');
  });
});

test.describe('AC-2: a wrong password', () => {
  test('is 422 under the password field with the field emptied and focused, the choice kept, the dialog still open, and nothing changed; the password is in no response', async ({ page }) => {
    const before = await adminState();
    await openUsers(page);
    const dialog = await openDialog(page);
    await choose(page, dialog, `${E2E_LEAD.name} (Lead)`);
    await passwordOf(dialog).fill(WRONG_PASSWORD);
    const answered = page.waitForResponse((response) => response.url().endsWith('/admin-handover'));
    await submitOf(dialog).click();
    const answer = await answered;
    expect(answer.status()).toBe(422);
    expect(await answer.text()).not.toContain(WRONG_PASSWORD);

    // The state "Hand over: wrong password": the spec's sentence under the field, which is announced as the field's description, emptied and focused.
    await expect(dialog.getByText(WRONG_PASSWORD_MESSAGE, { exact: true })).toBeVisible();
    await expect(passwordOf(dialog)).toBeFocused();
    await expect(passwordOf(dialog)).toHaveValue('');
    await expect(passwordOf(dialog)).toHaveAttribute('aria-invalid', 'true');
    await expect(passwordOf(dialog)).toHaveAccessibleDescription(`${PASSWORD_HINT} ${WRONG_PASSWORD_MESSAGE}`);
    await expect(choiceOf(dialog)).toContainText(`${E2E_LEAD.name} (Lead)`);
    await expect(dialog).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    expect(await adminState()).toEqual(before);
    await clearStepUpCount(page, before.id);
  });
});

test.describe('AC-5: the real server refuses a person who is no longer a choice, after the password passed', () => {
  test('a person deactivated while the dialog was open: 409 under the choice, the list is read again and the choice emptied, and nothing changes', async ({ page }, testInfo) => {
    const person = await createDisposableUser('managed', testInfo);
    const before = await adminState();
    await openUsers(page);
    const dialog = await openDialog(page);
    await choose(page, dialog, `${person.name} (Engineer)`);
    await passwordOf(dialog).fill(E2E_PASSWORD);
    // Another window deactivates the person after the page was read.
    await deactivate(person.email);
    const answered = page.waitForResponse((response) => response.url().endsWith('/admin-handover'));
    await submitOf(dialog).click();
    const answer = await answered;
    expect(answer.status()).toBe(409);
    expect(await answer.json()).toMatchObject({ code: 'HAND_OVER_TARGET_INACTIVE' });
    expect(await answer.text()).not.toContain(E2E_PASSWORD);

    await expect(dialog.getByText(INACTIVE_MESSAGE, { exact: true })).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(passwordOf(dialog)).toHaveValue('');
    // The list was read again: the person is gone from the choice, which is empty.
    await expect(choiceOf(dialog)).toContainText('Choose a person');
    await choiceOf(dialog).click();
    await expect(page.getByRole('option', { name: `${E2E_LEAD.name} (Lead)`, exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: person.name })).toHaveCount(0);
    await page.keyboard.press('Escape');

    expect(await adminState()).toEqual(before);
  });
});

test.describe('AC-3: when the server answers 204 (the one answer stubbed here; the swap is the integration test)', () => {
  test('shows "Handing over" with the buttons held and the dialog not dismissible, sends only the password to the person chosen, then leaves for the sign-in page', async ({ page }) => {
    const engineerId = await idOf(E2E_ENGINEER.email);
    const before = await adminState();
    await openUsers(page);
    const requests: Array<{ readonly url: string; readonly method: string; readonly body: unknown }> = [];
    await page.route(HANDOVER_ROUTE, async (route) => {
      const request = route.request();
      requests.push({ url: new URL(request.url()).pathname, method: request.method(), body: request.postDataJSON() });
      await new Promise<void>((resolve) => {
        setTimeout(resolve, SLOW_MILLISECONDS);
      });
      await route.fulfill({ status: 204 });
    });
    const dialog = await openDialog(page);
    await choose(page, dialog, `${E2E_ENGINEER.name} (Engineer)`);
    await passwordOf(dialog).fill(E2E_PASSWORD);

    const toSignIn = page.waitForRequest((request) => request.isNavigationRequest() && new URL(request.url()).pathname === '/sign-in');
    await submitOf(dialog).click();
    await expect(dialog.getByRole('button', { name: 'Handing over' })).toBeVisible();
    await expect(cancelOf(dialog)).toBeDisabled();
    await expect(passwordOf(dialog)).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();

    await toSignIn;
    expect(requests).toEqual([{ url: `/api/v1/users/${engineerId}/admin-handover`, method: 'POST', body: { password: E2E_PASSWORD } }]);
    // The stub changed nothing in the database: the E2E Admin is still the Admin, and the other specs are not disturbed.
    expect(await adminState()).toEqual(before);
  });
});

test.describe('AC-6: nobody but the Admin hands the role over', () => {
  test.describe('a Lead', () => {
    test.use({ storageState: SIGNED_IN_STATE });

    test('is refused 403 by the route, before the ID or the password is looked at, with the fixed answer; and has no Users page', async ({ page }) => {
      const before = await adminState();
      const unknown = '00000000-0000-4000-8000-0000000000ff';
      for (const id of [unknown, before.id]) {
        const refused = await page.request.post(`/api/v1/users/${id}/admin-handover`, { headers: JSON_HEADERS, data: { password: E2E_PASSWORD } });
        expect(refused.status()).toBe(403);
        const text = await refused.text();
        expect(text).not.toContain(E2E_PASSWORD);
        expect(JSON.parse(text)).toMatchObject({ status: 403, code: 'FORBIDDEN' });
      }
      expect((await page.goto('/users'))?.status()).toBe(403);
      await expect(handOverButton(page)).toHaveCount(0);
      expect(await adminState()).toEqual(before);
    });
  });

  test('an Engineer is refused 403 by the route, with the fixed answer', async ({ page }, testInfo) => {
    const engineer = await createDisposableUser('managed', testInfo);
    const before = await adminState();
    await signInAs(page, engineer);
    const refused = await page.request.post(`/api/v1/users/${before.id}/admin-handover`, { headers: JSON_HEADERS, data: { password: E2E_PASSWORD } });
    expect(refused.status()).toBe(403);
    expect(await refused.text()).not.toContain(E2E_PASSWORD);
    expect(await adminState()).toEqual(before);
  });

  test.describe('a signed-out caller', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('is refused 401, and nothing changes', async ({ page }) => {
      const before = await adminState();
      const refused = await page.request.post(`/api/v1/users/${before.id}/admin-handover`, { headers: JSON_HEADERS, data: { password: E2E_PASSWORD } });
      expect(refused.status()).toBe(401);
      expect(await adminState()).toEqual(before);
    });
  });
});
