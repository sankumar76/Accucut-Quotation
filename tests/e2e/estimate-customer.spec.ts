import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { shortNameOf } from '../support/customer-short-name';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { defined } from '../support/defined';

import { createDisposableUser, E2E_PASSWORD, E2E_SECOND_CUSTOMER, ensureCanaryCustomers, ensureE2eSecondCustomer, setCanaryCustomer, signInWithoutThePage, useFreshAddress } from './support/auth';
import { signInAsLead } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * CR-01 item 6 (AQP-390 AC-7 to AC-13; the old STORY-05.01 T7 rewritten): the customer of an estimate on SCR-05 for an Engineer (read-only: no picker, no notice, no change action, a 403 from the API) and on SCR-06 for a
 * Lead (the Change customer action, its dialog and its states), at 360x800, 768x1024 and 1366x768 on the development server. Each test signs in as a person of its own, who owns a task with an empty draft
 * estimate (the recipe of the confidentiality scan, `tests/support/estimate-recipe.ts`), whose customer is set in the database as a task is assigned with one; the Lead is a person of the test's own too. The words
 * are the UX spec's and the story's, written out here and not imported, so a changed sentence fails a test. What the database holds (the revision, the row lock, the audit entry) is judged in
 * `tests/integration/estimates/customer.test.ts`. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const ALPHA = defined(CUSTOMER_CANARIES[0]).name;
const ALPHA_ID = defined(CUSTOMER_CANARIES[0]).id;
const ALPHA_SHORT_NAME = shortNameOf(ALPHA);
const SECOND_SHORT_NAME = shortNameOf(E2E_SECOND_CUSTOMER);
const NO_CUSTOMER = 'No customer is set for this estimate. A Lead or an Admin can set one.';
const CHANGE_TEXT = `From ${ALPHA} to ${E2E_SECOND_CUSTOMER}. Nothing entered is lost. The new customer's rates apply at the next Recalculate. The change is logged.`;
const HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };

const changeButton = (page: Page) => page.getByRole('button', { name: 'Change customer' });
const dialogOf = (page: Page) => page.getByRole('alertdialog', { name: 'Change the customer?' });

async function signInAsNewEngineer(page: Page, testInfo: TestInfo): Promise<{ readonly id: string }> {
  await page.context().clearCookies();
  const person = await createDisposableUser('scan', testInfo);
  await signInWithoutThePage(page, person.email, E2E_PASSWORD);
  return person;
}

/** Signs in as a person who owns a task, with the customer set (as the assignment sets it) unless `withCustomer` is false, and opens its workspace. */
async function openOwnWorkspace(page: Page, testInfo: TestInfo, withCustomer = true): Promise<{ readonly code: string; readonly ownerId: string }> {
  await ensureCanaryCustomers();
  const owner = await signInAsNewEngineer(page, testInfo);
  if (withCustomer) await setCanaryCustomer(owner.id, ALPHA_ID);
  const code = canaryTaskCodeFor(owner.id);
  await page.goto(`/estimates/${code}`);
  await expect(page.getByRole('heading', { level: 1, name: code })).toBeVisible();
  return { code, ownerId: owner.id };
}

/** A Lead of the test's own opens SCR-06 of the estimate of an Engineer made for it, whose customer is the first canary customer. Waits until the Change customer action is live. */
async function openAsLead(page: Page, testInfo: TestInfo): Promise<{ readonly code: string; readonly ownerId: string }> {
  await ensureCanaryCustomers();
  await ensureE2eSecondCustomer();
  const owner = await createDisposableUser('scan', testInfo);
  await setCanaryCustomer(owner.id, ALPHA_ID);
  await signInAsLead(page, testInfo);
  const code = canaryTaskCodeFor(owner.id);
  await page.goto(`/estimates/${code}`);
  await expect(page.getByRole('heading', { level: 1, name: code })).toBeVisible();
  await waitUntilHydrated(page, '#review-change-customer', 'onClick');
  return { code, ownerId: owner.id };
}

/** Counts the `PUT` requests to the customer route, so "nothing was sent" is something a test can see. */
function countPuts(page: Page): { readonly count: () => number } {
  let puts = 0;
  page.on('request', (request) => {
    if (request.method() === 'PUT' && /\/api\/v1\/estimates\/[^/]+\/customer$/.test(request.url())) puts += 1;
  });
  return { count: () => puts };
}

