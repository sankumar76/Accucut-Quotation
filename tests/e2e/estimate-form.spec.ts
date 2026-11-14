import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { defined } from '../support/defined';
import { MATERIAL_CANARIES } from '../support/material-master-canary';
import { FIELD_ID_NAMESPACE, seedId } from '../../prisma/seed/config/seed-sections-and-stages';
import { columnLetterToIndex } from '../../src/lib/columns';

import { createDisposableUser, E2E_PASSWORD, ensureCanaryCustomers, ensureCanaryMaterials, expectOnQueue, signInThroughThePage, useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';

/**
 * STORY-05.03 T8 (AC-1 to AC-6, AC-8, AC-9; review SQR-11): the part form of SCR-05 for an Engineer, at 360x800, 768x1024 and 1366x768 on the development server. Each test
 * signs in as a person of its own, who owns a task with an empty draft estimate and one part (the recipe of the confidentiality scan, `tests/support/estimate-recipe.ts`),
 * chooses the customer so the form opens, and types into the part with the keyboard. The words are the UX spec's and the story's, written out here and not imported, so a changed
 * sentence fails a test; the field IDs are the seed registry's, which the server's form is built from. What the database holds (the revisions, the transaction, the lock) is judged in
 * `tests/integration/estimates/form.test.ts`. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const ALPHA_CUSTOMER = defined(CUSTOMER_CANARIES[0]).name;
const ALPHA_MATERIAL = defined(MATERIAL_CANARIES[0]);
const PHONE_MAX = 767;
const NUMBER_RULE = 'Enter 0 or more, with up to 2 decimals.';
const QTY_HINT = 'Enter the count for the whole order, not per assembly. For example, 24 lids in all, even if each pipe has 4.';

/** The control of a field: its ID is the registry's, and the page's control ID is made from it. */
const control = (page: Page, letter: string): Locator => page.locator(`#part-field-${seedId(FIELD_ID_NAMESPACE, columnLetterToIndex(letter))}`);
const partForm = (page: Page): Locator => page.locator('form[data-part-form]');
const tree = (page: Page): Locator => page.getByRole('tree', { name: 'Parts tree' });
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1_000) <= PHONE_MAX;
const isPatchOfInputs = (url: string, method: string): boolean => method === 'PATCH' && /\/api\/v1\/estimates\/[^/]+\/nodes\/[^/]+\/inputs$/.test(new URL(url).pathname);

/** Waits for the save that leaving a field starts, and answers its status. */
function nextSave(page: Page): Promise<number> {
  return page.waitForResponse((response) => isPatchOfInputs(response.url(), response.request().method())).then((response) => response.status());
}

async function signInAsNewEngineer(page: Page, testInfo: TestInfo): Promise<{ readonly id: string }> {
  await page.context().clearCookies();
  const person = await createDisposableUser('scan', testInfo);
  await page.goto('/sign-in');
  await signInThroughThePage(page, person.email, E2E_PASSWORD);
  await expectOnQueue(page, 'My tasks');
  return person;
}

/** Signs in as a person who owns a task, chooses the customer, and waits for the form of the first part. On a phone the tree is in a drawer that stays shut. */
async function openForm(page: Page, testInfo: TestInfo): Promise<void> {
  await ensureCanaryCustomers();
  await ensureCanaryMaterials();
  const owner = await signInAsNewEngineer(page, testInfo);
  await page.goto(`/estimates/${canaryTaskCodeFor(owner.id)}`);
  await waitUntilHydrated(page, '#estimate-customer', 'onChange');
  await expect(page.locator('#estimate-customer')).toBeEnabled();
  await page.locator('#estimate-customer').selectOption({ label: ALPHA_CUSTOMER });
  await expect(page.getByText('Customer saved.')).toBeVisible();
  await waitForForm(page);
}

async function waitForForm(page: Page): Promise<void> {
  await expect(partForm(page)).toBeVisible();
  await expect(control(page, 'J')).toBeEnabled();
  // The materials come with the form: the list is enabled once they are here.
  await expect(control(page, 'E')).toBeEnabled();
}

async function showTree(page: Page): Promise<void> {
  if (isPhone(page)) await page.getByRole('button', { name: /^Parts tree/ }).click();
  await expect(tree(page)).toBeVisible();
}

