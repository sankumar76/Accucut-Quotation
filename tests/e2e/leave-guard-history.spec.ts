import { expect, test, type Page, type Response } from '@playwright/test';

import { TREE_CLEARED_LINE } from '../../src/components/features/estimate-review/review-texts';
import { INPUT_HELD_LINE, INPUT_STUCK_BUTTON, INPUT_STUCK_LINE, INPUT_STUCK_SENTENCE } from '../../src/components/features/estimate-workspace/estimate-texts';

import { assignedEstimate } from './support/assigned-estimate';
import { changePrivateMaterial, E2E_ENGINEER, insertPrivateMaterial } from './support/auth';
import { signInAs } from './support/calculated-estimate';
import { isPatchOfInputs } from './support/part-form';

/**
 * DEF-149 (AQP-506; DL-476): **the leave guard keeps count of its own history entry across a link to another row of the same page.** On the Lead's review (the guarded editable form of #806) the guard puts one extra
 * entry of the page's address on top of the history when something is first typed, and stays armed after it is saved. A press on another row's link while it is armed was taken by the guard, which then forgot the
 * entry was there: the next thing typed put a second one on, so the way out of a Back (two steps back) landed on the same estimate page, and "Leave without saving" or "Save draft and leave" did not leave.
 *
 * The case, as the Lead does it: open row 1.1 from the queue, edit a field and leave it (saved), press the link of another row, type into that row (the save cannot go through, so the text stays typed and not
 * saved), press Back (the dialog asks), "Keep editing" (a second Back asks again), and then each way out. The page the person came from is the queue, and it must be the page they are on after "Leave without
 * saving" and after "Save draft and leave" (which saves first). Run at the three widths by the three projects. **The person ledger is +0 (DL-422):** the task is made through the API by the set-up's Lead for the
 * set-up's Engineer. Every name and path is invented.
 */

const FIRST = 'Invented description, first save';
const TYPED = 'Invented text typed in the second row';

const description = (page: Page) => page.getByRole('textbox', { name: /Description/ }).first();
/** The open row's Description while the dialog is up: the dialog hides the rest of the page from the accessibility tree, so the box is found by the tree it is in, hidden or not. */
const descriptionBehindDialog = (page: Page) => page.getByRole('textbox', { name: /Description/, includeHidden: true }).first();
const leaveDialog = (page: Page) => page.getByRole('alertdialog', { name: 'Leave without saving?' });
const treePanel = (page: Page) => page.locator('details').filter({ has: page.locator('summary', { hasText: /^Parts tree/ }) });
const rowLink = (page: Page, row: string) => treePanel(page).locator(`a[href*="row=${row}#row-inputs"]`).first();
const savedAnswer = (page: Page) => page.waitForResponse((response) => response.request().method() !== 'GET' && /\/api\/v1\/estimates\/[^/]+\/nodes\/[^/]+(\/inputs)?$/.test(new URL(response.url()).pathname));

/**
 * The page reads itself again a short while after the first save of a Prepared estimate (`review-form.tsx`: the save takes its figures to cleared, then `router.refresh()`). Next writes the router's address into the
 * current history entry when that read commits, so a link pressed before it has committed can be undone by it. The cases wait for the read to have COMMITTED before the next step (QLT-845-07): not for its answer, which
 * arrives before the page is drawn, but for what the read draws, the tree's line that says the figures are cleared. **DL-482 (7): these are settle waits, not a fix.** Whether DEF-150 (a row link pressed in the quiet period after a save is undone by that read) is a defect on `master` is UNCONFIRMED: QA did not reproduce it at desktop and tablet, and the signature first put down to it (after Back and "Keep editing", the first row's text) was QLT-845-08. If DEF-150 is confirmed, its fix removes these waits; if not, they stay. They are in the set-ups only, wait on an event and not on a timer, and no assertion of the guard depends on them.
 */
const pageRead = (page: Page) => expect(page.getByText(TREE_CLEARED_LINE)).toBeVisible();

/** The row on screen: the first word of the title of the part form ("1" or "1.1"), or null where the page has no such title. Read before a dialog's button is pressed, since the page may leave. */
async function rowOnScreen(page: Page): Promise<string | null> {
  const title = page.locator('#part-form-title');
  if ((await title.count()) === 0) return null;
  const text = (await title.first().innerText()).trim();
  return text.split(/[\s·]+/)[0] ?? null;
}

/**
 * "Save draft and leave" saved what was typed (DL-482 (8) (a), QLT-845-17): the save was answered 200, it carried the text that was typed, and the server, read back, holds that text on the part of **the row that was on
 * screen** (its `slNo` is the row's), not just some value on some part. The text was typed in the row on screen when Back was pressed (QLT-845-08), so a row that Back had drawn instead, with its fields unmounted, would have
 * left nothing to save, or something else.
 */
async function expectStoredOnTheWayOut(page: Page, answer: Response, row: string | null): Promise<void> {
  expect(answer.status(), 'the typed text is saved on the way out').toBe(200);
  const sent = answer.request().postDataJSON() as { readonly values: Readonly<Record<string, string>> };
  expect(Object.values(sent.values), 'the save carried the text that was typed').toContain(TYPED);
  const read = await page.request.get(new URL(answer.url()).pathname.replace(/\/inputs$/, ''));
  expect(read.status(), 'the part is read back').toBe(200);
  const stored = (await read.json()) as { readonly slNo: string; readonly inputs: ReadonlyArray<{ readonly fieldId: string; readonly value: string }> };
  if (row !== null) expect(stored.slNo, 'the part that holds it is the row that was on screen').toBe(row);
  const held = Object.fromEntries(stored.inputs.map((entry) => [entry.fieldId, entry.value]));
  for (const [fieldId, value] of Object.entries(sent.values)) expect(held[fieldId], `the server holds ${fieldId}`).toBe(value);
  expect(Object.values(held), 'the typed text is stored').toContain(TYPED);
}

