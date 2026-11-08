import { randomBytes } from 'node:crypto';

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { expectNoAxeViolations, horizontalOverflow, ROW_TARGET, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-02.03 T6 (AC-1, AC-2, AC-3, AC-7, AC-8): SCR-13 "Materials and lists", the Materials tab, at 360x800, 768x1024 and 1366x768 on the
 * development server, signed in as the E2E Admin (the saved browser state of the set-up project). No sideways scroll, axe 0 violations,
 * targets of 44 px (36 px for the icon buttons of a table row), and add and edit working by keyboard: Enter opens the dialog on the first
 * field, Tab moves between the fields, Enter in a field saves, Escape closes, and focus returns to the button that opened it.
 *
 * Each test works on materials it makes for itself through the API (an invented name with the screen size, the repeat, the retry and a
 * random part), so the three screen sizes and the retries never meet on one material. The words are the UX spec's, written out here.
 * Names and numbers are invented (`n.37`, ADR-014).
 *
 * Width: which of these tests may run at one width only is ruled in test strategy section 10.5 (AQP-199) and pinned by
 * `tests/unit/one-width-tag.test.ts`; none of them is tagged until it is ruled. Proposed for the ruling: "refuses a name another material
 * has" and "an edit that changes nothing closes without a request" read no layout.
 */

test.use({ storageState: ADMIN_STATE });

/** UX spec SCR-13, written out. */
const NAME_TAKEN = 'A material with this name already exists. Names must be unique.';
const GRAVITY_ABOVE_ZERO = 'Enter a value above 0.';
const GRAVITY_HINT = 'Must be above 0.';
const NUMBER_MESSAGE = 'Enter a number, 0 or more, with up to 2 decimals.';
const TITLE = 'Materials and lists';

/** A material the test makes. */
const MATERIAL = { materialConsidered: 'Invented mild steel', pricePerKg: '58.37', specificGravity: '7.85', scrapRate: '22.37' } as const;

/** The row (table) or card (phone) of a material: whichever of the two is shown. */
function rowOf(page: Page, name: string): Locator {
  return page.locator('[data-item-id]:visible').filter({ hasText: name });
}

/** A material name nobody else has: it carries the screen size, the repeat and the retry, plus a random part. */
function newMaterialName(testInfo: TestInfo): string {
  return `E2E-material-${testInfo.project.name}-r${testInfo.repeatEachIndex}-t${testInfo.retry}-${randomBytes(3).toString('hex')}`;
}

/** Makes a material through the API, the way the screen does, and returns its name. */
async function makeMaterial(page: Page, testInfo: TestInfo): Promise<string> {
  const name = newMaterialName(testInfo);
  const response = await page.request.post(`${DEVELOPMENT_URL}/api/v1/materials`, {
    headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
    data: { materialInDrawing: name, ...MATERIAL },
  });
  expect(response.status()).toBe(201);
  return name;
}

async function openMaterials(page: Page): Promise<void> {
  await page.goto('/masters/materials');
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  // The buttons are plain HTML until React has attached their handlers; a press before that is lost (DEF-011).
  await waitUntilHydrated(page, 'main button[data-action="add"]');
}

/** Presses a button with the keyboard, the way a person who does not use a pointer does. */
async function pressWithKeyboard(button: Locator): Promise<void> {
  await button.focus();
  await button.press('Enter');
}

/** Types into the focused field, then Tab to the next one: the dialog is filled without a pointer. */
async function typeAndTab(page: Page, values: ReadonlyArray<string>): Promise<void> {
  for (const [index, value] of values.entries()) {
    await page.keyboard.type(value);
    if (index < values.length - 1) await page.keyboard.press('Tab');
  }
}

test.describe('the tab shell and the list (AC-1, AC-7)', () => {
  test('AC-1, AC-7: a tab bar with the Materials tab selected, a table of the five columns or a card for each material, no sideways scroll, axe 0 violations', async ({ page }, testInfo) => {
    const name = await makeMaterial(page, testInfo);
    await openMaterials(page);
    const tabs = page.getByRole('tablist', { name: 'Lists' });
    await expect(tabs.getByRole('tab', { name: 'Materials' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Materials' })).toBeVisible();
    const row = rowOf(page, name);
    await expect(row).toContainText('Invented mild steel');
    await expect(row).toContainText('58.37');
    await expect(row).toContainText('7.85');
    await expect(row).toContainText('22.37');
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      const headers = page.getByRole('columnheader');
      await expect(headers.filter({ hasText: 'Material in Drawing' })).toBeVisible();
      await expect(headers.filter({ hasText: 'Material Considered' })).toBeVisible();
      await expect(headers.filter({ hasText: 'Price per kg (₹)' })).toBeVisible();
      await expect(headers.filter({ hasText: 'Specific gravity' })).toBeVisible();
      await expect(headers.filter({ hasText: 'Material-Scrap-Rate (₹ per kg)' })).toBeVisible();
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-7: controls are at least 44 px, and the icon button of a table row at least 36 px', async ({ page }, testInfo) => {
    const name = await makeMaterial(page, testInfo);
    await openMaterials(page);
    const addBox = await page.getByRole('button', { name: 'Add material' }).boundingBox();
    expect(addBox?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    const searchBox = await page.getByLabel('Search materials').boundingBox();
    expect(searchBox?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    const tabBox = await page.getByRole('tab', { name: 'Materials' }).boundingBox();
    expect(tabBox?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    const edit = rowOf(page, name).getByRole('button', { name: `Edit ${name}` });
    const box = await edit.boundingBox();
    const isIconRow = (await edit.getAttribute('data-size')) === 'icon-row';
    const least = isIconRow ? ROW_TARGET : TOUCH_TARGET;
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(least);
    if (isIconRow) expect(box?.width ?? 0).toBeGreaterThanOrEqual(least);
  });
});

test.describe('add a material (AC-2, AC-3, AC-7, AC-8)', () => {
  test('by keyboard: Enter opens the dialog on Material in Drawing, it fits the screen and has no axe violations, Escape closes it and focus returns to "Add material"', async ({ page }) => {
    await openMaterials(page);
    const add = page.getByRole('button', { name: 'Add material' });
    await pressWithKeyboard(add);
    const dialog = page.getByRole('dialog', { name: 'Add material' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Material in Drawing')).toBeFocused();
    await expect(dialog.getByText(GRAVITY_HINT)).toBeVisible();
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(add).toBeFocused();
  });

  test('by keyboard: fills the five fields with Tab and saves with Enter; the list shows the material and the notice says it was added', async ({ page }, testInfo) => {
    const name = newMaterialName(testInfo);
    await openMaterials(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add material' }));
    const dialog = page.getByRole('dialog', { name: 'Add material' });
    await expect(dialog.getByLabel('Material in Drawing')).toBeFocused();
    await typeAndTab(page, [name, 'Invented stainless', '214.5', '7.9', '95']);
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `${name} was added. The change is in the audit log.` })).toBeVisible();
    const row = rowOf(page, name);
    await expect(row).toContainText('Invented stainless');
    await expect(row).toContainText('214.50');
    await expect(row).toContainText('7.90');
    await expect(row).toContainText('95.00');
    await expect(page.getByRole('button', { name: 'Add material' })).toBeFocused();
  });

  test('refuses an empty form in words under each field, keeps what was typed, and puts focus on the first field with a message (AC-3)', async ({ page }) => {
    await openMaterials(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add material' }));
    const dialog = page.getByRole('dialog', { name: 'Add material' });
    await dialog.getByLabel('Price per kg').fill('58.123');
    await dialog.getByRole('button', { name: 'Add material' }).click();
    await expect(dialog.getByText('Enter a name.')).toBeVisible();
    await expect(dialog.getByText('Enter the Material Considered.')).toBeVisible();
    await expect(dialog.getByText(NUMBER_MESSAGE)).toHaveCount(2);
    await expect(dialog.getByText('Enter a number above 0, with up to 2 decimals.')).toBeVisible();
    await expect(dialog.getByLabel('Price per kg')).toHaveValue('58.123');
    await expect(dialog.getByLabel('Material in Drawing')).toBeFocused();
    await expect(dialog.getByLabel('Material in Drawing')).toHaveAttribute('aria-invalid', 'true');
  });

  test('state "Specific gravity 0": 0 is refused under the field with "Enter a value above 0.", the hint stays, the dialog keeps what was typed and focus goes to the field (UX-37)', async ({ page }, testInfo) => {
    const name = newMaterialName(testInfo);
    await openMaterials(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add material' }));
    const dialog = page.getByRole('dialog', { name: 'Add material' });
    await dialog.getByLabel('Material in Drawing').fill(name);
    await dialog.getByLabel('Material Considered').fill('Invented brass');
    await dialog.getByLabel('Price per kg').fill('58');
    await dialog.getByLabel('Specific gravity').fill('0');
    await dialog.getByLabel('Material-Scrap-Rate (per kg)').fill('22');
    await dialog.getByRole('button', { name: 'Add material' }).click();
    const gravity = dialog.getByLabel('Specific gravity');
    await expect(dialog.getByText(GRAVITY_ABOVE_ZERO)).toBeVisible();
    await expect(dialog.getByText(GRAVITY_HINT)).toBeVisible();
    await expect(gravity).toBeFocused();
    await expect(gravity).toHaveAttribute('aria-invalid', 'true');
    await expect(gravity).toHaveValue('0');
    await expect(dialog.getByLabel('Material in Drawing')).toHaveValue(name);
    await expectNoAxeViolations(page);
    // Nothing was stored: the list has no such material.
    await page.keyboard.press('Escape');
    await expect(rowOf(page, name)).toHaveCount(0);
  });

  test('state "Duplicate name": a name another material has, in any letter case, is refused under the name with the sentence of SCR-13; the dialog stays open with what was typed', async ({ page }, testInfo) => {
    const name = await makeMaterial(page, testInfo);
    await openMaterials(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add material' }));
    const dialog = page.getByRole('dialog', { name: 'Add material' });
    await dialog.getByLabel('Material in Drawing').fill(name.toUpperCase());
    await dialog.getByLabel('Material Considered').fill('Invented other');
    await dialog.getByLabel('Price per kg').fill('1');
    await dialog.getByLabel('Specific gravity').fill('1');
    await dialog.getByLabel('Material-Scrap-Rate (per kg)').fill('1');
    await dialog.getByRole('button', { name: 'Add material' }).click();
    await expect(dialog.getByText(NAME_TAKEN)).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Material in Drawing')).toBeFocused();
    await expect(dialog.getByLabel('Material Considered')).toHaveValue('Invented other');
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(rowOf(page, name)).toHaveCount(1);
  });
});

test.describe('edit a material (AC-2, AC-3, AC-5)', () => {
  test('by keyboard: Enter on Edit opens the dialog with the material\'s own values; Save changes the scrap rate, the notice names the material, and focus returns to Edit', async ({ page }, testInfo) => {
    const name = await makeMaterial(page, testInfo);
    await openMaterials(page);
    const edit = rowOf(page, name).getByRole('button', { name: `Edit ${name}` });
    await pressWithKeyboard(edit);
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await expect(dialog.getByLabel('Material in Drawing')).toHaveValue(name);
    await expect(dialog.getByLabel('Specific gravity')).toHaveValue('7.85');
    await dialog.getByLabel('Material-Scrap-Rate (per kg)').fill('30.5');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `${name} saved. The change is in the audit log.` })).toBeVisible();
    await expect(rowOf(page, name)).toContainText('30.50');
    await expect(rowOf(page, name).getByRole('button', { name: `Edit ${name}` })).toBeFocused();
  });

  test('an edit that changes nothing closes without a request', async ({ page }, testInfo) => {
    const name = await makeMaterial(page, testInfo);
    await openMaterials(page);
    let requests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/materials') && request.method() !== 'GET') requests += 1;
    });
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Edit ${name}` }));
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    expect(requests).toBe(0);
  });

  test('a specific gravity of 0 in an edit is refused under the field, and the material keeps its value (UX-37)', async ({ page }, testInfo) => {
    const name = await makeMaterial(page, testInfo);
    await openMaterials(page);
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Edit ${name}` }));
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await dialog.getByLabel('Specific gravity').fill('0');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByText(GRAVITY_ABOVE_ZERO)).toBeVisible();
    await expect(dialog.getByLabel('Specific gravity')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(rowOf(page, name)).toContainText('7.85');
  });
});

test.describe('search and states (AC-1, AC-8)', () => {
  test('filters by Material in Drawing or Material Considered ignoring letter case, says "No material matches" with Clear filters, and Clear filters brings the list back and focuses the search', async ({ page }, testInfo) => {
    const name = await makeMaterial(page, testInfo);
    await openMaterials(page);
    const search = page.getByLabel('Search materials');
    await search.fill(name.toUpperCase());
    await expect(rowOf(page, name)).toBeVisible();
    await search.fill('INVENTED MILD STEEL');
    await expect(rowOf(page, name)).toBeVisible();

    await search.fill('zebra-nothing');
    const empty = page.getByRole('status').filter({ hasText: 'No material matches "zebra-nothing"' });
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('Check the spelling, or clear the search.');
    await empty.getByRole('button', { name: 'Clear filters' }).click();
    await expect(search).toHaveValue('');
    await expect(search).toBeFocused();
    await expect(rowOf(page, name)).toBeVisible();
  });

  test('shows the skeleton after 300 ms while the list is read again, with the panel busy, and the list when it arrives', async ({ page }, testInfo) => {
    const name = await makeMaterial(page, testInfo);
    await openMaterials(page);
    // A slow answer, held until the test lets it go: the skeleton shows after 300 ms of waiting (UX spec section 6.0 "States"), and the test
    // asserts it while the answer is held, so nothing depends on a fixed delay.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/v1/materials', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await held;
      return route.continue();
    });
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Edit ${name}` }));
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await dialog.getByLabel('Material-Scrap-Rate (per kg)').fill('44.37');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Loading the materials' })).toBeAttached();
    await expect(page.locator('main [aria-busy="true"]').first()).toBeAttached();
    release();
    await expect(rowOf(page, name)).toContainText('44.37');
    await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
  });

  test('shows "No materials yet" with Add material still visible when there is no material, and Add material still opens its dialog', async ({ page }, testInfo) => {
    const name = await makeMaterial(page, testInfo);
    await openMaterials(page);
    await page.route('**/api/v1/materials', async (route) =>
      route.request().method() === 'GET' ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ materials: [] }) }) : route.continue(),
    );
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Edit ${name}` }));
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await dialog.getByLabel('Material-Scrap-Rate (per kg)').fill('45.37');
    await dialog.getByRole('button', { name: 'Save' }).click();
    const empty = page.getByRole('status').filter({ hasText: 'No materials yet' });
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('Add the first material. The estimate form offers only the materials on this list.');
    await expect(page.getByRole('button', { name: 'Add material' })).toBeVisible();
    await pressWithKeyboard(page.getByRole('button', { name: 'Add material' }));
    await expect(page.getByRole('dialog', { name: 'Add material' })).toBeVisible();
  });

  test('shows the error state with "Try again" when the list cannot be read after a change, and Try again reads it', async ({ page }, testInfo) => {
    const name = await makeMaterial(page, testInfo);
    await openMaterials(page);
    let fail = true;
    await page.route('**/api/v1/materials', async (route) => {
      if (route.request().method() === 'GET' && fail) {
        const body = { type: 'about:blank', title: 'The service is busy. Try again in a moment.', status: 503, code: 'DATABASE_BUSY', requestId: 'req-0a0b0c0d' };
        return route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify(body) });
      }
      return route.continue();
    });
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Edit ${name}` }));
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await dialog.getByLabel('Material-Scrap-Rate (per kg)').fill('46.37');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'We could not load the materials' })).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(rowOf(page, name)).toContainText('46.37');
  });
});