test.describe('AC-1, AC-2, AC-3, AC-8: what the form shows', () => {
  test('AC-1: sections 01 and 02 with their numbers, names and column ranges, and an Excel letter on every field that a screen reader reads first', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const first = page.getByRole('region', { name: '01 Part Details' });
    const second = page.getByRole('region', { name: '02 Material and Dimensions' });
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    await expect(first).toContainText('A, B, D, H');
    await expect(second).toContainText('E, F, J–L, N');

    for (const [letter, name, role] of [
      ['A', 'Sl. No', 'textbox'],
      ['B', 'Part No.', 'textbox'],
      ['D', 'Description', 'textbox'],
      ['H', 'QTY per Assy', 'textbox'],
      ['E', 'Material in Drawing', 'combobox'],
      ['F', 'Material Considered', 'textbox'],
      ['J', 'Length', 'textbox'],
      ['K', 'Width', 'textbox'],
      ['L', 'Thickness', 'textbox'],
      ['N', 'Part Weight', 'textbox'],
    ] as const) {
      // "Excel column J" comes first in the accessible name, then the label.
      await expect(page.getByRole(role, { name: new RegExp(`^Excel column ${letter}\\s+${name.replaceAll('.', '\\.')}`) })).toHaveCount(1);
      await expect(control(page, letter)).toBeVisible();
    }
    // Letters the story does not build are not on the form.
    for (const letter of ['C', 'G', 'I', 'P']) await expect(page.getByRole('textbox', { name: new RegExp(`^Excel column ${letter}\\s`) })).toHaveCount(0);
  });

  test('AC-2, AC-3, AC-8: the label stays "QTY per Assy" with the hint; Sl. No. and Material Considered are read-only; no rate, price, cost or formula is on the form', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await expect(control(page, 'H')).toHaveAccessibleDescription(QTY_HINT);
    await expect(partForm(page).getByText(QTY_HINT)).toBeVisible();
    await expect(control(page, 'A')).toHaveAttribute('readonly', '');
    await expect(control(page, 'A')).toHaveValue('1');
    await expect(control(page, 'F')).toHaveAttribute('readonly', '');
    await expect(control(page, 'F')).toHaveValue('');
    await expect(partForm(page)).not.toContainText(/rate|price|cost|formula/i);
    expect(await page.content()).not.toMatch(/Material Rate|Rate \/ Kg/);
  });

  test('AC-1: the cards sit one above the other on a phone and side by side from a tablet', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const first = defined(await page.getByRole('region', { name: '01 Part Details' }).boundingBox());
    const second = defined(await page.getByRole('region', { name: '02 Material and Dimensions' }).boundingBox());
    // What the layout is, so a failure says why: the width of the form and the columns the grid made.
    const layout = await partForm(page).evaluate((form) => ({
      formWidth: form.getBoundingClientRect().width,
      columns: getComputedStyle(form.querySelector('[data-part-grid]') ?? form).gridTemplateColumns,
      viewport: window.innerWidth,
    }));
    const why = `layout ${JSON.stringify(layout)}, first ${JSON.stringify(first)}, second ${JSON.stringify(second)}`;
    if (isPhone(page)) {
      expect(second.y, why).toBeGreaterThanOrEqual(first.y + first.height);
      expect(Math.abs(second.x - first.x), why).toBeLessThan(2);
    } else {
      expect(Math.abs(second.y - first.y), why).toBeLessThan(2);
      expect(second.x, why).toBeGreaterThan(first.x + first.width - 2);
    }
  });
});

