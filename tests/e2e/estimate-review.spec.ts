import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { defined } from '../support/defined';

import { createDisposableUser, E2E_ADMIN, readEstimateState, useFreshAddress } from './support/auth';
import { controlIdFor } from '../../src/components/features/estimate-workspace/field-ids';
import { calculateWithoutThePage, engineerWithEstimate, signInAs } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';
import { ignoreThroughTheApi } from './support/ignored';
import { control } from './support/part-form';
import { addMainAssemblyButton, chooseRow, CLEARED_STATUS, countPageReads, expectTreeControls, reviewButton, reviewRow, slNumbersOf } from './support/review-tree';
import { DEVELOPMENT_URL } from './support/servers';
import { expectLinkTarget, isTouchLayout } from './support/touch-link';

/**
 * STORY-06.02 T6 (AC-1 to AC-6, AC-9): the estimate review, SCR-06, for a Lead and an Admin at `/estimates/<code>`, at 360x800, 768x1024 and 1366x768 on the development server. Each test makes
 * an Engineer of its own with an estimate (the recipe of the confidentiality scan), has the Engineer calculate it through the portal, and opens the same address as a Lead. What it checks: the three
 * tiles, each with its file cell once; each row's own figure and count; "How the total is built" ending with the figure of the BL tile; the not-calculated state with its disabled buttons and
 * their reasons; that an Engineer who opens the same address gets their own workspace and a 403 from `/costs`; no sideways scroll and no axe violation. The words are the UX spec's and the story's,
 * written out here and not imported. The figures themselves are held by `tests/unit/estimate-review-*.test.ts` against the constructed cases, and the cost scan reads the same page as an Engineer
 * (`canary-scan.spec.ts`). Every name and path is invented.
 *
 * Set-up (AQP-415, DEF-072): the Engineer and the Lead are signed in with the two calls the sign-in page makes, and the Engineer's Calculate is the request the button sends, **without** the sign-in screen, the queue
 * and the Engineer's workspace page (`support/calculated-estimate.ts`). The subject here is the review page, and those page loads were most of a case's 30 s on the development server of a loaded runner (a
 * set-up of 18 to 20 s at 768 px, before the case's own steps and its one axe scan of AC-9). The sign-in screen is judged by `sign-in.spec.ts`.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const PHONE_MAX = 767;
const FIGURE = /^[\d,]+\.\d{2}$/;
const RUPEES = /^₹ [\d,]+\.\d{2}$/;

async function openAsLead(page: Page, testInfo: TestInfo, code: string, role: 'LEAD' | 'ADMIN' = 'LEAD'): Promise<void> {
  // There is one active Admin in the database (the E2E Admin of the setup project), so an Admin is not made for the test.
  const person = role === 'ADMIN' ? E2E_ADMIN : await createDisposableUser('axe', testInfo, role);
  await signInAs(page, person);
  const response = await page.goto(`/estimates/${code}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
}

const tiles = (page: Page) => page.getByRole('region', { name: 'Totals' });
const treePanel = (page: Page) => page.locator('details').filter({ has: page.locator('summary', { hasText: /^Parts tree/ }) });
const buildPanel = (page: Page) => page.locator('details').filter({ has: page.locator('summary', { hasText: /^How the total is built/ }) });
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1_000) <= PHONE_MAX;

/**
 * AQP-465 (DEF-108; ux-expert ruling 2026-11-28) and AQP-488 (DEF-131 Stage 1; ruling 2026-11-27 section 3.8): "How the total is built" is above the two columns at every width, under the tiles, which stay full width. The
 * columns are the parts tree and the inputs of the open row: from 1024 px the tree is a column 320 px wide (the SCR-05 tree's width) at the left, sticky, with the inputs at its right, starting at the same height; below
 * 1024 px the two are stacked, the tree first, and the tree folds. Judged from the boxes as drawn.
 */
