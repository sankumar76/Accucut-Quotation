import { expect, test, type Page } from '@playwright/test';

import { ROUTE_MANIFEST } from '../../src/server/http/route-manifest';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { headProblems } from '../support/head-tags';

import { createDisposableUser, E2E_ADMIN, E2E_ENGINEER, E2E_PASSWORD, ensureCanaryCustomers, signInWithoutThePage, useFreshAddress } from './support/auth';
import { PRODUCTION_URL } from './support/servers';

/**
 * STORY-10.03 (AQP-308) AC-6: the tag rules of AC-1 to AC-4, applied to the real HTML of the BUILT app (`next start`, the artefact that ships), with the
 * requests a crawler or a link preview would make and no browser layout. Every page of the route manifest is asked for, signed in as the Admin (who may open
 * all of them), with a task and a customer that really exist behind the two addresses that carry an ID. A page that the build hides (`/design-system`), an
 * address that no route serves and a page refused to a role are answered by the system pages of SCR-26 (404 and 403), and those are judged too (AC-1 names them).
 * `/sign-in` is read signed out. AC-2 adds that, signed in, the app serves no sitemap and no robots file (the proxy would turn a signed-out request away first).
 *
 * Width (test strategy section 10.5, AQP-199): each test reads an HTTP answer and the tags in it, never a size, a position or an arrangement, so every test is
 * tagged `@one-width` and runs in the desktop project only. The sign-in is made with the two calls the page makes (`signInWithoutThePage`), without loading it.
 * `tests/unit/one-width-tag.test.ts` pins the exact set.
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

/** A path that no route serves and no person would ask for. */
const UNKNOWN_PATH = '/no-such-page-aqp-308';
/** The row of the cost-details address; the page answers "not found" when the task has not been calculated, and its tags are then those of the system page. */
const COST_DETAILS_SLNO = '1';

/** Asks for `path` and reads the tags of the answer. The status is returned too, so a test can say what the address was. */
async function tagsOf(page: Page, path: string): Promise<{ readonly status: number; readonly problems: string[] }> {
  const response = await page.request.get(path);
  const html = await response.text();
  expect(html.length, `${path} answered no HTML`).toBeGreaterThan(0);
  return { status: response.status(), problems: headProblems(html) };
}

/** The addresses of the manifest's implemented pages, with the IDs of a task and a customer that exist. */
function pageAddresses(taskCode: string, customerId: string): string[] {
  return ROUTE_MANIFEST.filter((row) => row.kind === 'page' && row.status === 'implemented')
    .map((row) => row.path.replace('[code]', taskCode).replace('[slNo]', COST_DETAILS_SLNO).replace('[id]', customerId));
}

test('AC-6 (AC-1 to AC-4) and AC-2: every page of the app, signed in as the Admin, has the right tags, and the app serves no sitemap and no robots file', { tag: '@one-width' }, async ({ page, context }, testInfo) => {
  await ensureCanaryCustomers();
  const owner = await createDisposableUser('scan', testInfo);
  const taskCode = canaryTaskCodeFor(owner.id);
  const customer = CUSTOMER_CANARIES[0];
  if (customer === undefined) throw new Error('The customer canary has no row.');
  await useFreshAddress(context);
  await signInWithoutThePage(page, E2E_ADMIN.email, E2E_PASSWORD);

  const addresses = [...pageAddresses(taskCode, customer.id), UNKNOWN_PATH];
  // A scan that read nothing would pass for the wrong reason: the manifest holds at least the pages that exist today.
  expect(addresses.length).toBeGreaterThanOrEqual(17);

  const problems: Record<string, string[]> = {};
  const statuses: Record<string, number> = {};
  for (const path of addresses) {
    const answer = await tagsOf(page, path);
    statuses[path] = answer.status;
    if (answer.problems.length > 0) problems[path] = answer.problems;
  }
  expect(problems).toEqual({});

  // The two addresses that carry an ID open for the Admin (the task and the customer are real), so their own tags were judged, not a "not found" page's.
  expect(statuses[`/estimates/${taskCode}`], 'the estimate page opens for the Admin').toBe(200);
  expect(statuses[`/masters/customers/${customer.id}`], 'the customer page opens for the Admin').toBe(200);
  expect(statuses[UNKNOWN_PATH], 'an address that no route serves').toBe(404);

  // AC-2: no sitemap and no robots file. A robots.txt that said "Allow" would open what the tags close, and a sitemap would list the pages.
  for (const path of ['/sitemap.xml', '/robots.txt']) {
    expect((await page.request.get(path)).status(), `${path} is not served`).toBe(404);
  }
});

test('AC-6 (AC-1 to AC-4): the page that refuses a role (SCR-26 "no access", HTTP 403) has the right tags', { tag: '@one-width' }, async ({ page, context }) => {
  await useFreshAddress(context);
  await signInWithoutThePage(page, E2E_ENGINEER.email, E2E_PASSWORD);
  const answer = await tagsOf(page, '/users');
  expect(answer.status, 'an Engineer is refused the Users page').toBe(403);
  expect(answer.problems).toEqual([]);
});

test('AC-6 (AC-1 to AC-4) and AC-2: the sign-in page, signed out, has the right tags and says "do not index"', { tag: '@one-width' }, async ({ page }) => {
  const signIn = await tagsOf(page, '/sign-in');
  expect(signIn.status).toBe(200);
  expect(signIn.problems).toEqual([]);
});
