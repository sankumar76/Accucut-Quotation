import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { defined } from '../support/defined';
import { deleteGuardOf } from '../../src/lib/estimates/tree-moves';

import { E2E_ENGINEER, E2E_PASSWORD, ensureCanaryCustomers, signInWithoutThePage, useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';
import { control, fieldIdOf } from './support/part-form';
import { addMainAssemblyButton, openEngineerWindow, openTreePanel, readTreeThrough, reviewButton, reviewRow } from './support/review-tree';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * DEF-131 stage 2T, the checks of the parts tree on SCR-06 that the long Lead cases could not hold in 30 s (UX ruling `lead-admin-edit-inputs-2026-11-27.md` 4.7 (d), 4.3 item 4; ED-22, ED-25, ED-27, ED-28). **One check per case, no
 * person made** (DL-422): the signed-in Lead of the set-up project and the E2E Engineer are used as they are, and each case gets a task of its own through `POST /api/v1/tasks` (the estimate is empty and in Draft, with the
 * customer chosen), which the Lead's requests then give the rows the case needs. The page is the Lead's, at three widths on the development server. Every name and path is invented.
 */

const HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
const CUSTOMER = defined(CUSTOMER_CANARIES[0]);
const FUTURE = '2099-12-31T10:00';

interface Made {
  readonly code: string;
  readonly estimateId: string;
}

/** A task for the E2E Engineer made by the signed-in Lead through the API: an empty Draft estimate with the customer chosen. */
async function assignedTask(page: Page, testInfo: TestInfo): Promise<Made> {
  await ensureCanaryCustomers();
  const context = (await (await page.request.get(`${DEVELOPMENT_URL}/api/v1/options/assign-context`)).json()) as { engineers: ReadonlyArray<{ id: string; name: string }> };
  const engineer = defined(context.engineers.find((candidate) => candidate.name === E2E_ENGINEER.name));
  const created = await page.request.post(`${DEVELOPMENT_URL}/api/v1/tasks`, {
    headers: HEADERS,
    data: { engineerId: engineer.id, customerId: CUSTOMER.id, folderPath: `\\\\e2e-server\\e2e-share\\RFQ-${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`, deadline: FUTURE, title: 'Invented tree case', subject: 'Invented subject' },
  });
  expect(created.status()).toBe(201);
  const task = (await created.json()) as { code: string; estimate: { id: string } };
  return { code: task.code, estimateId: task.estimate.id };
}

/** Adds a row through the API as the Lead does with the "+" (the same request); returns the ID of the new row. */
async function addRow(api: APIRequestContext, estimateId: string, parentId: string | null, nodeKind: 'MAIN_ASSEMBLY' | 'PART'): Promise<string> {
  const added = await api.post(`${DEVELOPMENT_URL}/api/v1/estimates/${estimateId}/nodes`, { headers: HEADERS, data: { parentId, nodeKind } });
  expect(added.status()).toBe(201);
  return defined(((await added.json()) as { nodeId: string | null }).nodeId);
}

/** A main assembly (1) with `parts` Parts under it (1.1, 1.2, ...). */
async function withParts(page: Page, estimateId: string, parts: number): Promise<void> {
  const main = await addRow(page.request, estimateId, null, 'MAIN_ASSEMBLY');
  for (let index = 0; index < parts; index += 1) await addRow(page.request, estimateId, main, 'PART');
}

/** The page of the estimate as the Lead opens it, with the editing island up (its tree controls are the sign). */
async function openedByTheLead(page: Page, code: string, row?: string): Promise<void> {
  const response = await page.goto(`/estimates/${code}${row === undefined ? '' : `?row=${row}`}`);
  expect(response?.status()).toBe(200);
  await expect(addMainAssemblyButton(page)).toBeVisible();
}

test.describe('the parts tree on SCR-06, one check each', () => {
  test('ED-22: a row is moved up with the handle\'s menu and the keyboard alone: it is renumbered, said, and its handle keeps the focus', async ({ page }, testInfo) => {
    const { code, estimateId } = await assignedTask(page, testInfo);
    await withParts(page, estimateId, 2);
    await openedByTheLead(page, code);

    await reviewButton(page, 'Move', '1.2').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Move up', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: /renumbered to 1\.1/ })).toHaveCount(1);
    await expect(reviewButton(page, 'Move', '1.1')).toBeFocused();
  });

  test('ED-25: Calculate refused for a Part with blank inputs names the part in a summary, its link opens the row, and the blank field says what to do', async ({ page }, testInfo) => {
    const { code, estimateId } = await assignedTask(page, testInfo);
    await withParts(page, estimateId, 1);
    await openedByTheLead(page, code);

    await page.locator('#review-calculate').click();
    const summary = page.locator('[data-calculate-summary]');
    await expect(summary).toContainText('missing inputs');
    const toField = summary.getByRole('listitem').filter({ hasText: '1.1' }).getByRole('link').first();
    await toField.focus();
    await page.keyboard.press('Enter');
    await expect(reviewRow(page, '1.1')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByText('Enter this value.').first()).toBeVisible();
  });

  test('ED-27: the row the Lead has open is deleted by another request: the next save answers 404, the block shows the first row and says so once', async ({ page }, testInfo) => {
    const { code, estimateId } = await assignedTask(page, testInfo);
    await withParts(page, estimateId, 2);
    await openedByTheLead(page, code, '1.2');
    await expect(reviewRow(page, '1.2')).toHaveAttribute('aria-current', 'true');

    const rows = await readTreeThrough(page.request, estimateId);
    const open = defined(rows.find((row) => row.slNo === '1.2'));
    const guard = deleteGuardOf(rows, open.id);
    const removed = await page.request.delete(`${DEVELOPMENT_URL}/api/v1/estimates/${estimateId}/nodes/${open.id}?revision=${String(open.revision)}&parts=${String(guard.parts)}&subtree=${guard.subtree}`, { headers: HEADERS });
    expect(removed.status()).toBe(200);

    // The Description box of the form (column D; the first box is the Sl. No, which is read-only).
    const field = control(page, 'D');
    await expect(field).toBeEnabled();
    await expect(field).not.toHaveAttribute('aria-readonly', 'true');
    await field.fill('9');
    await field.blur();
    await expect(page.getByRole('status').filter({ hasText: '1.2 was removed by someone else. Showing 1.' })).toHaveCount(1);
    await expect(reviewRow(page, '1')).toHaveAttribute('aria-current', 'true');
  });

  test('ED-28: the Engineer reads the rows the Lead added, with no figure in them', async ({ page, browser }, testInfo) => {
    const { estimateId } = await assignedTask(page, testInfo);
    await withParts(page, estimateId, 1);

    const window = await browser.newContext({ baseURL: DEVELOPMENT_URL });
    try {
      await useFreshAddress(window);
      const engineerPage = await window.newPage();
      await signInWithoutThePage(engineerPage, E2E_ENGINEER.email, E2E_PASSWORD);
      const rows = await readTreeThrough(engineerPage.request, estimateId);
      expect(rows.map((row) => row.slNo)).toEqual(['1', '1.1']);
      expect(JSON.stringify(rows)).not.toMatch(/figures|unitPrice|price/i);
    } finally {
      await window.close();
    }
  });

  test('ED-34: the "+" menu opens in line and is not clipped by the column, with no sideways scroll', async ({ page }, testInfo) => {
    const { code, estimateId } = await assignedTask(page, testInfo);
    await withParts(page, estimateId, 0);
    await openedByTheLead(page, code);

    await openTreePanel(page);
    await reviewRow(page, '1').click();
    await openTreePanel(page);
    await reviewButton(page, 'Add under', '1').click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const box = defined(await menu.boundingBox());
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 1);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('ED-37: axe finds nothing serious with the "+" menu open', async ({ page }, testInfo) => {
    const { code, estimateId } = await assignedTask(page, testInfo);
    await withParts(page, estimateId, 0);
    await openedByTheLead(page, code);

    await openTreePanel(page);
    await reviewRow(page, '1').click();
    await openTreePanel(page);
    await reviewButton(page, 'Add under', '1').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('ED-37: axe finds nothing serious with the delete dialog open', async ({ page }, testInfo) => {
    const { code, estimateId } = await assignedTask(page, testInfo);
    await withParts(page, estimateId, 1);
    await openedByTheLead(page, code);

    await openTreePanel(page);
    await reviewRow(page, '1').click();
    await openTreePanel(page);
    await reviewButton(page, 'Delete', '1').click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('ED-7: a value typed and not yet left is saved before Recalculate sends its request', async ({ page }, testInfo) => {
    const { code, estimateId } = await assignedTask(page, testInfo);
    await withParts(page, estimateId, 1);
    await openedByTheLead(page, code, '1.1');

    const field = control(page, 'D');
    await expect(field).toBeEnabled();
    await expect(field).not.toHaveAttribute('aria-readonly', 'true');
    await field.fill('Invented bracket');
    const order: string[] = [];
    page.on('response', (response) => {
      const request = response.request();
      if (request.method() === 'PATCH' && /\/nodes\/[^/]+\/inputs$/.test(response.url())) order.push('saved');
      if (request.method() === 'POST' && response.url().endsWith('/recalculate')) order.push('calculated');
    });
    const asked = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/estimates/${estimateId}/recalculate`));
    await page.locator('#review-calculate').click();
    await asked;
    // The press is the click that leaves the field, and it asks the form to send what it shows, so the value may go twice (the second changes nothing); every save is answered before the request.
    expect(order.at(-1)).toBe('calculated');
    expect(order.length).toBeGreaterThan(1);
  });

  test('ED-8: in a Draft the Engineer saves the part after the Lead opened it: the Lead\'s save is refused as changed elsewhere, with the two choices, and nothing is overwritten silently', async ({ page, browser }, testInfo) => {
    const { code, estimateId } = await assignedTask(page, testInfo);
    await withParts(page, estimateId, 1);
    await openedByTheLead(page, code, '1.1');
    const field = control(page, 'H');
    await expect(field).toBeEnabled();
    await expect(field).not.toHaveAttribute('aria-readonly', 'true');

    const engineer = await openEngineerWindow(browser, E2E_ENGINEER);
    try {
      const part = defined((await readTreeThrough(engineer.api, estimateId)).find((row) => row.slNo === '1.1'));
      const written = await engineer.api.patch(`${DEVELOPMENT_URL}/api/v1/estimates/${estimateId}/nodes/${part.id}/inputs`, { headers: HEADERS, data: { revision: part.revision, values: { [fieldIdOf('H')]: '5' } } });
      expect(written.status(), 'the Engineer saves the part').toBe(200);
    } finally {
      await engineer.close();
    }
    await field.fill('3');
    await field.blur();
    await expect(page.getByText('This part was changed somewhere else.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep what I typed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use the newer values' })).toBeVisible();
  });
});
