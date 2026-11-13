import { expect, test, type Page } from '@playwright/test';

import { expectNoAxeViolations, horizontalOverflow, ROW_TARGET, TOUCH_TARGET } from './support/design-system';
import {
  ADD,
  addButton,
  DIFFERS,
  EMAIL_FORMAT,
  expectEveryRateSame,
  FAILED_WITH_FORM,
  FIRST_RATE,
  makeCustomer,
  type MadeCustomer,
  NAME_REQUIRED,
  NAME_TAKEN,
  newCustomerName,
  openCustomer,
  openCustomers,
  PERCENT_RATE,
  RATE_DECIMALS,
  rateInput,
  rateRow,
  rowOf,
  setRates,
  TITLE,
} from './support/customers';
import { ADMIN_STATE } from './support/servers';
import { afterOneFrame, BUSY, pressWithKeyboard, recordFocus } from './support/treatments';

/**
 * STORY-02.02 T5, T7 (AC-1, AC-2, AC-3, AC-8): SCR-12 "Customer master", the list, the Add customer dialog, the edit page and the reset dialog, at 360x800,
 * 768x1024 and 1366x768 on the development server, signed in as the E2E Admin (the saved browser state of the set-up project). No sideways scroll of the page
 * (the rates table scrolls inside its own container), axe 0 violations, targets of 44 px (36 px for the icon button of a table row), and create, edit and
 * reset working by keyboard: Enter opens the dialog on Customer name, Enter in the form saves, Escape closes, the reset is an alert dialog that starts on
 * "Keep current rates", and focus returns to the button that opened it.
 *
 * Each test works on customers it makes for itself through the API, so the three screen sizes and the retries never meet on one customer. Where focus goes
 * when a read is slow or fails, and that typing never moves it, is `customers-focus.spec.ts`; the table at eleven widths is `masters-table-actions.spec.ts`.
 * The audit entry, the rates written and the database are judged against PostgreSQL in `tests/integration/masters/customers.test.ts`. The words are the UX
 * spec's and the story's, written out in `support/customers.ts`. Names are invented.
 *
 * G7 fix round F2 (AQP-142): DEF-031 is covered by the AC-2, AC-8 test of the edit page (a 100-character name in one unbroken run: no sideways scroll on load
 * and under the Saved notice, at three widths); DEF-032 by the keyboard-save test (a failed Save puts focus on the notice alone, a good Save still returns it
 * to the Save button).
 */

test.use({ storageState: ADMIN_STATE });

/** A value that is not `current`, for a rate whose default is not known to the test. */
const otherThan = (current: string, ...choices: string[]): string => choices.find((choice) => Number(choice) !== Number(current)) ?? '1';

/**
 * The longest name the form accepts: 100 characters in one unbroken run (DEF-031). The hyphens of a test's name are removed, because a browser may break a
 * line after a hyphen and the longest run left (about 73 characters) would fit at 1366 px, so only 360 and 768 px would see the fault (QLT-10).
 */
const longNameOf = (name: string): string => name.replaceAll('-', '').padEnd(100, 'W');

/**
 * DEF-032: a save that fails (the server answers 503) puts focus on the notice and nowhere else (the whole sequence is read, not one look: a late move
 * would pass a single check), keeps what was typed, and the next save that is accepted still returns focus to the Save button.
 */
async function failASaveThenSaveAgain(page: Page, customer: MadeCustomer): Promise<void> {
  let failing = true;
  await page.route('**/api/v1/customers/*', (route) => (route.request().method() === 'PATCH' && failing ? route.fulfill(BUSY) : route.fallback()));
  await page.getByLabel('Address').fill('2 Invented Road');
  const save = page.getByRole('button', { name: 'Save customer' });
  await save.focus();
  const focusLog = await recordFocus(page);
  await save.press('Enter');
  const failed = page.getByRole('alert').filter({ hasText: 'We could not save the changes.' });
  await expect(failed).toBeVisible();
  await expect(failed.getByText(FAILED_WITH_FORM)).toBeVisible();
  await expect(failed.locator('xpath=..')).toBeFocused();
  await afterOneFrame(page);
  expect(focusLog).toHaveLength(1);
  expect(focusLog[0]).toContain('We could not save the changes.');
  await expect(page.getByLabel('Address')).toHaveValue('2 Invented Road');

  failing = false;
  await pressWithKeyboard(save);
  await expect(page.getByRole('status').filter({ hasText: `${customer.name} was saved.` })).toBeVisible();
  await expect(save).toBeFocused();
}

