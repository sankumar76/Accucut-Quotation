import { expect, test, type Locator, type Page } from '@playwright/test';

import { useFreshAddress } from './support/auth';
import { expectNoAxeViolations, waitUntilHydrated } from './support/design-system';
import { isPhone, openForm, showTree, tree } from './support/part-form';

/**
 * AQP-449 (DEF-092, option A; ux-expert ruling 2026-11-26, MENU-1 and MENU-3): the Part item of the "+" menu reads "Part" when the row holds no Part and "Sub-part" when it already holds one, and the row it adds
 * is named the same, at 360x800, 768x1024 and 1366x768. The same case judges where the menu is (AQP-451, DEF-094): in line under its row, inside the tree and its drawer, not floating over the tree's head or the form. One small case, a person of its own with the one Main Assembly of the recipe (`tests/support/estimate-recipe.ts`) and two additions, so it runs in the
 * default time (DL-370 (5)); nothing waits on a clock. The words are the ruling's, written out here and not imported, so a changed sentence fails a test. The Sub-Assembly menu, the header, the hints and the 0, 1 and 2 Parts
 * rule are judged in `tests/unit/add-node-menu-sub-part.test.ts`, and the menus of the whole tree in `estimate-tree.spec.ts`. Every name is invented.
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
  // A press on a row in the phone drawer opens it and shuts the drawer (AQP-490, DEF-133): the drawer is opened again, and the row, still the open one, shows its toolbar.
  if (isPhone(page)) {
    await expect(tree(page)).toBeHidden();
    await showTree(page);
  }
  await tree(page).getByRole('button', { name: new RegExp(`^Add under ${slNo.replaceAll('.', '\\.')} `) }).click();
  await expect(page.getByRole('menu')).toBeVisible();
}

/** The name of the kind of a row as its icon says it (the spoken name and the tooltip of the glyph, the one mark of the kind in the row). */
const kindOf = (page: Page, slNo: string): Locator => row(page, slNo).locator('[data-node-kind]');

/**
 * The open menu is in line under its row (UX spec section 0.9 row 3; the ux-expert's check C-05-02): inside the tree (so inside the drawer on a phone), a block in the flow (its positioning element is not `fixed`),
 * below the row it belongs to and not wider than the tree, with no accessibility violation while it is open.
 */
async function expectInLineUnder(page: Page, slNo: string): Promise<void> {
  const menu = tree(page).getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('xpath=..')).toHaveCSS('position', 'static');
  const [rowBox, menuBox, treeBox] = await Promise.all([row(page, slNo).boundingBox(), menu.boundingBox(), tree(page).boundingBox()]);
  if (rowBox === null || menuBox === null || treeBox === null) throw new Error('a box is missing');
  expect(menuBox.y).toBeGreaterThanOrEqual(rowBox.y + rowBox.height - 1);
  expect(menuBox.x).toBeGreaterThanOrEqual(treeBox.x - 1);
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(treeBox.x + treeBox.width + 1);
  await expectNoAxeViolations(page);
}

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
    await expectInLineUnder(page, '1');
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
});
