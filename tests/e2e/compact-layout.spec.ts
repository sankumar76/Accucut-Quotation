import { expect, test, type Locator } from '@playwright/test';

import { useFreshAddress } from './support/auth';
import { calculateWithoutThePage, engineerWithEstimate, signInAsLead } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow, widthOf } from './support/design-system';
import { control, expectFormAccessible, leastFieldHeight, openForm, partForm } from './support/part-form';

/**
 * AQP-388 (CR-01 item 1; UX spec section 0.9 row 1): the compact input and output screens, SCR-05 (the part form), SCR-06 (the review) and SCR-07 (the cost details), measured at the three widths of
 * the projects (360x800 with touch, 768x1024 with touch, 1366x768 with a mouse). The numbers are the story's: a card's padding is 12 px and its header 8 px by 12 px, the gaps are 12 px, fields flow in
 * columns of 140 px at least, a field is 36 px high from 1024 px with a fine pointer and 44 px below that or for a finger, a multi-line box is 60 px at least, the tiles are 12 px by 16 px, a figure box is
 * 8 px by 12 px, a stage row and a stage summary are 8 px by 12 px. The cards share a row from 768 px and stack below it; no two cards overlap; the page has no sideways scroll; axe finds nothing.
 * One control, the filter of the audit log (an unchanged screen), keeps its 44 px at every width. The weight of a card and the scope of the rules are `tests/unit/compact-layout.test.ts`.
 * The existing estimate specs run unchanged. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const FINE_POINTER_MIN_WIDTH = 1024;
const SIDE_BY_SIDE_MIN_WIDTH = 768;
const TOUCH_FIELD = 44;
const COLUMN_MINIMUM = 140;
const PADDING_STEP = 12;
const GAP = 12;
/** Sub-pixel layout: sizes are compared within one pixel. */
const TOLERANCE = 1;

interface Sides {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** The padding of an element, in pixels, as the browser computes it. */
async function paddingOf(target: Locator): Promise<Sides> {
  return target.evaluate((element) => {
    const style = getComputedStyle(element);
    return { top: parseFloat(style.paddingTop), right: parseFloat(style.paddingRight), bottom: parseFloat(style.paddingBottom), left: parseFloat(style.paddingLeft) };
  });
}

async function heightOf(target: Locator): Promise<number> {
  return target.evaluate((element) => element.getBoundingClientRect().height);
}

function expectSides(actual: Sides, expected: { readonly vertical: number; readonly horizontal: number }, why: string): void {
  expect(actual.top, `${why}: top`).toBeCloseTo(expected.vertical, 0);
  expect(actual.bottom, `${why}: bottom`).toBeCloseTo(expected.vertical, 0);
  expect(actual.left, `${why}: left`).toBeCloseTo(expected.horizontal, 0);
  expect(actual.right, `${why}: right`).toBeCloseTo(expected.horizontal, 0);
}

test.describe('AC-1 to AC-5, AC-8, AC-9: SCR-05, the part form', () => {
  test('AC-1 to AC-5: cards side by side from 768 px and stacked below, 12 px padding and gaps, columns of 140 px at least, fields 36 px (fine pointer from 1024 px) or 44 px, no overlap, no scroll, axe clean', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const cards = partForm(page).locator('[data-part-grid] > [role="region"]');
    expect(await cards.count(), 'the eight section cards').toBe(8);

    // AC-4: the padding of a card's body is 12 px, its header 8 px by 12 px, and the gap of the cards and of the fields is 12 px.
    const first = cards.first();
    expectSides(await paddingOf(first.locator('[data-slot="card-content"]')), { vertical: PADDING_STEP, horizontal: PADDING_STEP }, 'card body');
    expectSides(await paddingOf(first.locator('[data-slot="card-header"]')), { vertical: 8, horizontal: PADDING_STEP }, 'card header');
    expect(await partForm(page).locator('[data-part-grid]').evaluate((grid) => getComputedStyle(grid).gap)).toBe(`${GAP}px`);
    expect(await first.locator('[data-slot="card-content"]').evaluate((body) => getComputedStyle(body).gap)).toBe(`${GAP}px`);

    // AC-1: side by side from 768 px (some two cards share a row), one to a row below it (every card is as wide as the form).
    const boxes = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, right: box.right, bottom: box.bottom };
      }),
    );
    const formWidth = await partForm(page).evaluate((form) => form.getBoundingClientRect().width);
    if ((await widthOf(page)) >= SIDE_BY_SIDE_MIN_WIDTH) {
      const rows = new Set(boxes.map((box) => Math.round(box.y)));
      expect(rows.size, 'fewer rows than cards: cards share a row').toBeLessThan(boxes.length);
    } else {
      for (const box of boxes) expect(Math.abs(box.width - formWidth), 'a card is as wide as the form').toBeLessThanOrEqual(TOLERANCE);
    }
    // AC-8: no two cards overlap.
    for (const [index, one] of boxes.entries()) {
      for (const other of boxes.slice(index + 1)) {
        const apart = one.right <= other.x + TOLERANCE || other.right <= one.x + TOLERANCE || one.bottom <= other.y + TOLERANCE || other.bottom <= one.y + TOLERANCE;
        expect(apart, `cards ${index} and the next ones do not overlap`).toBe(true);
      }
    }

    // AC-3: every column of every card's fields is 140 px wide at least.
    const columns = await cards.evaluateAll((elements) =>
      elements.flatMap((element) => getComputedStyle(element.querySelector('[data-slot="card-content"]') ?? element).gridTemplateColumns.split(' ').map(parseFloat)),
    );
    expect(columns.length).toBeGreaterThan(0);
    for (const column of columns) expect(column).toBeGreaterThanOrEqual(COLUMN_MINIMUM - TOLERANCE);
    // AQP-458 (DEF-101; the mock-up): at every width, including 360 px, a card with two fields or more flows them two to a row (two columns at least), never one to a row.
    const fieldCounts = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const body = element.querySelector('[data-slot="card-content"]') ?? element;
        return { fields: body.querySelectorAll('input:not([type=hidden]), select, [role="combobox"]').length, columns: getComputedStyle(body).gridTemplateColumns.split(' ').length };
      }),
    );
    const twoOrMore = fieldCounts.filter((card) => card.fields >= 2);
    expect(twoOrMore.length, 'cards with two fields or more').toBeGreaterThan(0);
    for (const card of twoOrMore) expect(card.columns, 'columns of a card with two fields or more').toBeGreaterThanOrEqual(2);

    // AC-5: a typed box, a list and a read-only output; a multi-line box is 60 px at least.
    const fieldHeight = await leastFieldHeight(page);
    for (const letter of ['B', 'E', 'A']) expect(await heightOf(control(page, letter)), `field ${letter}`).toBeCloseTo(fieldHeight, 0);
    expect(await partForm(page).locator('textarea').first().evaluate((box) => parseFloat(getComputedStyle(box).minHeight))).toBeCloseTo(60, 0);

    // AC-8, AC-9: no sideways scroll; axe finds nothing.
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectFormAccessible(page);
  });
});

