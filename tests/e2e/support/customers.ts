import { randomBytes } from 'node:crypto';

import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

import { waitUntilHydrated } from './design-system';
import { DEVELOPMENT_URL } from './servers';

/**
 * What the Customers specs share (STORY-02.02): the words of SCR-12 written out, the list opened and the customer's page opened, the customers a test makes
 * for itself through the API, and the 503 for a read that fails. Each test works on customers it makes (an invented name with the screen size, the repeat,
 * the retry and a random part), so the three screen sizes and the retries never meet on one customer. No test here waits for a fixed time. The focus
 * recorder, the keyboard press and the 503 are the Treatment / Color specs' (`support/treatments.ts`): they are not about treatments.
 */

/** UX spec SCR-12 and ux-spec v0.22, written out. */
export const TITLE = 'Customers';
export const ADD = 'Add customer';
export const NAME_REQUIRED = 'Enter the customer name.';
export const NAME_TAKEN = 'A customer with this name already exists.';
export const EMAIL_FORMAT = 'Enter an e-mail address like name@company.com.';
export const RATE_DECIMALS = 'Enter a number, 0 or more, with up to 2 decimals.';
export const RATE_WHOLE = 'Enter a whole number, 0 or more.';
export const LOAD_ERROR_TITLE = 'We could not load customers';
export const SAVED_BUT_NOT_SHOWN = 'The change was saved, but we could not show the list. Check your connection and try again.';
export const DIFFERS = 'Differs from default';
export const SAME = 'Same as default';
export const FAILED_WITH_FORM = 'Check your connection and try again. What you typed is still in the form.';
export const API = `${DEVELOPMENT_URL}/api/v1/customers`;
export const JSON_HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };

/** The first seed item (a rate per second) and the first percent item, as the migration inserts them. */
export const FIRST_RATE = { id: '00000000-0000-4000-8000-000400000001', name: 'Cutting-Rate-per-Sec' };
export const PERCENT_RATE = { id: '00000000-0000-4000-8000-000400000013', name: 'OH Profit %' };

/** A customer the test made: its name and ID. */
export interface MadeCustomer {
  readonly name: string;
  readonly id: string;
}

/** The row (table) or card (phone) of a customer: whichever of the two is shown. */
export function rowOf(page: Page, name: string): Locator {
  return page.locator('[data-item-id]:visible').filter({ hasText: name });
}

/** A customer name nobody else has: it carries the screen size, the repeat and the retry, plus a random part. */
export function newCustomerName(testInfo: TestInfo): string {
  return `E2E-customer-${testInfo.project.name}-r${testInfo.repeatEachIndex}-t${testInfo.retry}-${randomBytes(3).toString('hex')}`;
}

/** Makes a customer through the API, the way the screen does (every rate at the current default), and returns its name and ID. */
export async function makeCustomer(page: Page, name: string): Promise<MadeCustomer> {
  const response = await page.request.post(API, { headers: JSON_HEADERS, data: { name } });
  expect(response.status()).toBe(201);
  const body: unknown = await response.json();
  const id = typeof body === 'object' && body !== null && 'id' in body && typeof body.id === 'string' ? body.id : '';
  expect(id).not.toBe('');
  return { name, id };
}

/** Sets rates of a customer through the API (decimal text by Process Master item ID), so a test starts from a customer whose rates differ. */
export async function setRates(page: Page, customer: MadeCustomer, rates: Readonly<Record<string, string>>): Promise<void> {
  const body = { rates: Object.entries(rates).map(([processItemId, value]) => ({ processItemId, value })) };
  const response = await page.request.patch(`${API}/${customer.id}`, { headers: JSON_HEADERS, data: body });
  expect(response.status()).toBe(200);
}

/** The Add customer button of the page header. An empty list shows a second one in its empty state, so the first is meant. */
export const addButton = (page: Page): Locator => page.getByRole('button', { name: ADD }).first();

/** Opens the list, waits for the page to be live, and waits for the Add customer button. */
export async function openCustomers(page: Page): Promise<void> {
  await page.goto('/masters/customers');
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  // The buttons are plain HTML until React has attached their handlers; a press before that is lost (DEF-011).
  await waitUntilHydrated(page, 'main button[data-action="add"]');
  await expect(addButton(page)).toBeVisible();
}

/** Opens a customer's page and waits for its heading and its rates table. */
export async function openCustomer(page: Page, customer: MadeCustomer): Promise<void> {
  await page.goto(`/masters/customers/${customer.id}`);
  await expect(page.getByRole('heading', { level: 1, name: customer.name })).toBeVisible();
  await waitUntilHydrated(page, 'main button[data-action="reset"]');
  await expect(page.getByRole('region', { name: `Rates for ${customer.name}, scrollable` })).toBeVisible();
}

/** The input of one rate on the customer's page: its accessible name holds the rate and the customer. */
export function rateInput(page: Page, customer: MadeCustomer, rate: { readonly name: string }): Locator {
  return page.getByLabel(`${rate.name} for ${customer.name}`, { exact: true });
}

/** The row of one rate in the rates table. */
export function rateRow(page: Page, rate: { readonly id: string }): Locator {
  return page.locator(`tr[data-rate-id="${rate.id}"]`);
}

/** Makes `GET /api/v1/customers` answer 503 from the moment `fail.value` is true, and lets every other call through. */
export async function failListWhen(page: Page, busy: { readonly status: number; readonly contentType: string; readonly body: string }): Promise<{ value: boolean }> {
  const fail = { value: false };
  await page.route('**/api/v1/customers', (route) => (route.request().method() === 'GET' && fail.value ? route.fulfill(busy) : route.continue()));
  return fail;
}

/** The Process Master items the migration seeds: every customer has a rate for at least these. Other specs add and delete items in the same database, so the count is not exactly this. */
export const SEED_RATE_COUNT = 15;

/**
 * Every rate of the customer's page is "Same as default": the table has at least the seeded items, and as many "Same as default" lines as rows, and none
 * says "Differs from default". The exact number is not asserted because the Process specs add and delete items in the same database while this one runs.
 */
export async function expectEveryRateSame(page: Page): Promise<void> {
  const rows = page.locator('tr[data-rate-id]');
  await expect
    .poll(async () => {
      const count = await rows.count();
      return count >= SEED_RATE_COUNT && (await page.getByText(SAME).count()) === count;
    })
    .toBe(true);
  await expect(page.getByText(DIFFERS)).toHaveCount(0);
}
