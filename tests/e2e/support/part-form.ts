import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../../support/customer-canary';
import { canaryTaskCodeFor } from '../../support/estimate-recipe';
import { defined } from '../../support/defined';
import { MATERIAL_CANARIES } from '../../support/material-master-canary';
import { FIELD_ID_NAMESPACE, seedId } from '../../../prisma/seed/config/seed-sections-and-stages';
import { columnLetterToIndex } from '../../../src/lib/columns';

import { createDisposableUser, E2E_PASSWORD, ensureCanaryCustomers, ensureCanaryMaterials, setCanaryCustomer, signInWithoutThePage, type E2eUser } from './auth';
import { expectNoAxeViolations, widthOf } from './design-system';

/**
 * What the part-form specs (`estimate-form.spec.ts`, STORY-05.03, and `estimate-form-sections.spec.ts`, STORY-05.04) share: a person of the test's own who owns a task with an empty draft
 * estimate and one part (the recipe of the confidentiality scan, `tests/support/estimate-recipe.ts`), the customer chosen so the form opens, and the locators of the form. The field IDs
 * are the seed registry's, which the server's form is built from. This file has no tests and its name does not end in `.spec.ts`.
 */

export const ALPHA_CUSTOMER = defined(CUSTOMER_CANARIES[0]).name;
const ALPHA_CUSTOMER_ID = defined(CUSTOMER_CANARIES[0]).id;
export const ALPHA_MATERIAL = defined(MATERIAL_CANARIES[0]);
export const PHONE_MAX = 767;
export const NUMBER_RULE = 'Enter 0 or more, with up to 2 decimals.';

/** The control of a field: its ID is the registry's, and the page's control ID is made from it. */
export const control = (page: Page, letter: string): Locator => page.locator(`#part-field-${seedId(FIELD_ID_NAMESPACE, columnLetterToIndex(letter))}`);
export const partForm = (page: Page): Locator => page.locator('form[data-part-form]');
/** The parts tree: a `nav` of nested lists of row links since CR-01 item 3B (not `role="tree"`); a row is its link. */
export const tree = (page: Page): Locator => page.getByRole('navigation', { name: 'Parts tree' });
export const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1_000) <= PHONE_MAX;
export const isPatchOfInputs = (url: string, method: string): boolean => method === 'PATCH' && /\/api\/v1\/estimates\/[^/]+\/nodes\/[^/]+\/inputs$/.test(new URL(url).pathname);

/** Waits for the save that leaving a field starts, and answers its status. */
export function nextSave(page: Page): Promise<number> {
  return page.waitForResponse((response) => isPatchOfInputs(response.url(), response.request().method())).then((response) => response.status());
}

/**
 * A new Engineer who owns a task, signed in without the sign-in screen and the queue (`signInWithoutThePage`): the part-form specs start from the workspace, and the two page loads before it
 * were a quarter of a journey test's 30 s on a loaded runner (AQP-340). The caller goes to the workspace next, as every caller does.
 */
export async function signInAsNewEngineer(page: Page, testInfo: TestInfo): Promise<E2eUser & { readonly id: string }> {
  await page.context().clearCookies();
  const person = await createDisposableUser('scan', testInfo);
  await signInWithoutThePage(page, person.email, E2E_PASSWORD);
  return person;
}

/**
 * The least height of a field of the part form: 36 px from 1024 px with a fine pointer (the compact layout, AQP-388; UX ruling OQ-PM-12), and 44 px below that width and for a finger (NFR-017). The desktop project is
 * the only one with a mouse at 1024 px or wider, so it is the one that reads 36.
 */
export async function leastFieldHeight(page: Page): Promise<number> {
  return (await widthOf(page)) >= 1024 && (await page.evaluate(() => window.matchMedia('(pointer: fine)').matches)) ? 36 : 44;
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
 * `fromTheQueue` is for a test whose subject is the history (Back from the estimate must land on the queue, as it does for a person who signed in on the page): the workspace is then
 * reached from the queue page, the one page load the other tests save.
 */
export async function openForm(page: Page, testInfo: TestInfo, options: { readonly fromTheQueue?: boolean } = {}): Promise<E2eUser & { readonly id: string }> {
  await ensureCanaryCustomers();
  await ensureCanaryMaterials();
  const owner = await signInAsNewEngineer(page, testInfo);
  if (options.fromTheQueue === true) await page.goto('/queue');
  // The customer is set in the database before the page is opened, as a task is assigned with one (CR-01 item 6): the Engineer cannot choose it. Changing it is the Lead's, `estimate-customer.spec.ts`.
  await setCanaryCustomer(owner.id, ALPHA_CUSTOMER_ID);
  await page.goto(`/estimates/${canaryTaskCodeFor(owner.id)}`);
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
