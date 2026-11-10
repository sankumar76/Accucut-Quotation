import { randomBytes } from 'node:crypto';

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { expectNoAxeViolations, horizontalOverflow, ROW_TARGET, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-02.01 T6 (AC-1 to AC-5, AC-7, AC-8): SCR-11 "Process master" at 360x800, 768x1024 and 1366x768 on the development server,
 * signed in as the E2E Admin (the saved browser state of the set-up project). No sideways scroll, axe 0 violations, targets of
 * 44 px (36 px for the icon buttons of a table row), and the add, edit, delete and refusal dialogs by keyboard: the alert dialogs
 * start on the safe choice, Escape closes, focus returns to the button that opened them.
 *
 * Each test works on rates it makes for itself through the API (an invented name with the screen size, the repeat, the retry and a
 * random part), so the three screen sizes and the retries never meet on one rate. The 15 seed rates are only read, never changed:
 * the refusal test opens the dialog of a rate a formula uses and closes it. The words are the UX spec's, written out here.
 * Names and numbers are invented (`n.37`, ADR-014).
 *
 * Width: which of these tests may run at one width only is ruled in test strategy section 10.5 (AQP-113 PRF-02; ruling 2026-11-08) and pinned
 * by `tests/unit/one-width-tag.test.ts`. Three are tagged `@one-width`: the add test, the edit test (with its no-change check) and the
 * filter test. Every other test in the file keeps three widths.
 */

test.use({ storageState: ADMIN_STATE });

/** UX spec SCR-11, written out. */
const NAME_TAKEN = 'A rate with this name already exists.';
const VALUE_MESSAGE = 'Enter a number, 0 or more, with up to 2 decimals.';
const BLOCKED_TITLE = 'This rate is used by a formula';
const BLOCKED_SENTENCE = 'Cutting-Rate-per-Sec cannot be deleted while a formula uses it. Formulas cannot be changed until Release 2, so this rate stays on the list.';
/** A seed rate that a seed formula uses (Cutting Cost, AL), and the one that no formula uses. */
const USED_RATE = 'Cutting-Rate-per-Sec';
const UNUSED_RATE = 'Plating-rate-per-sqin';

/** The row (table) or card (phone) of a rate: whichever of the two is shown. */
function rowOf(page: Page, name: string): Locator {
  return page.locator('[data-item-id]:visible').filter({ hasText: name });
}

/** A rate name nobody else has: it carries the screen size, the repeat and the retry, plus a random part. It reads as no formula. */
function newRateName(testInfo: TestInfo): string {
  return `E2E-rate-${testInfo.project.name}-r${testInfo.repeatEachIndex}-t${testInfo.retry}-${randomBytes(3).toString('hex')}`;
}

/** Makes a rate through the API, the way the screen does, and returns its name. */
async function makeRate(page: Page, testInfo: TestInfo, defaultValue = '1.37'): Promise<string> {
  const name = newRateName(testInfo);
  const response = await page.request.post(`${DEVELOPMENT_URL}/api/v1/process-items`, {
    headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
    data: { name, unit: 'per kg', defaultValue },
  });
  expect(response.status()).toBe(201);
  return name;
}

async function openProcessMaster(page: Page): Promise<void> {
  await page.goto('/masters/process');
  await expect(page.getByRole('heading', { level: 1, name: 'Process master' })).toBeVisible();
  // The buttons are plain HTML until React has attached their handlers; a press before that is lost (DEF-011).
  await waitUntilHydrated(page, 'main button[data-action="add"]');
}

/** Presses a button with the keyboard, the way a person who does not use a pointer does. */
async function pressWithKeyboard(button: Locator): Promise<void> {
  await button.focus();
  await button.press('Enter');
}

test.describe('the list (AC-1, AC-7)', () => {
  test('AC-1, AC-7: lists the 15 seed rates with unit, default value and the letters of the formulas that use them, does not scroll sideways and has no axe violations', async ({ page }) => {
    await openProcessMaster(page);
    const used = rowOf(page, USED_RATE);
    await expect(used).toContainText('₹ per second');
    await expect(used).toContainText('AL');
    await expect(rowOf(page, UNUSED_RATE)).toContainText('None yet');
    await expect(rowOf(page, 'OH Profit %')).toContainText('BD');
    await expect(rowOf(page, 'Transport %')).toContainText('%');
    for (const name of ['Cutting-Rate-per-Sec', 'Bending-Rate-per-stroke', 'Drilling-Tapping-Rate', 'Welding-rate-per-kg', 'Dip-Galvanizing-Cost-per-kg', 'Primer-rate-per-sqft', 'Shot-Blasting-rate-per-kg', 'Polishing-rate-per-sqin', 'Plating-rate-per-sqin', 'Powder-rate-per-sqft', 'Foam Cost', 'Soft-Anodize-rate-per-sqin', 'OH Profit %', 'Transport %', 'Inspection & Packing %']) {
      await expect(rowOf(page, name).first()).toBeVisible();
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-7: controls are at least 44 px, and the icon buttons of a table row at least 36 px', async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    const addBox = await page.getByRole('button', { name: 'Add rate' }).boundingBox();
    expect(addBox?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    const searchBox = await page.getByLabel('Search').boundingBox();
    expect(searchBox?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    const buttons = rowOf(page, name).getByRole('button');
    expect(await buttons.count()).toBe(2);
    for (let index = 0; index < 2; index += 1) {
      const box = await buttons.nth(index).boundingBox();
      const isIconRow = (await buttons.nth(index).getAttribute('data-size')) === 'icon-row';
      const least = isIconRow ? ROW_TARGET : TOUCH_TARGET;
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(least);
      if (isIconRow) expect(box?.width ?? 0).toBeGreaterThanOrEqual(least);
    }
  });
});

test.describe('add a rate (AC-2, AC-5, AC-7)', () => {
  test('by keyboard: the dialog opens on the name, fits the screen, has no axe violations, Escape closes it and focus returns to "Add rate"', async ({ page }) => {
    await openProcessMaster(page);
    const add = page.getByRole('button', { name: 'Add rate' });
    await pressWithKeyboard(add);
    const dialog = page.getByRole('dialog', { name: 'Add rate' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Rate name')).toBeFocused();
    await expect(dialog.getByText('Names ending in % are typed as whole percentages: 12 means 12%.')).toBeVisible();
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(add).toBeFocused();
  });

  test('refuses an empty form in words under each field, keeps what was typed, and puts focus on the first field with a message', async ({ page }) => {
    await openProcessMaster(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add rate' }));
    const dialog = page.getByRole('dialog', { name: 'Add rate' });
    await dialog.getByLabel('Default value').fill('1.234');
    await dialog.getByRole('button', { name: 'Add rate' }).click();
    await expect(dialog.getByText('Enter a name.')).toBeVisible();
    await expect(dialog.getByText('Choose a unit.')).toBeVisible();
    await expect(dialog.getByText(VALUE_MESSAGE)).toBeVisible();
    await expect(dialog.getByLabel('Default value')).toHaveValue('1.234');
    await expect(dialog.getByLabel('Rate name')).toBeFocused();
  });

  test('DEF-025: after a refusal of several fields, typing into the name keeps focus and every letter there, and so does the default value', async ({ page }) => {
    await openProcessMaster(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add rate' }));
    const dialog = page.getByRole('dialog', { name: 'Add rate' });
    await dialog.getByLabel('Default value').fill('1.234');
    await dialog.getByRole('button', { name: 'Add rate' }).click();
    await expect(dialog.getByText('Enter a name.')).toBeVisible();
    await expect(dialog.getByLabel('Rate name')).toBeFocused();

    // The keys go to whatever has focus, as a keyboard user's do. Each key clears a message; none of them may move focus.
    await page.keyboard.type('xyz');
    await expect(dialog.getByLabel('Rate name')).toBeFocused();
    await expect(dialog.getByLabel('Rate name')).toHaveValue('xyz');
    await expect(dialog.getByLabel('Default value')).toHaveValue('1.234');

    // Tab past the unit (still refused) to the default value, replace it, and focus stays there while the unit still has its message.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(dialog.getByLabel('Default value')).toBeFocused();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('12.37');
    await expect(dialog.getByLabel('Default value')).toBeFocused();
    await expect(dialog.getByLabel('Default value')).toHaveValue('12.37');
    await expect(dialog.getByLabel('Rate name')).toHaveValue('xyz');
    await expect(dialog.getByText('Choose a unit.')).toBeVisible();
  });

  test('adds a rate, shows it in the list with the saved notice, and refuses a second one that differs only in letter case or reads as a column letter', { tag: '@one-width' }, async ({ page }, testInfo) => {
    const name = newRateName(testInfo);
    await openProcessMaster(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add rate' }));
    const dialog = page.getByRole('dialog', { name: 'Add rate' });
    await dialog.getByLabel('Rate name').fill(name);
    await dialog.getByLabel('Unit').selectOption('per sq in');
    await dialog.getByLabel('Default value').fill('1.5');
    await dialog.getByRole('button', { name: 'Add rate' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `${name} was added. The change is in the audit log.` })).toBeVisible();
    const row = rowOf(page, name);
    await expect(row).toContainText('₹ per sq in');
    await expect(row).toContainText('1.50');
    await expect(row).toContainText('None yet');

    // The same name in capitals: refused under the name, the dialog stays open with what was typed.
    await pressWithKeyboard(page.getByRole('button', { name: 'Add rate' }));
    await dialog.getByLabel('Rate name').fill(name.toUpperCase());
    await dialog.getByLabel('Unit').selectOption('per kg');
    await dialog.getByLabel('Default value').fill('2');
    await dialog.getByRole('button', { name: 'Add rate' }).click();
    await expect(dialog.getByText(NAME_TAKEN)).toBeVisible();
    await expect(dialog).toBeVisible();
    // A valid column letter: letters move, so it is refused.
    await dialog.getByLabel('Rate name').fill('AL');
    await dialog.getByRole('button', { name: 'Add rate' }).click();
    await expect(dialog.getByText(/cannot read as column letters/)).toBeVisible();
    await page.keyboard.press('Escape');
    // Playwright matches text ignoring letter case, so one row for the name is one rate: the capitals did not add a second.
    await expect(rowOf(page, name)).toHaveCount(1);
  });
});

test.describe('edit a rate (AC-3, AC-5)', () => {
  test('changes the name and the default value; the saved notice names the new name; an edit that changes nothing closes without a request', { tag: '@one-width' }, async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Edit ${name}` }));
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await expect(dialog.getByLabel('Rate name')).toHaveValue(name);
    await expect(dialog.getByLabel('Default value')).toHaveValue('1.37');
    const renamed = `${name}-b`;
    await dialog.getByLabel('Rate name').fill(renamed);
    await dialog.getByLabel('Default value').fill('2.37');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `${renamed} saved. The change is in the audit log.` })).toBeVisible();
    await expect(rowOf(page, renamed)).toContainText('2.37');

    let requests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/process-items') && request.method() !== 'GET') requests += 1;
    });
    await pressWithKeyboard(rowOf(page, renamed).getByRole('button', { name: `Edit ${renamed}` }));
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog', { name: `Edit ${renamed}` })).toBeHidden();
    expect(requests).toBe(0);
  });
});

test.describe('delete a rate (AC-4, AC-5, AC-7)', () => {
  test('an alert dialog on the safe choice; Escape closes it and focus returns; then it deletes an unused rate', async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    const opener = rowOf(page, name).getByRole('button', { name: `Delete ${name}` });
    await pressWithKeyboard(opener);
    const alert = page.getByRole('alertdialog', { name: `Delete ${name}?` });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('You cannot undo this here.');
    await expect(alert.getByRole('button', { name: 'Keep rate' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(alert).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(rowOf(page, name)).toBeVisible();

    await pressWithKeyboard(opener);
    await alert.getByRole('button', { name: 'Delete rate' }).click();
    await expect(alert).toBeHidden();
    await expect(rowOf(page, name)).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: `${name} was deleted. The change is in the audit log.` })).toBeVisible();
    // The button that opened the dialog went with its row, so focus goes to the page heading, not to the top of the page (ux-spec v0.17).
    await expect(page.getByRole('heading', { level: 1, name: 'Process master' })).toBeFocused();
  });

  test('a rate a formula uses cannot be deleted: the dialog names the formulas as text, has Close as its only button and no link, has no axe violations, and the rate stays', async ({ page }) => {
    await openProcessMaster(page);
    const opener = rowOf(page, USED_RATE).getByRole('button', { name: `Delete ${USED_RATE}` });
    await pressWithKeyboard(opener);
    const alert = page.getByRole('alertdialog', { name: BLOCKED_TITLE });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(BLOCKED_SENTENCE);
    await expect(alert.getByRole('row', { name: /AL.*Cutting Cost/ })).toBeVisible();
    // Release 1: formulas cannot be changed, so there is nothing to link to (ux-spec v0.17; the product-owner, AC-4).
    await expect(alert.getByRole('link')).toHaveCount(0);
    await expect(alert.getByRole('button')).toHaveCount(1);
    await expect(alert.getByRole('button', { name: 'Close' })).toBeFocused();
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(alert).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(rowOf(page, USED_RATE)).toBeVisible();
  });
});

test.describe('a rate deleted elsewhere while its dialog is open (QLT-06, ux-spec v0.17)', () => {
  /** The dialog is closed, one status says what happened (no alert), the row is gone and the heading has focus. */
  async function expectGone(page: Page, name: string, bold: string, sentence: string): Promise<void> {
    const notice = page.getByRole('status').filter({ hasText: bold });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(sentence);
    // Inside the page: Next.js has its own route announcer, which is an alert outside main.
    await expect(page.locator('main').getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(rowOf(page, name)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Process master' })).toBeFocused();
  }

  /** Someone else deletes the rate after the list was read. */
  async function deleteElsewhere(page: Page, name: string): Promise<void> {
    const list = await page.request.get(`${DEVELOPMENT_URL}/api/v1/process-items`);
    const items = ((await list.json()) as { processItems: Array<{ id: string; name: string }> }).processItems;
    const id = items.find((item) => item.name === name)?.id ?? '';
    const response = await page.request.delete(`${DEVELOPMENT_URL}/api/v1/process-items/${id}`, { headers: { origin: DEVELOPMENT_URL } });
    expect(response.status()).toBe(204);
  }

  test('Edit, then Save: the dialog closes with no error in it, the warning names the rate, the list is read again and focus is on the heading', async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Edit ${name}` }));
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await dialog.getByLabel('Default value').fill('5.37');
    await deleteElsewhere(page, name);
    const listRead = page.waitForRequest((request) => request.method() === 'GET' && request.url().endsWith('/api/v1/process-items'));
    await dialog.getByRole('button', { name: 'Save' }).click();
    await listRead;
    await expectGone(page, name, `${name} no longer exists.`, 'It was deleted after you opened this list, so your changes were not saved. If you still need it, press Add rate.');
  });

  test('Delete, then Delete rate: the dialog closes, the information names the rate, the list is read again and focus is on the heading', async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Delete ${name}` }));
    const alert = page.getByRole('alertdialog', { name: `Delete ${name}?` });
    await deleteElsewhere(page, name);
    const listRead = page.waitForRequest((request) => request.method() === 'GET' && request.url().endsWith('/api/v1/process-items'));
    await alert.getByRole('button', { name: 'Delete rate' }).click();
    await listRead;
    await expectGone(page, name, `${name} was already deleted.`, 'It was deleted after you opened this list, so there was nothing to delete.');
  });
});

test.describe('search and states (AC-1, AC-8)', () => {
  test('filters by name ignoring letter case, says "No rate matches" with Clear filters, and Clear filters brings the list back and focuses the search', { tag: '@one-width' }, async ({ page }) => {
    await openProcessMaster(page);
    const search = page.getByLabel('Search');
    await search.fill('cutting-rate');
    await expect(rowOf(page, USED_RATE)).toBeVisible();
    await expect(rowOf(page, 'Foam Cost')).toHaveCount(0);

    await search.fill('zebra-nothing');
    const empty = page.getByRole('status').filter({ hasText: 'No rate matches "zebra-nothing"' });
    await expect(empty).toBeVisible();
    await empty.getByRole('button', { name: 'Clear filters' }).click();
    await expect(search).toHaveValue('');
    await expect(search).toBeFocused();
    await expect(rowOf(page, 'Foam Cost')).toBeVisible();
  });

  test('shows the skeleton after 300 ms while the list is read again, with the card busy, and the list when it arrives', async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    // A slow answer, held until the test lets it go (QLT-16): the skeleton shows after 300 ms of waiting (UX spec section 6.0 "States"),
    // and the test asserts it while the answer is held, so nothing depends on a fixed delay.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/v1/process-items', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await held;
      return route.continue();
    });
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Edit ${name}` }));
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await dialog.getByLabel('Default value').fill('4.37');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Loading the rates' })).toBeAttached();
    await expect(page.locator('main [aria-busy="true"]').first()).toBeAttached();
    release();
    await expect(rowOf(page, name)).toContainText('4.37');
    await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
  });

  test('shows "No rates yet" with Add rate visible when there is no rate, and Add rate still opens its dialog', async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    await page.route('**/api/v1/process-items', async (route) =>
      route.request().method() === 'GET' ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ processItems: [] }) }) : route.continue(),
    );
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Edit ${name}` }));
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await dialog.getByLabel('Default value').fill('4.37');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'No rates yet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add rate' })).toBeVisible();
    await pressWithKeyboard(page.getByRole('button', { name: 'Add rate' }));
    await expect(page.getByRole('dialog', { name: 'Add rate' })).toBeVisible();
  });

  test('shows the error state with "Try again" when the list cannot be read after a change, and Try again reads it', async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    let fail = true;
    await page.route('**/api/v1/process-items', async (route) => {
      if (route.request().method() === 'GET' && fail) return route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'The service is busy. Try again in a moment.', status: 503, code: 'DATABASE_BUSY', requestId: 'req-0a0b0c0d' }) });
      return route.continue();
    });
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Edit ${name}` }));
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await dialog.getByLabel('Default value').fill('3.37');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'We could not load the rates' })).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(rowOf(page, name)).toContainText('3.37');
  });

  test('DEF-020 (AQP-235) and QLT-01: when the list cannot be read after a save, focus is on the load error title; then Add and Escape return focus to "Add rate"', async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    await page.route('**/api/v1/process-items', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'busy', status: 503, code: 'DATABASE_BUSY', requestId: 'req-0a0b0c0d' }) });
    });
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Edit ${name}` }));
    const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
    await dialog.getByLabel('Default value').fill('3.37');
    await dialog.getByRole('button', { name: 'Save' }).click();
    const title = page.getByRole('heading', { name: 'We could not load the rates' });
    await expect(title).toBeVisible();
    await expect(title).toBeFocused({ timeout: 3000 });

    // The list is still in error and "Add rate" is still there: opening and cancelling it must not leave focus on the body.
    const add = page.getByRole('button', { name: 'Add rate' });
    await pressWithKeyboard(add);
    await expect(page.getByRole('dialog', { name: 'Add rate' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(add).toBeFocused({ timeout: 3000 });
  });
});