/** Below 1024 px the tree is a foldable panel: it is opened before a row is chosen. */
async function chooseRow(page: Page, row: string): Promise<void> {
  const open = await treePanel(page).evaluate((panel) => (panel as HTMLDetailsElement).open);
  if (!open) await treePanel(page).locator('summary').click();
  await rowLink(page, row).click();
}

/** The saves that cannot go through: what is typed after this stays typed and not saved. Answers the way to let them through again. */
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

/** Row 1.1 is opened by its address from the queue, edited and saved (the guard has armed itself and stays armed); then another row's link is pressed and text is typed there that cannot be saved. */
async function typedInTheSecondRow(page: Page, code: string): Promise<() => void> {
  await page.goto('/queue');
  await page.goto('/estimates/' + code + '?row=1.1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#part-form-title')).toContainText('1.1');
  await expect(page.locator('form[data-part-form]')).toBeVisible();
  await expect(description(page)).toBeEnabled();
  const saved = savedAnswer(page);
  await description(page).fill(FIRST);
  await description(page).blur();
  expect((await saved).status(), 'the first save').toBe(200);
  // DL-482 (7), DEF-150 (UNCONFIRMED on master): a settle wait, not a fix. The row link is pressed after the page's own read has committed, so a read that lands late cannot be what this case measures. The no-wait case below covers the quick press.
  await pageRead(page);
  // QLT-845-12: nothing is unsaved at this moment (the first save was answered 200), so the history length read here is the guard's: the page's entry and the guard's entry on top.
  const lengthAtTheLink = await page.evaluate(() => window.history.length);
  await chooseRow(page, '1');
  await expect(page).toHaveURL(/row=1#row-inputs$/);
  await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
  await expect(description(page)).toBeEnabled();
  const allow = await failSaves(page);
  await description(page).fill(TYPED);
  await description(page).blur();
  await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
  // DL-487: the guard stepped off its entry for the link and pushed a fresh one on the page's own entry when this was typed; the old one it left ahead was cut by that push. So the length is what it was at the link:
  // a second entry (the way a guard that forgot its entry behaves, DEF-149) would make it one longer. It holds only because nothing was unsaved at the link (QLT-845-12).
  expect(await page.evaluate(() => window.history.length), 'typing in the second row put no second guard entry on the history').toBe(lengthAtTheLink);
  return allow;
}

/** Back asks with the text still there; "Keep editing"; a second Back asks again. */
async function backTwiceAsks(page: Page): Promise<void> {
  const lengthBefore = await page.evaluate(() => window.history.length);
  await page.evaluate(() => window.history.back());
  await expect(leaveDialog(page)).toBeVisible();
  await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
  await leaveDialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(description(page)).toHaveValue(TYPED);
  // QLT-845-08: the row on screen is still the second row, whose address is the page's, and Back and "Keep editing" added no entry and took none away.
  await expect(page).toHaveURL(/row=1#row-inputs$/);
  await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
  expect(await page.evaluate(() => window.history.length), 'Back and "Keep editing" change no history entry').toBe(lengthBefore);
  await page.evaluate(() => window.history.back());
  await expect(leaveDialog(page)).toBeVisible();
  await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
}

/**
 * The row link is pressed **before anything is typed**, so the guard is not armed and the page's own link takes the click: it replaces the page's entry (the row links of the tree replace; they never stack an entry of the
 * same page below the one the guard's push sits on). Then text is typed that cannot be saved, Back asks, and each way out lands on the page the test came from.
 */
async function typedAfterAnEarlyRowLink(page: Page, code: string): Promise<() => void> {
  await page.goto('/queue');
  await page.goto('/estimates/' + code + '?row=1.1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#part-form-title')).toContainText('1.1');
  await expect(page.locator('form[data-part-form]')).toBeVisible();
  await expect(description(page)).toBeEnabled();
  await chooseRow(page, '1');
  await expect(page).toHaveURL(/row=1#row-inputs$/);
  await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
  await expect(description(page)).toBeEnabled();
  const allow = await failSaves(page);
  await description(page).fill(TYPED);
  await description(page).blur();
  await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
  return allow;
}

test.describe('DEF-149: a row link pressed before anything is typed', () => {
  test('Back, then "Leave without saving": the queue, not the earlier row of the same page', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await typedAfterAnEarlyRowLink(page, code);
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
    await leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true }).click();
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('Back, then "Save draft and leave": the queue, with the typed text saved first', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    const allowSaves = await typedAfterAnEarlyRowLink(page, code);
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
    allowSaves();
    const row = await rowOnScreen(page);
    const saved = savedAnswer(page);
    await leaveDialog(page).getByRole('button', { name: 'Save draft and leave', exact: true }).click();
    await expectStoredOnTheWayOut(page, await saved, row);
    await expect(page).toHaveURL(/\/queue$/);
  });
});

test.describe('DL-482 (7), DL-487 c1: a row link pressed as soon as the first save is answered (no wait for the page\'s read), then typing at once', () => {
  // The person's timing: the page asks to read itself again 300 ms after the first save of a Prepared estimate (DEF-150, unconfirmed), and a Lead can press a row link inside that time and start typing as soon as the box
  // is editable. The set-ups elsewhere in this file wait for that read as a settle wait; these cases do not wait for it, so what the person can do is covered whichever way DEF-150 goes.
  async function linkedAndTypedAtOnce(page: Page, code: string): Promise<void> {
    await page.goto('/queue');
    await page.goto('/estimates/' + code + '?row=1.1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#part-form-title')).toContainText('1.1');
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await expect(description(page)).toBeEnabled();
    const saved = savedAnswer(page);
    await description(page).fill(FIRST);
    await description(page).blur();
    expect((await saved).status(), 'the first save').toBe(200);
    // No wait for the page's read here: the row link is pressed at once, and the box typed in as soon as it is editable.
    await chooseRow(page, '1');
    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    await expect(description(page)).toBeEnabled();
    await failSaves(page);
    await description(page).fill(TYPED);
    await description(page).blur();
    await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
  }

  test('the new row\'s address and the typed text are there after Back and "Keep editing", and no history entry was added or taken away', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await linkedAndTypedAtOnce(page, code);
    const lengthBefore = await historyLength(page);
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
    await leaveDialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(leaveDialog(page)).toHaveCount(0);
    await expect(description(page)).toHaveValue(TYPED);
    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    expect(await historyLength(page), 'Back and "Keep editing" change no history entry').toBe(lengthBefore);
  });

  test('"Leave without saving" lands exactly on the page before', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await linkedAndTypedAtOnce(page, code);
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
    await leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true }).click();
    await expect(page).toHaveURL(/\/queue$/);
  });
});

