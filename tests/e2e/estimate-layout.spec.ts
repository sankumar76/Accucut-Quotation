import { expect, test, type Page } from '@playwright/test';

import { useFreshAddress } from './support/auth';
import { widthOf } from './support/design-system';
import { expectFormAccessible, openForm, partForm, tree } from './support/part-form';

/**
 * STORY-10.06 AC-1 to AC-4 (FR-087, NFR-023, UD-4; NFR-016 to 018): the reserved drawing region of SCR-05, the third track after the parts tree and the form, at the project's own width (360,
 * 768 and 1366 px) and, for the override, at 1280 and 1024 px. The product draws nothing into it and has no setting for it: the override below is a style on the root element, set by this test
 * only (assumption A-2), and no component changes. A unit test cannot read a viewport, so the widths are judged here; the structure (one element, empty, `aria-hidden`, no landmark) is
 * `tests/unit/estimate-workspace-region.test.ts`. The existing estimate specs run unchanged and are the proof that the strip, the sticky bar and the tree drawer behave as before.
 * The 340 px token is a number of the UX spec; every other number here is measured, not written, so a change of the shell's padding moves no assertion.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const LARGE_VIEWPORT = 1024;
const CARD_MINIMUM = 232;
const GAP = 16;
const TREE_WIDTH = 320;
const OVERRIDE = 340;
const HEIGHT = 900;
/** Sub-pixel layout: widths are compared within one pixel. */
const TOLERANCE = 1;

interface Measure {
  readonly overflow: number;
  readonly regionDisplay: string;
  readonly regionWidth: number;
  readonly regionLeft: number;
  readonly treeWidth: number;
  readonly treeRight: number;
  readonly formWidth: number;
  readonly formLeft: number;
  /** The distinct left edges of the section cards: the columns the grid uses. */
  readonly columns: number;
  readonly narrowestCard: number;
  readonly widestCardRight: number;
}

/** Everything the layout is judged by, read in one synchronous step so no frame falls between two values. */
async function measure(page: Page): Promise<Measure> {
  return page.evaluate(() => {
    const rect = (selector: string): DOMRect => (document.querySelector(selector) ?? document.body).getBoundingClientRect();
    const region = document.querySelector('[data-drawing-region]');
    const cards = [...document.querySelectorAll('[data-part-grid] > *')].map((card) => card.getBoundingClientRect());
    const treeBox = document.querySelector('[class*="w-(--tree-w)"]') ?? document.body;
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      regionDisplay: region === null ? 'missing' : getComputedStyle(region).display,
      regionWidth: rect('[data-drawing-region]').width,
      regionLeft: rect('[data-drawing-region]').left,
      treeWidth: treeBox.getBoundingClientRect().width,
      treeRight: treeBox.getBoundingClientRect().right,
      formWidth: rect('form[data-part-form]').width,
      formLeft: rect('form[data-part-form]').left,
      columns: new Set(cards.map((card) => Math.round(card.left))).size,
      narrowestCard: Math.min(...cards.map((card) => card.width)),
      widestCardRight: Math.max(...cards.map((card) => card.right)),
    };
  });
}

const setToken = (page: Page, value: string | null): Promise<void> =>
  page.evaluate((width) => (width === null ? document.documentElement.style.removeProperty('--drawing-region-width') : document.documentElement.style.setProperty('--drawing-region-width', width)), value).then(() => undefined);

/** The form's width with the region taken out of the layout altogether: what the page was before this story. */
async function formWidthWithoutRegion(page: Page): Promise<number> {
  return page.evaluate(() => {
    const region = document.querySelector<HTMLElement>('[data-drawing-region]');
    if (region === null) return -1;
    region.style.display = 'none';
    const width = document.querySelector('form[data-part-form]')?.getBoundingClientRect().width ?? -2;
    region.style.display = '';
    return width;
  });
}