async function expectColumns(page: Page): Promise<void> {
  const inputs = page.locator('#row-inputs');
  const [tilesBox, treeBox, buildBox, inputsBox] = await Promise.all([tiles(page).boundingBox(), treePanel(page).boundingBox(), buildPanel(page).boundingBox(), inputs.boundingBox()]);
  if (tilesBox === null || treeBox === null || buildBox === null || inputsBox === null) throw new Error('a box is missing');
  expect(buildBox.y).toBeGreaterThanOrEqual(tilesBox.y + tilesBox.height - 1);
  expect(treeBox.y).toBeGreaterThanOrEqual(buildBox.y + buildBox.height - 1);
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    expect(Math.abs(treeBox.width - 320)).toBeLessThanOrEqual(1);
    expect(inputsBox.x).toBeGreaterThanOrEqual(treeBox.x + treeBox.width - 1);
    expect(Math.abs(inputsBox.y - treeBox.y)).toBeLessThanOrEqual(1);
    await expect(treePanel(page)).toHaveCSS('position', 'sticky');
  } else {
    expect(inputsBox.y).toBeGreaterThanOrEqual(treeBox.y + treeBox.height - 1);
    await expect(treePanel(page)).toHaveCSS('position', 'static');
  }
}

test.describe('AC-1, AC-2, AC-3: a calculated estimate, as a Lead', () => {
  test('AC-1: the tiles show BL in rupees, BN and BO, each with its letter tag and its file cell once', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await openAsLead(page, testInfo, code);

    await expect(tiles(page)).toContainText('Total Unit Production Price');
    await expect(tiles(page)).toContainText('Price per Tool Cost');
    await expect(tiles(page)).toContainText('Approved Quote Price');
    for (const cell of ['File cell BL2', 'File cell BN2', 'File cell BO2']) await expect(tiles(page).getByText(cell)).toHaveCount(1);
    await expect(tiles(page).getByText('Not set yet', { exact: true })).toHaveCount(1);
    for (const letter of ['BL', 'BN', 'BO']) await expect(tiles(page).getByText(`Excel column ${letter}`, { exact: true })).toHaveCount(1);
    const bl = tiles(page).locator('p').filter({ hasText: RUPEES });
    await expect(bl).toHaveCount(1);

    // DEF-131 stage 2T (ruling 2026-11-27 4.7; ED-18, ED-21, ED-23, ED-24, ED-30, ED-33): a Lead changes the parts of a Prepared estimate. The tree has its controls once the island has read it and no resize handle; "Add main assembly"
    // adds a row last, opens it, gives its link the focus and says so; every figure is cleared, the page is read once and the change is said once; deleting it asks first, with the safe choice focused and no password; the
    // estimate stays Prepared.
    await expectTreeControls(page);
    const pageReads = countPageReads(page);
    await addMainAssemblyButton(page).click();
    await expect(reviewRow(page, '2')).toHaveAttribute('aria-current', 'true');
    await expect(reviewRow(page, '2')).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: 'Added 2 Main Assembly. Type a Description to name it.' })).toHaveCount(1);
    await expect(page.getByRole('status').filter({ hasText: CLEARED_STATUS })).toHaveCount(1);
    await expect(tiles(page).getByText(RUPEES)).toHaveCount(0);
    await expect(page.locator('#review-calculate')).toHaveText('Recalculate');
    await expect(page.locator('#review-approve')).toBeDisabled();
    await expect(page.locator('#review-download')).toBeDisabled();
    await expect.poll(pageReads).toBe(1);

    await chooseRow(page, '2');
    await reviewButton(page, 'Delete', '2').click();
    const dialog = page.getByRole('alertdialog', { name: /^Delete 2 .+?$/ });
    await expect(dialog.getByRole('button', { name: 'Keep it' })).toBeFocused();
    await expect(dialog.getByRole('textbox')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Delete row' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Row deleted')).toHaveCount(1);
    await expect(reviewRow(page, '2')).toHaveCount(0);
    await expect(reviewRow(page, '1')).toBeFocused();
    // The figures were already cleared, so the second change reads the page no more and says nothing more (once per change from current to cleared).
    expect(pageReads()).toBe(1);
    await expect(page.getByRole('status').filter({ hasText: CLEARED_STATUS })).toHaveCount(1);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 1 });
  });

  test('AC-2: every row shows its own figure with its count beside it, and the legend says so', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await openAsLead(page, testInfo, code);

    const rows = treePanel(page).locator('[data-part-row]');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(/\d+(\.\d+)? nos/);
    await expect(rows.first().locator('span').filter({ hasText: FIGURE }).last()).toBeVisible();
    await expect(treePanel(page)).toContainText("Each figure is that row's own BG. The count for the whole order (QTY per Assy) is shown beside it and is already included. The estimate total adds every row's BG.");
    await expect(page.getByText('Σ')).toHaveCount(0);

    // AQP-488 (DEF-131; ruling 2026-11-27, RO-1, RO-9, RO-10, RO-11, RO-14, ED-1 to ED-3): each row's first line is a link to its inputs, the first row is open, and the block beside the tree is the Engineer's form, which a Lead can correct
    // while the estimate is Prepared: a region named by its title, the notice of 4.2, the row line with the row's own figure, no intro and no Save draft or Calculate, and a value typed and left is saved and clears every figure.
    const open = treePanel(page).locator('a[aria-current="true"]');
    await expect(open).toHaveCount(1);
    await expect(open).toHaveAttribute('href', /\?row=1#row-inputs$/);
    const inputs = page.locator('#row-inputs');
    const form = inputs.locator('form[data-part-form]');
    await expect(form).toBeVisible();
    await expect(inputs.locator('#part-form-title')).toContainText('1');
    await expect(form).toHaveAccessibleName(/^1/);
    await expect(inputs).toContainText('You can correct inputs. Any change clears every calculated figure; press Recalculate to see them again.');
    await expect(inputs.locator('[data-row-line]')).toContainText(/^This row: ₹ [\d,]+\.\d{2} \(B[A-Z]\) · \$ [\d,]+\.\d{2} · € [\d,]+\.\d{2} · count [\d,.]+ nos/);
    await expect(inputs).not.toContainText('Every field is needed to Calculate');
    // The Engineer's Save draft and Calculate are not on this form: the page's own Recalculate is the one way to calculate.
    await expect(inputs.getByRole('button', { name: /^(Save draft|Calculate)$/ })).toHaveCount(0);
    // RO-3 (QLT-800-04): each value the part holds is the value shown, compared by field ID: the part is read as the Lead through the same route the form uses, and every box (a number, a text) shows what it holds. A number is
    // shown as SCR-05 shows it after saving (two decimals), so numbers are compared as numbers.
    const held = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/estimates/${id}/nodes/${id}`);
      return { status: response.status, inputs: ((await response.json()) as { inputs: Record<string, string> }).inputs };
    }, owner.id);
    expect(held.status).toBe(200);
    let compared = 0;
    for (const [fieldId, stored] of Object.entries(held.inputs)) {
      const box = form.locator(`input#${controlIdFor(fieldId)}, textarea#${controlIdFor(fieldId)}`);
      if ((await box.count()) === 0 || stored === '') continue;
      const shown = await box.inputValue();
      if (/^-?\d+(\.\d+)?$/.test(stored)) expect(Number(shown), `field ${fieldId}`).toBe(Number(stored));
      else expect(shown, `field ${fieldId}`).toBe(stored);
      compared += 1;
    }
    expect(compared, 'boxes compared with what the part holds').toBeGreaterThan(3);

    // ED-2, ED-3: a value typed and left is saved (a PATCH, 200), the figures are cleared once and the page is drawn again with focus where it was: the tiles read Cleared, and the one polite line says so.
    const length = form.getByRole('textbox', { name: /Length/ }).first();
    await expect(length).toBeEnabled();
    await expect(length).not.toHaveAttribute('aria-readonly', 'true');
    const saved = page.waitForResponse((response) => response.request().method() === 'PATCH' && /\/nodes\/[^/]+\/inputs$/.test(response.url()));
    await length.fill('123.45');
    await length.blur();
    expect((await saved).status()).toBe(200);
    await expect(length).toHaveValue('123.45');
    await expect(tiles(page).getByText('Cleared', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Saved. Every calculated figure is cleared. Press Recalculate to see them again.' })).toHaveCount(1);
    await expect(inputs).toContainText('You can correct inputs. Every calculated figure is already cleared; press Recalculate when you have finished.');
  });

  test('AC-3: "How the total is built" lists the row and ends with the total, which is the figure of the BL tile, under the example and the rounding sentence', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await openAsLead(page, testInfo, code);

    await expect(buildPanel(page)).not.toHaveAttribute('open', '');
    // AQP-468 (DEF-112; ux-expert ruling 2026-11-28): the whole line is the control, with the heading, a chevron and the word "Show" while it is closed and "Hide" while it is open.
    const toggle = buildPanel(page).locator('summary');
    // `toHaveText` reads the text of the element, hidden words included: the heading comes first, and what is seen is judged by the two checks below.
    await expect(toggle).toHaveText(/^How the total is built/);
    await expect(toggle.getByText('Show', { exact: true })).toBeVisible();
    await expect(toggle.getByText('Hide', { exact: true })).toBeHidden();
    await toggle.click();
    await expect(toggle.getByText('Hide', { exact: true })).toBeVisible();
    await expect(toggle.getByText('Show', { exact: true })).toBeHidden();
    const table = page.getByRole('region', { name: 'How the total is built, scrollable' });
    await expect(table).toBeVisible();
    for (const heading of ['Sl. No', 'Part', 'QTY per Assy']) await expect(table.getByRole('columnheader', { name: new RegExp(heading, 'i') })).toBeVisible();
    const totalRow = table.getByRole('row').filter({ hasText: 'Total (the sum of the BG column)' });
    const total = (await totalRow.getByRole('cell').last().innerText()).trim();
    expect(total).toMatch(FIGURE);
    await expect(tiles(page)).toContainText(`₹ ${total}`);
    await expect(buildPanel(page)).toContainText('Worked example: if one lid costs 1, one pipe costs 1 and the frame row holds nothing, the total is 24 + 6 + 0 = 30.');
    await expect(buildPanel(page)).toContainText('Figures are shown to 2 decimals. Totals add the unrounded values and round once');
    await expect(buildPanel(page)).toContainText("The Engineer types the count for the whole order on every row (QTY per Assy, column H). Each row's cost (column BG) already includes its own count, so the total is the BG of every row added together. Nothing is multiplied by the rows above.");
    await expectColumns(page);
  });

  test('AC-2: an Admin sees the same review', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await openAsLead(page, testInfo, code, 'ADMIN');
    await expect(tiles(page)).toContainText('File cell BL2');
    // The Admin sees the same inputs block, read-only (AQP-488).
    await expect(page.locator('#row-inputs form[data-part-form]')).toBeVisible();
    await expect(page.locator('#row-inputs')).toContainText('You can correct inputs.');

    // ED-20, ED-22, ED-23, ED-35 (ruling 2026-11-27 4.7): an Admin works the tree with the keyboard alone, no drag and no mouse after the first press. The "+" of a Main Assembly offers exactly the kinds that may go under it; a
    // second Part under the same row is named "Sub-part"; the handle's menu moves a row up and the handle keeps the focus; "-" asks first (no password) and removes the row and the rows under it in one step.
    await expectTreeControls(page);
    await addMainAssemblyButton(page).click();
    await expect(reviewRow(page, '2')).toBeFocused();
    const addUnder = async (slNo: string, kind: RegExp): Promise<void> => {
      await reviewButton(page, 'Add under', slNo).focus();
      await page.keyboard.press('Enter');
      const menu = page.getByRole('menu');
      if (slNo === '2') {
        await expect(menu.getByRole('menuitem')).toHaveCount(3);
        for (const kindName of [/^Sub-Assembly/, /^(Part|Sub-part)/, /^Fastener/]) await expect(menu.getByRole('menuitem', { name: kindName })).toHaveCount(1);
      }
      await menu.getByRole('menuitem', { name: kind }).focus();
      await page.keyboard.press('Enter');
    };
    await addUnder('2', /^Part/);
    await expect(page.getByRole('status').filter({ hasText: /^Added 2.1 Part. Type a Description to name it./ })).toHaveCount(1);
    await addUnder('2', /^(Part|Sub-part)/);
    await expect(page.getByRole('status').filter({ hasText: /^Added 2.2 Sub-part. Type a Description to name it./ })).toHaveCount(1);
    expect(await slNumbersOf(page)).toEqual(['1', '2', '2.1', '2.2']);
    await reviewButton(page, 'Move', '2.2').focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'Move up', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: /renumbered to 2.1/ })).toHaveCount(1);
    await expect(reviewButton(page, 'Move', '2.1')).toBeFocused();
    await reviewButton(page, 'Delete', '2').focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog', { name: /^Delete 2 .+?$/ });
    await expect(dialog.getByRole('button', { name: 'Keep it' })).toBeFocused();
    await expect(dialog).toContainText('This also deletes the 2 rows under it');
    await expect(dialog.getByRole('textbox')).toHaveCount(0);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('3 rows deleted')).toHaveCount(1);
    expect(await slNumbersOf(page)).toEqual(['1']);
  });
});

