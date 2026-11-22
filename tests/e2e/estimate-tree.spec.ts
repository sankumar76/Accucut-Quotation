import { expect, test, type Locator, type Page, type Request, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { defined } from '../support/defined';

import { connectToTestDatabase, createDisposableUser, E2E_PASSWORD, ensureCanaryCustomers, setCanaryCustomer, signInWithoutThePage, useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';

/**
 * STORY-05.02 T7 (AC-1 to AC-3, AC-6, AC-9): the parts tree of SCR-05 for an Engineer, at 360x800, 768x1024 and 1366x768 on the development server. Each test signs in
 * as a person of its own, who owns a task with an empty draft estimate and one part (the recipe of the confidentiality scan, `tests/support/estimate-recipe.ts`), chooses
 * the customer so the form area opens, and works the tree with the buttons and the keyboard. Below 768 px the tree is the "Parts tree" drawer, so the helper opens it first.
 * The words are the UX spec's and the story's, written out here and not imported, so a changed sentence fails a test. What the database holds (the revision, the
 * delete in one statement, the lock) is judged in `tests/integration/estimates/tree.test.ts`. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const ALPHA_ID = defined(CUSTOMER_CANARIES[0]).id;
const PHONE_MAX = 767;

/** The parts tree is a `nav` of nested lists of links (CR-01 item 3B): a row is its link, and its number is the text marked `data-sl-no`. */
const tree = (page: Page): Locator => page.getByRole('navigation', { name: 'Parts tree' });
const part = (page: Page, slNo: string): Locator => tree(page).getByRole('link').filter({ has: page.locator('[data-sl-no]', { hasText: new RegExp(`^${slNo.replaceAll('.', '\\.')}$`) }) });
const action = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
/**
 * A button of one row (CR-01 item 3C): its name starts with the words and the number of its row ("Add under 1 ", "Add fastener under 1.1.1 ", "Delete 1.1 "). The toolbar shows on hover, on focus and on the open row
 * (on a touch screen on the open row only), so a test chooses the row first, as a person does.
 */
const rowButton = (page: Page, words: string, slNo: string): Locator => tree(page).getByRole('button', { name: new RegExp(`^${words} ${slNo.replaceAll('.', '\\.')} `) });
/** Adds a row of this kind under the row with this Sl. No by its "+": a menu for a Main Assembly or a Sub-Assembly (the code of the menu loads on the first open), the Fastener at once for a Part. */
async function addUnder(page: Page, slNo: string, kind: 'Sub-Assembly' | 'Part' | 'Fastener'): Promise<void> {
  await part(page, slNo).click();
  if (kind === 'Fastener' && (await rowButton(page, 'Add fastener under', slNo).count()) === 1) {
    await rowButton(page, 'Add fastener under', slNo).click();
    return;
  }
  await rowButton(page, 'Add under', slNo).click();
  await page.getByRole('menuitem', { name: kind, exact: true }).click();
}
/** "Add main assembly" at the foot of the tree. */
const addMain = (page: Page): Promise<void> => page.getByRole('button', { name: 'Add main assembly' }).click();
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1_000) <= PHONE_MAX;

/** The Sl. No of every part on screen, in order. */
async function slNumbers(page: Page): Promise<string[]> {
  return tree(page).locator('[data-sl-no]').allTextContents();
}

/**
 * AQP-343 / DEF-040, master's DL-234 D2: a diagnostic and nothing else. A wait for "Part renumbered to ..." has failed on the first attempt only, twice, with no trace kept.
 * When it fails again, `expectRenumbered` prints what the screen and the move request were doing (to stdout, so it lands in the job log, and as an attachment), then re-throws
 * the original error unchanged. The assertion, its 15 s timeout, the retry and every step of the tests are as they were; nothing here waits, retries or clicks.
 *
 * How to read the output (the four triggers of DL-234 (3)):
 *  (i)   the tree shows the new numbers, the move request is `200`, and the live region is empty: the announcement was not made.
 *  (ii)  `move requests (0)`, the part focused and selected, no danger Notice: the key press or the click was dropped (or `change()` returned at `busy`).
 *  (iii) a request with a status of 4xx or 5xx, a failure text or `no answer`, and no danger Notice; or later moves with no request while the first has no answer: `busy` stuck.
 *  A `200` that came after the 15 s and an announcement that is there by now is the duration tail (#467), not the trigger. `busy` is not in the page: it is read from the requests.
 */
const MOVE_ROUTE = /\/tree\/move$/;
const TOOLBAR_ACTIONS = ['Add main assembly', 'Move up', 'Move down'] as const;
/** What the report waits for the page: it must never hold up the test's own failure for long. */
const REPORT_PATIENCE_MS = 5_000;
const KEPT_PAGE_ERRORS = 20;

interface MoveCall {
  readonly method: string;
  readonly path: string;
  readonly body: string;
  readonly sentAt: number;
  headersAt?: number;
  finishedAt?: number;
  status?: number;
  failure?: string;
}

interface MoveWatch {
  readonly startedAt: number;
  readonly calls: MoveCall[];
  readonly pageErrors: string[];
}

/** Starts listening for the move request (`POST .../tree/move`) and for errors of the page. Call it before the click or key press that moves a part. */
function watchMoves(page: Page): MoveWatch {
  const watch: MoveWatch = { startedAt: Date.now(), calls: [], pageErrors: [] };
  const callOf = new Map<Request, MoveCall>();
  const keep = (line: string): void => {
    if (watch.pageErrors.length < KEPT_PAGE_ERRORS) watch.pageErrors.push(line.slice(0, 300));
  };
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (!MOVE_ROUTE.test(pathname)) return;
    const call: MoveCall = { method: request.method(), path: pathname, body: (request.postData() ?? '').slice(0, 300), sentAt: Date.now() };
    callOf.set(request, call);
    watch.calls.push(call);
  });
  page.on('response', (response) => {
    const call = callOf.get(response.request());
    if (call === undefined) return;
    call.headersAt = Date.now();
    call.status = response.status();
  });
  page.on('requestfinished', (request) => {
    const call = callOf.get(request);
    if (call !== undefined) call.finishedAt = Date.now();
  });
  page.on('requestfailed', (request) => {
    const call = callOf.get(request);
    if (call === undefined) return;
    call.failure = request.failure()?.errorText ?? 'failed (no text)';
    call.finishedAt = Date.now();
  });
  page.on('pageerror', (error) => keep(`pageerror ${error.name}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') keep(`console.error ${message.text()}`);
  });
  return watch;
}

/** The screen as it is, read in one go in the page: the tree in order, every live region, every alert, the toolbar and the focus. */
async function readScreen(page: Page, wanted: string): Promise<string[]> {
  const screen = await page.evaluate(({ actions, words }) => {
    const textOf = (element: Element | null): string => (element?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const items = [...document.querySelectorAll('nav[aria-label="Parts tree"] a[data-part-id]')].map((item) => `${textOf(item.querySelector('[data-sl-no]'))} (${item.getAttribute('aria-current') === 'true' ? 'open' : 'closed'})`);
    const liveRegions = [...document.querySelectorAll('[role="status"], [aria-live]')].map(
      (region) => `${region.classList.contains('sr-only') ? 'sr-only ' : ''}${region.getAttribute('role') ?? 'aria-live'} "${textOf(region)}"`,
    );
    const alerts = [...document.querySelectorAll('[role="alert"]')].map((alert) => textOf(alert)).filter((text) => text !== '');
    const buttons = [...document.querySelectorAll('button')];
    const toolbar = actions.map((name) => {
      const found = buttons.find((button) => textOf(button) === name);
      return found === undefined ? `${name}: not on screen` : `${name}: aria-disabled=${found.getAttribute('aria-disabled') ?? 'no'}, disabled=${String(found.disabled)}`;
    });
    const active = document.activeElement;
    const focus = active === null ? 'none' : `<${active.tagName.toLowerCase()}${active.getAttribute('role') === null ? '' : ` role=${active.getAttribute('role')}`}> "${textOf(active).slice(0, 60)}"`;
    // The elements `getByText` would count: the innermost ones that hold the words (it ignores case).
    const holds = (element: Element): boolean => textOf(element).toLowerCase().includes(words.toLowerCase());
    const matches = [...document.querySelectorAll('body *:not(script):not(style)')].filter((element) => holds(element) && ![...element.children].some(holds)).length;
    return { items, liveRegions, alerts, toolbar, focus, matches };
  }, { actions: TOOLBAR_ACTIONS, words: wanted });
  return [
    `  elements with the announcement's words: ${String(screen.matches)} (the wait needs exactly 1)`,
    `  tree as rendered (${screen.items.length}): ${screen.items.join(' | ') || 'none'}`,
    `  live regions: ${screen.liveRegions.join(' | ') || 'none'}`,
    `  danger notices (role=alert): ${screen.alerts.length === 0 ? 'none visible' : screen.alerts.map((alert) => `"${alert}"`).join(' | ')}`,
    `  move controls: ${screen.toolbar.filter((line) => line.startsWith('Move')).join(' ; ')}`,
    `  other actions: ${screen.toolbar.filter((line) => !line.startsWith('Move')).join(' ; ')}`,
    `  focus: ${screen.focus}`,
  ];
}

