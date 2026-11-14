import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { z } from 'zod';

import { createDisposableUser, E2E_PASSWORD, expectOnQueue, signInThroughThePage, useFreshAddress, type E2eUser } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { seedQueueTask } from './support/queue';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-04.03 T5 (AC-1 to AC-5, AC-7): the overdue cues of SCR-03 and the bell of SCR-25, at 360x800, 768x1024 and 1366x768 on the development server. Every test signs in as a
 * person of its own and seeds only the tasks it counts (`support/queue.ts`), so the bell reads that person's count whatever other specs have put in the shared database. The
 * Admin's count is every overdue task, so for the Admin the test seeds its own and asserts at least those (the exact count per role is `tests/integration/tasks/bell-count.test.ts`).
 * The words are the story's and the UX spec's, written out here and not imported, so a changed sentence fails a test. Every name and path is invented.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const MINIMUM_MD = 768;
const KEY_PRESSES_TO_REACH_BELL = 14;

/** A deadline `milliseconds` before now, as the ISO 8601 instant the seed takes. */
const ago = (milliseconds: number): string => new Date(Date.now() - milliseconds).toISOString();
/** Three days and five hours ago: "Overdue by 3 d 5 h" stays true for an hour after the seed, and no test runs that long. */
const LATE = 3 * DAY_MS + 5 * HOUR_MS;
const AHEAD = '2030-03-05T18:00:00.000Z';

const widthOf = (page: Page): number => page.viewportSize()?.width ?? 0;
const tab = (page: Page, name: string): Locator => page.getByRole('tab', { name: new RegExp(`^${name}`) });
const visibleCodes = (page: Page): Promise<string[]> =>
  page.locator('[data-task-code]:visible').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-task-code') ?? ''));

const meSchema = z.looseObject({ overdueCount: z.number().int().nonnegative() });

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

test.use({ storageState: { cookies: [], origins: [] } });

/** Signs in through the page as a new person of the role, after `seed` has put tasks in the database for them, and waits until the tabs are live. */
async function openAs<T>(page: Page, testInfo: TestInfo, role: E2eUser['role'], seed: (person: E2eUser & { readonly id: string }) => Promise<T>): Promise<{ readonly person: E2eUser & { readonly id: string }; readonly seeded: T }> {
  await page.context().clearCookies();
  const person = await createDisposableUser('bell', testInfo, role);
  const seeded = await seed(person);
  await page.goto('/sign-in');
  await signInThroughThePage(page, person.email, E2E_PASSWORD);
  await expectOnQueue(page, role === 'ENGINEER' ? 'My tasks' : 'Task queue');
  await waitUntilHydrated(page, '[role="tab"]', 'onMouseDown');
  return { person, seeded };
}

/** Three overdue tasks (one of them submitted), and a task that is not due, and a closed one with a past deadline, which are not counted. */
async function seedForEngineer(engineerId: string): Promise<ReadonlyArray<string>> {
  const overdue = [
    await seedQueueTask(engineerId, ago(LATE), 'DRAFT', 'E2E late one'),
    await seedQueueTask(engineerId, ago(2 * DAY_MS), 'SUBMITTED', 'E2E late two'),
    await seedQueueTask(engineerId, ago(30 * 60_000), 'DRAFT', 'E2E late three'),
  ];
  await seedQueueTask(engineerId, AHEAD, 'DRAFT', 'E2E not due');
  await seedQueueTask(engineerId, ago(10 * DAY_MS), 'APPROVED', 'E2E closed');
  return overdue.map((task) => task.code);
}