test.describe('DL-487 c2, c3: two quick row links; Back and Forward with nothing typed', () => {
  test('c2: two row links in quick succession resolve to the last one; typing there, Back and "Leave without saving" land exactly on the page before', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await armed(page, code);
    await chooseRow(page, '1');
    // The second link is pressed at once, without waiting for the first to be drawn.
    await rowLink(page, '1.1').click();
    await expect(page).toHaveURL(/row=1\.1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toContainText('1.1');
    await expect(description(page)).toBeEnabled();
    await failSaves(page);
    await description(page).fill(TYPED);
    await description(page).blur();
    await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
    await leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true }).click();
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('c3a: a row link, then Back with nothing typed, lands exactly on the page before with no question', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await armed(page, code);
    await chooseRow(page, '1');
    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    await page.evaluate(() => window.history.back());
    await expect(page).toHaveURL(/\/queue$/);
    await expect(leaveDialog(page)).toHaveCount(0);
  });

  test('c3b (QLT-845-21): a row link, then Back and Forward with nothing typed: the page entry shows the row of the link with its form and no question; a Forward made directly from it reaches the guard\'s old entry, which shows an estimate row of this task, with no question and nothing lost', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await armed(page, code);
    await chooseRow(page, '1');
    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    await page.evaluate(() => window.history.back());
    await expect(page).toHaveURL(/\/queue$/);
    await page.evaluate(() => window.history.forward());
    // P, the page's own entry: the row of the link, not the stale row the guard's entry carries.
    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await expect(leaveDialog(page)).toHaveCount(0);
    // A Forward made directly from P: the stale entry of the guard that lay ahead (DL-487 (2) (iii)); it is a row of this page, drawn with its form.
    await page.evaluate(() => window.history.forward());
    await expect(page).toHaveURL(new RegExp('/estimates/' + code + '\\?row=1\\.1'));
    await expect(page.locator('#part-form-title')).toContainText('1.1');
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await expect(leaveDialog(page)).toHaveCount(0);
  });
});

/** A clean page: the row opened from the queue, nothing typed, so the guard is not armed. */
async function openedClean(page: Page, code: string, row = '1.1'): Promise<void> {
  await page.goto('/queue');
  await page.goto('/estimates/' + code + `?row=${row}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#part-form-title')).toContainText(row);
  await expect(page.locator('form[data-part-form]')).toBeVisible();
  await expect(description(page)).toBeEditable();
}

/**
 * Holds the page's read of one row (its `_rsc` request) until `release()`, so a link to that row has been pressed and its write is still owed. `reached` is settled when the request is held. The hold is the
 * set-up of DL-488 u2 to u4; it adds no wait to the page and changes no budget (DL-404).
 */
async function holdRowRead(page: Page, row: string): Promise<{ readonly release: () => void; readonly reached: Promise<void>; readonly failed: Promise<void> }> {
  let release: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reach: () => void = () => undefined;
  const reached = new Promise<void>((resolve) => {
    reach = resolve;
  });
  const isIt = (url: URL): boolean => url.pathname.startsWith('/estimates/') && url.searchParams.has('_rsc') && url.searchParams.get('row') === row;
  // The held request ends as failed when the document that asked for it goes (a load): the event, not a wait.
  const failed = new Promise<void>((resolve) => {
    page.on('requestfailed', (request) => {
      if (isIt(new URL(request.url()))) resolve();
    });
  });
  await page.route(isIt, async (route) => {
    reach();
    await opened;
    // The page may be gone by now (a load): the continue then has nothing to continue.
    await route.continue().catch(() => undefined);
  });
  return { release, reached, failed };
}

/** Text that cannot be saved is typed in the row on screen, Back asks with the text still there, "Keep editing" keeps the row and the text, and "Leave without saving" lands exactly on the queue. */
async function typedBackKeepAndLeave(page: Page, row: string, withHash = true): Promise<void> {
  await failSaves(page);
  await description(page).fill(TYPED);
  await description(page).blur();
  await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
  await page.evaluate(() => window.history.back());
  await expect(leaveDialog(page)).toBeVisible();
  await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
  await leaveDialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(description(page)).toHaveValue(TYPED);
  // A row a link took the page to has `#row-inputs` in its address; a page opened by its address and loaded again has none.
  await expect(page).toHaveURL(new RegExp(`row=${row.replace('.', '\\.')}${withHash ? '#row-inputs' : ''}$`));
  await expect(page.locator('#part-form-title')).toContainText(row);
  await page.evaluate(() => window.history.back());
  await expect(leaveDialog(page)).toBeVisible();
  await leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true }).click();
  await expect(page).toHaveURL(/\/queue$/);
}

/** A key every 500 ms through a hold of about `ms`: no character is accepted into the box (it is read-only), and the focus stays where it is. */
async function keysThroughTheHold(page: Page, ms: number): Promise<void> {
  const before = await description(page).inputValue();
  await description(page).focus();
  for (let elapsed = 0; elapsed < ms; elapsed += 500) {
    await page.keyboard.press('Z');
    await page.waitForTimeout(500);
  }
  await expect(description(page)).toHaveValue(before);
}

