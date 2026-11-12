import { expect, test, type Locator, type Page } from '@playwright/test';

import { ScriptGate } from './support/lazy-load';
import {
  CHECK_YOUR_CONNECTION,
  CONFIRMATION_DID_NOT_OPEN,
  FORM_DID_NOT_OPEN,
  makeMaterial,
  openMaterials,
  openProcessMaster,
  OTHER_SEED_RATE,
  rowButton,
  SEED_RATE,
} from './support/masters';
import { ADMIN_STATE } from './support/servers';

/**
 * GitHub issue 277 (QLT-01 of the G6 of tech-debt 245, DL-162 (5)): what the Process master (SCR-11) and the Materials tab (SCR-13) do around the
 * first open of their dialogs. The dialogs are not in the first load of the page; the first press fetches their code (architecture section 10,
 * AQP-188), and two shared pieces wrap that for every masters screen: `useDialogOpener` (the pressed button, and the rule that a second press while the
 * code loads does nothing) and `MasterDialogsFailed` (the notice when the code did not arrive). At 360x800, 768x1024 and 1366x768 on the development
 * server, signed in as the E2E Admin, with the scripts held or refused by `ScriptGate` once the page is quiet.
 *
 * Written from the UX spec, section 7.3.1 rule 11 and SCR-25 "Controls in the page content", and SCR-14 "A dialog that does not open":
 *   - the code does not arrive: a danger notice with `role="alert"` at the top of the page content, titled "The form did not open." for a form (Add,
 *     Edit) and "The confirmation did not open." for a confirmation (Delete), with the sentence "Check your connection and try again."; the pressed
 *     button is back at rest; the next press asks again and clears the notice;
 *   - the code is slow: the pressed button is `aria-busy` with its pressed look held and stays enabled; a second press, on it or on any other button
 *     of the page that opens the dialogs, does nothing: no second request, no second target, and the dialog opens for the first press.
 * Each screen has one test that goes from the failure to the slow open, so the page is opened once. The Process test only presses seed rates and never
 * saves or deletes them; the Materials test works on a material it makes for itself. Names and numbers are invented (`n.37`, ADR-014).
 */

test.use({ storageState: ADMIN_STATE });

/** The notice of a dialog that did not open: the page's `alert`, not the route announcer's. */
const noticeOf = (page: Page): Locator => page.getByRole('main').getByRole('alert').filter({ hasText: 'did not open' });

/** Presses `button` and waits until the press has been acted on (the code was asked for again), so a notice read next cannot be the one left from before. */
async function pressAndWaitForRequest(gate: ScriptGate, button: Locator): Promise<void> {
  const before = gate.urls.length;
  await button.click();
  await expect.poll(() => gate.urls.length, { message: 'the press asked for the dialogs\' code' }).toBeGreaterThan(before);
}

async function expectNotice(page: Page, title: string): Promise<void> {
  const notice = noticeOf(page);
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText(title);
  await expect(notice).toContainText(CHECK_YOUR_CONNECTION);
}

/**
 * The code is slow: `first` is pressed, then `others` and `first` again. Only `first` is pending, nobody asked for the code twice, and when the code
 * arrives the dialog is the one `first` opens; Escape closes it and focus returns to `first`.
 */
async function expectSecondPressesDoNothing(page: Page, gate: ScriptGate, first: Locator, others: ReadonlyArray<Locator>, dialogName: string): Promise<void> {
  gate.mode = 'hold';
  const before = gate.urls.length;
  await first.click();
  await expect(first).toHaveAttribute('aria-busy', 'true');
  await expect(first).toBeEnabled();
  await expect(noticeOf(page), 'pressing again clears the notice').toHaveCount(0);
  for (const other of others) await other.click();
  await first.click();
  await expect(first, 'the first press is still the pending one').toHaveAttribute('aria-busy', 'true');
  for (const other of others) await expect(other, 'a second press does not move the pending look').not.toHaveAttribute('aria-busy', 'true');
  const requested = gate.urls.slice(before);
  expect(new Set(requested).size, 'no script was requested twice').toBe(requested.length);

  gate.release();
  const dialog = page.getByRole('dialog', { name: dialogName });
  await expect(dialog, 'the dialog is the one the first press asked for').toBeVisible();
  // While the dialog is open the rest of the page is hidden from the accessibility tree, so the button is looked at once it is closed.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(first, 'the pending look is gone once the dialog has opened').not.toHaveAttribute('aria-busy', 'true');
  await expect(first, 'focus returns to the button that was pressed first').toBeFocused();
}

test('SCR-11: a form and a confirmation that do not open say so with their own title; a second press while the code is slow does nothing', async ({ page }) => {
  await openProcessMaster(page);
  // Everything the first load needs has arrived; from here on, the code of the dialogs is the only script the page asks for.
  await page.waitForLoadState('networkidle');
  const gate = new ScriptGate();
  await gate.install(page);
  const add = page.getByRole('button', { name: 'Add rate' });
  const edit = rowButton(page, SEED_RATE, 'Edit');
  const otherEdit = rowButton(page, OTHER_SEED_RATE, 'Edit');

  // The titles alternate, so a notice left from the press before can never be the one that satisfies the next check.
  gate.mode = 'fail';
  await pressAndWaitForRequest(gate, add);
  await expectNotice(page, FORM_DID_NOT_OPEN);
  await expect(add, 'the pressed button is back at rest').not.toHaveAttribute('aria-busy', 'true');
  await pressAndWaitForRequest(gate, rowButton(page, SEED_RATE, 'Delete'));
  await expectNotice(page, CONFIRMATION_DID_NOT_OPEN);
  await expect(noticeOf(page)).not.toContainText(FORM_DID_NOT_OPEN);
  await pressAndWaitForRequest(gate, edit);
  await expectNotice(page, FORM_DID_NOT_OPEN);
  await expect(noticeOf(page)).not.toContainText(CONFIRMATION_DID_NOT_OPEN);

  await expectSecondPressesDoNothing(page, gate, edit, [otherEdit, add], `Edit ${SEED_RATE}`);
});

test('SCR-13: a form that does not open says so; a second press while the code is slow does nothing (Materials)', async ({ page }, testInfo) => {
  const name = await makeMaterial(page, testInfo);
  await openMaterials(page);
  await page.waitForLoadState('networkidle');
  const gate = new ScriptGate();
  await gate.install(page);
  const add = page.getByRole('button', { name: 'Add material' });
  const edit = rowButton(page, name, 'Edit');

  gate.mode = 'fail';
  await pressAndWaitForRequest(gate, add);
  await expectNotice(page, FORM_DID_NOT_OPEN);
  await expect(add, 'the pressed button is back at rest').not.toHaveAttribute('aria-busy', 'true');
  await pressAndWaitForRequest(gate, edit);
  await expectNotice(page, FORM_DID_NOT_OPEN);
  await expect(edit, 'the pressed button is back at rest').not.toHaveAttribute('aria-busy', 'true');

  await expectSecondPressesDoNothing(page, gate, edit, [add], `Edit ${name}`);
});
