import { expect, test, type Locator, type Page } from '@playwright/test';

import { useFreshAddress } from './support/auth';
import { waitUntilHydrated } from './support/design-system';
import { isPhone, openForm, showTree, tree } from './support/part-form';

/**
 * AQP-449 (DEF-092, option A; ux-expert ruling 2026-11-26, MENU-1 and MENU-3): the Part item of the "+" menu reads "Part" when the row holds no Part and "Sub-part" when it already holds one, and the row it adds
 * is named the same, at 360x800, 768x1024 and 1366x768. Two small cases, each a person of its own with the one Main Assembly of the recipe (`tests/support/estimate-recipe.ts`) and two additions, so each runs in the
 * default time (DL-370 (5)); nothing waits on a clock. The words are the ruling's, written out here and not imported, so a changed sentence fails a test. The other rules of the menu are judged in
 * `tests/unit/add-node-menu-sub-part.test.ts` and, for the whole tree, in `estimate-tree.spec.ts`. Every name is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const PART_HINT = 'The first part under this row. A second one is called "Sub-part"';
const SUB_PART_HINT = 'A part is already here, so both are called "Sub-part"';

/** A row of the tree by its Sl. No: its link, whose text carries the number marked `data-sl-no`. */
const row = (page: Page, slNo: string): Locator =>
  tree(page).getByRole('link').filter({ has: page.locator('[data-sl-no]', { hasText: new RegExp(`^${slNo.replaceAll('.', '\\.')}$`) }) });

/** The "+" of a row that opens a menu: its name starts with "Add under" and the row's number. In view on the open row, so the row is chosen first, as a person does. */
async function openMenuOf(page: Page, slNo: string): Promise<void> {
  await row(page, slNo).click();
  await tree(page).getByRole('button', { name: new RegExp(`^Add under ${slNo.replaceAll('.', '\\.')} `) }).click();
  await expect(page.getByRole('menu')).toBeVisible();
}

/** The name of the kind of a row as its icon says it (the spoken name and the tooltip of the icon). */
const kindOf = (page: Page, slNo: string): Locator => row(page, slNo).getByRole('img');

async function openTheTree(page: Page, testInfo: Parameters<typeof openForm>[1]): Promise<void> {
  await openForm(page, testInfo);
  // The page's scripts are live, so a click is not lost (DEF-011): on a phone the Parts tree button, from 768 px the first part of the tree.
  if (isPhone(page)) await waitUntilHydrated(page, 'button[data-early-intent="parts-tree"]', 'onClick');
  else await waitUntilHydrated(page, 'nav[aria-label="Parts tree"] a[data-part-id]', 'onClick');
  await showTree(page);
  await expect(row(page, '1')).toBeVisible();
}

test.describe('AQP-449: the "+" menu names the Part item for what the person will get', () => {
  test('a Main Assembly: "Part" while it holds none, "Sub-part" once it holds one, and the row added is named as the item was', async ({ page }, testInfo) => {
    await openTheTree(page, testInfo);

    // No Part under row 1: one item "Part", never "Sub-part"; the header says which row; the hints are the ruling's.
    await openMenuOf(page, '1');
    await expect(page.getByRole('menuitem')).toHaveCount(3);
    await expect(page.getByRole('menuitem').nth(0)).toHaveAccessibleName('Sub-Assembly');
    await expect(page.getByRole('menuitem').nth(1)).toHaveAccessibleName('Part');
    await expect(page.getByRole('menuitem').nth(1)).toHaveAccessibleDescription(PART_HINT);
    await expect(page.getByRole('menuitem').nth(1)).toContainText(PART_HINT);
    await expect(page.getByRole('menuitem').nth(2)).toHaveAccessibleName('Fastener');
    await expect(page.getByRole('menu')).toContainText(/^Add under 1 /);
    await expect(page.getByRole('menuitem', { name: 'Sub-part', exact: true })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Part', exact: true }).click();
    await expect(row(page, '1.1')).toBeVisible();
    await expect(kindOf(page, '1.1')).toHaveAccessibleName('Part');

    // One Part under row 1: the same item now reads "Sub-part" (visible and spoken), and adds a Part that is named so; the first Part is renamed with it.
    await openMenuOf(page, '1');
    await expect(page.getByRole('menuitem')).toHaveCount(3);
    await expect(page.getByRole('menuitem').nth(1)).toHaveAccessibleName('Sub-part');
    await expect(page.getByRole('menuitem').nth(1)).toHaveText(`Sub-part${SUB_PART_HINT}`);
    await expect(page.getByRole('menuitem').nth(1)).toHaveAccessibleDescription(SUB_PART_HINT);
    await expect(page.getByRole('menuitem', { name: 'Part', exact: true })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Sub-part', exact: true }).click();
    await expect(row(page, '1.2')).toBeVisible();
    await expect(kindOf(page, '1.2')).toHaveAccessibleName('Sub-part');
    await expect(kindOf(page, '1.1')).toHaveAccessibleName('Sub-part');
  });

  test('a Sub-Assembly: the same item reads "Part", then "Sub-part", and a Part of a deeper row does not count for its parent', async ({ page }, testInfo) => {
    await openTheTree(page, testInfo);
    await openMenuOf(page, '1');
    await page.getByRole('menuitem', { name: 'Sub-Assembly', exact: true }).click();
    await expect(row(page, '1.1')).toBeVisible();

    // Row 1 holds a Sub-Assembly and no Part, so its own menu still says "Part"; the Sub-Assembly's menu has two items, the Part first.
    await openMenuOf(page, '1.1');
    await expect(page.getByRole('menuitem')).toHaveCount(2);
    await expect(page.getByRole('menuitem').nth(0)).toHaveAccessibleName('Part');
    await expect(page.getByRole('menuitem').nth(0)).toContainText(PART_HINT);
    await expect(page.getByRole('menuitem').nth(1)).toHaveAccessibleName('Fastener');
    await expect(page.getByRole('menu')).toContainText(/^Add under 1\.1 /);
    await page.getByRole('menuitem', { name: 'Part', exact: true }).click();
    await expect(row(page, '1.1.1')).toBeVisible();
    await expect(kindOf(page, '1.1.1')).toHaveAccessibleName('Part');

    await openMenuOf(page, '1.1');
    await expect(page.getByRole('menuitem').nth(0)).toHaveAccessibleName('Sub-part');
    await expect(page.getByRole('menuitem').nth(0)).toHaveText(`Sub-part${SUB_PART_HINT}`);
    await expect(page.getByRole('menuitem', { name: 'Part', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem')).toHaveCount(0);

    // Row 1 holds the Sub-Assembly only, still no Part: its item is "Part" (the Part under 1.1 is not its child).
    await openMenuOf(page, '1');
    await expect(page.getByRole('menuitem').nth(1)).toHaveAccessibleName('Part');
  });
});
