import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, DEVELOPMENT_URL } from './support/servers';

/**
 * QA's own browser checks for AQP-234 (DEF-021) and AQP-235 (DEF-020) at G7, written from ux-spec v0.19 section 6.0 "Masters tables" and SCR-11
 * and SCR-13 "Error (load)", not from the developer's spec. They run in the desktop project only (each test sets its own width). Signed in as the E2E
 * Admin. Every row is made through the API with an invented name that carries the repeat, the retry and a random part. Measurements are written to
 * `test-results/qa234/*.json` for the test report.
 *
 *   G7-1  every row action, fully visible, never covered, without scrolling the table, at the seven widths of the brief, with a 100-character name
 *   G7-2  the other delivered tables, measured (follow-up #134, OQ-UX-20); runs only with QA234_MEASURE=1
 *   G7-3  QLT-06: the row lines under the sticky Actions column at 1024 px with the table forced to scroll (pixels, and screenshots)
 *   G7-5  DEF-020 on both screens: focus on the error title; from the error, Add then Escape, Cancel or the close button returns focus to Add
 *   G7-7  keyboard and axe at 768 and 1024 px
 */

test.use({ storageState: ADMIN_STATE });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'each test sets its own width, so one project runs it');
});

const WIDTHS = [768, 1023, 1024, 1279, 1280, 1366, 1440] as const;
const HEIGHT = 900;
const NAME_LENGTH = 100;
const OUT = 'qa-evidence';
/** Tab presses of the G7-7 keyboard walk; a table with more row actions than this is walked for its first TAB_PRESSES actions. */
const TAB_PRESSES = 12;
/** Row actions that one row has on each screen: Edit on the material rows (SCR-13), Edit and Delete on the rate rows (SCR-11). */
const ACTIONS_PER_ROW = { 'SCR-13': 1, 'SCR-11': 2 } as const;

interface Screen {
  readonly key: 'SCR-13' | 'SCR-11';
  readonly path: string;
  readonly title: string;
  readonly region: string;
  readonly addName: string;
  readonly errorTitle: string;
  readonly make: (page: Page, name: string) => Promise<void>;
}

