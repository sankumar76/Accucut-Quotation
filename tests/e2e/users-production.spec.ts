import { expect, test, type Page } from '@playwright/test';
import { z } from 'zod';

import { E2E_CANARY, E2E_ENGINEER, E2E_LEAD, E2E_PASSWORD, ensureCanaryUser, signInThroughThePage, useFreshAddress, type E2eUser } from './support/auth';
import { PRODUCTION_URL } from './support/servers';

/**
 * STORY-01.04 T6, AC-6, and the architect's guardrail 4 (TD-06, GitHub #80), on the PRODUCTION build (`next start`), not the
 * development server. `/users` answers a refused role through `forbidden()`, which is experimental in Next.js 16.4.3 behind
 * `experimental.authInterrupts`; a production build is where it must be shown to work. A Lead and an Engineer who ask for
 * the page get HTTP 403, the "no access" page (SCR-26), and nothing about anyone: not in the page, not in the data the
 * server sends with it. A canary person is put in the database, and their name and address must appear nowhere in what
 * the Lead and the Engineer receive. The same people are refused by the API with the same fixed 403, for a real ID and an
 * invented one. A signed-out visitor is sent to the sign-in page.
 *
 * Width (test strategy section 10.5, AQP-199): every test here checks an HTTP status, a body or a redirect and reads no layout,
 * so the whole file is tagged `@one-width` and runs in the desktop project only.
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

const NO_ACCESS_TITLE = 'You do not have access to this page';
const NO_ACCESS_TEXT = 'Your role does not include this page. If you think it should, ask the Admin.';
const INVENTED_ID = '00000000-0000-4000-8000-000000000000';
/** Text that only the Users screen holds. */
const SCREEN_MARKERS = ['Add user', 'Create and deactivate users', 'Reset password for', E2E_CANARY.name, E2E_CANARY.email];

const problem = z.object({ type: z.literal('about:blank'), title: z.string(), status: z.literal(403), code: z.literal('FORBIDDEN'), requestId: z.string().regex(/^req-[0-9a-f]{8}$/) });

const people: ReadonlyArray<readonly [string, E2eUser]> = [
  ['Lead', E2E_LEAD],
  ['Engineer', E2E_ENGINEER],
];

/** Signs in through the page. The test has set a client address of its own first (`useFreshAddress`). */
async function signInAs(page: Page, person: E2eUser): Promise<void> {
  await page.goto('/sign-in');
  await signInThroughThePage(page, person.email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/queue$/);
}

for (const [label, person] of people) {
  test.describe(`a ${label} on the production build`, { tag: '@one-width' }, () => {
    test(`TD-06: /users answers HTTP 403 with the "no access" page and no page data`, async ({ page, context }) => {
      await ensureCanaryUser();
      await useFreshAddress(context);
      await signInAs(page, person);

      const response = await page.goto('/users');
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
      // The menu offers a Lead and an Engineer no Users item either.
      await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
    });

    test('the API refuses with the same fixed 403 for a real ID and an invented one, and sends no data', async ({ page, context }) => {
      const canaryId = await ensureCanaryUser();
      await useFreshAddress(context);
      await signInAs(page, person);
      const headers = { origin: PRODUCTION_URL, 'content-type': 'application/json' };

      const calls = [
        () => page.request.get('/api/v1/users'),
        () => page.request.post('/api/v1/users', { headers, data: { name: 'E2E Nobody', email: 'e2e.nobody@example.test', role: 'ENGINEER', password: 'invented-1' } }),
        (id: string) => page.request.patch(`/api/v1/users/${id}`, { headers, data: { name: 'E2E Renamed' } }),
        (id: string) => page.request.post(`/api/v1/users/${id}/password-reset`, { headers, data: { password: 'invented-2' } }),
      ];
      const bodies: string[] = [];
      for (const call of calls) {
        for (const id of [canaryId, INVENTED_ID]) {
          const response = await call(id);
          expect(response.status()).toBe(403);
          const text = await response.text();
          for (const marker of [E2E_CANARY.name, E2E_CANARY.email]) expect(text).not.toContain(marker);
          const { requestId, ...fixed } = problem.parse(JSON.parse(text));
          expect(requestId).toMatch(/^req-/);
          bodies.push(JSON.stringify(fixed));
        }
      }
      // One body for every route and every ID, apart from the request ID.
      expect(new Set(bodies).size).toBe(1);
    });
  });
}

test('a signed-out visitor is sent to the sign-in page and sees nothing of /users', { tag: '@one-width' }, async ({ page }) => {
  await page.goto('/users');
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  expect(await page.content()).not.toContain(E2E_CANARY.name);
});
