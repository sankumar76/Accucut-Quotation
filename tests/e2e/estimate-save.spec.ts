import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilAccountMenuIsLive } from './support/design-system';
import { control, isPatchOfInputs, nextSave, openForm, partForm, showTree, waitForForm } from './support/part-form';

/**
 * STORY-05.08 (AC-1 to AC-6, AC-8): saving a draft and the warning on leaving, for an Engineer, at 360x800, 768x1024 and 1366x768. Each test signs in as a person of its own with a draft estimate and one
 * part (`openForm`), and types with the keyboard. A save that cannot be sent is made by refusing the route of the save (`route.abort`), which is what a lost connection does to the page. The words are the UX
 * spec's and the story's, written out here and not imported, so a changed sentence fails a test. What the database holds (the revisions, the transaction, the lock) is judged in
 * `tests/integration/estimates/revision-rules.test.ts`. Every name and path is invented.
 *
 * Each test signs in and opens the form, which is most of its time, so the tests do several things each, and the limit is one minute (the shards run four at a time).
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context }) => {
  test.setTimeout(60_000);
  await useFreshAddress(context);
});

const SAVE_ROUTE = '**/api/v1/estimates/*/nodes/*/inputs';
const DRAFT_SAVED = /^Draft saved at \d{2}:\d{2} IST\.$/;
const LEAVE_TITLE = 'Leave without saving?';
const NOT_SAVED_TITLE = 'The change was not saved';

const saveDraftButton = (page: Page) => page.getByRole('button', { name: 'Save draft', exact: true });
const draftStatus = (page: Page) => page.locator('[data-draft-status]');
/** The alert of Save draft, in the action bar. Scoped, because Next.js keeps an empty alert of its own for route changes. */
const draftAlert = (page: Page) => page.locator('[data-calculate-bar]').getByRole('alert');
const brandLink = (page: Page) => page.getByRole('link', { name: /AccuCut logo/ });
const leaveDialog = (page: Page) => page.getByRole('alertdialog', { name: LEAVE_TITLE });
const keepEditing = (page: Page) => leaveDialog(page).getByRole('button', { name: 'Keep editing', exact: true });
const leaveWithout = (page: Page) => leaveDialog(page).getByRole('button', { name: 'Leave without saving', exact: true });
const saveAndLeave = (page: Page) => leaveDialog(page).getByRole('button', { name: 'Save draft and leave', exact: true });

/** The saves this page has sent so far. */
function countSaves(page: Page): { readonly count: () => number } {
  let sent = 0;
  page.on('request', (request) => {
    if (isPatchOfInputs(request.url(), request.method())) sent += 1;
  });
  return { count: () => sent };
}

const failSaves = async (page: Page): Promise<void> => {
  await page.route(SAVE_ROUTE, (route) => route.abort('failed'));
};
const allowSaves = (page: Page): Promise<void> => page.unroute(SAVE_ROUTE);

/**
 * Waits until the page itself shows that nothing is unsaved (DEF-041, AQP-344). The status of a save's response is not that: the page's own bookkeeping finishes a few steps after the browser has the
 * response (`mark(..., false)` at the leaving of the field, then `inFlight.delete` in `track()`, `src/lib/estimates/save-gate.ts`), and until then `isDirty()` is true and a close or a link is answered
 * with the browser's prompt or the leave dialog. "Draft saved at ..." is drawn only after `saveDraft` has awaited `gate.settle()` (no save in flight, no field marked), so when it shows, `isDirty()` is
 * false. It is not an extra check of the saves: a value still not saved answers the alert instead, and the wait fails. A press sends nothing when the field already holds what it shows (AC-2).
 */
async function waitUntilNothingIsUnsaved(page: Page): Promise<void> {
  await saveDraftButton(page).click();
  await expect(draftStatus(page)).toHaveText(DRAFT_SAVED);
}

/** Types 7 into Length and leaves the field while every save fails: the field shows a value the server does not hold, and says so. */
async function typeAValueThatCannotBeSaved(page: Page): Promise<void> {
  await expect(saveDraftButton(page)).toBeVisible();
  await failSaves(page);
  await control(page, 'J').fill('7');
  await control(page, 'J').blur();
  await expect(partForm(page).getByRole('alert')).toContainText(NOT_SAVED_TITLE);
  await expect(control(page, 'J')).toHaveValue('7.00');
}

