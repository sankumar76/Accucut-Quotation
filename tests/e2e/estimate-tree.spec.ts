import { expect, test, type Locator, type Page, type Request, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { defined } from '../support/defined';

import { connectToTestDatabase, createDisposableUser, E2E_PASSWORD, ensureCanaryCustomers, setCanaryCustomer, signInWithoutThePage, useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, ROW_TARGET, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { revealRowToolbar } from './support/part-form';

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
/** Chooses a row by a press at the centre of its name, where Playwright presses by default: nothing floats over a row (AQP-418, DEF-075), so that press is always the row. */
const choose = (page: Page, slNo: string): Promise<void> => part(page, slNo).click();
const action = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
/**
 * A button of one row (CR-01 item 3C): its name starts with the words and the number of its row ("Add under 1 ", "Add fastener under 1.1.1 ", "Delete 1.1 "). The toolbar is in view on the hovered row (a mouse),
 * on the open row (a finger) and on a row that holds the keyboard focus (AQP-418, AQP-448: under the name), so a test chooses the row first, as a person does (the pointer then rests on it), or reaches the button by the keyboard.
 */
const rowButton = (page: Page, words: string, slNo: string): Locator => tree(page).getByRole('button', { name: new RegExp(`^${words} ${slNo.replaceAll('.', '\\.')} `) });
/**
 * The move handle of one row (CR-01 item 3D): its name is "Move" and the number and name of its row. A click on it, Enter or Space opens Move up / Move down; a press and a drag move the row among the rows with the same
 * parent. Like the other row buttons it is in view on the hovered row (a mouse), the open row (a finger) and a row that holds the keyboard focus, so a test chooses the row first.
 */
const handleOf = (page: Page, slNo: string): Locator => rowButton(page, 'Move', slNo);
/** Move up or Move down of a row, from the menu of its handle, by the pointer. */
async function moveFromMenu(page: Page, slNo: string, item: 'Move up' | 'Move down'): Promise<void> {
  await choose(page, slNo);
  await handleOf(page, slNo).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}
/** Adds a row of this kind under the row with this Sl. No by its "+": a menu for a Main Assembly or a Sub-Assembly (the code of the menu loads on the first open), the Fastener at once for a Part. */
async function addUnder(page: Page, slNo: string, kind: 'Sub-Assembly' | 'Part' | 'Fastener'): Promise<void> {
  await choose(page, slNo);
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

/** What a press at the centre of a row's name reaches (AQP-418, DEF-075 acceptance check 1): the link itself or something in it, or the tag of whatever lies over it. */
const reachedByCentrePress = async (page: Page, slNo: string): Promise<string> => {
  // On screen first, as a press scrolls the row into view: with the toolbars clipped the tree is shorter, and a row at the foot lies under the fixed bar until it is scrolled.
  await part(page, slNo).scrollIntoViewIfNeeded();
  return part(page, slNo).evaluate((link) => {
    const { left, top, width, height } = link.getBoundingClientRect();
    const reached = document.elementFromPoint(left + width / 2, top + height / 2);
    return reached !== null && link.contains(reached) ? 'the row' : (reached?.outerHTML.slice(0, 80) ?? 'nothing');
  });
};

interface ToolbarBox {
  readonly slNo: string;
  readonly open: boolean;
  readonly width: number;
  readonly height: number;
  /** The toolbar's box and the row's link overlap by more than half a pixel in both directions. */
  readonly overlapsLink: boolean;
  /** The topmost element at the centre of the toolbar's box is inside the toolbar: it would take a press. */
  readonly takesPress: boolean;
}

/** The toolbar group of every row on screen, measured in the page (AQP-418 acceptance check 2). */
const toolbarBoxes = (page: Page): Promise<ToolbarBox[]> =>
  // By CSS, not by role: a modal dialog (the delete confirmation) hides the tree from the accessibility tree while it is open, and the toolbar is judged then too.
  page.locator('nav[aria-label="Parts tree"]').evaluate((nav) =>
    [...nav.querySelectorAll('li[data-part-row]')].map((item) => {
      const link = item.querySelector('a[data-part-id]');
      const group = item.querySelector('[data-row-actions]');
      if (link === null || group === null) throw new Error('a row has no link or no toolbar group');
      const box = group.getBoundingClientRect();
      const text = link.getBoundingClientRect();
      const overlap = (low: number, high: number, otherLow: number, otherHigh: number): boolean => Math.min(high, otherHigh) - Math.max(low, otherLow) > 0.5;
      const reached = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return {
        slNo: link.querySelector('[data-sl-no]')?.textContent ?? '',
        open: link.getAttribute('aria-current') === 'true',
        width: box.width,
        height: box.height,
        overlapsLink: overlap(box.left, box.right, text.left, text.right) && overlap(box.top, box.bottom, text.top, text.bottom),
        takesPress: reached !== null && group.contains(reached),
      };
    }),
  );

/** The top of a row's link, in the page's own pixels. */
const topOf = (link: Locator): Promise<number> => link.evaluate((element) => element.getBoundingClientRect().top);

/**
 * Puts the pointer on a row and waits until its toolbar is in view (AQP-448): a mouse shows the toolbar of the hovered row only, and Playwright presses a button only where it can already be hit, so a test whose pointer
 * is elsewhere (after an add, a drag or a dialog) reveals the toolbar of its row first. On a touch screen the row must be the open one, and the hover changes nothing.
 */
async function reveal(page: Page, slNo: string): Promise<void> {
  // The row is scrolled to the middle of the screen first (AQP-486, DEF-129): a scroll that Playwright does for the press takes the pointer off the row and the toolbar goes with it.
  await revealRowToolbar(part(page, slNo));
  await expect.poll(() => toolbarHeightOf(page, slNo), `the toolbar of ${slNo} is in view`).toBeGreaterThan(1);
}

/** What holds a toolbar in view, read in one go for a failure message (AQP-448): the held toolbars, the focus ring, the hovered rows and the height of every toolbar. */
const pressState = (page: Page): Promise<unknown> =>
  page.evaluate(() => ({
    held: document.querySelectorAll('[data-hold]').length,
    focus: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName ?? null,
    focusVisible: document.querySelector(':focus-visible')?.getAttribute('aria-label') ?? null,
    hovered: [...document.querySelectorAll('li[data-part-row]')].filter((item) => item.firstElementChild?.matches(':hover')).map((item) => item.querySelector('[data-sl-no]')?.textContent ?? ''),
    heights: [...document.querySelectorAll('[data-row-actions]')].map((group) => Math.round(group.getBoundingClientRect().height)),
  }));

/** Runs an assertion and, if it fails, adds `pressState` and the pointer events seen (`watchPointer`) to the message, so a failure on a machine nobody can reach says what the page was doing. */
async function withState(page: Page, work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (error) {
    const seen = await page.evaluate(() => (window as unknown as { __aqp448?: string[] }).__aqp448 ?? []);
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nstate: ${JSON.stringify(await pressState(page))}\npointer events: ${seen.join(' | ')}`);
  }
}

/** Starts a log of the pointer events of the page, read by `withState`. */
const watchPointer = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { __aqp448?: string[] }).__aqp448 = log;
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture']) {
      document.addEventListener(type, (event) => log.push(`${type}:${event.target instanceof Element ? (event.target.getAttribute('aria-label') ?? event.target.tagName) : '?'}`), true);
    }
  });

/** The pointer of this page, as the style sheet reads it (`mouse:` and `touch:`, globals.css): a mouse hovers and points finely, a finger is every other pointer. The desktop project has a mouse; the phone and tablet projects are `hasTouch`. */
const hasMouse = (page: Page): Promise<boolean> => page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);

/** The Sl. No of every row whose toolbar is in view (taller than the 1 px of the `sr-only` clip), in order. */
async function rowsWithToolbar(page: Page): Promise<string[]> {
  return (await toolbarBoxes(page)).filter((box) => box.height > 1).map((box) => box.slNo);
}

/** The Sl. No of every row that holds the focus ring (the focus is visible inside the row), in order. The row is the first block of its list item, the toolbar included, as the style sheet's `group/row` is. */
const rowsWithFocusRing = (page: Page): Promise<string[]> =>
  tree(page).evaluate((nav) =>
    [...nav.querySelectorAll('li[data-part-row]')]
      .filter((item) => item.firstElementChild?.querySelector(':focus-visible') != null)
      .map((item) => item.querySelector('[data-sl-no]')?.textContent ?? ''),
  );

/** The pointer rests at the right edge of the page, at mid height: outside the tree at every width (the top left corner is the tree itself once the page is scrolled). */
const awayPoint = (page: Page): { readonly x: number; readonly y: number } => {
  const { width, height } = defined(page.viewportSize());
  return { x: width - 2, y: Math.round(height / 2) };
};
const pointerAway = (page: Page, steps = 1): Promise<void> => page.mouse.move(awayPoint(page).x, awayPoint(page).y, { steps });

/** The rows that must show a toolbar: the rows the test names, and on a touch screen also the open row. A test names the rows a mouse puts there (the hovered row, the row with the focus ring, a row with a menu or its delete confirmation open). */
async function expectToolbarsOn(page: Page, mouse: boolean, ...rows: string[]): Promise<void> {
  const open = mouse ? [] : (await toolbarBoxes(page)).filter((box) => box.open).map((box) => box.slNo);
  const wanted = [...new Set([...rows, ...open])].sort();
  await expect.poll(async () => (await rowsWithToolbar(page)).sort(), `the toolbars in view are those of ${wanted.join(', ') || 'no row'}`).toEqual(wanted);
}

/** The height of the toolbar group of one row: more than 1 px when it is in view, 1 px or less when it is the `sr-only` clip. */
async function toolbarHeightOf(page: Page, slNo: string): Promise<number> {
  const row = (await toolbarBoxes(page)).find((box) => box.slNo === slNo);
  return defined(row).height;
}

/**
 * The box of an element once it has stopped moving: Radix scales a menu in when it opens, and the rows slide when a toolbar line comes or goes, so a box read at once is not the one a press meets. The wait is on the
 * state (two reads in a row are the same), not on a time.
 */
async function settledBox(target: Locator): Promise<NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>> {
  let last = '';
  await expect
    .poll(async () => {
      const now = JSON.stringify(await target.boundingBox());
      const same = now === last;
      last = now;
      return same && now !== 'null';
    }, 'the element has stopped moving')
    .toBe(true);
  return defined(await target.boundingBox());
}

/**
 * Where a press can reach the name of a row while a menu of the row above it is open. The menu lies over the rows below its handle and is wider than a name at 1366 px, so a press at the centre of the name would be a
 * press on a menu item; the strip of the name above the menu is the part of it that is still the row. The y of that strip, in the page's pixels.
 */
async function yAboveMenu(page: Page, slNo: string): Promise<number> {
  const menu = await settledBox(page.getByRole('menu'));
  const link = defined(await part(page, slNo).boundingBox());
  // A menu that opens upwards, or lies below the name, leaves the whole name free: its middle is the place. Only a menu that covers part of the name needs the strip.
  if (menu.y >= link.y + link.height || menu.y + menu.height <= link.y) return link.y + link.height / 2;
  expect(menu.y - link.y, 'a strip of the name of ' + slNo + ' lies above the open menu').toBeGreaterThanOrEqual(4);
  return link.y + (menu.y - link.y) / 2;
}

/**
 * AQP-419 (DEF-076), rule P of the design (comment 13032): a press with the mouse on a row's name, whose row is where it was at the pointer-down and at the pointer-up. A press that moves the focus used to take the focus
 * ring off another row, that row's toolbar went back to the clip, and the pressed row moved up under the pointer, so the pointer-up was over something else and the click was lost. The hold is `holdMs` long (0 for a fast click);
 * The press is at the centre of the name, or at `y` when the name is partly under an open menu (see `yAboveMenu`).
 */
async function pressWithoutShift(page: Page, slNo: string, holdMs: number, y?: number): Promise<void> {
  const link = part(page, slNo);
  const box = defined(await link.boundingBox());
  await page.mouse.move(box.x + box.width / 2, y ?? box.y + box.height / 2);
  await page.mouse.down();
  const atDown = await topOf(link);
  if (holdMs > 0) await page.evaluate((ms) => new Promise((resolve) => setTimeout(resolve, ms)), holdMs);
  const atUp = await topOf(link);
  await page.mouse.up();
  expect(atDown, `row ${slNo} does not move at the pointer-down`).toBe(box.y);
  expect(atUp, `row ${slNo} does not move before the pointer-up`).toBe(box.y);
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
/** CR-01 item 3D: Move up and Move down are the items of each row's move handle now, so the diagnostic reads the handles (named "Move 1.2 ...") as the move controls. */
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
    const handles = buttons.filter((button) => (button.getAttribute('aria-label') ?? '').startsWith('Move ')).map((button) => `${button.getAttribute('aria-label') ?? ''}: aria-disabled=${button.getAttribute('aria-disabled') ?? 'no'}, disabled=${String(button.disabled)}`);
    toolbar.push(...handles);
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
  test('AC-1, AC-2: the "+" of a row and "Add main assembly" add rows and number them 1, 1.1, 1.2, 2; Move up and Move down of the handle renumber and say so', async ({ page }, testInfo) => {
    // The second of two tests that are slow by what they do (AQP-340): four additions and two moves, each a request and a re-read of the tree. Measured: 22.8 s on a mobile shard of a green run
    // (44021154191), and it ran out of its 30 s on the tablet shard in runs 43905784789, 44025795508 and 44045571667. Three times the default, for this test only.
    test.slow();
    await openTree(page, testInfo);
    const moves = watchMoves(page);
    expect(await slNumbers(page)).toEqual(['1']);

    await addUnder(page, '1', 'Sub-Assembly');
    await expect(page.getByText('Added 1.1 Sub-Assembly. Type a Description to name it.')).toHaveCount(1);
    await addUnder(page, '1', 'Part');
    await expect(page.getByText('Added 1.2 Part. Type a Description to name it.')).toHaveCount(1);
    // AQP-448 TB-4: the row just added is last under its parent and open; with the pointer away from the tree no toolbar is in view anywhere (a finger: the open row's only).
    await expect(part(page, '1.2')).toHaveAttribute('aria-current', 'true');
    await pointerAway(page);
    await expectToolbarsOn(page, await hasMouse(page));
    await addMain(page);
    await expect(page.getByText('Added 2 Main Assembly. Type a Description to name it.')).toHaveCount(1);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2', '2']);

    // The new part is the selected one; 1.2 up becomes 1.1, and the screen says so.
    await moveFromMenu(page, '1.2', 'Move up');
    await expectRenumbered(page, testInfo, moves, 'Part renumbered to 1.1');
    // The moved row's handle has the focus, in its new place, and the row is still the open one.
    await expect(handleOf(page, '1.1')).toBeFocused();
    await expect(part(page, '1.1')).toHaveAttribute('aria-current', 'true');
    // At the top of its group it cannot go further: Move up is disabled in the menu, and the menu still opens.
    await reveal(page, '1.1');
    await handleOf(page, '1.1').click();
    await expect(page.getByRole('menuitem', { name: 'Move up', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    await expect(handleOf(page, '1.1')).toBeFocused();

    // Down again.
    await moveFromMenu(page, '1.1', 'Move down');
    await expectRenumbered(page, testInfo, moves, 'Part renumbered to 1.2');
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2', '2']);

    // The numbers come from the server: they are the same after a reload.
    await page.reload();
    await showTree(page);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2', '2']);

    // AQP-448 TB-5: an add by the keyboard (the "+" of row 1, Enter on the first item) opens the new row, and a toolbar is in view exactly on the rows that hold the focus ring, wherever the add's own rule puts the
    // focus (on a finger also the open row).
    await pointerAway(page);
    await part(page, '1').focus();
    await page.keyboard.press('Tab');
    await expect(handleOf(page, '1')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(rowButton(page, 'Add under', '1')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Sub-Assembly', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2', '1.3', '2']);
    await expect(part(page, '1.3')).toHaveAttribute('aria-current', 'true');
    const mouse = await hasMouse(page);
    await expect
      .poll(async () => {
        const wanted = [...new Set([...(await rowsWithFocusRing(page)), ...(mouse ? [] : ['1.3'])])].sort();
        const inView = (await rowsWithToolbar(page)).sort();
        return JSON.stringify(inView) === JSON.stringify(wanted) ? 'the rows with the focus ring' : JSON.stringify({ inView, wanted });
      }, 'the toolbars in view are the rows with the focus ring')
      .toBe('the rows with the focus ring');
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
    // A row with no Description and no Part No. shows its kind's own name as its name (AQP-446, DEF-089), once: the icon's name is a tooltip and a spoken name, not a second text.
    expect((await part(page, '1').innerText()).split('Main Assembly')).toHaveLength(2);
    expect((await part(page, '1.1').innerText()).split('Sub-Assembly')).toHaveLength(2);

    // The legend at the foot names the four icons.
    const legend = page.locator('[data-tree-legend]');
    await expect(legend).toBeVisible();
    for (const words of ['Main Assembly', 'Sub-Assembly', 'Part or Sub-part', 'Fastener']) await expect(legend).toContainText(words);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AQP-404 AC-1, AC-5: an arrow opens and closes its branch, a leaf keeps the space, Tab moves from a row to its "+" and "-", then to the next row, and to each arrow (no arrow-key navigation), and Enter opens the row', async ({ page }, testInfo) => {
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
    // A mouse at 1024 px and wider gets the 24 x 36 arrow (WCAG 2.5.8); a finger and anything narrower keep 44 px (NFR-017; DEF-081 ruling 12).
    const wideMouse = (page.viewportSize()?.width ?? 0) >= 1024;
    expect((await arrow.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(wideMouse ? ROW_TARGET : TOUCH_TARGET);
    expect((await arrow.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(wideMouse ? 24 : TOUCH_TARGET);

    // Tab goes arrow, row, the row's own move handle, "+" and "-", next row, and so on: the order of the page, with no roving stop (UX spec section 0.9 row 3: "Keyboard: Tab moves between a row and its "+""). The buttons of a row
    // that is not open are clipped, not removed (AQP-418), so this holds on a touch screen too.
    const tabTo = async (target: Locator): Promise<void> => {
      await page.keyboard.press('Tab');
      await expect(target).toBeFocused();
    };
    await arrow.focus();
    await tabTo(part(page, '1'));
    await tabTo(rowButton(page, 'Move', '1'));
    await tabTo(rowButton(page, 'Add under', '1'));
    await tabTo(rowButton(page, 'Delete', '1'));
    await tabTo(part(page, '1.1'));
    await tabTo(rowButton(page, 'Move', '1.1'));
    await tabTo(rowButton(page, 'Add under', '1.1'));
    await tabTo(rowButton(page, 'Delete', '1.1'));
    await tabTo(part(page, '2'));
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

    await choose(page, '1');
    await rowButton(page, 'Delete', '1').click();
    // The title names the row as the button that opened it does: its number, then its name or its kind (AQP-446).
    const dialog = page.getByRole('alertdialog', { name: /^Delete 1 .+\?$/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('This also deletes the 2 rows under it (1.1 Sub-part, 1.2 Sub-part) and everything entered for them. The remaining parts are renumbered. This cannot be undone.');
    await expect(dialog.getByRole('button', { name: 'Keep it' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Delete 3 rows' })).toBeVisible();
    await expectNoAxeViolations(page);

    await dialog.getByRole('button', { name: 'Keep it' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await slNumbers(page)).toEqual(['1', '1.1', '1.2']);
  });

  test('AC-3: a part with 2 sub-parts: confirming deletes all three', async ({ page }, testInfo) => {
    await openTreeWithTwoSubParts(page, testInfo);

    await choose(page, '1');
    await rowButton(page, 'Delete', '1').click();
    const dialog = page.getByRole('alertdialog', { name: /^Delete 1 .+\?$/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete 3 rows' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('3 rows deleted')).toHaveCount(1);
    await expect(page.getByText('No parts yet. Choose "Add main assembly" to add the first one.')).toBeVisible();
    // The foot of an empty tree still offers the one action that can start it again, and the form area points at it (DEF-099 [H]: not at a "New item" that no longer exists).
    await expect(page.getByRole('button', { name: 'Add main assembly' })).toBeVisible();
    await expect(page.getByText('Choose a part in the tree to fill in its form, or add the first one with "Add main assembly".')).toBeVisible();
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

    await reveal(page, '2');
    await rowButton(page, 'Delete', '2').click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete 2 Main Assembly?' });
    await expect(dialog).toContainText('Row 2 and everything typed into it will be deleted. This cannot be undone.');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(deletes).toEqual([]);
    expect(await slNumbers(page)).toEqual(['1', '2']);

    await reveal(page, '2');
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
    await choose(page, '1');

    // Under a Main Assembly: a Sub-Assembly, a Part or a Fastener. Escape closes the menu and gives the focus back to its "+".
    const plus = rowButton(page, 'Add under', '1');
    await expect(plus).toHaveAttribute('aria-haspopup', 'menu');
    await plus.click();
    // The names, in order; each item also carries its hint (AQP-449), which `estimate-tree-plus-menu.spec.ts` judges.
    await expect(page.getByRole('menuitem')).toHaveText([/^Sub-Assembly/, /^Part/, /^Fastener/]);
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
    await expect(page.getByRole('menuitem')).toHaveText([/^Part/, /^Fastener/]);
    await expect(page.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.1.1']);
    await expect(part(page, '1.1.1')).toBeFocused();

    // Under a Part there is one kind allowed, so it is added at once, with no menu; the "+" says so in its name.
    await choose(page, '1.1.1');
    const fastener = rowButton(page, 'Add fastener under', '1.1.1');
    await expect(fastener).not.toHaveAttribute('aria-haspopup', 'menu');
    await fastener.click();
    await expect(page.getByRole('menuitem')).toHaveCount(0);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.1.1', '1.1.1.1']);
    await expect(tree(page).getByRole('img', { name: 'Fastener' })).toHaveCount(1);

    // A Fastener holds nothing: no "+", only its "-".
    await choose(page, '1.1.1.1');
    await expect(tree(page).getByRole('button', { name: /^Add (under|fastener under) 1\.1\.1\.1 / })).toHaveCount(0);
    await expect(rowButton(page, 'Delete', '1.1.1.1')).toHaveCount(1);

    // "Add main assembly" at the foot adds another top-level one, last, and opens it.
    await addMain(page);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.1.1', '1.1.1.1', '2']);
    await expect(part(page, '2')).toHaveAttribute('aria-current', 'true');
    await expect(part(page, '2')).toBeFocused();

    // AQP-418 (DEF-075), acceptance checks 1, 2 and 3 of the design (AQP-406 comment 12939). The toolbar never floats over a row, so a press at the centre of a name is a press on the row: a Main Assembly, a Sub-Assembly, a Part
    // (level 3) and a Fastener, each when it is not the open row and again when it is. A press selects the row and opens no menu and no dialog, and sends no add, move or delete request.
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET' && /\/api\/v1\/estimates\/[^/]+\/(nodes|tree)/.test(new URL(request.url()).pathname)) writes.push(request.method() + ' ' + request.url());
    });
    for (const slNo of ['1.1', '1.1', '1.1.1', '1.1.1', '1.1.1.1', '1.1.1.1', '1', '1', '2', '2']) {
      expect(await reachedByCentrePress(page, slNo), 'the centre of ' + slNo + ' reaches the row').toBe('the row');
      await choose(page, slNo);
      await expect(part(page, slNo)).toHaveAttribute('aria-current', 'true');
      await expect(page.getByRole('menuitem')).toHaveCount(0);
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
    }
    expect(writes, 'a press on a name sent no add, move or delete request').toEqual([]);
    // 2 is the open row now, and the pointer is over it (the last press). Its toolbar is in view, under its name; every other toolbar is clipped to 1 px and has no hit area.
    const before = await toolbarBoxes(page);
    expect(before.filter((row) => row.open).map((row) => row.slNo)).toEqual(['2']);
    const rowOffsets = async (): Promise<number[]> => {
      const tops = await Promise.all(['1', '1.1', '1.1.1', '1.1.1.1', '2'].map(async (slNo) => (await part(page, slNo).boundingBox())?.y ?? 0));
      return tops.map((top) => top - (tops[0] ?? 0));
    };
    // A finger has no hover look. A mouse has one (the hovered row's toolbar, AQP-448): that is judged by the AQP-448 cases below, so the pointer is not moved over the rows here.
    if (!(await hasMouse(page))) {
      const offsets = await rowOffsets();
      await part(page, '1.1').hover();
      await part(page, '1.1.1').hover();
      expect(await toolbarBoxes(page)).toEqual(before);
      expect(await rowOffsets()).toEqual(offsets);
    }
    for (const row of before) {
      if (!row.open) expect(row.takesPress, row.slNo + ' toolbar takes a press').toBe(false);
      if (row.open) {
        expect(row.overlapsLink, row.slNo + ' toolbar does not overlap its name').toBe(false);
        expect(row.height, row.slNo + ' toolbar is in view').toBeGreaterThanOrEqual((page.viewportSize()?.width ?? 0) >= 1024 ? 36 : TOUCH_TARGET);
      } else {
        expect(row.width, row.slNo + ' toolbar is clipped').toBeLessThanOrEqual(1);
        expect(row.height, row.slNo + ' toolbar is clipped').toBeLessThanOrEqual(1);
      }
    }
    await expectNoAxeViolations(page);
  });

  test('AQP-405 AC-4 (AQP-418): the "-" of a row that is not the open one, reached by the keyboard (Tab from its link), deletes that row after the confirmation, and the open row stays open and is renumbered; and a press on a row below a row that has the keyboard focus is never lost (AQP-419)', async ({ page }, testInfo) => {
    // The toolbar of a row that is not open is clipped, so a press cannot reach it (AQP-418, DEF-075): a person reaches it with Tab from the row's link, on every screen. 1.1 is a Part: the handle, the "+" and the "-".
    await openTreeWithTwoSubParts(page, testInfo);
    await choose(page, '1.2');
    await expect(part(page, '1.2')).toHaveAttribute('aria-current', 'true');

    // AQP-419 (DEF-076), acceptance checks 1, 2, 3, 5, 7 and 10 of the design (comment 13032). 1.2 is the open row. Row 1 is given the keyboard focus ring, so its toolbar is in view under its name and every row below it is
    // one toolbar line lower; a press with the mouse on 1.1 then moves the focus, and used to take that line away under the pointer, so the row jumped up and the click was lost. Rule P: nothing moves between the
    // pointer-down and the pointer-up, 1.1 is open after the click, and row 1's toolbar goes back to the clip once the press is over. Each start state is asserted (WebKit's Tab can skip), then put back.
    const keyboardOnRow1 = async (focus: 'link' | 'handle' | 'menu'): Promise<void> => {
      await tree(page).getByRole('button', { name: 'Close branch 1' }).focus();
      await page.keyboard.press('Tab');
      await expect(part(page, '1')).toBeFocused();
      if (focus !== 'link') {
        await page.keyboard.press('Tab');
        await expect(handleOf(page, '1')).toBeFocused();
      }
      if (focus === 'menu') {
        await page.keyboard.press('Enter');
        await expect(page.getByRole('menuitem', { name: 'Move down', exact: true })).toBeVisible();
      }
      expect(await toolbarHeightOf(page, '1'), 'row 1 shows its toolbar by the keyboard focus').toBeGreaterThan(1);
    };
    const settled = async (): Promise<void> => {
      await expect(part(page, '1.1')).toHaveAttribute('aria-current', 'true');
      await expect(part(page, '1.2')).not.toHaveAttribute('aria-current', 'true');
      await expect.poll(() => toolbarHeightOf(page, '1'), 'row 1 settles once the press is over').toBeLessThanOrEqual(1);
      await expect(page.getByRole('menuitem')).toHaveCount(0);
      await choose(page, '1.2');
      await expect(part(page, '1.2')).toHaveAttribute('aria-current', 'true');
    };
    for (const [focus, holdMs] of [['link', 0], ['link', 150], ['handle', 0], ['menu', 0]] as const) {
      await keyboardOnRow1(focus);
      await pressWithoutShift(page, '1.1', holdMs, focus === 'menu' ? await yAboveMenu(page, '1.1') : undefined);
      await settled();
    }

    // Check 5: a press that is dragged off the row and released elsewhere is no click, and the held line is let go of when it is over: nothing stays in the way.
    await keyboardOnRow1('link');
    const pressed = defined(await part(page, '1.1').boundingBox());
    await page.mouse.move(pressed.x + pressed.width / 2, pressed.y + pressed.height / 2);
    await page.mouse.down();
    await pointerAway(page, 4);
    await page.mouse.up();
    await withState(page, () => expect.poll(() => toolbarHeightOf(page, '1'), 'a press that ends elsewhere lets the held line go').toBeLessThanOrEqual(1));
    await expect(part(page, '1.2')).toHaveAttribute('aria-current', 'true');

    // Check 7: the keyboard holds nothing. Tab from row 1's link through its buttons to row 1.1 takes row 1's toolbar away at once.
    await keyboardOnRow1('link');
    for (const next of [handleOf(page, '1'), rowButton(page, 'Add under', '1'), rowButton(page, 'Delete', '1'), part(page, '1.1')]) {
      await page.keyboard.press('Tab');
      await expect(next).toBeFocused();
    }
    expect(await toolbarHeightOf(page, '1'), 'Tab away collapses row 1 at once').toBeLessThanOrEqual(1);
    await choose(page, '1.2');
    await expect(part(page, '1.2')).toHaveAttribute('aria-current', 'true');

    // Check 4 and rule P2: a double click on the name of a row below the open row. The first click opens 1.1 and takes row 1's toolbar line away, so 1.1 sits one line higher and its own toolbar line is under the pointer;
    // the second press would land on its "+" (a Part gets its Fastener at once). The pointer is put where the "+" of 1.1 is once 1.1 is open, which is on the name of 1.1 while row 1 is open; the second press comes 120 ms
    // after the first, as a person's does. It must reach nothing: no add request, no menu, no dialog, and 1.1 stays the open row.
    const added: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && /\/api\/v1\/estimates\/[^/]+\/nodes$/.test(new URL(request.url()).pathname)) added.push(request.url());
    });
    await choose(page, '1.1');
    await expect(part(page, '1.1')).toHaveAttribute('aria-current', 'true');
    const plus = await settledBox(rowButton(page, 'Add fastener under', '1.1'));
    // Row 1's toolbar line is in view above 1.1: by the keyboard focus ring for a mouse (the open row no longer shows it, AQP-448), by being the open row for a finger.
    if (await hasMouse(page)) await keyboardOnRow1('link');
    else {
      await choose(page, '1');
      await expect(part(page, '1')).toHaveAttribute('aria-current', 'true');
    }
    const name = await settledBox(part(page, '1.1'));
    const [left, right] = [Math.max(plus.x, name.x), Math.min(plus.x + plus.width, name.x + name.width)];
    const [top, bottom] = [Math.max(plus.y, name.y), Math.min(plus.y + plus.height, name.y + name.height)];
    expect(right > left && bottom > top, 'the "+" of 1.1 once it is open lies over the name of 1.1 while row 1 is open').toBe(true);
    await page.mouse.move((left + right) / 2, (top + bottom) / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(part(page, '1.1')).toHaveAttribute('aria-current', 'true');
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 120)));
    await page.mouse.down();
    await page.mouse.up();
    await expect(part(page, '1.1')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('menuitem')).toHaveCount(0);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2']);
    await choose(page, '1.2');
    await expect(part(page, '1.2')).toHaveAttribute('aria-current', 'true');

    await part(page, '1.1').focus();
    await page.keyboard.press('Tab');
    await expect(handleOf(page, '1.1')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(rowButton(page, 'Add fastener under', '1.1')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(rowButton(page, 'Delete', '1.1')).toBeFocused();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog', { name: /^Delete 1\.1 .+\?$/ });
    await expect(dialog).toContainText('Row 1.1 and everything typed into it will be deleted. This cannot be undone.');
    await dialog.getByRole('button', { name: 'Delete row' }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1']);
    await expect(part(page, '1.1')).toHaveAttribute('aria-current', 'true');
    // Judged here, after the steps above have given a late request time to show: the second press of the double click above added nothing.
    expect(added, 'the second press of a double click on a name added no Fastener').toEqual([]);
  });
});

test.describe('AQP-448 (DEF-091): when the row toolbar is in view', () => {
  test('AQP-448 TB-1, TB-2, TB-3, TB-6: a mouse shows the toolbar of the hovered row, of the row with the focus ring and of a row with a menu or its delete confirmation open, and never of the open row; a finger shows the open row only', async ({ page }, testInfo) => {
    await openTreeWithTwoSubParts(page, testInfo);
    const mouse = await hasMouse(page);
    expect(mouse, 'the desktop project has a mouse and the phone and tablet projects a finger').toBe(testInfo.project.name === 'desktop');
    expect((await toolbarBoxes(page)).filter((box) => box.open), 'one row is open').toHaveLength(1);

    if (mouse) {
      // TB-1: with the pointer outside the tree no toolbar is in view, the open row's included.
      await pointerAway(page);
      await expectToolbarsOn(page, mouse);
      // TB-2: the toolbar of the hovered row is in view, one at a time, and it stays while the pointer goes down onto it; with the pointer away it goes.
      for (const slNo of ['1.1', '1.2', '1']) {
        await part(page, slNo).hover();
        await expectToolbarsOn(page, mouse, slNo);
      }
      // The toolbar of 1.1 is waited for before the pointer goes down onto its handle: the rows move as the toolbars come and go, and Playwright aims at the place the handle was.
      await reveal(page, '1.1');
      await handleOf(page, '1.1').hover();
      await expectToolbarsOn(page, mouse, '1.1');
      await pointerAway(page);
      await expectToolbarsOn(page, mouse);
    } else {
      // TB-6: a finger shows the open row's toolbar and no other; choosing another row moves it, and a pointer over a row changes nothing.
      await expectToolbarsOn(page, mouse);
      await choose(page, '1.1');
      await expectToolbarsOn(page, mouse, '1.1');
      await choose(page, '1.2');
      await expectToolbarsOn(page, mouse, '1.2');
      await part(page, '1.1').hover();
      await expectToolbarsOn(page, mouse, '1.2');
      expect(await rowsWithToolbar(page), 'only the open row has a toolbar').toEqual(['1.2']);
    }

    // TB-3: Tab onto a row's link shows its toolbar before the next Tab, and Tab out of the row takes it away (on a finger the open row keeps its own).
    await pointerAway(page);
    await tree(page).getByRole('button', { name: 'Close branch 1' }).focus();
    await page.keyboard.press('Tab');
    await expect(part(page, '1')).toBeFocused();
    await expectToolbarsOn(page, mouse, '1');
    for (const next of [handleOf(page, '1'), rowButton(page, 'Add under', '1'), rowButton(page, 'Delete', '1')]) {
      await page.keyboard.press('Tab');
      await expect(next).toBeFocused();
      await expectToolbarsOn(page, mouse, '1');
    }
    await page.keyboard.press('Tab');
    await expect(part(page, '1.1')).toBeFocused();
    await expectToolbarsOn(page, mouse, '1.1');

    // A menu of the row that is open keeps its toolbar in view with the pointer away; so does the delete confirmation. The row is chosen first on a finger, whose clipped buttons cannot be pressed.
    await part(page, '1.2').hover();
    await choose(page, '1.2');
    await handleOf(page, '1.2').click();
    await expect(page.getByRole('menuitem', { name: 'Move up', exact: true })).toBeVisible();
    await pointerAway(page);
    await expectToolbarsOn(page, mouse, '1.2');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem')).toHaveCount(0);
    await part(page, '1.1').hover();
    await choose(page, '1.1');
    await rowButton(page, 'Delete', '1.1').click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await pointerAway(page);
    await expectToolbarsOn(page, mouse, '1.1');
    await page.getByRole('button', { name: 'Keep it' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await pointerAway(page);
    await expectToolbarsOn(page, mouse);
  });
});

test.describe('AC-6: a change made under the person', () => {
  test('AC-6: a move with a stale revision gets the fresh tree and a notice, and the first change stands', async ({ page }, testInfo) => {
    const { estimateId } = await openTree(page, testInfo);
    await addMain(page);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '2']);
    await choose(page, '2');

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

    await reveal(page, '2');
    await handleOf(page, '2').click();
    await page.getByRole('menuitem', { name: 'Move up', exact: true }).click();
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
    for (const name of ['Add main assembly']) {
      expect((await action(page, name).boundingBox())?.height ?? 0, name).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    // The row buttons are 44 px, and 36 px from 1024 px with a fine pointer (UX row 3, NFR-017). The open row (1.1, the one just added) is the one whose toolbar is on screen on a touch screen: the toolbar of another row is not drawn there.
    const rowButtonHeight = (page.viewportSize()?.width ?? 0) >= 1024 ? 36 : TOUCH_TARGET;
    // A mouse shows the toolbar of the hovered row, so the pointer is put on it first.
    await part(page, '1.1').hover();
    await expect.poll(() => toolbarHeightOf(page, '1.1')).toBeGreaterThan(1);
    for (const [words, slNo] of [['Move', '1.1'], ['Add under', '1.1'], ['Delete', '1.1']] as const) {
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

test.describe('AQP-406: reorder by the move handle (CR-01 item 3D)', () => {
  /** The id of a row, from its link: it is how a test tells that the row, and not only its number, has moved. */
  const idOf = async (page: Page, slNo: string): Promise<string | null> => part(page, slNo).getAttribute('data-part-id');

  test('AQP-406 AC-1, AC-5, AC-8: dragging the handle of 1.2 above 1.1 shows a red line, moves the row, renumbers both, and announces it; the handle has the focus after', async ({ page }, testInfo) => {
    test.skip(isPhone(page), 'the mouse drag is for the tablet and the desktop; the phone has the touch drag below');
    await openTreeWithTwoSubParts(page, testInfo);
    await choose(page, '1.2');
    const moving = await idOf(page, '1.2');
    const handle = defined(await handleOf(page, '1.2').boundingBox());
    const above = defined(await part(page, '1.1').boundingBox());
    const x = handle.x + handle.width / 2;
    await page.mouse.move(x, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, above.y + 4, { steps: 8 });
    // The red line is at the top of 1.1, where the row would land, and is not the only cue: the numbers change at the drop.
    const line = page.locator('[data-drop-line]');
    await expect(line).toBeVisible();
    const lineBox = defined(await line.boundingBox());
    expect(Math.abs(lineBox.y + lineBox.height / 2 - above.y)).toBeLessThan(10);
    await page.mouse.up();
    await expect(line).toHaveCount(0);
    await expect(page.getByText('Part renumbered to 1.1')).toHaveCount(1);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2']);
    expect(await idOf(page, '1.1')).toBe(moving);
    await expect(handleOf(page, '1.1')).toBeFocused();
  });

  test('AQP-406 AC-1: a drag to the place after the last sibling moves the row down: 1.1 below 1.2 swaps them, and the moved row keeps its identity', async ({ page }, testInfo) => {
    test.skip(isPhone(page), 'the mouse drag is for the tablet and the desktop; the phone has the touch drag');
    await openTreeWithTwoSubParts(page, testInfo);
    await choose(page, '1.1');
    await reveal(page, '1.1');
    const moving = await idOf(page, '1.1');
    // The pointer goes onto the handle by Playwright's own hover, which scrolls the handle clear of the fixed bar at the foot of the page and checks that it is what lies under the pointer. A press at a place read
    // from a box went down on "Calculate" (run 45796904957): the toolbar line of 1.1 lies low in the panel with the toolbars clipped.
    await handleOf(page, '1.1').hover();
    const handle = await settledBox(handleOf(page, '1.1'));
    const below = await settledBox(part(page, '1.2'));
    const x = handle.x + handle.width / 2;
    await watchPointer(page);
    await page.mouse.move(x, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, below.y + below.height - 4, { steps: 8 });
    await withState(page, () => expect(page.locator('[data-drop-line]')).toBeVisible());
    // The line is there (it is drawn as soon as the drag code has the pointer), and at the bottom of 1.2, where the row would land. Both are read in one go in the page: near the edge of the panel the drag scrolls it, and the line moves with the rows.
    const gap = await page.evaluate(() => {
      const line = document.querySelector('[data-drop-line]')?.getBoundingClientRect();
      const link = [...document.querySelectorAll('nav[aria-label="Parts tree"] a[data-part-id]')].find((candidate) => candidate.querySelector('[data-sl-no]')?.textContent === '1.2')?.getBoundingClientRect();
      return line === undefined || link === undefined ? null : Math.abs(line.top + line.height / 2 - link.bottom);
    });
    expect(gap).not.toBeNull();
    expect(gap ?? 999).toBeLessThan(12);
    await page.mouse.up();
    await expect(page.getByText('Part renumbered to 1.2')).toHaveCount(1);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2']);
    expect(await idOf(page, '1.2')).toBe(moving);
    await expect(handleOf(page, '1.2')).toBeFocused();
  });

  test('AQP-406 AC-1: Escape during a drag abandons it: the line goes, no request is sent, nothing moves, and the click that ends the press opens no menu', async ({ page }, testInfo) => {
    test.skip(isPhone(page), 'the mouse drag is for the tablet and the desktop');
    await openTreeWithTwoSubParts(page, testInfo);
    await choose(page, '1.2');
    const moves = watchMoves(page);
    const handle = defined(await handleOf(page, '1.2').boundingBox());
    const above = defined(await part(page, '1.1').boundingBox());
    const x = handle.x + handle.width / 2;
    await page.mouse.move(x, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, above.y + 4, { steps: 8 });
    await expect(page.locator('[data-drop-line]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-drop-line]')).toHaveCount(0);
    await page.mouse.up();
    await expect(page.getByRole('menuitem', { name: 'Move up', exact: true })).toHaveCount(0);
    expect(moves.calls).toHaveLength(0);
    expect(await slNumbers(page)).toEqual(['1', '1.1', '1.2']);
  });

  test('AQP-406 AC-1: a drag that ends where the row is, or a click with a few pixels of wobble, sends nothing and opens the menu only for the click', async ({ page }, testInfo) => {
    test.skip(isPhone(page), 'the mouse drag is for the tablet and the desktop');
    await openTreeWithTwoSubParts(page, testInfo);
    await choose(page, '1.1');
    await reveal(page, '1.1');
    const moves = watchMoves(page);
    const handle = await settledBox(handleOf(page, '1.1'));
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 30, { steps: 4 });
    await page.mouse.move(x, y, { steps: 4 });
    await page.mouse.up();
    // A drag, let go where it began: no request and no menu.
    await expect(page.getByRole('menuitem', { name: 'Move up', exact: true })).toHaveCount(0);
    expect(moves.calls).toHaveLength(0);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2']);
    // A click: the menu. The pointer is back on the handle, and the row shows its toolbar again.
    await reveal(page, '1.1');
    await handleOf(page, '1.1').click();
    await expect(page.getByRole('menuitem', { name: 'Move down', exact: true })).toBeVisible();
    expect(moves.calls).toHaveLength(0);
  });

  test('AQP-406 AC-6, AC-8: a touch drag at phone width reorders, and the page still scrolls where the handle is not', async ({ page, context }, testInfo) => {
    test.skip(!isPhone(page), 'the touch drag is judged at phone width');
    await openTreeWithTwoSubParts(page, testInfo);
    await choose(page, '1.2');
    const moving = await idOf(page, '1.2');
    const handle = defined(await handleOf(page, '1.2').boundingBox());
    const above = defined(await part(page, '1.1').boundingBox());
    const x = handle.x + handle.width / 2;
    const fromY = handle.y + handle.height / 2;
    const toY = above.y + 4;
    const cdp = await context.newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await touch('touchStart', fromY);
    for (let step = 1; step <= 8; step += 1) await touch('touchMove', fromY + ((toY - fromY) * step) / 8);
    await expect(page.locator('[data-drop-line]')).toBeVisible();
    await touch('touchEnd', toY);
    await expect(page.getByText('Part renumbered to 1.1')).toHaveCount(1);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2']);
    expect(await idOf(page, '1.1')).toBe(moving);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('AQP-406 AC-2, AC-8: Move up and Move down by keyboard, with no dragging: Enter opens the menu on the first item that can be chosen, Enter chooses it, the row is announced and its handle keeps the focus; axe finds nothing with the menu open', async ({ page }, testInfo) => {
    test.slow();
    await openTreeWithTwoSubParts(page, testInfo);
    await choose(page, '1.2');
    await handleOf(page, '1.2').focus();
    await page.keyboard.press('Enter');
    // The last of two: Move down cannot be chosen, Move up can and has the focus.
    await expect(page.getByRole('menuitem', { name: 'Move up', exact: true })).toBeFocused();
    await expect(page.getByRole('menuitem', { name: 'Move down', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expectNoAxeViolations(page);
    await page.keyboard.press('Enter');
    await expect(page.getByText('Part renumbered to 1.1')).toHaveCount(1);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2']);
    await expect(handleOf(page, '1.1')).toBeFocused();

    // The first of two: Move up cannot be chosen, and Move down has the focus. Escape closes the menu and the handle keeps the focus.
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Move up', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('menuitem', { name: 'Move down', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem', { name: 'Move down', exact: true })).toHaveCount(0);
    await expect(handleOf(page, '1.1')).toBeFocused();
    expect(await slNumbers(page)).toEqual(['1', '1.1', '1.2']);
  });

  test('AQP-406 AC-2, AC-3: an only child has both items disabled, and there is no item that moves a row under another parent', async ({ page }, testInfo) => {
    await openTree(page, testInfo);
    await choose(page, '1');
    await handleOf(page, '1').click();
    await expect(page.getByRole('menuitem')).toHaveCount(2);
    await expect(page.getByRole('menuitem', { name: 'Move up', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('menuitem', { name: 'Move down', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
  });

  test('AQP-406 AC-9: a request that fails leaves the row where it was, with no new order kept, and says that the change was not made', async ({ page }, testInfo) => {
    await openTreeWithTwoSubParts(page, testInfo);
    await page.route(/\/tree\/move$/, (route) => route.abort('failed'));
    await moveFromMenu(page, '1.2', 'Move up');
    await expect(page.getByText('The change was not made')).toBeVisible();
    expect(await slNumbers(page)).toEqual(['1', '1.1', '1.2']);
    await page.unroute(/\/tree\/move$/);
    // Nothing is stuck: the same move goes through now.
    await moveFromMenu(page, '1.2', 'Move up');
    await expect(page.getByText('Part renumbered to 1.1')).toHaveCount(1);
  });
});