async function expectBellReachableByKeyboard(page: Page, bell: Locator): Promise<void> {
  for (let presses = 0; presses < KEY_PRESSES_TO_REACH_BELL; presses += 1) {
    if (await bell.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(bell).toBeFocused();
}

test.describe('an Engineer', () => {
  test('AC-2, AC-4, AC-7: the bell shows their own overdue count with the name "Overdue tasks: 3", at 44 px, in the top bar at every width, with no sideways scroll and axe 0 violations', async ({ page }, testInfo) => {
    await openAs(page, testInfo, 'ENGINEER', (person) => seedForEngineer(person.id));
    const bell = page.getByRole('link', { name: 'Overdue tasks: 3' });
    await expect(bell).toBeVisible();
    const box = await bell.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    // The bell is in the top bar (the banner), whatever the width.
    await expect(page.getByRole('banner').getByRole('link', { name: 'Overdue tasks: 3' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-2: GET /api/v1/me returns overdueCount, the same number the bell shows, and only the five fields', async ({ page }, testInfo) => {
    await openAs(page, testInfo, 'ENGINEER', (person) => seedForEngineer(person.id));
    const response = await page.request.get(`${DEVELOPMENT_URL}/api/v1/me`);
    expect(response.status()).toBe(200);
    const body = meSchema.parse(await response.json());
    expect(body.overdueCount).toBe(3);
    expect(Object.keys(body).sort()).toEqual(['email', 'name', 'navigation', 'overdueCount', 'role']);
  });

  test('AC-3, AC-7: the bell is reached with the keyboard and opens the Overdue tab, which lists exactly the overdue tasks, each with the clock icon, "Overdue by", and the amber bar', async ({ page }, testInfo) => {
    const { seeded: overdueCodes } = await openAs(page, testInfo, 'ENGINEER', (person) => seedForEngineer(person.id));
    const bell = page.getByRole('link', { name: 'Overdue tasks: 3' });
    await expectBellReachableByKeyboard(page, bell);
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/queue\?tab=overdue$/);
    await expect(tab(page, 'Overdue')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'Overdue')).toHaveText('Overdue3');
    await expect.poll(() => visibleCodes(page)).toHaveLength(3);
    expect([...(await visibleCodes(page))].sort()).toEqual([...overdueCodes].sort());
    await expect(page.getByText('3 tasks are overdue')).toBeVisible();

    // The three cues together on every overdue row: the words, the clock icon and the bar. The earliest deadline is first.
    const rows = page.locator('[data-task-code]:visible');
    await expect(rows.first()).toContainText('Overdue by 3 d 5 h');
    await expect(rows.nth(1)).toContainText('Overdue by 2 d');
    await expect(rows.nth(2)).toContainText(/Overdue by 3\d min/);
    await expect(page.locator('[data-overdue-marker]:visible')).toHaveCount(3);
    await expect(page.locator('[data-overdue-marker]:visible svg.lucide-clock')).toHaveCount(3);
    for (const row of await rows.all()) {
      const bar = widthOf(page) >= MINIMUM_MD ? row.locator('> :first-child') : row;
      await expect(bar).toHaveCSS('border-left-width', '4px');
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-1: a task that is not due, and one that is closed, carry no overdue cue in the Open and Closed tabs', async ({ page }, testInfo) => {
    await openAs(page, testInfo, 'ENGINEER', (person) => seedForEngineer(person.id));
    // Open holds the three overdue tasks and the one not due; only the three are marked.
    await expect.poll(() => visibleCodes(page).then((codes) => codes.length)).toBe(4);
    await expect(page.locator('[data-overdue-marker]:visible')).toHaveCount(3);
    await tab(page, 'Closed').click();
    await expect.poll(() => visibleCodes(page).then((codes) => codes.length)).toBe(1);
    await expect(page.locator('[data-overdue-marker]')).toHaveCount(0);
    await expect(page.getByText('Overdue by')).toHaveCount(0);
  });

  test('AC-1: one overdue task is worded in the singular, "1 task is overdue", and the bell says "Overdue tasks: 1"', async ({ page }, testInfo) => {
    await openAs(page, testInfo, 'ENGINEER', async (person) => seedQueueTask(person.id, ago(LATE), 'DRAFT', 'E2E only late one'));
    await expect(page.getByRole('link', { name: 'Overdue tasks: 1' })).toBeVisible();
    await tab(page, 'Overdue').click();
    await expect(page.getByText('1 task is overdue')).toBeVisible();
    await expect(page.getByText('1 tasks are overdue')).toHaveCount(0);
  });

  test('AC-5: with nothing overdue the bell has no badge and is still named "Overdue tasks", and the count is 0', async ({ page }, testInfo) => {
    await openAs(page, testInfo, 'ENGINEER', async (person) => seedQueueTask(person.id, AHEAD, 'DRAFT', 'E2E not due either'));
    const bell = page.getByRole('link', { name: 'Overdue tasks', exact: true });
    await expect(bell).toBeVisible();
    await expect(bell).toHaveText('');
    await expect(bell.locator('span')).toHaveCount(0);
    const me = meSchema.parse(await (await page.request.get(`${DEVELOPMENT_URL}/api/v1/me`)).json());
    expect(me.overdueCount).toBe(0);
    await expectNoAxeViolations(page);
  });
});

test.describe('a Lead', () => {
  test('AC-2, AC-3: the bell counts the overdue tasks that Lead assigned, and opens the Overdue tab cut to them, which holds exactly the set the bell counted', async ({ page }, testInfo) => {
    const engineer = await createDisposableUser('queue', testInfo);
    const { seeded } = await openAs(page, testInfo, 'LEAD', async (lead) => {
      // Two overdue tasks assigned by this Lead, one not due and one closed (not counted), and one overdue task assigned by the E2E Lead, which is not this Lead's.
      const mine = [
        await seedQueueTask(engineer.id, ago(LATE), 'DRAFT', 'E2E lead own one', lead.email),
        await seedQueueTask(engineer.id, ago(DAY_MS), 'SUBMITTED', 'E2E lead own two', lead.email),
      ];
      await seedQueueTask(engineer.id, AHEAD, 'DRAFT', 'E2E lead own not due', lead.email);
      await seedQueueTask(engineer.id, ago(5 * DAY_MS), 'APPROVED', 'E2E lead own closed', lead.email);
      await seedQueueTask(engineer.id, ago(DAY_MS), 'DRAFT', 'E2E someone else assigned');
      return mine.map((task) => task.code);
    });

    const bell = page.getByRole('link', { name: 'Overdue tasks: 2' });
    await expect(bell).toBeVisible();
    const me = meSchema.parse(await (await page.request.get(`${DEVELOPMENT_URL}/api/v1/me`)).json());
    expect(me.overdueCount).toBe(2);

    await bell.click();
    await expect(page).toHaveURL(/\/queue\?tab=overdue&assignedBy=me$/);
    await expect(tab(page, 'Overdue')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'Overdue')).toHaveText('Overdue2');
    await expect.poll(() => visibleCodes(page).then((codes) => codes.length)).toBe(2);
    expect([...(await visibleCodes(page))].sort()).toEqual([...seeded].sort());
    await expect(page.getByText('Showing only the tasks you assigned.')).toBeVisible();
    await expect(page.getByText('2 tasks are overdue')).toBeVisible();
    // A later tab change keeps the cut: Open holds this Lead's three open tasks, not the other Lead's.
    await tab(page, 'Open').click();
    await expect.poll(() => visibleCodes(page).then((codes) => codes.length)).toBe(3);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    // "Show all tasks" goes back to the whole queue.
    await page.getByRole('link', { name: 'Show all tasks' }).click();
    await expect(page).toHaveURL(/\/queue$/);
    await expect(page.getByText('Showing only the tasks you assigned.')).toHaveCount(0);
  });

  test('AC-2: GET /api/v1/tasks accepts assignedBy=me and nothing else for assignedBy', async ({ page }, testInfo) => {
    await openAs(page, testInfo, 'LEAD', async () => undefined);
    expect((await page.request.get(`${DEVELOPMENT_URL}/api/v1/tasks?tab=overdue&assignedBy=me`)).status()).toBe(200);
    expect((await page.request.get(`${DEVELOPMENT_URL}/api/v1/tasks?tab=overdue&assignedBy=00000000-0000-4000-8000-000000000000`)).status()).toBe(422);
  });
});

test.describe('an Admin', () => {
  test('AC-2, AC-3: the bell counts every overdue task (at least the ones seeded here), and opens the whole Overdue tab', async ({ page }, testInfo) => {
    const engineer = await createDisposableUser('queue', testInfo);
    await openAs(page, testInfo, 'ADMIN', async () => {
      await seedQueueTask(engineer.id, ago(LATE), 'DRAFT', 'E2E admin sees one');
      await seedQueueTask(engineer.id, ago(DAY_MS), 'DRAFT', 'E2E admin sees two');
    });
    const me = meSchema.parse(await (await page.request.get(`${DEVELOPMENT_URL}/api/v1/me`)).json());
    expect(me.overdueCount).toBeGreaterThanOrEqual(2);
    const bell = page.getByRole('link', { name: `Overdue tasks: ${me.overdueCount}` });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(page).toHaveURL(/\/queue\?tab=overdue$/);
    await expect(tab(page, 'Overdue')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Showing only the tasks you assigned.')).toHaveCount(0);
    await expect(page.locator('[data-overdue-marker]:visible').first()).toContainText('Overdue by');
  });
});
