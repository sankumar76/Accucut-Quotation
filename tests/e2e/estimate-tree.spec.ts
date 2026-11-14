import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { defined } from '../support/defined';

import { createDisposableUser, E2E_PASSWORD, ensureCanaryCustomers, expectOnQueue, signInThroughThePage, useFreshAddress } from './support/auth';
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

const ALPHA = defined(CUSTOMER_CANARIES[0]).name;
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

async function signInAsNewEngineer(page: Page, testInfo: TestInfo): Promise<{ readonly id: string }> {
  await page.context().clearCookies();
  const person = await createDisposableUser('scan', testInfo);
  await page.goto('/sign-in');
  await signInThroughThePage(page, person.email, E2E_PASSWORD);
  await expectOnQueue(page, 'My tasks');
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

test.describe('AC-1, AC-2: adding, moving and renumbering', () => {
  test('AC-1, AC-2: New item, Sub-part and Part beside add parts and number them 1, 1.1, 1.2, 2; Move up renumbers and says so', async ({ page }, testInfo) => {
    await openTree(page, testInfo);
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
    await expect(page.getByText('Part renumbered to 1.1')).toHaveCount(1);
    await expect(action(page, 'Move up')).toBeFocused();
    await expect(part(page, '1.1')).toHaveAttribute('aria-selected', 'true');
    // At the top of its group it cannot go further: the button says so and keeps focus.
    await expect(action(page, 'Move up')).toHaveAttribute('aria-disabled', 'true');

    // Down again.
    await action(page, 'Move down').click();
    await expect(page.getByText('Part renumbered to 1.2')).toHaveCount(1);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2', '2']);

    // The numbers come from the server: they are the same after a reload.
    await page.reload();
    await showTree(page);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2', '2']);
  });

  test('AC-2: the tree is a tree: levels, positions and the selected part are in the markup, and the arrow keys, Home, End and Alt with arrows work', async ({ page }, testInfo) => {
    await openTree(page, testInfo);
    await part(page, '1').click();
    await action(page, 'Sub-part').click();
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
    await expect(page.getByText('Part renumbered to 1')).toHaveCount(1);
    await expect.poll(() => slNumbers(page)).toEqual(['1', '2', '2.1']);
  });
});

test.describe('AC-3: delete asks first and names the count', () => {
  test('AC-3: a part with 2 sub-parts: the dialog names 3 parts and Cancel is the safe choice; Cancel changes nothing; confirming deletes all three', async ({ page }, testInfo) => {
    await openTree(page, testInfo);
    await part(page, '1').click();
    await action(page, 'Sub-part').click();
    await action(page, 'Sub-part').click();
    await expect.poll(() => slNumbers(page)).toEqual(['1', '1.1', '1.2']);

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

    await action(page, 'Delete').click();
    await dialog.getByRole('button', { name: 'Delete 3 parts' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('3 parts deleted')).toHaveCount(1);
    await expect(page.getByText('No parts yet. Choose "New item" to add the first one.')).toBeVisible();
    await page.reload();
    await showTree(page);
    await expect(page.getByText('No parts yet. Choose "New item" to add the first one.')).toBeVisible();
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
