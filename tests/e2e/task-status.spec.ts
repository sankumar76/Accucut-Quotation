import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { z } from 'zod';

import { createDisposableUser, E2E_PASSWORD, expectOnQueue, signInThroughThePage, useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { seedQueueTask, type SeededQueueTask } from './support/queue';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-04.04 T7 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-7): the status of a task, at 360x800, 768x1024 and 1366x768 on the development server. Each test of an Engineer signs in as a
 * person of its own, whose tasks it puts into the database in each state (`support/queue.ts`), so what the person sees is known whatever other specs have assigned. The Lead's
 * tests use the saved browser state of the set-up project. The words are the story's, written out here and not imported, so a changed word fails a test. What the queries return
 * on real rows is `tests/integration/tasks/engineer-status.test.ts`; the confidentiality scan with these states is `tests/e2e/canary-scan.spec.ts`. Every name and path is invented.
 */

const DAY_MS = 86_400_000;
const PRICE_WORDS = /₹|\$|€|price|approved by|override|reason|formula/i;
const ANSWER_KEYS = ['assignedByName', 'code', 'customerName', 'deadlineAt', 'engineer', 'folderPath', 'folderUrl', 'id', 'notes', 'status', 'title'];

const tab = (page: Page, name: string): Locator => page.getByRole('tab', { name: new RegExp(`^${name}`) });
const rowOf = (page: Page, code: string): Locator => page.locator('[data-task-code]:visible', { hasText: code });
const record = z.record(z.string(), z.unknown());

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

interface SeededStates {
  readonly draft: SeededQueueTask;
  readonly submitted: SeededQueueTask;
  readonly approved: SeededQueueTask;
}

/** One task in each state of the estimate. The unlocked state is DRAFT again, so it is the first one (nothing but `estimates.status` is read). */
async function seedStates(engineerId: string): Promise<SeededStates> {
  const later = new Date(Date.now() + 30 * DAY_MS).toISOString();
  return {
    draft: await seedQueueTask(engineerId, later, 'DRAFT', 'E2E status draft'),
    submitted: await seedQueueTask(engineerId, later, 'SUBMITTED', 'E2E status submitted'),
    approved: await seedQueueTask(engineerId, new Date(Date.now() - 10 * DAY_MS).toISOString(), 'APPROVED', 'E2E status approved'),
  };
}

/** Signs in as a new Engineer after the three tasks are in the database, and waits until the tabs are live. */
async function openQueueWithStates(page: Page, testInfo: TestInfo): Promise<{ readonly engineer: { readonly id: string }; readonly states: SeededStates }> {
  await page.context().clearCookies();
  const engineer = await createDisposableUser('queue', testInfo);
  const states = await seedStates(engineer.id);
  await page.goto('/sign-in');
  await signInThroughThePage(page, engineer.email, E2E_PASSWORD);
  await expectOnQueue(page, 'My tasks');
  await waitUntilHydrated(page, '[role="tab"]', 'onMouseDown');
  return { engineer, states };
}