async function defaultOf(page: Page, rate: { readonly id: string }): Promise<string> {
  const text = (await rateRow(page, rate).getByRole('cell').nth(0).innerText()).replace(/[^\d.]/g, '');
  return text === '' ? '0' : text;
}

test.describe('the list (AC-1, AC-8)', () => {
  test('AC-1, AC-8: a customer is a row (a card on a phone) with its name and an Edit button named for it; no sideways scroll, axe 0 violations, targets of 44 px', async ({ page }, testInfo) => {
    const { name } = await makeCustomer(page, newCustomerName(testInfo));
    await openCustomers(page);
    await expect(page.getByLabel('Search')).toBeVisible();
    const row = rowOf(page, name);
    await expect(row).toContainText(name);
    await expect(row.getByRole('link')).toHaveCount(0);
    await expect(row.getByRole('button', { name: `Edit ${name}` })).toBeVisible();
    const width = page.viewportSize()?.width ?? 0;
    if (width >= 768) {
      await expect(page.getByRole('region', { name: 'Customers, scrollable' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Customer' })).toBeVisible();
      // The E-mail column is hidden below 1024 px; the same value is on the customer's page (ux-spec section 6.0, part 5).
      await expect(page.getByRole('columnheader', { name: 'E-mail' })).toBeVisible({ visible: width >= 1024 });
    } else {
      await expect(page.getByRole('list', { name: 'Customers' })).toBeVisible();
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    expect((await addButton(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    expect((await page.getByLabel('Search').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    const edit = await row.getByRole('button', { name: `Edit ${name}` }).boundingBox();
    expect(edit?.height ?? 0).toBeGreaterThanOrEqual(width >= 768 ? ROW_TARGET : TOUCH_TARGET);
  });
});

test.describe('add a customer (AC-1, AC-6, AC-8)', () => {
  test('by keyboard: Enter opens the dialog on Customer name, Escape closes it with focus back on the button; then a name alone is saved with Enter, the notice says so and the list shows it', async ({ page }, testInfo) => {
    const name = newCustomerName(testInfo);
    await openCustomers(page);
    const add = addButton(page);
    await pressWithKeyboard(add);
    const dialog = page.getByRole('dialog', { name: ADD });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Customer name')).toBeFocused();
    const box = await dialog.boundingBox();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(add).toBeFocused();

    await pressWithKeyboard(add);
    await expect(dialog.getByLabel('Customer name')).toBeFocused();
    await page.keyboard.type(`  ${name}  `);
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `${name} was added. Every rate starts at the current default. The change is in the audit log.` })).toBeVisible();
    await expect(rowOf(page, name)).toBeVisible();
    await expect(add).toBeFocused();
  });

  test('refuses an empty name, an e-mail address that does not look like one and a name that is taken (any letter case), in words under the field, with focus on the first message and nothing stored', async ({ page }, testInfo) => {
    const { name: existing } = await makeCustomer(page, newCustomerName(testInfo));
    await openCustomers(page);
    await pressWithKeyboard(addButton(page));
    const dialog = page.getByRole('dialog', { name: ADD });
    const submit = dialog.getByRole('button', { name: ADD });

    await submit.click();
    await expect(dialog.getByText(NAME_REQUIRED)).toBeVisible();
    await expect(dialog.getByLabel('Customer name')).toBeFocused();

    await dialog.getByLabel('Customer name').fill('E2E-never-stored');
    await dialog.getByLabel('E-mail').fill('not-an-address');
    await submit.click();
    await expect(dialog.getByText(EMAIL_FORMAT)).toBeVisible();
    await expect(dialog.getByLabel('E-mail')).toBeFocused();

    await dialog.getByLabel('E-mail').fill('buying@invented.example.test');
    await dialog.getByLabel('Customer name').fill(existing.toUpperCase());
    await submit.click();
    await expect(dialog.getByText(NAME_TAKEN)).toBeVisible();
    await expect(dialog.getByLabel('Customer name')).toBeFocused();
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(rowOf(page, 'E2E-never-stored')).toHaveCount(0);
  });
});

test.describe('the edit page (AC-1, AC-2, AC-8)', () => {
  test('AC-2, AC-8: the customer\'s page shows the details, every rate with its default, this customer\'s value and a status in words; no sideways scroll, axe 0 violations, targets of 44 px', async ({ page }, testInfo) => {
    const customer = await makeCustomer(page, newCustomerName(testInfo));
    await openCustomers(page);
    await rowOf(page, customer.name).getByRole('button', { name: `Edit ${customer.name}` }).click();
    await expect(page).toHaveURL(new RegExp(`/masters/customers/${customer.id}$`));
    await expect(page.getByRole('heading', { level: 1, name: customer.name })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: TITLE })).toBeVisible();
    await expect(page.getByText('Every rate is at its default.')).toBeVisible();
    for (const label of ['Customer name', 'Phone', 'E-mail', 'Address']) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    await expectEveryRateSame(page);
    await expect(page.getByText(DIFFERS)).toHaveCount(0);
    await expect(rateInput(page, customer, PERCENT_RATE)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    for (const control of [page.getByRole('button', { name: 'Save customer' }), page.getByRole('button', { name: 'Reset to defaults' }), rateInput(page, customer, FIRST_RATE), page.getByLabel('Phone')]) {
      expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }

    // DEF-031: the longest name the form accepts (100 characters in one unbroken run, no space or hyphen) wraps in the page title, on load and under a Saved notice that repeats it.
    const longCustomer = await makeCustomer(page, longNameOf(newCustomerName(testInfo)));
    await openCustomer(page, longCustomer);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await rateInput(page, longCustomer, FIRST_RATE).fill(otherThan(await defaultOf(page, FIRST_RATE), '8.5', '7.5'));
    await page.getByRole('button', { name: 'Save customer' }).click();
    await expect(page.getByRole('status').filter({ hasText: `${longCustomer.name} was saved.` })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('AC-2: a rate and the details are changed and saved by keyboard; the tag follows what is typed, the notice says it was saved, it survives a reload, and a save with nothing changed sends nothing', async ({ page }, testInfo) => {
    const customer = await makeCustomer(page, newCustomerName(testInfo));
    await openCustomer(page, customer);
    const first = rateInput(page, customer, FIRST_RATE);
    const percent = rateInput(page, customer, PERCENT_RATE);
    const typed = otherThan(await defaultOf(page, FIRST_RATE), '8.5', '7.5');
    const typedPercent = otherThan(await defaultOf(page, PERCENT_RATE), '12', '13');
    await first.fill(typed);
    await expect(rateRow(page, FIRST_RATE).getByText(DIFFERS)).toBeVisible();
    await percent.fill(typedPercent);
    await page.getByLabel('Phone').fill('+99 555 0142');
    await page.getByLabel('Address').fill('1 Invented Road');
    await pressWithKeyboard(page.getByRole('button', { name: 'Save customer' }));
    await expect(page.getByRole('status').filter({ hasText: `${customer.name} was saved.` })).toBeVisible();
    await expect(page.getByText('2 rates differ from the defaults.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save customer' })).toBeFocused();

    await page.reload();
    await expect(rateInput(page, customer, FIRST_RATE)).toHaveValue(Number(typed).toFixed(2));
    await expect(rateInput(page, customer, PERCENT_RATE)).toHaveValue(typedPercent);
    await expect(page.getByLabel('Phone')).toHaveValue('+99 555 0142');
    await expect(page.getByText(DIFFERS)).toHaveCount(2);

    let patches = 0;
    await page.route('**/api/v1/customers/*', (route) => {
      if (route.request().method() === 'PATCH') patches += 1;
      return route.continue();
    });
    await page.getByRole('button', { name: 'Save customer' }).click();
    await expect(page.getByText('Nothing to save.')).toBeVisible();
    expect(patches).toBe(0);

    await failASaveThenSaveAgain(page, customer);
  });

  test('AC-2: a rate with three decimals and a percent rate with three decimals are each refused under their own rate, in words, with focus on the first; a percent rate with one decimal is accepted; typing a fix saves', async ({ page }, testInfo) => {
    const customer = await makeCustomer(page, newCustomerName(testInfo));
    await openCustomer(page, customer);
    await rateInput(page, customer, FIRST_RATE).fill('1.234');
    await rateInput(page, customer, PERCENT_RATE).fill('11.555');
    await page.getByLabel('E-mail', { exact: true }).fill('not-an-address');
    await page.getByRole('button', { name: 'Save customer' }).click();
    await expect(rateRow(page, FIRST_RATE).getByText(RATE_DECIMALS)).toBeVisible();
    await expect(rateRow(page, PERCENT_RATE).getByText(RATE_DECIMALS)).toBeVisible();
    await expect(page.getByText(EMAIL_FORMAT)).toBeVisible();
    // The first control with a message in the order of the page is the e-mail address (the details come before the rates).
    await expect(page.getByLabel('E-mail', { exact: true })).toBeFocused();

    await page.getByLabel('E-mail', { exact: true }).fill('');
    await rateInput(page, customer, FIRST_RATE).fill('2.25');
    await rateInput(page, customer, PERCENT_RATE).fill('12.5');
    await page.getByRole('button', { name: 'Save customer' }).click();
    await expect(page.getByRole('status').filter({ hasText: `${customer.name} was saved.` })).toBeVisible();
    await expect(page.getByText(RATE_DECIMALS)).toHaveCount(0);
    await expect(rateInput(page, customer, PERCENT_RATE)).toHaveValue('12.50');
  });
});

test.describe('reset to defaults (AC-3, AC-8)', () => {
  test('by keyboard: the alert dialog names the rates it replaces and starts on "Keep current rates"; Escape changes nothing and focus returns to the button; confirming resets, says how many, and returns focus', async ({ page }, testInfo) => {
    const customer = await makeCustomer(page, newCustomerName(testInfo));
    await openCustomer(page, customer);
    await setRates(page, customer, { [FIRST_RATE.id]: '9.5', [PERCENT_RATE.id]: '30' });
    await page.reload();
    await expect(page.getByText(DIFFERS)).toHaveCount(2);
    const reset = page.getByRole('button', { name: 'Reset to defaults' });
    await pressWithKeyboard(reset);
    const dialog = page.getByRole('alertdialog', { name: `Reset ${customer.name} to defaults?` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep current rates' })).toBeFocused();
    const replaced = dialog.getByRole('list', { name: 'Rates that will be replaced' });
    await expect(replaced.getByRole('listitem')).toHaveCount(2);
    await expect(replaced).toContainText(`${FIRST_RATE.name} ₹ 9.50`);
    await expect(replaced).toContainText(`${PERCENT_RATE.name} 30.00 %`);
    await expectNoAxeViolations(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(reset).toBeFocused();
    await expect(page.getByText(DIFFERS)).toHaveCount(2);

    await pressWithKeyboard(reset);
    await dialog.getByRole('button', { name: 'Reset to defaults' }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: `${customer.name} was reset to the defaults. 2 rates were replaced.` })).toBeVisible();
    await expectEveryRateSame(page);
    await expect(reset).toBeFocused();
    await page.reload();
    await expect(page.getByText('Every rate is at its default.')).toBeVisible();
  });

  test('Keep current rates changes nothing, and a customer already at its defaults is told so', async ({ page }, testInfo) => {
    const customer = await makeCustomer(page, newCustomerName(testInfo));
    await openCustomer(page, customer);
    await setRates(page, customer, { [FIRST_RATE.id]: '9.5' });
    await page.reload();
    await page.getByRole('button', { name: 'Reset to defaults' }).click();
    const dialog = page.getByRole('alertdialog', { name: `Reset ${customer.name} to defaults?` });
    await dialog.getByRole('button', { name: 'Keep current rates' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(DIFFERS)).toHaveCount(1);

    await page.getByRole('button', { name: 'Reset to defaults' }).click();
    await dialog.getByRole('button', { name: 'Reset to defaults' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: '1 rate was replaced.' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset to defaults' }).click();
    await expect(dialog.getByText(/All \d+ rates already equal the current Process master values, so no saved value will be replaced\./)).toBeVisible();
    // One accessible description holds both paragraphs (ux-spec v0.25).
    await expect(dialog).toHaveAccessibleDescription(
      /so no saved value will be replaced\..*A rate value you have typed on this page and not yet saved is replaced too\. The details \(name, phone, e-mail, address\) stay as typed\./,
    );
    await dialog.getByRole('button', { name: 'Reset to defaults' }).click();
    await expect(page.getByText(`${customer.name} is already at the defaults.`)).toBeVisible();
    await expect(page.getByText('Every saved rate already equals its current default, so no saved value was replaced. The rate boxes show the defaults.')).toBeVisible();
  });

  test('a rate typed and not saved is replaced by a reset, and the details typed stay (ux-spec v0.25)', async ({ page }, testInfo) => {
    const customer = await makeCustomer(page, newCustomerName(testInfo));
    await openCustomer(page, customer);
    const defaultRate = await rateInput(page, customer, FIRST_RATE).inputValue();
    await rateInput(page, customer, FIRST_RATE).fill(otherThan(defaultRate, '8.5', '7.5'));
    await page.getByLabel('Phone').fill('+99 555 0142');
    await page.getByRole('button', { name: 'Reset to defaults' }).click();
    const dialog = page.getByRole('alertdialog', { name: `Reset ${customer.name} to defaults?` });
    await expect(dialog).toHaveAccessibleDescription(/A rate value you have typed on this page and not yet saved is replaced too\./);
    await dialog.getByRole('button', { name: 'Reset to defaults' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(`${customer.name} is already at the defaults.`)).toBeVisible();
    await expect(rateInput(page, customer, FIRST_RATE)).toHaveValue(defaultRate);
    await expect(page.getByLabel('Phone')).toHaveValue('+99 555 0142');
  });
});
