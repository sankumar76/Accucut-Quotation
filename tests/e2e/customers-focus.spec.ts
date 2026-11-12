import { expect, test, type Page, type Route } from '@playwright/test';

import {
  ADD,
  addButton,
  EMAIL_FORMAT,
  failListWhen,
  FIRST_RATE,
  LOAD_ERROR_TITLE,
  makeCustomer,
  NAME_REQUIRED,
  newCustomerName,
  openCustomer,
  openCustomers,
  PERCENT_RATE,
  RATE_DECIMALS,
  RATE_WHOLE,
  rateInput,
  rowOf,
  SAVED_BUT_NOT_SHOWN,
} from './support/customers';
import { ADMIN_STATE } from './support/servers';
import { afterOneFrame, BUSY, pressWithKeyboard, recordFocus } from './support/treatments';

/**
 * STORY-02.02 T7 (AC-8; DL-135, DL-150 (8), the DEF-020 guard): where focus goes on SCR-12, at 360x800, 768x1024 and 1366x768 on the development server,
 * signed in as the E2E Admin.
 *
 *   - Focus moves only on a refusal (DL-135): a refusal that names two fields, then typing in the first. The whole focus sequence is recorded, because a
 *     single look at `document.activeElement` passes for a fault that takes focus a moment after the error appeared. The Add customer dialog and the
 *     customer's page each have one such test. This is the two-field case that the Treatment / Color form (one field) cannot make.
 *   - The list is read again after an add (the shared `useReadAgain` of `useMasterList`, DL-153), and where focus goes depends on that read. It is slow here
 *     (the answer is held back) and it fails here (503), the two branches of the read: it settles ready, and focus returns to the button that opened the
 *     dialog and not to the page heading; it fails, and the load error's title takes focus and keeps it (DEF-020), whatever the dialog's close handler does.
 *     Each fails if the shared hook sends focus to the heading after a good read, or to the opener after a failed one.
 *
 * Each test works on customers it makes for itself. The words are written out in `support/customers.ts`.
 */

test.use({ storageState: ADMIN_STATE });

test.describe('focus moves only on a refusal (DL-135)', () => {
  test('in the Add customer dialog: after a refusal naming Customer name and E-mail, typing in the first keeps focus there and every letter; no element takes focus while typing', async ({ page }) => {
    await openCustomers(page);
    await pressWithKeyboard(addButton(page));
    const dialog = page.getByRole('dialog', { name: ADD });
    await dialog.getByLabel('E-mail').fill('not-an-address');
    await dialog.getByRole('button', { name: ADD }).click();
    await expect(dialog.getByText(NAME_REQUIRED)).toBeVisible();
    await expect(dialog.getByText(EMAIL_FORMAT)).toBeVisible();
    await expect(dialog.getByLabel('Customer name')).toBeFocused();

    const focusLog = await recordFocus(page);
    await page.keyboard.type('abcdef');
    await expect(dialog.getByLabel('Customer name')).toBeFocused();
    await expect(dialog.getByLabel('Customer name')).toHaveValue('abcdef');
    await expect(dialog.getByText(NAME_REQUIRED)).toHaveCount(0);
    // Typing clears the message of the field typed in, and only that one: the other message stays, and focus did not go to its field.
    await expect(dialog.getByText(EMAIL_FORMAT)).toBeVisible();
    await afterOneFrame(page);
    expect(focusLog).toEqual([]);
  });

  test("on the customer's page: after a refusal naming two rates, typing in the first keeps focus there and every letter; no element takes focus while typing", async ({ page }, testInfo) => {
    const customer = await makeCustomer(page, newCustomerName(testInfo));
    await openCustomer(page, customer);
    const first = rateInput(page, customer, FIRST_RATE);
    await first.fill('1.234');
    await rateInput(page, customer, PERCENT_RATE).fill('11.5');
    await page.getByRole('button', { name: 'Save customer' }).click();
    await expect(page.getByText(RATE_DECIMALS)).toBeVisible();
    await expect(page.getByText(RATE_WHOLE)).toBeVisible();
    await expect(first).toBeFocused();

    const focusLog = await recordFocus(page);
    await first.press('ControlOrMeta+A');
    await page.keyboard.type('2.5');
    await expect(first).toBeFocused();
    await expect(first).toHaveValue('2.5');
    await expect(page.getByText(RATE_DECIMALS)).toHaveCount(0);
    await expect(page.getByText(RATE_WHOLE)).toBeVisible();
    await afterOneFrame(page);
    expect(focusLog).toEqual([]);
  });
});