test.describe('DL-488 u2, u3, u4 (QLT-845-19): a row link whose write is still owed', () => {
  test('u2 (the unarmed superseded link): clean page, row 1\'s read held, row 1 pressed, then row 1.1 (the row on screen), released, typed: Back asks, Keep editing keeps row 1.1 and the text, Leave lands on the queue', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await openedClean(page, code);
    const held = await holdRowRead(page, '1');
    await chooseRow(page, '1');
    await held.reached;
    // The row on screen is still 1.1: the link back to it is pressed before row 1 has been drawn (the guard takes it and writes it once row 1 has landed).
    await chooseRow(page, '1.1');
    held.release();
    await expect(page).toHaveURL(/row=1\.1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toContainText('1.1');
    // The hold ends with the write, not by its 5 s fail-open end (QLT-845-24): the real links end in `#row-inputs`, so the link back to the row on screen has to be taken by the guard like any other.
    await expect(description(page)).toBeEditable({ timeout: 2500 });
    await typedBackKeepAndLeave(page, '1.1');
  });

  test('u3: with row 1\'s read held, no key is accepted into the form (readonly and aria-readonly, never disabled), the form is busy, and the one polite line is said; once it has landed, typing in row 1 is guarded', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await openedClean(page, code);
    const held = await holdRowRead(page, '1');
    await chooseRow(page, '1');
    await held.reached;
    const form = page.locator('form[data-part-form]');
    await expect(description(page)).toHaveAttribute('readonly', '');
    await expect(description(page)).toHaveAttribute('aria-readonly', 'true');
    await expect(description(page)).not.toBeDisabled();
    await expect(form).toHaveAttribute('aria-busy', 'true');
    // A person types into the held box: the focus is there (readonly keeps it) and every key is refused, not accepted and then dropped.
    const before = await description(page).inputValue();
    await description(page).focus();
    await page.keyboard.type(TYPED);
    await expect(description(page)).toHaveValue(before);
    // 300 ms or more: the one polite line (UX ruling on AQP-506).
    // The line is the one live voice, in a region directly before the form and outside it, with no aria-busy of its own (QLT-845-26; UX ruling leave-guard-slow-row-notice R1, R2).
    await expect(page.locator('p[data-input-held-line]')).toHaveText(INPUT_HELD_LINE);
    await expect(page.locator('[data-input-held-region] + form[data-part-form]')).toHaveCount(1);
    await expect(page.locator('[data-input-held-region]')).not.toHaveAttribute('aria-busy', /.*/);
    await expect(form.locator('p[data-input-held-line]')).toHaveCount(0);
    // Not yet 5 s: no notice (R3).
    await expect(page.locator('[data-input-held-slow]')).toHaveCount(0);
    held.release();
    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    await expect(description(page)).toBeEditable();
    await expect(form).not.toHaveAttribute('aria-busy', 'true');
    await typedBackKeepAndLeave(page, '1');
  });

  test('u4 (the slow-save case, not DL-488\'s trap: a row link waits for every save in flight): the link waits for the save, the row changes when it has landed, typing in the new row is guarded, and nothing is lost', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await armed(page, code);
    let finish: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let reach: () => void = () => undefined;
    const reached = new Promise<void>((resolve) => {
      reach = resolve;
    });
    await page.route(
      (url) => isPatchOfInputs(url.toString(), 'PATCH'),
      async (route) => {
        if (route.request().method() === 'PATCH') {
          reach();
          await finished;
        }
        await route.continue();
      },
    );
    await description(page).fill('Invented text, second save');
    await description(page).blur();
    await reached;
    await chooseRow(page, '1');
    // The page waits for the save in flight before it lets the link through: row 1.1 is still shown.
    await expect(page.locator('#part-form-title')).toContainText('1.1');
    finish();
    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    await expect(description(page)).toBeEditable();
    await failSaves(page);
    await description(page).fill(TYPED);
    await description(page).blur();
    await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
    await backTwiceAsks(page);
  });
});

