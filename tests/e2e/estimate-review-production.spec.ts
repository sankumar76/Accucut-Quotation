import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { defined } from '../support/defined';

import { E2E_ENGINEER, E2E_LEAD, E2E_PASSWORD, ensureCanaryCustomers, signInWithoutThePage, useFreshAddress } from './support/auth';
import { addMainAssemblyButton } from './support/review-tree';
import { PRODUCTION_URL } from './support/servers';

/**
 * AQP-488 (DEF-131 stage 2T), the product cost of the editing island, measured on the **production server** (`next start`, the build every user gets) and not on the development server, which compiles the island's lazy
 * chunk on its first request and so shows a cost a user never pays. **Observe-only: no assertion rests on a time**; each case logs one line (`[AQP-488 production timing]`) that the pull request reads from the CI log.
 *   - The Lead's page load: the time from the navigation to the server-drawn page (the heading), and then to the tree controls (the island fetched and swapped in).
 *   - After Restore: the time from the press of the dialog's button to the restored page drawn, and then to the tree controls.
 * The signed-in Lead of the set-up project and the E2E Engineer are used as they are (no person made); each case gets a task of its own through the API. Every name and path is invented.
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

// A client address of this case's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const HEADERS = { origin: PRODUCTION_URL, 'content-type': 'application/json' };
const CUSTOMER = defined(CUSTOMER_CANARIES[0]);

async function leadWithTask(page: Page, testInfo: TestInfo): Promise<{ readonly code: string; readonly estimateId: string }> {
  await ensureCanaryCustomers();
  await signInWithoutThePage(page, E2E_LEAD.email, E2E_PASSWORD);
  const context = (await (await page.request.get('/api/v1/options/assign-context')).json()) as { engineers: ReadonlyArray<{ id: string; name: string }> };
  const engineer = defined(context.engineers.find((candidate) => candidate.name === E2E_ENGINEER.name));
  const created = await page.request.post('/api/v1/tasks', {
    headers: HEADERS,
    data: { engineerId: engineer.id, customerId: CUSTOMER.id, folderPath: `\\\\e2e-server\\e2e-share\\RFQ-prod-${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`, deadline: '2099-12-31T10:00', title: 'Invented timing case', subject: 'Invented subject' },
  });
  expect(created.status()).toBe(201);
  const task = (await created.json()) as { code: string; estimate: { id: string } };
  const main = await page.request.post(`/api/v1/estimates/${task.estimate.id}/nodes`, { headers: HEADERS, data: { parentId: null, nodeKind: 'MAIN_ASSEMBLY' } });
  expect(main.status()).toBe(201);
  const mainId = defined(((await main.json()) as { nodeId: string | null }).nodeId);
  for (let index = 0; index < 2; index += 1) expect((await page.request.post(`/api/v1/estimates/${task.estimate.id}/nodes`, { headers: HEADERS, data: { parentId: mainId, nodeKind: 'PART' } })).status()).toBe(201);
  return { code: task.code, estimateId: task.estimate.id };
}

const line = (text: string): void => {
  // eslint-disable-next-line no-console -- the measurement of AQP-488 (product cost of the island on the production server), read from the CI log
  console.log(`[AQP-488 production timing] ${text}`);
};

test.describe('the editing island on the production server (observe-only timings)', () => {
  test('the Lead\'s page load: drawn, then the tree controls', async ({ page }, testInfo) => {
    const { code } = await leadWithTask(page, testInfo);
    const startedAt = Date.now();
    const response = await page.goto(`/estimates/${code}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
    const drawnAt = Date.now();
    await expect(addMainAssemblyButton(page)).toBeVisible();
    const controlsAt = Date.now();
    line(`${testInfo.project.name}: page load, heading ${String(drawnAt - startedAt)} ms after the navigation, tree controls ${String(controlsAt - drawnAt)} ms after that`);
  });

  test('after Restore: the restored page drawn, then the tree controls', async ({ page }, testInfo) => {
    const { code, estimateId } = await leadWithTask(page, testInfo);
    const ignored = await page.request.post(`/api/v1/estimates/${estimateId}/ignore`, { headers: HEADERS, data: { remarks: 'Invented remarks.' } });
    expect(ignored.status()).toBe(200);
    const response = await page.goto(`/estimates/${code}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('#review-restore')).toBeEnabled();
    await page.locator('#review-restore').click();
    const dialog = page.getByRole('alertdialog', { name: `Restore ${code}?` });
    await expect(dialog).toBeVisible();
    const pressedAt = Date.now();
    await dialog.getByRole('button', { name: /^(Restore RFQ|Restoring)$/ }).click();
    await expect(page.locator('#review-actions')).toBeVisible();
    const drawnAt = Date.now();
    await expect(addMainAssemblyButton(page)).toBeVisible();
    const controlsAt = Date.now();
    line(`${testInfo.project.name}: after Restore, page drawn ${String(drawnAt - pressedAt)} ms after the press, tree controls ${String(controlsAt - drawnAt)} ms after that`);
  });
});
