import { expect, test, type Page, type Route } from '@playwright/test';

import { canaryTaskCodeFor } from '../support/estimate-recipe';

import { ensureCanaryCustomers, ensureCanaryMaterials, useFreshAddress } from './support/auth';
import { waitUntilHydrated } from './support/design-system';
import { ScriptGate, SLOW_OPEN_WAIT_MILLISECONDS, SLOW_REQUEST_MILLISECONDS } from './support/lazy-load';
import { isPhone, openForm, partForm, signInAsNewEngineer, waitForForm } from './support/part-form';

/**
 * STORY-05.13 (AQP-339, ADR-016 E1): what `/estimates/[code]` fetches after the first load, at 360x800, 768x1024 and 1366x768 on the development server. The phone's tree drawer is fetched
 * when "Parts tree" is first pressed (AC-2, AC-3), and the part form's fields are fetched when the form is on the page (AC-4). A `ScriptGate` holds, delays or fails the page's scripts to
 * reach the slow and failed paths. The words are the story's and the UX spec's, written out here and not imported. What the form and the tree do once loaded is judged in
 * `estimate-form.spec.ts` and `estimate-tree.spec.ts`, which run unchanged (AC-8, with SQR-11: Enter on a part puts focus on the first field). Every name is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const DRAWER_FAILURE = 'The parts tree did not open. Check your connection and try again.';
const FORM_FAILURE_TITLE = 'We could not load the form';
const TREE_BUTTON = /^Parts tree/;
const DRAWER_BUTTON_SELECTOR = 'button[data-early-intent="parts-tree"]';

const drawer = (page: Page) => page.getByRole('dialog', { name: 'Parts tree' });
const drawerButton = (page: Page) => page.getByRole('button', { name: TREE_BUTTON });

/** Opens a draft estimate with the customer chosen, on a gate that lets every script through until a test says otherwise, and waits for the "Parts tree" button to be live. Phone only. */
async function openFormOnAPhone(page: Page, gate: ScriptGate, testInfo: Parameters<typeof openForm>[1]): Promise<void> {
  test.skip(!isPhone(page), 'The tree is a drawer below 768 px only');
  await gate.install(page);
  await openForm(page, testInfo);
  await waitUntilHydrated(page, DRAWER_BUTTON_SELECTOR, 'onClick');
}

test.describe('AC-4: the part form fetches its fields', () => {
  // Since CR-01 item 6 (AQP-390) there is no "choose the customer first" step: the part form is on the page from the first paint, so it asks for its fields at once. The failed and the slow
  // paths are reached through the one request that decides them, the form's definition, which is answered here the way a failing and a slow network would answer it.
  test('AC-4: when the fields cannot be fetched the notice offers "Try again", and pressing it brings the fields', async ({ page }, testInfo) => {
    await ensureCanaryCustomers();
    await ensureCanaryMaterials();
    const owner = await signInAsNewEngineer(page, testInfo);
    const refuse = (route: Route) => route.abort('failed');
    await page.route('**/api/v1/estimates/*/form', refuse);
    await page.goto(`/estimates/${canaryTaskCodeFor(owner.id)}`);
    await expect(page.getByText(FORM_FAILURE_TITLE)).toBeVisible();
    await expect(partForm(page)).toHaveCount(0);

    await page.unroute('**/api/v1/estimates/*/form', refuse);
    await page.getByRole('button', { name: 'Try again' }).click();
    await waitForForm(page);
    await expect(page.getByText(FORM_FAILURE_TITLE)).toHaveCount(0);
  });

  test('AC-4: while the fields are on their way the skeleton shows as a status, then the fields take its place', async ({ page }, testInfo) => {
    await ensureCanaryCustomers();
    await ensureCanaryMaterials();
    const owner = await signInAsNewEngineer(page, testInfo);
    await page.route('**/api/v1/estimates/*/form', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, SLOW_REQUEST_MILLISECONDS));
      await route.continue();
    });
    await page.goto(`/estimates/${canaryTaskCodeFor(owner.id)}`);
    await expect(page.getByRole('status', { name: 'Loading the form' })).toBeVisible();
    await expect(partForm(page)).toBeVisible({ timeout: SLOW_OPEN_WAIT_MILLISECONDS });
    await expect(page.getByRole('status', { name: 'Loading the form' })).toHaveCount(0);
  });
});

test.describe('AC-2, AC-3: the phone drawer fetches its code on the first press', () => {
  test('AC-3: a slow first press is pending (aria-busy), then the drawer opens; Escape closes it and focus returns to the button', async ({ page }, testInfo) => {
    const gate = new ScriptGate();
    await openFormOnAPhone(page, gate, testInfo);

    gate.mode = 'slow';
    await drawerButton(page).click();
    await expect(drawerButton(page)).toHaveAttribute('aria-busy', 'true');
    await expect(drawerButton(page)).toBeEnabled();
    await expect(drawer(page)).toBeVisible({ timeout: SLOW_OPEN_WAIT_MILLISECONDS });

    // While the drawer is open the page behind it is hidden from the accessibility tree (aria-hidden), so the button is looked at again once it is closed.
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toHaveCount(0);
    await expect(drawerButton(page)).not.toHaveAttribute('aria-busy', 'true');
    await expect(drawerButton(page)).toBeFocused();
  });

  test('AC-3: a failed first press shows one alert under the button and the button stays usable; pressing again fetches the code and opens the drawer', async ({ page }, testInfo) => {
    const gate = new ScriptGate();
    await openFormOnAPhone(page, gate, testInfo);

    gate.mode = 'fail';
    await drawerButton(page).click();
    const alert = page.getByRole('alert').filter({ hasText: 'did not open' });
    await expect(alert).toHaveText(DRAWER_FAILURE);
    await expect(alert).toHaveCount(1);
    await expect(drawerButton(page)).toBeEnabled();
    await expect(drawerButton(page)).not.toHaveAttribute('aria-busy', 'true');
    await expect(drawerButton(page)).toHaveAttribute('aria-describedby', /.+/);

    gate.mode = 'pass';
    await drawerButton(page).click();
    await expect(alert).toHaveCount(0);
    await expect(drawer(page)).toBeVisible();
  });

  test('AC-2: the code is fetched once: closing and pressing again opens the drawer at once, with the tree as it was', async ({ page }, testInfo) => {
    const gate = new ScriptGate();
    await openFormOnAPhone(page, gate, testInfo);

    await drawerButton(page).click();
    await expect(drawer(page)).toBeVisible();
    const tree = drawer(page).getByRole('tree', { name: 'Parts tree' });
    await expect(tree.getByRole('treeitem')).toHaveCount(1);
    await expect(tree.getByRole('treeitem').first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toHaveCount(0);
    await page.waitForLoadState('networkidle');

    const requested = gate.urls.length;
    await drawerButton(page).click();
    await expect(drawer(page)).toBeVisible();
    await expect(tree.getByRole('treeitem').first()).toHaveAttribute('aria-selected', 'true');
    expect(gate.urls.length, 'no script was requested for the second press').toBe(requested);
  });
});