test.describe('AC-1, AC-2, AC-5: Save draft', () => {
  test('AC-1, AC-2: saves with every field blank and no completeness error, says when, updates "Last saved", sends nothing when nothing changed; 44 px high, in the bar, no sideways scroll', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const saves = countSaves(page);
    await expect(saveDraftButton(page)).toBeVisible();
    expect((await saveDraftButton(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    await expect(page.locator('[data-calculate-bar]')).toBeInViewport();

    await saveDraftButton(page).click();
    await expect(draftStatus(page)).toHaveText(DRAFT_SAVED);
    await expect(draftStatus(page)).toHaveAttribute('role', 'status');
    await expect(partForm(page).getByText('Enter this value')).toHaveCount(0);
    await expect(draftAlert(page)).toHaveCount(0);
    expect(saves.count()).toBe(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // A value still being typed in is saved by the press: one request, and "Last saved" moves.
    await control(page, 'J').fill('12.5');
    await saveDraftButton(page).click();
    await expect(partForm(page).getByText(/^Last saved /)).toBeVisible();
    await expect(control(page, 'J')).toHaveValue('12.50');
    expect(saves.count()).toBe(1);

    // The same again: nothing is sent.
    await saveDraftButton(page).click();
    await expect(draftStatus(page)).toHaveText(DRAFT_SAVED);
    await page.waitForTimeout(400);
    expect(saves.count()).toBe(1);

    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('12.50');
  });

  test('AC-5: a draft that cannot be saved says so in an alert and keeps what was typed; the next press, once the connection is back, saves it', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await typeAValueThatCannotBeSaved(page);

    await saveDraftButton(page).click();
    await expect(draftAlert(page)).toContainText('The draft was not saved.');
    await expect(draftAlert(page)).toContainText('press Save draft again');
    await expect(draftStatus(page)).not.toHaveText(DRAFT_SAVED);
    await expect(control(page, 'J')).toHaveValue('7.00');

    await allowSaves(page);
    await saveDraftButton(page).click();
    await expect(draftStatus(page)).toHaveText(DRAFT_SAVED);
    await expect(draftAlert(page)).toHaveCount(0);
    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('7.00');
  });
});

test.describe('AC-4, AC-8: leaving with unsaved changes', () => {
  test('AC-4: nothing prompts when nothing is unsaved: a link goes straight on, a value that was saved by leaving its field is not "unsaved"', async ({ page }, testInfo) => {
    await openForm(page, testInfo, { fromTheQueue: true });
    const saved = nextSave(page, 'J');
    await control(page, 'J').fill('5');
    await control(page, 'J').blur();
    expect(await saved).toBe(200);
    await waitUntilNothingIsUnsaved(page);
    await brandLink(page).click();
    await expect(leaveDialog(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/estimates\//);

    // Review SQR-03: the guard's extra history entry was replaced by the link, not left behind, so one Back returns to the estimate and the next Back leaves it (no dead press).
    await page.evaluate(() => window.history.back());
    await expect(page).toHaveURL(/\/estimates\//);
    await page.evaluate(() => window.history.back());
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('AC-4, AC-8: a link asks "Leave without saving?", the safe choice holds focus, Escape and Keep editing stay with nothing lost, axe finds 0 violations; "Save draft and leave" saves and goes', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const here = page.url();
    await typeAValueThatCannotBeSaved(page);

    await brandLink(page).click();
    await expect(leaveDialog(page)).toBeVisible();
    await expect(leaveDialog(page)).toContainText('You have changes that are not saved. If you leave now, they are lost.');
    await expect(keepEditing(page)).toBeFocused();
    await expect(leaveWithout(page)).toBeVisible();
    await expect(saveAndLeave(page)).toBeVisible();
    await expectNoAxeViolations(page);
    for (const button of [keepEditing(page), leaveWithout(page), saveAndLeave(page)]) {
      expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await page.keyboard.press('Escape');
    await expect(leaveDialog(page)).toHaveCount(0);
    expect(page.url()).toBe(here);
    await expect(control(page, 'J')).toHaveValue('7.00');

    // Keep editing, by keyboard: the safe choice has focus when the dialog opens, and Enter on it closes the dialog.
    await brandLink(page).click();
    await expect(keepEditing(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(leaveDialog(page)).toHaveCount(0);
    expect(page.url()).toBe(here);

    // The connection is back: "Save draft and leave" saves first, then goes, and the value is there on the way back.
    await allowSaves(page);
    await brandLink(page).click();
    await saveAndLeave(page).click();
    await expect(page).not.toHaveURL(/\/estimates\//);
    await page.goto(here);
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('7.00');
  });

  test('AC-4, AC-5: "Save draft and leave" goes only when the draft was saved, so while saves fail it stays and says so; "Leave without saving" then leaves, and what was not saved is gone', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const here = page.url();
    await typeAValueThatCannotBeSaved(page);
    await brandLink(page).click();
    await saveAndLeave(page).click();
    await expect(leaveDialog(page)).toContainText('The draft was not saved, so you are still here.');
    expect(page.url()).toBe(here);

    await leaveWithout(page).click();
    await expect(page).not.toHaveURL(/\/estimates\//);
    await allowSaves(page);
    await page.goto(here);
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('');
  });

  test('AC-4: the back button asks too, and asks again after "Keep editing"; "Leave without saving" goes back to the page before', async ({ page }, testInfo) => {
    await openForm(page, testInfo, { fromTheQueue: true });
    const here = page.url();
    await typeAValueThatCannotBeSaved(page);

    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    expect(page.url()).toBe(here);
    await keepEditing(page).click();
    await expect(leaveDialog(page)).toHaveCount(0);
    await expect(control(page, 'J')).toHaveValue('7.00');

    await page.evaluate(() => window.history.back());
    await expect(leaveDialog(page)).toBeVisible();
    await leaveWithout(page).click();
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('AC-4: signing out asks first, and the session is not ended under what was typed; leaving without saving then signs out without the browser asking again', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await typeAValueThatCannotBeSaved(page);
    const here = page.url();

    await waitUntilAccountMenuIsLive(page);
    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(leaveDialog(page)).toBeVisible();
    await keepEditing(page).click();
    await expect(leaveDialog(page)).toHaveCount(0);
    expect(page.url()).toBe(here);
    await expect(control(page, 'J')).toHaveValue('7.00');

    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await leaveWithout(page).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('AC-4: choosing another part asks while a value is not saved, and "Keep editing" leaves the form as it was', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    await typeAValueThatCannotBeSaved(page);
    await showTree(page);
    await page.getByRole('button', { name: 'Add main assembly' }).click();
    await expect(leaveDialog(page)).toBeVisible();
    await keepEditing(page).click();
    await expect(leaveDialog(page)).toHaveCount(0);
    await expect(control(page, 'J')).toHaveValue('7.00');
    await expect(page.getByRole('navigation', { name: 'Parts tree' }).getByRole('link')).toHaveCount(1);
  });

  test('AC-4: closing the tab shows the browser prompt only while something is unsaved', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const prompts: string[] = [];
    page.on('dialog', (dialog) => {
      prompts.push(dialog.type());
      void dialog.dismiss();
    });
    // The page asks only a person who has used it, as every browser does, so the field is clicked and typed into.
    await control(page, 'J').click();
    await page.keyboard.type('7');
    const asked = page.waitForEvent('dialog');
    await page.close({ runBeforeUnload: true });
    expect((await asked).type()).toBe('beforeunload');
    expect(page.isClosed()).toBe(false);

    // Saved by leaving the field: nothing is unsaved, so the page closes without a word.
    const saved = nextSave(page, 'J');
    await control(page, 'J').blur();
    expect(await saved).toBe(200);
    await waitUntilNothingIsUnsaved(page);
    const closed = page.waitForEvent('close');
    await page.close({ runBeforeUnload: true });
    await closed;
    expect(prompts).toEqual(['beforeunload']);
  });
});

/** A second tab on the same estimate, loaded while the first still shows the part as it was. */
async function openSecondTab(page: Page): Promise<Page> {
  const other = await page.context().newPage();
  await other.goto(page.url());
  await waitForForm(other);
  return other;
}

async function saveLength(page: Page, text: string): Promise<number> {
  const status = nextSave(page, 'J');
  await control(page, 'J').fill(text);
  await control(page, 'J').blur();
  return status;
}

/** The first tab saves Length 1; the second tab, which still shows the part as it was, saves Length 2 and is refused with 409. */
async function twoTabsDisagree(page: Page, testInfo: TestInfo): Promise<Page> {
  await openForm(page, testInfo);
  const other = await openSecondTab(page);
  expect(await saveLength(page, '1')).toBe(200);
  expect(await saveLength(other, '2')).toBe(409);
  return other;
}

test.describe('AC-5, AC-6, AC-8: two tabs', () => {
  test('AC-6, AC-8: the second tab to save the same field is refused, keeps what it typed, shows the newer value, sends nothing over it until the person chooses; "Use the newer values" shows it', async ({ page }, testInfo) => {
    const other = await twoTabsDisagree(page, testInfo);
    await expect(other.getByRole('alert').filter({ hasText: 'This part was changed somewhere else.' })).toBeVisible();
    await expect(control(other, 'J')).toHaveValue('2.00');
    await expect(partForm(other).getByText('Changed somewhere else. The newer value is "1.00".')).toBeVisible();
    await expect(control(other, 'J')).toHaveAttribute('aria-invalid', 'true');
    for (const name of ['Keep what I typed', 'Use the newer values']) {
      expect((await other.getByRole('button', { name }).boundingBox())?.height ?? 0, name).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    expect(await horizontalOverflow(other)).toBeLessThanOrEqual(0);
    // axe judges where the page is scrolled: filling Length centres it, and at 768 px a button of the parts tree then sits half behind the sticky top bar, which reads as a target too small (target-size) and moves with
    // every line the page gains above it (AQP-452 took the form's intro line into the head). The check is the same; it is made from the top of the page, where nothing is behind a bar.
    await other.evaluate(() => window.scrollTo(0, 0));
    // The state the scan covers is still there: the conflict notice, with the typed value kept and the field marked.
    await expect(other.getByRole('alert').filter({ hasText: 'This part was changed somewhere else.' })).toBeVisible();
    await expect(control(other, 'J')).toHaveAttribute('aria-invalid', 'true');
    await expectNoAxeViolations(other);

    // Neither leaving the field nor Save draft sends the typed value over the newer one.
    const saves = countSaves(other);
    await control(other, 'J').focus();
    await control(other, 'J').blur();
    await saveDraftButton(other).click();
    await expect(other.getByRole('alert').filter({ hasText: 'The draft was not saved.' })).toBeVisible();
    await other.waitForTimeout(400);
    expect(saves.count()).toBe(0);

    // "Use the newer values" shows what the part holds and sends nothing.
    await other.getByRole('button', { name: 'Use the newer values' }).click();
    await expect(control(other, 'J')).toHaveValue('1.00');
    await expect(other.getByText('This part was changed somewhere else.')).toHaveCount(0);
    expect(saves.count()).toBe(0);
    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('1.00');
  });

  test('AC-6: "Keep what I typed" sends it with the newer revision, and then it is what the part holds', async ({ page }, testInfo) => {
    const other = await twoTabsDisagree(page, testInfo);
    const kept = nextSave(other, 'J');
    await other.getByRole('button', { name: 'Keep what I typed' }).click();
    expect(await kept).toBe(200);
    await expect(other.getByText('This part was changed somewhere else.')).toHaveCount(0);
    await expect(control(other, 'J')).toHaveValue('2.00');
    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'J')).toHaveValue('2.00');
  });

  test('AC-5: a different field in the second tab is not a conflict: it is sent again with the new revision, and the first tab\'s value is shown', async ({ page }, testInfo) => {
    await openForm(page, testInfo);
    const other = await openSecondTab(page);
    expect(await saveLength(page, '1')).toBe(200);

    const statuses: number[] = [];
    other.on('response', (response) => {
      if (isPatchOfInputs(response.url(), response.request().method())) statuses.push(response.status());
    });
    await control(other, 'K').fill('3');
    await control(other, 'K').blur();
    await expect.poll(() => statuses).toEqual([409, 200]);
    await expect(control(other, 'J')).toHaveValue('1.00');
    await expect(control(other, 'K')).toHaveValue('3.00');
    await expect(other.getByText('This part was changed somewhere else.')).toHaveCount(0);
    await expect(partForm(other).getByRole('alert')).toHaveCount(0);
    await page.reload();
    await waitForForm(page);
    await expect(control(page, 'K')).toHaveValue('3.00');
    await expect(control(page, 'J')).toHaveValue('1.00');
  });
});
