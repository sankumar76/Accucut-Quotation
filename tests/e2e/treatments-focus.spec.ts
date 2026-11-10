import { randomBytes } from 'node:crypto';

import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

import { horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE } from './support/servers';
import {
  afterOneFrame,
  BUSY,
  FAILED_PLAIN,
  FAILED_WITH_FORM,
  failListWhen,
  LOAD_ERROR_TITLE,
  lockedRow,
  makeTreatment,
  NAME_REQUIRED,
  NAME_RESERVED,
  newTreatmentName,
  openTreatments,
  pressWithKeyboard,
  recordFocus,
  rowOf,
  SAVED_BUT_NOT_SHOWN,
  TAB,
  TITLE,
} from './support/treatments';

/**
 * STORY-02.05 T5 (AC-8; DL-135, DL-122 condition B, the DEF-020 guard): where focus goes on the Treatment / Color tab, what a failed write says, and
 * the table's own measures. At 360x800, 768x1024 and 1366x768 on the development server, signed in as the E2E Admin.
 *
 *   - Focus moves only on a refusal (DL-135): after a refusal, typing keeps focus in the field and every letter there. The form has one field, so the
 *     refusal that names two fields of the other masters' dialogs cannot be made here; both kinds of refusal of the one field are typed into, the whole
 *     focus sequence is recorded, and `tests/unit/treatments-focus-rule.test.ts` holds the source to the rule.
 *   - DEF-020: an add, a rename and a delete each succeed and the read after them answers 503; the load error's title has focus and keeps it.
 *   - A failed write never says "Nothing was changed." (ux-spec v0.21, section 6.0).
 *
 * Each test works on treatments it makes for itself. The words are written out in `support/treatments.ts`.
 */

test.use({ storageState: ADMIN_STATE });

const LOAD_ERROR_SENTENCE = 'Check your connection and try again. Nothing was changed.';

