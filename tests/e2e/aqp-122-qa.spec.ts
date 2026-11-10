import { randomBytes } from 'node:crypto';

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { createDisposableUser, E2E_PASSWORD, signInThroughThePage, useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, ROW_TARGET, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, DEVELOPMENT_URL, SIGNED_IN_STATE } from './support/servers';

/**
 * QA's own browser checks for STORY-02.03 (AQP-122) at G7, at 360x800, 768x1024 and 1366x768 on the development server, written from the words of
 * the ux-expert (Jira 11188, ux-spec v0.18, SCR-13 "The Materials tab: final words"), which are written out below and not imported from the code.
 * Signed in as the E2E Admin unless a test says otherwise. Each test makes its own materials through the API with an invented name that carries the
 * screen size, the repeat and the retry plus a random part, so widths, repeats and retries never meet on one material. Invented values (`n.37`).
 *
 * Covered here and not in the developer's `materials.spec.ts`: every string of the final-words table for the dialogs and the notices; messages
 * that clear when their field is edited; the failed Add and failed Edit notices; the loading and load-error states with focus; the Edit dialog
 * title that does not change while typing; long unbroken text in the search, the name, the dialog title and the notice at every width; the
 * dialog's own controls at 44 px and the Tab order; and access for a Lead, an Engineer and a signed-out visitor (page and API).
 */