test.describe('DL-489 u5a, u5b, u4f (QLT-845-25): a row write that is slow, and a failed save before a row change', () => {
  /** The notice and its button after 5 s, outside the form and before it (UX ruling leave-guard-slow-row-notice R1 to R3). */
  async function expectTheNotice(page: Page, formWidth: number): Promise<void> {
    await expect(page.locator('[data-input-held-slow]')).toBeVisible();
    // UX ruling R4: the notice does not take a column of its own beside the form (the form's card is a flex row on the Engineer's page), so the form keeps its width; R5: the button is its own width, not the notice's.
    const formBox = await page.locator('form[data-part-form]').boundingBox();
    expect(Math.abs((formBox?.width ?? 0) - formWidth), 'the form keeps its width when the notice comes').toBeLessThanOrEqual(1);
    const noticeBox = await page.locator('[data-input-held-region] > div').boundingBox();
    const buttonBox = await page.locator('[data-input-held-stay]').boundingBox();
    expect(buttonBox?.width ?? Infinity, 'the button is not as wide as the notice').toBeLessThan((noticeBox?.width ?? 0) - 40);
    await expect(page.locator('[data-input-held-slow]')).toHaveText(INPUT_STUCK_SENTENCE);
    await expect(page.locator('[data-input-held-region] + form[data-part-form]')).toHaveCount(1);
    await expect(page.locator('p[data-input-held-line]')).toHaveText(INPUT_STUCK_LINE);
    await expect(page.locator('[data-input-held-stay]')).toBeVisible();
    await expect(page.locator('[data-input-held-stay]')).toHaveText(INPUT_STUCK_BUTTON);
    // The notice carries no live role of its own: the one polite line is the only live voice.
    await expect(page.locator('[data-input-held-region] [role="alert"]')).toHaveCount(0);
    await expect(page.locator('form[data-part-form]')).toHaveAttribute('aria-busy', 'true');
    await expect(description(page)).toHaveAttribute('readonly', '');
  }

  test('u5a: row 1\'s read held for about 6.5 s: a key every 500 ms is accepted into no box, the notice shows after 5 s; after the release the row is editable within 2.5 s, typing is guarded, Back asks, Keep editing keeps row 1 and the text, Leave lands on the queue', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await openedClean(page, code);
    const formWidth = (await page.locator('form[data-part-form]').boundingBox())?.width ?? 0;
    const held = await holdRowRead(page, '1');
    await chooseRow(page, '1');
    await held.reached;
    await keysThroughTheHold(page, 6500);
    await expectTheNotice(page, formWidth);
    held.release();
    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    await expect(description(page)).toBeEditable({ timeout: 2500 });
    // No key of the stream reached row 1's box either, and the notice went with the hold (R3).
    await expect(description(page)).not.toHaveValue(/Z/);
    await expect(page.locator('[data-input-held-slow]')).toHaveCount(0);
    await typedBackKeepAndLeave(page, '1');
  });

  // DL-490 (QLT-845-29). After a tree row link the address ends in `#row-inputs`, and `location.replace` of that address with itself is a fragment navigation, not a load: the document stays, Next ignores the
  // `popstate` (no state), and the slow read goes on. "Stay on this row" is `location.reload()`, which is a load whatever the address.

  /** A page the Lead reached by a tree row link: opened on row 1, then row 1.1's link pressed, so the address ends `?row=1.1#row-inputs`. */
  async function reachedByRowLink(page: Page, code: string): Promise<void> {
    await openedClean(page, code, '1');
    await chooseRow(page, '1.1');
    await expect(page).toHaveURL(/row=1\.1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toContainText('1.1');
    await expect(description(page)).toBeEditable();
  }

  /** The press of "Stay on this row" is a real load: the marker of the old document is gone, the navigation type is `reload`, the address and the history length are as they were, and the held read ended as failed. */
  async function expectRealLoad(page: Page, held: { readonly failed: Promise<void> }, address: RegExp, lengthBefore: number): Promise<void> {
    await page.evaluate(() => Reflect.set(window, '__sameDocument', true));
    await page.locator('[data-input-held-stay]').click();
    await page.waitForFunction(() => Reflect.get(window, '__sameDocument') !== true);
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    expect(await page.evaluate(() => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).type), 'a load of the current entry').toBe('reload');
    await expect(page).toHaveURL(address);
    expect(await historyLength(page), 'the load added no entry').toBe(lengthBefore);
    // The slow read of the other row ended with the document (no fixed wait: the event).
    await held.failed;
  }

  test('u5b: from a row link (the address ends #row-inputs): the hold, then "Stay on this row" is one real load of row 1.1 (marker gone, navigation type reload, address and history length unchanged, the held read aborted); typing then is guarded, and Back asks with the text kept', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await reachedByRowLink(page, code);
    const formWidth = (await page.locator('form[data-part-form]').boundingBox())?.width ?? 0;
    const held = await holdRowRead(page, '1');
    await chooseRow(page, '1');
    await held.reached;
    await keysThroughTheHold(page, 5500);
    await expectTheNotice(page, formWidth);
    await expectRealLoad(page, held, /row=1\.1#row-inputs$/, await historyLength(page));
    held.release();
    await expect(page.locator('#part-form-title')).toContainText('1.1');
    await expect(page.locator('#part-form-title')).not.toHaveText(/^1 ·/);
    await expect(description(page)).toBeEditable();
    await expect(page.locator('[data-input-held-slow]')).toHaveCount(0);
    await typedBackKeepAndLeave(page, '1.1');
  });

  test('u5b-plain: from a page opened by its address (no #): the same hold and the same real load', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await openedClean(page, code);
    const formWidth = (await page.locator('form[data-part-form]').boundingBox())?.width ?? 0;
    const held = await holdRowRead(page, '1');
    await chooseRow(page, '1');
    await held.reached;
    await keysThroughTheHold(page, 5500);
    await expectTheNotice(page, formWidth);
    await expectRealLoad(page, held, /row=1\.1$/, await historyLength(page));
    held.release();
    await expect(page.locator('#part-form-title')).toContainText('1.1');
    await expect(description(page)).toBeEditable();
    await typedBackKeepAndLeave(page, '1.1', false);
  });

  test('u5c (the route the reviewer found, probe 6): from a row link, with row 1\'s read held, a script\'s location.replace(location.href) is a fragment navigation: the fields stay read-only, no key of a stream (one per frame, over a second) is accepted, the guard pushes no entry; after the release row 1 is editable within 2.5 s, typing is guarded, and Back asks with the text kept', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await reachedByRowLink(page, code);
    const held = await holdRowRead(page, '1');
    await chooseRow(page, '1');
    await held.reached;
    await expect(description(page)).toHaveAttribute('readonly', '');
    const lengthBefore = await historyLength(page);
    await page.evaluate(() => {
      Reflect.set(window, '__sameDocument', true);
      window.location.replace(window.location.href);
    });
    // Nothing loaded: the marker is there. One key per animation frame for a second and a bit.
    await description(page).focus();
    const before = await description(page).inputValue();
    for (let frame = 0; frame < 75; frame += 1) {
      await page.keyboard.press('Z');
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    }
    expect(await page.evaluate(() => Reflect.get(window, '__sameDocument')), 'a fragment navigation loads nothing').toBe(true);
    await expect(description(page)).toHaveAttribute('readonly', '');
    await expect(description(page)).toHaveValue(before);
    expect(await historyLength(page), 'the guard pushed no entry').toBe(lengthBefore);
    held.release();
    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    await expect(description(page)).toBeEditable({ timeout: 2500 });
    await expect(description(page)).not.toHaveValue(/Z/);
    await typedBackKeepAndLeave(page, '1');
  });

  test('u4f: the old row\'s save fails, another row\'s link is pressed, the dialog asks, "Leave without saving" shows the new row; typing there (the save fails) is guarded: Back asks, Keep editing keeps the new row and the text, and Leave lands exactly on the queue', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await openedClean(page, code);
    await failSaves(page);
    await description(page).fill(FIRST);
    await description(page).blur();
    await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
    await chooseRow(page, '1');
    await expect(leaveDialog(page)).toBeVisible();
    await leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true }).click();
    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    await expect(description(page)).toBeEditable();
    await typedBackKeepAndLeave(page, '1');
  });
});

