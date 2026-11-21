import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';
import { seedFailedMail } from './support/mail-failures';
import { ADMIN_STATE, DEVELOPMENT_URL, SIGNED_IN_STATE } from './support/servers';

/**
 * STORY-09.02 (AC-1, AC-3 to AC-6, AC-8, AC-9): SCR-15 "Settings", the e-mail alerts card, at 360x800, 768x1024 and 1366x768 on the development server, as the E2E Admin and the E2E Lead.
 * The words are the UX spec's and the story's, written out here and not imported.
 *
 * The three widths run this file at the same time against one database, so the one real save is the SAME value from each (alerts OFF, the name "Accucut Portal", no address): it is
 * idempotent, and it leaves the sender address empty, which is the state the security scan's valid call of the test e-mail relies on (a 422 `NO_SENDER` that never touches the mail
 * transport). Everything else (the switch ON, a sender address, the test e-mail and its failures) goes through a stubbed answer of the two routes, so nothing is stored and no
 * message is sent; the real routes, the real transport and a real capturing mail server are `tests/integration/settings/alerts-settings.test.ts`, and the roles are
 * `tests/security/role-matrix.test.ts`.
 */

const SETTINGS_API = '**/api/v1/settings';
const TEST_API = '**/api/v1/settings/test-email';
const NAME = 'Accucut Portal';
const OWN_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+$/;

const SENDER_NOT_ALLOWED_TEXT =
  'The test e-mail was not sent. The mail server did not accept this sender address for this mailbox. Change the sender e-mail address to one the mailbox is allowed to send from, or ask Accucut IT.';
const TEST_FAILED_TEXT =
  'The test e-mail was not sent. The mail server did not answer. Mail server details are set by Accucut IT on the server. Try again, or ask them to check the connection.';

interface Card {
  readonly card: Locator;
  readonly alerts: Locator;
  readonly name: Locator;
  readonly address: Locator;
  readonly save: Locator;
  readonly test: Locator;
  readonly live: Locator;
}

function card(page: Page): Card {
  const root = page.getByRole('form', { name: 'E-mail alerts' });
  return {
    card: root,
    alerts: root.getByRole('switch', { name: /^E-mail alerts: (ON|OFF)$/ }),
    name: root.getByLabel('Sender name'),
    address: root.getByLabel('Sender e-mail address'),
    save: root.getByRole('button', { name: 'Save settings' }),
    test: root.getByRole('button', { name: 'Send test e-mail' }),
    live: root.locator('[aria-live="polite"]'),
  };
}

async function openSettings(page: Page): Promise<Card> {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  return card(page);
}

const problem = (status: number, code: string): Parameters<Route['fulfill']>[0] => ({
  status,
  contentType: 'application/problem+json',
  body: JSON.stringify({ type: 'about:blank', title: 'Something went wrong on our side.', status, code, requestId: 'req-00000000' }),
});

/** Stubs `PUT /api/v1/settings` (the body the page sent is kept) and leaves every other method alone. */
async function stubSave(page: Page, answer: (body: unknown) => Parameters<Route['fulfill']>[0]): Promise<unknown[]> {
  const sent: unknown[] = [];
  await page.route(SETTINGS_API, async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    const body: unknown = route.request().postDataJSON();
    sent.push(body);
    return route.fulfill(answer(body));
  });
  return sent;
}

