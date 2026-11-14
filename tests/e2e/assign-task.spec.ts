import { expect, test, type Page } from '@playwright/test';
import { z } from 'zod';

import { E2E_ENGINEER } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-04.01 T6, T8 (AC-1, AC-3, AC-4, AC-6, AC-7): SCR-04 "Assign task", at 360x800, 768x1024 and 1366x768 on the development server, signed in as the E2E
 * Lead (the saved browser state of the set-up project). No sideways scroll (the side card moves below the form on a phone and a tablet), controls of 44 px,
 * axe 0 violations, the date and time with visible labels and "IST" read with the time field, and the whole flow by keyboard: type, Enter to assign, the
 * notice takes focus, Copy path and Assign another are reached with Tab. The words are the UX spec's and the story's, written out here and not imported, so a
 * changed sentence fails a test. What the database holds (the transaction, the numbering, the lock) is judged in `tests/integration/tasks/assign.test.ts`.
 * Every name and path is invented; each test uses a path of its own.
 */

const HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
const FUTURE_DATE = '2099-12-31';
const FUTURE_TIME = '10:00';
const PATH_MESSAGE = 'Enter the network folder path. It starts with two backslashes, like \\\\server\\share\\RFQ-123.';
const DEADLINE_MESSAGE = 'Choose a deadline later than now.';
const ENGINEER_MESSAGE = 'Choose an Engineer.';
const LINK_NOTE = 'Your browser may block links to network folders. If nothing opens, choose Copy path and paste it into File Explorer.';

function pathFor(testInfo: { readonly project: { readonly name: string }; readonly workerIndex: number }): string {
  return `\\\\e2e-server\\e2e-share\\RFQ-${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`;
}

async function openAssign(page: Page): Promise<void> {
  await page.goto('/assign');
  await expect(page.getByRole('heading', { level: 1, name: 'Assign task' })).toBeVisible();
  // The form is plain HTML until React has attached its handler; a press before that would send the form the browser's way.
  await waitUntilHydrated(page, 'main form', 'onSubmit');
}

async function fillValid(page: Page, folderPath: string): Promise<void> {
  await page.getByLabel('Engineer').selectOption({ label: E2E_ENGINEER.name });
  await page.getByLabel('Network folder path').fill(folderPath);
  await page.getByLabel('Deadline date').fill(FUTURE_DATE);
  await page.getByLabel('Deadline time').fill(FUTURE_TIME);
  await page.getByLabel('Title').fill('E2E hopper cover');
  await page.getByLabel('Notes').fill('E2E notes for the Engineer.');
}