// Evidence for the pull request and for NFR-019, recorded with the browser's version: whether a listener added to the window with `capture: true` runs before one added without it in this browser. No code of the product
// depends on the answer (DL-487: option A, which did, was withdrawn); this only records it, so a later reader sees what each engine does. It asserts nothing about the value.
test.describe('engine order of window listeners (evidence only)', () => {
  test('records the order for this browser', async ({ page, browser, browserName }, testInfo) => {
    await page.goto('about:blank');
    const captureFirst = await page.evaluate(() => {
      const order: string[] = [];
      const bubble = (): void => void order.push('bubble');
      const capture = (): void => void order.push('capture');
      window.addEventListener('leave-guard-order-probe', bubble);
      window.addEventListener('leave-guard-order-probe', capture, true);
      window.dispatchEvent(new Event('leave-guard-order-probe'));
      window.removeEventListener('leave-guard-order-probe', bubble);
      window.removeEventListener('leave-guard-order-probe', capture, true);
      return order[0] === 'capture';
    });
    testInfo.annotations.push({ type: 'engine-order', description: `${browserName} ${browser.version()}: on the window, the capture listener runs first = ${String(captureFirst)}` });
    expect(typeof captureFirst).toBe('boolean');
  });
});

test.describe('DEF-149: Back after a link to another row of the same page', () => {
  // The landing address is exact: the page before the estimate page is the queue, so a way out that goes one entry too far (to the page before the queue) is a failure and not "the page is left" (DL-476 note 7).
  test('Back, then "Leave without saving": the queue, and no entry further back', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await typedInTheSecondRow(page, code);
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true }).click();
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('Back, Back again with the dialog up, then "Leave without saving": the queue, not the entry before it (the overshoot)', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await typedInTheSecondRow(page, code);
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true }).click();
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('Back, then "Save draft and leave": the queue, and the typed text is saved first', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    const allowSaves = await typedInTheSecondRow(page, code);
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    allowSaves();
    const row = await rowOnScreen(page);
    const saved = savedAnswer(page);
    await leaveDialog(page).getByRole('button', { name: 'Save draft and leave', exact: true }).click();
    await expectStoredOnTheWayOut(page, await saved, row);
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('"Leave without saving" leaves the page: the one before is shown', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await typedInTheSecondRow(page, code);
    await backTwiceAsks(page);
    await leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true }).click();
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('"Save draft and leave" saves what was typed and leaves the page', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    const allowSaves = await typedInTheSecondRow(page, code);
    await backTwiceAsks(page);
    // The answer of the save is waited for (QLT-845-07), as the other "Save draft and leave" cases do: the listener is made before the saves are let through, and the landing is read after it.
    const row = await rowOnScreen(page);
    const saved = savedAnswer(page);
    allowSaves();
    await leaveDialog(page).getByRole('button', { name: 'Save draft and leave', exact: true }).click();
    await expectStoredOnTheWayOut(page, await saved, row);
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('"Keep editing" keeps the guard armed: the page stays, the text stays, and a later Back asks again', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await typedInTheSecondRow(page, code);
    await backTwiceAsks(page);
    await leaveDialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(leaveDialog(page)).toHaveCount(0);
    await expect(description(page)).toHaveValue(TYPED);
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await expect(page).toHaveURL(/\/estimates\//);
  });
});

/**
 * DL-476 note 8, R1: **a link to a place on the page adds no history entry while the guard is installed.** The browser pushes one for it (the skip link `#main`, the rates-changed notice's `#review-calculate`), and the
 * guard's way out (two steps back from its own entry) then lands on the page itself. The guard does such a jump itself: it replaces the `#` of the address and moves scroll and focus (`leave-guard.ts`, `onFragmentClick`).
 * Each case lands on the exact address of the page before (`/queue`), with both choices of the dialog. Cases (vii) to (ix) of the ruling, and the one it did not name: a jump made while the page was still clean, before
 * the first keystroke (an entry made then would sit under the guard's entry). The person ledger is still +0 (the set-up's Lead and Engineer; the material of (vii) is not a person).
 */

const CHOICES = ['Leave without saving', 'Save draft and leave'] as const;

/** The page's history length: a jump that added an entry would show here. */
const historyLength = (page: Page): Promise<number> => page.evaluate(() => window.history.length);

/** Opens the estimate from the queue (so the queue is the page before it), edits a field and leaves it: saved, and the guard has armed itself and stays armed. */
async function armed(page: Page, code: string, row: string | null = '1.1', prepared = true): Promise<void> {
  await page.goto('/queue');
  await page.goto('/estimates/' + code + (row === null ? '' : `?row=${row}`), { waitUntil: 'domcontentloaded' });
  if (row !== null) await expect(page.locator('#part-form-title')).toContainText(row);
  await expect(page.locator('form[data-part-form]')).toBeVisible();
  await expect(description(page)).toBeEnabled();
  const saved = savedAnswer(page);
  await description(page).fill(FIRST);
  await description(page).blur();
  expect((await saved).status(), 'the first save').toBe(200);
  // DL-482 (7), DEF-150 (UNCONFIRMED on master): a settle wait, not a fix. A Prepared estimate reads itself again after its first save and draws the line that says its figures are cleared; what is pressed next waits for that read. A Draft does not read itself again.
  if (prepared) await pageRead(page);
}

