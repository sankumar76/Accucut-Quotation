import { expect, test, type Locator, type Page } from '@playwright/test';

import { approvedEstimate } from './support/approved-estimate';
import { useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';
import { withExportTurn } from './support/export-slot';
import { estimateInStatus, ignoreThroughTheApi, moveDeadlineIntoThePast, queueAddressOf } from './support/ignored';

/**
 * DEF-077 (AQP-420; DL-357; UX 13044; UX spec section 6.0 "Masters tables", OQ-UX-20 closed: the pass line binds the Lead's and Admin's queue): the Actions column of the task queue stays visible. On the Open,
 * Closed and Ignored tabs, with the table region not scrolled (`scrollLeft` 0), every row action ("Reassign or change deadline", "Open to restore", the word "Closed") and the whole Downloaded chip lie inside
 * the table's region, and the Actions column is the last one, sticky and opaque at the region's right edge (the guarantee when a long name widens the table). Tabbing through every control of a row shows each whole, not partly
 * under the region's edge and with nothing on top of it (WCAG 2.2 SC 2.4.11). The project's own width is checked in every project (360 px cards, 768 px, 1366 px); the desktop project also checks 1024, 1280 and
 * 1440 px, so the five widths of the pass line are all read. axe is clean at the project's own width. Every task is reached through the API (`support/ignored.ts`); every name is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

/** The widths each project reads: its own, and for the desktop project the other widths of the pass line. */
const WIDTHS: Readonly<Record<string, ReadonlyArray<number>>> = { mobile: [360], tablet: [768], desktop: [1024, 1280, 1366, 1440] };
const HEIGHT = 900;
/** The table is a table from 768 px; below it a card for each task. */
const TABLE_FROM = 768;
/** Half a pixel: layout rounds to a fraction of a pixel. */
const TOLERANCE = 0.5;
/** Tab presses allowed through one row: the task link, the folder link, Copy path, "Read all remarks" and the action, with room to spare. */
const MAX_TABS = 10;
/** The task link, the folder link, Copy path and the action. */
const MINIMUM_CONTROLS = 4;
const CHIP = '[data-slot="download-chip"]';
const REGION_NAME = 'Tasks, scrollable table';

const widthsOf = (projectName: string): ReadonlyArray<number> => WIDTHS[projectName] ?? [1366];

interface Edges {
  readonly left: number;
  readonly right: number;
}

/** The left and right edges of the box that holds the row's content: the table's region from 768 px (its visible part, without a scrollbar), the card below. */
async function holderOf(page: Page, row: Locator): Promise<Edges> {
  const width = page.viewportSize()?.width ?? 0;
  if (width < TABLE_FROM) {
    const box = await row.boundingBox();
    if (box === null) throw new Error('The card has no box.');
    return { left: box.x, right: box.x + box.width };
  }
  return page.getByRole('region', { name: REGION_NAME }).evaluate((region) => {
    const rect = region.getBoundingClientRect();
    return { left: rect.left + region.clientLeft, right: rect.left + region.clientLeft + region.clientWidth };
  });
}

/** The edges of an element and of everything inside it (the chip's badge and its last-download line are children). */
const edgesOfTree = (locator: Locator): Promise<ReadonlyArray<Edges>> =>
  locator.evaluate((element) =>
    [element, ...Array.from(element.querySelectorAll('*'))].map((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    }),
  );

/** Whole: no part of the element, or of anything inside it, is outside the holder. */
async function expectWhole(what: string, locator: Locator, holder: Edges): Promise<void> {
  for (const edges of await edgesOfTree(locator)) {
    expect.soft(edges.left, `${what}: left edge`).toBeGreaterThanOrEqual(holder.left - TOLERANCE);
    expect.soft(edges.right, `${what}: right edge`).toBeLessThanOrEqual(holder.right + TOLERANCE);
  }
}

/** Not overlapped: the element at the middle of the control is the control itself (or something inside it). */
const isOnTop = (locator: Locator): Promise<boolean> =>
  locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit !== null && (hit === element || element.contains(hit));
  });

const isOpaque = (colour: string): boolean => (colour.startsWith('rgb(') || /,\s*1\)$/.test(colour)) && colour !== 'rgba(0, 0, 0, 0)';

/**
 * The guarantee behind the fit: when the table is wider than its region, the Actions column is sticky at the region's right edge and opaque, so a long name never pushes an action away. The fit itself
 * (nothing to scroll) is the expected case with short names; either way the geometry checks of the callers hold.
 */