test.describe('AC-5: a touch screen 1024 px or wider keeps 44 px (NFR-017)', () => {
  // A landscape tablet: 1280 px wide, a finger for a pointer. The width alone must not make a field 36 px (UX ruling OQ-PM-12, DL-289). The test sets its own width and touch, so it reads the same in every project (it is not an own-width file: no skip by project).
  test.use({ hasTouch: true, viewport: { width: 1280, height: 800 } });

  test('AC-5: at 1280 px with a coarse pointer the fields of SCR-05 are 44 px high, not 36 px', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches), 'the context has a coarse pointer').toBe(true);
    expect(await widthOf(page)).toBeGreaterThanOrEqual(FINE_POINTER_MIN_WIDTH);
    for (const letter of ['B', 'E', 'A']) expect(await heightOf(control(page, letter)), `field ${letter}`).toBeCloseTo(TOUCH_FIELD, 0);
  });
});

test.describe('AC-6, AC-8, AC-9: SCR-06 and SCR-07, the review and the cost details', () => {
  test('AC-6: the tiles are 12 px by 16 px and 12 px apart, the figure box 8 px by 12 px, a stage row and a stage summary 8 px by 12 px; no sideways scroll; axe clean', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await signInAsLead(page, testInfo);

    await page.goto(`/estimates/${code}`);
    const tiles = page.getByRole('region', { name: 'Totals' });
    await expect(tiles).toBeVisible();
    expectSides(await paddingOf(tiles.locator('[data-slot="card-content"]').first()), { vertical: PADDING_STEP, horizontal: 16 }, 'figure tile');
    expect(await tiles.evaluate((grid) => getComputedStyle(grid).gap)).toBe(`${GAP}px`);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    await page.goto(`/estimates/${code}/costs/1`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cost details');
    const stage = page.locator('details[data-stage="1"]');
    await expect(stage).toBeVisible();
    expectSides(await paddingOf(page.locator('main [data-slot="card-content"]').last()), { vertical: 8, horizontal: PADDING_STEP }, 'figure box');
    expectSides(await paddingOf(stage.locator('summary')), { vertical: 8, horizontal: PADDING_STEP }, 'stage summary');
    if ((await stage.getAttribute('open')) === null) await stage.locator('summary').click();
    expectSides(await paddingOf(stage.locator('li').first()), { vertical: 8, horizontal: PADDING_STEP }, 'stage row');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});

test.describe('AC-7: a screen that is not compact is unchanged', () => {
  test('AC-7: the filter list of the audit log is 44 px high and its page is not in the compact scope, at every width', async ({ page }, testInfo) => {
    await signInAsLead(page, testInfo, 'ADMIN');
    await page.goto('/audit');
    const list = page.locator('[data-slot="native-select"]').first();
    await expect(list).toBeVisible();
    expect(await heightOf(list)).toBeCloseTo(TOUCH_FIELD, 0);
    expect(await page.locator('.is-compact').count()).toBe(0);
  });
});
