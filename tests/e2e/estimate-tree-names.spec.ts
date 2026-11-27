import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { defined } from '../support/defined';
import { canaryTaskCodeFor } from '../support/estimate-recipe';

import { connectToTestDatabase, ensureCanaryCustomers, setCanaryCustomer } from './support/auth';
import { AXE_TAGS, expectNoAxeViolations, waitUntilHydrated, widthOf } from './support/design-system';
import { control, fieldIdOf, isPhone, nextSave, signInAsNewEngineer, tree } from './support/part-form';

/**
 * AQP-446 (DEF-089) and AQP-447 (DEF-090): the parts tree shows each row's kind and name as SCR-05 draws them, and a row is named through its Description (UX ruling
 * `docs/03-ux/rulings/parts-tree-scr05-conformance-2026-11-26.md`, checks NAME-1 to NAME-5, KIND-1; master's DL-413: after an add the focus is on the new row's link and Enter moves into the form). One test per
 * width on the development server: a person of its own with a tree of the five kinds made in the database (a Main Assembly, a Sub-Assembly, two Parts that are therefore Sub-parts, and a Fastener), one row
 * named by its Description and one by its Part No., then one row added with the "+", named through its Description and checked in the tree and in the server's answer. On a phone the tree is the drawer, so the
 * helpers open it when they must read the tree. Every name is invented.
 */

const row = (page: Page, slNo: string): Locator => tree(page).getByRole('link').filter({ has: page.locator('[data-sl-no]', { hasText: new RegExp(`^${slNo.replaceAll('.', '\\.')}$`) }) });
/** The name of a row: the text after its number, which is what a person reads (the kind icon's own name is a tooltip and a spoken name, not this text). */
const nameOf = (page: Page, slNo: string): Locator => row(page, slNo).locator('[data-sl-no] + span');
const rowButton = (page: Page, words: string, slNo: string): Locator => tree(page).getByRole('button', { name: new RegExp(`^${words} ${slNo.replaceAll('.', '\\.')} `) });

/** The tree is on screen: from 768 px it always is; on a phone it is the drawer, opened by its button when it is shut. */
async function showTree(page: Page): Promise<void> {
  if (isPhone(page) && !(await tree(page).isVisible())) await page.getByRole('button', { name: /^Parts tree/ }).click();
  await expect(tree(page)).toBeVisible();
}

/** The rows of the five kinds under the person's one Main Assembly (its ID is the person's), with a Part No. on one Part and a Description on the other. They are inserted before the page is opened. */
async function insertKindedRows(ownerId: string): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    const insert = async (parentId: string, sortIndex: number, kind: string, inputs: Record<string, string>): Promise<string> => {
      const made = await client.query<{ id: string }>(
        'INSERT INTO estimate_nodes (estimate_id, parent_id, sort_index, node_kind, inputs) VALUES ($1::uuid, $2::uuid, $3, $4::estimate_node_kind, $5::jsonb) RETURNING id::text',
        [ownerId, parentId, sortIndex, kind, JSON.stringify(inputs)],
      );
      return made.rows[0]?.id ?? '';
    };
    await insert(ownerId, 0, 'SUB_ASSEMBLY', {});
    await insert(ownerId, 1, 'PART', { [fieldIdOf('B')]: 'XP-1101' });
    const named = await insert(ownerId, 2, 'PART', { [fieldIdOf('D')]: 'Base frame', [fieldIdOf('B')]: 'XP-9' });
    await insert(named, 0, 'FASTENER', {});
  } finally {
    await client.end();
  }
}

/** Is the pointer a mouse (it hovers and points finely)? The same question the style sheet asks (`mouse:` in globals.css). */
const hasMouse = (target: Page): Promise<boolean> => target.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);

/**
 * What "no row moves" is measured by (DEF-129, UX ruling tree-toolbar-no-shift-2026-11-27, TS-1): the top of the link of every row **from the top of the tree** (so a scroll of the page, which Playwright makes to bring a button into
 * view, is not read as a move), its height, and the tree's own scroll height.
 */
