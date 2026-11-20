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
import { DEVELOPMENT_URL } from './servers';

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

/** Gives the one part of the Engineer's canary estimate every input Calculate needs (keeping its picture), with the customer chosen: for a spec whose Engineer filled the form by the screen and now wants a Calculate. */
export async function makeCalculable(owner: E2eUser & { readonly id: string }): Promise<void> {
  await makeCanaryEstimateCalculable(owner.id, ALPHA_MATERIAL_ID, ALPHA_CUSTOMER_ID);
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

/**
 * The Engineer presses Calculate with the request the button sends, **without loading a page first** (AQP-340: a page load of the estimate costs the development server seconds on a loaded runner). The
 * person is signed in without the sign-in screen, and the call carries the portal's own `Origin`, as a call from a page does. For the specs whose subject is what a Lead sees after the press, not the press:
 * `calculateAsEngineer` is for those whose subject is the Engineer's own page. The estimate is Submitted afterwards, as the helper above checks.
 */
export async function calculateWithoutThePage(page: Page, owner: E2eUser & { readonly id: string }, origin: string = DEVELOPMENT_URL): Promise<void> {
  await signInAs(page, owner);
  const answer = await page.request.post(`/api/v1/estimates/${owner.id}/calculate`, { headers: { origin } });
  expect(answer.status(), 'the Calculate of the Engineer').toBe(200);
  expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
}

/**
 * The Engineer presses Calculate on an estimate whose part has 0 in QTY per Assy and goes ahead past the warning (STORY-07.06 AC-6), with the requests the button and its dialog send and **without loading a
 * page**: the first press is the 409 `CALCULATE_ACK_REQUIRED` with the estimate's revision, the second carries that revision as the acknowledgement. The estimate is Submitted afterwards, with one calculation
 * that holds the warning, whose `created_by` is this Engineer.
 */
export async function calculateAnywayWithoutThePage(page: Page, owner: E2eUser & { readonly id: string }, origin: string = DEVELOPMENT_URL): Promise<void> {
  await signInAs(page, owner);
  const url = `/api/v1/estimates/${owner.id}/calculate`;
  const asked = await page.request.post(url, { headers: { origin } });
  expect(asked.status(), 'the first press is asked about the 0').toBe(409);
  const { inputsRevision } = (await asked.json()) as { inputsRevision: number };
  const went = await page.request.post(url, { headers: { origin }, data: { acknowledge: { inputsRevision } } });
  expect(went.status(), 'the Calculate anyway of the Engineer').toBe(200);
  expect(await readEstimateState(owner.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
}