/** A gate that holds back the read of the list until the test lets it go. */
function aGate(): { readonly release: () => void; readonly passed: Promise<void> } {
  let release: () => void = () => undefined;
  const passed = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { release, passed };
}

async function addByKeyboard(page: Page, name: string): Promise<void> {
  await pressWithKeyboard(addButton(page));
  const dialog = page.getByRole('dialog', { name: ADD });
  await expect(dialog.getByLabel('Customer name')).toBeFocused();
  await page.keyboard.type(name);
  await dialog.getByRole('button', { name: ADD }).click();
}

test.describe('the read after an add (DL-153, DEF-020)', () => {
  test('a slow read that settles: focus is not taken while it waits, and when the list is back it returns to "Add customer", never to the page heading', async ({ page }, testInfo) => {
    const name = newCustomerName(testInfo);
    await openCustomers(page);
    const gate = aGate();
    await page.route('**/api/v1/customers', async (route: Route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await gate.passed;
      return route.continue();
    });
    const focusLog = await recordFocus(page);
    await addByKeyboard(page, name);
    await expect(page.getByRole('status').filter({ hasText: `${name} was added.` })).toBeVisible();
    // The list is being read: nothing has taken focus yet, in particular not the page heading.
    await afterOneFrame(page);
    expect(focusLog.filter((entry) => entry.startsWith('H1:'))).toEqual([]);
    await expect(rowOf(page, name)).toHaveCount(0);

    gate.release();
    await expect(rowOf(page, name)).toBeVisible();
    const add = addButton(page);
    await expect(add).toBeFocused();
    await afterOneFrame(page);
    expect(focusLog.filter((entry) => entry.startsWith('H1:'))).toEqual([]);
    expect(focusLog.at(-1)).toBe(`BUTTON:${ADD}`);
  });

  test('a read that fails after the add succeeded: the error title has focus and keeps it, the heading never took it, the notice says the customer was added, and Try again brings the list back', async ({ page }, testInfo) => {
    const name = newCustomerName(testInfo);
    await openCustomers(page);
    const fail = await failListWhen(page, BUSY);
    fail.value = true;
    // CONTROL (reviewer-quality): hold the failing read until the Add dialog has closed, as the #244 slow-read failure tests do.
    const gate = aGate();
    await page.route('**/api/v1/customers', async (route: Route) => {
      if (route.request().method() === 'GET') await gate.passed;
      return route.fallback();
    });
    const focusLog = await recordFocus(page);
    await addByKeyboard(page, name);
    await expect(page.getByRole('dialog', { name: ADD })).toHaveCount(0);
    await afterOneFrame(page);
    // CONTROL (reviewer-quality): everything that takes focus from here on is the answer to the failed read.
    const fromTheRead = focusLog.length;
    gate.release();

    const title = page.getByRole('heading', { name: LOAD_ERROR_TITLE });
    await expect(title).toBeVisible();
    await afterOneFrame(page);
    expect(focusLog).toContain(`H2:${LOAD_ERROR_TITLE}`);
    expect(focusLog.filter((entry) => entry.startsWith('H1:'))).toEqual([]);
    expect(focusLog.at(-1)).toBe(`H2:${LOAD_ERROR_TITLE}`);
    await expect(title).toBeFocused();
    // CONTROL (reviewer-quality): after the failed read only the error title took focus: not the Add button, not the heading.
    expect(focusLog.slice(fromTheRead).filter((entry) => entry !== `H2:${LOAD_ERROR_TITLE}`)).toEqual([]);
    // Polled at the three widths of the projects (360, 768 and 1366 px): the element with focus is the title, and stays it.
    await expect.poll(() => page.evaluate(() => document.activeElement?.textContent ?? ''), { message: 'focus stays on the error title' }).toBe(LOAD_ERROR_TITLE);
    await expect(page.getByRole('status').filter({ hasText: `${name} was added.` })).toBeVisible();
    await expect(page.getByText(SAVED_BUT_NOT_SHOWN)).toBeVisible();
    await expect(page.getByText('Nothing was changed.')).toHaveCount(0);

    fail.value = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(rowOf(page, name)).toBeVisible();
    await expect(page.getByRole('heading', { name: LOAD_ERROR_TITLE })).toHaveCount(0);
  });
});
