import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { assignedEstimate } from './support/assigned-estimate';
import { isPatchOfInputs } from './support/part-form';
import { openTreePanel, reviewButton } from './support/review-tree';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * DL-470 (3): the Lead's page is seeded with the open row's data (DEF-141, #827) and editable (DEF-131, #806). **A row that is edited, left, and opened again shows what was saved, and the next save is accepted.** The
 * form of a row is keyed by the row, so opening a row again mounts it afresh; if that mount started from the page's first snapshot (the seed) it would show the values from before the edit, and the next save would be
 * refused 409 because it carries the revision of the snapshot. This is the case as a Lead on a Prepared estimate: edit row 1 and let it save, open row 1.1, open row 1 again, expect the saved value and a second
 * save that goes through.
 *
 * The estimate is made through the API by the set-up Lead for the set-up Engineer (**no person is made**, DL-422) and is Prepared (a Lead may correct the inputs of a Prepared estimate).
 */

const FIRST = 'Invented description, first save';
const SECOND = 'Invented description, second save';
const description = (page: Page) => page.getByRole('textbox', { name: /Description/ }).first();
const treePanel = (page: Page) => page.locator('[data-review-tree]');
const rowLink = (page: Page, row: string) => treePanel(page).locator(`a[href*="row=${row}#row-inputs"]`).first();
/** Below 1024 px the panel folds once a row is open, and its summary says which: it is opened before a row is chosen. */
async function chooseRow(page: Page, row: string): Promise<void> {
  const open = await treePanel(page).evaluate((panel) => (panel as HTMLDetailsElement).open);
  if (!open) await treePanel(page).locator('summary').click();
  await rowLink(page, row).click();
}
/** A write of the row's inputs: the answer to the form's save of a value. */
const savedAnswer = (page: Page) => page.waitForResponse((response) => response.request().method() !== 'GET' && /\/api\/v1\/estimates\/[^/]+\/nodes\/[^/]+(\/inputs)?$/.test(new URL(response.url()).pathname));

test.describe('DL-470 (3): a row opened again shows what was saved', () => {
  test('edit row 1 and save, open row 1.1, open row 1 again: the saved text is shown, and a further save is not refused', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await page.goto(`/estimates/${code}`);
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await expect(page.locator('#part-form-title')).toContainText('1');

    // Edit row 1 and let it save (leaving the box saves it).
    const first = savedAnswer(page);
    await description(page).fill(FIRST);
    await description(page).blur();
    expect((await first).status(), 'the first save').toBe(200);

    // Open the part under it, then row 1 again.
    await chooseRow(page, '1.1');
    await expect(page).toHaveURL(/row=1\.1/);
    await expect(page.locator('#part-form-title')).toContainText('1.1');
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await chooseRow(page, '1');
    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('form[data-part-form]')).toBeVisible();

    // The form shows what was saved, not the page's first snapshot.
    await expect(description(page)).toHaveValue(FIRST);

    // And the next save carries the right revision: it is accepted.
    const second = savedAnswer(page);
    await description(page).fill(SECOND);
    await description(page).blur();
    const answer = await second;
    expect(answer.status(), 'the second save (409 would be a stale revision)').toBe(200);
    await expect(description(page)).toHaveValue(SECOND);
  });
});

