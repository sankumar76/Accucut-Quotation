import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { defined } from '../support/defined';

import { E2E_ENGINEER, E2E_PASSWORD, ensureCanaryCustomers, signInWithoutThePage, useFreshAddress } from './support/auth';
import { control, fieldIdOf } from './support/part-form';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * DEF-131 stage 2 (inputs edit), ED-7 and ED-8 as short cases of their own (UX ruling `lead-admin-edit-inputs-2026-11-27.md` 4.3 item 1 and 4.4). They were steps of two cases of `estimate-cleared.spec.ts` that took 16 s
 * on #800 and passed 30 s with them, so those cases are master's again. **One check per case, no person made** (DL-422): the signed-in Lead of the set-up project and the E2E Engineer are used as they are, and each
 * case gets a task of its own through `POST /api/v1/tasks` (the estimate is empty and in Draft, with the customer chosen), which the Lead's own requests give a Main Assembly and a Part. The page is the Lead's, at three
 * widths on the development server. Every name and path is invented.
 */

const HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
const CUSTOMER = defined(CUSTOMER_CANARIES[0]);
const FUTURE = '2099-12-31T10:00';

interface Made {
  readonly code: string;
  readonly estimateId: string;
}

/** A task for the E2E Engineer made by the signed-in Lead through the API: an empty Draft estimate with the customer chosen, a Main Assembly (1) and a Part under it (1.1). */
async function assignedTaskWithAPart(page: Page, testInfo: TestInfo): Promise<Made> {
  await ensureCanaryCustomers();
  const context = (await (await page.request.get(`${DEVELOPMENT_URL}/api/v1/options/assign-context`)).json()) as { engineers: ReadonlyArray<{ id: string; name: string }> };
  const engineer = defined(context.engineers.find((candidate) => candidate.name === E2E_ENGINEER.name));
  const created = await page.request.post(`${DEVELOPMENT_URL}/api/v1/tasks`, {
    headers: HEADERS,
    data: { engineerId: engineer.id, customerId: CUSTOMER.id, folderPath: `\\\\e2e-server\\e2e-share\\RFQ-${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`, deadline: FUTURE, title: 'Invented inputs case', subject: 'Invented subject' },
  });
  expect(created.status()).toBe(201);
  const task = (await created.json()) as { code: string; estimate: { id: string } };
  const estimateId = task.estimate.id;
  const main = await page.request.post(`${DEVELOPMENT_URL}/api/v1/estimates/${estimateId}/nodes`, { headers: HEADERS, data: { parentId: null, nodeKind: 'MAIN_ASSEMBLY' } });
  expect(main.status()).toBe(201);
  const mainId = defined(((await main.json()) as { nodeId: string | null }).nodeId);
  const part = await page.request.post(`${DEVELOPMENT_URL}/api/v1/estimates/${estimateId}/nodes`, { headers: HEADERS, data: { parentId: mainId, nodeKind: 'PART' } });
  expect(part.status()).toBe(201);
  return { code: task.code, estimateId };
}

/** The page of the Part (1.1) as the Lead opens it, with its form editable (the Lead may correct inputs of a Draft). */
async function openedOnThePart(page: Page, code: string): Promise<void> {
  const response = await page.goto(`/estimates/${code}?row=1.1`);
  expect(response?.status()).toBe(200);
  const field = control(page, 'H');
  await expect(field).toBeEnabled();
  await expect(field).not.toHaveAttribute('aria-readonly', 'true');
}

test.describe('the Lead\'s inputs on SCR-06, one check each', () => {
  test('ED-7: a value typed and not yet left is saved before Recalculate sends its request', async ({ page }, testInfo) => {
    const { code, estimateId } = await assignedTaskWithAPart(page, testInfo);
    await openedOnThePart(page, code);

    await control(page, 'H').fill('3');
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
    const { code, estimateId } = await assignedTaskWithAPart(page, testInfo);
    await openedOnThePart(page, code);

    // The Engineer's own window (the same person as always, no new one): signs in through the two calls the sign-in page makes and saves QTY per Assy of the part.
    const window = await browser.newContext({ baseURL: DEVELOPMENT_URL });
    try {
      await useFreshAddress(window);
      const engineerPage = await window.newPage();
      await signInWithoutThePage(engineerPage, E2E_ENGINEER.email, E2E_PASSWORD);
      const tree = (await (await engineerPage.request.get(`${DEVELOPMENT_URL}/api/v1/estimates/${estimateId}/tree`)).json()) as { nodes: ReadonlyArray<{ id: string; slNo: string; revision: number }> };
      const part = defined(tree.nodes.find((row) => row.slNo === '1.1'));
      const written = await engineerPage.request.patch(`${DEVELOPMENT_URL}/api/v1/estimates/${estimateId}/nodes/${part.id}/inputs`, { headers: HEADERS, data: { revision: part.revision, values: { [fieldIdOf('H')]: '5' } } });
      expect(written.status(), 'the Engineer saves the part').toBe(200);
    } finally {
      await window.close();
    }
    const field = control(page, 'H');
    await field.fill('3');
    await field.blur();
    await expect(page.getByText('This part was changed somewhere else.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep what I typed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use the newer values' })).toBeVisible();
  });
});