test.describe('AC-6: not calculated', () => {
  test('shows the notice as a status, "Not calculated", dashes, Calculate as the primary button, and Approve and Download off with their reasons', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    // A second row (AQP-488; not a person, so the ledger of persons stays as it was): the Engineer adds a main assembly with the request the "+" sends, before the Lead opens the page.
    await signInAs(page, owner);
    const added = await page.request.post(`/api/v1/estimates/${owner.id}/nodes`, { headers: { origin: DEVELOPMENT_URL }, data: { parentId: null, nodeKind: 'MAIN_ASSEMBLY' } });
    expect(added.status(), 'the Engineer adds a second row').toBe(201);
    await openAsLead(page, testInfo, code);

    const notice = page.getByRole('status').filter({ hasText: 'The Engineer has not calculated this estimate yet.' });
    await expect(notice).toBeVisible();
    // AC-10 (STORY-06.04; ux-spec v0.29 "SCR-06 interim and final words"): exactly two sentences, the second naming the button, which now works. The third sentence of 0.28 is gone.
    await expect(notice).toHaveText('The Engineer has not calculated this estimate yet. Press Calculate to see costs.');
    await expect(tiles(page)).toContainText('Not calculated');
    await expect(page.getByText('How the total is built')).toHaveCount(0);
    await expect(page.getByText('Calculating from this screen is not available yet.')).toHaveCount(0);
    await expect(page.locator('#review-calculate')).toHaveText('Calculate');
    await expect(page.locator('#review-calculate')).toBeEnabled();
    for (const [button, label] of [['review-approve', 'Approve and lock'], ['review-download', 'Download .xlsx']] as const) {
      const control = page.locator(`#${button}`);
      await expect(control).toHaveText(label);
      await expect(control).toBeDisabled();
      const reasonId = await control.getAttribute('aria-describedby');
      expect(reasonId, button).not.toBeNull();
      await expect(page.locator(`#${reasonId ?? 'missing'}`)).toBeVisible();
    }
    await expect(page.locator('#review-approve-reason')).toHaveText('Calculate first. Approving is available once the figures have been calculated.');
    await expect(page.locator('#review-download-reason')).toHaveText('Calculate or Recalculate first. There is no file until a calculation is current.');

    // AQP-488 (DEF-131 Stage 1; ruling 2026-11-27, RO-2, RO-15, RO-16, RO-17): choosing the second row. The first is open to begin with; the link goes to ?row=2#row-inputs, `aria-current` moves, the focus is on the form's
    // title, the choice is said once, below 1024 px the tree folds, and the page is as clean for axe as before. The state is "not calculated", so the row line has a dash and the count.
    const inputs = page.locator('#row-inputs');
    await expect(inputs.locator('form[data-part-form]')).toBeVisible();
    await expect(treePanel(page).locator('a[aria-current="true"]')).toHaveAttribute('href', /\?row=1#row-inputs$/);
    await expect(inputs.locator('[data-row-line]')).toContainText(/^This row: — · count /);
    await expect(inputs.getByRole('status').filter({ hasText: 'Showing the inputs of' })).toHaveCount(0);
    await treePanel(page).locator('a[href$="?row=2#row-inputs"]').click();
    await expect(page).toHaveURL(/\?row=2#row-inputs$/);
    await expect(treePanel(page).locator('a[aria-current="true"]')).toHaveAttribute('href', /\?row=2#row-inputs$/);
    await expect(inputs.locator('#part-form-title')).toContainText('2');
    await expect(page.locator('#part-form-title')).toBeFocused();
    await expect(inputs.getByRole('status').filter({ hasText: /^Showing the inputs of 2 [^.]*\.$/ })).toHaveCount(1);
    // A Draft can be corrected by a Lead, so the line does not say "Read-only" (DEF-131 stage 2).
    await expect(inputs.getByRole('status').filter({ hasText: 'Read-only' })).toHaveCount(0);
    if ((page.viewportSize()?.width ?? 0) < 1024) await expect(treePanel(page)).not.toHaveAttribute('open', '');
    else await expect(treePanel(page)).toHaveAttribute('open', '');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    // ED-17 (DEF-131 stage 2): a value the rule refuses is told under its field in the Engineer's words (the icon, the text, `aria-invalid`, `aria-describedby`), what was typed stays, and axe still finds nothing.
    const length = control(page, 'J');
    await expect(length).toBeEnabled();
    await length.fill('-5');
    await length.blur();
    await expect(length).toHaveAttribute('aria-invalid', 'true');
    await expect(inputs.getByText('Enter 0 or more, with up to 2 decimals.')).toBeVisible();
    await expect(length).toHaveValue('-5');
    await expectNoAxeViolations(page);

    // ED-12: the estimate is ignored in another window while this page is open. The next save is refused with the 409, the block turns read-only in the words of the Ignored layer, and what was typed stays on screen.
    await length.fill('12.5');
    expect(await ignoreThroughTheApi(page, owner.id, 'Not taken forward, an invented reason.')).toBe(200);
    await length.blur();
    await expect(inputs).toContainText('Read-only while this RFQ is ignored. Restore it to change an input or the parts tree.');
    await expect(length).toHaveValue('12.5');
    await expect(length).toHaveAttribute('aria-readonly', 'true');
  });
});

test.describe('AC-5 (NFR-002): an Engineer at the same address', () => {
  test('the owner gets their own workspace and no review; `/costs` is the fixed 403 and holds no figure; another Engineer gets "not found"', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);

    const own = await page.goto(`/estimates/${code}`);
    expect(own?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
    await expect(page.getByText('Total Unit Production Price')).toHaveCount(0);
    await expect(page.getByText('File cell')).toHaveCount(0);
    await expect(page.locator('#review-approve')).toHaveCount(0);
    // AQP-488 (NFR-002): the Engineer gets no inputs block of the review, no row line and no row links, at the address with or without `?row=`.
    for (const path of [`/estimates/${code}`, `/estimates/${code}?row=1`]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('#row-inputs')).toHaveCount(0);
      await expect(page.getByText('This row:')).toHaveCount(0);
      await expect(page.getByText('You can correct inputs.')).toHaveCount(0);
      await expect(page.locator('a[href*="row="]')).toHaveCount(0);
      await expect(page.getByText(/This row: ₹/)).toHaveCount(0);
    }

    const refused = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/estimates/${id}/costs`);
      return { status: response.status, body: await response.text() };
    }, owner.id);
    expect(refused.status).toBe(403);
    expect(JSON.parse(refused.body)).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(refused.body).not.toMatch(/state|totals|figures|totalPrice|nodes/);

    const other = await createDisposableUser('scan', testInfo);
    await signInAs(page, other);
    const foreign = await page.goto(`/estimates/${code}`);
    expect(foreign?.status()).toBe(404);
    await expect(page.getByText('Total Unit Production Price')).toHaveCount(0);
  });

  test('a Lead is answered by `/costs` with the state and the figures, and nobody signed in is 401', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await openAsLead(page, testInfo, code);
    const answer = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/estimates/${id}/costs`);
      return { status: response.status, body: await response.text() };
    }, owner.id);
    expect(answer.status).toBe(200);
    expect(JSON.parse(answer.body)).toMatchObject({ state: 'current', configurationNumber: expect.any(Number), totals: { totalPrice: expect.stringMatching(/^\d+(\.\d+)?$/) } });

    await page.context().clearCookies();
    const signedOut = await page.request.get(`/api/v1/estimates/${owner.id}/costs`);
    expect(signedOut.status()).toBe(401);
  });
});