test.describe('an Engineer', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('AC-1, AC-7: the queue says Draft, Submitted and Approved in words with an icon, one badge each, with no sideways scroll and axe 0 violations', async ({ page }, testInfo) => {
    const { states } = await openQueueWithStates(page, testInfo);

    await expect.poll(() => page.locator('[data-task-code]:visible').count()).toBe(2);
    await expect(rowOf(page, states.draft.code).locator('[data-slot="status-badge"]')).toHaveText('Draft');
    await expect(rowOf(page, states.submitted.code).locator('[data-slot="status-badge"]')).toHaveText('Submitted');
    await expect(rowOf(page, states.draft.code).locator('[data-slot="status-badge"] svg')).toHaveCount(1);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    await tab(page, 'Closed').click();
    await expect.poll(() => page.locator('[data-task-code]:visible').count()).toBe(1);
    const approved = rowOf(page, states.approved.code).locator('[data-slot="status-badge"]');
    await expect(approved).toHaveText('Approved');
    await expect(approved.locator('svg')).toHaveCount(1);
    await expect(approved).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-1, AC-2, AC-7: the task header says the status, an approved task shows no amount, and axe finds nothing on the open task', async ({ page }, testInfo) => {
    const { states } = await openQueueWithStates(page, testInfo);

    await page.goto(`/estimates/${states.draft.code}`);
    await expect(page.getByRole('heading', { level: 1, name: states.draft.code })).toBeVisible();
    await expect(page.locator('[data-slot="status-badge"]')).toHaveText('Draft');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    for (const [code, words] of [
      [states.submitted.code, ['Submitted']],
      [states.approved.code, ['Approved and locked']],
    ] as const) {
      await page.goto(`/estimates/${code}`);
      await expect(page.getByRole('heading', { level: 1, name: code })).toBeVisible();
      for (const word of words) await expect(page.locator('[data-slot="status-badge"]')).toContainText(word);
      expect(await page.locator('main').innerText()).not.toMatch(PRICE_WORDS);
    }
  });

  test('AC-2, AC-3: GET /api/v1/tasks/{id} answers the own task in each state with the named keys only, and no price, approver or reason', async ({ page }, testInfo) => {
    const { engineer, states } = await openQueueWithStates(page, testInfo);
    for (const [seeded, status] of [
      [states.draft, 'DRAFT'],
      [states.submitted, 'SUBMITTED'],
      [states.approved, 'APPROVED'],
    ] as const) {
      const response = await page.request.get(`${DEVELOPMENT_URL}/api/v1/tasks/${seeded.id}`);
      expect(response.status(), status).toBe(200);
      const body = record.parse(await response.json());
      expect(Object.keys(body).sort()).toEqual(ANSWER_KEYS);
      expect(body).toMatchObject({ id: seeded.id, code: seeded.code, status, engineer: { id: engineer.id } });
      expect(JSON.stringify(body)).not.toMatch(/price|cost|approver|approvedBy|override|reason|formula|₹/i);
    }
  });

  test('AC-4: another Engineer\'s task, an unknown ID and text that is no ID are the same 404, with the same body apart from the request ID', async ({ page }, testInfo) => {
    await openQueueWithStates(page, testInfo);
    const other = await seedQueueTask((await createDisposableUser('queue', testInfo)).id, new Date(Date.now() + 30 * DAY_MS).toISOString(), 'SUBMITTED', 'E2E belongs to someone else');

    const asked = await Promise.all(
      [other.id, '00000000-0000-4000-8000-00000000dead', 'not-an-id'].map(async (id) => {
        const response = await page.request.get(`${DEVELOPMENT_URL}/api/v1/tasks/${id}`);
        const { requestId, ...rest } = record.parse(await response.json());
        expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
        return { status: response.status(), rest };
      }),
    );
    expect(asked.map((answer) => answer.status)).toEqual([404, 404, 404]);
    expect(asked[1]?.rest).toEqual(asked[0]?.rest);
    expect(asked[2]?.rest).toEqual(asked[0]?.rest);
    expect(JSON.stringify(asked[0])).not.toContain(other.code);
  });
});

test.describe('a Lead', () => {
  test('AC-3, AC-5: GET /api/v1/tasks/{id} answers the same keys and the same status as the Engineer is told, and the queue uses the same words', async ({ page }, testInfo) => {
    const engineer = await createDisposableUser('queue', testInfo);
    const states = await seedStates(engineer.id);

    const response = await page.request.get(`${DEVELOPMENT_URL}/api/v1/tasks/${states.approved.id}`);
    expect(response.status()).toBe(200);
    const body = record.parse(await response.json());
    expect(Object.keys(body).sort()).toEqual(ANSWER_KEYS);
    expect(body['status']).toBe('APPROVED');

    // The queue, on the Closed tab: the same words as for the Engineer. The Lead's list is every Engineer's, so the row is found by its code on the tab.
    await page.goto('/queue');
    await expectOnQueue(page, 'Task queue');
    await waitUntilHydrated(page, '[role="tab"]', 'onMouseDown');
    await tab(page, 'Closed').click();
    const approved = page.locator('[data-slot="status-badge"][data-status="APPROVED"]:visible').first();
    await expect(approved).toHaveText('Approved');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('AC-5: the task header of an Engineer\'s task says the same words, and shows no price', async ({ page }, testInfo) => {
    const engineer = await createDisposableUser('queue', testInfo);
    const states = await seedStates(engineer.id);
    await page.goto(`/estimates/${states.approved.code}`);
    await expect(page.getByRole('heading', { level: 1, name: states.approved.code })).toBeVisible();
    await expect(page.locator('[data-slot="status-badge"]')).toHaveText('Approved and locked');
    expect(await page.locator('main').innerText()).not.toMatch(PRICE_WORDS);
  });
});