async function post(page: Page, path: string, data: Record<string, string>): Promise<void> {
  const response = await page.request.post(`${DEVELOPMENT_URL}${path}`, { headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' }, data });
  expect(response.status()).toBe(201);
}

const SCREENS: ReadonlyArray<Screen> = [
  {
    key: 'SCR-13',
    path: '/masters/materials',
    title: 'Materials and lists',
    region: 'Material Master, scrollable',
    addName: 'Add material',
    errorTitle: 'We could not load the materials',
    make: (page, name) =>
      post(page, '/api/v1/materials', { materialInDrawing: name, materialConsidered: 'Invented QA steel', pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' }),
  },
  {
    key: 'SCR-11',
    path: '/masters/process',
    title: 'Process master',
    region: 'Process master rates, scrollable',
    addName: 'Add rate',
    errorTitle: 'We could not load the rates',
    make: (page, name) => post(page, '/api/v1/process-items', { name, unit: 'per kg', defaultValue: '1.37' }),
  },
];

function unique(testInfo: TestInfo, tag: string, length?: number): string {
  const base = `QA234-${tag}-r${testInfo.repeatEachIndex}-t${testInfo.retry}-${randomBytes(3).toString('hex')}`;
  return length === undefined ? base : base.padEnd(length, 'Q');
}

function save(file: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${file}.json`, JSON.stringify(data, null, 2));
}

async function openScreen(page: Page, screen: Screen, width: number): Promise<void> {
  await page.setViewportSize({ width, height: HEIGHT });
  await page.goto(screen.path);
  await expect(page.getByRole('heading', { level: 1, name: screen.title })).toBeVisible();
  await waitUntilHydrated(page, 'main button[data-action="add"]');
}

/** Everything the brief asks about the row actions of the region on the page, measured in the browser. */
async function measureActions(page: Page, regionName: string): Promise<{
  readonly regionLeft: number;
  readonly regionRight: number;
  readonly regionWidth: number;
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly scrollLeft: number;
  readonly pageOverflow: number;
  readonly actions: ReadonlyArray<{ readonly name: string; readonly left: number; readonly right: number; readonly inside: boolean; readonly covered: boolean }>;
}> {
  return page.evaluate((label) => {
    const region = document.querySelector<HTMLElement>(`[role="region"][aria-label="${label}"]`);
    if (region === null) throw new Error(`no region ${label}`);
    const box = region.getBoundingClientRect();
    const buttons = [...document.querySelectorAll<HTMLElement>('[data-item-id] button[data-action], [data-user-id] button[data-action]')].filter(
      (button) => region.contains(button) && button.getClientRects().length > 0,
    );
    const actions = buttons.map((button) => {
      // Bring the row into the window (vertically only) so elementFromPoint can see it; the table is never scrolled sideways here.
      window.scrollTo(0, Math.max(0, button.getBoundingClientRect().top + window.scrollY - 300));
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const top = document.elementFromPoint(x, y);
      return {
        name: button.getAttribute('aria-label') ?? button.textContent ?? '',
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        inside: rect.left >= box.left - 0.5 && rect.right <= box.right + 0.5,
        covered: !(top !== null && (top === button || button.contains(top))),
      };
    });
    window.scrollTo(0, 0);
    return {
      regionLeft: Math.round(box.left),
      regionRight: Math.round(box.right),
      regionWidth: Math.round(box.width),
      scrollWidth: region.scrollWidth,
      clientWidth: region.clientWidth,
      scrollLeft: region.scrollLeft,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      actions,
    };
  }, regionName);
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// G7-1
// ---------------------------------------------------------------------------------------------------------------------------------------
for (const screen of SCREENS) {
  test.describe(`G7-1 ${screen.key}: every row action is visible without scrolling the table`, () => {
    const rows: Array<unknown> = [];
    test.afterAll(() => save(`g7-1-${screen.key}`, rows));

    for (const width of WIDTHS) {
      test(`${screen.key} at ${width} px: a 100-character name and an ordinary row; actions inside the region, not covered, table not scrolled, page not scrolled`, async ({ page }, testInfo) => {
        const long = unique(testInfo, `long${width}`, NAME_LENGTH);
        expect(long).toHaveLength(NAME_LENGTH);
        await screen.make(page, long);
        await screen.make(page, unique(testInfo, `short${width}`));
        await openScreen(page, screen, width);
        await expect(page.locator('[data-item-id]:visible').filter({ hasText: long })).toBeVisible();

        const m = await measureActions(page, screen.region);
        rows.push({ screen: screen.key, width, ...m, actionCount: m.actions.length, actions: undefined });
        expect(m.actions.length, 'there are row actions').toBeGreaterThanOrEqual(2);
        expect(m.scrollLeft, 'the table is at its start').toBe(0);
        expect(m.scrollWidth, `the table needs no scroll (scrollWidth ${m.scrollWidth} vs clientWidth ${m.clientWidth})`).toBeLessThanOrEqual(m.clientWidth);
        for (const action of m.actions) {
          expect(action.inside, `${action.name} is inside the region ${m.regionLeft}-${m.regionRight}: ${action.left}-${action.right}`).toBe(true);
          expect(action.covered, `${action.name} is not covered by another element`).toBe(false);
        }
        expect(m.pageOverflow, 'the page does not scroll sideways').toBeLessThanOrEqual(0);
        expect(await page.evaluate(() => window.scrollX)).toBe(0);
        expect(m.regionRight, 'the region ends inside the window').toBeLessThanOrEqual(width);
      });
    }
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// G7-2: the other delivered tables, measured only (a failure here is a finding, not a test failure)
// ---------------------------------------------------------------------------------------------------------------------------------------
test.describe('G7-2 the other delivered tables (measured, for #134 and OQ-UX-20)', () => {
  test('SCR-14 Users, SCR-16 Audit, SCR-03 Task queue and SCR-17: region width, content width and where the row actions are at the seven widths', async ({ page }) => {
    test.skip(process.env['QA234_MEASURE'] !== '1', 'a measurement for the test report, not an assertion: run with QA234_MEASURE=1');
    test.setTimeout(300_000);
    const report: Array<Record<string, unknown>> = [];
    for (const [key, path, region, heading] of [
      ['SCR-14 Users', '/users', 'Users, scrollable', 'Users'],
      ['SCR-16 Audit', '/audit', '', 'Audit'],
      ['SCR-03 Task queue', '/queue', '', 'Task queue'],
    ] as const) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: HEIGHT });
        const response = await page.goto(path);
        const h1 = await page.locator('main h1').first().textContent({ timeout: 15_000 }).catch(() => null);
        const tableCount = await page.locator('table').count();
        const row: Record<string, unknown> = { key, width, status: response?.status(), h1, tables: tableCount, headingExpected: heading };
        if (tableCount > 0) {
          const regionLabel = await page.locator('[data-slot="table-container"]').first().getAttribute('aria-label');
          const m = await measureActions(page, region === '' ? (regionLabel ?? '') : region);
          Object.assign(row, { regionWidth: m.regionWidth, scrollWidth: m.scrollWidth, clientWidth: m.clientWidth, tableScrolls: m.scrollWidth > m.clientWidth, pageOverflow: m.pageOverflow });
          const tail = m.actions.map((a) => ({ name: a.name, inside: a.inside, left: a.left, right: a.right, covered: a.covered }));
          Object.assign(row, { actionCount: tail.length, actionsOutsideRegion: tail.filter((a) => !a.inside).length, actionsCovered: tail.filter((a) => a.covered).length, firstOutside: tail.find((a) => !a.inside) ?? null });
        }
        report.push(row);
      }
    }
    const sc17 = await page.goto('/customers');
    report.push({ key: 'SCR-17 route probe /customers', status: sc17?.status() });
    save('g7-2-other-tables', report);
  });
});

test.describe('G7-2b SCR-14 Users with the longest values the form allows (measured)', () => {
  test('a 120-character name with no space and a 254-character e-mail (written into the first row in the browser): where the row actions are at the seven widths, as drawn and forced to scroll', async ({ page }) => {
    test.skip(process.env['QA234_MEASURE'] !== '1', 'a measurement for the test report, not an assertion: run with QA234_MEASURE=1');
    test.setTimeout(300_000);
    const report: Array<Record<string, unknown>> = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto('/users');
      await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
      await expect(page.locator('[data-user-id] button[data-action]:visible').first()).toBeVisible();
      await page.evaluate(() => {
        const row = document.querySelector<HTMLElement>('table tbody tr');
        const cells = row?.querySelectorAll('td');
        if (cells === undefined || cells.length < 2) throw new Error('no users table row');
        (cells[0] as HTMLElement).textContent = 'U'.repeat(120);
        (cells[1] as HTMLElement).textContent = `${'e'.repeat(240)}@x.test`;
      });
      const drawn = await measureActions(page, 'Users, scrollable');
      await page.locator('[data-slot="table-container"] table').evaluate((table) => { table.style.minWidth = '1000px'; });
      const forced = await measureActions(page, 'Users, scrollable');
      report.push({
        width,
        regionWidth: drawn.regionWidth,
        asDrawn: { scrollWidth: drawn.scrollWidth, tableScrolls: drawn.scrollWidth > drawn.clientWidth, actionsOutside: drawn.actions.filter((a) => !a.inside).length, of: drawn.actions.length, pageOverflow: drawn.pageOverflow },
        forced1000: { scrollWidth: forced.scrollWidth, actionsOutside: forced.actions.filter((a) => !a.inside).length, of: forced.actions.length, pageOverflow: forced.pageOverflow },
      });
    }
    save('g7-2b-users-long-values', report);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// G7-3: QLT-06, the row lines under the sticky Actions column
// ---------------------------------------------------------------------------------------------------------------------------------------
interface LineCoverage {
  readonly yBoundary: number;
  readonly lineOutsideStickyColumn: number;
  readonly lineUnderStickyColumn: number;
}

/**
 * Decodes a screenshot in a blank page (a canvas, so no image library is needed) and, at each row boundary (a band of three pixel rows), returns the
 * share of columns where a line is drawn, left of the sticky Actions column and under it. A line is any pixel that differs from the card surface.
 */
async function analyseRowLines(page: Page, png: Buffer, boundaries: ReadonlyArray<number>, stickLeft: number, surfaceY: number): Promise<ReadonlyArray<LineCoverage>> {
  const probe = await page.context().newPage();
  try {
    return await probe.evaluate(
      async ({ b64, ys, left, sy }) => {
        const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext('2d');
        if (context === null) throw new Error('no canvas');
        context.drawImage(bitmap, 0, 0);
        const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
        const at = (x: number, y: number): number[] => [data[(y * width + x) * 4] ?? 0, data[(y * width + x) * 4 + 1] ?? 0, data[(y * width + x) * 4 + 2] ?? 0];
        const surface = at(2, sy);
        const differs = (x: number, y: number): boolean => {
          const p = at(x, y);
          return Math.abs((p[0] ?? 0) - (surface[0] ?? 0)) + Math.abs((p[1] ?? 0) - (surface[1] ?? 0)) + Math.abs((p[2] ?? 0) - (surface[2] ?? 0)) >= 12;
        };
        return ys.map((yBoundary) => {
          const band = [yBoundary - 1, yBoundary, yBoundary + 1].filter((y) => y >= 0 && y < height);
          let outside = 0;
          let outsideTotal = 0;
          let inside = 0;
          let insideTotal = 0;
          for (let x = 0; x < width; x += 1) {
            const drawn = band.some((y) => differs(x, y));
            if (x < left - 2) { outsideTotal += 1; if (drawn) outside += 1; }
            else if (x > left + 3) { insideTotal += 1; if (drawn) inside += 1; }
          }
          return { yBoundary, lineOutsideStickyColumn: outsideTotal === 0 ? 0 : outside / outsideTotal, lineUnderStickyColumn: insideTotal === 0 ? 0 : inside / insideTotal };
        });
      },
      { b64: png.toString('base64'), ys: [...boundaries], left: stickLeft, sy: surfaceY },
    );
  } finally {
    await probe.close();
  }
}

test.describe('G7-3 QLT-06: row lines under the sticky Actions column at 1024 px, table forced to scroll', () => {
  for (const screen of SCREENS) {
    test(`${screen.key}: pixels at each row boundary, inside and outside the Actions column, for three scroll positions`, async ({ page }, testInfo) => {
      for (const tag of ['a', 'b', 'c']) await screen.make(page, unique(testInfo, `line${tag}`));
      await openScreen(page, screen, 1024);
      const region = page.getByRole('region', { name: screen.region });
      await expect(region).toBeVisible();
      await region.locator('table').evaluate((table) => { table.style.minWidth = '1000px'; });
      // A tall window, so that every row of the list is inside the screenshot (the database holds the rows of earlier tests).
      await page.setViewportSize({ width: 1024, height: 4000 });
      const result: Array<Record<string, unknown>> = [];
      for (const [label, fraction] of [['start', 0], ['middle', 0.5], ['end', 1]] as const) {
        await region.evaluate((element, f) => { element.scrollLeft = (element.scrollWidth - element.clientWidth) * f; }, fraction);
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const geometry = await region.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const head = element.querySelector<HTMLElement>('thead th:last-child');
          const stick = head?.getBoundingClientRect();
          const rows = [...element.querySelectorAll<HTMLElement>('tbody tr')].map((tr) => tr.getBoundingClientRect());
          const probe = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
          return {
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
            stick: stick === undefined ? null : { left: stick.left, right: stick.right },
            rows: rows.map((r) => ({ top: r.top, bottom: r.bottom })),
            borderToken: probe,
            scrollLeft: element.scrollLeft,
          };
        });
        const shot = await page.screenshot({ clip: geometry.box, path: `${OUT}/qlt06-${screen.key}-${label}.png` });
        const stickLeft = Math.round((geometry.stick?.left ?? geometry.box.width) - geometry.box.x);
        const boundaries = geometry.rows.slice(0, -1).map((r) => Math.round(r.bottom - geometry.box.y));
        const firstRowY = Math.round((geometry.rows[0]?.top ?? 0) - geometry.box.y + 6);
        const perBoundary = await analyseRowLines(page, shot, boundaries, stickLeft, firstRowY);
        for (const boundary of perBoundary) {
          expect(boundary.lineOutsideStickyColumn, `${label}: the row line at y=${boundary.yBoundary} is drawn left of the Actions column`).toBeGreaterThanOrEqual(0.99);
          expect(boundary.lineUnderStickyColumn, `${label}: the row line at y=${boundary.yBoundary} continues under the Actions column`).toBeGreaterThanOrEqual(0.99);
        }
        result.push({ position: label, scrollLeft: geometry.scrollLeft, stickLeft, boundaries: perBoundary });
      }
      save(`g7-3-${screen.key}`, result);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// G7-5: DEF-020
// ---------------------------------------------------------------------------------------------------------------------------------------
async function failTheList(page: Page, screen: Screen): Promise<void> {
  const url = screen.key === 'SCR-13' ? '**/api/v1/materials' : '**/api/v1/process-items';
  await page.route(url, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'busy', status: 503, code: 'DATABASE_BUSY', requestId: 'req-0a0b0c0d' }) });
  });
}

async function pressWithKeyboard(button: Locator): Promise<void> {
  await button.focus();
  await button.press('Enter');
}

for (const screen of SCREENS) {
  test.describe(`G7-5 ${screen.key}: DEF-020 focus when the list cannot be read again`, () => {
    for (const how of ['Edit then Save', 'Add then Save'] as const) {
      test(`${how}, the re-read fails: focus is on the error title, and stays there; then Add and Escape, Cancel or Close return focus to "${screen.addName}"`, async ({ page }, testInfo) => {
        const name = unique(testInfo, 'focus');
        await screen.make(page, name);
        await openScreen(page, screen, 1024);
        await failTheList(page, screen);
        const title = page.getByRole('heading', { name: screen.errorTitle });

        if (how === 'Edit then Save') {
          await pressWithKeyboard(page.locator('[data-item-id]:visible').filter({ hasText: name }).getByRole('button', { name: `Edit ${name}` }));
          const dialog = page.getByRole('dialog', { name: `Edit ${name}` });
          await expect(dialog).toBeVisible();
          await dialog.getByLabel(screen.key === 'SCR-13' ? 'Material-Scrap-Rate (per kg)' : 'Default value').fill('3.37');
          await dialog.getByRole('button', { name: 'Save' }).click();
        } else {
          await pressWithKeyboard(page.getByRole('button', { name: screen.addName }));
          const dialog = page.getByRole('dialog', { name: screen.addName });
          await expect(dialog).toBeVisible();
          const added = unique(testInfo, 'added');
          if (screen.key === 'SCR-13') {
            await dialog.getByLabel('Material in Drawing').fill(added);
            await dialog.getByLabel('Material Considered').fill('Invented QA steel');
            await dialog.getByLabel('Price per kg').fill('58.37');
            await dialog.getByLabel('Specific gravity').fill('7.37');
            await dialog.getByLabel('Material-Scrap-Rate (per kg)').fill('22.37');
          } else {
            await dialog.getByLabel('Rate name').fill(added);
            await dialog.getByLabel('Unit').selectOption('per sq in');
            await dialog.getByLabel('Default value').fill('1.37');
          }
          await dialog.getByRole('button', { name: screen.addName }).click();
        }
        await expect(title).toBeVisible();
        await expect(title).toBeFocused({ timeout: 3000 });
        // Still on the title a moment later (the late close handler must not take it).
        await page.waitForTimeout(600);
        await expect(title).toBeFocused();

        const add = page.getByRole('button', { name: screen.addName });
        for (const closeWith of ['Escape', 'Cancel'] as const) {
          await pressWithKeyboard(add);
          const dialog = page.getByRole('dialog', { name: screen.addName });
          await expect(dialog).toBeVisible();
          if (closeWith === 'Escape') await page.keyboard.press('Escape');
          else await dialog.getByRole('button', { name: 'Cancel' }).click();
          await expect(page.getByRole('dialog')).toHaveCount(0);
          await expect(add, `after ${closeWith}`).toBeFocused({ timeout: 3000 });
        }
      });
    }
  });
}

test('G7-5 SCR-11: Delete confirmed, the re-read fails: focus is on the error title', async ({ page }, testInfo) => {
  const screen = SCREENS[1] as Screen;
  const name = unique(testInfo, 'del');
  await screen.make(page, name);
  await openScreen(page, screen, 1024);
  await failTheList(page, screen);
  await pressWithKeyboard(page.locator('[data-item-id]:visible').filter({ hasText: name }).getByRole('button', { name: `Delete ${name}` }));
  const alert = page.getByRole('alertdialog', { name: `Delete ${name}?` });
  await expect(alert).toBeVisible();
  await alert.getByRole('button', { name: 'Delete rate' }).click();
  const title = page.getByRole('heading', { name: screen.errorTitle });
  await expect(title).toBeVisible();
  await expect(title).toBeFocused({ timeout: 3000 });
});

// The second path of QLT-01, which the developer's tests have only as a unit case: a delete the server refuses because a formula began to use the rate
// (409), whose re-read of the list fails while the "blocked" dialog is open. When the dialog closes, focus must not be left on the body.
test('G7-5 SCR-11 (QLT-01, second path): a refused delete whose re-read fails while the refusal is open: after Close, focus is on a live element, not the body', async ({ page }, testInfo) => {
  const screen = SCREENS[1] as Screen;
  const name = unique(testInfo, 'blocked');
  await screen.make(page, name);
  await openScreen(page, screen, 1024);
  await page.route('**/api/v1/process-items/*', (route) => {
    if (route.request().method() !== 'DELETE') return route.continue();
    return route.fulfill({
      status: 409,
      contentType: 'application/problem+json',
      body: JSON.stringify({ type: 'about:blank', title: 'in use', status: 409, code: 'PROCESS_ITEM_IN_USE', requestId: 'req-0a0b0c0d', usedBy: [{ letter: 'AL', label: 'Cutting Cost' }] }),
    });
  });
  await failTheList(page, screen);
  await pressWithKeyboard(page.locator('[data-item-id]:visible').filter({ hasText: name }).getByRole('button', { name: `Delete ${name}` }));
  await page.getByRole('alertdialog', { name: `Delete ${name}?` }).getByRole('button', { name: 'Delete rate' }).click();
  const blocked = page.getByRole('alertdialog', { name: 'This rate is used by a formula' });
  await expect(blocked).toBeVisible();
  await expect(page.getByText(screen.errorTitle)).toBeAttached(); // behind the dialog, so it is not in the accessibility tree while the dialog is open
  await blocked.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName ?? 'none'), { timeout: 3000, message: 'focus is not on the body' }).not.toBe('BODY');
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// G7-7: keyboard and axe at 768 and 1024 px
// ---------------------------------------------------------------------------------------------------------------------------------------
for (const screen of SCREENS) {
  for (const width of [768, 1024] as const) {
    test(`G7-7 ${screen.key} at ${width} px: keyboard, with the table forced to scroll: Tab order, focus visible and not covered, Enter opens, Escape returns focus`, async ({ page }, testInfo) => {
      const long = unique(testInfo, `kb${width}`, NAME_LENGTH);
      await screen.make(page, long);
      await screen.make(page, unique(testInfo, `kb2${width}`));
      await openScreen(page, screen, width);
      const region = page.getByRole('region', { name: screen.region });
      await expect(region).toBeVisible();


      // Forced to scroll, then the keyboard: Tab from the region goes to each row action in order; none is covered; the page never moves sideways.
      await region.locator('table').evaluate((table) => { table.style.minWidth = '1000px'; });
      expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
      await region.focus();
      // DEF-023: how many row actions there are is read from the page, never assumed. The test makes two rows, so the table has at least
      // two rows' actions whatever other tests have saved; the walk must reach every action of the table (up to TAB_PRESSES).
      const total = await region.locator('[data-item-id] button[data-action]:visible').count();
      expect(total, 'the two rows this test made are listed').toBeGreaterThanOrEqual(2 * ACTIONS_PER_ROW[screen.key]);
      const seen: string[] = [];
      for (let press = 0; press < TAB_PRESSES; press += 1) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (el === null || el.getAttribute('data-action') === null) return null;
          const rect = el.getBoundingClientRect();
          const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          const style = getComputedStyle(el);
          return {
            name: el.getAttribute('aria-label') ?? el.textContent ?? '',
            covered: !(top === el || el.contains(top)),
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
            boxShadow: style.boxShadow,
            focusVisible: el.matches(':focus-visible'),
            scrollX: window.scrollX,
            inView: rect.left >= 0 && rect.right <= window.innerWidth,
          };
        });
        if (info === null) break;
        seen.push(info.name);
        expect(info.covered, `${info.name} is not covered`).toBe(false);
        expect(info.focusVisible, `${info.name} shows keyboard focus`).toBe(true);
        expect(info.outlineStyle !== 'none' || info.boxShadow !== 'none', `${info.name} has a visible focus indicator`).toBe(true);
        expect(info.scrollX).toBe(0);
        expect(info.inView).toBe(true);
      }
      expect(seen.length, `Tab reached the row actions (the table has ${total}): ${seen.join(' | ')}`).toBeGreaterThanOrEqual(Math.min(total, TAB_PRESSES));
      expect(seen[0]).toMatch(/^Edit /);

      // Enter opens the first Edit and Escape returns focus to it.
      const first = page.locator('[data-item-id]:visible button[data-action="edit"]').first();
      await first.focus();
      await first.press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(first).toBeFocused({ timeout: 3000 });
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

      save(`g7-7-${screen.key}-${width}`, { seen });
    });

    test(`G7-7 ${screen.key} at ${width} px: axe has no violation as drawn, nor with the table forced to scroll and its region scrolled to the far end`, async ({ page }, testInfo) => {
      await screen.make(page, unique(testInfo, `ax${width}`, NAME_LENGTH));
      await openScreen(page, screen, width);
      const region = page.getByRole('region', { name: screen.region });
      await expect(region).toBeVisible();
      await expectNoAxeViolations(page);
      await region.locator('table').evaluate((table) => { table.style.minWidth = '1000px'; });
      await region.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
      await expectNoAxeViolations(page);
    });
  }
}
