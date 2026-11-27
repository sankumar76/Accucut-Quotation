import { readFile } from 'node:fs/promises';

import { expect, test, type Page, type Response } from '@playwright/test';

import { createDisposableUser, E2E_PASSWORD, expectOnQueue, putPictureOnCanaryPart, readEstimateState, signInThroughThePage, useFreshAddress } from '../e2e/support/auth';
import { calculateWithoutThePage, engineerWithEstimate, makeCalculable, signInAs, signInAsLead } from '../e2e/support/calculated-estimate';
import { waitUntilHydrated } from '../e2e/support/design-system';
import { withExportTurn } from '../e2e/support/export-slot';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { control, nextSave, openForm, waitForForm } from '../e2e/support/part-form';

/**
 * STORY-10.08 AC-6 (NFR-019): the five main journeys in three engines, at 360 and 1366 px: sign-in, the queue, the estimate form and Calculate, review and approve, and export. They are the
 * same tests in every `*-360` and `*-1366` project of `playwright.sweep.config.ts` (Chromium, Firefox and WebKit), so a result differs between engines only because the engine differs. They use the
 * mouse (the keyboard flows are `keyboard-flows.spec.ts`), and a person of their own each, signed in on a client address of their own.
 *
 * A journey that cannot pass in one engine is skipped by name below, with its reason and an issue number, in `KNOWN_ENGINE_FAULTS`; the list is empty until a run finds one, and a blanket
 * skip of an engine or a file is never used (AC-6). The sign-in journey is the one that goes through the real browser's cookie store, so it is the first to show an engine that refuses a cookie.
 */

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

/** Journey name by engine, with the issue that tracks it. Empty: nothing is known to fail. */
const KNOWN_ENGINE_FAULTS: ReadonlyArray<{ readonly journey: string; readonly engine: 'chromium' | 'firefox' | 'webkit'; readonly issue: string; readonly reason: string }> = [];

const FILE_NAME = /^[^\s/\\:*?"<>|]+_\d{2}-\d{2}-\d{4}\.xlsx$/u;
const ZIP_MAGIC = [0x50, 0x4b];

const calculateButton = (page: Page) => page.locator('#calculate-button');
const isCalculate = (response: Response): boolean => response.request().method() === 'POST' && /\/api\/v1\/estimates\/[^/]+\/calculate$/.test(new URL(response.url()).pathname);

function skipWhenKnownFault(journey: string, engine: string): void {
  const known = KNOWN_ENGINE_FAULTS.find((fault) => fault.journey === journey && fault.engine === engine);
  test.skip(known !== undefined, known === undefined ? '' : `${known.reason} (${known.issue})`);
}

test.describe('AC-6: the five journeys', () => {
  test('sign-in: an Engineer signs in on SCR-01, lands on the queue, and is still signed in after a reload', async ({ page, browserName }, testInfo) => {
    skipWhenKnownFault('sign-in', browserName);
    const owner = await createDisposableUser('scan', testInfo);
    await page.goto('/sign-in');
    await signInThroughThePage(page, owner.email, E2E_PASSWORD);
    await expectOnQueue(page, 'My tasks');
    // The session is a cookie of the production build (Secure, prefixed): the reload shows that this engine kept it.
    await page.reload();
    await expectOnQueue(page, 'My tasks');
  });

  test('queue: the Engineer sees the task and opens it from the list', async ({ page, browserName }, testInfo) => {
    skipWhenKnownFault('queue', browserName);
    const owner = await createDisposableUser('scan', testInfo);
    const code = canaryTaskCodeFor(owner.id);
    await signInAs(page, owner);
    await page.goto('/queue');
    await expectOnQueue(page, 'My tasks');
    await page.getByRole('main').getByRole('link', { name: code, exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/estimates/${code}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Estimate ${code}`);
  });

  test('estimate form and Calculate: a field is saved when it is left, and Calculate prepares the estimate', async ({ page, browserName }, testInfo) => {
    skipWhenKnownFault('estimate-form', browserName);
    const owner = await openForm(page, testInfo);
    await makeCalculable(owner);
    await page.reload();
    await waitForForm(page);

    await control(page, 'B').fill('Journey part');
    const saved = nextSave(page, 'B');
    await control(page, 'B').blur();
    expect(await saved, 'the field is saved when it is left').toBe(200);

    await waitUntilHydrated(page, '#calculate-button');
    const answered = page.waitForResponse(isCalculate);
    await calculateButton(page).click();
    expect((await answered).status(), 'the Calculate of the Engineer').toBe(200);
    await expect(calculateButton(page)).toHaveText('Prepared');
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 1 });
  });

  test('review and approve: a Lead opens the calculated estimate, approves and locks it', async ({ page, browserName }, testInfo) => {
    skipWhenKnownFault('review-approve', browserName);
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await signInAsLead(page, testInfo);
    await page.goto(`/estimates/${code}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Estimate ${code}`);
    await expect(page.locator('#review-approve')).toBeEnabled();
    await waitUntilHydrated(page, '#review-approve');
    await page.locator('#review-approve').click();
    const dialog = page.getByRole('dialog', { name: 'Approve and lock' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Approve and lock' }).click();
    await expect(page.locator('#review-approved-notice')).toBeVisible();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'APPROVED', calculations: 1 });
  });

  test('export: a Lead downloads the workbook, named after the customer, the task and the date', async ({ page, browserName }, testInfo) => {
    skipWhenKnownFault('export', browserName);
    const { owner, code } = await engineerWithEstimate(testInfo);
    await putPictureOnCanaryPart(owner.id);
    await calculateWithoutThePage(page, owner);
    await signInAsLead(page, testInfo);
    await page.goto(`/estimates/${code}/export`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Excel export');
    const button = page.getByRole('button', { name: 'Download .xlsx' });
    await expect(button).toBeEnabled();
    await waitUntilHydrated(page, '#export-download');
    const [file] = await withExportTurn(() => Promise.all([page.waitForEvent('download'), button.click()]));
    expect(file.suggestedFilename()).toMatch(FILE_NAME);
    expect(file.suggestedFilename()).toContain('_Canary-subject_');
    // An .xlsx is a zip: its first two bytes are "PK".
    const bytes = await readFile(await file.path());
    expect([...bytes.subarray(0, ZIP_MAGIC.length)]).toEqual(ZIP_MAGIC);
  });
});
