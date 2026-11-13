import { randomBytes } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, DEVELOPMENT_URL } from './support/servers';

/**
 * QA control for AQP-289 (DEF-035), G7 on PR 361 head H2. Not for merge: a throwaway branch run in CI only.
 *
 * Each test sets its own viewport, so the four widths of DL-199 (6) run in one project (1024 px is not a CI project). The
 * search is 100 times "W": a wide letter with no break point, wider than the content box at every width. The reading is
 * not vacuous when the title has three or more lines (line 1 is "No rate matches"; a third line exists only when the search
 * text itself was broken). Output lines start with "QA289" so the evidence can be read from the job log. Invented data only.
 */

test.use({ storageState: ADMIN_STATE });

const WIDTHS = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
] as const;
const FIXED_TITLE_WIDTHS = [WIDTHS[0], WIDTHS[3]] as const;
/** The form maximum of a master name (UX spec 6.0 "Names wrap"). */
const SEARCH_LENGTH = 100;
const QUERY = 'W'.repeat(SEARCH_LENGTH);
const MIN_LINES = 3;

/** Evidence for the job log; a QA control only, so the console rule is lifted for this one line. */
function note(line: string): void {
  // eslint-disable-next-line no-console
  console.log(line);
}

interface TitleReading {
  readonly lines: number;
  readonly left: number;
  readonly right: number;
  readonly overflow: number;
  readonly text: string;
}

async function readTitle(page: Page, name: string | RegExp): Promise<TitleReading> {
  const title = page.getByRole('heading', { name });
  await expect(title).toBeVisible();
  const box = await title.boundingBox();
  const lineHeight = await title.evaluate((element) => Number.parseFloat(getComputedStyle(element).lineHeight));
  const text = await title.innerText();
  return {
    lines: Math.round((box?.height ?? 0) / lineHeight),
    left: box?.x ?? -1,
    right: (box?.x ?? 0) + (box?.width ?? Number.POSITIVE_INFINITY),
    overflow: await horizontalOverflow(page),
    text,
  };
}

function expectInsideWindow(reading: TitleReading, width: number): void {
  expect(reading.overflow, 'the page does not scroll sideways').toBeLessThanOrEqual(0);
  expect(reading.left, 'the title starts inside the window').toBeGreaterThanOrEqual(0);
  expect(reading.right, 'the title ends inside the window').toBeLessThanOrEqual(width);
  expect(reading.lines, 'the search text itself wrapped (3 or more lines)').toBeGreaterThanOrEqual(MIN_LINES);
}

