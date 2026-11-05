import { expect, test as setup } from '@playwright/test';

import { E2E_LEAD, E2E_PASSWORD, ensureE2eUsers, signInThroughThePage, useFreshAddress } from './support/auth';
import { DEVELOPMENT_URL, SIGNED_IN_STATE } from './support/servers';

/**
 * The set-up project: it makes sure the invented users exist, signs the Lead in on the development server, and
 * saves the browser state that the design-system and page-frame specs start from (those pages sit behind the
 * sign-in now). It also compiles the pages those specs open first, so no test pays for it (test strategy section 10).
 */

const COMPILE_TIMEOUT = 120_000;
/** The development-server pages the width projects open. The signed-in Lead can open all three. */
const WARMED_ROUTES = ['/', '/queue', '/design-system'] as const;

setup('create the E2E users and save a signed-in Lead', async ({ page, context }) => {
  setup.setTimeout(180_000);
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
