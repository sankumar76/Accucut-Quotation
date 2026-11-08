import { expect, test as setup } from '@playwright/test';

import { ROUTE_MANIFEST } from '../../src/server/http/route-manifest';

import { E2E_ADMIN, E2E_ENGINEER, E2E_LEAD, E2E_PASSWORD, ensureE2eAdmin, ensureE2eUsers, signInThroughThePage, useFreshAddress } from './support/auth';
import { fillPath } from './support/canary-scan';
import { ADMIN_STATE, DEVELOPMENT_URL, PRODUCTION_URL, SIGNED_IN_STATE } from './support/servers';

/**
 * The set-up project: it makes sure the invented users exist, signs the Lead in on the development server, and
 * saves the browser state that the design-system and page-frame specs start from (those pages sit behind the
 * sign-in now). It also compiles the pages those specs open first, so no test pays for it (test strategy section 10).
 */

const COMPILE_TIMEOUT = 120_000;
/** The set-up tests compile pages and hash passwords on a cold machine; they are allowed longer than a test (test strategy section 10). */
const SETUP_TIMEOUT = 180_000;
/** The development-server pages the width projects open. The signed-in Lead can open all three. */
const WARMED_ROUTES = ['/', '/queue', '/design-system'] as const;

setup('create the E2E users and save a signed-in Lead', async ({ page, context }) => {
  setup.setTimeout(SETUP_TIMEOUT);
  await ensureE2eUsers();
  await useFreshAddress(context);

  await page.goto(`${DEVELOPMENT_URL}/sign-in`);
  await signInThroughThePage(page, E2E_LEAD.email, E2E_PASSWORD);
  // The first sign-in compiles the auth route and the queue page on demand, which takes far longer than a test's 5 s
  // expectation on a slow machine; only this set-up pays for it.
  await expect(page).toHaveURL(/\/queue$/, { timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole('heading', { level: 1, name: 'Task queue' })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  // Warm every development-server route the specs open, once, here: with four workers in CI (test strategy section
  // 10.5, AQP-199) several tests would otherwise ask for the same page at once and each wait for its first compile.
  for (const route of WARMED_ROUTES) {
    await page.goto(`${DEVELOPMENT_URL}${route}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  }

  await context.storageState({ path: SIGNED_IN_STATE });
});

/**
 * Warms the PRODUCTION server (STORY-01.03): `next start` loads a route's module on its first request, and a page's module is loaded
 * even to answer "no access", so the first request of each route is slower than the rest. The confidentiality scan opens every page and
 * calls every API route, so it would pay for all of them inside a test's 30 s on a cold server. An Engineer asks for each implemented page and
 * route of the manifest once, here, as the sign-in spec's person would; a page or route this person may not open is answered 403 and still
 * loaded. Only GET is used, so nothing is changed. The manifest is the list, so a new route is warmed with no edit.
 */
setup('warm the production server: every page and API route once, as an Engineer', async ({ browser }) => {
  setup.setTimeout(SETUP_TIMEOUT);
  await ensureE2eUsers();
  const context = await browser.newContext({ baseURL: PRODUCTION_URL });
  try {
    await useFreshAddress(context);
    const page = await context.newPage();
    await page.goto(`${PRODUCTION_URL}/sign-in`);
    await signInThroughThePage(page, E2E_ENGINEER.email, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/queue$/, { timeout: COMPILE_TIMEOUT });
    for (const row of ROUTE_MANIFEST.filter((entry) => entry.status === 'implemented' && entry.roles !== 'public')) {
      const path = fillPath(row.path, 'warm-up');
      if (row.kind === 'page') {
        expect((await page.goto(path))?.status(), path).toBeLessThan(500);
      } else {
        expect((await page.request.get(path)).status(), path).toBeLessThan(500);
      }
    }
    expect((await page.request.get('/api/test-only/leak')).status()).toBe(404);
  } finally {
    await context.close();
  }
});

setup('make the E2E Admin the one active Admin and save a signed-in Admin (the Users spec)', async ({ browser }) => {
  setup.setTimeout(SETUP_TIMEOUT);
  await ensureE2eAdmin();
  const context = await browser.newContext();
  try {
    await useFreshAddress(context);
    const page = await context.newPage();
    await page.goto(`${DEVELOPMENT_URL}/sign-in`);
    await signInThroughThePage(page, E2E_ADMIN.email, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/queue$/, { timeout: COMPILE_TIMEOUT });
    // Warm the page the Users spec opens, so no test pays for its first compile.
    await page.goto(`${DEVELOPMENT_URL}/users`);
    await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible({ timeout: COMPILE_TIMEOUT });
    // And the audit page and its API, for the same reason (STORY-01.07).
    await page.goto(`${DEVELOPMENT_URL}/audit`);
    await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible({ timeout: COMPILE_TIMEOUT });
    const warmedApi = await page.request.get(`${DEVELOPMENT_URL}/api/v1/audit?limit=1`);
    expect(warmedApi.status()).toBe(200);
    // The audit spec makes its entries through the Users API (add a person, change a role), so those two routes are compiled
    // here too: a change to nobody (an ID no one has) is answered 404 and writes nothing.
    const headers = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
    expect((await page.request.get(`${DEVELOPMENT_URL}/api/v1/users`)).status()).toBe(200);
    expect((await page.request.patch(`${DEVELOPMENT_URL}/api/v1/users/00000000-0000-4000-8000-000000000000`, { headers, data: { role: 'LEAD' } })).status()).toBe(404);
    // And the Process master page and its API, for the same reason (STORY-02.01). The page reads the field registry, so CI makes
    // configuration version 1 before the tests (the shard step), as a real install does after its migrations.
    await page.goto(`${DEVELOPMENT_URL}/masters/process`);
    await expect(page.getByRole('heading', { level: 1, name: 'Process master' })).toBeVisible({ timeout: COMPILE_TIMEOUT });
    expect((await page.request.get(`${DEVELOPMENT_URL}/api/v1/process-items`)).status()).toBe(200);
    // A change to nobody (an ID no rate has) is answered 404 and writes nothing, which compiles the route of one rate too.
    expect((await page.request.patch(`${DEVELOPMENT_URL}/api/v1/process-items/00000000-0000-4000-8000-000000000000`, { headers, data: { defaultValue: '1.37' } })).status()).toBe(404);
    expect((await page.request.post(`${DEVELOPMENT_URL}/api/v1/process-items`, { headers, data: {} })).status()).toBe(422);
    // And the Materials page and its three routes (STORY-02.03): nothing is stored (an empty body is 422, an ID no material has is 404).
    await page.goto(`${DEVELOPMENT_URL}/masters/materials`);
    await expect(page.getByRole('heading', { level: 1, name: 'Materials and lists' })).toBeVisible({ timeout: COMPILE_TIMEOUT });
    expect((await page.request.get(`${DEVELOPMENT_URL}/api/v1/materials`)).status()).toBe(200);
    expect((await page.request.post(`${DEVELOPMENT_URL}/api/v1/materials`, { headers, data: {} })).status()).toBe(422);
    expect((await page.request.patch(`${DEVELOPMENT_URL}/api/v1/materials/00000000-0000-4000-8000-000000000000`, { headers, data: { scrapRate: '1.00' } })).status()).toBe(404);
    expect((await page.request.get(`${DEVELOPMENT_URL}/api/v1/options/materials`)).status()).toBe(200);
    await context.storageState({ path: ADMIN_STATE });
  } finally {
    await context.close();
  }
});
