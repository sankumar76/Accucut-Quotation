import { expect, test, type Page } from '@playwright/test';

import { defined } from '../support/defined';

import { readEstimateState, saveCanaryQuantity, useFreshAddress } from './support/auth';
import { calculateAsEngineer, engineerWithEstimate, signInAs, signInAsLead } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { control, fieldIdOf } from './support/part-form';
import { addMainAssemblyButton, chooseRow, openEngineerWindow, readTreeThrough, reviewButton, reviewRow, slNumbersOf } from './support/review-tree';
import { deleteGuardOf } from '../../src/lib/estimates/tree-moves';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-06.04 (AC-1, AC-3, AC-5, AC-7, AC-9, AC-10; NFR-002): Recalculate and the cleared figures, SCR-06, for a Lead and an Admin at `/estimates/<code>`, at 360x800, 768x1024 and 1366x768. Each test makes an
 * Engineer of its own with an estimate (the recipe of the confidentiality scan), has the Engineer calculate it through the portal, and changes an input the way a save from another tab does (the count of the part:
 * the estimate's input revision goes up). What it checks: the figures read **Cleared** in words (italic, never an empty box), the count stays, "How the total is built" is hidden, Approve and Download are off with
 * their reasons, the Recalculate button works from the screen and the figures come back, the first Calculate of a Lead on an estimate nobody calculated, the tile skeleton while the request is under way, a refused
 * request shown in the server's words, that an Engineer at the same address sees no figure state and gets the fixed 403 from the route, and no sideways scroll and no axe violation. The words are the UX spec's
 * (v0.29, "SCR-06 interim and final words"), written out here and not imported. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

/** The count typed after the Engineer's Calculate: any other number than the one the part holds, so the input really changes. */
const CHANGED_COUNT = '7';
const RECALCULATE_ROUTE = '**/api/v1/estimates/*/recalculate';
const SLOW_MILLISECONDS = 800;
const FIGURE = /^[\d,]+\.\d{2}$/;
const RUPEES = /^₹ [\d,]+\.\d{2}$/;

const tiles = (page: Page) => page.getByRole('region', { name: 'Totals' });
const button = (page: Page) => page.locator('#review-calculate');
const clearedNotice = (page: Page) => page.getByRole('status').filter({ hasText: 'The total is cleared because an input changed.' });

async function openAsLead(page: Page, code: string, testInfo: Parameters<typeof signInAsLead>[1]): Promise<void> {
  await signInAsLead(page, testInfo);
  const response = await page.goto(`/estimates/${code}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
}

/** An estimate the Engineer calculated and whose count then changed, opened as a Lead: the figures are cleared. */
async function clearedEstimate(page: Page, testInfo: Parameters<typeof signInAsLead>[1]) {
  const { owner, code } = await engineerWithEstimate(testInfo);
  await calculateAsEngineer(page, owner, code);
  await saveCanaryQuantity(owner.id, CHANGED_COUNT);
  await openAsLead(page, code, testInfo);
  return { owner, code };
}

test.describe('AC-1 and AC-5: the cleared state', () => {
  test('every figure reads Cleared in words, the count stays, the table is hidden, and Approve and Download are off with their reasons', async ({ page }, testInfo) => {
    await clearedEstimate(page, testInfo);

    await expect(clearedNotice(page)).toContainText('Every calculated figure, on every row, is cleared with it. They show again after you press Recalculate. Until then Approve and lock and the Excel download stay off.');
    await expect(tiles(page).getByText('Cleared', { exact: true }).first()).toHaveCSS('font-style', 'italic');
    await expect(tiles(page)).toContainText('An input changed, so every calculated figure is cleared. Press Recalculate to see them again.');
    await expect(tiles(page)).toContainText('Cleared with the total.');
    await expect(tiles(page)).toContainText('You set it when you approve, after Recalculate.');
    await expect(tiles(page).getByText(RUPEES)).toHaveCount(0);
    await expect(page.getByText('Every calculated figure is cleared because an input changed. Press Recalculate to see them again.')).toBeVisible();
    await expect(page.getByText('How the total is built')).toHaveCount(0);
    await expect(page.getByText(/\d nos/).first()).toContainText(CHANGED_COUNT);

    await expect(button(page)).toHaveText('Recalculate');
    await expect(button(page)).toBeEnabled();
    await expect(page.locator('#review-approve')).toBeDisabled();
    await expect(page.locator('#review-download')).toBeDisabled();
    await expect(page.locator('#review-approve-reason')).toHaveText('Recalculate first. Approving is available once the figures have been calculated again.');
    await expect(page.locator('#review-download-reason')).toHaveText('Calculate or Recalculate first. There is no file until a calculation is current.');
    await expect(page.getByText('Calculating from this screen is not available yet.')).toHaveCount(0);
  });

  test('AC-9: no sideways scroll and axe finds nothing in the cleared state', async ({ page }, testInfo) => {
    await clearedEstimate(page, testInfo);
    await expect(clearedNotice(page)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});

test.describe('AC-3: Recalculate from the screen', () => {
  test('the press stores a new calculation, the estimate stays Prepared, and the figures, the Calculated line and the table come back', async ({ page }, testInfo) => {
    const { owner } = await clearedEstimate(page, testInfo);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 1 });
    await waitUntilHydrated(page, '#review-calculate');

    // DEF-131 stage 2 (ED-7): a value typed in the inputs block and not yet left is saved first, then calculated: the press is the click that leaves the field, and the request goes after the save.
    const length = page.locator('#row-inputs form[data-part-form]').getByRole('textbox', { name: /Length/ }).first();
    await expect(length).toBeEnabled();
    await length.fill('111.5');
    const order: string[] = [];
    page.on('response', (response) => {
      const request = response.request();
      if (request.method() === 'PATCH' && /\/nodes\/[^/]+\/inputs$/.test(response.url())) order.push('saved');
      if (request.method() === 'POST' && response.url().endsWith('/recalculate')) order.push('calculated');
    });
    const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/estimates/${owner.id}/recalculate`));
    await button(page).click();
    expect((await answered).status()).toBe(200);
    // The click that leaves the field saves it and the press asks the form to send what it shows, so the same value may go twice (the second changes nothing); what matters is that every save is answered before the request.
    expect(order.at(-1), 'the figures were calculated last').toBe('calculated');
    expect(order.filter((step) => step === 'calculated'), 'once').toHaveLength(1);
    expect(order.length, 'the value was saved before the figures were calculated').toBeGreaterThan(1);
    const held = await page.evaluate(async (id) => ((await (await fetch(`/api/v1/estimates/${id}/nodes/${id}`)).json()) as { inputs: Record<string, string> }).inputs, owner.id);
    expect(Object.values(held)).toContain('111.50');

    await expect(button(page)).toHaveCount(0);
    await expect(clearedNotice(page)).toHaveCount(0);
    await expect(tiles(page).getByText(RUPEES)).toHaveCount(1);
    await expect(page.getByText(/^Calculated .+ · configuration version \d+$/)).toBeVisible();
    await expect(page.getByText('How the total is built').first()).toBeVisible();
    // Focus goes to the line that says when the figures were calculated, not to the top of the page.
    await expect(page.locator('#review-calculated')).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 2 });
  });

  test('the first press of a Lead on an estimate nobody calculated is a Calculate: the estimate becomes Prepared and the figures show', async ({ page, browser }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await openAsLead(page, code, testInfo);
    await expect(page.getByRole('status').filter({ hasText: 'The Engineer has not calculated this estimate yet.' })).toContainText(
      'The Engineer has not calculated this estimate yet. Press Calculate to see costs.',
    );
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 0 });
    await expect(button(page)).toHaveText('Calculate');
    await waitUntilHydrated(page, '#review-calculate');

    // ED-8 (DEF-131 stage 2): in a Draft the Engineer can save the same part after the Lead opened it. The Engineer's window is a context of its own (the same person, no new one). The Lead's save of that field is refused as
    // changed elsewhere, the conflict notice offers the two choices, nothing is overwritten, and "Use the newer values" shows the Engineer's value.
    const length = control(page, 'J');
    await expect(length).toBeEnabled();
    const engineerWindow = await browser.newContext({ baseURL: DEVELOPMENT_URL });
    try {
      await useFreshAddress(engineerWindow);
      const engineerPage = await engineerWindow.newPage();
      await signInAs(engineerPage, owner);
      const read = await engineerPage.request.get(`/api/v1/estimates/${owner.id}/nodes/${owner.id}`);
      const { revision } = (await read.json()) as { revision: number };
      const written = await engineerPage.request.patch(`/api/v1/estimates/${owner.id}/nodes/${owner.id}/inputs`, { headers: { origin: DEVELOPMENT_URL }, data: { revision, values: { [fieldIdOf('J')]: '77' } } });
      expect(written.status(), 'the Engineer saves the part').toBe(200);
    } finally {
      await engineerWindow.close();
    }
    await length.fill('88');
    await length.blur();
    await expect(page.getByText('This part was changed somewhere else.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep what I typed' })).toBeVisible();
    await page.getByRole('button', { name: 'Use the newer values' }).click();
    await expect(length).toHaveValue('77.00');

    // ED-25, ED-26, ED-27, ED-28 (ruling 2026-11-27 4.3 item 4, 4.7 (d) 4; DEF-131 stage 2T): the Lead adds a row (2) and a Part under it (2.1); the Engineer's window (one, kept for this block) reads them, with no figure. The Engineer
    // types inside the subtree the Lead has a delete dialog open on: the Lead's Delete is refused, nothing is deleted, and the notice says so. Calculate is refused for the Part's blank inputs: the summary names it, its link opens
    // the row and the blank field says what to do. Last, the Engineer deletes the row the Lead has open: the Lead's next save answers 404, the block falls back to the first row and says so once. The Engineer then deletes
    // the row that is left (the Lead's screen need not follow), so the Calculate below has only the part the Engineer filled.
    await addMainAssemblyButton(page).click();
    await expect(reviewRow(page, '2')).toBeFocused();
    await reviewButton(page, 'Add under', '2').click();
    await page.getByRole('menuitem', { name: /^Part/ }).click();
    await expect(reviewRow(page, '2.1')).toHaveAttribute('aria-current', 'true');
    const engineer = await openEngineerWindow(browser, owner);
    try {
      const rows = await readTreeThrough(engineer.api, owner.id);
      expect(rows.map((row) => row.slNo)).toEqual(['1', '2', '2.1']);
      expect(JSON.stringify(rows)).not.toMatch(/figures|unitPrice|price/i);
      const inner = defined(rows.find((row) => row.slNo === '2.1'));

      await chooseRow(page, '2');
      await reviewButton(page, 'Delete', '2').click();
      const deleteDialog = page.getByRole('alertdialog', { name: /^Delete 2 .+\?$/ });
      await expect(deleteDialog.getByRole('button', { name: 'Keep it' })).toBeFocused();
      const read = await engineer.api.get(`/api/v1/estimates/${owner.id}/nodes/${inner.id}`);
      const { revision } = (await read.json()) as { revision: number };
      const written = await engineer.api.patch(`/api/v1/estimates/${owner.id}/nodes/${inner.id}/inputs`, { headers: { origin: DEVELOPMENT_URL }, data: { revision, values: { [fieldIdOf('J')]: '5' } } });
      expect(written.status(), 'the Engineer types inside the subtree').toBe(200);
      await deleteDialog.getByRole('button', { name: 'Delete 2 rows' }).click();
      await expect(deleteDialog).toHaveCount(0);
      await expect(page.getByText('The parts were changed by someone else. The tree has been refreshed. Check it and try again.')).toBeVisible();
      expect(await slNumbersOf(page)).toEqual(['1', '2', '2.1']);

      await button(page).click();
      const missing = page.locator('[data-calculate-summary]');
      await expect(missing).toContainText('missing inputs');
      await missing.getByRole('listitem').filter({ hasText: '2.1' }).getByRole('link').first().click();
      await expect(reviewRow(page, '2.1')).toHaveAttribute('aria-current', 'true');
      await expect(page.getByText('Enter this value.').first()).toBeVisible();

      const fresh = await readTreeThrough(engineer.api, owner.id);
      const open = defined(fresh.find((row) => row.slNo === '2.1'));
      const guard = deleteGuardOf(fresh, open.id);
      const removed = await engineer.api.delete(`/api/v1/estimates/${owner.id}/nodes/${open.id}?revision=${String(open.revision)}&parts=${String(guard.parts)}&subtree=${guard.subtree}`, { headers: { origin: DEVELOPMENT_URL } });
      expect(removed.status(), 'the Engineer deletes the row the Lead has open').toBe(200);
      const field = control(page, 'J');
      await expect(field).toBeEnabled();
      await field.fill('9');
      await field.blur();
      await expect(page.getByRole('status').filter({ hasText: '2.1 was removed by someone else. Showing 1.' })).toHaveCount(1);
      await expect(reviewRow(page, '1')).toHaveAttribute('aria-current', 'true');

      const left = await readTreeThrough(engineer.api, owner.id);
      const second = defined(left.find((row) => row.slNo === '2'));
      const secondGuard = deleteGuardOf(left, second.id);
      const gone = await engineer.api.delete(`/api/v1/estimates/${owner.id}/nodes/${second.id}?revision=${String(second.revision)}&parts=${String(secondGuard.parts)}&subtree=${secondGuard.subtree}`, { headers: { origin: DEVELOPMENT_URL } });
      expect(gone.status(), 'the Engineer deletes the row that is left').toBe(200);
    } finally {
      await engineer.close();
    }

    const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/estimates/${owner.id}/recalculate`));
    await button(page).click();
    expect((await answered).status()).toBe(200);

    await expect(tiles(page).getByText(RUPEES)).toHaveCount(1);
    await expect(tiles(page).getByText(FIGURE).first()).toBeVisible();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 1 });
  });

  test("a 0 in QTY per Assy is asked about in the Lead's dialog (STORY-06.10), writes nothing and leaves the figures cleared; Go back closes it", async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await saveCanaryQuantity(owner.id, '0');
    await openAsLead(page, code, testInfo);
    await waitUntilHydrated(page, '#review-calculate');

    const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/recalculate'));
    await button(page).click();
    expect((await answered).status()).toBe(409);

    await expect(page.getByRole('alertdialog').getByRole('heading', { name: 'Check the quantity on 1 row' })).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Go back', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(button(page)).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'DRAFT', calculations: 0 });
  });

  test("a press that the server refuses shows the server's own sentence, writes nothing and leaves the figures cleared", async ({ page }, testInfo) => {
    const { owner } = await clearedEstimate(page, testInfo);
    await waitUntilHydrated(page, '#review-calculate');
    const sentence = 'This estimate is approved and locked. Unlock it first.';
    await page.route(RECALCULATE_ROUTE, (route) =>
      route.fulfill({ status: 409, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: sentence, status: 409, code: 'ESTIMATE_APPROVED_IS_LOCKED', requestId: 'req-00000000' }) }),
    );
    await button(page).click();

    await expect(page.getByRole('alert').filter({ hasText: sentence })).toBeVisible();
    await expect(button(page)).toBeVisible();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 1 });
  });
});

test.describe('AC-9: loading', () => {
  test('while the request is under way the button is busy, a line says so and each tile shows a skeleton in place of its figure; when it ends the figures show', async ({ page }, testInfo) => {
    const { owner } = await clearedEstimate(page, testInfo);
    await waitUntilHydrated(page, '#review-calculate');
    await page.route(RECALCULATE_ROUTE, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, SLOW_MILLISECONDS));
      await route.continue();
    });

    const answered = page.waitForResponse((response) => response.url().endsWith(`/api/v1/estimates/${owner.id}/recalculate`));
    await button(page).click();
    await expect(button(page)).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByText('Calculating. This takes a moment.')).toBeVisible();
    await expect(tiles(page).locator('[data-slot="skeleton"]')).toHaveCount(3);
    for (const skeleton of await tiles(page).locator('[data-slot="skeleton"]').all()) await expect(skeleton).toBeVisible();
    expect((await answered).status()).toBe(200);

    await expect(tiles(page).getByText(RUPEES)).toHaveCount(1);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 2 });
  });
});

test.describe('AC-7 (NFR-002): an Engineer', () => {
  test('sees no figure state and no Recalculate button, and the route is the fixed 403 that holds no figure', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await saveCanaryQuantity(owner.id, CHANGED_COUNT);
    await signInAs(page, owner);
    const own = await page.goto(`/estimates/${code}`);
    expect(own?.status()).toBe(200);
    await expect(page.getByText('The total is cleared because an input changed.')).toHaveCount(0);
    await expect(page.getByText('Cleared', { exact: true })).toHaveCount(0);
    await expect(page.locator('#review-calculate')).toHaveCount(0);

    const refused = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/estimates/${id}/recalculate`, { method: 'POST' });
      return { status: response.status, body: await response.text() };
    }, owner.id);
    expect(refused.status).toBe(403);
    expect(JSON.parse(refused.body)).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(refused.body).not.toMatch(/state|totals|figures|totalPrice|nodes/);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 1 });
  });
});