function describeCalls(watch: MoveWatch, now: number): string[] {
  if (watch.calls.length === 0) return ['  move requests (0): no request sent'];
  const lines = watch.calls.map((call, index) => {
    const sent = `+${String(call.sentAt - watch.startedAt)} ms`;
    let outcome: string;
    if (call.failure !== undefined) outcome = `failed "${call.failure}" after ${String((call.finishedAt ?? now) - call.sentAt)} ms`;
    else if (call.status === undefined) outcome = `no answer after ${String(now - call.sentAt)} ms`;
    else {
      const body = call.finishedAt === undefined ? `body not finished after ${String(now - call.sentAt)} ms` : `body finished after ${String(call.finishedAt - call.sentAt)} ms`;
      outcome = `status ${String(call.status)} after ${String((call.headersAt ?? now) - call.sentAt)} ms, ${body}`;
    }
    return `  move request #${String(index + 1)}: ${call.method} ${call.path} sent ${sent}: ${outcome}; body ${call.body || '(none)'}`;
  });
  return [`  move requests (${String(watch.calls.length)}):`, ...lines.map((line) => `  ${line}`)];
}

/** The answer of `work`, or `fallback` when it takes longer than `ms` (the page may be stuck; its late answer or error is dropped). */
async function within<T>(ms: number, work: Promise<T>, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([work, late]);
  } finally {
    clearTimeout(timer);
  }
}

