import { expect, test, type Page, type Response } from '@playwright/test';

import { TREE_CLEARED_LINE } from '../../src/components/features/estimate-review/review-texts';

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

/**
 * "Save draft and leave" saved what was typed (DL-482 (8) (a)): the save was answered 200, and the server, read back, holds every value the save carried. The text was typed in the row on screen when Back was pressed
 * (QLT-845-08), so a row that Back had drawn instead, with its fields unmounted, would have left nothing to save.
 */
async function expectStoredOnTheWayOut(page: Page, answer: Response): Promise<void> {
  expect(answer.status(), 'the typed text is saved on the way out').toBe(200);
  const sent = answer.request().postDataJSON() as { readonly values: Readonly<Record<string, string>> };
  const read = await page.request.get(new URL(answer.url()).pathname.replace(/\/inputs$/, ''));
  expect(read.status(), 'the part is read back').toBe(200);
  const stored = (await read.json()) as { readonly inputs: ReadonlyArray<{ readonly fieldId: string; readonly value: string }> };
  const held = Object.fromEntries(stored.inputs.map((entry) => [entry.fieldId, entry.value]));
  expect(Object.keys(sent.values).length, 'the save carried a value').toBeGreaterThan(0);
  for (const [fieldId, value] of Object.entries(sent.values)) expect(held[fieldId], `the server holds ${fieldId}`).toBe(value);
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
    const saved = savedAnswer(page);
    await leaveDialog(page).getByRole('button', { name: 'Save draft and leave', exact: true }).click();
    await expectStoredOnTheWayOut(page, await saved);
    await expect(page).toHaveURL(/\/queue$/);
  });
});

test.describe('DL-482 (7): a row link pressed as soon as the first save is answered (no wait for the page\'s read)', () => {
  // The person\'s timing: the page asks to read itself again 300 ms after the first save of a Prepared estimate (DEF-150, unconfirmed), and a Lead can press a row link inside that time. The set-ups elsewhere in this
  // file wait for that read as a settle wait; this case does not wait for it, so what the person can do is covered whichever way DEF-150 goes. It asserts the row asked for, the text typed in it and the history.
  test('the new row\'s address and the typed text are there after Back and "Keep editing", and no history entry was added or taken away', async ({ page }, testInfo) => {
    const { code } = await assignedEstimate(page, testInfo, true);
    await page.goto('/queue');
    await page.goto('/estimates/' + code + '?row=1.1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#part-form-title')).toContainText('1.1');
    await expect(page.locator('form[data-part-form]')).toBeVisible();
    await expect(description(page)).toBeEnabled();
    const saved = savedAnswer(page);
    await description(page).fill(FIRST);
    await description(page).blur();
    expect((await saved).status(), 'the first save').toBe(200);
    // No wait for the page's read here: the row link is pressed at once.
    await chooseRow(page, '1');
    await expect(page).toHaveURL(/row=1#row-inputs$/);
    await expect(page.locator('#part-form-title')).toHaveText(/^1 ·/);
    await expect(description(page)).toBeEnabled();
    await failSaves(page);
    await description(page).fill(TYPED);
    await description(page).blur();
    await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
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
    const saved = savedAnswer(page);
    await leaveDialog(page).getByRole('button', { name: 'Save draft and leave', exact: true }).click();
    await expectStoredOnTheWayOut(page, await saved);
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
    const saved = savedAnswer(page);
    allowSaves();
    await leaveDialog(page).getByRole('button', { name: 'Save draft and leave', exact: true }).click();
    await expectStoredOnTheWayOut(page, await saved);
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
  const saved = choice === 'Save draft and leave' ? savedAnswer(page) : null;
  await leaveDialog(page).getByRole('button', { name: choice, exact: true }).click();
  if (saved !== null) await expectStoredOnTheWayOut(page, await saved);
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