interface Layout {
  readonly rows: ReadonlyArray<readonly [number, number]>;
  readonly scrollHeight: number;
}
const layoutOf = (target: Page): Promise<Layout> =>
  tree(target).evaluate((nav) => ({
    rows: [...nav.querySelectorAll('li[data-part-row] a[data-part-id]')].map((link) => {
      const box = link.getBoundingClientRect();
      return [Math.round((box.top - nav.getBoundingClientRect().top) * 100) / 100, Math.round(box.height * 100) / 100] as const;
    }),
    scrollHeight: nav.scrollHeight,
  }));

/** The centre of the link of a row, in page pixels. */
async function centreOf(target: Page, slNo: string): Promise<{ readonly x: number; readonly y: number }> {
  const box = await row(target, slNo).boundingBox();
  if (box === null) throw new Error(`row ${slNo} has no box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The pointer outside the tree: the far right edge of the page, half way down. */
async function rest(target: Page): Promise<void> {
  const size = target.viewportSize();
  await target.mouse.move((size?.width ?? 1_000) - 2, (size?.height ?? 600) / 2);
}

/**
 * Axe on one region of the page, with the page where the interaction left it (TS-9, TS-10, TS-16: the toolbar's buttons must pass the target-size rule at the normal scroll position, not only after a scroll to the top). The
 * rules are the suite's (`AXE_TAGS`), violations only, and the failure names the nodes and the neighbours they were compared with, as `expectNoAxeViolations` does. The whole page is scanned too, from the top, as everywhere.
 */
async function expectRegionAccessible(target: Page, selector: string): Promise<void> {
  const results = await new AxeBuilder({ page: target }).include(selector).options({ resultTypes: ['violations'] }).withTags(AXE_TAGS).analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    nodes: violation.nodes.map((node) => node.target.join(' ')).slice(0, 5),
    neighbours: violation.nodes.flatMap((node) => node.any.flatMap((check) => (check.relatedNodes ?? []).map((related) => related.target.join(' ')))).slice(0, 5),
  }));
  expect(summary, `axe on ${selector}`).toEqual([]);
}

/** Both scans of a state: the region where the page is, then the whole page from the top. */
async function expectStateAccessible(target: Page, selector: string): Promise<void> {
  await expectRegionAccessible(target, selector);
  await target.evaluate(() => window.scrollTo(0, 0));
  await expectNoAxeViolations(target);
}

/**
 * A press on a row. In the phone drawer it also opens the row: the drawer closes and the form shows (AQP-490, DEF-133; UX ruling 2026-11-26 item 3 point 7), so the drawer is opened again to reach the row's toolbar; the row
 * is still the open one. Anywhere else a press only chooses the row, and the tree stays on screen.
 */
async function tap(target: Page, slNo: string): Promise<void> {
  await row(target, slNo).click();
  if (isPhone(target)) {
    await expect(tree(target)).toBeHidden();
    await showTree(target);
  }
}

/** The rows of the tree after the first case, in reading order. */
const ROWS = ['1', '1.1', '1.1.1', '1.2', '1.3', '1.3.1'] as const;

/** The toolbar group of a row, and the slot that holds it. */
const ownItem = (target: Page, slNo: string): Locator => row(target, slNo).locator('xpath=ancestor::li[@data-part-row][1]');
const toolbarOf = (target: Page, slNo: string): Locator => ownItem(target, slNo).locator('[data-row-actions]').first();
const slotOf = (target: Page, slNo: string): Locator => ownItem(target, slNo).locator('[data-row-toolbar]').first();

/**
 * DEF-129 and DEF-132 (AQP-486; UX ruling `tree-toolbar-no-shift-2026-11-27.md`, checks TS-1 to TS-17; master DL-440): the toolbar of a row never moves a row. The cases below use **the page the first case built**, in one serial
 * group (as `users.spec.ts` does: one person and one page load for the group, so the person ledger does not grow), a tree of six rows. A mouse (the desktop project) runs the pointer checks; a finger (the tablet and the phone)
 * runs the touch rule: the toolbar of the selected row only. None of them uses `force`, a fixed wait, a retry or a helper that waits for a toolbar to go: the click that used to be intercepted is the test.
 */
test.describe('the parts tree: names, kinds and a toolbar that moves nothing', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;
  let ownerId = '';

  test.beforeAll(async ({ browser }, testInfo) => {
    const { baseURL, viewport, hasTouch } = testInfo.project.use;
    context = await browser.newContext({ storageState: { cookies: [], origins: [] }, ...(baseURL === undefined ? {} : { baseURL }), ...(viewport === undefined ? {} : { viewport }), ...(hasTouch === undefined ? {} : { hasTouch }) });
    page = await context.newPage();
    await ensureCanaryCustomers();
    const owner = await signInAsNewEngineer(page, testInfo);
    ownerId = owner.id;
    // The customer and the rows are set in the database before the page is opened, as a task is assigned with one (CR-01 item 6), so the page opens on the tree.
    await setCanaryCustomer(owner.id, defined(CUSTOMER_CANARIES[0]).id);
    await insertKindedRows(owner.id);
    await page.goto(`/estimates/${canaryTaskCodeFor(owner.id)}`);
    const viewsTree = isPhone(page) ? 'button[data-early-intent="parts-tree"]' : 'nav[aria-label="Parts tree"] a[data-part-id]';
    await waitUntilHydrated(page, viewsTree, 'onClick');
    await showTree(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('NAME-1 to NAME-4, KIND-1: rows show their kind and their name; a new row is named through its Description and the tree follows when the field is left', async () => {
    // KIND-1: each kind has its own glyph and its spoken name; two Parts under one parent are both a Sub-part.
    const glyph = (slNo: string, kind: string, name: string): Locator => row(page, slNo).locator(`svg[data-node-kind="${kind}"][aria-label="${name}"]`);
    await expect(glyph('1', 'MAIN_ASSEMBLY', 'Main Assembly')).toBeVisible();
    await expect(glyph('1.1', 'SUB_ASSEMBLY', 'Sub-Assembly')).toBeVisible();
    await expect(glyph('1.2', 'PART', 'Sub-part')).toBeVisible();
    await expect(glyph('1.3', 'PART', 'Sub-part')).toBeVisible();
    await expect(glyph('1.3.1', 'FASTENER', 'Fastener')).toBeVisible();

    // NAME-3: with no Description and no Part No. a row shows its kind's own name, muted and italic, and says in words that it has no description yet.
    await expect(nameOf(page, '1')).toHaveText('Main Assembly, no description yet');
    await expect(nameOf(page, '1.1')).toHaveText('Sub-Assembly, no description yet');
    await expect(nameOf(page, '1.3.1')).toHaveText('Fastener, no description yet');
    await expect(nameOf(page, '1.1').locator('span').first()).toHaveCSS('font-style', 'italic');
    // NAME-2 and NAME-1: the Part No. names a row with no Description, and the Description wins over the Part No.; a named row is plain text, never "Part".
    await expect(nameOf(page, '1.2')).toHaveText('XP-1101');
    await expect(nameOf(page, '1.3')).toHaveText('Base frame');
    await expect(nameOf(page, '1.3').locator('span')).toHaveCount(0);

    // Adding a row: the status says what was added and how to name it, and the focus is on the new row's link.
    await tap(page, '1.1');
    await rowButton(page, 'Add under', '1.1').click();
    await page.getByRole('menuitem', { name: 'Part', exact: true }).click();
    await expect(page.getByText('Added 1.1.1 Part. Type a Description to name it.')).toHaveCount(1);
    await expect(row(page, '1.1.1')).toBeFocused();
    await expect(nameOf(page, '1.1.1')).toHaveText('Part, no description yet');

    // Enter on the link moves into the form (on a phone the drawer closes first). Description tells what it does.
    await page.keyboard.press('Enter');
    await expect(control(page, 'D')).toBeEnabled();
    await expect(page.getByText('Names this row in the parts tree.')).toBeVisible();

    // NAME-4: typing changes nothing in the tree; leaving the field does, and the server holds the name.
    const saved = nextSave(page, 'D');
    await control(page, 'D').fill('Cover plate');
    await control(page, 'D').blur();
    expect(await saved).toBe(200);
    await showTree(page);
    await expect(nameOf(page, '1.1.1')).toHaveText('Cover plate');
    const answer = await page.request.get(`/api/v1/estimates/${ownerId}/tree`);
    expect(answer.status()).toBe(200);
    const nodes = ((await answer.json()) as { nodes: Array<{ slNo: string; label: string }> }).nodes;
    expect(nodes.map((node) => [node.slNo, node.label])).toEqual([
      ['1', ''],
      ['1.1', ''],
      ['1.1.1', 'Cover plate'],
      ['1.2', 'XP-1101'],
      ['1.3', 'Base frame'],
      ['1.3.1', ''],
    ]);
  });

  test('TS-1 to TS-6 (a mouse) and TS-8 (a finger): the toolbar of a row moves no row, takes no press when it is not in view, and a click on the next row opens that row and adds nothing', async () => {
    await showTree(page);
    await expect(row(page, '1.3.1')).toBeVisible();
    const changes: string[] = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (request.method() !== 'GET' && /\/api\/v1\/estimates\/[^/]+\/(nodes(\/[^/]+)?|tree\/move)$/.test(path)) changes.push(`${request.method()} ${path}`);
    });
    if (await hasMouse(page)) {
      await rest(page);
      const idle = await layoutOf(page);
      expect(idle.rows).toHaveLength(ROWS.length);

      // TS-11: with a toolbar in every row's slot the rows are further apart than a row's own line (the slot is reserved under each).
      const pitch = (idle.rows[1]?.[0] ?? 0) - (idle.rows[0]?.[0] ?? 0);
      expect(pitch).toBeGreaterThanOrEqual(76);

      // TS-6: a toolbar that is not in view has no hit area: what lies under where its buttons would be is the slot or the list item, never a button; and a press on the empty slot sends nothing.
      for (const slNo of ROWS) {
        const slot = await slotOf(page, slNo).boundingBox();
        expect(slot, `the slot of ${slNo}`).not.toBeNull();
        const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.closest('button, a')?.tagName ?? '', [(slot?.x ?? 0) + 20, (slot?.y ?? 0) + (slot?.height ?? 0) / 2] as const);
        expect(hit, `what lies in the empty slot of ${slNo}`).toBe('');
      }

      // TS-1: hover each row, then each of its buttons: no row moves, by a single pixel, and the tree is as tall as it was.
      for (const slNo of ROWS) {
        const centre = await centreOf(page, slNo);
        await page.mouse.move(centre.x, centre.y);
        expect(await layoutOf(page), `pointer over ${slNo}`).toEqual(idle);
        for (const button of await toolbarOf(page, slNo).getByRole('button').all()) {
          await button.hover();
          expect(await layoutOf(page), `pointer over a button of ${slNo}`).toEqual(idle);
        }
        await rest(page);
        expect(await layoutOf(page), `pointer away from ${slNo}`).toEqual(idle);
      }

      // TS-5: the toolbar of the hovered row sits in the slot under its row: at the slot's top, 38 px high for a mouse from 1024 px, each button 36 by 36, wholly inside the slot.
      const first = await centreOf(page, '1.1');
      await page.mouse.move(first.x, first.y);
      const slot = await slotOf(page, '1.1').boundingBox();
      const bar = await toolbarOf(page, '1.1').locator('> div').first().boundingBox();
      expect(slot).not.toBeNull();
      expect(bar).not.toBeNull();
      expect(Math.abs((bar?.y ?? 0) - (slot?.y ?? 0))).toBeLessThanOrEqual(3);
      expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeLessThanOrEqual((slot?.y ?? 0) + (slot?.height ?? 0) + 0.5);
      const wide = (await widthOf(page)) >= 1024;
      expect(bar?.height ?? 0).toBeCloseTo(wide ? 38 : 46, 0);
      for (const button of await toolbarOf(page, '1.1').getByRole('button').all()) {
        const box = await button.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(wide ? 36 : 44);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(wide ? 36 : 44);
      }

      // TS-2: the pointer goes down five rows, in 20 small steps and in one jump: every row is where it was.
      const top = await centreOf(page, '1');
      const fifth = await centreOf(page, '1.3');
      for (const steps of [20, 1]) {
        await rest(page);
        await page.mouse.move(top.x, top.y);
        for (let step = 1; step <= steps; step += 1) {
          await page.mouse.move(top.x + ((fifth.x - top.x) * step) / steps, top.y + ((fifth.y - top.y) * step) / steps);
          expect(await layoutOf(page), `step ${String(step)} of ${String(steps)}`).toEqual(idle);
        }
      }

      // TS-3: from each row straight down onto the next row's link, one jump, then a click: that row opens, and nothing is added, moved or deleted. No force, no wait for a toolbar to go.
      const before = changes.length;
      for (let index = 0; index < ROWS.length - 1; index += 1) {
        const from = ROWS[index] ?? '1';
        const next = ROWS[index + 1] ?? '1';
        const start = await centreOf(page, from);
        await page.mouse.move(start.x, start.y);
        const target = await centreOf(page, next);
        await page.mouse.move(target.x, target.y);
        await page.mouse.down();
        await page.mouse.up();
        await expect(row(page, next), `a click on ${next} opens it`).toHaveAttribute('aria-current', 'true');
        await expect(page.getByRole('alertdialog')).toHaveCount(0);
        expect(await layoutOf(page)).toEqual(idle);
      }
      expect(changes.slice(before), 'nothing was added, moved or deleted by the clicks on the rows').toEqual([]);

      // TS-4: the browser's own layout-shift measure stays at 0 while the pointer sweeps the whole tree and Tab goes through every row and button.
      await page.evaluate(() => {
        const entries: number[] = [];
        Reflect.set(window, '__shifts', entries);
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) entries.push(Reflect.get(entry, 'value') as number);
        }).observe({ type: 'layout-shift', buffered: false });
      });
      for (const slNo of ROWS) {
        const centre = await centreOf(page, slNo);
        await page.mouse.move(centre.x, centre.y, { steps: 6 });
      }
      await rest(page);
      await row(page, '1').focus();
      for (let presses = 0; presses < 40; presses += 1) {
        await page.keyboard.press('Tab');
        if (!(await page.evaluate(() => document.activeElement?.closest('nav[aria-label="Parts tree"]') !== null))) break;
        expect(await layoutOf(page), 'a Tab press moved a row').toEqual(idle);
      }
      const shifts = await page.evaluate(() => {
        const recorded: unknown = Reflect.get(window, '__shifts');
        return Array.isArray(recorded) ? recorded.map(Number) : [];
      });
      expect(shifts.reduce((sum, value) => sum + value, 0), 'the sum of the layout shifts').toBe(0);
    } else {
      // TS-8: a finger. Only the selected row has a toolbar in view; tapping another row moves it there; no other row has one, and its buttons are 44 px.
      await tap(page, '1.2');
      await expect(row(page, '1.2')).toHaveAttribute('aria-current', 'true');
      for (const slNo of ROWS) {
        const height = (await toolbarOf(page, slNo).boundingBox())?.height ?? 0;
        if (slNo === '1.2') expect(height, 'the toolbar of the selected row').toBeGreaterThan(40);
        else expect(height, `the toolbar of ${slNo}`).toBeLessThanOrEqual(1);
      }
      for (const button of await toolbarOf(page, '1.2').getByRole('button').all()) {
        const box = await button.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      await tap(page, '1.3');
      await expect(row(page, '1.3')).toHaveAttribute('aria-current', 'true');
      expect((await toolbarOf(page, '1.3').boundingBox())?.height ?? 0).toBeGreaterThan(40);
      expect((await toolbarOf(page, '1.2').boundingBox())?.height ?? 0).toBeLessThanOrEqual(1);
      expect(changes, 'the taps added, moved or deleted nothing').toEqual([]);
    }
  });

  test('TS-9, TS-10, TS-16: axe at the normal scroll position with a toolbar in view, with the "+" menu open and with the delete dialog open; every button is 24 px or more and none overlaps another', async () => {
    await showTree(page);
    const mouse = await hasMouse(page);
    // The row whose toolbar is in view: hovered with a mouse, selected with a finger. No scroll to the top: the page is where the cases before it left it.
    const open = async (): Promise<void> => {
      const centre = await centreOf(page, '1.1');
      if (mouse) await page.mouse.move(centre.x, centre.y);
      else await tap(page, '1.1');
      await expect(toolbarOf(page, '1.1')).toBeVisible();
    };
    await open();
    const boxes = [];
    for (const button of await toolbarOf(page, '1.1').getByRole('button').all()) {
      const box = await button.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(24);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
      boxes.push(box);
    }
    for (const [index, one] of boxes.entries()) {
      for (const other of boxes.slice(index + 1)) {
        if (one === null || other === null) continue;
        const apart = one.x + one.width <= other.x + 0.5 || other.x + other.width <= one.x + 0.5 || one.y + one.height <= other.y + 0.5 || other.y + other.height <= one.y + 0.5;
        expect(apart, 'two toolbar buttons overlap').toBe(true);
      }
    }
    // The toolbar in view: the tree where the page is, then the whole page from the top. (A scan of the whole page where an interaction leaves it also meets the page's own header links half behind the sticky bar, which is
    // the scroll and not the tree: the same reading as in `estimate-treatments.spec.ts`.)
    await expectStateAccessible(page, 'nav[aria-label="Parts tree"]');

    // The "+" menu of the row opens in line under it. The page was scrolled to the top by the scan above, out from under a pointer that did not move, so the hover is made again right before the button is pressed (DL-445):
    // a press on a toolbar BUTTON needs the row to be hovered when it lands. The movement cases do no such thing.
    await open();
    await rowButton(page, 'Add under', '1.1').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expectStateAccessible(page, 'nav[aria-label="Parts tree"]');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    // The delete dialog of the row. Keep it closes it, and nothing is deleted.
    await open();
    await rowButton(page, 'Delete', '1.1').click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expectStateAccessible(page, '[role="alertdialog"]');
    await page.getByRole('button', { name: 'Keep it' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(row(page, '1.1')).toBeVisible();
  });

  test('DEF-133: a press on a row in the phone drawer closes the drawer and shows that row\'s form, the focus is on the form\'s title, and the drawer opens again on the same row with its toolbar; elsewhere the panel stays', async () => {
    await showTree(page);
    const formFocus = page.locator('form[data-part-form] :focus');
    if (isPhone(page)) {
      await row(page, '1.2').click();
      // The drawer closes and the form of that row is what is on screen.
      await expect(tree(page)).toBeHidden();
      const title = page.locator('form[data-part-form] #part-form-title');
      await expect(title).toContainText('1.2');
      // The focus goes to the form's title, not into a field: no keyboard comes up for a finger that has not chosen to type.
      await expect(title).toBeFocused();
      await expect(page.locator('form[data-part-form] :is(input, textarea, select):focus')).toHaveCount(0);
      // The drawer opens again on the same row, which is still the open one and has its toolbar (the touch rule of the no-shift ruling: the selected row only).
      await showTree(page);
      await expect(row(page, '1.2')).toHaveAttribute('aria-current', 'true');
      expect((await toolbarOf(page, '1.2').boundingBox())?.height ?? 0).toBeGreaterThan(40);
      // A press on a button of the toolbar does not close the drawer: only a press on a row does.
      await rowButton(page, 'Delete', '1.2').click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('button', { name: 'Keep it' }).click();
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      await expect(tree(page)).toBeVisible();
    } else {
      // The panel is beside or above the form: a press only chooses the row, the tree stays on screen and the focus does not go into the form.
      await row(page, '1.2').click();
      await expect(row(page, '1.2')).toHaveAttribute('aria-current', 'true');
      await expect(tree(page)).toBeVisible();
      await expect(formFocus).toHaveCount(0);
    }
  });
});
