import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { createDisposableUser, E2E_PASSWORD, expectOnQueue, signInThroughThePage, useFreshAddress, type E2eUser } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { seedQueueTask, type SeededQueueTask } from './support/queue';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-04.06 T5 to T8 (AC-1 to AC-9): the Lead's default filter and the filters of SCR-03, at 360x800, 768x1024 and 1366x768 on the development server. Each test signs in as a person
 * of its own and seeds only the tasks it reads (`support/queue.ts`), so what it sees is known whatever other specs have assigned; a Lead's tests seed their tasks as that Lead, because
 * the Lead's queue now opens on the tasks they assigned. The words are the story's and the UX spec's, written out here and not imported, so a changed sentence fails a test. What the
 * queries return on real rows (every filter, the IST edges, the wildcards, the scope) is judged in `tests/integration/tasks/queue-filters.test.ts`. Every name and path is invented.
 */

const FIRST_DEADLINE = '2030-03-05T18:00:00.000Z';
const SECOND_DEADLINE = '2030-03-08T10:00:00.000Z';
const THIRD_DEADLINE = '2030-03-09T10:00:00.000Z';
const MINIMUM_SM = 640;
const MINIMUM_XL = 1280;
const SAME_ROW_TOLERANCE = 6;
const NO_MATCH = 'No tasks match your filters.';

const widthOf = (page: Page): number => page.viewportSize()?.width ?? 0;
const tab = (page: Page, name: string): Locator => page.getByRole('tab', { name: new RegExp(`^${name}`) });
const search = (page: Page): Locator => page.getByLabel('Search tasks');
const visibleCodes = (page: Page): Promise<string[]> =>
  page.locator('[data-task-code]:visible').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-task-code') ?? ''));
const sorted = (codes: ReadonlyArray<string>): string[] => [...codes].sort();
const found = (page: Page): Locator => page.getByRole('status').filter({ hasText: /found$/ });

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

test.use({ storageState: { cookies: [], origins: [] } });

/** Signs in through the page as a new person of the role, after `seed` has put tasks in the database for them, and waits until the tabs are live. */
async function openAs<T>(page: Page, testInfo: TestInfo, role: E2eUser['role'], seed: (person: E2eUser & { readonly id: string }) => Promise<T>): Promise<T> {
  await page.context().clearCookies();
  const person = await createDisposableUser('queue', testInfo, role);
  const seeded = await seed(person);
  await page.goto('/sign-in');
  await signInThroughThePage(page, person.email, E2E_PASSWORD);
  await expectOnQueue(page, role === 'ENGINEER' ? 'My tasks' : 'Task queue');
  await waitUntilHydrated(page, '[role="tab"]', 'onMouseDown');
  return seeded;
}

interface LeadSet {
  readonly engineers: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly hopper: SeededQueueTask;
  readonly bracket: SeededQueueTask;
  readonly plate: SeededQueueTask;
  readonly strangers: SeededQueueTask;
}

/** Three tasks assigned by the Lead (two Engineers), and one that the E2E Lead assigned, which the default view leaves out. */
async function seedLead(lead: E2eUser, testInfo: TestInfo): Promise<LeadSet> {
  const [first, second] = [await createDisposableUser('queue', testInfo), await createDisposableUser('queue', testInfo)];
  return {
    engineers: [first, second],
    hopper: await seedQueueTask(first.id, FIRST_DEADLINE, 'DRAFT', 'E2E alpha hopper', lead.email),
    bracket: await seedQueueTask(first.id, SECOND_DEADLINE, 'DRAFT', 'E2E bravo bracket', lead.email),
    plate: await seedQueueTask(second.id, THIRD_DEADLINE, 'SUBMITTED', 'E2E charlie plate', lead.email),
    strangers: await seedQueueTask(second.id, THIRD_DEADLINE, 'DRAFT', 'E2E someone else assigned'),
  };
}

