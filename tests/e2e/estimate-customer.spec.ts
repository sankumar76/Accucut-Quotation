import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES, CUSTOMER_RECIPE_ID } from '../support/customer-canary';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { defined } from '../support/defined';

import { createDisposableUser, E2E_PASSWORD, E2E_SECOND_CUSTOMER, ensureCanaryCustomers, ensureE2eSecondCustomer, expectOnQueue, signInThroughThePage, useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';

/**
 * STORY-05.01 T7 (AC-1 to AC-5, AC-7): SCR-05 "Estimate workspace" for an Engineer, at 360x800, 768x1024 and 1366x768 on the development server. Each test signs in as a
 * person of its own, who owns a task with an empty draft estimate (the recipe of the confidentiality scan, `tests/support/estimate-recipe.ts`), and opens it. The
 * words are the UX spec's and the story's, written out here and not imported, so a changed sentence fails a test. What the database holds (the revision, the
 * row lock) is judged in `tests/integration/estimates/customer.test.ts`. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const ALPHA = defined(CUSTOMER_CANARIES[0]).name;
const NO_CUSTOMER = 'Choose the customer to start.';
const CHANGE_TEXT = `You are changing the customer from ${ALPHA} to ${E2E_SECOND_CUSTOMER}. Nothing you typed is lost. The new customer applies the next time the estimate is calculated.`;

const customerField = (page: Page): Locator => page.locator('#estimate-customer');
const formArea = (page: Page): Locator => page.getByRole('group', { name: 'Parts and inputs' });

async function signInAsNewEngineer(page: Page, testInfo: TestInfo): Promise<{ readonly id: string }> {
  await page.context().clearCookies();
  const person = await createDisposableUser('scan', testInfo);
  await page.goto('/sign-in');
  await signInThroughThePage(page, person.email, E2E_PASSWORD);
  await expectOnQueue(page, 'My tasks');
  return person;
}

/** Signs in as a person who owns a task, opens its workspace and waits until the list of customers has arrived and the field is live. */
async function openOwnWorkspace(page: Page, testInfo: TestInfo): Promise<{ readonly code: string; readonly secondId: string }> {
  await ensureCanaryCustomers();
  const secondId = await ensureE2eSecondCustomer();
  const owner = await signInAsNewEngineer(page, testInfo);
  const code = canaryTaskCodeFor(owner.id);
  await page.goto(`/estimates/${code}`);
  await expect(page.getByRole('heading', { level: 1, name: code })).toBeVisible();
  await waitUntilHydrated(page, '#estimate-customer', 'onChange');
  await expect(customerField(page)).toBeEnabled();
  return { code, secondId };
}

/** Counts the `PUT` requests to the customer route, so "nothing was sent" is something a test can see. */
function countPuts(page: Page): { readonly count: () => number } {
  let puts = 0;
  page.on('request', (request) => {
    if (request.method() === 'PUT' && /\/api\/v1\/estimates\/[^/]+\/customer$/.test(request.url())) puts += 1;
  });
  return { count: () => puts };
}

test.describe('AC-1, AC-2: the workspace with no customer', () => {
  test('AC-1, AC-2: shows the task, the notice and a disabled form area, and the drop-down lists the customers by name from the options route', async ({ page }, testInfo) => {
    const requested: string[] = [];
    page.on('request', (request) => requested.push(new URL(request.url()).pathname));
    const { code } = await openOwnWorkspace(page, testInfo);

    await expect(page.getByRole('heading', { level: 1, name: code })).toBeVisible();
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    await expect(page.getByText('Due 01 Jan 2099, 10:00 IST')).toBeVisible();
    const link = page.getByRole('link', { name: '\\\\invented-server\\invented-share\\RFQ-canary' });
    await expect(link).toHaveAttribute('href', 'file:////invented-server/invented-share/RFQ-canary');
    await expect(page.getByRole('button', { name: 'Copy path' })).toBeVisible();
    await expect(page.getByText('Notes from E2E Lead: Invented notes.')).toBeVisible();

    await expect(page.getByText(NO_CUSTOMER)).toBeVisible();
    await expect(page.getByText('The form opens as soon as you pick one.')).toBeVisible();
    await expect(formArea(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(formArea(page)).toHaveAttribute('inert', '');

    await expect(page.getByText('Choose this first')).toBeVisible();
    await expect(page.getByText('Changing it later asks you to confirm.', { exact: false })).toBeVisible();
    await expect(customerField(page)).toHaveValue('');
    const names = await customerField(page).locator('option').allTextContents();
    expect(names).toEqual(expect.arrayContaining(['Choose the customer', ALPHA, E2E_SECOND_CUSTOMER]));
    expect(requested).toContain('/api/v1/options/customers');
  });
});

test.describe('AC-3, AC-4: choosing and changing the customer', () => {
  test('AC-3: the first choice is saved at once, the notice goes, the form area opens, and the choice survives a reload', async ({ page }, testInfo) => {
    const puts = countPuts(page);
    await openOwnWorkspace(page, testInfo);
    await customerField(page).selectOption({ label: ALPHA });

    await expect(page.getByText('Customer saved.')).toBeVisible();
    await expect(page.getByText(NO_CUSTOMER)).toHaveCount(0);
    await expect(formArea(page)).not.toHaveAttribute('inert', '');
    await expect(formArea(page)).toHaveAttribute('aria-disabled', 'false');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    expect(puts.count()).toBe(1);

    await page.reload();
    await expect(customerField(page)).toHaveValue(CUSTOMER_RECIPE_ID);
    await expect(page.getByText(NO_CUSTOMER)).toHaveCount(0);
  });

  test('AC-4: picking another customer asks first; "Keep" and Escape change nothing and send nothing; "Change customer" saves it, by keyboard', async ({ page }, testInfo) => {
    const puts = countPuts(page);
    const { secondId } = await openOwnWorkspace(page, testInfo);
    await customerField(page).selectOption({ label: ALPHA });
    await expect(page.getByText('Customer saved.')).toBeVisible();
    expect(puts.count()).toBe(1);

    // Choosing the same customer again is a no-op: no dialog, nothing sent.
    await customerField(page).selectOption({ label: ALPHA });
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    expect(puts.count()).toBe(1);

    const dialog = page.getByRole('alertdialog', { name: 'Change the customer?' });
    await customerField(page).selectOption({ label: E2E_SECOND_CUSTOMER });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(CHANGE_TEXT);
    await expect(dialog.getByRole('button', { name: `Keep ${ALPHA}` })).toBeFocused();
    await expectNoAxeViolations(page);

    // Keep: the dialog closes, the field shows the customer it had, focus goes back to the field, nothing was sent.
    await dialog.getByRole('button', { name: `Keep ${ALPHA}` }).click();
    await expect(dialog).toHaveCount(0);
    await expect(customerField(page)).toHaveValue(CUSTOMER_RECIPE_ID);
    await expect(customerField(page)).toBeFocused();
    expect(puts.count()).toBe(1);

    // Escape does the same.
    await customerField(page).selectOption({ label: E2E_SECOND_CUSTOMER });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(customerField(page)).toHaveValue(CUSTOMER_RECIPE_ID);
    expect(puts.count()).toBe(1);

    // Change customer, reached with Tab and pressed with Enter.
    await customerField(page).selectOption({ label: E2E_SECOND_CUSTOMER });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Change customer' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Customer saved.')).toBeVisible();
    await expect(customerField(page)).toHaveValue(secondId);
    expect(puts.count()).toBe(2);
    await page.reload();
    await expect(customerField(page)).toHaveValue(secondId);
  });

  test('AC-5: a refusal of the server keeps what is on screen and says why: a customer that cannot be chosen is shown under the field', async ({ page }, testInfo) => {
    await openOwnWorkspace(page, testInfo);
    await page.route('**/api/v1/estimates/*/customer', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/problem+json',
        body: JSON.stringify({ type: 'about:blank', title: 'Check the highlighted fields.', status: 422, code: 'VALIDATION_FAILED', requestId: 'req-00000000', errors: [{ field: 'customerId', message: 'Choose a customer from the list.' }] }),
      }),
    );
    await customerField(page).selectOption({ label: ALPHA });
    await expect(page.getByText('Choose a customer from the list.')).toBeVisible();
    await expect(customerField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText(NO_CUSTOMER)).toBeVisible();
    await expect(customerField(page)).toHaveValue('');
  });
});

