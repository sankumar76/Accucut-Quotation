import { randomBytes } from 'node:crypto';

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { E2E_ADMIN } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, DEVELOPMENT_URL } from './support/servers';

/**
 * DEF-021 (AQP-234) and GitHub #134 (AQP-245): the row actions of a masters table are inside the table's visible box, without scrolling it, at
 * every width from 768 to 1440 px (UX spec v0.20 section 6.0 "Masters tables", SCR-11, SCR-13 and SCR-14). Run for Process master, for Materials
 * and for Users, each with one row whose name is the longest the table's own form allows with no space (100 characters; 120 for a user), at the
 * eleven widths of the spec's table of regions.
 *
 * Each width is checked three ways: as drawn (the fit), with the table forced wider than the region, at its start and after a Tab, and scrolled to its
 * far end (the sticky guarantee, part 2: without `sticky right-0` the forced cases fail). The test sets its own viewport, so it runs in the desktop
 * project only; the other two projects would repeat the same eleven widths.
 *
 * Users (AQP-245) adds what only that screen has: three buttons in every row (the Admin's own row keeps its two disabled ones, in place), a Tab
 * through the buttons of the first row that none of them is covered by the sticky column or lacks a focus ring (AC-5), axe on the forced table at
 * 768, 1024 and 1366 px (AC-5), and the card list below 768 px, which this change does not touch (AC-4).
 */

test.use({ storageState: ADMIN_STATE });

/** The widths of ux-spec section 6.0, from the narrowest drawer width to the widest the spec names. */
const WIDTHS = [768, 900, 1000, 1023, 1024, 1180, 1257, 1279, 1280, 1366, 1440] as const;
const HEIGHT = 900;
/** The longest name the form of SCR-11 and SCR-13 accepts (UX spec 6.0 "Names wrap"); a user's name allows 120 (`USER_NAME_MAX_LENGTH`). */
const NAME_LENGTH = 100;
const USER_NAME_LENGTH = 120;
/** Widths at which the Users table, forced to scroll, is also scanned by axe (AQP-245 AC-5). */
const AXE_WIDTHS: ReadonlyArray<number> = [768, 1024, 1366];
const CARD_WIDTH = 360;
const USERS_PASSWORD = 'invented-e2e-password-for-aqp-245';
/** The accessible names of the Admin's own, disabled, buttons (SCR-14, AQP-65): written out here and not imported. */
const OWN_RESET_NAME = 'Reset password is not available for your own account. Use Change password in the account menu.';
const OWN_DEACTIVATE_NAME = 'You cannot deactivate your own account';

interface Screen {
  readonly label: string;
  readonly path: string;
  readonly title: string;
  readonly region: string;
  /** The rows (table) or cards (phone) of the screen; the one that is visible at the width under test counts. */
  readonly rowSelector: string;
  /** The length of the long name `make` is given: the longest the table's own form accepts. */
  readonly nameLength: number;
  /** The `data-action` of the button a Tab from the region reaches first. */
  readonly firstAction: RegExp;
  /** The Users screen only: more checks of what it has (three buttons a row, the own row, the Tab through a row, axe). */
  readonly users?: true;
  readonly make: (page: Page, name: string) => Promise<void>;
}

