import { expect, test, type Page } from '@playwright/test';

import { ADMIN_STATE } from './support/servers';
import {
  expectLoadErrorHoldsFocus,
  expectSavedNotShown,
  gateListReads,
  type ListGate,
  makeMaterial,
  makeRate,
  MATERIALS_LIST_PATH,
  MATERIALS_LOAD_ERROR,
  MATERIALS_LOADING,
  openMaterials,
  openProcessMaster,
  PROCESS_LIST_PATH,
  PROCESS_LOAD_ERROR,
  PROCESS_LOADING,
  pressWithKeyboard,
  rowButton,
} from './support/masters';
import { afterOneFrame, makeTreatment, newTreatmentName, openTreatments, recordFocus, rowOf } from './support/treatments';

/**
 * GitHub issue 244 (QLT-01 of the G6 of tech-debt 119, DL-150 (4), DL-162 (6)): where focus goes when a masters list is read again slowly after a
 * save, on the Process master (SCR-11), the Materials tab and the Treatment / Color tab (SCR-13). One piece of code does it for all of them
 * (`useReadAgain` and `useFocusAfterRead`), and before this file only the Exchange rates and Treatment / Color tests would have noticed a change to it.
 * At 360x800, 768x1024 and 1366x768 on the development server, signed in as the E2E Admin.
 *
 * The scenario is the one the UX spec describes for a slow network: the save is answered and the dialog closes; the list is read again, and the read
 * is held. After 300 ms the rows are replaced by the skeleton (section 6.0 "States"), so the button that opened the dialog is gone, and the button the
 * dialog's own close handler had focused went with it. Then the read answers, and the shared piece decides where focus goes:
 *   - the read succeeds: back to the button that opened the dialog, now in the new list (section 6.0 "Dialogs": focus returns to the trigger);
 *   - the read fails: the load error's title keeps it, and the page heading never takes it (DEF-020; "Error (load)": focus goes to the title).
 * Each test makes the one rate, material or treatment it changes, so the widths, repeats and retries never meet on one. The Process master and the
 * Materials tab are measured on a Save of a changed value; a deleted row (focus to the heading, ux-spec v0.17) is the other branch of the same
 * function, with its own tests in `process-master.spec.ts`, which read the list at once. The words are the UX spec's, written out in `support/masters.ts`.
 */

test.use({ storageState: ADMIN_STATE });

/**
 * Saves a changed value in the open dialog with the list read held. Returns once the dialog is gone and the skeleton shows; the focus sequence is recorded from then on:
 * what the dialog's own close handler did while the rows were still there or just gone is not what these tests are about, and it depends on how fast the
 * machine drew the skeleton. What the shared piece does once the read has answered is. */
async function saveWithSlowRead(
  page: Page,
  gate: ListGate,
  options: { readonly dialogName: string; readonly field: string; readonly value: string; readonly loading: string },
): Promise<string[]> {
  const dialog = page.getByRole('dialog', { name: options.dialogName });
  await dialog.getByLabel(options.field).fill(options.value);
  gate.hold();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => gate.waiting(), { message: 'the read of the list is held' }).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: options.loading })).toBeAttached();
  await afterOneFrame(page);
  return recordFocus(page);
}

test.describe('the Process master (SCR-11)', () => {
  test('a slow read after a save: focus returns to the rate\'s Edit button once the new list is on screen', async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    const gate = await gateListReads(page, PROCESS_LIST_PATH);
    const edit = rowButton(page, name, 'Edit');
    await pressWithKeyboard(edit);
    await saveWithSlowRead(page, gate, { dialogName: `Edit ${name}`, field: 'Default value', value: '2.37', loading: PROCESS_LOADING });
    await expect(edit, 'the rows are the skeleton, so the button is gone').toHaveCount(0);

    gate.release('server');
    await expect(rowOf(page, name)).toContainText('2.37');
    await expect(edit).toBeFocused();
  });

  test('a slow read that fails after a save: the load error\'s title keeps focus and the page heading never takes it (DEF-020)', async ({ page }, testInfo) => {
    const name = await makeRate(page, testInfo);
    await openProcessMaster(page);
    const gate = await gateListReads(page, PROCESS_LIST_PATH);
    await pressWithKeyboard(rowButton(page, name, 'Edit'));
    const focusLog = await saveWithSlowRead(page, gate, { dialogName: `Edit ${name}`, field: 'Default value', value: '2.37', loading: PROCESS_LOADING });

    gate.release('busy');
    await expectLoadErrorHoldsFocus(page, focusLog, PROCESS_LOAD_ERROR);
    await expectSavedNotShown(page);
  });
});

test.describe('the Materials tab (SCR-13)', () => {
  test('a slow read after a save: focus returns to the material\'s Edit button once the new list is on screen', async ({ page }, testInfo) => {
    const name = await makeMaterial(page, testInfo);
    await openMaterials(page);
    const gate = await gateListReads(page, MATERIALS_LIST_PATH);
    const edit = rowButton(page, name, 'Edit');
    await pressWithKeyboard(edit);
    await saveWithSlowRead(page, gate, { dialogName: `Edit ${name}`, field: 'Material-Scrap-Rate (per kg)', value: '47.37', loading: MATERIALS_LOADING });
    await expect(edit, 'the rows are the skeleton, so the button is gone').toHaveCount(0);

    gate.release('server');
    await expect(rowOf(page, name)).toContainText('47.37');
    await expect(edit).toBeFocused();
  });

  test('a slow read that fails after a save: the load error\'s title keeps focus and the page heading never takes it (DEF-020)', async ({ page }, testInfo) => {
    const name = await makeMaterial(page, testInfo);
    await openMaterials(page);
    const gate = await gateListReads(page, MATERIALS_LIST_PATH);
    await pressWithKeyboard(rowButton(page, name, 'Edit'));
    const focusLog = await saveWithSlowRead(page, gate, { dialogName: `Edit ${name}`, field: 'Material-Scrap-Rate (per kg)', value: '47.37', loading: MATERIALS_LOADING });

    gate.release('busy');
    await expectLoadErrorHoldsFocus(page, focusLog, MATERIALS_LOAD_ERROR);
    await expectSavedNotShown(page);
  });
});

test.describe('the Treatment / Color tab (SCR-13)', () => {
  test('a slow read after a rename: focus returns to the treatment\'s Rename button once the new list is on screen', async ({ page }, testInfo) => {
    const { name } = await makeTreatment(page, newTreatmentName(testInfo));
    const renamed = `${name}-r`;
    await openTreatments(page);
    const gate = await gateListReads(page, '/api/v1/treatments');
    const rename = rowOf(page, name).getByRole('button', { name: `Rename ${name}` });
    await pressWithKeyboard(rename);
    await saveWithSlowRead(page, gate, { dialogName: `Rename ${name}`, field: 'Name', value: renamed, loading: 'Loading the treatments' });
    await expect(rename, 'the rows are the skeleton, so the button is gone').toHaveCount(0);

    gate.release('server');
    const renamedButton = rowOf(page, renamed).getByRole('button', { name: `Rename ${renamed}` });
    await expect(renamedButton).toBeVisible();
    await expect(renamedButton).toBeFocused();
  });
});