/**
 * The guard is armed by typing that cannot be saved (QLT-845-10): no save goes through, so the page does not clear its figures and read itself again, and a notice that only a page with current figures draws (the
 * rates-changed notice) stays. Answers the way to let the saves through again. No wait is added.
 */
async function armedUnsaved(page: Page, code: string, row = '1.1'): Promise<() => void> {
  await page.goto('/queue');
  await page.goto('/estimates/' + code + `?row=${row}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#part-form-title')).toContainText(row);
  await expect(page.locator('form[data-part-form]')).toBeVisible();
  await expect(description(page)).toBeEnabled();
  const allow = await failSaves(page);
  await description(page).fill(FIRST);
  await description(page).blur();
  await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
  return allow;
}

/** After a jump: text that cannot be saved is typed, Back asks with the text still there, and the chosen way out lands on the page before. A case that armed the guard by failing saves already passes its way to let them through. */
async function typeBackAndLeave(page: Page, choice: (typeof CHOICES)[number], alreadyFailing?: () => void): Promise<void> {
  const allow = alreadyFailing ?? (await failSaves(page));
  await description(page).fill(TYPED);
  await description(page).blur();
  await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
  await page.evaluate(() => window.history.back());
  await expect(leaveDialog(page)).toBeVisible();
  await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
  allow();
  const row = await rowOnScreen(page);
  const saved = choice === 'Save draft and leave' ? savedAnswer(page) : null;
  await leaveDialog(page).getByRole('button', { name: choice, exact: true }).click();
  if (saved !== null) await expectStoredOnTheWayOut(page, await saved, row);
  await expect(page).toHaveURL(/\/queue$/);
}

for (const choice of CHOICES) {
  test.describe(`DEF-149 (R1): a link to a place on the page, then Back and "${choice}"`, () => {
    test('(viii) the skip link, with the guard armed: no entry is added, and the way out is the queue', async ({ page }, testInfo) => {
      const { code } = await assignedEstimate(page, testInfo, false);
      await armed(page, code, '1.1', false);
      const before = await historyLength(page);
      // The skip link is the first stop of the page; the Description field has the focus after the save, so the link is given the focus here and pressed with Enter.
      await page.evaluate(() => (document.querySelector('a[href="#main"]') as HTMLElement | null)?.focus());
      await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#main$/);
      expect(await historyLength(page), 'the jump added no history entry').toBe(before);
      await typeBackAndLeave(page, choice);
    });

    test('(xi) the skip link while the page is still clean, then the first keystroke: no entry sits under the guard\'s, and the way out is the queue', async ({ page }, testInfo) => {
      const { code } = await assignedEstimate(page, testInfo, false);
      await page.goto('/queue');
      await page.goto('/estimates/' + code + '?row=1.1', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#part-form-title')).toContainText('1.1');
      await expect(description(page)).toBeEnabled();
      const before = await historyLength(page);
      await page.evaluate(() => (document.querySelector('a[href="#main"]') as HTMLElement | null)?.focus());
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#main$/);
      expect(await historyLength(page), 'the jump added no history entry').toBe(before);
      await typeBackAndLeave(page, choice);
    });

    test('(vii) the rates-changed notice\'s link, pressed with Enter with the guard armed: Recalculate has the focus, the address ends #review-calculate, no entry is added, and the way out is the queue', async ({ page }, testInfo) => {
      const materialId = await insertPrivateMaterial({ pricePerKg: '137.37', specificGravity: '7.37', scrapRate: '27.37' });
      const { code } = await assignedEstimate(page, testInfo, true, materialId);
      await changePrivateMaterial(materialId, { pricePerKg: '9137.73', specificGravity: '7.37', scrapRate: '27.37' });
      // QLT-845-10: the notice is drawn only while the figures are current, so the guard is armed by typing that is not saved (the figures stay), not by a save that clears them.
      const allow = await armedUnsaved(page, code);
      const notice = page.getByRole('status').filter({ hasText: 'Rates changed since this was calculated.' });
      await expect(notice).toBeVisible();
      const link = notice.getByRole('link', { name: 'Recalculate' });
      const before = await historyLength(page);
      await link.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#review-calculate$/);
      await expect(page.locator('#review-calculate')).toBeFocused();
      expect(await historyLength(page), 'the jump added no history entry').toBe(before);
      await typeBackAndLeave(page, choice, allow);
    });

    test('(ix) the Engineer\'s page, armed, a section-strip link: no entry is added, the section\'s heading has the focus, and the way out is the queue', async ({ page }, testInfo) => {
      const { code } = await assignedEstimate(page, testInfo, false);
      await signInAs(page, E2E_ENGINEER);
      await armed(page, code, null, false);
      const before = await historyLength(page);
      const addressBefore = page.url();
      const strip = page.locator('[data-section-strip] a').nth(1);
      // QLT-845-11 (PF-24b): the link names its section's heading; its own handler moves the focus there and prevents the default, so the address does not change either.
      const named = (await strip.getAttribute('href')) ?? '';
      expect(named, 'the strip link names a heading on the page').toMatch(/^#.+/);
      await strip.click();
      expect(await historyLength(page), 'the jump added no history entry').toBe(before);
      await expect(page.locator(`[id="${named.slice(1)}"]`)).toBeFocused();
      expect(page.url(), 'the strip writes no hash').toBe(addressBefore);
      await typeBackAndLeave(page, choice);
    });
  });
}

test.describe('PF-23, PF-24 (ux ruling, section 11): the behaviour of the links', () => {
  test('PF-23a: three rows chosen by their links, then Back with nothing typed, shows the page before the review and not the previous row', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, false);
    await page.goto('/queue');
    await page.goto('/estimates/' + code, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    for (const row of ['1', '1.1', '1']) {
      await chooseRow(page, row);
      await expect(page).toHaveURL(new RegExp(`row=${row.replace('.', '\\.')}#row-inputs$`));
    }
    await page.evaluate(() => window.history.back());
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('PF-23b: a Ctrl-click on a row link opens it in a new tab, and this page\'s address is unchanged', async ({ page, context }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, false);
    await page.goto('/estimates/' + code + '?row=1.1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    const here = page.url();
    const open = await treePanel(page).evaluate((panel) => (panel as HTMLDetailsElement).open);
    if (!open) await treePanel(page).locator('summary').click();
    const opened = context.waitForEvent('page');
    await rowLink(page, '1').click({ modifiers: ['Control'] });
    const tab = await opened;
    await expect(tab).toHaveURL(/row=1#row-inputs$/);
    expect(page.url(), 'this page\'s address is unchanged').toBe(here);
  });

  test('PF-24a and PF-24c: the skip link with Enter, then Tab: focus is inside main, the address ends #main and the history is no longer; with nothing unsaved Back leaves with no question', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, false);
    await page.goto('/queue');
    await page.goto('/estimates/' + code + '?row=1.1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    const before = await historyLength(page);
    await page.evaluate(() => (document.querySelector('a[href="#main"]') as HTMLElement | null)?.focus());
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    expect(await historyLength(page), 'the jump added no history entry').toBe(before);
    await page.keyboard.press('Tab');
    const inMain = await page.evaluate(() => document.activeElement instanceof Element && document.activeElement.closest('main') !== null && document.activeElement.getAttribute('href') !== '#main');
    expect(inMain, 'the next Tab lands on something inside main').toBe(true);
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/queue$/);
  });
});

