import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { canaryTaskCodeFor } from '../support/estimate-recipe';

import { createDisposableUser } from './support/auth';
import { API, JSON_HEADERS, makeCustomer, newCustomerName, openCustomers, rowOf, type MadeCustomer } from './support/customers';
import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-02.07 T7 (AC-1, AC-2, AC-6, AC-7): the Delete action of SCR-12 "Customers", at 360x800, 768x1024 and 1366x768 on the development server, signed in as the
 * E2E Admin (the saved browser state of the set-up project). Each test works on a customer it makes through the API (an invented name with the screen size, the
 * repeat, the retry and a random part), and the one that needs an estimate puts the customer on the draft estimate of a person it makes for itself, so the three
 * screen sizes and the retries never meet on one record. The words are the UX spec's (SCR-12 "Delete" and "Delete blocked"), written out here and not imported. What
 * the database holds (the soft delete, the one entry, the race) is judged in `tests/integration/masters/customer-delete.test.ts`. The Materials tab's Delete is
 * not here: it waits for the parts tree (STORY-05.02, assumption A-1 of the story).
 */

const KEEP = 'Keep customer';
const CONFIRM = 'Delete customer';

const deleteButton = (page: Page, name: string) => rowOf(page, name).getByRole('button', { name: `Delete ${name}` });

/** Puts the customer on the draft estimate of a person made for this test (the estimate has the ID of its owner, `estimate-recipe.ts`). Returns the task code. */
async function putOnADraftEstimate(page: Page, customer: MadeCustomer, testInfo: TestInfo): Promise<string> {
  const owner = await createDisposableUser('scan', testInfo);
  const response = await page.request.put(`${DEVELOPMENT_URL}/api/v1/estimates/${owner.id}/customer`, { headers: JSON_HEADERS, data: { customerId: customer.id } });
  expect(response.status()).toBe(200);
  return canaryTaskCodeFor(owner.id);
}

test.describe('AC-1, AC-7: a customer no estimate uses is deleted after a confirmation', () => {
  test('the Delete button is named for the customer; the dialog keeps focus on the safe choice; Keep sends nothing; Delete removes the row, says so, and leaves the options', async ({ page }, testInfo) => {
    const customer = await makeCustomer(page, newCustomerName(testInfo));
    await openCustomers(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    const trigger = deleteButton(page, customer.name);
    await expect(trigger).toBeVisible();
    await trigger.click();
    const dialog = page.getByRole('alertdialog', { name: `Delete ${customer.name}?` });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      `${customer.name} no longer appears in this list or in the customer choice on new estimates. Estimates that are already calculated keep their figures. You cannot undo this here.`,
    );
    await expect(dialog.getByRole('button', { name: KEEP })).toBeFocused();
    await expectNoAxeViolations(page);

    // Keep: nothing is sent, the row stays and focus returns to the button that opened the dialog.
    const deletes: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'DELETE') deletes.push(request.url());
    });
    await dialog.getByRole('button', { name: KEEP }).click();
    await expect(dialog).toBeHidden();
    expect(deletes).toEqual([]);
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeFocused();

    // Delete: the row goes, the notice says so, and the customer is no longer offered on the estimate form.
    await trigger.click();
    await page.getByRole('alertdialog', { name: `Delete ${customer.name}?` }).getByRole('button', { name: CONFIRM }).click();
    await expect(page.getByRole('status').filter({ hasText: `${customer.name} was deleted. The change is in the audit log.` })).toBeVisible();
    await expect(rowOf(page, customer.name)).toHaveCount(0);
    expect(deletes).toHaveLength(1);
    const options = await page.request.get(`${DEVELOPMENT_URL}/api/v1/options/customers`);
    expect(JSON.stringify(await options.json())).not.toContain(customer.id);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('Escape closes the dialog with nothing sent and focus back on the button', async ({ page }, testInfo) => {
    const customer = await makeCustomer(page, newCustomerName(testInfo));
    await openCustomers(page);
    const trigger = deleteButton(page, customer.name);
    await trigger.click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(trigger).toBeFocused();
    const kept = await page.request.get(`${API}`);
    expect(JSON.stringify(await kept.json())).toContain(customer.id);
  });
});

test.describe('AC-2, AC-7: a customer on a Draft estimate is refused, and the estimate is named', () => {
  test('the confirmation turns into "cannot be deleted yet" with the estimate\'s code as a link and its status, Close is the only button, and the customer stays', async ({ page }, testInfo) => {
    const customer = await makeCustomer(page, newCustomerName(testInfo));
    const code = await putOnADraftEstimate(page, customer, testInfo);
    await openCustomers(page);

    const trigger = deleteButton(page, customer.name);
    await trigger.click();
    await page.getByRole('alertdialog', { name: `Delete ${customer.name}?` }).getByRole('button', { name: CONFIRM }).click();

    const blocked = page.getByRole('alertdialog', { name: `${customer.name} cannot be deleted yet` });
    await expect(blocked).toBeVisible();
    await expect(blocked).toContainText('An open estimate uses this customer:');
    await expect(blocked.getByRole('link', { name: code })).toHaveAttribute('href', `/estimates/${code}`);
    await expect(blocked).toContainText('(Draft)');
    await expect(blocked).toContainText('Approve it, or move it to another customer, and then delete this one.');
    await expect(blocked.getByRole('button')).toHaveCount(1);
    await expect(blocked.getByRole('button', { name: 'Close' })).toBeFocused();
    await expectNoAxeViolations(page);

    await blocked.getByRole('button', { name: 'Close' }).click();
    await expect(blocked).toBeHidden();
    await expect(rowOf(page, customer.name)).toBeVisible();
    await expect(trigger).toBeFocused();
  });
});

test.describe('AC-6: the API refuses a delete from anyone but the Admin', () => {
  test('a signed-out call is 401, and the customer is still listed', async ({ page, playwright }, testInfo) => {
    const customer = await makeCustomer(page, newCustomerName(testInfo));
    const anonymous = await playwright.request.newContext({ baseURL: DEVELOPMENT_URL });
    try {
      const response = await anonymous.delete(`${API}/${customer.id}`, { headers: { origin: DEVELOPMENT_URL } });
      expect(response.status()).toBe(401);
    } finally {
      await anonymous.dispose();
    }
    const listed = await page.request.get(API);
    expect(JSON.stringify(await listed.json())).toContain(customer.id);
  });
});
