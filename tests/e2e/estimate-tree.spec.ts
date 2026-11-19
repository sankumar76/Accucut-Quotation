import { expect, test, type Locator, type Page, type Request, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { defined } from '../support/defined';

import { createDisposableUser, E2E_PASSWORD, ensureCanaryCustomers, signInWithoutThePage, useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { DEVELOPMENT_URL } from './support/servers';

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

const ALPHA = defined(CUSTOMER_CANARIES[0]).name;
const ALPHA_ID = defined(CUSTOMER_CANARIES[0]).id;
const PHONE_MAX = 767;

const customerField = (page: Page): Locator => page.locator('#estimate-customer');
const tree = (page: Page): Locator => page.getByRole('tree', { name: 'Parts tree' });
/** The part with this Sl. No: its number is the first text of the item. */
const part = (page: Page, slNo: string): Locator => tree(page).getByRole('treeitem').filter({ has: page.locator('span', { hasText: new RegExp(`^${slNo.replaceAll('.', '\\.')}$`) }) });
const action = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1_000) <= PHONE_MAX;

/** The Sl. No of every part on screen, in order. */
async function slNumbers(page: Page): Promise<string[]> {
  return tree(page).getByRole('treeitem').evaluateAll((items) => items.map((item) => item.querySelector('span')?.textContent ?? ''));
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
const TOOLBAR_ACTIONS = ['New item', 'Sub-part', 'Part beside', 'Move up', 'Move down', 'Delete'] as const;
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
    const items = [...document.querySelectorAll('[role="tree"] [role="treeitem"]')].map((item) => {
      const place = `level ${item.getAttribute('aria-level') ?? '?'}, ${item.getAttribute('aria-posinset') ?? '?'} of ${item.getAttribute('aria-setsize') ?? '?'}`;
      return `${textOf(item.querySelector('span'))} (${place}${item.getAttribute('aria-selected') === 'true' ? ', selected' : ''})`;
    });
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
  await page.goto(`/estimates/${canaryTaskCodeFor(owner.id)}`);
  await waitUntilHydrated(page, '#estimate-customer', 'onChange');
  await expect(customerField(page)).toBeEnabled();
  await customerField(page).selectOption({ label: ALPHA });
  await expect(page.getByText('Customer saved.')).toBeVisible();
  await showTree(page);
  await expect(part(page, '1')).toBeVisible();
  return { estimateId: owner.id };
}

async function showTree(page: Page): Promise<void> {
  if (isPhone(page)) await page.getByRole('button', { name: /^Parts tree/ }).click();
  await expect(tree(page)).toBeVisible();
}

/**
 * A tree of part 1 with two sub-parts, for the two delete tests (DEF-048, AQP-377). The customer is chosen and the two sub-parts are added with the calls that the drop-down and the
 * Sub-part button make (`PUT .../customer`, `POST .../nodes`), before the page is opened, so the page opens on the tree. Done through the buttons they were 6 s of a test that took
 * 17 to 23 s on CI (run 44567048767), and the delete is the subject of these tests, not adding: the buttons are judged by the AC-1, AC-2 and AC-9 tests below, the drop-down by
 * `estimate-customer.spec.ts`. The tree is checked on screen below, as the tests that built it with the buttons did.
 */
let t0 = 0;
const mk = (label: string): void => {
  const now = Date.now();
  if (label === 'begin') t0 = now;
  process.stdout.write(`[DEF048] ${label} +${now - t0}ms
`);
};
async function openTreeWithTwoSubParts(page: Page, testInfo: TestInfo): Promise<void> {
  mk('begin');
  await ensureCanaryCustomers();
  const owner = await signInAsNewEngineer(page, testInfo);
  mk('signed in');
  const headers = { origin: DEVELOPMENT_URL };
  const chosen = await page.request.put(`/api/v1/estimates/${owner.id}/customer`, { headers, data: { customerId: ALPHA_ID } });
  expect(chosen.status(), 'the customer is chosen').toBe(200);
  mk('customer put');
  // One after the other, as the buttons are pressed: both are added under part 1, which is the person's one part and has the person's ID.
  for (const slNo of ['1.1', '1.2']) {
    const added = await page.request.post(`/api/v1/estimates/${owner.id}/nodes`, { headers, data: { kind: 'sub-part', nodeId: owner.id } });
    expect(added.ok(), `part ${slNo} is added`).toBe(true);
  }
  mk('sub-parts posted');
  await page.goto(`/estimates/${canaryTaskCodeFor(owner.id)}`);
  mk('goto returned');
  await waitUntilHydrated(page, '#estimate-customer', 'onChange');
  mk('hydrated');
  await expect(customerField(page)).toBeEnabled();
  mk('customer enabled');
  await showTree(page);
  mk('tree shown');
  await expect(part(page, '1')).toBeVisible();
  await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2']);
  mk('tree checked');
}

test.describe('AC-1, AC-2: adding, moving and renumbering', () => {
  test('AC-1, AC-2: New item, Sub-part and Part beside add parts and number them 1, 1.1, 1.2, 2; Move up renumbers and says so', async ({ page }, testInfo) => {
    // The second of two tests that are slow by what they do (AQP-340): four additions and two moves, each a request and a re-read of the tree. Measured: 22.8 s on a mobile shard of a green run
    // (44021154191), and it ran out of its 30 s on the tablet shard in runs 43905784789, 44025795508 and 44045571667. Three times the default, for this test only.
    test.slow();
    await openTree(page, testInfo);
    const moves = watchMoves(page);
    expect(await slNumbers(page)).toEqual(['1']);

    await part(page, '1').click();
    await action(page, 'Sub-part').click();
    await expect(page.getByText('Part 1.1 added')).toHaveCount(1);
    await action(page, 'Part beside').click();
    await expect(page.getByText('Part 1.2 added')).toHaveCount(1);
    await action(page, 'New item').click();
    await expect(page.getByText('Part 2 added')).toHaveCount(1);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2', '2']);

    // The new part is the selected one; 1.2 up becomes 1.1, and the screen says so.
    await part(page, '1.2').click();
    await action(page, 'Move up').click();
    await expectRenumbered(page, testInfo, moves, 'Part renumbered to 1.1');
    await expect(action(page, 'Move up')).toBeFocused();
    await expect(part(page, '1.1')).toHaveAttribute('aria-selected', 'true');
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

  test('AC-2: the tree is a tree: levels, positions and the selected part are in the markup, and the arrow keys, Home, End and Alt with arrows work', async ({ page }, testInfo) => {
    await openTree(page, testInfo);
    const moves = watchMoves(page);
    await part(page, '1').click();
    await action(page, 'Sub-part').click();
    // One change at a time: a second press while the first is out is ignored, so wait for the part to appear.
    await expect(part(page, '1.1')).toBeVisible();
    await action(page, 'New item').click();
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '2']);

    await expect(part(page, '1')).toHaveAttribute('aria-level', '1');
    await expect(part(page, '1.1')).toHaveAttribute('aria-level', '2');
    await expect(part(page, '2')).toHaveAttribute('aria-setsize', '2');
    await expect(part(page, '2')).toHaveAttribute('aria-posinset', '2');

    await part(page, '1').focus();
    await page.keyboard.press('ArrowDown');
    await expect(part(page, '1.1')).toBeFocused();
    await expect(part(page, '1.1')).toHaveAttribute('aria-selected', 'true');
    await expect(part(page, '1')).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('ArrowDown');
    await expect(part(page, '2')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(part(page, '2')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(part(page, '1')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(part(page, '1.1')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(part(page, '1')).toBeFocused();
    await page.keyboard.press('End');
    await expect(part(page, '2')).toBeFocused();

    // Alt with an arrow moves the part, with no dragging: 2 up is 1 and the old 1 is 2.
    await page.keyboard.press('Alt+ArrowUp');
    await expectRenumbered(page, testInfo, moves, 'Part renumbered to 1');
    await expect.poll(() => slNumbers(page)).toEqual(['1', '2', '2.1']);
  });
});

test.describe('AC-3: delete asks first and names the count', () => {
  // DEF-048 (AQP-377): one test of 17 to 23 s on CI (run 44567048767) before; now two, each with the tree made by `openTreeWithTwoSubParts` and none of its checks left out.
  test('AC-3: a part with 2 sub-parts: the dialog names 3 parts and Cancel is the safe choice; Cancel changes nothing', async ({ page }, testInfo) => {
    await openTreeWithTwoSubParts(page, testInfo);

    await part(page, '1').click();
    await action(page, 'Delete').click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete part 1?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('This also deletes its 2 sub-parts, and everything typed into them. This cannot be undone.');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Delete 3 parts' })).toBeVisible();
    await expectNoAxeViolations(page);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await slNumbers(page)).toEqual(['1', '1.1', '1.2']);
  });

  test('AC-3: a part with 2 sub-parts: confirming deletes all three', async ({ page }, testInfo) => {
    await openTreeWithTwoSubParts(page, testInfo);

    await part(page, '1').click();
    await action(page, 'Delete').click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete part 1?' });
    await expect(dialog).toBeVisible();
    mk('dialog visible (confirm test)');
    await dialog.getByRole('button', { name: 'Delete 3 parts' }).click();
    await expect(dialog).toHaveCount(0);
    mk('dialog gone');
    await expect(page.getByText('3 parts deleted')).toHaveCount(1);
    await expect(page.getByText('No parts yet. Choose "New item" to add the first one.')).toBeVisible();
    mk('words before reload');
    await page.reload();
    mk('reload returned');
    // With no part there is no tree element, only the words; on a phone they are in the drawer.
    if (isPhone(page)) await page.getByRole('button', { name: /^Parts tree/ }).click();
    mk('drawer pressed');
    await expect(page.getByText('No parts yet. Choose "New item" to add the first one.')).toBeVisible();
    mk('words after reload');
  });

  test('AC-3: a part with no sub-parts is a plain confirm, and Escape closes the dialog with nothing sent', async ({ page }, testInfo) => {
    await openTree(page, testInfo);
    await action(page, 'New item').click();
    await expect.poll(() => slNumbers(page)).toEqual(['1', '2']);
    const deletes: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'DELETE') deletes.push(request.url());
    });

    await action(page, 'Delete').click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete part 2?' });
    await expect(dialog).toContainText('Part 2 and everything typed into it will be deleted. This cannot be undone.');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(deletes).toEqual([]);
    expect(await slNumbers(page)).toEqual(['1', '2']);

    await action(page, 'Delete').click();
    await dialog.getByRole('button', { name: 'Delete part' }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => slNumbers(page)).toEqual(['1']);
    expect(deletes).toHaveLength(1);
  });
});

test.describe('AC-6: a change made under the person', () => {
  test('AC-6: a move with a stale revision gets the fresh tree and a notice, and the first change stands', async ({ page }, testInfo) => {
    const { estimateId } = await openTree(page, testInfo);
    await action(page, 'New item').click();
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
    await part(page, '1').click();
    await action(page, 'Sub-part').click();
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1']);

    if (isPhone(page)) {
      await expect(page.getByRole('dialog', { name: 'Parts tree' })).toBeVisible();
    } else {
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    for (const name of ['New item', 'Sub-part', 'Part beside', 'Move up', 'Move down', 'Delete']) {
      expect((await action(page, name).boundingBox())?.height ?? 0, name).toBeGreaterThanOrEqual(TOUCH_TARGET);
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
