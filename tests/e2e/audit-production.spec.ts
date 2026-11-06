import { expect, test, type Page } from '@playwright/test';
import { z } from 'zod';

import { E2E_AUDIT_CANARY_LABEL, E2E_ENGINEER, E2E_LEAD, E2E_PASSWORD, ensureAuditCanaryEntry, signInThroughThePage, useFreshAddress, type E2eUser } from './support/auth';
import { PRODUCTION_URL } from './support/servers';

/**
 * STORY-01.07 AC-7 (CR-33, negative), on the PRODUCTION build (`next start`), not the development server, for the reason the Users
 * spec gives (TD-06): `/audit` answers a refused role through `forbidden()`, which must be shown to work in a build that ships.
 * A Lead and an Engineer who ask for the page get HTTP 403, the "no access" page (SCR-26), and nothing about any entry: not in the
 * page, not in the data sent with it. An audit entry made by the canary person (the label `E2E_AUDIT_CANARY_LABEL`) is in the
 * database, and that label, and the screen's own words, must appear nowhere in what the Lead and the Engineer receive. The same
 * two people are refused by the API with the same fixed 403 whatever the query says. A signed-out visitor is sent to the sign-in
 * page, and the API answers a signed-out caller 401.
 *
 * Width (test strategy section 10.5, AQP-199): every test here checks an HTTP status, a body or a redirect and reads no layout,
 * so the whole file is tagged `@one-width` and runs in the desktop project only (architect, AQP-74 comment 11078).
 * `tests/unit/one-width-tag.test.ts` pins the exact set.
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

const NO_ACCESS_TITLE = 'You do not have access to this page';
const NO_ACCESS_TEXT = 'Your role does not include this page. If you think it should, ask the Admin.';
/** Text that only the Audit log screen holds. */
const SCREEN_MARKERS = ['Show more entries', 'The portal has no way to edit or delete an entry', 'Audit log, newest first', E2E_AUDIT_CANARY_LABEL];

const problem = z.object({ type: z.literal('about:blank'), title: z.string(), status: z.literal(403), code: z.literal('FORBIDDEN'), requestId: z.string().regex(/^req-[0-9a-f]{8}$/) });
const queries = ['', '?limit=1', '?category=user_change', '?who=00000000-0000-4000-8000-000000000000', '?limit=9999&bogus=1', '?cursor=not-a-cursor'] as const;

const people: ReadonlyArray<readonly [string, E2eUser]> = [
  ['a Lead', E2E_LEAD],
  ['an Engineer', E2E_ENGINEER],
];

/** Signs in through the page. The test has set a client address of its own first (`useFreshAddress`). */
async function signInAs(page: Page, person: E2eUser): Promise<void> {
  await page.goto('/sign-in');
  await signInThroughThePage(page, person.email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/queue$/);
}

for (const [label, person] of people) {
  test.describe(`${label} on the production build`, { tag: '@one-width' }, () => {
    test('/audit answers HTTP 403 with the "no access" page and no entry', async ({ page, context }) => {
      await ensureAuditCanaryEntry();
      await useFreshAddress(context);
      await signInAs(page, person);

      const response = await page.goto('/audit');
      expect(response?.status()).toBe(403);
      await expect(page.getByRole('heading', { level: 1, name: NO_ACCESS_TITLE })).toBeVisible();
      await expect(page.getByText(NO_ACCESS_TEXT)).toBeVisible();

      // The HTML and the data sent with it (the flight payload is in the HTML), and what the browser drew.
      const sent = (await response?.text()) ?? '';
      const drawn = await page.content();
      for (const marker of SCREEN_MARKERS) {
        expect(sent, `the response holds "${marker}"`).not.toContain(marker);
        expect(drawn, `the page holds "${marker}"`).not.toContain(marker);
      }
      await expect(page.getByRole('table')).toHaveCount(0);
      // The menu offers a Lead and an Engineer no Audit log item either.
      await expect(page.getByRole('link', { name: 'Audit log', exact: true })).toHaveCount(0);
    });

    test('GET /api/v1/audit is the same fixed 403 whatever the query says, and sends no entry', async ({ page, context }) => {
      await ensureAuditCanaryEntry();
      await useFreshAddress(context);
      await signInAs(page, person);

      const bodies: string[] = [];
      for (const query of queries) {
        const response = await page.request.get(`/api/v1/audit${query}`);
        expect(response.status(), query).toBe(403);
        const text = await response.text();
        expect(text).not.toContain(E2E_AUDIT_CANARY_LABEL);
        const { requestId, ...fixed } = problem.parse(JSON.parse(text));
        expect(requestId).toMatch(/^req-/);
        bodies.push(JSON.stringify(fixed));
      }
      // One body for every query, apart from the request ID.
      expect(new Set(bodies).size).toBe(1);
    });
  });
}

test('a signed-out visitor is sent to the sign-in page and sees nothing of /audit', { tag: '@one-width' }, async ({ page }) => {
  await ensureAuditCanaryEntry();
  await page.goto('/audit');
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  expect(await page.content()).not.toContain(E2E_AUDIT_CANARY_LABEL);
});

test('a signed-out caller of GET /api/v1/audit gets 401 and no entry', { tag: '@one-width' }, async ({ request }) => {
  await ensureAuditCanaryEntry();
  const response = await request.get('/api/v1/audit');
  expect(response.status()).toBe(401);
  expect(await response.text()).not.toContain(E2E_AUDIT_CANARY_LABEL);
});
