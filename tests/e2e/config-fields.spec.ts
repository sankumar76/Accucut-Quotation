import { expect, test, type Locator, type Page } from '@playwright/test';

import { expectNoAxeViolations, horizontalOverflow, TABLET_MIN_WIDTH, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, SIGNED_IN_STATE } from './support/servers';

/**
 * STORY-08.01 T7 (AC-1, AC-2, AC-3, AC-4, AC-7, AC-8): SCR-17 "Fields and formulas" at 360x800, 768x1024 and 1366x768 on the development server, as the E2E Admin and the E2E
 * Lead (the saved browser states of the set-up project). The words are the UX spec's and the story's, written out here and not imported. The Engineer's refusal of the page and of both
 * routes, and that no formula or rate name is in anything an Engineer is sent or loads, is the canary scan (`canary-scan.spec.ts`), which iterates the route manifest.
 *
 * What is checked: the table from 768 px and the cards below it, in column order; Scrap Weight and the estimate total as the story words them, with the sentence; the System tags;
 * the search by letter, name and formula and the kind filter; the Lead's banner and no action for either role; the skeleton and the error with "Try again"; no sideways scroll of the
 * page (the table scrolls inside a named, focusable region); axe 0 violations; controls of 44 px; the page by keyboard.
 */

const TITLE = 'Fields and formulas';
const SCRAP_WEIGHT_FORMULA = 'IF(Material-Specific-Gravity > 0, M - N, 0)';
const TOTAL_SENTENCE = "The estimate total is the sum of every row's BG. Each row's count is typed for the whole order, so nothing is multiplied by the rows above.";
const ERROR_TITLE = 'We could not load the fields and formulas';

/** The row (table row or phone card, whichever the width shows) of a column letter. */
function rowOf(page: Page, letter: string): Locator {
  return page.locator('[data-field-id]:visible').filter({ has: page.getByText(`Excel column ${letter}`, { exact: true }) });
}

async function openFields(page: Page): Promise<void> {
  await page.goto('/config/fields');
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await waitUntilHydrated(page, '#field-kind', 'onChange');
  await expect(page.locator('[data-field-id]:visible').first()).toBeVisible();
}

function isTabletOrWider(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= TABLET_MIN_WIDTH;
}

