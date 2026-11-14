import { expect, test, type Page } from '@playwright/test';

import { canaryTaskCodeFor } from '../support/estimate-recipe';

import { createDisposableUser, putMaterialInCanaryPart } from './support/auth';
import { makeCustomer, newCustomerName, openCustomers, rowOf } from './support/customers';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { makeMaterial } from './support/masters';
import { ADMIN_STATE, DEVELOPMENT_URL } from './support/servers';

test.use({ storageState: ADMIN_STATE });

/**
 * STORY-02.07 (AC-3, AC-7) for the Materials tab of SCR-13, at 360x800, 768x1024 and 1366x768 on the development server, signed in as the E2E Admin: a material no
 * open estimate uses is deleted after a confirmation; one that a Draft part uses is refused with the estimate named (the material is put into the part of the test's
 * own estimate in the database, as the part form of STORY-05.03 will). The words are the UX spec's and the mock-up's, written out here and not imported. What the
 * database holds (the soft delete, the one entry, the race with a writer of a part's material) is judged in `tests/integration/masters/material-delete.test.ts`.
 *
 * And one test of the confirmation itself (SQR-03 of the review of #388): with the request held, Escape and Keep do nothing, and the late answer acts on the dialog
 * that is still there. It uses the Customers screen and stands for both, which share `MasterDeleteDialog`.
 */

const MATERIALS_API = `${DEVELOPMENT_URL}/api/v1/materials`;
const KEEP_MATERIAL = 'Keep material';
const CONFIRM_MATERIAL = 'Delete material';

/** Opens the Materials tab (the default tab of SCR-13) and waits for its buttons to be live. */
async function openMaterials(page: Page): Promise<void> {
  await page.goto('/masters/materials');
  await expect(page.getByRole('heading', { level: 1, name: 'Materials and lists' })).toBeVisible();
  await waitUntilHydrated(page, 'main button[data-action="add"]');
  await expect(page.getByRole('button', { name: 'Add material' })).toBeVisible();
}

/** The ID of the material with this name, from the list the Admin's route gives. */
async function materialIdOf(page: Page, name: string): Promise<string> {
  const response = await page.request.get(MATERIALS_API);
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  const list: ReadonlyArray<unknown> = typeof body === 'object' && body !== null && 'materials' in body && Array.isArray(body.materials) ? body.materials : [];
  for (const item of list) {
    if (typeof item === 'object' && item !== null && 'materialInDrawing' in item && item.materialInDrawing === name && 'id' in item && typeof item.id === 'string') return item.id;
  }
  throw new Error('the material made for the test is not in the list');
}

test.describe('AC-3, AC-7: a material no open estimate uses is deleted after a confirmation', () => {
  test('the Delete button is named for the material; Keep sends nothing; Delete removes the row, says so, and leaves the options', async ({ page }, testInfo) => {
    const name = await makeMaterial(page, testInfo);
    const id = await materialIdOf(page, name);
    await openMaterials(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    const trigger = rowOf(page, name).getByRole('button', { name: `Delete ${name}` });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const dialog = page.getByRole('alertdialog', { name: `Delete ${name}?` });
    await expect(dialog).toContainText('This material no longer appears in the Material in Drawing list. Estimates that are already calculated keep their figures.');
    await expect(dialog.getByRole('button', { name: KEEP_MATERIAL })).toBeFocused();
    await expectNoAxeViolations(page);
    await dialog.getByRole('button', { name: KEEP_MATERIAL }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.getByRole('alertdialog', { name: `Delete ${name}?` }).getByRole('button', { name: CONFIRM_MATERIAL }).click();
    await expect(page.getByRole('status').filter({ hasText: `${name} was deleted. The change is in the audit log.` })).toBeVisible();
    await expect(rowOf(page, name)).toHaveCount(0);
    const options = await page.request.get(`${DEVELOPMENT_URL}/api/v1/options/materials`);
    expect(JSON.stringify(await options.json())).not.toContain(id);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('AC-3, AC-7: a material a Draft part uses is refused, and the estimate is named', () => {
  test('the confirmation turns into "cannot be deleted yet" with the estimate\'s code and status, Close is the only button, and the material stays', async ({ page }, testInfo) => {
    const name = await makeMaterial(page, testInfo);
    const id = await materialIdOf(page, name);
    const owner = await createDisposableUser('scan', testInfo);
    await putMaterialInCanaryPart(owner.id, id);
    const code = canaryTaskCodeFor(owner.id);
    await openMaterials(page);

    const trigger = rowOf(page, name).getByRole('button', { name: `Delete ${name}` });
    await trigger.click();
    await page.getByRole('alertdialog', { name: `Delete ${name}?` }).getByRole('button', { name: CONFIRM_MATERIAL }).click();

    const blocked = page.getByRole('alertdialog', { name: `${name} cannot be deleted yet` });
    await expect(blocked).toBeVisible();
    await expect(blocked).toContainText('An open estimate uses this material:');
    await expect(blocked.getByRole('link', { name: code })).toHaveAttribute('href', `/estimates/${code}`);
    await expect(blocked).toContainText('(Draft)');
    await expect(blocked).toContainText('Approve it, or change the material on its parts, and then delete this one.');
    await expect(blocked.getByRole('button')).toHaveCount(1);
    await expect(blocked.getByRole('button', { name: 'Close' })).toBeFocused();
    await expectNoAxeViolations(page);

    await blocked.getByRole('button', { name: 'Close' }).click();
    await expect(blocked).toBeHidden();
    await expect(rowOf(page, name)).toBeVisible();
    await expect(trigger).toBeFocused();
  });
});

test.describe('SQR-03: the confirmation cannot be closed while its request is out', () => {
  test('Escape and Keep do nothing until the server has answered; then the dialog closes once and the notice shows', async ({ page }, testInfo) => {
    const customer = await makeCustomer(page, newCustomerName(testInfo));
    await openCustomers(page);
    // The DELETE of this customer is held until the test lets it go; every other call passes.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held: () => void = () => undefined;
    const reachedServer = new Promise<void>((resolve) => {
      held = resolve;
    });
    await page.route(`**/api/v1/customers/${customer.id}`, async (route) => {
      if (route.request().method() !== 'DELETE') return route.continue();
      held();
      await gate;
      return route.continue();
    });

    await rowOf(page, customer.name).getByRole('button', { name: `Delete ${customer.name}` }).click();
    const dialog = page.getByRole('alertdialog', { name: `Delete ${customer.name}?` });
    await dialog.getByRole('button', { name: 'Delete customer' }).click();
    await reachedServer;
    await expect(dialog.getByRole('button', { name: 'Deleting' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Keep customer' })).toBeDisabled();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();

    release();
    await expect(page.getByRole('status').filter({ hasText: `${customer.name} was deleted.` })).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(rowOf(page, customer.name)).toHaveCount(0);
  });
});