test.describe('a Lead', () => {
  test('AC-1, AC-2: opens on the tasks they assigned with the chip "Assigned by me"; removing it shows every task and is kept in the address; a control puts it back; axe 0 violations', async ({ page }, testInfo) => {
    const set = await openAs(page, testInfo, 'LEAD', (lead) => seedLead(lead, testInfo));

    await expect(page.getByRole('button', { name: 'Remove filter Assigned by me' })).toBeVisible();
    await expect.poll(() => visibleCodes(page).then(sorted)).toEqual(sorted([set.hopper.code, set.bracket.code, set.plate.code]));
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Remove filter Assigned by me' }).click();
    await expect(page).toHaveURL(/assignedBy=anyone/);
    await expect(page.getByRole('button', { name: 'Remove filter Assigned by me' })).toHaveCount(0);
    // The whole queue is on the list now. The shared database holds other specs' tasks, so a 2030 deadline may be past the first page: the proof is the Open count, which now includes
    // the task the E2E Lead assigned. Focus moved to the control that puts the chip back, since the remove button is gone.
    await expect(page.getByRole('button', { name: 'Assigned by me', exact: true })).toBeFocused();
    await expect.poll(async () => Number(/(\d+)$/.exec((await tab(page, 'Open').textContent()) ?? '')?.[1])).toBeGreaterThanOrEqual(4);

    await page.getByRole('button', { name: 'Assigned by me', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove filter Assigned by me' })).toBeVisible();
    await expect(tab(page, 'Open')).toHaveText('Open3');
    await expect.poll(() => visibleCodes(page).then((codes) => codes.includes(set.strangers.code))).toBe(false);
  });

  test('AC-3, AC-4, AC-6, AC-7, AC-9: the search (Enter asks at once) and the Engineer filter combine, the counts and the polite "found" line follow, and Clear filters empties them and moves focus to the search', async ({ page }, testInfo) => {
    const set = await openAs(page, testInfo, 'LEAD', (lead) => seedLead(lead, testInfo));
    await expect.poll(() => visibleCodes(page)).toHaveLength(3);

    // Ignoring letter case, by title; the tab counts follow the filter.
    await search(page).fill('HOPPER');
    await search(page).press('Enter');
    await expect.poll(() => visibleCodes(page)).toEqual([set.hopper.code]);
    await expect(tab(page, 'Open')).toHaveText('Open1');
    await expect(found(page)).toHaveText('1 task found');
    await expect(page).toHaveURL(/q=HOPPER/);

    // The Engineer of "plate" is not the Engineer of "hopper": together they match nothing.
    const [, second] = set.engineers;
    await page.getByLabel('Engineer', { exact: true }).selectOption({ label: second?.name ?? '' });
    await expect(page.getByText(NO_MATCH)).toBeVisible();
    await expect(tab(page, 'Open')).toHaveText('Open0');
    await expect(found(page)).toHaveText('No tasks found');

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(search(page)).toBeFocused();
    await expect(search(page)).toHaveValue('');
    await expect(page.getByLabel('Engineer', { exact: true })).toHaveValue('');
    // The chip is separate from the filters and stays as it is.
    await expect(page.getByRole('button', { name: 'Remove filter Assigned by me' })).toBeVisible();
    await expect.poll(() => visibleCodes(page).then(sorted)).toEqual(sorted([set.hopper.code, set.bracket.code, set.plate.code]));
    await expect(page).not.toHaveURL(/q=|engineer=/);
  });

  test('AC-3, AC-4: From and To are deadline days in IST, both inclusive (23:30 IST on the To day is in), a range that ends before it begins is said under To and nothing is shown, and the address holds them', async ({ page }, testInfo) => {
    const set = await openAs(page, testInfo, 'LEAD', (lead) => seedLead(lead, testInfo));
    await expect.poll(() => visibleCodes(page)).toHaveLength(3);

    // 18:00 UTC on 5 March is 23:30 IST on the 5th: inside "to 5 March". The others are on the 8th and the 9th.
    await page.getByLabel('Deadline to (IST)').fill('2030-03-05');
    await expect.poll(() => visibleCodes(page)).toEqual([set.hopper.code]);
    await expect(page).toHaveURL(/to=2030-03-05/);

    await page.getByLabel('Deadline to (IST)').fill('2030-03-08');
    await page.getByLabel('Deadline from (IST)').fill('2030-03-08');
    await expect.poll(() => visibleCodes(page)).toEqual([set.bracket.code]);

    await page.getByLabel('Deadline from (IST)').fill('2030-03-09');
    await expect(page.getByText('The start date is after the end date.')).toBeVisible();
    await expect(page.getByRole('tablist')).toHaveCount(0);
  });

  test('AC-9: every control has a visible label, the filters stack at 360 px and sit in one row at 1366 px, there is no sideways scroll, the controls follow each other by keyboard, and axe 0 violations', async ({ page }, testInfo) => {
    await openAs(page, testInfo, 'LEAD', (lead) => seedLead(lead, testInfo));
    const controls = ['Search tasks', 'Engineer', 'Customer', 'Deadline from (IST)', 'Deadline to (IST)'].map((label) => page.getByLabel(label, { exact: true }));
    for (const control of controls) await expect(control).toBeVisible();

    const tops = await Promise.all(controls.map(async (control) => (await control.boundingBox())?.y ?? 0));
    const width = widthOf(page);
    if (width >= MINIMUM_XL) expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(SAME_ROW_TOLERANCE);
    if (width < MINIMUM_SM) for (let index = 1; index < tops.length; index += 1) expect(tops[index] ?? 0).toBeGreaterThan(tops[index - 1] ?? 0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // By keyboard: from the search to the Engineer to the Customer.
    await search(page).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Engineer', { exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Customer', { exact: true })).toBeFocused();
    await expectNoAxeViolations(page);
  });

  test('AC-3, AC-4, AC-5, AC-8: GET /api/v1/tasks takes assignedBy me or anyone, a search and days, and refuses a bad value, a name it does not know and a range that ends before it begins with 422', async ({ page }, testInfo) => {
    await openAs(page, testInfo, 'LEAD', async () => undefined);
    const get = async (query: string): Promise<{ readonly status: number; readonly text: string }> => {
      const response = await page.request.get(`${DEVELOPMENT_URL}/api/v1/tasks?${query}`);
      return { status: response.status(), text: await response.text() };
    };
    for (const good of ['assignedBy=me', 'assignedBy=anyone', 'q=%25', 'q=%5F', 'from=2030-03-01&to=2030-03-31', 'engineer=00000000-0000-4000-8000-000000000000', `q=${'x'.repeat(120)}`]) {
      expect((await get(good)).status, good).toBe(200);
    }
    for (const bad of ['from=12%2F11%2F2030', 'to=2030-02-30', 'engineer=arjun', 'customer=acme', `q=${'x'.repeat(121)}`, 'assignedBy=someone', 'bogus=1']) {
      expect((await get(bad)).status, bad).toBe(422);
    }
    const reversed = await get('from=2030-03-20&to=2030-03-10');
    expect(reversed.status).toBe(422);
    expect(reversed.text).toContain('The start date is after the end date.');
  });
});

test.describe('an Engineer', () => {
  test('AC-3, AC-5, AC-6, AC-8: is offered the search only, which finds their own tasks after a pause; "No match" is in the words of the search with no Clear filters; the API refuses every other filter with 422', async ({ page }, testInfo) => {
    const own = await openAs(page, testInfo, 'ENGINEER', async (engineer) => ({
      hopper: await seedQueueTask(engineer.id, FIRST_DEADLINE, 'DRAFT', 'E2E alpha hopper'),
      bracket: await seedQueueTask(engineer.id, SECOND_DEADLINE, 'DRAFT', 'E2E bravo bracket'),
    }));
    await expect(search(page)).toBeVisible();
    for (const label of ['Engineer', 'Customer', 'Deadline from (IST)', 'Deadline to (IST)']) await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Assigned by me/ })).toHaveCount(0);
    await expect.poll(() => visibleCodes(page)).toEqual([own.hopper.code, own.bracket.code]);

    // No button: the search asks after a pause of 300 ms.
    await search(page).fill('BRACKET');
    await expect.poll(() => visibleCodes(page)).toEqual([own.bracket.code]);

    await search(page).fill('zzz');
    await expect(page.getByText('No tasks match your search.')).toBeVisible();
    await expect(page.getByText('Try a different task ID or part of the title.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
    await expect(page.getByText(NO_MATCH)).toHaveCount(0);

    for (const query of ['engineer=00000000-0000-4000-8000-000000000000', 'customer=00000000-0000-4000-8000-000000000000', 'from=2030-03-01', 'to=2030-03-31', 'assignedBy=me', 'assignedBy=anyone']) {
      expect((await page.request.get(`${DEVELOPMENT_URL}/api/v1/tasks?${query}`)).status(), query).toBe(422);
    }
    expect((await page.request.get(`${DEVELOPMENT_URL}/api/v1/tasks?q=hopper`)).status()).toBe(200);
  });
});