test.describe('the Admin', () => {
  test.use({ storageState: ADMIN_STATE });

  test('AC-1, AC-2, AC-3, AC-8: lists the fields in column order, with Scrap Weight, the total and its sentence, the System tags and no action; no sideways scroll, axe 0', async ({ page }) => {
    await openFields(page);
    await expect(page.getByText('View only')).toHaveCount(0);

    // Column order: the first rows are A, B, C, D, and a letter is read as "Excel column <letter>" by a screen reader.
    const rows = page.locator('[data-field-id]:visible');
    for (const [index, letter] of ['A', 'B', 'C', 'D'].entries()) await expect(rows.nth(index)).toContainText(`Excel column ${letter}`);

    await expect(rowOf(page, 'O')).toContainText(SCRAP_WEIGHT_FORMULA);
    const total = rowOf(page, 'BL');
    await expect(total).toContainText('SUM(BG)');
    await expect(total).toContainText(TOTAL_SENTENCE);
    for (const letter of ['A', 'H', 'BG', 'BL', 'BM', 'BO']) await expect(rowOf(page, letter)).toContainText('System');
    await expect(rowOf(page, 'AL')).not.toContainText('System');
    await expect(rowOf(page, 'F')).toContainText('No formula');

    // BH and BI are outputs, not auto fields (UX-26).
    await expect(rowOf(page, 'BH')).toContainText('Output');
    await expect(page.getByRole('button', { name: /Edit formula|Delete|Insert/ })).toHaveCount(0);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-8: a table from 768 px that scrolls in a named, focusable region and never the page, and cards on a phone', async ({ page }) => {
    await openFields(page);
    if (isTabletOrWider(page)) {
      const region = page.getByRole('region', { name: 'Fields and formulas, scrollable' });
      await expect(region).toBeVisible();
      await region.focus();
      await expect(region).toBeFocused();
      await expect(page.getByRole('list', { name: 'Fields and formulas' })).toBeHidden();
    } else {
      await expect(page.getByRole('list', { name: 'Fields and formulas' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Fields and formulas, scrollable' })).toBeHidden();
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('AC-1, AC-8: searches by letter, name and formula, filters by kind, and says so when nothing matches; the controls are 44 px and work by keyboard', async ({ page }) => {
    await openFields(page);
    const search = page.getByLabel('Search');
    const kind = page.getByLabel('Show');
    for (const control of [search, kind]) expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);

    await search.fill('Scrap');
    await expect(rowOf(page, 'O')).toBeVisible();
    await expect(rowOf(page, 'AL')).toHaveCount(0);

    await search.fill('Cutting-Rate');
    await expect(rowOf(page, 'AL')).toBeVisible();
    await expect(rowOf(page, 'O')).toHaveCount(0);

    await search.fill('SUM(BG)');
    await expect(rowOf(page, 'BL')).toBeVisible();

    await search.fill('');
    await kind.selectOption('input');
    await expect(rowOf(page, 'E')).toBeVisible();
    await expect(rowOf(page, 'AL')).toHaveCount(0);
    await kind.selectOption('output');
    await expect(rowOf(page, 'AL')).toBeVisible();
    await expect(rowOf(page, 'E')).toHaveCount(0);

    await search.fill('no-such-field-anywhere');
    await expect(page.getByRole('heading', { name: 'No field matches "no-such-field-anywhere"' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('');
    await expect(kind).toHaveValue('all');
    await expect(rowOf(page, 'A')).toBeVisible();
  });

  test('AC-7: shows the skeleton while the list is read, and the error with "Try again" when it cannot be', async ({ page }) => {
    let fail = true;
    await page.route('**/api/v1/config/fields', async (route) => {
      if (fail) await route.fulfill({ status: 500, contentType: 'application/problem+json', body: JSON.stringify({ title: 'Something went wrong on our side' }) });
      else await route.continue();
    });
    await page.goto('/config/fields');
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByRole('heading', { name: ERROR_TITLE })).toBeVisible();
    await expect(page.getByRole('heading', { name: ERROR_TITLE })).toBeFocused();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(rowOf(page, 'A')).toBeVisible();
    await expect(page.getByRole('heading', { name: ERROR_TITLE })).toHaveCount(0);
  });
});

test.describe('the Lead', () => {
  test.use({ storageState: SIGNED_IN_STATE });

  test('AC-4: sees the same table under "View only. Formulas are shown so you can check the arithmetic.", with no action, and the side menu marks it view only', async ({ page }) => {
    await openFields(page);
    const banner = page.getByText('Formulas are shown so you can check the arithmetic.');
    await expect(banner).toBeVisible();
    await expect(page.getByText('View only.')).toBeVisible();
    await expect(rowOf(page, 'O')).toContainText(SCRAP_WEIGHT_FORMULA);
    await expect(rowOf(page, 'BL')).toContainText(TOTAL_SENTENCE);
    await expect(page.getByRole('button', { name: /Edit formula|Delete|Insert/ })).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-4: the page can be reached from the menu under its own name, and the menu says it is view only', async ({ page }) => {
    await page.goto('/queue');
    await expect(page.getByRole('heading', { level: 1, name: 'Task queue' })).toBeVisible();
    const response = await page.request.get('/api/v1/me');
    const me: unknown = await response.json();
    const labels = typeof me === 'object' && me !== null && 'navigation' in me && Array.isArray(me.navigation) ? me.navigation.map((item: { label?: string }) => item.label) : [];
    expect(labels).toContain('Fields and formulas (view only)');
  });
});