/**
 * QLT-845-09: the queue and the estimate are ONE document, or a value on the window cannot show whether a traversal loaded the page again. The queue is opened by its address (one load), a marker is set on its window, and
 * the estimate is reached by pressing the task's link in the queue (a router push, no load). `?q=` makes the Lead's queue show this task whatever else the shared database holds.
 */
const MARKER = '__stillTheSamePage';
const queueOf = (code: string): string => `/queue?q=${encodeURIComponent(code)}`;
const QUEUE_OF_TASK = /\/queue\?q=[^#]+$/;
const markerIsSet = (page: Page): Promise<unknown> => page.evaluate((name) => Reflect.get(window, name), MARKER);

async function openedFromTheQueue(page: Page, code: string): Promise<void> {
  await page.goto(queueOf(code));
  const link = page.locator(`a[href="/estimates/${encodeURIComponent(code)}"]:visible`).first();
  await expect(link).toBeVisible();
  await page.evaluate((name) => Reflect.set(window, name, true), MARKER);
  await link.click();
  await expect(page).toHaveURL(/\/estimates\/[^/?#]+$/);
  await expect(page.locator('form[data-part-form]')).toBeVisible();
  expect(await markerIsSet(page), 'the estimate was opened by the router and not by a load').toBe(true);
}

/** The skip link, pressed with Enter: the guard rewrites the address with a `#` and adds no entry. */
async function skipLinkJump(page: Page): Promise<void> {
  await page.evaluate(() => (document.querySelector('a[href="#main"]') as HTMLElement | null)?.focus());
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
}

test.describe('R1: the # a jump writes is a real entry of the router', () => {
  test('Back and Forward through the entry the jump rewrote are soft navigations: Next keeps its router state, and nothing is loaded again', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, false);
    await openedFromTheQueue(page, code);
    await skipLinkJump(page);
    await page.evaluate(() => window.history.back());
    await expect(page).toHaveURL(QUEUE_OF_TASK);
    expect(await markerIsSet(page), 'Back out of the rewritten entry was a soft navigation').toBe(true);
    await page.evaluate(() => window.history.forward());
    await expect(page).toHaveURL(/\/estimates\/[^/?#]+#main$/);
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    expect(await markerIsSet(page), 'Forward into the rewritten entry was a soft navigation').toBe(true);
    expect(await page.evaluate(() => performance.getEntriesByType('navigation').length), 'one document load in all').toBe(1);
  });

  test('typed text and the guard survive Back out of the rewritten entry: the dialog asks, the text is behind it, nothing is loaded again, and "Keep editing" shows the text', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, false);
    await openedFromTheQueue(page, code);
    await skipLinkJump(page);
    await expect(description(page)).toBeEnabled();
    await failSaves(page);
    await description(page).fill(TYPED);
    await description(page).blur();
    await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
    expect(await markerIsSet(page), 'Back to the guard was a soft navigation').toBe(true);
    await leaveDialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(leaveDialog(page)).toHaveCount(0);
    await expect(description(page)).toHaveValue(TYPED);
    expect(await markerIsSet(page), 'still the same document after "Keep editing"').toBe(true);
  });
});

test.describe('R1: the # a jump writes survives the page being read again', () => {
  test('the skip link, then a save that makes the page read itself again (router.refresh): the address still ends #main, with the row', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await page.goto('/queue');
    await page.goto('/estimates/' + code + '?row=1.1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#part-form-title')).toContainText('1.1');
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await expect(description(page)).toBeEnabled();
    await page.evaluate(() => (document.querySelector('a[href="#main"]') as HTMLElement | null)?.focus());
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    // The first save of a Prepared estimate takes its figures to cleared, and the page then reads itself again (`review-form.tsx`: a refresh a short while after the save).
    const saved = savedAnswer(page);
    await description(page).fill(FIRST);
    await description(page).blur();
    expect((await saved).status(), 'the save').toBe(200);
    // The read has COMMITTED when the page draws what it brought: the tree's line that says the figures are cleared. Only then is the address read, so it cannot pass before the router has written its own.
    await pageRead(page);
    await expect(description(page)).toHaveValue(FIRST);
    await expect(page).toHaveURL(/row=1\.1.*#main$/);
  });
});