/** Prints and attaches the state. It never throws: a failed report must not replace the failure of the test. */
async function reportMoveState(page: Page, testInfo: TestInfo, watch: MoveWatch, wanted: string): Promise<void> {
  const now = Date.now();
  const header = `[AQP-343 renumber diagnostic] ${testInfo.project.name} | ${testInfo.title} | attempt ${String(testInfo.retry + 1)} | toHaveCount(1) failed for "${wanted}" | watch ran ${String(now - watch.startedAt)} ms`;
  let screen: string[];
  try {
    if (page.isClosed()) screen = ['  screen: the page is closed'];
    else {
      screen = await within(REPORT_PATIENCE_MS, readScreen(page, wanted), [`  screen: no answer from the page after ${String(REPORT_PATIENCE_MS)} ms`]);
    }
  } catch (error) {
    screen = [`  screen: not readable (${error instanceof Error ? error.message.split('\n')[0] : 'unknown'})`];
  }
  const errors = watch.pageErrors.length === 0 ? ['  page errors: none'] : ['  page errors:', ...watch.pageErrors.map((line) => `    ${line}`)];
  const report = [header, ...screen, ...describeCalls(watch, now), ...errors].join('\n');
  process.stdout.write(`${report}\n`);
  try {
    await testInfo.attach('renumber-diagnostic', { body: report, contentType: 'text/plain' });
  } catch {
    // The report is in the log already.
  }
}