test.describe('AC-5: who may open it', () => {
  test('AC-5: another Engineer gets the same "not found" page as for a code that does not exist, with HTTP 404', async ({ page }, testInfo) => {
    const owner = await createDisposableUser('scan', testInfo);
    await signInAsNewEngineer(page, testInfo);
    const other = await page.goto(`/estimates/${canaryTaskCodeFor(owner.id)}`);
    expect(other?.status()).toBe(404);
    await expect(page.getByText('We could not find that page')).toBeVisible();
    const unknown = await page.goto('/estimates/Q-2026-9999');
    expect(unknown?.status()).toBe(404);
    await expect(page.getByText('We could not find that page')).toBeVisible();
  });
});

test.describe('AC-7: the screen', () => {
  test('AC-7: no sideways scroll, a customer field of 44 px, a visible label, axe 0 violations, with and without a customer', async ({ page }, testInfo) => {
    await openOwnWorkspace(page, testInfo);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    await expect(page.getByLabel('Customer')).toBeVisible();
    expect((await customerField(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);

    await customerField(page).selectOption({ label: ALPHA });
    await expect(page.getByText('Customer saved.')).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Copy path' }).focus();
    expect((await page.getByRole('button', { name: 'Copy path' }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
  });

  test('AC-7: the change dialog fits a phone: its buttons are 44 px high and the page does not scroll sideways', async ({ page }, testInfo) => {
    await openOwnWorkspace(page, testInfo);
    await customerField(page).selectOption({ label: ALPHA });
    await expect(page.getByText('Customer saved.')).toBeVisible();
    await customerField(page).selectOption({ label: E2E_SECOND_CUSTOMER });
    const dialog = page.getByRole('alertdialog', { name: 'Change the customer?' });
    await expect(dialog).toBeVisible();
    for (const name of [`Keep ${ALPHA}`, 'Change customer']) {
      expect((await dialog.getByRole('button', { name }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
