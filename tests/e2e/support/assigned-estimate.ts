import { expect, type Page, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../../support/customer-canary';
import { defined } from '../../support/defined';
import { MATERIAL_CANARIES } from '../../support/material-master-canary';

import { E2E_ENGINEER, E2E_LEAD, ensureCanaryCustomers, ensureCanaryMaterials, makeEstimateCalculable } from './auth';
import { signInAs } from './calculated-estimate';
import { DEVELOPMENT_URL } from './servers';

/**
 * A task of the set-up Engineer made by the set-up Lead through the portal's API, for the specs that need an estimate and no new person (DL-422: the person ledger is +0). Shared by `partform-placeholder.spec.ts`
 * (DEF-145) and `estimate-review-row-return.spec.ts`. Every name and path is invented.
 */
const HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
const FUTURE = '2099-12-31T10:00';

export interface Made {
  readonly code: string;
  readonly estimateId: string;
}

/** A task of the set-up Engineer, made by the signed-in set-up Lead through the API, with a Main Assembly and a Part under it; Prepared when asked (the Engineer's inputs stored, Calculate pressed), on a material of the canary set or the one given. No person is made (DL-422). */
export async function assignedEstimate(page: Page, testInfo: TestInfo, prepared: boolean, materialId: string = defined(MATERIAL_CANARIES[0]).id): Promise<Made> {
  await ensureCanaryCustomers();
  await ensureCanaryMaterials();
  await signInAs(page, E2E_LEAD);
  const context = (await (await page.request.get(`${DEVELOPMENT_URL}/api/v1/options/assign-context`)).json()) as { engineers: ReadonlyArray<{ id: string; name: string }> };
  const engineer = defined(context.engineers.find((candidate) => candidate.name === E2E_ENGINEER.name));
  const created = await page.request.post(`${DEVELOPMENT_URL}/api/v1/tasks`, {
    headers: HEADERS,
    data: { engineerId: engineer.id, customerId: defined(CUSTOMER_CANARIES[0]).id, folderPath: `\\\\e2e-server\\e2e-share\\RFQ-${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`, deadline: FUTURE, title: 'Invented placeholder case', subject: 'Invented subject' },
  });
  expect(created.status()).toBe(201);
  const task = (await created.json()) as { code: string; estimate: { id: string } };
  const estimateId = task.estimate.id;
  const main = await page.request.post(`${DEVELOPMENT_URL}/api/v1/estimates/${estimateId}/nodes`, { headers: HEADERS, data: { parentId: null, nodeKind: 'MAIN_ASSEMBLY' } });
  expect(main.status()).toBe(201);
  const mainId = defined(((await main.json()) as { nodeId: string | null }).nodeId);
  const part = await page.request.post(`${DEVELOPMENT_URL}/api/v1/estimates/${estimateId}/nodes`, { headers: HEADERS, data: { parentId: mainId, nodeKind: 'PART' } });
  expect(part.status()).toBe(201);
  if (prepared) {
    await makeEstimateCalculable(estimateId, materialId);
    await signInAs(page, E2E_ENGINEER);
    const calculated = await page.request.post(`${DEVELOPMENT_URL}/api/v1/estimates/${estimateId}/calculate`, { headers: HEADERS });
    expect(calculated.status(), 'the Engineer\'s Calculate').toBe(200);
    await signInAs(page, E2E_LEAD);
  }
  return { code: task.code, estimateId };
}
