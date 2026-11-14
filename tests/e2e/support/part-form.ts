import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../../support/customer-canary';
import { canaryTaskCodeFor } from '../../support/estimate-recipe';
import { defined } from '../../support/defined';
import { MATERIAL_CANARIES } from '../../support/material-master-canary';
import { FIELD_ID_NAMESPACE, seedId } from '../../../prisma/seed/config/seed-sections-and-stages';
import { columnLetterToIndex } from '../../../src/lib/columns';

import { createDisposableUser, E2E_PASSWORD, ensureCanaryCustomers, ensureCanaryMaterials, expectOnQueue, signInThroughThePage } from './auth';
import { expectNoAxeViolations, waitUntilHydrated } from './design-system';

/**
 * What the part-form specs (`estimate-form.spec.ts`, STORY-05.03, and `estimate-form-sections.spec.ts`, STORY-05.04) share: a person of the test's own who owns a task with an empty draft
 * estimate and one part (the recipe of the confidentiality scan, `tests/support/estimate-recipe.ts`), the customer chosen so the form opens, and the locators of the form. The field IDs
 * are the seed registry's, which the server's form is built from. This file has no tests and its name does not end in `.spec.ts`.
 */

export const ALPHA_CUSTOMER = defined(CUSTOMER_CANARIES[0]).name;
export const ALPHA_MATERIAL = defined(MATERIAL_CANARIES[0]);
export const PHONE_MAX = 767;
export const NUMBER_RULE = 'Enter 0 or more, with up to 2 decimals.';

/** The control of a field: its ID is the registry's, and the page's control ID is made from it. */
export const control = (page: Page, letter: string): Locator => page.locator(`#part-field-${seedId(FIELD_ID_NAMESPACE, columnLetterToIndex(letter))}`);
export const partForm = (page: Page): Locator => page.locator('form[data-part-form]');
export const tree = (page: Page): Locator => page.getByRole('tree', { name: 'Parts tree' });
export const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1_000) <= PHONE_MAX;
export const isPatchOfInputs = (url: string, method: string): boolean => method === 'PATCH' && /\/api\/v1\/estimates\/[^/]+\/nodes\/[^/]+\/inputs$/.test(new URL(url).pathname);

/** Waits for the save that leaving a field starts, and answers its status. */
export function nextSave(page: Page): Promise<number> {
  return page.waitForResponse((response) => isPatchOfInputs(response.url(), response.request().method())).then((response) => response.status());
}

export async function signInAsNewEngineer(page: Page, testInfo: TestInfo): Promise<{ readonly id: string }> {
  await page.context().clearCookies();
  const person = await createDisposableUser('scan', testInfo);
  await page.goto('/sign-in');
  await signInThroughThePage(page, person.email, E2E_PASSWORD);
  await expectOnQueue(page, 'My tasks');
  return person;
}

export async function waitForForm(page: Page): Promise<void> {
  await expect(partForm(page)).toBeVisible();
  await expect(control(page, 'J')).toBeEnabled();
  // The materials come with the form: the list is enabled once they are here.
  await expect(control(page, 'E')).toBeEnabled();
}

/**
 * Signs in as a person who owns a task, chooses the customer, and waits for the form of the first part. On a phone the tree is in a drawer that stays shut. Answers the person: their ID is
 * the ID of their estimate and of its one part too (the recipe of the scan), so a test can read the routes of that estimate.
 */
export async function openForm(page: Page, testInfo: TestInfo): Promise<{ readonly id: string }> {
  await ensureCanaryCustomers();
  await ensureCanaryMaterials();
  const owner = await signInAsNewEngineer(page, testInfo);
  await page.goto(`/estimates/${canaryTaskCodeFor(owner.id)}`);
  await waitUntilHydrated(page, '#estimate-customer', 'onChange');
  await expect(page.locator('#estimate-customer')).toBeEnabled();
  await page.locator('#estimate-customer').selectOption({ label: ALPHA_CUSTOMER });
  await expect(page.getByText('Customer saved.')).toBeVisible();
  await waitForForm(page);
  return owner;
}

/**
 * The axe scan of a form page, taken from the top of the page. Axe's target-size rule judges an element by what overlaps it in the layout as it is at that moment, and a page that has
 * been scrolled by typing into a field far down the form can have the customer field half behind the sticky top bar (whose menu, bell and account buttons then overlap it): a state
 * of the scroll and not of the page. From the top the sticky bars cover nothing, which is the page's own layout.
 */
export async function expectFormAccessible(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectNoAxeViolations(page);
}

export async function showTree(page: Page): Promise<void> {
  if (isPhone(page)) await page.getByRole('button', { name: /^Parts tree/ }).click();
  await expect(tree(page)).toBeVisible();
}