test.describe('focus moves only on a refusal (DL-135)', () => {
  test('after the screen refuses an empty name, typing keeps focus in the field and every letter there; no element takes focus while typing', async ({ page }) => {
    await openTreatments(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add treatment' }));
    const dialog = page.getByRole('dialog', { name: 'Add treatment' });
    await dialog.getByRole('button', { name: 'Add treatment' }).click();
    await expect(dialog.getByText(NAME_REQUIRED)).toBeVisible();
    await expect(dialog.getByLabel('Name')).toBeFocused();

    const focusLog = await recordFocus(page);
    await page.keyboard.type('abcdef');
    await expect(dialog.getByLabel('Name')).toBeFocused();
    await expect(dialog.getByLabel('Name')).toHaveValue('abcdef');
    await expect(dialog.getByText(NAME_REQUIRED)).toHaveCount(0);
    await afterOneFrame(page);
    expect(focusLog).toEqual([]);
  });

  test('after the server refuses a name, typing a fix keeps focus in the field and every letter there; no element takes focus while typing', async ({ page }) => {
    await openTreatments(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add treatment' }));
    const dialog = page.getByRole('dialog', { name: 'Add treatment' });
    await dialog.getByLabel('Name').fill('other');
    await dialog.getByRole('button', { name: 'Add treatment' }).click();
    await expect(dialog.getByText(NAME_RESERVED)).toBeVisible();
    await expect(dialog.getByLabel('Name')).toBeFocused();

    const focusLog = await recordFocus(page);
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('uvwxyz');
    await expect(dialog.getByLabel('Name')).toBeFocused();
    await expect(dialog.getByLabel('Name')).toHaveValue('uvwxyz');
    await expect(dialog.getByText(NAME_RESERVED)).toHaveCount(0);
    await afterOneFrame(page);
    expect(focusLog).toEqual([]);
  });

  test('a refusal moves focus to the field even when it was somewhere else (the focus request is made by the refusal, nothing else)', async ({ page }) => {
    await openTreatments(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add treatment' }));
    const dialog = page.getByRole('dialog', { name: 'Add treatment' });
    await dialog.getByLabel('Name').fill('Not applicable');
    await dialog.getByRole('button', { name: 'Cancel' }).focus();
    await dialog.getByRole('button', { name: 'Add treatment' }).click();
    await expect(dialog.getByText(NAME_RESERVED)).toBeVisible();
    await expect(dialog.getByLabel('Name')).toBeFocused();
  });
});

test.describe('a failed write (ux-spec v0.21, section 6.0)', () => {
  test('a failed add says so in a notice at the top of the dialog, keeps the typed name, and never says "Nothing was changed."', async ({ page }, testInfo) => {
    const name = newTreatmentName(testInfo);
    await page.route('**/api/v1/treatments', (route) => (route.request().method() === 'POST' ? route.fulfill(BUSY) : route.fallback()));
    await openTreatments(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add treatment' }));
    const dialog = page.getByRole('dialog', { name: 'Add treatment' });
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByRole('button', { name: 'Add treatment' }).click();
    await expect(dialog.getByText('We could not add the treatment.')).toBeVisible();
    await expect(dialog.getByText(FAILED_WITH_FORM)).toBeVisible();
    await expect(page.getByText('Nothing was changed.')).toHaveCount(0);
    await expect(dialog.getByLabel('Name')).toHaveValue(name);
    await expect(dialog).toBeVisible();
  });

  test('a failed rename says so, keeps the typed name, and never says "Nothing was changed."', async ({ page }, testInfo) => {
    const { name } = await makeTreatment(page, newTreatmentName(testInfo));
    await page.route('**/api/v1/treatments/*', (route) => (route.request().method() === 'PATCH' ? route.fulfill(BUSY) : route.fallback()));
    await openTreatments(page);
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Rename ${name}` }));
    const dialog = page.getByRole('dialog', { name: `Rename ${name}` });
    await dialog.getByLabel('Name').fill(`${name}-x`);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByText('We could not save the changes.')).toBeVisible();
    await expect(dialog.getByText(FAILED_WITH_FORM)).toBeVisible();
    await expect(page.getByText('Nothing was changed.')).toHaveCount(0);
    await expect(dialog.getByLabel('Name')).toHaveValue(`${name}-x`);
  });

  test('a failed delete says so in the dialog with the sentence for a write with nothing typed, and never says "Nothing was changed."', async ({ page }, testInfo) => {
    const { name } = await makeTreatment(page, newTreatmentName(testInfo));
    await page.route('**/api/v1/treatments/*', (route) => (route.request().method() === 'DELETE' ? route.fulfill(BUSY) : route.fallback()));
    await openTreatments(page);
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Delete ${name}` }));
    const dialog = page.getByRole('alertdialog', { name: `Delete ${name}?` });
    await dialog.getByRole('button', { name: 'Delete treatment' }).click();
    await expect(dialog.getByText('We could not delete the treatment.')).toBeVisible();
    await expect(dialog.getByText(FAILED_PLAIN)).toBeVisible();
    await expect(page.getByText('Nothing was changed.')).toHaveCount(0);
    await expect(rowOf(page, name)).toHaveCount(1);
  });
});

/**
 * DEF-020: after the dialog's change succeeded and the read that follows answered 503, the load error is on the page with focus on its title, the
 * page heading never took focus, the sequence of elements that took focus ends on the title, and a poll finds it still there. The success notice is on
 * the page beside the error, whose sentence does not say that nothing was changed.
 */
async function expectErrorTitleHoldsFocus(page: Page, focusLog: ReadonlyArray<string>, notice: string): Promise<void> {
  const title = page.getByRole('heading', { name: LOAD_ERROR_TITLE });
  await expect(title).toBeVisible();
  await afterOneFrame(page);
  expect(focusLog).toContain(`H2:${LOAD_ERROR_TITLE}`);
  expect(focusLog.filter((entry) => entry.startsWith('H1:'))).toEqual([]);
  expect(focusLog.at(-1)).toBe(`H2:${LOAD_ERROR_TITLE}`);
  await expect(title).toBeFocused();
  // Polled at the three widths of the projects (360, 768 and 1366 px): the element with focus is the title, and stays it.
  await expect.poll(() => page.evaluate(() => document.activeElement?.textContent ?? ''), { message: 'focus stays on the error title' }).toBe(LOAD_ERROR_TITLE);
  await expect(page.getByRole('status').filter({ hasText: notice })).toBeVisible();
  await expect(page.getByText(SAVED_BUT_NOT_SHOWN)).toBeVisible();
  await expect(page.getByText('Nothing was changed.')).toHaveCount(0);
}

async function expectTryAgainBringsTheListBack(page: Page, fail: { value: boolean }): Promise<void> {
  fail.value = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(lockedRow(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: LOAD_ERROR_TITLE })).toHaveCount(0);
}