/** The wait the tests always had (`getByText(...)` once, within the 15 s of `expect`), with the diagnostic on its failure. The error that the wait throws is re-thrown as it is. */
async function expectRenumbered(page: Page, testInfo: TestInfo, watch: MoveWatch, announcement: string): Promise<void> {
  try {
    await expect(page.getByText(announcement)).toHaveCount(1);
  } catch (error) {
    await reportMoveState(page, testInfo, watch, announcement);
    throw error;
  }
}

async function signInAsNewEngineer(page: Page, testInfo: TestInfo): Promise<{ readonly id: string }> {
  await page.context().clearCookies();
  const person = await createDisposableUser('scan', testInfo);
  await signInWithoutThePage(page, person.email, E2E_PASSWORD);
  return person;
}

/** Signs in as a person who owns a task, chooses the customer, and shows the tree (on a phone, in its drawer). Returns the estimate's ID, which is the person's. */
async function openTree(page: Page, testInfo: TestInfo): Promise<{ readonly estimateId: string }> {
  await ensureCanaryCustomers();
  const owner = await signInAsNewEngineer(page, testInfo);
  await setCanaryCustomer(owner.id, ALPHA_ID);
  await page.goto(`/estimates/${canaryTaskCodeFor(owner.id)}`);
  await waitUntilTheTreeIsLive(page);
  await showTree(page);
  await expect(part(page, '1')).toBeVisible();
  return { estimateId: owner.id };
}

/** The page's scripts are live, so a click or a key is not lost (DEF-011): on a phone the Parts tree button, from 768 px the first part of the tree, each by the handler React put on it. */
async function waitUntilTheTreeIsLive(page: Page): Promise<void> {
  if (isPhone(page)) await waitUntilHydrated(page, 'button[data-early-intent="parts-tree"]', 'onClick');
  else await waitUntilHydrated(page, 'nav[aria-label="Parts tree"] a[data-part-id]', 'onClick');
}

async function showTree(page: Page): Promise<void> {
  if (isPhone(page)) await page.getByRole('button', { name: /^Parts tree/ }).click();
  await expect(tree(page)).toBeVisible();
}

/** Two sub-parts under the person's one part (it has the person's ID, like its estimate), as two rows, the way `tests/support/calculation-database.ts` adds a part: sort index 0 and 1 under it. */
async function insertTwoSubParts(ownerId: string): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    await client.query('INSERT INTO estimate_nodes (estimate_id, parent_id, sort_index, node_kind) VALUES ($1::uuid, $1::uuid, 0, \'PART\'), ($1::uuid, $1::uuid, 1, \'PART\')', [ownerId]);
  } finally {
    await client.end();
  }
}

/**
 * A tree of part 1 with two sub-parts, for the two delete tests (DEF-048, AQP-377). The customer is set in the database, as an assignment sets it (CR-01 item 6: the Engineer has no drop-down), and the two sub-parts
 * are inserted as rows, both before the page is opened, so the page opens on the tree. Done through the drop-down and the Sub-part button they were 6 s of a test that took 17 to 23 s on
 * CI (run 44567048767; the two `POST .../nodes` calls alone took 1.7 to 3.8 s on a busy runner, run 44574122579), and the delete is the subject of these tests, not adding: the buttons
 * are judged by the AC-1, AC-2 and AC-9 tests below, the customer by `estimate-customer.spec.ts`, the add route by the integration tests of the tree. The tree is checked on screen
 * below, as the tests that built it with the buttons did.
 */
