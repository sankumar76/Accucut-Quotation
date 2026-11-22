import { expect, test, type Page } from '@playwright/test';
import { z } from 'zod';

import { approvedEstimate, unlockThroughTheApi, type ApprovedEstimate } from './support/approved-estimate';
import { useFreshAddress } from './support/auth';
import { signInAs } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';
import { withExportTurn } from './support/export-slot';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-CR01.7E (AC-5 to AC-8; CR-01 item 7c; NFR-002, NFR-016 to NFR-018): the download marker, at 360x800, 768x1024 and 1366x768. A Lead downloads the file of an approved estimate and the chip reads "Downloaded 1×" with the last
 * person and time on SCR-10, SCR-06's header and the Closed tab; the Lead unlocks, recalculates and approves again, and every one of them turns amber, "Changed since download", in words and an icon, with no sideways scroll and no axe
 * violation; and the Engineer's own pages hold no marker. The words are the UX spec's, written out here and not imported. Every name is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const JSON_HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
const costsShape = z.object({ calculationId: z.string().min(1) });
const CHIP = '[data-slot="download-chip"]';

/** The Lead downloads the file through the route the button calls, as the page would (one at a time: the export slot). */
async function download(page: Page, estimateId: string): Promise<void> {
  const answer = await withExportTurn(() => page.request.get(`/api/v1/estimates/${estimateId}/export`));
  expect(answer.status(), 'the download').toBe(200);
}

/** The Lead unlocks, recalculates and approves again, each one request on the signed-in context. */
async function approveAgain(page: Page, estimate: ApprovedEstimate): Promise<void> {
  expect(await unlockThroughTheApi(page, estimate.owner.id, 'Invented reason to unlock.')).toBe(200);
  const recalculated = await page.request.post(`/api/v1/estimates/${estimate.owner.id}/recalculate`, { headers: JSON_HEADERS });
  expect(recalculated.status(), 'the Lead\'s Recalculate').toBe(200);
  const costs = await page.request.get(`/api/v1/estimates/${estimate.owner.id}/costs`);
  const { calculationId } = costsShape.parse(await costs.json());
  const approved = await page.request.post(`/api/v1/estimates/${estimate.owner.id}/approve`, { headers: JSON_HEADERS, data: { calculationId, price: '52000.00' } });
  expect(approved.status(), 'the second approval').toBe(200);
}

/** The chip of the estimate's header on SCR-06. */
const headerChip = (page: Page) => page.locator(CHIP).first();

/** Nothing of the chip may run past the screen, and the page has no axe violation. */
async function expectFitsAndAccessible(page: Page): Promise<void> {
  expect(await horizontalOverflow(page)).toBe(0);
  await expectNoAxeViolations(page);
}

test.describe('AC-5, AC-7, AC-8: the marker for a Lead', () => {
  test('"Not downloaded" before a download, "Downloaded 1×" with the last person and time after it, on SCR-10, SCR-06 and the Closed tab', async ({ page }, testInfo) => {
    const estimate = await approvedEstimate(page, testInfo);

    await page.goto(`/estimates/${estimate.code}/export`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Excel export');
    await expect(page.locator(CHIP)).toContainText('Not downloaded');
    await expectFitsAndAccessible(page);

    await download(page, estimate.owner.id);

    await page.goto(`/estimates/${estimate.code}/export`);
    await expect(page.locator(CHIP)).toContainText('Downloaded 1×');
    await expect(page.locator(CHIP)).toContainText('Last downloaded by');
    await expect(page.locator(CHIP)).toContainText('IST');
    await expectFitsAndAccessible(page);

    await page.goto(`/estimates/${estimate.code}`);
    await expect(headerChip(page)).toContainText('Downloaded 1×');
    await expectFitsAndAccessible(page);

    await page.goto(`/queue?tab=closed&assignedBy=anyone&q=${encodeURIComponent(estimate.code)}`);
    const row = page.locator(`[data-task-code="${estimate.code}"] ${CHIP}:visible`);
    await expect(row).toContainText('Downloaded 1×');
    await expectFitsAndAccessible(page);
  });

  test('a Lead who downloads, unlocks and approves again sees amber "Changed since download", in words and an icon, on every screen; a new download makes it "Downloaded 2×"', async ({ page }, testInfo) => {
    const estimate = await approvedEstimate(page, testInfo);
    await download(page, estimate.owner.id);
    await approveAgain(page, estimate);

    await page.goto(`/estimates/${estimate.code}`);
    const chip = headerChip(page);
    await expect(chip).toContainText('Changed since download');
    await expect(chip).toContainText('Downloaded 1×');
    // The amber is never the only cue: the words are text, and the badge holds an icon.
    await expect(chip.locator('[data-slot="badge"] svg')).toHaveCount(1);
    await expectFitsAndAccessible(page);

    await page.goto(`/estimates/${estimate.code}/export`);
    await expect(page.locator(CHIP)).toContainText('Changed since download');
    await expect(page.locator(CHIP)).toContainText('may not match the current approved price');
    await expectFitsAndAccessible(page);

    await page.goto(`/queue?tab=closed&assignedBy=anyone&q=${encodeURIComponent(estimate.code)}`);
    await expect(page.locator(`[data-task-code="${estimate.code}"] ${CHIP}:visible`)).toContainText('Changed since download');
    await expectFitsAndAccessible(page);

    await download(page, estimate.owner.id);
    await page.goto(`/estimates/${estimate.code}`);
    await expect(headerChip(page)).toContainText('Downloaded 2×');
  });

  test('the markers route answers a Lead and is closed to an Engineer with the fixed 403', async ({ page }, testInfo) => {
    const estimate = await approvedEstimate(page, testInfo);
    const queue = z.object({ tasks: z.array(z.object({ id: z.string() })) }).parse(await (await page.request.get(`/api/v1/tasks?tab=closed&assignedBy=anyone&q=${encodeURIComponent(estimate.code)}`)).json());
    const taskId = queue.tasks[0]?.id ?? '';
    expect(taskId).not.toBe('');
    const asLead = await page.request.get(`/api/v1/download-markers?ids=${taskId}`);
    expect(asLead.status()).toBe(200);
    expect(await asLead.json()).toEqual({ markers: [{ taskId, marker: { kind: 'none' } }] });

    await signInAs(page, estimate.owner);
    const asEngineer = await page.request.get(`/api/v1/download-markers?ids=${taskId}`);
    expect(asEngineer.status()).toBe(403);
    expect(await asEngineer.text()).not.toContain('Not downloaded');
  });
});

test.describe('AC-6 (NFR-002): the Engineer sees no marker', () => {
  test('the Engineer\'s task page and queue hold no download marker, even for a downloaded, approved estimate', async ({ page }, testInfo) => {
    const estimate = await approvedEstimate(page, testInfo);
    await download(page, estimate.owner.id);

    await signInAs(page, estimate.owner);
    await page.goto(`/estimates/${estimate.code}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(estimate.code);
    await expect(page.locator(CHIP)).toHaveCount(0);
    expect(await page.content()).not.toMatch(/Downloaded \d+×|Not downloaded|Changed since download/);

    await page.goto('/queue?tab=closed');
    await expect(page.locator(CHIP)).toHaveCount(0);
    expect(await page.content()).not.toMatch(/Downloaded \d+×|Not downloaded|Changed since download/);
  });
});