test.describe('the screen (AC-7)', () => {
  test('AC-7: no sideways scroll, controls of 44 px, labels for the date and time, "IST" read with the time field, the side card below the form on a phone and a tablet, axe 0 violations', async ({ page }) => {
    await openAssign(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    for (const label of ['Engineer', 'Network folder path', 'Deadline date', 'Deadline time', 'Title', 'Notes']) await expect(page.getByLabel(label).first()).toBeVisible();
    for (const control of [page.getByLabel('Engineer'), page.getByLabel('Network folder path'), page.getByLabel('Deadline date'), page.getByLabel('Deadline time'), page.getByLabel('Title')]) {
      expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    for (const name of ['Assign task', 'Cancel']) {
      const box = await page.getByRole('main').getByRole(name === 'Cancel' ? 'link' : 'button', { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }

    // "IST" is visible beside the time and is part of its description, with the hint.
    await expect(page.getByText('IST', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Deadline time')).toHaveAccessibleDescription(/IST.*India Standard Time \(UTC\+5:30\)/);

    const form = await page.getByRole('form', { name: 'Assign task' }).boundingBox();
    const side = await page.getByRole('heading', { name: 'What happens next' }).boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    if (form !== null && side !== null && width < 1024) expect(side.y).toBeGreaterThanOrEqual(form.y + form.height - 1);
    if (form !== null && side !== null && width >= 1024) expect(side.x).toBeGreaterThan(form.x + form.width - 1);
  });
});

test.describe('assigning a task (AC-1, AC-4)', () => {
  test('AC-1, AC-4: by keyboard, a valid form assigns the task, the notice names the code and the Engineer and takes focus, the path is a link and Copy path copies it', async ({ page, context }, testInfo) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const folderPath = pathFor(testInfo);
    await openAssign(page);
    await fillValid(page, folderPath);
    await page.getByLabel('Network folder path').press('Enter');

    const notice = page.getByRole('status').filter({ hasText: `assigned to ${E2E_ENGINEER.name}.` });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/Task Q-\d{4}-\d{4,} assigned to /);
    await expect(notice.locator('xpath=..')).toBeFocused();
    // The form is empty again, so a second press cannot make a second task.
    await expect(page.getByLabel('Network folder path')).toHaveValue('');

    const link = notice.getByRole('link', { name: folderPath });
    await expect(link).toHaveAttribute('href', /^file:\/\/\/\//);
    await expect(link).toHaveAttribute('href', `file:////${folderPath.slice(2).split('\\').map(encodeURIComponent).join('/')}`);
    await expect(notice.getByText(LINK_NOTE)).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await page.keyboard.press('Tab');
    const copy = notice.getByRole('button', { name: 'Copy path' });
    await expect(copy).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(notice.getByText('Path copied to the clipboard.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(folderPath);

    await page.keyboard.press('Tab');
    const another = notice.getByRole('button', { name: 'Assign another' });
    await expect(another).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(notice).toHaveCount(0);
    await expect(page.getByLabel('Engineer')).toBeFocused();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('a form that cannot be assigned (AC-3)', () => {
  test('AC-3: an empty form is refused with an alert that links to each field, the messages under the fields, focus on the first, and nothing is sent', async ({ page }) => {
    let sent = 0;
    await page.route('**/api/v1/tasks', (route) => {
      sent += 1;
      return route.fallback();
    });
    await openAssign(page);
    await page.getByRole('button', { name: 'Assign task' }).click();

    const summary = page.getByRole('alert').filter({ hasText: '3 things need fixing before this task can be assigned.' });
    await expect(summary).toBeVisible();
    for (const message of [ENGINEER_MESSAGE, PATH_MESSAGE, DEADLINE_MESSAGE]) {
      await expect(summary.getByRole('link', { name: message })).toBeVisible();
      await expect(page.getByRole('main').getByText(message).first()).toBeVisible();
    }
    await expect(page.getByLabel('Engineer')).toBeFocused();

    await summary.getByRole('link', { name: PATH_MESSAGE }).click();
    await expect(page.getByLabel('Network folder path')).toBeFocused();
    await summary.getByRole('link', { name: DEADLINE_MESSAGE }).click();
    await expect(page.getByLabel('Deadline date')).toBeFocused();
    expect(sent).toBe(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-3: a path that is not a UNC path, a deadline in the past and a long title and notes are refused with the spec’s words, and what was typed is kept', async ({ page }) => {
    await openAssign(page);
    await page.getByLabel('Engineer').selectOption({ label: E2E_ENGINEER.name });
    await page.getByLabel('Network folder path').fill('C:\\not\\a\\network\\path');
    await page.getByLabel('Deadline date').fill('2020-01-01');
    await page.getByLabel('Deadline time').fill('09:00');
    await page.getByLabel('Title').fill('T'.repeat(121));
    await page.getByLabel('Notes').fill('N'.repeat(1_001));
    await page.getByRole('button', { name: 'Assign task' }).click();

    const summary = page.getByRole('alert').filter({ hasText: '4 things need fixing before this task can be assigned.' });
    await expect(summary).toBeVisible();
    for (const message of [PATH_MESSAGE, DEADLINE_MESSAGE, 'Keep the title under 120 characters.', 'Keep the notes under 1,000 characters.']) {
      await expect(summary.getByRole('link', { name: message })).toBeVisible();
    }
    await expect(page.getByLabel('Network folder path')).toHaveValue('C:\\not\\a\\network\\path');
    await expect(page.getByLabel('Title')).toHaveValue('T'.repeat(121));
    await expect(page.getByLabel('Engineer')).toHaveValue(/.+/);
  });

  test('AC-3: a message goes when the field is changed, and the summary counts one thing in the singular', async ({ page }) => {
    await openAssign(page);
    await page.getByLabel('Engineer').selectOption({ label: E2E_ENGINEER.name });
    await page.getByLabel('Deadline date').fill(FUTURE_DATE);
    await page.getByLabel('Deadline time').fill(FUTURE_TIME);
    await page.getByRole('button', { name: 'Assign task' }).click();
    await expect(page.getByRole('alert').filter({ hasText: '1 thing needs fixing before this task can be assigned.' })).toBeVisible();
    await page.getByLabel('Network folder path').fill('\\\\e2e-server\\e2e-share');
    await expect(page.getByRole('alert').filter({ hasText: 'needs fixing' })).toHaveCount(0);
  });

  test('AC-3: a server that cannot be reached says nothing was saved and keeps the form', async ({ page }, testInfo) => {
    await page.route('**/api/v1/tasks', (route) => route.fulfill({ status: 503, contentType: 'application/problem+json', body: '{}' }));
    const folderPath = pathFor(testInfo);
    await openAssign(page);
    await fillValid(page, folderPath);
    await page.getByRole('button', { name: 'Assign task' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'We could not assign the task.' })).toBeVisible();
    await expect(page.getByLabel('Network folder path')).toHaveValue(folderPath);
  });
});

test.describe('the routes (AC-3, AC-5, AC-6)', () => {
  test('AC-3, AC-6: the API refuses an unknown Engineer and a javascript: path with 422, and keeps script text in the notes as text', async ({ page }, testInfo) => {
    const unknownEngineer = await page.request.post(`${DEVELOPMENT_URL}/api/v1/tasks`, {
      headers: HEADERS,
      data: { engineerId: '00000000-0000-4000-8000-00000000dead', folderPath: pathFor(testInfo), deadline: `${FUTURE_DATE}T${FUTURE_TIME}` },
    });
    expect(unknownEngineer.status()).toBe(422);
    expect(JSON.stringify(await unknownEngineer.json())).toContain(ENGINEER_MESSAGE);

    const scriptPath = await page.request.post(`${DEVELOPMENT_URL}/api/v1/tasks`, {
      headers: HEADERS,
      data: { engineerId: '00000000-0000-4000-8000-00000000dead', folderPath: 'javascript:alert(1)', deadline: `${FUTURE_DATE}T${FUTURE_TIME}` },
    });
    expect(scriptPath.status()).toBe(422);
    expect(JSON.stringify(await scriptPath.json())).toContain('Enter the network folder path.');

    const options = z
      .object({ engineers: z.array(z.strictObject({ id: z.string(), name: z.string() })) })
      .parse(await (await page.request.get(`${DEVELOPMENT_URL}/api/v1/options/assign-context`)).json());
    const ours = options.engineers.find((engineer) => engineer.name === E2E_ENGINEER.name);
    expect(ours).toBeDefined();

    const created = await page.request.post(`${DEVELOPMENT_URL}/api/v1/tasks`, {
      headers: HEADERS,
      data: { engineerId: ours?.id, folderPath: pathFor(testInfo), deadline: `${FUTURE_DATE}T${FUTURE_TIME}`, title: '<script>alert(1)</script>', notes: '<img src=x onerror=alert(1)>' },
    });
    expect(created.status()).toBe(201);
    expect(await created.json()).toMatchObject({ title: '<script>alert(1)</script>', notes: '<img src=x onerror=alert(1)>', estimate: { status: 'DRAFT', customerId: null } });
  });

  test('AC-5: a signed-out caller gets 401 from both routes and no page', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      expect((await context.request.get(`${DEVELOPMENT_URL}/api/v1/options/assign-context`)).status()).toBe(401);
      expect((await context.request.post(`${DEVELOPMENT_URL}/api/v1/tasks`, { headers: HEADERS, data: {} })).status()).toBe(401);
    } finally {
      await context.close();
    }
  });
});