async function openTreeWithTwoSubParts(page: Page, testInfo: TestInfo): Promise<void> {
  await ensureCanaryCustomers();
  const owner = await signInAsNewEngineer(page, testInfo);
  await setCanaryCustomer(owner.id, ALPHA_ID);
  await insertTwoSubParts(owner.id);
  await page.goto(`/estimates/${canaryTaskCodeFor(owner.id)}`);
  // Hydrated, so a click is not lost (DEF-011).
  await waitUntilTheTreeIsLive(page);
  await showTree(page);
  await expect(part(page, '1')).toBeVisible();
  await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2']);
}

test.describe('AC-1, AC-2: adding, moving and renumbering', () => {
  test('AC-1, AC-2: the "+" of a row and "Add main assembly" add rows and number them 1, 1.1, 1.2, 2; Move up renumbers and says so', async ({ page }, testInfo) => {
    // The second of two tests that are slow by what they do (AQP-340): four additions and two moves, each a request and a re-read of the tree. Measured: 22.8 s on a mobile shard of a green run
    // (44021154191), and it ran out of its 30 s on the tablet shard in runs 43905784789, 44025795508 and 44045571667. Three times the default, for this test only.
    test.slow();
    await openTree(page, testInfo);
    const moves = watchMoves(page);
    expect(await slNumbers(page)).toEqual(['1']);

    await addUnder(page, '1', 'Sub-Assembly');
    await expect(page.getByText('Part 1.1 added')).toHaveCount(1);
    await addUnder(page, '1', 'Part');
    await expect(page.getByText('Part 1.2 added')).toHaveCount(1);
    await addMain(page);
    await expect(page.getByText('Part 2 added')).toHaveCount(1);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2', '2']);

    // The new part is the selected one; 1.2 up becomes 1.1, and the screen says so.
    await part(page, '1.2').click();
    await action(page, 'Move up').click();
    await expectRenumbered(page, testInfo, moves, 'Part renumbered to 1.1');
    await expect(action(page, 'Move up')).toBeFocused();
    await expect(part(page, '1.1')).toHaveAttribute('aria-current', 'true');
    // At the top of its group it cannot go further: the button says so and keeps focus.
    await expect(action(page, 'Move up')).toHaveAttribute('aria-disabled', 'true');

    // Down again.
    await action(page, 'Move down').click();
    await expectRenumbered(page, testInfo, moves, 'Part renumbered to 1.2');
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2', '2']);

    // The numbers come from the server: they are the same after a reload.
    await page.reload();
    await showTree(page);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2', '2']);
  });

  test('AQP-404 AC-1, AC-4: the tree is a nav of nested lists of links: no tree roles or counts, the open row is aria-current, each kind has its icon with its name, and a legend names the four', async ({ page }, testInfo) => {
    await openTree(page, testInfo);
    await addUnder(page, '1', 'Sub-Assembly');
    // One change at a time: a second press while the first is out is ignored, so wait for the part to appear.
    await expect(part(page, '1.1')).toBeVisible();
    await addMain(page);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '2']);

    // A list of links, not a tree: no role, no level, no place, no count.
    await expect(page.getByRole('tree')).toHaveCount(0);
    await expect(page.getByRole('treeitem')).toHaveCount(0);
    await expect(tree(page).locator('[aria-level], [aria-posinset], [aria-setsize], [aria-selected]')).toHaveCount(0);
    expect(await tree(page).locator('ul ul').count()).toBeGreaterThan(0);

    // The open row is the one that was added last (it is the selected one); it alone carries aria-current.
    await expect(part(page, '2')).toHaveAttribute('aria-current', 'true');
    await expect(part(page, '1')).not.toHaveAttribute('aria-current', 'true');
    await expect(tree(page).locator('[aria-current="true"]')).toHaveCount(1);

    // The kind is told by the icon, whose name is the tooltip and the spoken name; there is no text label for it on a row.
    await expect(tree(page).getByRole('img', { name: 'Main Assembly' })).toHaveCount(2);
    await expect(tree(page).getByRole('img', { name: 'Sub-Assembly' })).toHaveCount(1);
    await expect(part(page, '1.1').getByRole('img', { name: 'Sub-Assembly' })).toHaveCount(1);
    await expect(part(page, '1.1').locator('svg > title')).toHaveText('Sub-Assembly');
    expect(await part(page, '1').innerText()).not.toContain('Main Assembly');
    expect(await part(page, '1.1').innerText()).not.toContain('Sub-Assembly');

    // The legend at the foot names the four icons.
    const legend = page.locator('[data-tree-legend]');
    await expect(legend).toBeVisible();
    for (const words of ['Main Assembly', 'Sub-Assembly', 'Part or Sub-part', 'Fastener']) await expect(legend).toContainText(words);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AQP-404 AC-1, AC-5: an arrow opens and closes its branch, a leaf keeps the space, Tab moves from a row to the next and to each arrow (no arrow-key navigation), and Enter opens the row', async ({ page }, testInfo) => {
    await openTree(page, testInfo);
    await addUnder(page, '1', 'Sub-Assembly');
    await expect(part(page, '1.1')).toBeVisible();
    await addMain(page);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '2']);

    // Only a branch has an arrow button; the leaf rows have the same space and no arrow button.
    const arrows = tree(page).getByRole('button', { name: /^(Close|Open) branch / });
    await expect(arrows).toHaveCount(1);
    const arrow = tree(page).getByRole('button', { name: 'Close branch 1' });
    await expect(arrow).toHaveAttribute('aria-expanded', 'true');
    const leaf = await part(page, '2').boundingBox();
    const branch = await part(page, '1').boundingBox();
    expect(leaf?.x, 'a leaf row starts where a branch row does').toBeCloseTo(branch?.x ?? -1, 0);
    expect((await arrow.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    expect((await arrow.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);

    // Tab goes arrow, row, next row, next row: the order of the page, with no roving stop.
    await arrow.focus();
    await page.keyboard.press('Tab');
    await expect(part(page, '1')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(part(page, '1.1')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(part(page, '2')).toBeFocused();
    // The arrow keys do not move between rows any more (STORY-05.02 AC-9 is withdrawn).
    await page.keyboard.press('ArrowUp');
    await expect(part(page, '2')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(part(page, '2')).toBeFocused();

    // Closing the branch takes its rows away, says so on the arrow, and opening brings them back.
    await arrow.click();
    await expect.poll(() => slNumbers(page)).toEqual(['1', '2']);
    await expect(tree(page).getByRole('button', { name: 'Open branch 1' })).toHaveAttribute('aria-expanded', 'false');
    await tree(page).getByRole('button', { name: 'Open branch 1' }).click();
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '2']);

    // Enter on a row opens it: it becomes the open row and its form takes the focus.
    await part(page, '1.1').focus();
    await page.keyboard.press('Enter');
    // On a phone the drawer closes on Enter, and the form takes the focus.
    if (isPhone(page)) await expect(page.getByRole('dialog', { name: 'Parts tree' })).toHaveCount(0);
    else await expect(part(page, '1.1')).toHaveAttribute('aria-current', 'true');
  });
});

