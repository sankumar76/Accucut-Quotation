import { expect, test as setup } from '@playwright/test';

import { E2E_LEAD, E2E_PASSWORD, ensureE2eUsers, signInThroughThePage, useFreshAddress } from './support/auth';
import { DEVELOPMENT_URL, SIGNED_IN_STATE } from './support/servers';

/**
 * The set-up project: it makes sure the invented users exist, signs the Lead in on the development server, and
 * saves the browser state that the design-system and page-frame specs start from (those pages sit behind the
 * sign-in now). It also compiles the pages those specs open first, so no test pays for it (test strategy section 10).
 */

setup('create the E2E users and save a signed-in Lead', async ({ page, context }) => {
  setup.setTimeout(180_000);
  await ensureE2eUsers();
  await useFreshAddress(context);

  await page.goto(`${DEVELOPMENT_URL}/sign-in`);
  await signInThroughThePage(page, E2E_LEAD.email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/queue$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Task queue' })).toBeVisible();

  // Warm the pages the other specs open.
  await page.goto(`${DEVELOPMENT_URL}/design-system`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto(`${DEVELOPMENT_URL}/`);

  await context.storageState({ path: SIGNED_IN_STATE });
});