test.describe('the Admin', () => {
  test.use({ storageState: ADMIN_STATE });

  test('AC-1, AC-3: the real save is the same value from every width, and the page reads it back', async ({ page }) => {
    const { alerts, name, address, save, live } = await openSettings(page);
    await expect(alerts).toBeVisible();
    // The switch is OFF unless something saved otherwise, and this spec never saves ON for real.
    await expect(alerts).toHaveAttribute('aria-checked', 'false');
    await name.fill(NAME);
    await address.fill('');
    await save.click();
    await expect(live).toContainText('Settings saved');

    await page.reload();
    const again = card(page);
    await expect(again.name).toHaveValue(NAME);
    await expect(again.address).toHaveValue('');
    await expect(again.alerts).toHaveAttribute('aria-checked', 'false');
    const read = (await (await page.request.get('/api/v1/settings')).json()) as Record<string, unknown>;
    expect(read).toMatchObject({ alertsEnabled: false, senderName: NAME, senderAddress: '' });
    expect(JSON.stringify(read)).not.toMatch(/password|secret|token/i);
  });

  test('AC-1, AC-9: the card is what the story says, and states that the mail server credentials are set on the server', async ({ page }) => {
    const { card: root, alerts, name, address, save, test: testButton } = await openSettings(page);
    await expect(root.getByRole('heading', { level: 2, name: 'E-mail alerts' })).toBeVisible();
    await expect(alerts).toBeVisible();
    await expect(root.getByText('When OFF, nothing is sent.')).toBeVisible();
    await expect(name).toBeVisible();
    await expect(address).toBeVisible();
    await expect(root.getByText('The mail server password is set on the server by Accucut IT, not here.')).toBeVisible();
    await expect(save).toBeVisible();
    await expect(testButton).toBeVisible();
    await expect(root.getByText(/^The test e-mail goes to your own address, .+\. It is sent from the saved sender\.$/)).toBeVisible();
    // No password field of the mail server anywhere on the page, and the Last backup lines are still there.
    await expect(page.getByLabel(/password/i)).toHaveCount(0);
    await expect(page.getByText('Last good backup', { exact: true })).toBeVisible();
    await expect(page.getByText('Backups are kept on the same server.', { exact: true })).toBeVisible();
  });

  test('STORY-09.06 AC-8: an e-mail that failed for good shows the warning "E-mails not sent" (an icon, a title, role alert, no address, no class code), with no overflow and no axe violation', async ({ page }) => {
    await seedFailedMail();
    await openSettings(page);
    const notice = page.getByRole('alert').filter({ hasText: 'E-mails not sent' });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/\d+ e-mails? could not be sent in the last 7 days\./);
    await expect(notice).toContainText('Last problem: The mail server could not be reached. Ask Accucut IT.');
    await expect(notice.locator('svg')).toHaveCount(1);
    await expect(notice).not.toContainText('@');
    await expect(notice).not.toContainText('CONNECTION');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-8: while sending is not enabled on this server, one line says so, and the switch, the sender and the test e-mail are all still offered', async ({ page }) => {
    const read = (await (await page.request.get('/api/v1/settings')).json()) as { emailEnabled: boolean };
    const { card: root, alerts, test: testButton } = await openSettings(page);
    const line = root.getByText('Sending is not enabled on this server yet. Accucut IT turns it on. You can still save these settings and send a test e-mail.');
    if (read.emailEnabled) await expect(line).toHaveCount(0);
    else await expect(line).toBeVisible();
    await expect(alerts).toBeEnabled();
    await expect(testButton).toBeEnabled();
  });

  test('AC-9: keyboard only: the switch is toggled with Space and announces ON in words, the fields are reached with Tab, and Enter saves into a polite live region', async ({ page }) => {
    const sent = await stubSave(page, (body) => ({ status: 200, contentType: 'application/json', json: { ...(body as object), emailEnabled: true } }));
    const { alerts, name, address, live } = await openSettings(page);

    await alerts.focus();
    await expect(alerts).toBeFocused();
    await page.keyboard.press('Space');
    await expect(alerts).toHaveAttribute('aria-checked', 'true');
    // The state is in the accessible name, in words.
    await expect(page.getByRole('switch', { name: 'E-mail alerts: ON' })).toBeVisible();
    await expect(page.getByText('When ON, Engineers are e-mailed when a task is assigned and when it becomes overdue, with a daily digest at 11:00 IST.')).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(name).toBeFocused();
    await name.fill(NAME);
    await page.keyboard.press('Tab');
    await expect(address).toBeFocused();
    await address.fill('portal@example.com');
    await page.keyboard.press('Enter');

    await expect(live).toContainText('Settings saved');
    expect(sent).toEqual([{ alertsEnabled: true, senderName: NAME, senderAddress: 'portal@example.com' }]);
    await expect(page.getByRole('status').filter({ hasText: 'Settings saved' })).toBeVisible();
  });

  test('AC-3: ON with no address is refused on the page with a message under the field, focus goes there, nothing is sent, and what was typed is kept', async ({ page }) => {
    const sent = await stubSave(page, (body) => ({ status: 200, contentType: 'application/json', json: { ...(body as object), emailEnabled: true } }));
    const { alerts, name, address, save } = await openSettings(page);
    await alerts.click();
    await name.fill('Typed name');
    await address.fill('');
    await save.click();
    await expect(address).toBeFocused();
    await expect(address).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Enter a sender e-mail address before you turn e-mail alerts ON.')).toBeVisible();
    await expect(name).toHaveValue('Typed name');
    expect(sent).toEqual([]);
    // Typing removes the message of that field.
    await address.fill('portal@example.com');
    await expect(page.getByText('Enter a sender e-mail address before you turn e-mail alerts ON.')).toHaveCount(0);
  });

  test("AC-3: the server's 422, one message per field, is put under the fields it names", async ({ page }) => {
    await page.route(SETTINGS_API, (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 422,
            contentType: 'application/problem+json',
            body: JSON.stringify({
              type: 'about:blank',
              title: 'Check the fields.',
              status: 422,
              code: 'VALIDATION_FAILED',
              requestId: 'req-00000000',
              errors: [
                { field: 'senderName', message: 'Enter a sender name.' },
                { field: 'senderAddress', message: 'Enter a valid e-mail address, for example portal@example.com.' },
              ],
            }),
          })
        : route.continue(),
    );
    const { name, address, save } = await openSettings(page);
    await name.fill('Valid on the page');
    await address.fill('valid@example.com');
    await save.click();
    await expect(page.getByText('Enter a sender name.')).toBeVisible();
    await expect(page.getByText('Enter a valid e-mail address, for example portal@example.com.')).toBeVisible();
    await expect(name).toBeFocused();
  });

  test('AC-3: a save that fails shows "Settings were not saved" and keeps what was typed', async ({ page }) => {
    await stubSave(page, () => problem(500, 'INTERNAL'));
    const { name, address, save, live } = await openSettings(page);
    await name.fill('Typed name');
    await address.fill('typed@example.com');
    await save.click();
    await expect(live).toContainText('Settings were not saved');
    await expect(live).toContainText('Nothing was changed. Try again.');
    await expect(name).toHaveValue('Typed name');
    await expect(address).toHaveValue('typed@example.com');
  });

  test('AC-4: Send test e-mail posts no body, and the page says "Test sent" with the address the server answered', async ({ page }) => {
    const posts: Array<{ readonly body: string | null }> = [];
    await page.route(TEST_API, (route) => {
      posts.push({ body: route.request().postData() });
      return route.fulfill({ status: 200, contentType: 'application/json', json: { sentTo: 'admin.own@example.com' } });
    });
    const { test: testButton, live } = await openSettings(page);
    await testButton.click();
    await expect(live).toContainText('Test e-mail sent to admin.own@example.com. Check the inbox. It can take a minute.');
    expect(posts).toEqual([{ body: null }]);
  });

  test('AC-5: "Sender not allowed": the SCR-15 words, the sender stays editable, and what was typed is kept', async ({ page }) => {
    await page.route(TEST_API, (route) => route.fulfill(problem(502, 'SENDER_NOT_ALLOWED')));
    const { address, test: testButton, live } = await openSettings(page);
    await address.fill('portal@example.com');
    await testButton.click();
    await expect(live).toContainText('Sender not allowed');
    await expect(live).toContainText(SENDER_NOT_ALLOWED_TEXT);
    await expect(address).toBeEnabled();
    await expect(address).toHaveValue('portal@example.com');
    await address.fill('other@example.com');
    await expect(address).toHaveValue('other@example.com');
  });

  test.describe('every other failure is "Test failed"', () => {
    for (const code of ['AUTH_FAILED', 'CONNECTION', 'UNKNOWN']) {
      test(`AC-5: ${code}`, async ({ page }) => {
        await page.route(TEST_API, (route) => route.fulfill(problem(502, code)));
        const { name, test: testButton, live } = await openSettings(page);
        await name.fill('Kept name');
        await testButton.click();
        await expect(live).toContainText('Test failed');
        await expect(live).toContainText(TEST_FAILED_TEXT);
        await expect(name).toHaveValue('Kept name');
        // No code, host or secret is shown.
        await expect(live).not.toContainText(code);
      });
    }
  });

  test('AC-9: no sideways scroll at this width, and axe finds 0 violations with the card, a refusal and a result on the page', async ({ page }) => {
    await page.route(TEST_API, (route) => route.fulfill({ status: 200, contentType: 'application/json', json: { sentTo: 'admin.own@example.com' } }));
    const { alerts, address, test: testButton, save, live } = await openSettings(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    await alerts.click();
    await address.fill('');
    await save.click();
    await expect(address).toHaveAttribute('aria-invalid', 'true');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    await testButton.click();
    await expect(live).toContainText('Test e-mail sent to admin.own@example.com');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-4: the address the page names is the Admin\'s own', async ({ page }) => {
    const { card: root } = await openSettings(page);
    const hint = await root.getByText(/^The test e-mail goes to your own address, /).innerText();
    const address = /your own address, (.+)\. It is sent/.exec(hint)?.[1] ?? '';
    expect(address).toMatch(OWN_ADDRESS_PATTERN);
    const me = (await (await page.request.get('/api/v1/me')).json()) as { email?: string };
    expect(address).toBe(me.email);
  });
});

test.describe('the Lead', () => {
  test.use({ storageState: SIGNED_IN_STATE });

  test('AC-6: GET, PUT and POST test-email are refused with the fixed 403 and the page with "no access"', async ({ page }) => {
    expect((await page.request.get('/api/v1/settings')).status()).toBe(403);
    const headers = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
    expect((await page.request.put('/api/v1/settings', { headers, data: { alertsEnabled: false, senderName: NAME, senderAddress: '' } })).status()).toBe(403);
    expect((await page.request.post('/api/v1/settings/test-email', { headers, data: { to: 'someone.else@example.com' } })).status()).toBe(403);
    const response = await page.goto('/settings');
    expect(response?.status()).toBe(403);
    await expect(page.getByRole('switch')).toHaveCount(0);
  });
});