test.describe('AC-3: delete asks first and names the count', () => {
  // DEF-048 (AQP-377): one test of 17 to 23 s on CI (run 44567048767) before; now two, each with the tree made by `openTreeWithTwoSubParts` and none of its checks left out.
  test('AC-3: a part with 2 sub-parts: the dialog names 3 parts and Cancel is the safe choice; Cancel changes nothing', async ({ page }, testInfo) => {
    await openTreeWithTwoSubParts(page, testInfo);

    await part(page, '1').click();
    await rowButton(page, 'Delete', '1').click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete row 1?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('This also deletes the 2 rows under it, and everything typed into them. This cannot be undone.');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Delete 3 rows' })).toBeVisible();
    await expectNoAxeViolations(page);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await slNumbers(page)).toEqual(['1', '1.1', '1.2']);
  });

  test('AC-3: a part with 2 sub-parts: confirming deletes all three', async ({ page }, testInfo) => {
    await openTreeWithTwoSubParts(page, testInfo);

    await part(page, '1').click();
    await rowButton(page, 'Delete', '1').click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete row 1?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete 3 rows' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('3 rows deleted')).toHaveCount(1);
    await expect(page.getByText('No parts yet. Choose "Add main assembly" to add the first one.')).toBeVisible();
    // The foot of an empty tree still offers the one action that can start it again.
    await expect(page.getByRole('button', { name: 'Add main assembly' })).toBeVisible();
    await page.reload();
    // With no part there is no tree element, only the words; on a phone they are in the drawer.
    if (isPhone(page)) await page.getByRole('button', { name: /^Parts tree/ }).click();
    await expect(page.getByText('No parts yet. Choose "Add main assembly" to add the first one.')).toBeVisible();
  });

  test('AC-3: a part with no sub-parts is a plain confirm, and Escape closes the dialog with nothing sent', async ({ page }, testInfo) => {
    await openTree(page, testInfo);
    await addMain(page);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '2']);
    const deletes: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'DELETE') deletes.push(request.url());
    });

    await rowButton(page, 'Delete', '2').click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete row 2?' });
    await expect(dialog).toContainText('Row 2 and everything typed into it will be deleted. This cannot be undone.');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(deletes).toEqual([]);
    expect(await slNumbers(page)).toEqual(['1', '2']);

    await rowButton(page, 'Delete', '2').click();
    await dialog.getByRole('button', { name: 'Delete row' }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => slNumbers(page)).toEqual(['1']);
    expect(deletes).toHaveLength(1);
  });
});