test.describe('The island follows the address and the leave guard still asks', () => {
  /** What the guard says and its two answers (the Engineer's own cases hold the words: estimate-save.spec.ts). */
  const leaveDialog = (page: Page) => page.getByRole('alertdialog', { name: 'Leave without saving?' });

  test('Back with a value typed and not saved asks "Leave without saving?", keeps the typed value and the open row after "Keep editing", and leaves after "Leave without saving"', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await page.goto('/queue');
    await page.goto('/estimates/' + code);
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    // A save that cannot go through keeps the value typed and not saved, which is what arms the guard.
    await page.route((url) => isPatchOfInputs(url.toString(), 'PATCH'), (route) => (route.request().method() === 'PATCH' ? route.abort() : route.continue()));
    await description(page).fill(FIRST);
    await description(page).blur();
    await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();

    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await expect(page).toHaveURL(new RegExp('/estimates/' + code));
    await leaveDialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(leaveDialog(page)).toHaveCount(0);
    await expect(description(page)).toHaveValue(FIRST);
    await expect(page.locator('#part-form-title')).toContainText('1');

    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true }).click();
    await expect(page).toHaveURL(/\/queue/);
  });

  /** The island has replaced the first paint and the open row's form is ready to be typed in. */
  async function ready(page: Page): Promise<void> {
    await expect(page.locator('[data-review-tree-reserve]')).toHaveCount(0);
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await expect(description(page)).toBeEnabled();
  }

  /** The saves that cannot go through: what is typed after this stays typed and not saved (the gate is dirty). Answers the way to let them through again. */
  async function failSaves(page: Page): Promise<() => void> {
    let failing = true;
    await page.route(
      (url) => isPatchOfInputs(url.toString(), 'PATCH'),
      (route) => (failing && route.request().method() === 'PATCH' ? route.abort() : route.continue()),
    );
    return () => {
      failing = false;
    };
  }

  /** The open row's Description while the dialog is up: the dialog hides the rest of the page from the accessibility tree, so the box is found by the tree it is in, hidden or not. */
  const descriptionBehindDialog = (page: Page) => page.getByRole('textbox', { name: /Description/, includeHidden: true }).first();

  /**
   * Back is pressed with the guard armed and text typed and not saved: the dialog asks, with the row and the text still on the screen (QLT-811-01); "Keep editing" keeps the guard armed, so a second Back asks again; then
   * the person leaves: "Leave without saving" goes to the page before, and "Save draft and leave" saves and goes there (DEF-149: the guard counted its entries wrongly once the island had rewritten the address). `finish` 'keep'
   * stays on the page instead.
   */
  async function backAsksWithTheTextStill(page: Page, title: RegExp, typed: string, finish: 'keep' | 'leave' | 'save', allowSaves: () => void = () => undefined): Promise<void> {
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await expect(page.locator('#part-form-title')).toHaveText(title);
    await expect(descriptionBehindDialog(page)).toHaveValue(typed);
    await leaveDialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(leaveDialog(page)).toHaveCount(0);
    await expect(page.locator('#part-form-title')).toHaveText(title);
    await expect(description(page)).toHaveValue(typed);
    // A second Back asks again, with the text still there.
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await expect(descriptionBehindDialog(page)).toHaveValue(typed);
    if (finish === 'keep') {
      await leaveDialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
      await expect(leaveDialog(page)).toHaveCount(0);
      await expect(description(page)).toHaveValue(typed);
      return;
    }
    if (finish === 'save') {
      allowSaves();
      await leaveDialog(page).getByRole('button', { name: 'Save draft and leave', exact: true }).click();
    } else {
      await leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true }).click();
    }
    await expect(page).toHaveURL(/\/queue/);
  }

  /** Row 1.1 is edited and saved on a Prepared estimate opened by its address from the queue: the guard has armed itself and stays armed. */
  async function openAndSaveARow(page: Page, testInfo: TestInfo): Promise<string> {
    const { code } = await assignedEstimate(page, testInfo, true);
    await page.goto('/queue');
    await page.goto('/estimates/' + code + '?row=1.1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#part-form-title')).toHaveText(/^1\.1 ·/);
    await ready(page);
    const saved = savedAnswer(page);
    await description(page).fill(FIRST);
    await description(page).blur();
    expect((await saved).status(), 'the first save').toBe(200);
    return code;
  }

  /** A part under row 1 by the "+" of the row (a menu: the Part item reads Sub-part once the row holds a part); the new row opens. */
  async function addUnderRowOne(page: Page, slNo: string): Promise<void> {
    await openTreePanel(page);
    // The page may be drawn again under the open menu (the router's replace of a row link, a refresh after a change): the menu is opened again until the item can be pressed.
    await expect(async () => {
      await reviewButton(page, 'Add under', '1').focus();
      await page.keyboard.press('Enter');
      await page.getByRole('menuitem', { name: /^(Part|Sub-part)$/ }).click({ timeout: 4000 });
    }).toPass({ timeout: 25_000 });
    await expect(page.locator('#part-form-title')).toHaveText(new RegExp('^' + slNo.replace('.', '\\.') + ' ·'));
    await expect(page.locator('form[data-part-form]')).toBeVisible();
  }

  /** Text typed in the open row whose save cannot go through. */
  async function typeAndFail(page: Page, text: string): Promise<void> {
    await description(page).fill(text);
    await description(page).blur();
    await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
  }

  test('DEF-149, QLT-811-01: a row is added with the guard armed, text is typed, Back asks with that row and its text, and "Leave without saving" leaves the page', async ({ page }, testInfo) => {
    await openAndSaveARow(page, testInfo);
    await chooseRow(page, '1');
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    await failSaves(page);
    await addUnderRowOne(page, '1.2');
    await typeAndFail(page, 'Typed and not saved');
    await backAsksWithTheTextStill(page, /^1\.2 ·/, 'Typed and not saved', 'leave');
  });

  test('DEF-149: the same steps, and "Save draft and leave" saves and leaves the page', async ({ page }, testInfo) => {
    await openAndSaveARow(page, testInfo);
    await chooseRow(page, '1');
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    const allowSaves = await failSaves(page);
    await addUnderRowOne(page, '1.2');
    await typeAndFail(page, 'Typed and saved on the way out');
    await backAsksWithTheTextStill(page, /^1\.2 ·/, 'Typed and saved on the way out', 'save', allowSaves);
  });

  test('DEF-149: two rows are added and a third is chosen before Back: Back asks, and "Leave without saving" still leaves the page', async ({ page }, testInfo) => {
    await openAndSaveARow(page, testInfo);
    await chooseRow(page, '1');
    await addUnderRowOne(page, '1.2');
    await addUnderRowOne(page, '1.3');
    await chooseRow(page, '1.2');
    await expect(page.locator('#part-form-title')).toHaveText(/^1\.2 ·/);
    await failSaves(page);
    await typeAndFail(page, 'Typed after two adds');
    await backAsksWithTheTextStill(page, /^1\.2 ·/, 'Typed after two adds', 'leave');
  });

  test('QLT-811-01: a row is moved so that the open row is renumbered, text is typed, Back asks with that part and its text still on the screen', async ({ page }, testInfo) => {
    const { code, estimateId } = await assignedEstimate(page, testInfo, true);
    const headers = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
    const tree = (await (await page.request.get(DEVELOPMENT_URL + '/api/v1/estimates/' + estimateId + '/tree')).json()) as { nodes: ReadonlyArray<{ id: string; slNo: string }> };
    const main = tree.nodes.find((node) => node.slNo === '1');
    const second = await page.request.post(DEVELOPMENT_URL + '/api/v1/estimates/' + estimateId + '/nodes', { headers, data: { parentId: main?.id ?? null, nodeKind: 'PART' } });
    expect(second.status(), 'a second part under row 1').toBe(201);
    await page.goto('/queue');
    await page.goto('/estimates/' + code + '?row=1.1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#part-form-title')).toHaveText(/^1\.1 ·/);
    await ready(page);
    const saved = savedAnswer(page);
    await description(page).fill(FIRST);
    await description(page).blur();
    expect((await saved).status(), 'the first save').toBe(200);
    // Move row 1.1 down: it is renumbered 1.2 and stays the open part.
    await failSaves(page);
    await openTreePanel(page);
    await expect(async () => {
      await reviewButton(page, 'Move', '1.1').focus();
      await page.keyboard.press('Enter');
      await page.getByRole('menuitem', { name: 'Move down', exact: true }).click({ timeout: 4000 });
    }).toPass({ timeout: 25_000 });
    await expect(page.locator('#part-form-title')).toHaveText(/^1\.2 ·/);
    await description(page).fill('Typed after the move');
    await description(page).blur();
    await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
    await backAsksWithTheTextStill(page, /^1\.2 ·/, 'Typed after the move', 'keep');
  });

  test('QLT-811-02: with nothing typed, the address moves the island: a new address for row 1.1, then Back shows row 1, then Forward shows row 1.1', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await page.goto('/estimates/' + code + '?row=1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    await ready(page);
    await page.evaluate(() => window.history.pushState(null, '', '?row=1.1#row-inputs'));
    await expect(page.locator('#part-form-title')).toHaveText(/^1\.1 ·/);
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await page.goBack();
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await page.goForward();
    await expect(page.locator('#part-form-title')).toHaveText(/^1\.1 ·/);
    await expect(page.locator('form[data-part-form]')).toBeVisible();
  });
});