test.describe('AC-4, AC-5, AC-7: typing, refusing and saving', () => {
  test('AC-4: -1, 1.234 and abc are refused under the field with the words of the rule and the typed text is kept; 12.5 is saved as 12.50 and survives a reload; a blank is saved too', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const length = control(page, 'J');
    for (const typed of ['-1', '1.234', 'abc']) {
      await length.fill(typed);
      await length.blur();
      await expect(partForm(page).getByText(NUMBER_RULE)).toBeVisible();
      await expect(length).toHaveValue(typed);
      await expect(length).toHaveAttribute('aria-invalid', 'true');
    }

    const saved = nextSave(page);
    await length.fill('12.5');
    await length.blur();
    expect(await saved).toBe(200);
    await expect(length).toHaveValue('12.50');
    await expect(partForm(page).getByText(NUMBER_RULE)).toHaveCount(0);
    await expect(length).not.toHaveAttribute('aria-invalid', 'true');
    await expect(partForm(page).getByText(/^Last saved /)).toBeVisible();

    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('12.50');

    const cleared = nextSave(page);
    await control(page, 'J').fill('');
    await control(page, 'J').blur();
    expect(await cleared).toBe(200);
    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('');
  });

  test('AC-4, AC-7: text is saved by leaving the field and a value equal after normalisation sends nothing', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const saved = nextSave(page);
    await control(page, 'B').fill('  FR-1  ');
    await control(page, 'B').blur();
    expect(await saved).toBe(200);
    await expect(control(page, 'B')).toHaveValue('FR-1');

    const savedWidth = nextSave(page);
    await control(page, 'K').fill('1.5');
    await control(page, 'K').blur();
    expect(await savedWidth).toBe(200);
    await expect(control(page, 'K')).toHaveValue('1.50');
    await expect(partForm(page).getByText(/^Last saved /)).toBeVisible();
    const requests: string[] = [];
    page.on('request', (request) => {
      if (isPatchOfInputs(request.url(), request.method())) requests.push(request.url());
    });
    // The same number again, spelled another way, is no change: nothing is sent.
    await control(page, 'K').fill('1.50');
    await control(page, 'K').blur();
    await control(page, 'K').fill('01.5');
    await control(page, 'K').blur();
    await expect(control(page, 'K')).toHaveValue('1.50');
    expect(requests).toEqual([]);
  });

  test('AC-5, AC-3: the material list has the canary material by name; choosing it fills Material Considered, saves, and survives a reload; no price is on the page', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const select = control(page, 'E');
    await expect(select.locator('option', { hasText: ALPHA_MATERIAL.materialInDrawing })).toHaveCount(1);
    const saved = nextSave(page);
    await select.selectOption({ label: ALPHA_MATERIAL.materialInDrawing });
    expect(await saved).toBe(200);
    await expect(control(page, 'F')).toHaveValue(ALPHA_MATERIAL.materialConsidered);

    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'E').locator('option:checked')).toHaveText(ALPHA_MATERIAL.materialInDrawing);
    await expect(control(page, 'F')).toHaveValue(ALPHA_MATERIAL.materialConsidered);
    const content = await page.content();
    for (const number of [ALPHA_MATERIAL.pricePerKg, ALPHA_MATERIAL.specificGravity, ALPHA_MATERIAL.scrapRate]) expect(content).not.toContain(number);
  });

  test('SQR-01 (b): typing into a part moves the part\'s revision, and the tree follows: the part can still be deleted at once, with no "changed by someone else" notice', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const saved = nextSave(page);
    await control(page, 'L').fill('3');
    await control(page, 'L').blur();
    expect(await saved).toBe(200);
    await expect(control(page, 'L')).toHaveValue('3.00');

    await showTree(page);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete part 1?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete part' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Part deleted')).toHaveCount(1);
    await expect(page.getByText('The parts were changed by someone else.')).toHaveCount(0);
  });
});

test.describe('AC-6: Enter moves to the next field', () => {
  test('AC-6: Enter goes through Part No., Description, QTY per Assy, Material in Drawing, Length, Width, Thickness and Part Weight, skips the read-only fields, and never submits; on the last field it leaves the field', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const address = page.url();
    await control(page, 'B').focus();
    await control(page, 'B').fill('FR-1');
    for (const next of ['D', 'H', 'E', 'J', 'K', 'L', 'N']) {
      await page.keyboard.press('Enter');
      await expect(control(page, next), `Enter should reach ${next}`).toBeFocused();
    }
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Part 1', exact: true })).toBeFocused();
    expect(page.url()).toBe(address);
    // The form was not submitted: the typed text is still there, saved by leaving its field.
    await expect(control(page, 'B')).toHaveValue('FR-1');
  });

  test('SQR-11: Enter on a part in the tree opens its form: the first field takes the focus', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await showTree(page);
    await tree(page).getByRole('treeitem').first().focus();
    await page.keyboard.press('Enter');
    await expect(control(page, 'B')).toBeFocused();
    // On a phone the drawer has closed.
    if (isPhone(page)) await expect(page.getByRole('dialog', { name: 'Parts tree' })).toHaveCount(0);
  });
});

test.describe('AC-9: the screen', () => {
  test('AC-9: no sideways scroll, axe finds nothing (with an error showing and with a value saved), every control is 44 px high and every label is visible', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    for (const letter of ['A', 'B', 'D', 'H', 'E', 'F', 'J', 'K', 'L', 'N']) {
      expect((await control(page, letter).boundingBox())?.height ?? 0, letter).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    for (const label of ['Sl. No', 'Part No.', 'Description', 'QTY per Assy', 'Material in Drawing', 'Material Considered', 'Length', 'Width', 'Thickness', 'Part Weight']) {
      await expect(partForm(page).locator('label', { hasText: label }).first(), label).toBeVisible();
    }

    await control(page, 'J').fill('-1');
    await control(page, 'J').blur();
    await expect(partForm(page).getByText(NUMBER_RULE)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    const saved = nextSave(page);
    await control(page, 'J').fill('7');
    await control(page, 'J').blur();
    expect(await saved).toBe(200);
    await expect(control(page, 'J')).toHaveValue('7.00');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});
