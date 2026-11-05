import { expect, test } from '@playwright/test';

import { E2E_LEAD, E2E_PASSWORD, signInThroughThePage, useFreshAddress } from './support/auth';
import { PRODUCTION_URL } from './support/servers';

/**
 * STORY-10.02 AC-7 in the production build: `/design-system` answers "not found". Since STORY-01.01 the page is
 * rendered per request (it sits behind the sign-in), so the build output cannot prove it any more
 * (`scripts/lib/production-routes.ts`); this asks the production server, signed in, which is the only way to see the
 * route itself rather than the redirect that sends a signed-out visitor to the sign-in page.
 *
 * Both tests check an HTTP status and a redirect, so they read no layout: they are tagged `@one-width` and run in the
 * desktop project only (test strategy section 10.5, AQP-199).
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

test('AC-7: /design-system is not found in the production build, for a signed-in Lead', { tag: '@one-width' }, async ({ page, context }) => {
  await useFreshAddress(context);
  await page.goto('/sign-in');
  await signInThroughThePage(page, E2E_LEAD.email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/queue$/);

  const response = await page.goto('/design-system');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Design system' })).toHaveCount(0);
});

test('AC-7: a signed-out visitor is sent to the sign-in page, which says nothing about the route', { tag: '@one-width' }, async ({ page, context }) => {
  await useFreshAddress(context);
  await page.goto('/design-system');
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
});
