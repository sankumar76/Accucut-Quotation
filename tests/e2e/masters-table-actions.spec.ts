import { randomBytes } from 'node:crypto';

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, DEVELOPMENT_URL } from './support/servers';

/**
 * DEF-021 (AQP-234): the row actions of a masters table are inside the table's visible box, without scrolling it, at every width from 768 to
 * 1440 px (UX spec v0.19 section 6.0 "Masters tables", SCR-11 and SCR-13). Run for Process master and for Materials, with one row whose name is
 * 100 characters with no space (the longest the form allows), at the eleven widths of the spec's table of regions.
 *
 * Each width is checked three ways: as drawn (the fit), with the table forced wider than the region, at its start and after a Tab, and scrolled to its
 * far end (the sticky guarantee, part 2: without `sticky right-0` the forced cases fail). The test sets its own viewport, so it runs in the desktop
 * project only; the other two projects would repeat the same eleven widths.
 */

test.use({ storageState: ADMIN_STATE });

/** The widths of ux-spec section 6.0, from the narrowest drawer width to the widest the spec names. */
const WIDTHS = [768, 900, 1000, 1023, 1024, 1180, 1257, 1279, 1280, 1366, 1440] as const;
const HEIGHT = 900;
const NAME_LENGTH = 100;

interface Screen {
  readonly label: string;
  readonly path: string;
  readonly title: string;
  readonly region: string;
  readonly make: (page: Page, name: string) => Promise<void>;
}

async function post(page: Page, path: string, data: Record<string, string>): Promise<void> {
  const response = await page.request.post(`${DEVELOPMENT_URL}${path}`, { headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' }, data });
  expect(response.status()).toBe(201);
}

const SCREENS: ReadonlyArray<Screen> = [
  {
    label: 'SCR-11 Process master',
    path: '/masters/process',
    title: 'Process master',
    region: 'Process master rates, scrollable',
    make: (page, name) => post(page, '/api/v1/process-items', { name, unit: 'per kg', defaultValue: '1.37' }),
  },
  {
    label: 'SCR-13 Materials',
    path: '/masters/materials',
    title: 'Materials and lists',
    region: 'Material Master, scrollable',
    make: (page, name) =>
      post(page, '/api/v1/materials', {
        materialInDrawing: name,
        materialConsidered: 'K'.repeat(NAME_LENGTH),
        pricePerKg: '58.37',
        specificGravity: '7.37',
        scrapRate: '22.37',
      }),
  },
];

/** A name of exactly 100 letters with no space that nobody else has: the project, repeat, retry and a random part are in it. */
function longName(testInfo: TestInfo): string {
  const unique = `E2E234-${testInfo.repeatEachIndex}-${testInfo.retry}-${randomBytes(4).toString('hex')}`;
  return unique.padEnd(NAME_LENGTH, 'W');
}

/** The smallest width the table is forced to when the sticky column is tested: 1000 px (ux-spec 6.0 "Tests"), and always wider than the region. */
const FORCED_MIN_WIDTH = 1000;
const FORCED_EXTRA = 200;

/** Every row action is fully inside the visible box of the region, and the region itself is inside the window (QLT-03). */
async function expectActionsInside(page: Page, region: Locator, mode: string): Promise<void> {
  const box = await region.boundingBox();
  expect(box, mode).not.toBeNull();
  const left = box?.x ?? 0;
  const right = left + (box?.width ?? 0);
  expect(left, `${mode}: the region starts inside the window`).toBeGreaterThanOrEqual(0);
  expect(right, `${mode}: the region ends inside the window`).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  const actions = page.locator('[data-item-id]:visible button[data-action]');
  const count = await actions.count();
  expect(count, `${mode}: there are row actions`).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const button = await actions.nth(index).boundingBox();
    expect(button, `${mode}: action ${index}`).not.toBeNull();
    expect(button?.x ?? -1, `${mode}: action ${index} starts inside the region`).toBeGreaterThanOrEqual(left);
    expect((button?.x ?? 0) + (button?.width ?? 0), `${mode}: action ${index} ends inside the region`).toBeLessThanOrEqual(right);
  }
}

for (const screen of SCREENS) {
  test.describe(`${screen.label}: row actions are inside the table region (DEF-021)`, () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'the test sets its own widths, so one project runs it');
    });

    for (const width of WIDTHS) {
      test(`at ${width} px every row action is fully inside the region's visible box: as drawn, with the table forced to scroll, and scrolled to its end`, async ({ page }, testInfo) => {
        const name = longName(testInfo);
        expect(name).toHaveLength(NAME_LENGTH);
        await screen.make(page, name);
        await page.setViewportSize({ width, height: HEIGHT });
        await page.goto(screen.path);
        await expect(page.getByRole('heading', { level: 1, name: screen.title })).toBeVisible();
        await waitUntilHydrated(page, 'main button[data-action="add"]');

        const region = page.getByRole('region', { name: screen.region });
        await expect(region).toBeVisible();
        await expect(page.locator('[data-item-id]:visible button[data-action]').first()).toBeVisible();
        await expect(page.locator('[data-item-id]:visible').filter({ hasText: name })).toBeVisible();

        // 1. As drawn (part 3, the fit): the headings and names wrap, so the table needs no scrolling.
        expect(await region.evaluate((element) => element.scrollLeft)).toBe(0);
        await expectActionsInside(page, region, 'as drawn');
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

        // 2. Forced to scroll (part 2, the guarantee): the table is made wider than the region, at its start. Only the sticky column keeps the
        //    actions inside the region's box.
        const regionWidth = (await region.boundingBox())?.width ?? 0;
        const forcedWidth = Math.max(FORCED_MIN_WIDTH, Math.ceil(regionWidth) + FORCED_EXTRA);
        await region.locator('table').evaluate((table, minWidth) => { table.style.minWidth = `${minWidth}px`; }, forcedWidth);
        expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth), 'the forced table scrolls').toBe(true);
        expect(await region.evaluate((element) => element.scrollLeft)).toBe(0);
        await expectActionsInside(page, region, 'forced to scroll, at its start');
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

        // 3. A Tab from the region goes to the first row action, which is not under the sticky column and does not move the page sideways.
        await region.focus();
        await page.keyboard.press('Tab');
        await expect(page.locator(':focus')).toHaveAttribute('data-action', /^(edit|delete)$/);
        await expectActionsInside(page, region, 'forced to scroll, after Tab');
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

        // 4. Scrolled to its far end.
        await region.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
        expect(await region.evaluate((element) => element.scrollLeft), 'the forced table scrolled').toBeGreaterThan(0);
        await expectActionsInside(page, region, 'forced to scroll, at its end');
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      });
    }
  });
}