async function expectStickyActions(page: Page, row: Locator): Promise<void> {
  if ((page.viewportSize()?.width ?? 0) < TABLE_FROM) return;
  const cell = row.locator('td').last();
  const head = page.getByRole('columnheader', { name: 'Actions' });
  await expect(head).toHaveCount(1);
  expect.soft(await cell.evaluate((element) => getComputedStyle(element).position), 'the Actions cell is sticky').toBe('sticky');
  expect.soft(await head.evaluate((element) => getComputedStyle(element).position), 'the Actions heading is sticky').toBe('sticky');
  expect.soft(isOpaque(await cell.evaluate((element) => getComputedStyle(element).backgroundColor)), 'the Actions cell is opaque').toBe(true);
  expect.soft(isOpaque(await head.evaluate((element) => getComputedStyle(element).backgroundColor)), 'the Actions heading is opaque').toBe(true);
}

interface Reading {
  readonly label: string;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  /** The element at the centre of the control's box is the control or inside it (`contains`, not strict equality: a link holds text nodes and icons). */
  readonly onTop: boolean;
}

/** What has focus, read in the page, or null when focus is not inside the row. */
const readFocused = (row: Locator): Promise<Reading | null> =>
  row.evaluate((rowElement) => {
    const element = document.activeElement;
    if (element === null || !rowElement.contains(element)) return null;
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const label = element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40) ?? element.tagName;
    return { label, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, onTop: hit !== null && element.contains(hit) };
  });

/**
 * Tab through every focusable control of the row, from its task link to the one after the action (DL-358 (5)(b)): the task link, the folder link, Copy path and the action, since a sticky column can cover a control
 * further left and Chromium does not scroll a control that is partly visible. Each control, as the browser's own focus scroll left it (nothing is scrolled by hand, nothing is waited for: the scroll is done when the key press
 * returns), lies inside the region and the window, and the element at the centre of its box is the control or inside it (SC 2.4.11).
 */
async function expectEveryControlShown(page: Page, row: Locator, code: string, action: Locator): Promise<void> {
  await row.getByRole('link', { name: code, exact: true }).focus();
  const readings: Reading[] = [];
  let reading = await readFocused(row);
  for (let press = 0; reading !== null && press < MAX_TABS; press += 1) {
    readings.push(reading);
    await page.keyboard.press('Tab');
    reading = await readFocused(row);
  }
  const holder = await holderOf(page, row);
  const actionLabel = await action.getAttribute('aria-label');
  expect(readings.map((each) => each.label), 'the Tab walk reaches the row action').toContain(actionLabel);
  expect(readings.length, 'the task link, the folder link, Copy path and the action at least').toBeGreaterThanOrEqual(MINIMUM_CONTROLS);
  for (const each of readings) {
    expect.soft(each.left, `${each.label}: inside the region, left`).toBeGreaterThanOrEqual(holder.left - TOLERANCE);
    expect.soft(each.right, `${each.label}: inside the region, right`).toBeLessThanOrEqual(holder.right + TOLERANCE);
    expect.soft(each.left, `${each.label}: inside the window, left`).toBeGreaterThanOrEqual(0);
    expect.soft(each.right, `${each.label}: inside the window, right`).toBeLessThanOrEqual(each.viewportWidth);
    expect.soft(each.top, `${each.label}: inside the window, top`).toBeGreaterThanOrEqual(0);
    expect.soft(each.bottom, `${each.label}: inside the window, bottom`).toBeLessThanOrEqual(each.viewportHeight);
    expect.soft(each.onTop, `${each.label}: the element at its centre is the control or inside it`).toBe(true);
  }
}

/** The page of a tab for one task, opened at one width, with its row. */
async function openTab(page: Page, width: number, tab: string, code: string): Promise<Locator> {
  await page.setViewportSize({ width, height: HEIGHT });
  await page.goto(queueAddressOf(tab, code));
  const row = page.locator(`[data-task-code="${code}"]:visible`);
  await expect(row).toBeVisible();
  return row;
}

/** Every width the project reads: the page does not scroll sideways, the region is not scrolled, the checks run, axe is clean. */
async function atEveryWidth(page: Page, projectName: string, tab: string, code: string, check: (row: Locator, holder: Edges) => Promise<void>): Promise<void> {
  // axe scans the page at the project's own width only: a scan is the dearest step of a width, and the layout rules it reads do not change between 1280 and 1440 px.
  const ownWidth = page.viewportSize()?.width;
  for (const width of widthsOf(projectName)) {
    const row = await openTab(page, width, tab, code);
    expect(await horizontalOverflow(page), `${width} px: the page does not scroll sideways`).toBeLessThanOrEqual(0);
    // The proof is read with the region not scrolled; only the Tab at the end of a check may scroll it.
    if (width >= TABLE_FROM) expect(await page.getByRole('region', { name: REGION_NAME }).evaluate((element) => element.scrollLeft), `${width} px: the region is not scrolled`).toBe(0);
    // The symptom first (the action or the chip outside the region), then the guarantee behind the fix, then axe.
    await check(row, await holderOf(page, row));
    await expectStickyActions(page, row);
    if (width === ownWidth) await expectNoAxeViolations(page);
  }
}