test.describe('AC-9, AC-10, AC-11: SCR-05, the Engineer sees the customer and the subject and cannot change them', () => {
  test('AC-9, AC-10: the header shows Customer Name, Customer Short Name and Subject as labelled text; there is no picker, no "Choose the customer" notice and no change action, and the form area is open', async ({ page }, testInfo) => {
    const requested: string[] = [];
    page.on('request', (request) => requested.push(new URL(request.url()).pathname));
    const { code } = await openOwnWorkspace(page, testInfo);

    await expect(page.getByRole('heading', { level: 1, name: code })).toBeVisible();
    const identity = page.getByRole('main').locator('dl').first();
    await expect(identity.locator('dt', { hasText: 'Customer Name' }).locator('xpath=following-sibling::dd[1]')).toContainText(ALPHA);
    await expect(identity.locator('dt', { hasText: 'Customer Short Name' }).locator('xpath=following-sibling::dd[1]')).toHaveText(ALPHA_SHORT_NAME);
    await expect(identity.locator('dt', { hasText: 'Subject (project name)' }).locator('xpath=following-sibling::dd[1]')).toHaveText('Canary subject');

    // The old step is gone: no field, no notice, no control to change it (no button, no select) near the title.
    await expect(page.locator('#estimate-customer')).toHaveCount(0);
    await expect(page.getByText('Choose the customer to start.')).toHaveCount(0);
    await expect(page.getByText('Choose this first')).toHaveCount(0);
    await expect(identity.getByRole('button')).toHaveCount(0);
    await expect(identity.getByRole('combobox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Change customer|Set customer/ })).toHaveCount(0);
    expect(requested).not.toContain('/api/v1/options/customers');
    expect(requested).not.toContain('/api/v1/options/assign-context');

    // The form area is open whatever the customer (entry is not blocked by a missing customer).
    const formArea = page.getByRole('group', { name: 'Parts and inputs' });
    await expect(formArea).not.toHaveAttribute('inert', '');
    await expect(formArea).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('AC-11: an estimate made before this change has no customer: the header says so in one neutral sentence, the form still opens, and nothing is invented', async ({ page }, testInfo) => {
    await openOwnWorkspace(page, testInfo, false);
    await expect(page.getByRole('main').locator('dd', { hasText: NO_CUSTOMER })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Parts and inputs' })).not.toHaveAttribute('inert', '');
    await expect(page.getByRole('button', { name: /Change customer|Set customer/ })).toHaveCount(0);
  });

  test('AC-7: the API refuses the Engineer with 403 for their own estimate, another\'s and one that does not exist, the same answer, and the customer is unchanged', async ({ page }, testInfo) => {
    const { ownerId } = await openOwnWorkspace(page, testInfo);
    const other = await createDisposableUser('scan', testInfo);
    const answers = [];
    for (const id of [ownerId, other.id, '00000000-0000-4000-8000-00000000dead']) {
      const response = await page.request.put(`${DEVELOPMENT_URL}/api/v1/estimates/${id}/customer`, { headers: HEADERS, data: { customerId: ALPHA_ID } });
      expect(response.status()).toBe(403);
      const { requestId, ...rest } = (await response.json()) as Record<string, unknown>;
      expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
      answers.push(rest);
    }
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
    await page.reload();
    await expect(page.getByRole('main').locator('dd', { hasText: ALPHA })).toBeVisible();
  });

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

  test('AC-18: no sideways scroll, axe 0 violations, with and without a customer', async ({ page }, testInfo) => {
    await openOwnWorkspace(page, testInfo);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Copy path' }).focus();
    expect((await page.getByRole('button', { name: 'Copy path' }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
  });
});

test.describe('AC-12, AC-13: SCR-06, a Lead changes the customer', () => {
  test('AC-12: the header shows the customer, its short name and the subject with a "Change customer" action; the dialog names both customers, "Keep <current>" has the focus, and Keep and Escape send nothing', async ({ page }, testInfo) => {
    const puts = countPuts(page);
    await openAsLead(page, testInfo);
    const identity = page.getByRole('main').locator('dl').first();
    await expect(identity).toContainText(ALPHA);
    await expect(identity).toContainText(ALPHA_SHORT_NAME);
    await expect(identity).toContainText('Canary subject');
    // The page with the action, at every width (AC-18; QLT-14: the action once sat where the sticky top bar covered it after a scroll and axe read it as a target too small and too close).
    await expect(changeButton(page)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    await changeButton(page).click();
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: `Keep ${ALPHA}` })).toBeFocused();
    // The new customer is chosen from the customers that are not deleted, each with its short name; the sentence names both only once one is chosen.
    await expect(dialog.getByLabel('New customer')).toBeEnabled();
    const options = await dialog.getByLabel('New customer').locator('option').allTextContents();
    expect(options).toEqual(expect.arrayContaining(['Choose a customer', `${ALPHA} (${ALPHA_SHORT_NAME})`, `${E2E_SECOND_CUSTOMER} (${SECOND_SHORT_NAME})`]));
    await expect(dialog.getByRole('button', { name: 'Change customer' })).toBeDisabled();
    await dialog.getByLabel('New customer').selectOption({ label: `${E2E_SECOND_CUSTOMER} (${SECOND_SHORT_NAME})` });
    await expect(dialog).toContainText(CHANGE_TEXT);
    await expectNoAxeViolations(page);

    // Keep: nothing was sent, the customer is as it was, and focus goes back to the action.
    await dialog.getByRole('button', { name: `Keep ${ALPHA}` }).click();
    await expect(dialog).toHaveCount(0);
    await expect(changeButton(page)).toBeFocused();
    await expect(identity).toContainText(ALPHA);
    expect(puts.count()).toBe(0);

    // Escape does the same.
    await changeButton(page).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(puts.count()).toBe(0);
  });

  test('AC-12, AC-13: "Change customer" saves it, by keyboard; the page shows the new customer and short name, and the change survives a reload', async ({ page }, testInfo) => {
    const puts = countPuts(page);
    await openAsLead(page, testInfo);
    await changeButton(page).click();
    const dialog = dialogOf(page);
    await expect(dialog.getByLabel('New customer')).toBeEnabled();
    await dialog.getByLabel('New customer').selectOption({ label: `${E2E_SECOND_CUSTOMER} (${SECOND_SHORT_NAME})` });
    await dialog.getByRole('button', { name: 'Change customer' }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    const identity = page.getByRole('main').locator('dl').first();
    await expect(identity).toContainText(E2E_SECOND_CUSTOMER);
    await expect(identity).toContainText(SECOND_SHORT_NAME);
    expect(puts.count()).toBe(1);
    await page.reload();
    await expect(page.getByRole('main').locator('dl').first()).toContainText(E2E_SECOND_CUSTOMER);
  });

  test('AC-12: a refusal of the server keeps the dialog open and says why under the field; a failure says it was not changed', async ({ page }, testInfo) => {
    await openAsLead(page, testInfo);
    await page.route('**/api/v1/estimates/*/customer', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/problem+json',
        body: JSON.stringify({ type: 'about:blank', title: 'Check the highlighted fields.', status: 422, code: 'VALIDATION_FAILED', requestId: 'req-00000000', errors: [{ field: 'customerId', message: 'Choose a customer from the list.' }] }),
      }),
    );
    await changeButton(page).click();
    const dialog = dialogOf(page);
    await expect(dialog.getByLabel('New customer')).toBeEnabled();
    await dialog.getByLabel('New customer').selectOption({ label: `${E2E_SECOND_CUSTOMER} (${SECOND_SHORT_NAME})` });
    await dialog.getByRole('button', { name: 'Change customer' }).click();
    await expect(dialog.getByText('Choose a customer from the list.')).toBeVisible();
    await expect(dialog.getByLabel('New customer')).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog).toBeVisible();

    await page.unroute('**/api/v1/estimates/*/customer');
    await page.route('**/api/v1/estimates/*/customer', (route) => route.fulfill({ status: 503, contentType: 'application/problem+json', body: '{}' }));
    await dialog.getByRole('button', { name: 'Change customer' }).click();
    await expect(dialog.getByText('The customer was not changed')).toBeVisible();
  });

  test('AC-18: the dialog fits a phone: its buttons are 44 px high and the page does not scroll sideways, with the action on the page 44 px high too', async ({ page }, testInfo) => {
    await openAsLead(page, testInfo);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect((await changeButton(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    await changeButton(page).click();
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('New customer')).toBeEnabled();
    await dialog.getByLabel('New customer').selectOption({ label: `${E2E_SECOND_CUSTOMER} (${SECOND_SHORT_NAME})` });
    for (const name of [`Keep ${ALPHA}`, 'Change customer']) {
      expect((await dialog.getByRole('button', { name }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
