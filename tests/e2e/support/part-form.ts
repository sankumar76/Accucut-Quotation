import { expect, type Locator, type Page, type Request, type TestInfo } from '@playwright/test';

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
/** The registry's ID of the field of a column letter: what the control's ID is made from and what a save carries as the key of its value. */
export const fieldIdOf = (letter: string): string => seedId(FIELD_ID_NAMESPACE, columnLetterToIndex(letter));
export const control = (page: Page, letter: string): Locator => page.locator(`#part-field-${fieldIdOf(letter)}`);
export const partForm = (page: Page): Locator => page.locator('form[data-part-form]');
/** The parts tree: a `nav` of nested lists of row links since CR-01 item 3B (not `role="tree"`); a row is its link. */
export const tree = (page: Page): Locator => page.getByRole('navigation', { name: 'Parts tree' });
export const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1_000) <= PHONE_MAX;
export const isPatchOfInputs = (url: string, method: string): boolean => method === 'PATCH' && /\/api\/v1\/estimates\/[^/]+\/nodes\/[^/]+\/inputs$/.test(new URL(url).pathname);

/** Does the body of this save carry a value for the field? A save is `{ revision, values: { [fieldId]: value } }`; anything else is not a save of that field. */
function carriesField(request: Request, fieldId: string): boolean {
  let body: unknown;
  try {
    body = request.postDataJSON();
  } catch {
    return false;
  }
  if (typeof body !== 'object' || body === null || !('values' in body)) return false;
  const { values } = body;
  return typeof values === 'object' && values !== null && Object.hasOwn(values, fieldId);
}

/**
 * Waits for the save of the field of a column letter, and answers its status. It is the save that carries that field and no other: the page also sends a repeat of a field that was left but not
 * changed (DEF-038, AQP-341), and a wait for "the next save" ended on it, before the save the test meant had been sent.
 */
export function nextSave(page: Page, letter: string): Promise<number> {
  const fieldId = fieldIdOf(letter);
  return page
    .waitForResponse((response) => isPatchOfInputs(response.url(), response.request().method()) && carriesField(response.request(), fieldId))
    .then((response) => response.status());
}

/**
 * Has the page finished with what it was sent? The browser's answer reaching Playwright is not the page having handled it: the page reads the body and then moves its state on (what it holds as stored, the
 * revision it sends next), and a choice made in between is compared with the old state. A flag chosen and left again at once is then taken for "no change" and never sent (AQP-1 issue 513). The page already
 * says when it has finished: its warning on a closed tab (STORY-05.08 AC-4, `leave-guard.ts`) is cancelled while a save is in flight or a field shows a value the server does not hold. A synthetic
 * event opens no prompt, so this asks the question the leave guard answers, and nothing else.
 */
export const hasUnsavedWork = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });

/** Waits until no save is in flight and nothing is unsaved: the next action then meets the state the server's answer left. */
export async function expectNothingUnsaved(page: Page): Promise<void> {
  await expect.poll(() => hasUnsavedWork(page), { message: 'the page still holds a save in flight or a value that is not saved' }).toBe(false);
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

/**
 * Brings the toolbar of a parts-tree row into view and waits until it is (AQP-486, DEF-129; the rule is AQP-448: a mouse shows the toolbar of the hovered row, a finger the open row's). The toolbar is clipped to 1 px
 * while it is not in view, at the foot of its own row and over the next one, so a press aimed at a button before the toolbar is in view lands on the next row, and a scroll that Playwright does for an action moves
 * the row from under the pointer and takes the toolbar away again. So: the row is scrolled to the middle of the screen, clear of the fixed bar at the foot, the pointer is put on it, and the height of the toolbar's
 * group is waited for (a state, not a time). The press that follows needs no scroll. On a touch screen the hover changes nothing and the row must be the open one, which a test makes it by choosing it first.
 * `row` is the row's link.
 */
export async function revealRowToolbar(row: Locator): Promise<void> {
  await row.evaluate((link) => link.scrollIntoView({ block: 'center' }));
  await row.hover();
  const group = row.locator('xpath=ancestor::li[@data-part-row][1]').locator('[data-row-actions]').first();
  await expect.poll(async () => (await group.boundingBox())?.height ?? 0, 'the toolbar of the row is in view').toBeGreaterThan(1);
}
