import { expect, type Page, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../../support/customer-canary';
import { defined } from '../../support/defined';
import { canaryTaskCodeFor } from '../../support/estimate-recipe';
import { MATERIAL_CANARIES } from '../../support/material-master-canary';

import {
  createDisposableUser,
  E2E_ADMIN,
  E2E_PASSWORD,
  ensureCanaryCustomers,
  ensureCanaryMaterials,
  makeCanaryEstimateCalculable,
  readEstimateState,
  signInWithoutThePage,
  type E2eUser,
} from './auth';

/**
 * A calculated estimate for the specs of the Lead's screens (STORY-06.03): an Engineer of the test's own with the canary estimate made ready, who presses Calculate through the portal (the same
 * request the button sends), and a Lead or an Admin who then opens a page of it. Each test makes its own Engineer, so no two ever share an estimate. Every name and path is invented.
 */

const ALPHA_CUSTOMER_ID = defined(CUSTOMER_CANARIES[0]).id;
const ALPHA_MATERIAL_ID = defined(MATERIAL_CANARIES[0]).id;

/**
 * Signs the person in without the sign-in screen and the queue behind it (`signInWithoutThePage`): these specs open an estimate page next, and the two page loads cost the development server a
 * quarter of a test's 30 s on a loaded runner (AQP-340). Every caller goes to a page, or already stands on one, right after it.
 */
export async function signInAs(page: Page, person: E2eUser): Promise<void> {
  await page.context().clearCookies();
  await signInWithoutThePage(page, person.email, E2E_PASSWORD);
}

/** An Engineer with an estimate that can be calculated: the customer chosen and one part holding every input. */
export async function engineerWithEstimate(testInfo: TestInfo): Promise<{ readonly owner: E2eUser & { readonly id: string }; readonly code: string }> {
  await ensureCanaryCustomers();
  await ensureCanaryMaterials();
  const owner = await createDisposableUser('scan', testInfo);
  await makeCanaryEstimateCalculable(owner.id, ALPHA_MATERIAL_ID, ALPHA_CUSTOMER_ID);
  return { owner, code: canaryTaskCodeFor(owner.id) };
}

/** The Engineer presses Calculate through the portal, and the estimate is Submitted. */
export async function calculateAsEngineer(page: Page, owner: E2eUser & { readonly id: string }, code: string): Promise<void> {
  await signInAs(page, owner);
  await page.goto(`/estimates/${code}`);
  const status = await page.evaluate(async (id) => (await fetch(`/api/v1/estimates/${id}/calculate`, { method: 'POST' })).status, owner.id);
  expect(status).toBe(200);
  expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
}

/** Signs in as a Lead (made for the test) or as the one Admin of the database. */
export async function signInAsLead(page: Page, testInfo: TestInfo, role: 'LEAD' | 'ADMIN' = 'LEAD'): Promise<void> {
  // There is one active Admin in the database (the E2E Admin of the setup project), so an Admin is not made for the test.
  const person = role === 'ADMIN' ? E2E_ADMIN : await createDisposableUser('axe', testInfo, role);
  await signInAs(page, person);
}