test.describe('AC-9: layout and accessibility', () => {
  test('a calculated estimate: no sideways scroll, tiles stack on a phone and sit side by side from 768, the tree folds away, axe finds nothing', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await openAsLead(page, testInfo, code);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    const box = async (index: number) => defined(await tiles(page).locator('[data-slot="card"]').nth(index).boundingBox());
    const first = await box(0);
    const second = await box(1);
    const third = await box(2);
    if (isPhone(page)) {
      expect(second.y).toBeGreaterThanOrEqual(first.y + first.height - 1);
      expect(third.y).toBeGreaterThanOrEqual(second.y + second.height - 1);
    } else {
      expect(Math.abs(second.y - first.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(third.y - first.y)).toBeLessThanOrEqual(1);
    }

    const rows = treePanel(page).locator('[data-part-row]');
    await expect(rows.first()).toBeVisible();
    if ((page.viewportSize()?.width ?? 0) < 1024) {
      // Below 1024 px the tree is the foldable panel it was (AQP-465: from 1024 px it is a column that stays, so its summary takes no press there).
      await treePanel(page).locator('summary').click();
      await expect(rows.first()).toBeHidden();
      await treePanel(page).locator('summary').click();
      await expect(rows.first()).toBeVisible();
    } else {
      await expect(treePanel(page).locator('summary')).toHaveCSS('pointer-events', 'none');
      await expect(rows.first()).toBeVisible();
    }

    await buildPanel(page).locator('summary').click();
    await expect(page.getByRole('region', { name: 'How the total is built, scrollable' })).toBeVisible();
    // The block of the open row is on the page, its form read, when the scan runs (RO-15, RO-17).
    await expect(page.locator('#row-inputs form[data-part-form]')).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    // ED-34, ED-37 (ruling 2026-11-27 4.7): with the tree editable, the "+" menu opens in line under its row and is not clipped by the column, the delete dialog is open, and under 1024 px choosing a row folds the tree and
    // its summary names the row; no sideways scroll, and axe finds nothing serious with the toolbar in view, the menu open and the dialog open.
    await expectTreeControls(page);
    await addMainAssemblyButton(page).click();
    await expect(reviewRow(page, '2')).toHaveAttribute('aria-current', 'true');
    await chooseRow(page, '2');
    await reviewButton(page, 'Add under', '2').click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const menuBox = defined(await menu.boundingBox());
    const width = page.viewportSize()?.width ?? 0;
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(width + 1);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await reviewButton(page, 'Delete', '2').click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Keep it' }).click();
    if (isPhone(page) || (page.viewportSize()?.width ?? 0) < 1024) {
      await chooseRow(page, '1');
      await expect(treePanel(page)).not.toHaveAttribute('open', '');
      await expect(treePanel(page).locator('summary')).toContainText('· 1');
    }
  });

  test('not calculated: no sideways scroll and axe finds nothing', async ({ page }, testInfo) => {
    const { code } = await engineerWithEstimate(testInfo);
    await openAsLead(page, testInfo, code);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});

/**
 * DEF-079 (AQP-422; NFR-017 as ruled on 2026-11-24): "View cost details" is the way from a row of the parts tree to SCR-07, so on a touch layout (below 1024 px, or a coarse pointer at any width) it is a control: at least
 * 44 px high by a least height, a tap at its top or bottom edge lands on it, its text keeps its size, the page does not scroll sideways and axe is clean. With a mouse from 1024 px it keeps the height of its line.
 * The desktop project reads it again with a finger at 1280 px, a landscape tablet.
 */
test.describe('DEF-079: "View cost details" is a 44 px control on a touch layout (NFR-017)', () => {
  async function openCalculated(page: Page, testInfo: TestInfo): Promise<Locator> {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateWithoutThePage(page, owner);
    await openAsLead(page, testInfo, code);
    return treePanel(page).getByRole('link', { name: /^View cost details for / });
  }

  test('at the width of the project: the link is a control on a touch layout and keeps its line with a mouse; no sideways scroll; axe finds nothing', async ({ page }, testInfo) => {
    const link = await openCalculated(page, testInfo);
    await expect(link).toHaveCount(1);
    await expectLinkTarget(page, '"View cost details"', link);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test.describe('with a coarse pointer at 1280 px', () => {
    test.use({ hasTouch: true, viewport: { width: 1280, height: 800 } });

    test('a landscape tablet: the link is 44 px high although the width is 1024 px or more', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'mobile' || testInfo.project.name === 'tablet', 'the same 1280 px case in every project; read once, in the desktop project (the other two read their own width above)');
      const link = await openCalculated(page, testInfo);
      expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches), 'the context has a coarse pointer').toBe(true);
      expect(await isTouchLayout(page), 'a coarse pointer is a touch layout at any width').toBe(true);
      await expectLinkTarget(page, '"View cost details"', link);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  });
});
