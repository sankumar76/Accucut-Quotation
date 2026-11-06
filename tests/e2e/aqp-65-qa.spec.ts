import { expect, test, type Locator, type Page } from '@playwright/test';

import { createDisposableUser } from './support/auth';
import { waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE } from './support/servers';

/**
 * QA's own checks for STORY-01.04 (AQP-65) at G7: the wiring between the SCR-14 components and the two helpers that the unit
 * tests reach only on their own (master, G6 closure 11045; QLT-78). Signed in as the E2E Admin on the development server, like
 * `users.spec.ts`. Each test works on people made for it, so the widths, repeats and retries never meet on one. Invented data.
 *
 * - (a) Edit with no change: Save closes the dialog, sends no request and shows no message (UX spec v0.14). It reads no
 *   layout, so it is tagged `@one-width` (architect's ruling, Jira 11046; test strategy v0.20 section 10.5).
 * - (b) A "did not open" notice that would be off-screen is brought into view (`revealNearest`). Scrolling depends on the
 *   viewport, so it runs at all three widths.
 */

test.use({ storageState: ADMIN_STATE });

/** The row (table) or card (phone) of a person: whichever of the two is shown. */
function rowOf(page: Page, name: string): Locator {
  return page.locator('[data-user-id]:visible').filter({ hasText: name });
}

async function openUsers(page: Page): Promise<void> {
  await page.goto('/users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  // The buttons are plain HTML until React has attached their handlers; a press before that is lost (DEF-011).
  await waitUntilHydrated(page, 'main button[data-action="add"]');
}

/** Every request a users API route receives that could change something (anything but a read). */
function recordWrites(page: Page): string[] {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/users') && request.method() !== 'GET') {
      writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  return writes;
}

test('[AQP-65 AC-1] edit with no change closes the dialog and sends no request', { tag: '@one-width' }, async ({ page }, testInfo) => {
  const person = await createDisposableUser('managed', testInfo);
  await openUsers(page);
  const writes = recordWrites(page);
  const main = page.getByRole('main');
  const editButton = rowOf(page, person.name).getByRole('button', { name: `Edit ${person.name}` });
  const dialog = page.getByRole('dialog', { name: `Edit ${person.name}` });

  // Nothing touched.
  await editButton.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  // Only spaces added around the name: the trimmed name is the same, so it is still no change.
  await editButton.click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Name').fill(`  ${person.name}  `);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  // Let any request that was going to leave do so before the check.
  await page.waitForLoadState('networkidle');
  expect(writes).toEqual([]);
  await expect(main.getByRole('status')).toHaveCount(0);
  await expect(main.getByRole('alert')).toHaveCount(0);
  await expect(rowOf(page, person.name)).toContainText(person.email);
});

test('[AQP-65 SCR-25] a "did not open" notice that would be off-screen is scrolled into view', async ({ page }, testInfo) => {
  // Enough people that the list runs well below the fold at every width (cards on a phone, a table on the others).
  const PEOPLE = 24;
  for (let index = 0; index < PEOPLE; index += 1) await createDisposableUser('managed', testInfo);
  await openUsers(page);
  // Everything the first load needs has arrived; from here on, the dialogs' code (fetched on the first open) cannot arrive.
  await page.waitForLoadState('networkidle');
  let refused = 0;
  await page.route(/\/_next\/static\/.*\.js(\?.*)?$/, async (route) => {
    refused += 1;
    await route.abort();
  });

  // Go to the last person on the page, so the top of the page, where the notice appears, is out of view.
  const last = page.locator('[data-user-id]:visible').last();
  await last.scrollIntoViewIfNeeded();
  const header = await page.getByRole('heading', { level: 1, name: 'Users' }).boundingBox();
  expect(header, 'the page heading').not.toBeNull();
  expect((header?.y ?? 0) + (header?.height ?? 0), 'the top of the page is scrolled out of view').toBeLessThan(0);

  await last.getByRole('button', { name: /^Edit / }).click();
  const notice = page.getByRole('main').getByRole('alert').filter({ hasText: 'The form did not open.' });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Check your connection and try again.');
  expect(refused, 'the dialogs\' code was asked for and refused').toBeGreaterThan(0);

  // In view: wholly inside the viewport.
  const viewport = page.viewportSize();
  const box = await notice.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0);

  // The next press tries again, and with the code reachable the dialog opens.
  await page.unroute(/\/_next\/static\/.*\.js(\?.*)?$/);
  await last.getByRole('button', { name: /^Edit / }).click();
  await expect(page.getByRole('dialog', { name: /^Edit / })).toBeVisible();
});