async function post(page: Page, path: string, data: Record<string, string>): Promise<void> {
  const response = await page.request.post(`${DEVELOPMENT_URL}${path}`, { headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' }, data });
  expect(response.status()).toBe(201);
}

/** One person, added the way the Users screen adds one: a name, an e-mail nobody has, a role and a first password. */
function addPerson(page: Page, name: string): Promise<void> {
  return post(page, '/api/v1/users', { name, email: `e2e245.${randomBytes(6).toString('hex')}@example.test`, role: 'ENGINEER', password: USERS_PASSWORD });
}

const SCREENS: ReadonlyArray<Screen> = [
  {
    label: 'SCR-11 Process master',
    path: '/masters/process',
    title: 'Process master',
    region: 'Process master rates, scrollable',
    rowSelector: '[data-item-id]',
    nameLength: NAME_LENGTH,
    firstAction: /^(edit|delete)$/,
    make: (page, name) => post(page, '/api/v1/process-items', { name, unit: 'per kg', defaultValue: '1.37' }),
  },
  {
    label: 'SCR-13 Materials',
    path: '/masters/materials',
    title: 'Materials and lists',
    region: 'Material Master, scrollable',
    rowSelector: '[data-item-id]',
    nameLength: NAME_LENGTH,
    firstAction: /^(edit|delete)$/,
    make: (page, name) =>
      post(page, '/api/v1/materials', {
        materialInDrawing: name,
        materialConsidered: 'K'.repeat(NAME_LENGTH),
        pricePerKg: '58.37',
        specificGravity: '7.37',
        scrapRate: '22.37',
      }),
  },
  {
    label: 'SCR-14 Users',
    path: '/users',
    title: 'Users',
    region: 'Users, scrollable',
    rowSelector: '[data-user-id]',
    nameLength: USER_NAME_LENGTH,
    firstAction: /^edit$/,
    users: true,
    // The long name, and two more people, so the list holds at least six with the E2E Admin, Lead and Engineer the set-up project makes.
    make: async (page, name) => {
      await addPerson(page, name);
      await addPerson(page, `E2E 245 second ${randomBytes(3).toString('hex')}`);
      await addPerson(page, `E2E 245 third ${randomBytes(3).toString('hex')}`);
    },
  },
];

/** A name of exactly `length` letters with no space that nobody else has: the project, repeat, retry and a random part are in it. */
function longName(testInfo: TestInfo, length: number): string {
  const unique = `E2E234-${testInfo.repeatEachIndex}-${testInfo.retry}-${randomBytes(4).toString('hex')}`;
  return unique.padEnd(length, 'W');
}

/** The smallest width the table is forced to when the sticky column is tested: 1000 px (ux-spec 6.0 "Tests"), and always wider than the region. */
const FORCED_MIN_WIDTH = 1000;
const FORCED_EXTRA = 200;

interface Edges {
  readonly left: number;
  readonly right: number;
}

/** The left and right edges of every element `locator` finds, read in one call, so a list of many rows costs one round trip, not one per button. */
function edgesOf(locator: Locator): Promise<ReadonlyArray<Edges>> {
  return locator.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right };
    }),
  );
}

/** Every row action is fully inside the visible box of the region, and the region itself is inside the window (QLT-03). */
async function expectActionsInside(page: Page, region: Locator, screen: Screen, mode: string): Promise<void> {
  const box = await region.boundingBox();
  expect(box, mode).not.toBeNull();
  const left = box?.x ?? 0;
  const right = left + (box?.width ?? 0);
  expect(left, `${mode}: the region starts inside the window`).toBeGreaterThanOrEqual(0);
  expect(right, `${mode}: the region ends inside the window`).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  const actions = await edgesOf(page.locator(`${screen.rowSelector}:visible button[data-action]`));
  expect(actions.length, `${mode}: there are row actions`).toBeGreaterThan(0);
  actions.forEach((button, index) => {
    expect(button.left, `${mode}: action ${index} starts inside the region`).toBeGreaterThanOrEqual(left);
    expect(button.right, `${mode}: action ${index} ends inside the region`).toBeLessThanOrEqual(right);
  });
}

/** Every visible row holds the same number of row actions (Users: three, the Admin's own row too, with two of them disabled). */
async function expectButtonsPerRow(page: Page, screen: Screen, expected: number, mode: string): Promise<void> {
  const counts = await page.locator(`${screen.rowSelector}:visible`).evaluateAll((rows) => rows.map((row) => row.querySelectorAll('button[data-action]').length));
  expect(counts.length, `${mode}: there are rows`).toBeGreaterThanOrEqual(6);
  expect(counts.filter((count) => count !== expected), `${mode}: every row has ${expected} buttons`).toEqual([]);
}

/** Three 36 px buttons, two 8 px gaps and 16 px of padding on each side (UX spec 6.0 "Masters tables", Width: 156 px for three buttons). */
const THREE_BUTTON_COLUMN_WIDTH = 156;

/**
 * The table was given `actionButtons={3}` (AQP-245 AC-2). The sticky class of the Actions cells alone keeps the buttons inside the region, so
 * the positions above cannot tell a table that has the prop from one that has lost it. What the prop sets can: the width of the Actions column,
 * the scroll padding that keeps a focused button clear of it, and wrapping headings. The plant of AQP-245 (the prop removed) fails here.
 */
async function expectThreeButtonColumn(region: Locator, mode: string): Promise<void> {
  const actionsHeading = region.locator('thead th').last();
  const width = await actionsHeading.evaluate((heading) => heading.getBoundingClientRect().width);
  expect(width, `${mode}: the Actions column is ${THREE_BUTTON_COLUMN_WIDTH} px wide`).toBeCloseTo(THREE_BUTTON_COLUMN_WIDTH, 0);
  const scrollPadding = await region.evaluate((element) => getComputedStyle(element).scrollPaddingInlineEnd);
  expect(scrollPadding, `${mode}: the region keeps focus clear of the Actions column`).toBe(`${THREE_BUTTON_COLUMN_WIDTH}px`);
  const wrapping = await region.locator('thead th').evaluateAll((headings) => headings.map((heading) => getComputedStyle(heading).whiteSpace));
  expect(wrapping.filter((value) => value !== 'normal'), `${mode}: the headings wrap`).toEqual([]);
}