test.describe('DEF-020 guard: a change succeeds and the read after it fails', () => {
  test('add: focus is on the error title, not on the page heading, and stays there; Try again brings the list back', async ({ page }, testInfo) => {
    const name = newTreatmentName(testInfo);
    await openTreatments(page);
    const fail = await failListWhen(page);
    await pressWithKeyboard(page.getByRole('button', { name: 'Add treatment' }));
    const dialog = page.getByRole('dialog', { name: 'Add treatment' });
    await dialog.getByLabel('Name').fill(name);
    fail.value = true;
    const focusLog = await recordFocus(page);
    await dialog.getByRole('button', { name: 'Add treatment' }).click();
    await expectErrorTitleHoldsFocus(page, focusLog, `${name} was added.`);
    await expectTryAgainBringsTheListBack(page, fail);
    await expect(rowOf(page, name)).toBeVisible();
  });

  test('rename: focus is on the error title, not on the page heading, and stays there; Try again brings the list back', async ({ page }, testInfo) => {
    const { name } = await makeTreatment(page, newTreatmentName(testInfo));
    const renamed = `${name}-renamed`;
    await openTreatments(page);
    const fail = await failListWhen(page);
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Rename ${name}` }));
    const dialog = page.getByRole('dialog', { name: `Rename ${name}` });
    await dialog.getByLabel('Name').fill(renamed);
    fail.value = true;
    const focusLog = await recordFocus(page);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expectErrorTitleHoldsFocus(page, focusLog, `${name} was renamed to ${renamed}.`);
    await expectTryAgainBringsTheListBack(page, fail);
    await expect(rowOf(page, renamed)).toBeVisible();
  });

  test('delete: focus is on the error title, not on the page heading, and stays there; Try again brings the list back without the row', async ({ page }, testInfo) => {
    const { name } = await makeTreatment(page, newTreatmentName(testInfo));
    await openTreatments(page);
    const fail = await failListWhen(page);
    await pressWithKeyboard(rowOf(page, name).getByRole('button', { name: `Delete ${name}` }));
    const dialog = page.getByRole('alertdialog', { name: `Delete ${name}?` });
    fail.value = true;
    const focusLog = await recordFocus(page);
    await dialog.getByRole('button', { name: 'Delete treatment' }).click();
    await expectErrorTitleHoldsFocus(page, focusLog, `${name} was deleted.`);
    await expectTryAgainBringsTheListBack(page, fail);
    await expect(rowOf(page, name)).toHaveCount(0);
  });
});

test.describe('the latest read wins (QLT-04)', () => {
  test('a first read that answers after the list was read again does not bring the older list back', async ({ page }, testInfo) => {
    const name = newTreatmentName(testInfo);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let delivered: () => void = () => undefined;
    const firstDelivered = new Promise<void>((resolve) => {
      delivered = resolve;
    });
    let firstRead = true;
    await page.route('**/api/v1/treatments', async (route: Route) => {
      if (route.request().method() !== 'GET' || !firstRead) return route.continue();
      firstRead = false;
      // The older list is fetched now, before the add, and handed to the page only after the add and the read that follows it.
      const older = await route.fetch();
      await gate;
      await route.fulfill({ response: older });
      delivered();
    });
    await page.goto('/masters/materials');
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await waitUntilHydrated(page, 'main button[data-action="add"]');
    await page.getByRole('tab', { name: TAB }).click();
    const add = page.getByRole('button', { name: 'Add treatment' });
    await pressWithKeyboard(add);
    const dialog = page.getByRole('dialog', { name: 'Add treatment' });
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByRole('button', { name: 'Add treatment' }).click();
    await expect(rowOf(page, name)).toBeVisible();
    await expect(add).toBeFocused();

    release();
    await firstDelivered;
    await afterOneFrame(page);
    await afterOneFrame(page);
    await expect(rowOf(page, name)).toBeVisible();
    await expect(add).toBeFocused();
  });
});

test.describe('loading and the load error (AC-8)', () => {
  test('a slow read shows the skeleton with a polite "Loading the treatments" and then the list', async ({ page }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/v1/treatments', async (route: Route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await gate;
      return route.continue();
    });
    await page.goto('/masters/materials');
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await waitUntilHydrated(page, 'main button[data-action="add"]');
    await page.getByRole('tab', { name: TAB }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Loading the treatments' })).toBeAttached();
    await expect(lockedRow(page)).toHaveCount(0);
    release();
    await expect(lockedRow(page)).toBeVisible();
  });

  test('when the first read fails, "We could not load the treatments" takes focus with the read-only sentence, and Try again brings the list', async ({ page }) => {
    const fail = await failListWhen(page);
    fail.value = true;
    await page.goto('/masters/materials');
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await waitUntilHydrated(page, 'main button[data-action="add"]');
    await page.getByRole('tab', { name: TAB }).click();
    const title = page.getByRole('heading', { name: LOAD_ERROR_TITLE });
    await expect(title).toBeVisible();
    await expect(title).toBeFocused();
    await expect(page.getByText(LOAD_ERROR_SENTENCE)).toBeVisible();
    await expectTryAgainBringsTheListBack(page, fail);
  });
});

/** The row of the long name and its Rename and Delete buttons. */
function actionsOf(page: Page, name: string): { readonly rename: Locator; readonly del: Locator } {
  return { rename: rowOf(page, name).getByRole('button', { name: `Rename ${name}` }), del: rowOf(page, name).getByRole('button', { name: `Delete ${name}` }) };
}

test.describe('the Actions column (ux-spec section 6.0, DL-122 condition B)', () => {
  test('from 768 px the two buttons are 8 px apart on one line, and the Actions column is 112 px wide', async ({ page }, testInfo) => {
    test.skip((testInfo.project.use.viewport?.width ?? 0) < 768, 'below 768 px the list is cards');
    const { name } = await makeTreatment(page, newTreatmentName(testInfo));
    await openTreatments(page);
    const { rename, del } = actionsOf(page, name);
    const first = await rename.boundingBox();
    const second = await del.boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second?.y ?? 0).toBeCloseTo(first?.y ?? 0, 0);
    expect((second?.x ?? 0) - ((first?.x ?? 0) + (first?.width ?? 0))).toBeCloseTo(8, 0);
    const head = await page.getByRole('columnheader', { name: 'Actions' }).boundingBox();
    expect(head?.width ?? 0).toBeCloseTo(112, 0);
  });

  test('(e) with the table forced wider than its region, a Tab from the last row\'s Rename lands on its Delete, which is not under the sticky column, and the page did not move sideways', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the test sets its own width, so one project runs it');
    const name = `E2E-last-${testInfo.retry}-${testInfo.repeatEachIndex}-${randomBytes(3).toString('hex')}-`.padEnd(100, 'W');
    await page.setViewportSize({ width: 1024, height: 900 });
    await makeTreatment(page, name);
    await openTreatments(page);
    const region = page.getByRole('region', { name: 'Treatment / Color, scrollable' });
    await region.locator('table').evaluate((table) => {
      table.style.minWidth = '1400px';
    });
    expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth), 'the forced table scrolls').toBe(true);
    const { rename, del } = actionsOf(page, name);
    // The row of the long name is the last row only if no other test added one since; the Tab goes from this row's Rename to its Delete either way.
    await rename.focus();
    await page.keyboard.press('Tab');
    await expect(del).toBeFocused();
    const box = await del.boundingBox();
    const regionBox = await region.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((regionBox?.x ?? 0) + (regionBox?.width ?? 0));
    expect(box?.x ?? 0).toBeGreaterThanOrEqual(regionBox?.x ?? 0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
