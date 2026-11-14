import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { z } from 'zod';

import { createDisposableUser, E2E_PASSWORD, expectOnQueue, signInThroughThePage, useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { seedQueueTask, type SeededQueueTask } from './support/queue';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-04.02 T6, T7 (AC-1 to AC-8): SCR-03 "Task queue" and "My tasks", at 360x800, 768x1024 and 1366x768 on the development server. Each test of an Engineer signs in as
 * a person of its own, whose tasks it puts into the database in any state (`support/queue.ts`), so what the person sees is known whatever other specs have assigned.
 * The Lead's tests use the saved browser state of the set-up project. The words are the UX spec's and the story's, written out here and not imported, so a changed
 * sentence fails a test. What the queries return on real rows is judged in `tests/integration/tasks/queue.test.ts`. Every name and path is invented.
 */

const DAY_MS = 86_400_000;
const NOTE = 'Sorted by deadline, earliest first. Overdue tasks stay in Open as well.';
const MINIMUM_LG = 1024;
const MINIMUM_MD = 768;

const visibleCodes = (page: Page): Promise<string[]> =>
  page.locator('[data-task-code]:visible').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-task-code') ?? ''));
const widthOf = (page: Page): number => page.viewportSize()?.width ?? 0;
const tab = (page: Page, name: string): Locator => page.getByRole('tab', { name: new RegExp(`^${name}`) });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

/** Signs in as a new Engineer, who has no task yet. */
async function signInAsNewEngineer(page: Page, testInfo: TestInfo): Promise<{ readonly id: string; readonly name: string }> {
  await page.context().clearCookies();
  const person = await createDisposableUser('scan', testInfo);
  await page.goto('/sign-in');
  await signInThroughThePage(page, person.email, E2E_PASSWORD);
  await expectOnQueue(page, 'My tasks');
  return person;
}

/** Signs in as a new Engineer after `seed` has put tasks in the database for them, and waits until the tabs are live. Returns the person and what `seed` returned. */
async function openQueueAs<T>(page: Page, testInfo: TestInfo, seed: (engineerId: string) => Promise<T>): Promise<{ readonly person: { readonly id: string; readonly name: string }; readonly seeded: T }> {
  await page.context().clearCookies();
  const person = await createDisposableUser('scan', testInfo);
  const seeded = await seed(person.id);
  await page.goto('/sign-in');
  await signInThroughThePage(page, person.email, E2E_PASSWORD);
  await expectOnQueue(page, 'My tasks');
  await waitUntilHydrated(page, '[role="tab"]', 'onMouseDown');
  return { person, seeded };
}

interface SeededSet {
  readonly lateNight: SeededQueueTask;
  readonly earlyMorning: SeededQueueTask;
  readonly overdue: SeededQueueTask;
  readonly closed: SeededQueueTask;
}

/** Two open tasks with the deadlines of AC-6 (23:30 IST and 03:00 IST, which is the evening before in UTC), one overdue and one closed. */
async function seedFour(engineerId: string): Promise<SeededSet> {
  const now = Date.now();
  return {
    lateNight: await seedQueueTask(engineerId, '2030-03-05T18:00:00.000Z', 'DRAFT', 'E2E late night'),
    earlyMorning: await seedQueueTask(engineerId, '2030-03-05T21:30:00.000Z', 'SUBMITTED', 'E2E early morning'),
    overdue: await seedQueueTask(engineerId, new Date(now - 3 * DAY_MS).toISOString(), 'DRAFT', 'E2E overdue'),
    closed: await seedQueueTask(engineerId, new Date(now - 10 * DAY_MS).toISOString(), 'APPROVED', 'E2E closed'),
  };
}

test.describe('an Engineer', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('AC-1, AC-3, AC-6: the Open, Closed and Overdue tabs with counts, the sort note, only their own tasks by deadline, and the deadlines in IST', async ({ page }, testInfo) => {
    const { seeded: own } = await openQueueAs(page, testInfo, async (id) => {
      const set = await seedFour(id);
      // Another Engineer's task, which must never appear.
      await seedQueueTask((await createDisposableUser('scan', testInfo)).id, '2030-03-01T10:00:00.000Z', 'DRAFT', 'E2E belongs to someone else');
      return set;
    });

    await expect(tab(page, 'Open')).toHaveText('Open3');
    await expect(tab(page, 'Closed')).toHaveText('Closed1');
    await expect(tab(page, 'Overdue')).toHaveText('Overdue1');
    await expect(page.getByText(NOTE)).toBeVisible();
    // Earliest deadline first: the overdue task, then 23:30 IST, then 03:00 IST the next day. The overdue task is in Open as well.
    await expect.poll(() => visibleCodes(page)).toEqual([own.overdue.code, own.lateNight.code, own.earlyMorning.code]);
    await expect(page.locator('[data-task-code]:visible', { hasText: own.lateNight.code })).toContainText('05 Mar 2030, 23:30 IST');
    await expect(page.locator('[data-task-code]:visible', { hasText: own.earlyMorning.code })).toContainText('06 Mar 2030, 03:00 IST');
    await expect(page.getByText('E2E belongs to someone else')).toHaveCount(0);

    await tab(page, 'Closed').click();
    await expect.poll(() => visibleCodes(page)).toEqual([own.closed.code]);
    await tab(page, 'Overdue').click();
    await expect.poll(() => visibleCodes(page)).toEqual([own.overdue.code]);
  });

  test('AC-3: the task code is the one link to the task, the Engineer has no Engineer or Customer column and no Assign button, and the folder has Copy path', async ({ page, context }, testInfo) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const { seeded: task } = await openQueueAs(page, testInfo, (id) => seedQueueTask(id, '2030-03-05T18:00:00.000Z', 'DRAFT', 'E2E <b>markup</b> title'));

    const row = page.locator('[data-task-code]:visible');
    await expect(row.getByRole('link', { name: task.code })).toHaveAttribute('href', `/estimates/${task.code}`);
    await expect(row).toContainText('E2E <b>markup</b> title');
    await expect(page.getByRole('columnheader', { name: 'Engineer' })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Customer' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Assign task' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Assign task' })).toHaveCount(0);
    if (widthOf(page) >= MINIMUM_LG || widthOf(page) < MINIMUM_MD) {
      await expect(row.getByRole('link', { name: '\\\\invented-server\\invented-share\\RFQ-queue' })).toHaveAttribute('href', 'file:////invented-server/invented-share/RFQ-queue');
      await row.getByRole('button', { name: 'Copy path' }).click();
      await expect(page.getByText('Path copied to the clipboard.')).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('\\\\invented-server\\invented-share\\RFQ-queue');
    }
  });

  test('AC-7: no sideways scroll, a card for each task on a phone, Task, Deadline and Status on a tablet, controls of 44 px, and axe 0 violations', async ({ page }, testInfo) => {
    await openQueueAs(page, testInfo, seedFour);
    await expect.poll(() => visibleCodes(page).then((codes) => codes.length)).toBe(3);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    const width = widthOf(page);
    if (width < MINIMUM_MD) {
      await expect(page.locator('li[data-task-code]:visible')).toHaveCount(3);
      await expect(page.getByRole('table')).toBeHidden();
    } else {
      await expect(page.locator('tr[data-task-code]:visible')).toHaveCount(3);
      for (const name of ['Task', 'Deadline (IST)', 'Status']) await expect(page.getByRole('columnheader', { name })).toBeVisible();
      for (const name of ['Folder', 'Assigned by']) await expect(page.getByRole('columnheader', { name })).toHaveCount(width >= MINIMUM_LG ? 1 : 0);
    }
    for (const name of ['Open', 'Closed', 'Overdue']) expect((await tab(page, name).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    for (const button of await page.getByRole('button', { name: 'Copy path' }).all()) {
      if (await button.isVisible()) expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
  });

  test('AC-7: the tabs are a tablist, and the arrow keys move between them and show each tab\'s tasks', async ({ page }, testInfo) => {
    const { seeded: own } = await openQueueAs(page, testInfo, seedFour);

    await expect(page.getByRole('tablist', { name: 'Task queues' })).toBeVisible();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    await tab(page, 'Open').focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Closed')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => visibleCodes(page)).toEqual([own.closed.code]);
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Overdue')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => visibleCodes(page)).toEqual([own.overdue.code]);
    await page.keyboard.press('ArrowLeft');
    await expect(tab(page, 'Closed')).toHaveAttribute('aria-selected', 'true');
  });

  test('AC-4: with no task, each tab says so in the Engineer\'s words, with no Assign button', async ({ page }, testInfo) => {
    await signInAsNewEngineer(page, testInfo);
    await waitUntilHydrated(page, '[role="tab"]', 'onMouseDown');
    await expect(page.getByText('Nothing assigned to you right now')).toBeVisible();
    await expect(page.getByText('When a Lead assigns you a task it appears here, with its folder and deadline.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Assign task' })).toHaveCount(0);
    await expectNoAxeViolations(page);
    await tab(page, 'Closed').click();
    await expect(page.getByText('No closed tasks yet')).toBeVisible();
    await tab(page, 'Overdue').click();
    await expect(page.getByText('Nothing is overdue')).toBeVisible();
  });

  test('AC-4: a tab that cannot be read shows "We could not load the tasks" with Try again, and Try again reads it', async ({ page }, testInfo) => {
    await signInAsNewEngineer(page, testInfo);
    await waitUntilHydrated(page, '[role="tab"]', 'onMouseDown');
    const failing = /\/api\/v1\/tasks\?tab=closed/;
    await page.route(failing, (route) => route.fulfill({ status: 503, contentType: 'application/problem+json', body: '{}' }));
    await tab(page, 'Closed').click();
    const alert = page.getByRole('heading', { name: 'We could not load the tasks' });
    await expect(alert).toBeVisible();
    await expect(page.getByText('Check your connection and try again. Nothing was changed.')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.unroute(failing);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('No closed tasks yet')).toBeVisible();
  });

  test('AC-2, AC-8: the API answers with their own tasks only, in a strict shape with no cost or rate, and refuses a filter that would widen it', async ({ page }, testInfo) => {
    const { person, seeded: otherCode } = await openQueueAs(page, testInfo, async (id) => {
      await seedFour(id);
      return (await seedQueueTask((await createDisposableUser('scan', testInfo)).id, '2030-03-01T10:00:00.000Z', 'DRAFT', 'E2E belongs to someone else')).code;
    });
    const response = await page.request.get(`${DEVELOPMENT_URL}/api/v1/tasks?tab=open&limit=200`);
    expect(response.status()).toBe(200);
    const body = z
      .strictObject({
        tab: z.literal('open'),
        tasks: z.array(
          z.strictObject({
            id: z.string(),
            code: z.string(),
            title: z.string().nullable(),
            engineer: z.strictObject({ id: z.string(), name: z.string() }),
            customerName: z.string().nullable(),
            folderPath: z.string(),
            folderUrl: z.string().nullable(),
            deadlineAt: z.string(),
            status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED']),
            assignedByName: z.string(),
          }),
        ),
        counts: z.strictObject({ open: z.number(), closed: z.number(), overdue: z.number() }),
        nextCursor: z.string().nullable(),
      })
      .parse(await response.json());
    expect(body.tasks.map((task) => task.code)).not.toContain(otherCode);
    expect(new Set(body.tasks.map((task) => task.engineer.id))).toEqual(new Set([person.id]));
    expect(body.tasks).toHaveLength(3);
    expect(body.counts).toEqual({ open: 3, closed: 1, overdue: 1 });
    for (const query of ['engineer=00000000-0000-4000-8000-000000000000', 'tab=all', 'limit=0', 'cursor=junk']) {
      expect((await page.request.get(`${DEVELOPMENT_URL}/api/v1/tasks?${query}`)).status(), query).toBe(422);
    }
    expect((await page.request.post(`${DEVELOPMENT_URL}/api/v1/tasks`, { headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' }, data: {} })).status()).toBe(403);
  });
});

test.describe('a Lead', () => {
  test('AC-2, AC-3, AC-7: sees every Engineer\'s tasks with the Engineer, Customer, Folder and Assigned by columns by width, "Not chosen yet", and the Assign task button', async ({ page }, testInfo) => {
    const engineer = await createDisposableUser('scan', testInfo);
    const seeded = await seedQueueTask(engineer.id, '2000-01-01T00:00:00.000Z', 'DRAFT', 'E2E lead view');
    await page.goto('/queue');
    await expectOnQueue(page, 'Task queue');
    await waitUntilHydrated(page, '[role="tab"]', 'onMouseDown');
    await expect(tab(page, 'Open')).toBeVisible();
    await expect(page.getByText(NOTE)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Assign task' }).first()).toBeVisible();
    // The earliest deadline is first, so this task is on the first page.
    const row = page.locator('[data-task-code]:visible', { hasText: seeded.code });
    await expect(row).toContainText(engineer.name);
    await expect(row).toContainText('Not chosen yet');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    const width = widthOf(page);
    if (width >= MINIMUM_MD) {
      await expect(page.getByRole('columnheader', { name: 'Engineer' })).toBeVisible();
      for (const name of ['Customer', 'Folder', 'Assigned by']) await expect(page.getByRole('columnheader', { name })).toHaveCount(width >= MINIMUM_LG ? 1 : 0);
    }
  });

  test('AC-2, AC-5: GET /api/v1/tasks answers a Lead with every task, and a signed-out caller with 401', async ({ page, browser }, testInfo) => {
    const engineer = await createDisposableUser('scan', testInfo);
    const seeded = await seedQueueTask(engineer.id, '2030-03-01T10:00:00.000Z', 'DRAFT', 'E2E lead api');
    const response = await page.request.get(`${DEVELOPMENT_URL}/api/v1/tasks?tab=open&limit=200`);
    expect(response.status()).toBe(200);
    const codes = z.object({ tasks: z.array(z.object({ code: z.string() })) }).parse(await response.json()).tasks.map((task) => task.code);
    expect(codes).toContain(seeded.code);

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      expect((await context.request.get(`${DEVELOPMENT_URL}/api/v1/tasks?tab=open`)).status()).toBe(401);
      const signedOut = await context.newPage();
      await signedOut.goto(`${DEVELOPMENT_URL}/queue`);
      await expect(signedOut).toHaveURL(/\/sign-in/);
    } finally {
      await context.close();
    }
  });
});