/** The Admin's own row (AC-3): Edit, then Reset password and Deactivate, disabled, with their names, in that order and inside the region. */
async function expectOwnRowIntact(page: Page, region: Locator, mode: string): Promise<void> {
  const own = page.locator('[data-user-id]:visible').filter({ hasText: E2E_ADMIN.email });
  await expect(own, `${mode}: the Admin's own row is shown`).toHaveCount(1);
  const buttons = own.locator('button[data-action]');
  await expect(buttons, `${mode}: three buttons in the own row`).toHaveCount(3);
  await expect(buttons.nth(0)).toHaveAttribute('data-action', 'edit');
  await expect(buttons.nth(0)).toBeEnabled();
  await expect(buttons.nth(1)).toHaveAttribute('data-action', 'reset');
  await expect(buttons.nth(1)).toBeDisabled();
  await expect(buttons.nth(1)).toHaveAccessibleName(OWN_RESET_NAME);
  await expect(buttons.nth(2)).toHaveAttribute('data-action', 'deactivate');
  await expect(buttons.nth(2)).toBeDisabled();
  await expect(buttons.nth(2)).toHaveAccessibleName(OWN_DEACTIVATE_NAME);
  const edges = await edgesOf(buttons);
  const box = await region.boundingBox();
  edges.forEach((button, index) => {
    expect(button.left, `${mode}: own-row button ${index} starts inside the region`).toBeGreaterThanOrEqual(box?.x ?? 0);
    expect(button.right, `${mode}: own-row button ${index} ends inside the region`).toBeLessThanOrEqual((box?.x ?? 0) + (box?.width ?? 0));
    if (index > 0) expect(button.left, `${mode}: own-row button ${index} follows the one before it`).toBeGreaterThanOrEqual(edges[index - 1]?.right ?? 0);
  });
}

/**
 * Tab from the region through the buttons of the first row (AC-5): each focused button is a row action of that row, shows a focus ring
 * (`:focus-visible`, which a keyboard focus always matches), is inside the region, and is the element painted at its own centre, so the
 * sticky Actions column does not cover it. Disabled buttons take no Tab, so the first row may hold fewer than three.
 */
async function expectTabThroughFirstRow(page: Page, region: Locator, screen: Screen, mode: string): Promise<void> {
  await region.focus();
  const row = page.locator(`${screen.rowSelector}:visible`).first();
  const enabled = await row.locator('button[data-action]:not([disabled])').count();
  expect(enabled, `${mode}: the first row has a button to reach`).toBeGreaterThan(0);
  for (let press = 0; press < enabled; press += 1) {
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused, `${mode}: Tab ${press + 1} reaches a row action of the first row`).toHaveAttribute('data-action', /^(edit|reset|deactivate|activate)$/);
    await expect(row.locator(':focus'), `${mode}: Tab ${press + 1} stays in the first row`).toHaveCount(1);
    await expect(page.locator('button[data-action]:focus-visible'), `${mode}: Tab ${press + 1} shows a focus ring`).toHaveCount(1);
    const covered = await focused.evaluate((button) => {
      const box = button.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return top === null || !button.contains(top);
    });
    expect(covered, `${mode}: Tab ${press + 1}: the focused button is not covered`).toBe(false);
    await expectActionsInside(page, region, screen, `${mode}, Tab ${press + 1}`);
  }
}

// File level on purpose (AQP-244, QLT-01): this file is in OWN_WIDTH_FILES, so only `desktop` lists it, and every test in it, present or
// future, sets its own width. tests/unit/own-width-files.test.ts fails if this hook moves into a describe block.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'each test sets its own width, so one project runs it');
});