test.describe('AQP-405: the row actions', () => {
  test('AQP-405 AC-1, AC-2, AC-3: the "+" menu offers only the kinds the row allows, a Part gets its Fastener at once, a Fastener has no "+", and the row that was added is open and has the focus', async ({ page }, testInfo) => {
    // Five additions, each a request and a re-read of the tree, as the AC-1, AC-2 test above (AQP-340).
    test.slow();
    await openTree(page, testInfo);
    await part(page, '1').click();

    // Under a Main Assembly: a Sub-Assembly, a Part or a Fastener. Escape closes the menu and gives the focus back to its "+".
    const plus = rowButton(page, 'Add under', '1');
    await expect(plus).toHaveAttribute('aria-haspopup', 'menu');
    await plus.click();
    await expect(page.getByRole('menuitem')).toHaveText(['Sub-Assembly', 'Part', 'Fastener']);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem')).toHaveCount(0);
    await expect(plus).toBeFocused();
    await plus.click();
    await page.getByRole('menuitem', { name: 'Sub-Assembly', exact: true }).click();
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1']);
    // The added row is the open one and takes the focus.
    await expect(part(page, '1.1')).toHaveAttribute('aria-current', 'true');
    await expect(part(page, '1.1')).toBeFocused();

    // Under a Sub-Assembly: a Part or a Fastener, and by the keyboard the first item has the focus.
    await rowButton(page, 'Add under', '1.1').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem')).toHaveText(['Part', 'Fastener']);
    await expect(page.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.1.1']);
    await expect(part(page, '1.1.1')).toBeFocused();

    // Under a Part there is one kind allowed, so it is added at once, with no menu; the "+" says so in its name.
    await part(page, '1.1.1').click();
    const fastener = rowButton(page, 'Add fastener under', '1.1.1');
    await expect(fastener).not.toHaveAttribute('aria-haspopup', 'menu');
    await fastener.click();
    await expect(page.getByRole('menuitem')).toHaveCount(0);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.1.1', '1.1.1.1']);
    await expect(tree(page).getByRole('img', { name: 'Fastener' })).toHaveCount(1);

    // A Fastener holds nothing: no "+", only its "-".
    await part(page, '1.1.1.1').click();
    await expect(tree(page).getByRole('button', { name: /^Add (under|fastener under) 1\.1\.1\.1 / })).toHaveCount(0);
    await expect(rowButton(page, 'Delete', '1.1.1.1')).toHaveCount(1);

    // "Add main assembly" at the foot adds another top-level one, last, and opens it.
    await addMain(page);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.1.1', '1.1.1.1', '2']);
    await expect(part(page, '2')).toHaveAttribute('aria-current', 'true');
    await expect(part(page, '2')).toBeFocused();
    await expectNoAxeViolations(page);
  });

  test('AQP-405 AC-4: the "-" of a row that is not the open one deletes that row after the confirmation, and the open row stays open and is renumbered', async ({ page }, testInfo) => {
    // The toolbar of a row that is not open shows on hover: a pointer is needed, so this is for the desktop width (a touch screen shows it on the open row only).
    test.skip(isPhone(page) || (page.viewportSize()?.width ?? 0) < 1024, 'the toolbar of a row that is not open is shown by a pointer');
    await openTreeWithTwoSubParts(page, testInfo);
    await part(page, '1.2').click();
    await expect(part(page, '1.2')).toHaveAttribute('aria-current', 'true');

    await rowButton(page, 'Delete', '1.1').click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete row 1.1?' });
    await expect(dialog).toContainText('Row 1.1 and everything typed into it will be deleted. This cannot be undone.');
    await dialog.getByRole('button', { name: 'Delete row' }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1']);
    await expect(part(page, '1.1')).toHaveAttribute('aria-current', 'true');
  });
});

test.describe('AC-6: a change made under the person', () => {
  test('AC-6: a move with a stale revision gets the fresh tree and a notice, and the first change stands', async ({ page }, testInfo) => {
    const { estimateId } = await openTree(page, testInfo);
    await addMain(page);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '2']);
    await part(page, '2').click();

    // Someone else moves part 2 to the top, from the same session, while this screen still shows it second.
    const moved = await page.evaluate(async (id) => {
      const read = await fetch(`/api/v1/estimates/${id}/tree`);
      const { nodes } = (await read.json()) as { nodes: { id: string; slNo: string; revision: number }[] };
      const second = nodes.find((node) => node.slNo === '2');
      const answer = await fetch(`/api/v1/estimates/${id}/tree/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: second?.id, revision: second?.revision, parentId: null, index: 0 }),
      });
      return answer.status;
    }, estimateId);
    expect(moved).toBe(200);

    await action(page, 'Move up').click();
    await expect(page.getByText('The parts were changed by someone else. The tree has been refreshed. Check it and try again.')).toBeVisible();
    // The tree is the server's: the part moved first is first, and nothing was moved twice.
    await expect.poll(() => slNumbers(page)).toEqual(['1', '2']);
    await expectNoAxeViolations(page);
  });
});

test.describe('AC-9: the screen', () => {
  test('AC-9: a drawer below 768 px and a panel from it; every action is 44 px high, there is no sideways scroll and axe finds nothing, with the tree open', async ({ page }, testInfo) => {
    await openTree(page, testInfo);
    await addUnder(page, '1', 'Sub-Assembly');
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1']);

    if (isPhone(page)) {
      await expect(page.getByRole('dialog', { name: 'Parts tree' })).toBeVisible();
    } else {
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    for (const name of ['Add main assembly', 'Move up', 'Move down']) {
      expect((await action(page, name).boundingBox())?.height ?? 0, name).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    // The row buttons are 44 px, and 36 px from 1024 px with a fine pointer (UX row 3, NFR-017). The open row (1.1, the one just added) is the one whose toolbar is on screen on a touch screen: the toolbar of another row is not drawn there.
    const rowButtonHeight = (page.viewportSize()?.width ?? 0) >= 1024 ? 36 : TOUCH_TARGET;
    for (const [words, slNo] of [['Add under', '1.1'], ['Delete', '1.1']] as const) {
      expect((await rowButton(page, words, slNo).boundingBox())?.height ?? 0, `${words} ${slNo}`).toBeGreaterThanOrEqual(rowButtonHeight);
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    if (isPhone(page)) {
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Parts tree' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Parts tree, part 1' })).toBeFocused();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    }
    await expectNoAxeViolations(page);
  });
});