test.describe('AC-1, AC-3, AC-4: the region at the width of the project', () => {
  test('AC-1, AC-3, AC-4: one empty region that nobody can read or reach, no space below 1024 px, no change at 1024 px and wider, no scroll, axe clean', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const region = page.locator('[data-drawing-region]');
    // AC-1: exactly one.
    await expect(region).toHaveCount(1);
    // AC-3: empty, hidden from assistive technology, no landmark, no role, no label, not focusable, nothing in it.
    await expect(region).toHaveAttribute('aria-hidden', 'true');
    expect(await region.evaluate((element) => ({ tag: element.tagName, role: element.getAttribute('role'), label: element.getAttribute('aria-label'), tabindex: element.getAttribute('tabindex'), text: element.textContent, children: element.childElementCount }))).toEqual({
      tag: 'DIV',
      role: null,
      label: null,
      tabindex: null,
      text: '',
      children: 0,
    });
    expect(await region.evaluate((element) => element.closest('aside') === null), 'inside no landmark of its own').toBe(true);

    const measured = await measure(page);
    if ((await widthOf(page)) < LARGE_VIEWPORT) {
      // AC-1: below 1024 px the region takes no space and is not in the accessibility tree: it has no box at all.
      expect(measured.regionDisplay, 'hidden by CSS below 1024 px').toBe('none');
      expect(measured.regionWidth).toBe(0);
      await expect(region).toBeHidden();
    } else {
      // AC-1: at 1024 px and wider the token is 0px: the region has a box of no width and the page is as it was: the tree is 320 px, the form follows it after one gap, and the zero-width
      // item took no gap of its own (the form is as wide as it is with the region out of the layout).
      expect(measured.regionDisplay).toBe('block');
      expect(measured.regionWidth).toBe(0);
      expect(measured.treeWidth).toBeCloseTo(TREE_WIDTH, 0);
      expect(measured.formLeft - measured.treeRight).toBeCloseTo(GAP, 0);
      expect(Math.abs(measured.formWidth - (await formWidthWithoutRegion(page)))).toBeLessThan(TOLERANCE);
      await expect(tree(page)).toBeVisible();
    }
    // AC-4: no horizontal scroll at 360, 768 and 1366 px, and axe finds nothing.
    expect(measured.overflow).toBeLessThanOrEqual(0);
    await expect(partForm(page)).toBeVisible();
    await expectFormAccessible(page);
  });
});

test.describe('AC-2: the token alone moves the form, at 1280 and 1024 px', () => {
  test('AC-2: a 340 px token takes 340 px and one gap from the form with no component changed; the cards keep at least 232 px; no scroll, no overlap, at 1280 and 1024 px', async ({ page }, testInfo) => {
    await openForm(page, testInfo);

    await page.setViewportSize({ width: 1280, height: HEIGHT });
    await expect(tree(page)).toBeVisible();
    const before = await measure(page);
    expect(before.regionWidth, 'the token is 0px in the product').toBe(0);
    expect(before.overflow).toBeLessThanOrEqual(0);

    await setToken(page, `${OVERRIDE}px`);
    const wide = await measure(page);
    expect(wide.regionWidth, 'the region has its whole width at 1280 px').toBeCloseTo(OVERRIDE, 0);
    // The form gives up exactly the region and the gap that now separates them: the margin that cancelled the gap at 0px is gone.
    expect(before.formWidth - wide.formWidth).toBeCloseTo(OVERRIDE + GAP, 0);
    expect(wide.treeWidth).toBeCloseTo(TREE_WIDTH, 0);
    expect(wide.columns, 'the section cards re-flow into fewer columns').toBeLessThan(before.columns);
    expect(wide.narrowestCard).toBeGreaterThanOrEqual(CARD_MINIMUM - TOLERANCE);
    expect(wide.widestCardRight, 'no card overlaps the region').toBeLessThanOrEqual(wide.regionLeft + TOLERANCE);
    expect(wide.overflow, 'no horizontal page scroll at 1280 px').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: LARGE_VIEWPORT, height: HEIGHT });
    await expect(tree(page)).toBeVisible();
    const narrow = await measure(page);
    expect(narrow.regionDisplay).toBe('block');
    expect(narrow.regionWidth, 'the region is held to what the tree and one card leave').toBeLessThanOrEqual(OVERRIDE);
    expect(narrow.narrowestCard, 'at 1024 px the cards stay at least 232 px wide').toBeGreaterThanOrEqual(CARD_MINIMUM - TOLERANCE);
    expect(narrow.columns, 'one or two columns').toBeLessThanOrEqual(2);
    expect(narrow.widestCardRight, 'no card overlaps the region').toBeLessThanOrEqual(narrow.regionLeft + TOLERANCE);
    expect(narrow.overflow, 'no horizontal page scroll at 1024 px').toBeLessThanOrEqual(0);

    // Taking the override away puts the page back as it was: the same form width at 1024 px with the region at 0px.
    await setToken(page, null);
    const restored = await measure(page);
    expect(restored.regionWidth).toBe(0);
    expect(Math.abs(restored.formWidth - (await formWidthWithoutRegion(page)))).toBeLessThan(TOLERANCE);
  });
});