for (const screen of SCREENS) {
  test.describe(`${screen.label}: row actions are inside the table region (DEF-021)`, () => {
    for (const width of WIDTHS) {
      test(`at ${width} px every row action is fully inside the region's visible box: as drawn, with the table forced to scroll, and scrolled to its end`, async ({ page }, testInfo) => {
        const name = longName(testInfo, screen.nameLength);
        expect(name).toHaveLength(screen.nameLength);
        await screen.make(page, name);
        await page.setViewportSize({ width, height: HEIGHT });
        await page.goto(screen.path);
        await expect(page.getByRole('heading', { level: 1, name: screen.title })).toBeVisible();
        await waitUntilHydrated(page, 'main button[data-action="add"]');

        const region = page.getByRole('region', { name: screen.region });
        await expect(region).toBeVisible();
        await expect(page.locator(`${screen.rowSelector}:visible button[data-action]`).first()).toBeVisible();
        await expect(page.locator(`${screen.rowSelector}:visible`).filter({ hasText: name })).toBeVisible();

        // 1. As drawn (part 3, the fit): the headings and names wrap, so the table needs no scrolling.
        expect(await region.evaluate((element) => element.scrollLeft)).toBe(0);
        await expectActionsInside(page, region, screen, 'as drawn');
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
        if (screen.users) {
          await expectButtonsPerRow(page, screen, 3, 'as drawn');
          await expectOwnRowIntact(page, region, 'as drawn');
          await expectThreeButtonColumn(region, 'as drawn');
        }

        // 2. Forced to scroll (part 2, the guarantee): the table is made wider than the region, at its start. Only the sticky column keeps the
        //    actions inside the region's box.
        const regionWidth = (await region.boundingBox())?.width ?? 0;
        const forcedWidth = Math.max(FORCED_MIN_WIDTH, Math.ceil(regionWidth) + FORCED_EXTRA);
        await region.locator('table').evaluate((table, minWidth) => { table.style.minWidth = `${minWidth}px`; }, forcedWidth);
        expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth), 'the forced table scrolls').toBe(true);
        expect(await region.evaluate((element) => element.scrollLeft)).toBe(0);
        await expectActionsInside(page, region, screen, 'forced to scroll, at its start');
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
        if (screen.users) await expectOwnRowIntact(page, region, 'forced to scroll, at its start');

        // 3. A Tab from the region goes to the first row action, which is not under the sticky column and does not move the page sideways.
        await region.focus();
        await page.keyboard.press('Tab');
        await expect(page.locator(':focus')).toHaveAttribute('data-action', screen.firstAction);
        await expectActionsInside(page, region, screen, 'forced to scroll, after Tab');
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
        if (screen.users) {
          await expectTabThroughFirstRow(page, region, screen, 'forced to scroll, tabbing the first row');
          expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
          if (AXE_WIDTHS.includes(width)) await expectNoAxeViolations(page);
        }

        // 4. Scrolled to its far end.
        await region.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
        expect(await region.evaluate((element) => element.scrollLeft), 'the forced table scrolled').toBeGreaterThan(0);
        await expectActionsInside(page, region, screen, 'forced to scroll, at its end');
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
        if (screen.users) await expectOwnRowIntact(page, region, 'forced to scroll, at its end');
      });
    }
  });
}

test.describe('SCR-14 Users: the card list below 768 px is unchanged (AQP-245 AC-4)', () => {
  test(`at ${CARD_WIDTH} px the cards show text on every button, wrap, and do not scroll the page sideways`, async ({ page }, testInfo) => {
    const screen = SCREENS.find((candidate) => candidate.users === true);
    expect(screen, 'the Users screen is in the list').toBeDefined();
    if (screen === undefined) return;
    const name = longName(testInfo, USER_NAME_LENGTH);
    await screen.make(page, name);
    await page.setViewportSize({ width: CARD_WIDTH, height: HEIGHT });
    await page.goto(screen.path);
    await expect(page.getByRole('heading', { level: 1, name: screen.title })).toBeVisible();
    await waitUntilHydrated(page, 'main button[data-action="add"]');

    await expect(page.getByRole('region', { name: screen.region }), 'the table is hidden').toBeHidden();
    const cards = page.getByRole('list', { name: 'Users' }).locator('li[data-user-id]');
    await expect(cards.filter({ hasText: name })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await cards.count(), 'there are cards').toBeGreaterThanOrEqual(6);

    // Every button of every card is inside the window and says what it does in words; the own card keeps its two disabled buttons.
    const edges = await edgesOf(cards.locator('button[data-action]'));
    edges.forEach((button, index) => {
      expect(button.left, `button ${index} starts inside the window`).toBeGreaterThanOrEqual(0);
      expect(button.right, `button ${index} ends inside the window`).toBeLessThanOrEqual(CARD_WIDTH);
    });
    const ownButtons = cards.filter({ hasText: E2E_ADMIN.email }).locator('button[data-action]');
    await expect(ownButtons).toHaveCount(3);
    await expect(ownButtons.nth(0)).toHaveText('Edit');
    await expect(ownButtons.nth(1)).toHaveText('Reset password');
    await expect(ownButtons.nth(1)).toBeDisabled();
    await expect(ownButtons.nth(2)).toHaveText('Deactivate');
    await expect(ownButtons.nth(2)).toBeDisabled();
    const labelled = await cards.locator('button[data-action]').evaluateAll((buttons) => buttons.filter((button) => (button.textContent ?? '').trim() === '').length);
    expect(labelled, 'no card button is icon-only').toBe(0);
  });
});