test.describe('DEF-077: the Actions column of the queue stays visible (DL-357)', () => {
  test('Open tab: "Reassign or change deadline" is whole at every width, and a Tab through the row shows every control whole', async ({ page }, testInfo) => {
    const { code, owner } = await estimateInStatus(page, testInfo, 'DRAFT');
    await moveDeadlineIntoThePast(owner.id);
    await atEveryWidth(page, testInfo.project.name, 'open', code, async (row, holder) => {
      const action = row.getByRole('link', { name: `Reassign or change deadline, ${code}` });
      await expect(action).toBeVisible();
      await expectWhole('Reassign or change deadline', action, holder);
      expect.soft(await isOnTop(action), 'nothing covers the action').toBe(true);
      await expectEveryControlShown(page, row, code, action);
    });
  });

  test('Closed tab: the word "Closed" and the whole Downloaded chip (last person and time) are inside the region at every width', async ({ page }, testInfo) => {
    const estimate = await approvedEstimate(page, testInfo);
    const answer = await withExportTurn(() => page.request.get(`/api/v1/estimates/${estimate.owner.id}/export`));
    expect(answer.status(), 'the download').toBe(200);
    await atEveryWidth(page, testInfo.project.name, 'closed', estimate.code, async (row, holder) => {
      const closed = row.locator('[data-closed-action]');
      await expect(closed).toHaveText('Closed');
      await expectWhole('the word Closed', closed, holder);
      const chip = row.locator(CHIP);
      await expect(chip).toContainText('Downloaded 1×');
      await expect(chip).toContainText('Last downloaded by');
      await expectWhole('the Downloaded chip', chip, holder);
      expect.soft(await isOnTop(chip), 'nothing covers the chip').toBe(true);
    });
  });

  test('Ignored tab: "Open to restore" is whole at every width, and a Tab through the row shows every control whole', async ({ page }, testInfo) => {
    const { code, owner } = await estimateInStatus(page, testInfo, 'DRAFT');
    expect(await ignoreThroughTheApi(page, owner.id, 'Not taken forward because the customer chose another supplier.')).toBe(200);
    await atEveryWidth(page, testInfo.project.name, 'ignored', code, async (row, holder) => {
      const action = row.getByRole('link', { name: `Open to restore, ${code}` });
      await expect(action).toBeVisible();
      await expectWhole('Open to restore', action, holder);
      expect.soft(await isOnTop(action), 'nothing covers the action').toBe(true);
      await expectEveryControlShown(page, row, code, action);
    });
  });

  test('a table forced wider than its region: the Actions column stays at the right edge, opaque, with the overdue tint, and the first link ends clear of it', async ({ page }, testInfo) => {
    // The table is a table from 768 px; the cards below have no region to force.
    test.skip((page.viewportSize()?.width ?? 0) < TABLE_FROM, 'the cards of a phone have no table region');
    const { code, owner } = await estimateInStatus(page, testInfo, 'DRAFT');
    await moveDeadlineIntoThePast(owner.id);
    const row = await openTab(page, page.viewportSize()?.width ?? TABLE_FROM, 'open', code);
    const region = page.getByRole('region', { name: REGION_NAME });
    // The longest values each form accepts can widen the table without limit: force it, as the masters tables' test does.
    await region.evaluate((element) => {
      const table = element.querySelector('table');
      if (table !== null) table.style.minWidth = '2400px';
      element.scrollLeft = element.scrollWidth;
    });
    expect(await region.evaluate((element) => element.scrollLeft), 'the region scrolled').toBeGreaterThan(0);

    const holder = await holderOf(page, row);
    const cell = row.locator('td').last();
    const head = page.getByRole('columnheader', { name: 'Actions' });
    for (const target of [cell, head]) {
      const edges = defined((await edgesOfTree(target))[0]);
      expect(Math.abs(edges.right - holder.right), 'the Actions column ends at the region\'s right edge').toBeLessThanOrEqual(TOLERANCE);
      expect(isOpaque(await target.evaluate((element) => getComputedStyle(element).backgroundColor)), 'opaque').toBe(true);
    }
    // The overdue row's tint carries over to its Actions cell, so the row's colour is unbroken.
    const rowColour = await row.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(await cell.evaluate((element) => getComputedStyle(element).backgroundColor), 'the cell has the row\'s tint').toBe(rowColour);
    await expectWhole('Reassign or change deadline', row.getByRole('link', { name: `Reassign or change deadline, ${code}` }), holder);

    // The first link, focused while the region is scrolled to its end, ends in view and clear of the sticky column.
    await row.getByRole('link', { name: code, exact: true }).focus();
    const link = defined((await edgesOfTree(row.getByRole('link', { name: code, exact: true })))[0]);
    const cellEdges = defined((await edgesOfTree(cell))[0]);
    expect(link.left).toBeGreaterThanOrEqual(holder.left - TOLERANCE);
    expect(link.right).toBeLessThanOrEqual(cellEdges.left + TOLERANCE);
    await expectNoAxeViolations(page);
  });
});

function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('A box that must exist is missing.');
  return value;
}
