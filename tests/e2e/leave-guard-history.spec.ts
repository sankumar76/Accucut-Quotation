import { expect, test, type Page } from '@playwright/test';

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
 * current history entry when that read commits, so a link pressed before it has committed can be undone by it. The cases wait for that read, by its answer, before the next step (QLT-845-07); that a row link pressed in
 * the quiet period is undone by it is reported as its own finding.
 */
const pageRead = (page: Page) => page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).searchParams.has('_rsc'));

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
  const read = pageRead(page);
  await description(page).fill(FIRST);
  await description(page).blur();
  expect((await saved).status(), 'the first save').toBe(200);
  await read;
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
  await page.evaluate(() => window.history.back());
  await expect(leaveDialog(page)).toBeVisible();
  await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
  await leaveDialog(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(description(page)).toHaveValue(TYPED);
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
    expect((await saved).status(), 'the typed text is saved on the way out').toBe(200);
    await expect(page).toHaveURL(/\/queue$/);
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
    expect((await saved).status(), 'the typed text is saved on the way out').toBe(200);
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
    expect((await saved).status(), 'the typed text is saved on the way out').toBe(200);
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
  // A Prepared estimate reads itself again after its first save; a Draft does not.
  const read = prepared ? pageRead(page) : null;
  await description(page).fill(FIRST);
  await description(page).blur();
  expect((await saved).status(), 'the first save').toBe(200);
  if (read !== null) await read;
}

/** After a jump: text that cannot be saved is typed, Back asks with the text still there, and the chosen way out lands on the page before. */
async function typeBackAndLeave(page: Page, choice: (typeof CHOICES)[number]): Promise<void> {
  const allow = await failSaves(page);
  await description(page).fill(TYPED);
  await description(page).blur();
  await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toBeVisible();
  await page.evaluate(() => window.history.back());
  await expect(leaveDialog(page)).toBeVisible();
  await expect(descriptionBehindDialog(page)).toHaveValue(TYPED);
  allow();
  const saved = choice === 'Save draft and leave' ? savedAnswer(page) : null;
  await leaveDialog(page).getByRole('button', { name: choice, exact: true }).click();
  if (saved !== null) expect((await saved).status(), 'the typed text is saved on the way out').toBe(200);
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
      await armed(page, code);
      const notice = page.getByRole('status').filter({ hasText: 'Rates changed since this was calculated.' });
      await expect(notice).toBeVisible();
      const link = notice.getByRole('link', { name: 'Recalculate' });
      const before = await historyLength(page);
      await link.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#review-calculate$/);
      await expect(page.locator('#review-calculate')).toBeFocused();
      expect(await historyLength(page), 'the jump added no history entry').toBe(before);
      await typeBackAndLeave(page, choice);
    });

    test('(ix) the Engineer\'s page, armed, a section-strip link: no entry is added, the section\'s heading has the focus, and the way out is the queue', async ({ page }, testInfo) => {
      const { code } = await assignedEstimate(page, testInfo, false);
      await signInAs(page, E2E_ENGINEER);
      await armed(page, code, null, false);
      const before = await historyLength(page);
      const strip = page.locator('[data-section-strip] a').nth(1);
      await strip.click();
      expect(await historyLength(page), 'the jump added no history entry').toBe(before);
      await expect(page.locator('[data-section-strip] a').nth(1)).toBeVisible();
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
    // The first save of a Prepared estimate takes its figures to cleared, and the page then reads itself again (`review-form.tsx`: a refresh a short while after the save). That is a fetch of the page's data.
    const read = page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).searchParams.has('_rsc'));
    const saved = savedAnswer(page);
    await description(page).fill(FIRST);
    await description(page).blur();
    expect((await saved).status(), 'the save').toBe(200);
    await read;
    // Let the page take what the read brought, then the address must be as the jump left it.
    await expect(description(page)).toHaveValue(FIRST);
    await expect(page).toHaveURL(/row=1\.1.*#main$/);
  });
});
