import { randomBytes } from 'node:crypto';

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { E2E_ADMIN } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, DEVELOPMENT_URL } from './support/servers';
import { actionsOf, JSON_HEADERS, makeTreatment, openTreatments } from './support/treatments';

/**
 * DEF-021 (AQP-234) and GitHub #134 (AQP-245): the row actions of a masters table are inside the table's visible box, without scrolling it, at
 * every width from 768 to 1440 px (UX spec v0.20 section 6.0 "Masters tables", SCR-11, SCR-12, SCR-13 and SCR-14). Run for Process master, for Materials,
 * since STORY-02.02 for Customers (Edit only, 68 px), since STORY-02.05 for the Treatment / Color tab (Rename and Delete, 112 px) and, since AQP-245, for Users, each with one row whose name is the
 * longest the table's own form allows with no space (100 characters; 120 for a user), at the eleven widths of the spec's table of regions.
 *
 * Each width is checked three ways: as drawn (the fit), with the table forced wider than the region, at its start and after a Tab, and scrolled to its
 * far end (the sticky guarantee, part 2: without `sticky right-0` the forced cases fail). The test sets its own viewport, so it runs in the desktop
 * project only; the other two projects would repeat the same eleven widths. The last block holds one more test of that kind, for STORY-02.05: the
 * Treatment / Color tab's "(e)" test (a Tab from the last row's Rename lands on its Delete with the table forced wider), moved here from
 * `treatments-focus.spec.ts` unchanged because it sets its own width (test strategy 10.5 item 10).
 *
 * Every screen is also checked for the fit as drawn (`scrollWidth - clientWidth <= 0`, no tolerance: headings and names wrap, ux-spec 6.0 part 3)
 * and, with two or more buttons in a row, for the 8 px gap between them (`gap-s-2`, within 0.5 px; DL-122 condition B).
 *
 * Users (AQP-245) adds what only that screen has: three buttons in every row (AC-1), the Admin's own row with its two disabled ones, in place
 * (AC-3, as drawn), the prop `actionButtons={3}` read from computed styles (AC-2), a Tab through the three enabled buttons of the long-name row,
 * in order, none covered by the sticky column and each with a focus ring (AC-5), axe on the forced table at 768, 1024 and 1366 px (AC-5), and the
 * card list below 768 px, which this change does not touch (AC-4). Filler people are made only to reach six, inside each test (AC-1).
 *
 * AQP-275 (DEF-030) adds the Users notice "<name> can sign in again.": after Activate on a person with a 120-character name the notice stays inside the
 * window and the page does not scroll sideways, at 360 and 768 px (two tests, desktop project only, so two E2E instances in all). The wrapping rule is
 * `Notice` itself (`BREAK_LONG_NAMES`, `src/components/shared/break-long-names.ts`); the notices of the other screens are unit-tested in
 * `tests/unit/notice-wraps-long-names.test.ts`.
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

/** The six people the Users list holds at least (AC-1): the E2E Admin, Lead and Engineer, the long-name person, and fillers up to six. */
const USERS_MINIMUM = 6;
/** The gap between two row actions: `gap-s-2`, 8 px (ux-spec 6.0 Width), within half a pixel. */
const ACTION_GAP = 8;
const DEFAULT_ROW_SELECTOR = '[data-item-id]';
const DEFAULT_FIRST_ACTION = /^(edit|delete)$/;

interface Screen {
  readonly label: string;
  readonly path: string;
  readonly title: string;
  readonly region: string;
  /** The rows (table) or cards (phone) of the screen; the one that is visible at the width under test counts. Default: `[data-item-id]`. */
  readonly rowSelector?: string;
  /** The length of the long name `make` is given: the longest the table's own form accepts. Default: 100. */
  readonly nameLength?: number;
  /** The `data-action` of the button a Tab from the region reaches first. Default: Edit or Delete. */
  readonly firstAction?: RegExp;
  /** The Users screen only: more checks of what it has (three buttons a row, the own row, the Tab through the long-name row, axe). */
  readonly users?: true;
  readonly make: (page: Page, name: string) => Promise<void>;
  /** Brings the table on screen when it is not on the page's first tab. */
  readonly open?: (page: Page) => Promise<void>;
}

const rowSelectorOf = (screen: Screen): string => screen.rowSelector ?? DEFAULT_ROW_SELECTOR;
const nameLengthOf = (screen: Screen): number => screen.nameLength ?? NAME_LENGTH;
const firstActionOf = (screen: Screen): RegExp => screen.firstAction ?? DEFAULT_FIRST_ACTION;