for (const size of WIDTHS) {
  test.describe(`DEF-035 long search at ${size.width} px`, () => {
    test.use({ viewport: size });

    test(`SCR-11 Process master "No rate matches" (${size.width} px)`, async ({ page }) => {
      await page.goto('/masters/process');
      await expect(page.getByRole('heading', { level: 1, name: 'Process master' })).toBeVisible();
      await page.getByLabel('Search').fill(QUERY);
      const name = `No rate matches "${QUERY}"`;
      const reading = await readTitle(page, name);
      note(`QA289 SCR-11 ${size.width} ${JSON.stringify({ lines: reading.lines, left: reading.left, right: reading.right, overflow: reading.overflow })}`);
      expect(reading.text, 'the full search text is shown').toContain(QUERY);
      expectInsideWindow(reading, size.width);
      await expectNoAxeViolations(page);
    });

    test(`SCR-13 Materials "No material matches" (${size.width} px)`, async ({ page }) => {
      const material = `E2E-qa289-${size.width}-${randomBytes(3).toString('hex')}`;
      const made = await page.request.post(`${DEVELOPMENT_URL}/api/v1/materials`, {
        headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
        data: { materialInDrawing: material, materialConsidered: 'Invented mild steel', pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' },
      });
      expect(made.status()).toBe(201);
      await page.goto('/masters/materials');
      await expect(page.getByRole('heading', { level: 1, name: 'Materials and lists' })).toBeVisible();
      await waitUntilHydrated(page, 'main button[data-action="add"]');
      await page.getByLabel('Search materials').fill(QUERY);
      const name = `No material matches "${QUERY}"`;
      const reading = await readTitle(page, name);
      note(`QA289 SCR-13 ${size.width} ${JSON.stringify({ lines: reading.lines, left: reading.left, right: reading.right, overflow: reading.overflow })}`);
      expect(reading.text, 'the full search text is shown').toContain(QUERY);
      expectInsideWindow(reading, size.width);
      await expectNoAxeViolations(page);
    });
  });
}

for (const size of FIXED_TITLE_WIDTHS) {
  test.describe(`fixed empty-state titles at ${size.width} px`, () => {
    test.use({ viewport: size });

    async function expectOneLine(page: Page, name: string): Promise<void> {
      const reading = await readTitle(page, name);
      note(`QA289 FIXED ${size.width} ${JSON.stringify({ name, lines: reading.lines, left: reading.left, right: reading.right })}`);
      expect(reading.text).toBe(name);
      expect(reading.lines, `${name}: one line, as before`).toBe(1);
      expect(reading.left).toBeGreaterThanOrEqual(0);
      expect(reading.right).toBeLessThanOrEqual(size.width);
    }

    // The first paint of both master screens is read on the server, so the list is emptied the way the screens' own specs do it: the answer to the
    // next read is stubbed empty, and a Save makes the screen read again.
    test(`"No rates yet" (${size.width} px)`, async ({ page }) => {
      const name = `E2E-qa289-rate-${size.width}-${randomBytes(3).toString('hex')}`;
      const made = await page.request.post(`${DEVELOPMENT_URL}/api/v1/process-items`, {
        headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
        data: { name, unit: 'per kg', defaultValue: '1.37' },
      });
      expect(made.status()).toBe(201);
      await page.goto('/masters/process');
      await expect(page.getByRole('heading', { level: 1, name: 'Process master' })).toBeVisible();
      await waitUntilHydrated(page, 'main button[data-action="add"]');
      await page.route('**/api/v1/process-items', (route) =>
        route.request().method() === 'GET' ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ processItems: [] }) }) : route.continue(),
      );
      const edit = page.locator('[data-item-id]:visible').filter({ hasText: name }).getByRole('button', { name: `Edit ${name}` });
      await edit.focus();
      await edit.press('Enter');
      const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
      await dialog.getByLabel('Default value').fill('4.37');
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expectOneLine(page, 'No rates yet');
    });

    test(`"No materials yet" (${size.width} px)`, async ({ page }) => {
      const name = `E2E-qa289-material-${size.width}-${randomBytes(3).toString('hex')}`;
      const made = await page.request.post(`${DEVELOPMENT_URL}/api/v1/materials`, {
        headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
        data: { materialInDrawing: name, materialConsidered: 'Invented mild steel', pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' },
      });
      expect(made.status()).toBe(201);
      await page.goto('/masters/materials');
      await expect(page.getByRole('heading', { level: 1, name: 'Materials and lists' })).toBeVisible();
      await waitUntilHydrated(page, 'main button[data-action="add"]');
      await page.route('**/api/v1/materials', (route) =>
        route.request().method() === 'GET' ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ materials: [] }) }) : route.continue(),
      );
      const edit = page.locator('[data-item-id]:visible').filter({ hasText: name }).getByRole('button', { name: `Edit ${name}` });
      await edit.focus();
      await edit.press('Enter');
      const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
      await dialog.getByLabel('Material-Scrap-Rate (per kg)').fill('45.37');
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expectOneLine(page, 'No materials yet');
    });

    test(`the queue page "No open tasks" (${size.width} px)`, async ({ page }) => {
      await page.goto('/queue');
      await expectOneLine(page, 'No open tasks');
    });

    test(`the audit screen "No entries match" and "No entries yet" (${size.width} px)`, async ({ page }) => {
      await page.goto('/audit');
      await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible();
      await waitUntilHydrated(page, '#audit-event', 'onChange');
      await page.route('**/api/v1/audit*', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [], total: 0, nextCursor: null }) }),
      );
      await page.getByLabel('Event', { exact: true }).selectOption({ label: 'User change' });
      await expectOneLine(page, 'No entries match');
      await page.getByLabel('Event', { exact: true }).selectOption({ label: 'All events' });
      await expectOneLine(page, 'No entries yet');
    });

    test(`the feedback sections of the design system "Nothing here yet" (${size.width} px)`, async ({ page }) => {
      await page.goto('/design-system');
      await expectOneLine(page, 'Nothing here yet');
    });
  });
}
