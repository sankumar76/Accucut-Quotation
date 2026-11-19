import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { z } from 'zod';

import { createDisposableUser, E2E_PASSWORD, signInWithoutThePage, useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { seedQueueTask, setEstimateStatus, type SeededQueueTask } from './support/queue';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-04.07 T6 (AC-1 to AC-3, AC-5, AC-6, AC-10): SCR-04 in edit mode, "Reassign or change deadline", and the row action that opens it, at 360x800, 768x1024 and 1366x768 on the
 * development server. The Lead's tests use the saved browser state of the set-up project and open the task by its address; the one test of the queue row signs in as a person of its own,
 * whose tasks it puts into the database (`support/queue.ts`), so the rows it sees are known whatever other specs have assigned. Each test makes the two Engineers it needs, so the
 * Engineer a task has is known. The words are the UX spec's and the story's, written out here and not imported, so a changed sentence fails a test. What the database holds (the lock,
 * the revision, the audit entry) is judged in `tests/integration/tasks/reassign.test.ts`. Every name and path is invented.
 */

const HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
const LOG_NOTICE = 'Changes are logged. The log records your name, the time, and the old and new values.';
const DEADLINE_MESSAGE = 'Choose a deadline later than now.';
const CLOSED_MESSAGE = 'This task is approved, so its Engineer and deadline can no longer be changed.';
const DAY_MS = 86_400_000;
/** 10:00 IST on 31 December 2099. */
const OPEN_DEADLINE = '2099-12-31T04:30:00.000Z';

const taskView = z.looseObject({ engineer: z.looseObject({ id: z.string(), name: z.string() }), deadlineAt: z.string() });

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

interface Person {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/** The two Engineers of a test: the one who has the task, and the one it is given to. */
async function twoEngineers(testInfo: TestInfo): Promise<{ readonly from: Person; readonly to: Person }> {
  return { from: await createDisposableUser('queue', testInfo), to: await createDisposableUser('queue', testInfo) };
}

async function openEdit(page: Page, taskId: string): Promise<void> {
  await page.goto(`/assign?task=${taskId}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Reassign or change deadline' })).toBeVisible();
  // The form is plain HTML until React has attached its handler; a press before that would send the form the browser's way.
  await waitUntilHydrated(page, 'main form', 'onSubmit');
}

/** What the server holds for the task now, read as the signed-in Lead. */
async function stored(page: Page, taskId: string): Promise<z.infer<typeof taskView>> {
  const response = await page.request.get(`${DEVELOPMENT_URL}/api/v1/tasks/${taskId}`);
  expect(response.status()).toBe(200);
  return taskView.parse(await response.json());
}

/** Counts the PATCH requests the page sends, so a test can say that none was sent. */
function countPatches(page: Page): { readonly sent: () => number } {
  let sent = 0;
  void page.route('**/api/v1/tasks/*', (route) => {
    if (route.request().method() === 'PATCH') sent += 1;
    return route.fallback();
  });
  return { sent: () => sent };
}

test.describe('the screen (AC-2, AC-10)', () => {
  test('AC-2, AC-10: only the Engineer and the deadline are editable, the rest says "Locked", the notice is the spec\'s; no sideways scroll, controls of 44 px, "IST" read with the time, axe 0 violations', async ({ page }, testInfo) => {
    const { from } = await twoEngineers(testInfo);
    const task = await seedQueueTask(from.id, OPEN_DEADLINE, 'DRAFT', 'E2E hopper cover');
    await openEdit(page, task.id);

    await expect(page.getByText(LOG_NOTICE)).toBeVisible();
    // The Engineer is the current one, and the deadline is the stored one as the IST date and time.
    await expect(page.getByLabel('Engineer')).toHaveValue(from.id);
    await expect(page.getByLabel('Deadline date')).toHaveValue('2099-12-31');
    await expect(page.getByLabel('Deadline time')).toHaveValue('10:00');
    await expect(page.getByLabel('Deadline time')).toHaveAccessibleDescription(/IST.*India Standard Time \(UTC\+5:30\)/);
    // Folder, Title and Notes are shown as text with the word "Locked", and are not controls.
    await expect(page.getByRole('main').getByText('Locked', { exact: true })).toHaveCount(3);
    await expect(page.getByLabel('Network folder path')).toHaveCount(0);
    await expect(page.getByLabel('Title')).toHaveCount(0);
    await expect(page.getByLabel('Notes')).toHaveCount(0);
    await expect(page.getByRole('main').getByText('E2E hopper cover', { exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: '\\\\invented-server\\invented-share\\RFQ-queue' })).toBeVisible();
    await expect(page.getByRole('main').getByText('None written', { exact: true })).toHaveCount(1);
    // The button reads as a change, not as "Assign task".
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Assign task' })).toHaveCount(0);

    for (const control of [page.getByLabel('Engineer'), page.getByLabel('Deadline date'), page.getByLabel('Deadline time')]) {
      expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    for (const box of [await page.getByRole('button', { name: 'Save changes' }).boundingBox(), await page.getByRole('main').getByRole('link', { name: 'Cancel' }).boundingBox()]) {
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-2: a task that does not exist, and an address with no task, are "not found"', async ({ page }) => {
    const missing = await page.goto('/assign?task=00000000-0000-4000-8000-00000000dead');
    expect(missing?.status()).toBe(404);
    const malformed = await page.goto('/assign?task=not-an-id');
    expect(malformed?.status()).toBe(404);
  });
});

test.describe('saving a change (AC-3, AC-5)', () => {
  test('AC-3, AC-10: by keyboard, a new Engineer and a new deadline are saved, the polite status names the task, the Engineer and the deadline in IST and takes focus, and the server holds both', async ({ page }, testInfo) => {
    const { from, to } = await twoEngineers(testInfo);
    const task = await seedQueueTask(from.id, OPEN_DEADLINE, 'SUBMITTED', 'E2E handover');
    await openEdit(page, task.id);

    await page.getByLabel('Engineer').selectOption({ label: to.name });
    await page.getByLabel('Deadline date').fill('2100-01-01');
    await page.getByLabel('Deadline time').fill('12:00');
    await page.getByLabel('Deadline time').press('Enter');

    const notice = page.getByRole('status').filter({ hasText: `Task ${task.code} is now with ${to.name}, due 01 Jan 2100, 12:00 IST.` });
    await expect(notice).toBeVisible();
    await expect(notice.locator('xpath=..')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(notice.getByRole('link', { name: 'Back to the task queue' })).toBeFocused();

    const now = await stored(page, task.id);
    expect(now.engineer).toMatchObject({ id: to.id, name: to.name });
    expect(now.deadlineAt).toBe('2100-01-01T06:30:00.000Z');
    // The form holds the saved values as the task's own.
    await expect(page.getByLabel('Engineer')).toHaveValue(to.id);
    await expect(page.getByLabel('Deadline date')).toHaveValue('2100-01-01');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-3: pressing Save changes with nothing changed says so and sends nothing', async ({ page }, testInfo) => {
    const { from } = await twoEngineers(testInfo);
    const task = await seedQueueTask(from.id, OPEN_DEADLINE, 'DRAFT', 'E2E no change');
    const patches = countPatches(page);
    await openEdit(page, task.id);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('You have not changed anything.')).toBeVisible();
    expect(patches.sent()).toBe(0);
    expect((await stored(page, task.id)).engineer.id).toBe(from.id);
  });

  test('AC-3 (D-3): an overdue task is given to another Engineer with its past deadline left as it is, and the deadline stays the same', async ({ page }, testInfo) => {
    const { from, to } = await twoEngineers(testInfo);
    const late = new Date(Date.now() - 3 * DAY_MS);
    late.setUTCSeconds(0, 0);
    const task = await seedQueueTask(from.id, late.toISOString(), 'DRAFT', 'E2E overdue handover');
    await openEdit(page, task.id);
    await page.getByLabel('Engineer').selectOption({ label: to.name });
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('status').filter({ hasText: `Task ${task.code} is now with ${to.name}` })).toBeVisible();
    const now = await stored(page, task.id);
    expect(now.engineer.id).toBe(to.id);
    expect(now.deadlineAt).toBe(late.toISOString());
  });
});

test.describe('a change that cannot be saved (AC-3, AC-6)', () => {
  test('AC-3, AC-10: a deadline in the past is refused with the spec\'s words, in the summary with a link to the date, under the field, focus on it, and nothing is sent', async ({ page }, testInfo) => {
    const { from, to } = await twoEngineers(testInfo);
    const task = await seedQueueTask(from.id, OPEN_DEADLINE, 'DRAFT', 'E2E past deadline');
    const patches = countPatches(page);
    await openEdit(page, task.id);
    await page.getByLabel('Engineer').selectOption({ label: to.name });
    await page.getByLabel('Deadline date').fill('2020-01-01');
    await page.getByRole('button', { name: 'Save changes' }).click();

    const summary = page.getByRole('alert').filter({ hasText: '1 thing needs fixing before this change can be saved.' });
    await expect(summary).toBeVisible();
    await expect(summary.getByRole('link', { name: DEADLINE_MESSAGE })).toBeVisible();
    await expect(page.getByRole('main').getByText(DEADLINE_MESSAGE).first()).toBeVisible();
    await expect(page.getByLabel('Deadline date')).toBeFocused();
    // What was chosen is kept.
    await expect(page.getByLabel('Engineer')).toHaveValue(to.id);
    expect(patches.sent()).toBe(0);
    expect((await stored(page, task.id)).engineer.id).toBe(from.id);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-6: a task approved after the form was opened is refused by the server, the form goes and the reason is said, and nothing changes', async ({ page }, testInfo) => {
    const { from, to } = await twoEngineers(testInfo);
    const task = await seedQueueTask(from.id, OPEN_DEADLINE, 'SUBMITTED', 'E2E approved meanwhile');
    await openEdit(page, task.id);
    await setEstimateStatus(task.id, 'APPROVED');
    await page.getByLabel('Engineer').selectOption({ label: to.name });
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('alert').filter({ hasText: CLOSED_MESSAGE })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to the task queue' })).toBeVisible();
    expect((await stored(page, task.id)).engineer.id).toBe(from.id);
  });

  test('AC-6: an approved task opened by its address shows the reason and no form', async ({ page }, testInfo) => {
    const { from } = await twoEngineers(testInfo);
    const task = await seedQueueTask(from.id, OPEN_DEADLINE, 'APPROVED', 'E2E closed task');
    await page.goto(`/assign?task=${task.id}`);
    await expect(page.getByRole('alert').filter({ hasText: CLOSED_MESSAGE })).toBeVisible();
    await expect(page.getByLabel('Engineer')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  });

  test('AC-3: a server that cannot be reached says the change could not be saved and keeps what was chosen', async ({ page }, testInfo) => {
    const { from, to } = await twoEngineers(testInfo);
    const task = await seedQueueTask(from.id, OPEN_DEADLINE, 'DRAFT', 'E2E offline');
    await page.route('**/api/v1/tasks/*', (route) => (route.request().method() === 'PATCH' ? route.fulfill({ status: 503, contentType: 'application/problem+json', body: '{}' }) : route.fallback()));
    await openEdit(page, task.id);
    await page.getByLabel('Engineer').selectOption({ label: to.name });
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'We could not save the change.' })).toBeVisible();
    await expect(page.getByLabel('Engineer')).toHaveValue(to.id);
  });
});

test.describe('the route (AC-3, AC-6, AC-7)', () => {
  test('AC-3, AC-6, AC-7: the API answers a change with the task as the queue shows it, 422 for a past deadline and an unknown Engineer, 409 for an approved task, 404 for an unknown task', async ({ page }, testInfo) => {
    const { from, to } = await twoEngineers(testInfo);
    const task = await seedQueueTask(from.id, OPEN_DEADLINE, 'DRAFT', 'E2E api');
    const url = `${DEVELOPMENT_URL}/api/v1/tasks/${task.id}`;

    const past = await page.request.patch(url, { headers: HEADERS, data: { deadlineAt: '2020-01-01T00:00:00.000Z' } });
    expect(past.status()).toBe(422);
    expect(JSON.stringify(await past.json())).toContain(DEADLINE_MESSAGE);
    const unknown = await page.request.patch(url, { headers: HEADERS, data: { engineerId: '00000000-0000-4000-8000-00000000dead' } });
    expect(unknown.status()).toBe(422);
    expect(JSON.stringify(await unknown.json())).toContain('Choose an Engineer.');

    const changed = await page.request.patch(url, { headers: HEADERS, data: { engineerId: to.id } });
    expect(changed.status()).toBe(200);
    const body = z.looseObject({ id: z.string(), code: z.string(), engineer: z.looseObject({ id: z.string() }), status: z.string() }).parse(await changed.json());
    expect(body).toMatchObject({ id: task.id, code: task.code, engineer: { id: to.id }, status: 'DRAFT' });
    expect(Object.keys(body).sort()).toEqual(['assignedByName', 'code', 'customerName', 'deadlineAt', 'engineer', 'folderPath', 'folderUrl', 'id', 'status', 'title']);

    await setEstimateStatus(task.id, 'APPROVED');
    const closed = await page.request.patch(url, { headers: HEADERS, data: { engineerId: from.id } });
    expect(closed.status()).toBe(409);
    expect(await closed.json()).toMatchObject({ code: 'TASK_CLOSED' });

    const missing = await page.request.patch(`${DEVELOPMENT_URL}/api/v1/tasks/00000000-0000-4000-8000-00000000dead`, { headers: HEADERS, data: { engineerId: to.id } });
    expect(missing.status()).toBe(404);
  });

  test('AC-7: a signed-out caller gets 401, and an Engineer 403 whether or not the task exists', async ({ browser }, testInfo) => {
    const { from } = await twoEngineers(testInfo);
    const task = await seedQueueTask(from.id, OPEN_DEADLINE, 'DRAFT', 'E2E refused');
    const signedOut = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      expect((await signedOut.request.patch(`${DEVELOPMENT_URL}/api/v1/tasks/${task.id}`, { headers: HEADERS, data: {} })).status()).toBe(401);
    } finally {
      await signedOut.close();
    }
    const engineerContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const engineerPage = await engineerContext.newPage();
      await signInWithoutThePage(engineerPage, from.email, E2E_PASSWORD);
      for (const id of [task.id, '00000000-0000-4000-8000-00000000dead']) {
        expect((await engineerContext.request.patch(`${DEVELOPMENT_URL}/api/v1/tasks/${id}`, { headers: HEADERS, data: { engineerId: from.id } })).status()).toBe(403);
      }
      expect((await stored(engineerPage, task.id)).engineer.id).toBe(from.id);
    } finally {
      await engineerContext.close();
    }
  });
});

test.describe('the row action of the queue (AC-1)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('AC-1, AC-10: an open row of a Lead has "Reassign or change deadline" with the task in its accessible name, reached and pressed by keyboard to open SCR-04 in edit mode; a closed row says "Closed" and has none', async ({ page }, testInfo) => {
    const lead = await createDisposableUser('bell', testInfo, 'LEAD');
    const { from } = await twoEngineers(testInfo);
    const open: SeededQueueTask = await seedQueueTask(from.id, OPEN_DEADLINE, 'DRAFT', 'E2E open row', lead.email);
    const closed: SeededQueueTask = await seedQueueTask(from.id, OPEN_DEADLINE, 'APPROVED', 'E2E closed row', lead.email);
    await signInWithoutThePage(page, lead.email, E2E_PASSWORD);
    await page.goto('/queue?assignedBy=me');
    await waitUntilHydrated(page, '[role="tab"]', 'onMouseDown');

    const action = page.getByRole('link', { name: `Reassign or change deadline, ${open.code}` });
    await expect(action).toBeVisible();
    await expect(action).toHaveText('Reassign or change deadline');
    expect((await action.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await action.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/assign\\?task=${open.id}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Reassign or change deadline' })).toBeVisible();
    await expect(page.getByLabel('Engineer')).toHaveValue(from.id);

    await page.goto('/queue?assignedBy=me&tab=closed');
    await waitUntilHydrated(page, '[role="tab"]', 'onMouseDown');
    const row = page.locator(`[data-task-code="${closed.code}"]:visible`);
    await expect(row).toBeVisible();
    await expect(row.locator('[data-closed-action]')).toHaveText('Closed');
    await expect(row.getByRole('link', { name: /Reassign or change deadline/ })).toHaveCount(0);
  });
});