async function post(page: Page, path: string, data: Record<string, string>): Promise<void> {
  const response = await page.request.post(`${DEVELOPMENT_URL}${path}`, { headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' }, data });
  expect(response.status()).toBe(201);
}

/** One person, added the way the Users screen adds one: a name, an e-mail nobody has, a role and a first password. */
function addPerson(page: Page, name: string): Promise<void> {
  return post(page, '/api/v1/users', { name, email: `e2e245.${randomBytes(6).toString('hex')}@example.test`, role: 'ENGINEER', password: USERS_PASSWORD });
}

/** How many people the Users list holds now, as the API the screen reads says it. */
async function countPeople(page: Page): Promise<number> {
  const response = await page.request.get(`${DEVELOPMENT_URL}/api/v1/users`);
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  return typeof body === 'object' && body !== null && 'users' in body && Array.isArray(body.users) ? body.users.length : 0;
}

/** The person with exactly this name, as the API the Users screen reads lists them (the name is unique to the test). */
async function findPerson(page: Page, name: string): Promise<{ readonly id: string }> {
  const response = await page.request.get(`${DEVELOPMENT_URL}/api/v1/users`);
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  const users: ReadonlyArray<unknown> = typeof body === 'object' && body !== null && 'users' in body && Array.isArray(body.users) ? body.users : [];
  for (const user of users) {
    if (typeof user === 'object' && user !== null && 'name' in user && user.name === name && 'id' in user && typeof user.id === 'string') return { id: user.id };
  }
  throw new Error('the person made for the test is not in the Users list');
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
  {
    label: 'SCR-12 Customers',
    path: '/masters/customers',
    title: 'Customers',
    region: 'Customers, scrollable',
    make: (page, name) => post(page, '/api/v1/customers', { name }),
  },
  {
    label: 'SCR-13 Treatment / Color',
    path: '/masters/materials',
    title: 'Materials and lists',
    region: 'Treatment / Color, scrollable',
    // Treatment rows and cards carry `data-item-id` (treatment-list.tsx), like the default; the first button a Tab reaches is the first row's Rename.
    rowSelector: '[data-item-id]',
    nameLength: NAME_LENGTH,
    firstAction: /^rename$/,
    make: (page, name) => post(page, '/api/v1/treatments', { name }),
    open: async (page) => {
      await page.getByRole('tab', { name: 'Treatment / Color' }).click();
      await expect(page.getByRole('button', { name: 'Add treatment' })).toBeVisible();
    },
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
    // The long name, then fillers only while the list holds fewer than six: each person costs one argon2id hash (QLT-04).
    make: async (page, name) => {
      await addPerson(page, name);
      const missing = USERS_MINIMUM - (await countPeople(page));
      for (let index = 0; index < missing; index += 1) await addPerson(page, `E2E 245 filler ${randomBytes(3).toString('hex')}`);
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
  const actions = await edgesOf(page.locator(`${rowSelectorOf(screen)}:visible button[data-action]`));
  expect(actions.length, `${mode}: there are row actions`).toBeGreaterThan(0);
  actions.forEach((button, index) => {
    expect(button.left, `${mode}: action ${index} starts inside the region`).toBeGreaterThanOrEqual(left);
    expect(button.right, `${mode}: action ${index} ends inside the region`).toBeLessThanOrEqual(right);
  });
}

/** Every visible row holds the same number of row actions (Users: three, the Admin's own row too, with two of them disabled). */
async function expectButtonsPerRow(page: Page, screen: Screen, expected: number, mode: string): Promise<void> {
  const counts = await page.locator(`${rowSelectorOf(screen)}:visible`).evaluateAll((rows) => rows.map((row) => row.querySelectorAll('button[data-action]').length));
  expect(counts.length, `${mode}: there are rows`).toBeGreaterThanOrEqual(6);
  expect(counts.filter((count) => count !== expected), `${mode}: every row has ${expected} buttons`).toEqual([]);
}

/** Three 36 px buttons, two 8 px gaps and 16 px of padding on each side (UX spec 6.0 "Masters tables", Width: 156 px for three buttons). */
const THREE_BUTTON_COLUMN_WIDTH = 156;

/**
 * The table was given `actionButtons={3}` (AQP-245 AC-2). The sticky class of the Actions cells alone keeps the buttons inside the region, so
 * the positions above cannot tell a table that has the prop from one that has lost it. What the prop sets can: the scroll padding that keeps a
 * focused button clear of the Actions column, and wrapping headings. The plant of AQP-245 (the prop removed) fails at the scroll padding. The
 * 156 px width is the spec's number for three buttons, but three buttons make it with or without the prop, so it does not prove the prop.
 */
async function expectThreeButtonColumn(region: Locator, mode: string): Promise<void> {
  const actionsHeading = region.locator('thead th').last();
  const width = await actionsHeading.evaluate((heading) => heading.getBoundingClientRect().width);
  expect(width, `${mode}: the Actions column is ${THREE_BUTTON_COLUMN_WIDTH} px wide (the spec's number; it does not by itself prove the prop)`).toBeCloseTo(THREE_BUTTON_COLUMN_WIDTH, 0);
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

/** Between two neighbouring row actions of `row` there are 8 px (`gap-s-2`, within 0.5 px); a row with one button has no gap to read. */
async function expectActionGaps(row: Locator, mode: string): Promise<void> {
  const edges = await edgesOf(row.locator('button[data-action]'));
  edges.forEach((button, index) => {
    if (index === 0) return;
    expect(button.left - (edges[index - 1]?.right ?? 0), `${mode}: the gap before action ${index} is ${ACTION_GAP} px (gap-s-2)`).toBeCloseTo(ACTION_GAP, 0);
  });
}

/** The three actions of a Users row, in the order a keyboard reaches them; the long-name person is active, so the last one is Deactivate. */
const USERS_TAB_ORDER = ['edit', 'reset', 'deactivate'] as const;

/**
 * Tab through the long-name row (AC-5), whose three buttons are all enabled (the first row is the Admin's own, with two disabled): the
 * buttons are reached in order, each shows a focus ring (`:focus-visible`, which a keyboard focus always matches), is inside the region, and is
 * the element painted at its own centre, so the sticky Actions column does not cover it. A button that Tab skips (`tabIndex={-1}`) fails here.
 */
async function expectTabThroughRow(page: Page, region: Locator, screen: Screen, row: Locator, mode: string): Promise<void> {
  const buttons = row.locator('button[data-action]');
  await expect(buttons, `${mode}: three buttons in the long-name row`).toHaveCount(USERS_TAB_ORDER.length);
  await expect(row.locator('button[data-action]:not([disabled])'), `${mode}: all three are enabled`).toHaveCount(USERS_TAB_ORDER.length);
  await row.scrollIntoViewIfNeeded();
  // Enter the row by keyboard: from its Edit button back one stop, then forward again.
  await buttons.first().focus();
  await page.keyboard.press('Shift+Tab');
  for (const [index, action] of USERS_TAB_ORDER.entries()) {
    await page.keyboard.press('Tab');
    const focused = buttons.nth(index);
    await expect(focused, `${mode}: Tab ${index + 1} reaches ${action}`).toBeFocused();
    await expect(focused, `${mode}: Tab ${index + 1} is ${action}`).toHaveAttribute('data-action', action);
    await expect(page.locator('button[data-action]:focus-visible'), `${mode}: Tab ${index + 1} shows a focus ring`).toHaveCount(1);
    const covered = await focused.evaluate((button) => {
      const box = button.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return top === null || !button.contains(top);
    });
    expect(covered, `${mode}: Tab ${index + 1}: the focused ${action} button is not covered`).toBe(false);
    await expectActionsInside(page, region, screen, `${mode}, Tab ${index + 1}`);
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
      // The Users titles name the acceptance criteria of AQP-245 they check; the two masters titles are unchanged.
      const criteria = screen.users ? 'AC-1, AC-2, AC-3, AC-5: ' : '';
      test(`${criteria}at ${width} px every row action is fully inside the region's visible box: as drawn, with the table forced to scroll, and scrolled to its end`, async ({ page }, testInfo) => {
        const length = nameLengthOf(screen);
        const name = longName(testInfo, length);
        expect(name).toHaveLength(length);
        await screen.make(page, name);
        await page.setViewportSize({ width, height: HEIGHT });
        await page.goto(screen.path);
        await expect(page.getByRole('heading', { level: 1, name: screen.title })).toBeVisible();
        await waitUntilHydrated(page, 'main button[data-action="add"]');
        await screen.open?.(page);

        const region = page.getByRole('region', { name: screen.region });
        await expect(region).toBeVisible();
        const row =page.locator(`${rowSelectorOf(screen)}:visible`).filter({ hasText: name });
        await expect(page.locator(`${rowSelectorOf(screen)}:visible button[data-action]`).first()).toBeVisible();
        await expect(row).toBeVisible();

        // 1. As drawn (part 3, the fit): the headings and names wrap, so the table needs no scrolling. `scrollWidth - clientWidth` is the proof:
        //    a table that overflows its region has more width than it shows, and the sticky Actions column hides that from every position check.
        expect(await region.evaluate((element) => element.scrollLeft)).toBe(0);
        expect(await region.evaluate((element) => element.scrollWidth - element.clientWidth), 'as drawn: the table needs no scrolling (the fit)').toBeLessThanOrEqual(0);
        await expectActionsInside(page, region, screen, 'as drawn');
        await expectActionGaps(row, 'as drawn');
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

        // 3. A Tab from the region goes to the first row action, which is not under the sticky column and does not move the page sideways.
        await region.focus();
        await page.keyboard.press('Tab');
        await expect(page.locator(':focus')).toHaveAttribute('data-action', firstActionOf(screen));
        await expectActionsInside(page, region, screen, 'forced to scroll, after Tab');
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
        if (screen.users) {
          await expectTabThroughRow(page, region, screen, row, 'forced to scroll, tabbing the long-name row');
          expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
          if (AXE_WIDTHS.includes(width)) await expectNoAxeViolations(page);
        }

        // 4. Scrolled to its far end.
        await region.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
        expect(await region.evaluate((element) => element.scrollLeft), 'the forced table scrolled').toBeGreaterThan(0);
        await expectActionsInside(page, region, screen, 'forced to scroll, at its end');
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      });
    }
  });
}

test.describe('SCR-14 Users: the card list below 768 px is unchanged (AQP-245 AC-4)', () => {
  test(`AC-4: at ${CARD_WIDTH} px the cards show text on every button, wrap, and do not scroll the page sideways`, async ({ page }, testInfo) => {
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

/** The widths of DEF-030's measurements that a phone and a tablet have: the notice must not push the page sideways at either. */
const NOTICE_WIDTHS = [360, 768] as const;

test.describe('SCR-14 Users: the "can sign in again" notice wraps a long name (AQP-275, DEF-030)', () => {
  for (const width of NOTICE_WIDTHS) {
    test(`after Activate, the notice holds a ${USER_NAME_LENGTH}-character name inside the window and the page does not scroll sideways at ${width} px`, async ({ page }, testInfo) => {
      const name = longName(testInfo, USER_NAME_LENGTH);
      await addPerson(page, name);
      const person = await findPerson(page, name);
      const deactivated = await page.request.patch(`${DEVELOPMENT_URL}/api/v1/users/${person.id}`, {
        headers: JSON_HEADERS,
        data: { isActive: false },
      });
      expect(deactivated.status()).toBe(200);

      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto('/users');
      await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
      await waitUntilHydrated(page, 'main button[data-action="add"]');
      expect(await horizontalOverflow(page), 'before Activate the page does not scroll sideways').toBeLessThanOrEqual(0);

      await page.locator('[data-user-id]:visible').filter({ hasText: name }).getByRole('button', { name: `Activate ${name}` }).click();
      const notice = page.getByRole('status').filter({ hasText: `${name} can sign in again.` });
      await expect(notice).toBeVisible();
      const box = await notice.boundingBox();
      expect(box?.x ?? -1, 'the notice starts inside the window').toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? Number.POSITIVE_INFINITY), 'the notice ends inside the window').toBeLessThanOrEqual(width);
      expect(await horizontalOverflow(page), 'after the notice the page does not scroll sideways').toBeLessThanOrEqual(0);
    });
  }
});

test.describe('SCR-13 Treatment / Color: the Actions column (ux-spec section 6.0, DL-122 condition B)', () => {
  test('(e) with the table forced wider than its region, a Tab from the last row\'s Rename lands on its Delete, which is not under the sticky column, and the page did not move sideways', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the test sets its own width, so one project runs it');
    const name = `E2E-last-${testInfo.retry}-${testInfo.repeatEachIndex}-${randomBytes(3).toString('hex')}-`.padEnd(100, 'W');
    await page.setViewportSize({ width: 1024, height: 900 });
    await makeTreatment(page, name);
    await openTreatments(page);
    const region = page.getByRole('region', { name: 'Treatment / Color, scrollable' });
    await region.locator('table').evaluate((table) => {
      table.style.minWidth = '1400px';
    });
    expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth), 'the forced table scrolls').toBe(true);
    const { rename, del } = actionsOf(page, name);
    // The row of the long name is the last row only if no other test added one since; the Tab goes from this row's Rename to its Delete either way.
    await rename.focus();
    await page.keyboard.press('Tab');
    await expect(del).toBeFocused();
    const box = await del.boundingBox();
    const regionBox = await region.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((regionBox?.x ?? 0) + (regionBox?.width ?? 0));
    expect(box?.x ?? 0).toBeGreaterThanOrEqual(regionBox?.x ?? 0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