const TITLE = 'Materials and lists';
const MATERIAL = { materialConsidered: 'Invented QA steel', pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' } as const;
const NO_ACCESS_TITLE = 'You do not have access to this page';

// The words, from ux-spec v0.18 SCR-13.
const WORDS = {
  // Two tabs are in the bar since STORY-02.04, so the page names exactly those two (ux-spec v0.18 "The page description until ...").
  description: 'Material prices and exchange rates.',
  metaDescription: 'Manage materials and exchange rates used in estimates.',
  placeholder: 'Material in Drawing or Considered',
  nameRequired: 'Enter the Material in Drawing.',
  oldNameRequired: 'Enter a name.',
  consideredRequired: 'Enter the Material Considered.',
  tooLong: 'Use 100 characters or fewer.',
  taken: 'A material with this name already exists. Names must be unique.',
  number: 'Enter a number, 0 or more, with up to 2 decimals.',
  gravityZero: 'Enter a value above 0.',
  gravityShape: 'Enter a number above 0, with up to 2 decimals.',
  gravityHint: 'Must be above 0.',
  emptyTitle: 'No materials yet',
  emptyText: "Add the first material. A part's Material in Drawing is chosen from this list.",
  noMatchText: 'Check the spelling, or clear the search.',
  loading: 'Loading the materials',
  loadErrorTitle: 'We could not load the materials',
  failedText: 'Check your connection and try again. Nothing was changed.',
  failedAdd: 'We could not add the material.',
  failedSave: 'We could not save the changes.',
} as const;

function rowOf(page: Page, name: string): Locator {
  return page.locator('[data-item-id]:visible').filter({ hasText: name });
}

function newName(testInfo: TestInfo, tag = 'qa'): string {
  return `QA122-${tag}-${testInfo.project.name}-r${testInfo.repeatEachIndex}-t${testInfo.retry}-${randomBytes(3).toString('hex')}`;
}

async function makeMaterial(page: Page, name: string, extra: Record<string, string> = {}): Promise<void> {
  const response = await page.request.post(`${DEVELOPMENT_URL}/api/v1/materials`, {
    headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
    data: { materialInDrawing: name, ...MATERIAL, ...extra },
  });
  expect(response.status()).toBe(201);
}

async function openMaterials(page: Page): Promise<void> {
  await page.goto('/masters/materials');
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await waitUntilHydrated(page, 'main button[data-action="add"]');
}

async function openAdd(page: Page): Promise<Locator> {
  const add = page.getByRole('button', { name: 'Add material' });
  await add.focus();
  await add.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Add material' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openEdit(page: Page, name: string): Promise<Locator> {
  const edit = rowOf(page, name).getByRole('button', { name: `Edit ${name}` });
  await edit.focus();
  await edit.press('Enter');
  const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillAll(dialog: Locator, values: { name: string; considered: string; price: string; gravity: string; scrap: string }): Promise<void> {
  await dialog.getByLabel('Material in Drawing').fill(values.name);
  await dialog.getByLabel('Material Considered').fill(values.considered);
  await dialog.getByLabel('Price per kg').fill(values.price);
  await dialog.getByLabel('Specific gravity').fill(values.gravity);
  await dialog.getByLabel('Material-Scrap-Rate (per kg)').fill(values.scrap);
}

/** No part of the page is wider than the screen: the document does not scroll sideways and the box in question ends inside the viewport. */
async function expectInsideViewport(page: Page, box: Locator): Promise<void> {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  const rect = await box.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(rect?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((rect?.x ?? 0) + (rect?.width ?? Number.MAX_SAFE_INTEGER)).toBeLessThanOrEqual(width);
}

test.describe('as the Admin', () => {
  test.use({ storageState: ADMIN_STATE });

  test('[AQP-122 AC-1 AC-8] the page words: title, description, meta description, tab list, search label and placeholder, column headings or card labels', async ({ page }, testInfo) => {
    const name = newName(testInfo);
    await makeMaterial(page, name);
    await openMaterials(page);
    await expect(page.locator('main h1 + p')).toHaveText(WORDS.description);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', WORDS.metaDescription);
    await expect(page).toHaveTitle(/Materials and lists/);
    await expect(page.getByRole('tablist', { name: 'Lists' }).getByRole('tab')).toHaveText(['Materials', 'Exchange rates']);
    await expect(page.getByLabel('Search materials')).toHaveAttribute('placeholder', WORDS.placeholder);
    const row = rowOf(page, name);
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      // The headings are drawn in capitals by CSS (text-transform), so read the words as written in the page, not as drawn.
      const headings = await page.getByRole('columnheader').evaluateAll((cells) => cells.map((cell) => (cell.textContent ?? '').trim()));
      for (const heading of ['Material in Drawing', 'Material Considered', 'Price per kg (₹)', 'Specific gravity', 'Material-Scrap-Rate (₹ per kg)']) expect(headings).toContain(heading);
    } else {
      await expect(row).toContainText('Price per kg (₹)');
      await expect(row).toContainText('Specific gravity');
      await expect(row).toContainText('Material-Scrap-Rate (₹ per kg)');
    }
    await expect(row).toContainText('58.37');
    await expect(row).toContainText('7.37');
    await expect(row).toContainText('22.37');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('[AQP-122 AC-8] Add: every message of the final-words table appears under its field, the old "Enter a name." does not, values stay, each message clears when its field is edited, focus goes to the first field with a message', async ({ page }) => {
    await openMaterials(page);
    const dialog = await openAdd(page);
    await expect(dialog.getByText(WORDS.gravityHint)).toBeVisible();
    await fillAll(dialog, { name: '   ', considered: '  ', price: '-1', gravity: '0', scrap: '1.234' });
    await dialog.getByRole('button', { name: 'Add material' }).click();
    await expect(dialog.getByText(WORDS.nameRequired)).toBeVisible();
    await expect(dialog.getByText(WORDS.consideredRequired)).toBeVisible();
    await expect(dialog.getByText(WORDS.number)).toHaveCount(2);
    await expect(dialog.getByText(WORDS.gravityZero)).toBeVisible();
    await expect(dialog.getByText(WORDS.oldNameRequired)).toHaveCount(0);
    await expect(dialog.getByLabel('Material in Drawing')).toBeFocused();
    await expect(dialog.getByLabel('Price per kg')).toHaveValue('-1');
    await expect(dialog.getByLabel('Material-Scrap-Rate (per kg)')).toHaveValue('1.234');
    // A message clears when its own field is edited, and only that one.
    await dialog.getByLabel('Material in Drawing').fill('x');
    await expect(dialog.getByText(WORDS.nameRequired)).toHaveCount(0);
    await expect(dialog.getByText(WORDS.consideredRequired)).toBeVisible();
    await dialog.getByLabel('Specific gravity').fill('abc');
    await expect(dialog.getByText(WORDS.gravityZero)).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Add material' }).click();
    await expect(dialog.getByText(WORDS.gravityShape)).toBeVisible();
    await dialog.getByLabel('Material in Drawing').fill('N'.repeat(101));
    await dialog.getByLabel('Material Considered').fill('C'.repeat(101));
    await dialog.getByRole('button', { name: 'Add material' }).click();
    await expect(dialog.getByText(WORDS.tooLong)).toHaveCount(2);
    await expectInsideViewport(page, dialog);
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('[AQP-122 AC-8] Add: the dialog has Cancel and Add material, the controls inside are 44 px, Tab goes through the five fields then Cancel then Add in order, and Cancel sends nothing and returns focus to the button', async ({ page }) => {
    await openMaterials(page);
    let writes = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/materials') && request.method() !== 'GET') writes += 1;
    });
    const dialog = await openAdd(page);
    for (const label of ['Material in Drawing', 'Material Considered', 'Price per kg', 'Specific gravity', 'Material-Scrap-Rate (per kg)']) {
      const box = await dialog.getByLabel(label).boundingBox();
      expect(box?.height ?? 0, label).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    for (const button of ['Cancel', 'Add material']) {
      const box = await dialog.getByRole('button', { name: button }).boundingBox();
      expect(box?.height ?? 0, button).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    await expect(dialog.getByLabel('Material in Drawing')).toBeFocused();
    const order = ['Material Considered', 'Price per kg', 'Specific gravity', 'Material-Scrap-Rate (per kg)'];
    for (const label of order) {
      await page.keyboard.press('Tab');
      await expect(dialog.getByLabel(label)).toBeFocused();
    }
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Add material' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add material' })).toBeFocused();
    expect(writes).toBe(0);
  });

  test('[AQP-122 AC-2 AC-8] Add: a name that differs only by case from an existing one shows the SCR-13 sentence under the name; fixing the name saves, closes, and the notice reads "<name> was added. The change is in the audit log."', async ({ page }, testInfo) => {
    const name = newName(testInfo, 'dup');
    await makeMaterial(page, name);
    await openMaterials(page);
    const dialog = await openAdd(page);
    await fillAll(dialog, { name: ` ${name.toLowerCase()} `, considered: 'Invented other', price: '1', gravity: '1', scrap: '1' });
    await dialog.getByRole('button', { name: 'Add material' }).click();
    await expect(dialog.getByText(WORDS.taken)).toBeVisible();
    await expect(dialog.getByLabel('Material in Drawing')).toBeFocused();
    await expect(dialog.getByLabel('Material in Drawing')).toHaveAttribute('aria-invalid', 'true');
    const fresh = newName(testInfo, 'fresh');
    await dialog.getByLabel('Material in Drawing').fill(fresh);
    await dialog.getByRole('button', { name: 'Add material' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `${fresh} was added. The change is in the audit log.` })).toBeVisible();
    const row = rowOf(page, fresh);
    await expect(row).toContainText('1.00');
    await expect(row).toContainText('Invented other');
  });

  test('[AQP-122 AC-8] Edit: the title is "Edit <name>" as it was when the dialog opened and does not change while typing; footer is Cancel and Save; the notice reads "<name> saved. The change is in the audit log."', async ({ page }, testInfo) => {
    const name = newName(testInfo, 'edit');
    await makeMaterial(page, name);
    await openMaterials(page);
    const dialog = await openEdit(page, name);
    const renamed = `${name}-renamed`;
    await dialog.getByLabel('Material in Drawing').fill(renamed);
    await expect(dialog.getByRole('heading', { name: `Edit ${name}` })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `${renamed} saved. The change is in the audit log.` })).toBeVisible();
    await expect(rowOf(page, renamed)).toBeVisible();
    await expect(rowOf(page, renamed).getByRole('button', { name: `Edit ${renamed}` })).toBeFocused();
  });

  test('[AQP-122 AC-8] Edit that changes nothing: the dialog closes, nothing is sent and no message or notice appears', async ({ page }, testInfo) => {
    const name = newName(testInfo, 'same');
    await makeMaterial(page, name);
    await openMaterials(page);
    let writes = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/materials') && request.method() !== 'GET') writes += 1;
    });
    const dialog = await openEdit(page, name);
    await dialog.getByLabel('Price per kg').fill('058.37');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: 'saved' })).toHaveCount(0);
    expect(writes).toBe(0);
  });

  test('[AQP-122 AC-8] Failed Add and failed Edit: a danger notice at the top of the dialog with the SCR-13 words, the typed values stay, and the dialog stays open', async ({ page }, testInfo) => {
    const name = newName(testInfo, 'fail');
    await makeMaterial(page, name);
    await openMaterials(page);
    await page.route('**/api/v1/materials**', (route) => {
      if (route.request().method() === 'GET') return route.continue();
      return route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'The service is busy. Try again in a moment.', status: 503, code: 'DATABASE_BUSY', requestId: 'req-0a0b0c0d' }) });
    });
    const add = await openAdd(page);
    await fillAll(add, { name: newName(testInfo, 'never'), considered: 'Invented never', price: '1', gravity: '1', scrap: '1' });
    await add.getByRole('button', { name: 'Add material' }).click();
    await expect(add.getByText(WORDS.failedAdd)).toBeVisible();
    await expect(add.getByText(WORDS.failedText)).toBeVisible();
    await expect(add.getByLabel('Material Considered')).toHaveValue('Invented never');
    await page.keyboard.press('Escape');
    const edit = await openEdit(page, name);
    await edit.getByLabel('Price per kg').fill('99.37');
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(edit.getByText(WORDS.failedSave)).toBeVisible();
    await expect(edit.getByText(WORDS.failedText)).toBeVisible();
    await expect(edit.getByLabel('Price per kg')).toHaveValue('99.37');
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(rowOf(page, name)).toContainText('58.37');
  });

  test('[AQP-122 AC-8] Loading, Error and Empty: "Loading the materials" while the list is read, the load error with Try again and focus on its title, and the empty state with one Add material button', async ({ page }, testInfo) => {
    const name = newName(testInfo, 'states');
    await makeMaterial(page, name);
    await openMaterials(page);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let mode: 'hold' | 'fail' | 'empty' | 'pass' = 'hold';
    await page.route('**/api/v1/materials', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      if (mode === 'hold') {
        await held;
        return route.continue();
      }
      if (mode === 'fail') return route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'busy', status: 503, code: 'DATABASE_BUSY', requestId: 'req-0a0b0c0d' }) });
      if (mode === 'empty') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ materials: [] }) });
      return route.continue();
    });
    const edit = await openEdit(page, name);
    await edit.getByLabel('Material-Scrap-Rate (per kg)').fill('24.37');
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status').filter({ hasText: WORDS.loading })).toBeAttached();
    release();
    await expect(page.getByRole('status').filter({ hasText: WORDS.loading })).toBeHidden();
    await expect(rowOf(page, name)).toContainText('24.37');
    // The list is read again after a change (a page load carries the list with it), so the failing read follows a second change.
    // A held request carries on whatever the mode is when it is let go, which is why the failure is set up only now.
    mode = 'fail';
    const again = await openEdit(page, name);
    await again.getByLabel('Material-Scrap-Rate (per kg)').fill('26.37');
    await again.getByRole('button', { name: 'Save' }).click();
    const title = page.getByRole('heading', { name: WORDS.loadErrorTitle });
    await expect(title).toBeVisible();
    await expect(page.getByText(WORDS.failedText)).toBeVisible();
    await expectNoAxeViolations(page);
    mode = 'empty';
    await page.getByRole('button', { name: 'Try again' }).click();
    const empty = page.getByRole('status').filter({ hasText: WORDS.emptyTitle });
    await expect(empty).toBeVisible();
    await expect(empty).toContainText(WORDS.emptyText);
    await expect(page.getByRole('button', { name: 'Add material' })).toHaveCount(1);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    mode = 'pass';
  });

  // DEF-020 (AQP-235, fixed): SCR-13 says that in the load error "focus goes to the title". When the list cannot be read right after a successful
  // save, the dialog's close handler (`onCloseAutoFocus` -> `focusOpener`) used to find the opener gone and move focus to the page heading (`h1`)
  // after the error title had taken it. `focusOpener` now leaves focus alone while the list has failed.
  test('[AQP-122 AC-8] DEF-020: when the list cannot be read after a save, focus is on the load error title', async ({ page }, testInfo) => {
    const name = newName(testInfo, 'focus');
    await makeMaterial(page, name);
    await openMaterials(page);
    await page.route('**/api/v1/materials', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'busy', status: 503, code: 'DATABASE_BUSY', requestId: 'req-0a0b0c0d' }) });
    });
    const dialog = await openEdit(page, name);
    await dialog.getByLabel('Material-Scrap-Rate (per kg)').fill('27.37');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: WORDS.loadErrorTitle })).toBeVisible();
    await expect(page.getByRole('heading', { name: WORDS.loadErrorTitle })).toBeFocused({ timeout: 3000 });
  });

  // DEF-021 (AQP-234, fixed): the table used to need 968 px (its six headings did not wrap), so between 768 and 1022 px, and again between 1024 and
  // about 1270 px, the Edit button of every row lay beyond the right edge of the table's own scroll region. The Actions column is now sticky at that
  // edge and headings wrap (ux-spec 6.0 "Masters tables"); `masters-table-actions.spec.ts` checks the eleven widths of the spec for both masters tables.
  test('[AQP-122 AC-7] DEF-021: the Edit button of a row is inside the visible table area, with no sideways scroll of the table', async ({ page }, testInfo) => {
    await makeMaterial(page, newName(testInfo, 'reach'));
    await openMaterials(page);
    const edit = page.locator('[data-item-id]:visible button[data-action="edit"]').first();
    const box = await edit.boundingBox();
    const region = await page.locator('[data-slot="table-container"]:visible, ul[aria-label="Material Master"]:visible').first().boundingBox();
    expect(box).not.toBeNull();
    expect(region).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((region?.x ?? 0) + (region?.width ?? 0));
  });

  const LONG_TEXTS: ReadonlyArray<[string, string]> = [
    ['120 letters', 'x'.repeat(120)],
    ['400 capital letters', 'W'.repeat(400)],
    ['300 digits', '0123456789'.repeat(30)],
    ['a long address with no spaces', `https://${'a'.repeat(200)}.example.test/${'b'.repeat(100)}`],
    ['markup and quotes without spaces', `<b>"${'q'.repeat(150)}"</b>&amp;`],
  ];

  for (const [label, text] of LONG_TEXTS) {
    test(`[AQP-122 AC-7 AC-8] long unbroken search text (${label}): "No material matches" wraps inside the screen, nothing scrolls sideways, axe has 0 violations, Clear filters brings the list back`, async ({ page }, testInfo) => {
      const name = newName(testInfo, 'long');
      await makeMaterial(page, name);
      await openMaterials(page);
      const search = page.getByLabel('Search materials');
      await search.fill(text);
      const status = page.getByRole('status').filter({ hasText: 'No material matches' });
      await expect(status).toBeVisible();
      await expect(status).toContainText(WORDS.noMatchText);
      const heading = status.getByRole('heading').first();
      await expect(heading).toContainText(text.slice(0, 40));
      await expectInsideViewport(page, status);
      await expectInsideViewport(page, heading);
      await expect(search).toHaveValue(text);
      expect(await page.locator('b').count()).toBe(0);
      await expectNoAxeViolations(page);
      await status.getByRole('button', { name: 'Clear filters' }).click();
      await expect(search).toHaveValue('');
      await expect(search).toBeFocused();
      await expect(rowOf(page, name)).toBeVisible();
    });
  }

  test('[AQP-122 AC-7] a Material in Drawing of 100 letters with no space: the list, the Edit dialog title, the added notice and the saved notice all stay inside the screen', async ({ page }, testInfo) => {
    const name = `${newName(testInfo, 'wide')}${'Z'.repeat(100)}`.slice(0, 100);
    await makeMaterial(page, name, { materialConsidered: 'K'.repeat(100) });
    await openMaterials(page);
    const row = rowOf(page, name);
    await expect(row).toBeVisible();
    // From 768 px the table scrolls inside its own region (UX 6.0), so the row itself may be wider than the screen: only the page must not scroll.
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    if ((page.viewportSize()?.width ?? 0) < 768) await expectInsideViewport(page, row);
    const dialog = await openEdit(page, name);
    await expectInsideViewport(page, dialog);
    await dialog.getByLabel('Material-Scrap-Rate (per kg)').fill('25.37');
    await dialog.getByRole('button', { name: 'Save' }).click();
    const notice = page.getByRole('status').filter({ hasText: 'saved. The change is in the audit log.' });
    await expect(notice).toBeVisible();
    await expectInsideViewport(page, notice);
    // The list is read again after a save and focus goes back to the button that opened the dialog; the scan waits for that, so it sees the page at rest.
    await expect(rowOf(page, name).getByRole('button', { name: `Edit ${name}` })).toBeFocused();
    // The scan reads the page where it stands. In a long list a row's Edit button can sit half behind the sticky top bar, whose account button is
    // above the same column, and axe then reports the button's target size (WCAG 2.5.8) for a reason that is the scroll position and not the row. So the
    // scan is made from the top of the page, as every other scan of the suite is after a page load.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoAxeViolations(page);
  });

  test('[AQP-122 AC-7] controls: search, tabs, Add material and the Edit control reach the target size; Add and edit work with the keyboard only, end to end', async ({ page }, testInfo) => {
    const name = newName(testInfo, 'kbd');
    await makeMaterial(page, name);
    await openMaterials(page);
    for (const control of [page.getByLabel('Search materials'), page.getByRole('tab', { name: 'Materials' }), page.getByRole('button', { name: 'Add material' })]) {
      expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    const editBox = await rowOf(page, name).getByRole('button', { name: `Edit ${name}` }).boundingBox();
    const iconRow = (await rowOf(page, name).getByRole('button', { name: `Edit ${name}` }).getAttribute('data-size')) === 'icon-row';
    expect(editBox?.height ?? 0).toBeGreaterThanOrEqual(iconRow ? ROW_TARGET : TOUCH_TARGET);
    const added = newName(testInfo, 'kbd-added');
    const dialog = await openAdd(page);
    for (const [index, value] of [added, 'Invented keyboard steel', '12.37', '7.37', '2.37'].entries()) {
      await page.keyboard.type(value);
      if (index < 4) await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(rowOf(page, added)).toContainText('12.37');
    const again = await openEdit(page, added);
    await again.getByLabel('Specific gravity').fill('8.37');
    await again.getByLabel('Specific gravity').press('Enter');
    await expect(again).toBeHidden();
    await expect(rowOf(page, added)).toContainText('8.37');
  });

  test('[AQP-122 AC-4] the browser fetch of /api/v1/options/materials as the Admin has exactly three keys per entry and no number', async ({ page }) => {
    const response = await page.request.get(`${DEVELOPMENT_URL}/api/v1/options/materials`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { options: Array<Record<string, unknown>> };
    expect(body.options.length).toBeGreaterThan(0);
    for (const option of body.options) expect(Object.keys(option).sort()).toEqual(['id', 'materialConsidered', 'name']);
    expect(response.headers()['cache-control']).toMatch(/no-store/);
  });
});

test.describe('as a Lead (the saved browser state of the set-up project)', () => {
  test.use({ storageState: SIGNED_IN_STATE });

  test('[AQP-122 AC-6] the page is SCR-26 "no access" with status 403 and holds no material; the API routes are 403; the options route is open and holds no rate', async ({ page }) => {
    const response = await page.goto('/masters/materials');
    expect(response?.status()).toBe(403);
    await expect(page.getByRole('heading', { level: 1, name: NO_ACCESS_TITLE })).toBeVisible();
    await expect(page.getByText('Add material')).toHaveCount(0);
    expect(await page.content()).not.toMatch(/pricePerKg|specificGravity|Canary-Material/);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    const list = await page.request.get(`${DEVELOPMENT_URL}/api/v1/materials`);
    expect(list.status()).toBe(403);
    const post = await page.request.post(`${DEVELOPMENT_URL}/api/v1/materials`, { headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' }, data: { materialInDrawing: 'QA122-lead-never', ...MATERIAL } });
    expect(post.status()).toBe(403);
    const options = await page.request.get(`${DEVELOPMENT_URL}/api/v1/options/materials`);
    expect(options.status()).toBe(200);
    for (const option of ((await options.json()) as { options: Array<Record<string, unknown>> }).options) expect(Object.keys(option).sort()).toEqual(['id', 'materialConsidered', 'name']);
  });
});

test.describe('as an Engineer and signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('[AQP-122 AC-6] an Engineer gets SCR-26 and 403 on the page and the admin routes, and the options list without a rate; a signed-out visitor is sent to sign-in and gets 401', async ({ page, context }, testInfo) => {
    const signedOut = await page.goto('/masters/materials');
    expect(signedOut?.url()).toContain('/sign-in');
    expect((await page.request.get(`${DEVELOPMENT_URL}/api/v1/materials`)).status()).toBe(401);
    expect((await page.request.get(`${DEVELOPMENT_URL}/api/v1/options/materials`)).status()).toBe(401);

    const engineer = await createDisposableUser('managed', testInfo);
    await useFreshAddress(context);
    await page.goto('/sign-in');
    await signInThroughThePage(page, engineer.email, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/queue$/);
    const response = await page.goto('/masters/materials');
    expect(response?.status()).toBe(403);
    await expect(page.getByRole('heading', { level: 1, name: NO_ACCESS_TITLE })).toBeVisible();
    expect(await page.content()).not.toMatch(/pricePerKg|specificGravity|scrapRate/);
    expect((await page.request.get(`${DEVELOPMENT_URL}/api/v1/materials`)).status()).toBe(403);
    expect((await page.request.post(`${DEVELOPMENT_URL}/api/v1/materials`, { headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' }, data: { materialInDrawing: 'QA122-eng-never', ...MATERIAL } })).status()).toBe(403);
    const options = await page.request.get(`${DEVELOPMENT_URL}/api/v1/options/materials`);
    expect(options.status()).toBe(200);
    const body = await options.text();
    expect(body).not.toMatch(/price|gravity|scrap/i);
    for (const option of (JSON.parse(body) as { options: Array<Record<string, unknown>> }).options) expect(Object.keys(option).sort()).toEqual(['id', 'materialConsidered', 'name']);
  });
});
