import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { IGNORE_REMARKS_MAX_LENGTH } from '../../src/lib/estimate/ignore-words';
import { validateTextInput } from '../../src/lib/estimate/validation';

import { approvedEstimate } from './support/approved-estimate';
import { createDisposableUser, useFreshAddress } from './support/auth';
import { signInAs } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow, isDesktopProject, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import {
  estimateInStatus,
  expectHeading,
  ignoreThroughTheApi,
  moveDeadlineIntoThePast,
  queueAddressOf,
  readLayer,
  restoreThroughTheApi,
  setLayer,
  type UnderlyingStatus,
} from './support/ignored';
import { control, openForm, partForm } from './support/part-form';
import { markQuotedThroughTheApi } from './support/quoted';

/**
 * CR-01 item 7D (AQP-401; AC-1 to AC-10; FR-109, FR-102; NFR-016 to NFR-018; the ux-expert's comment 12944 and its 12 acceptance checks): Ignore and Restore on SCR-06, the Ignored tab of SCR-03, the Engineer's notice and
 * read-only page on SCR-05 and the 409 alert, at 360x800, 768x1024 and 1366x768. Each test makes an Engineer of its own with an estimate in the status it needs and reaches it **through the API** (`support/ignored.ts`), so
 * the 30 s of a test are spent on its subject and not on the page loads of the approval. What it checks: the Ignore dialog (focus on the safe choice, the field with its Required tag and hint, no `maxlength` and no
 * placeholder, the messages in the shared rule's own words, the text kept, Escape sends nothing); a good Ignore with the keyboard alone (the notice, the dashed badge, no action bar, focus on the heading, the polite status
 * of 12944) and the Restore that follows (one press of the notice's button restores nothing, the dialog text for each status underneath, the Overdue sentence only past the deadline and not for Approved); the refusal and
 * the no-answer branches of both dialogs; a second press made in another window; the Ignored tab (four tabs in two rows at 360 px, the remarks cut with "Read all remarks", no overdue cue, "Open to restore", no Reassign);
 * what the Engineer is shown (their own Ignored tab and no Actions column, the notice in its own words, every input read-only and focusable and none disabled, no action bar, markup in the remarks shown as typed, another
 * Engineer's task not found); the 409 alert when the task is ignored while the Engineer works; and the routes that refuse a Quoted estimate, an Engineer and the download. The words are the design of record's, written
 * out here and not imported (the limit and the hidden-character sentence are read from the shared rule, DL-219). Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const REMARKS = 'Not taken forward.\nThe customer chose another supplier.';
/** What a Lead typed, with markup in it and a line break: an Engineer must read it as typed. */
const ENGINEER_REMARKS = '<b>x</b> first line\nsecond line';
const SLOW_MILLISECONDS = 800;
const IGNORE_ROUTE = '**/api/v1/estimates/*/ignore';
const RESTORE_ROUTE = '**/api/v1/estimates/*/restore';
const LOCKED_SENTENCE = 'This estimate is approved and locked. Unlock it first.';
const IGNORE_UNCONFIRMED_START = 'We could not confirm that the RFQ was ignored.';
const RESTORE_UNCONFIRMED_START = 'We could not confirm that the RFQ was restored.';
const ENGINEER_NOTICE_BODY = 'You can read everything here, but nothing can be changed. A Lead or Admin can restore it, and it then comes back to your tasks with the status it had.';
const ENGINEER_ALERT = 'A Lead or Admin ignored this task, so the changes you just made were not saved. Reload the page to read their remarks.';

const ignoreButton = (page: Page) => page.locator('#review-ignore');
const restoreButton = (page: Page) => page.locator('#review-restore');
const actionBar = (page: Page) => page.locator('#review-actions');
const noticeOf = (page: Page) => page.locator('#review-ignored-notice');
const badgeOf = (page: Page) => page.locator('[data-slot="status-badge"]').first();
const announcerOf = (page: Page) => page.locator('#page-announcer');
const ignoreDialogOf = (page: Page, code: string) => page.getByRole('alertdialog', { name: `Ignore ${code}?` });
const restoreDialogOf = (page: Page, code: string) => page.getByRole('alertdialog', { name: `Restore ${code}?` });
const keepOpenOf = (dialog: Locator) => dialog.getByRole('button', { name: 'Keep it open' });
const keepIgnoredOf = (dialog: Locator) => dialog.getByRole('button', { name: 'Keep it ignored' });
const ignoreSubmitOf = (dialog: Locator) => dialog.getByRole('button', { name: /^(Ignore RFQ|Ignoring)$/ });
const restoreSubmitOf = (dialog: Locator) => dialog.getByRole('button', { name: /^(Restore RFQ|Restoring)$/ });
const remarksOf = (dialog: Locator) => dialog.locator('#ignore-remarks');

/** The sentence the shared rule gives for a text, read from the rule and not copied (DL-219): the hidden-character sentence changes in one place when it is made to name the character. */
function sharedMessage(text: string): string {
  const checked = validateTextInput(text, { multiline: true, maxLength: IGNORE_REMARKS_MAX_LENGTH, countCodePoints: true });
  if (checked.ok) throw new Error('The shared rule should refuse this text.');
  return checked.message;
}

async function openedReview(page: Page, code: string): Promise<void> {
  const response = await page.goto(`/estimates/${code}`);
  expect(response?.status()).toBe(200);
  await expectHeading(page, code);
}

/** The estimate's page as the signed-in Lead, with the Ignore button live. */
async function openedForIgnoring(page: Page, status: UnderlyingStatus, testInfo: Parameters<typeof estimateInStatus>[1]) {
  const made = await estimateInStatus(page, testInfo, status);
  await openedReview(page, made.code);
  await expect(ignoreButton(page)).toBeEnabled();
  await waitUntilHydrated(page, '#review-ignore');
  return made;
}

/** The estimate's page of an already ignored estimate (ignored through the API by the signed-in Lead), with the Restore button live. */
async function openedIgnored(page: Page, status: UnderlyingStatus, testInfo: Parameters<typeof estimateInStatus>[1], options: { readonly overdue?: boolean } = {}) {
  const made = await estimateInStatus(page, testInfo, status);
  if (options.overdue === true) await moveDeadlineIntoThePast(made.owner.id);
  expect(await ignoreThroughTheApi(page, made.owner.id, REMARKS)).toBe(200);
  await openedReview(page, made.code);
  await expect(restoreButton(page)).toBeEnabled();
  await waitUntilHydrated(page, '#review-restore');
  return made;
}

test.describe('AC-2, AC-8: the Ignore dialog', () => {
  test('opens with focus on "Keep it open", names the field and its limit, refuses an empty, a long and a hidden-character text in the shared rule\'s words with the text kept, and Escape sends nothing', async ({ page }, testInfo) => {
    const { code, owner } = await openedForIgnoring(page, 'DRAFT', testInfo);
    let sent = 0;
    await page.route(IGNORE_ROUTE, async (route) => {
      sent += 1;
      await route.continue();
    });
    await ignoreButton(page).focus();
    await page.keyboard.press('Enter');
    const dialog = ignoreDialogOf(page, code);
    await expect(dialog).toBeVisible();
    await expect(keepOpenOf(dialog)).toBeFocused();

    // The words of the design of record: the freeze, the field, its tag and hint (which read the one constant of 500).
    await expect(dialog).toContainText('Use this when an RFQ is not taken forward or is rejected. It leaves Open and Overdue and is listed under Ignored.');
    await expect(dialog).toContainText('While it is ignored it is read-only: nobody can change, calculate, approve, mark as quoted or download it. Nothing in the estimate is deleted, and you can restore it later.');
    await expect(dialog.locator('label[for="ignore-remarks"]')).toHaveText('Remarks Required');
    await expect(dialog.getByText('Required', { exact: true })).toBeVisible();
    await expect(dialog).toContainText(`Why this RFQ is set aside. The Engineer can read this in their Ignored tab, and it is kept in the audit log. Up to ${String(IGNORE_REMARKS_MAX_LENGTH)} characters.`);
    const field = remarksOf(dialog);
    await expect(field).toHaveAttribute('rows', '4');
    // No `maxlength` (it counts UTF-16 units, and a long paste must be reported, not cut) and no placeholder (it fails contrast and vanishes on typing).
    expect(await field.getAttribute('maxlength')).toBeNull();
    expect(await field.getAttribute('placeholder')).toBeNull();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    if (!isDesktopProject(testInfo.project.name)) {
      for (const target of [keepOpenOf(dialog), ignoreSubmitOf(dialog)]) expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }

    // Empty: the required message under the field, focus on the field, nothing sent.
    await ignoreSubmitOf(dialog).click();
    await expect(dialog).toContainText('Enter remarks. They are kept in the audit log.');
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    // Only spaces and line breaks are empty as well.
    await field.fill('  \n \n ');
    await ignoreSubmitOf(dialog).click();
    await expect(dialog).toContainText('Enter remarks. They are kept in the audit log.');

    // 501 code points: the length message on leaving the field, and the text stays (the field shows all of it).
    const tooLong = 'x'.repeat(IGNORE_REMARKS_MAX_LENGTH + 1);
    await field.fill(tooLong);
    await field.blur();
    await expect(dialog).toContainText(sharedMessage(tooLong));
    await expect(dialog).toContainText(`Use ${String(IGNORE_REMARKS_MAX_LENGTH)} characters or fewer.`);
    await expect(field).toHaveValue(tooLong);
    // Editing clears the message; exactly 500 is accepted by the dialog's own check (nothing is sent here: the route is held below).
    await field.fill('x'.repeat(IGNORE_REMARKS_MAX_LENGTH));
    await expect(dialog).not.toContainText(`Use ${String(IGNORE_REMARKS_MAX_LENGTH)} characters or fewer.`);

    // A zero-width joiner: the shared rule's own sentence, on submit, and the text stays.
    const hidden = 'Not taken‍ forward';
    await field.fill(hidden);
    await ignoreSubmitOf(dialog).click();
    await expect(dialog).toContainText(sharedMessage(hidden));
    await expect(field).toHaveValue(hidden);
    await expect(field).toBeFocused();
    expect(sent).toBe(0);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(ignoreButton(page)).toBeFocused();
    expect(sent).toBe(0);
    expect(await readLayer(owner.id)).toMatchObject({ status: 'DRAFT', ignoredAtSet: false, ignored: 0 });
  });
});

/**
 * AQP-488 (DL-388, the DEF-053 and DEF-128 pattern): the case that ignores and then restores was one test of 24 to 28 s on the development server (#800's runs: the review page now draws the inputs block beside the tree, whose form is
 * fetched after each load) and failed its 30 s on both attempts of a loaded runner. It is **two cases on one page, in one serial group**, split at its natural state boundary: the estimate is made, the page opened and hydrated once in
 * beforeAll (the same person, address and viewport as every case of this file); case A is everything up to the end of the ignored state (the ignore, its status, notice, read-only page, layer, scan); case B is the Restore dialog,
 * the restore and the restored state. Every assertion of the old case is kept, in the same order, in A or B. A failure of A skips B and a retry runs the group again from beforeAll. No timeout is set, raised or lowered, and no wait
 * is added. The split is lane 2's (9f28c7a0 on the stage 2 branch), taken here without its stage 2 lines.
 */
test.describe('AC-1, AC-4, AC-5, AC-8, AC-10: ignore, then restore, with the keyboard alone', () => {
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;
  let made: Awaited<ReturnType<typeof openedForIgnoring>>;

  test.beforeAll(async ({ browser }, testInfo) => {
    const { baseURL, viewport, hasTouch } = testInfo.project.use;
    context = await browser.newContext({ storageState: { cookies: [], origins: [] }, ...(baseURL === undefined ? {} : { baseURL }), ...(viewport === undefined ? {} : { viewport }), ...(hasTouch === undefined ? {} : { hasTouch }) });
    await useFreshAddress(context);
    page = await context.newPage();
    made = await openedForIgnoring(page, 'PREPARED', testInfo);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('a Prepared estimate is ignored with remarks: the heading takes focus, the polite status is said, the notice names who, when and the remarks, the badge is dashed, the page is read-only with no action bar', async () => {
    const { code, owner, lead } = made;
    await page.route(IGNORE_ROUTE, async (route) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, SLOW_MILLISECONDS);
      });
      await route.continue();
    });

    // Keyboard only: the button, the field, the submit.
    await ignoreButton(page).focus();
    await page.keyboard.press('Enter');
    const dialog = ignoreDialogOf(page, code);
    await expect(dialog).toBeVisible();
    await expect(keepOpenOf(dialog)).toBeFocused();
    // The field comes before the two buttons in the dialog, so Shift+Tab from the safe choice reaches it.
    await page.keyboard.press('Shift+Tab');
    await expect(remarksOf(dialog)).toBeFocused();
    await page.keyboard.type('Not taken forward.');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('The customer chose another supplier.');
    await page.keyboard.press('Tab');
    await expect(keepOpenOf(dialog)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(ignoreSubmitOf(dialog)).toBeFocused();
    const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/estimates/${owner.id}/ignore`));
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('button', { name: 'Ignoring' })).toBeDisabled();
    // The dialog cannot be dismissed while the request is under way.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    const response = await answered;
    expect(response.status()).toBe(200);
    const answer = (await response.json()) as { status: string; ignored: Record<string, unknown> };
    expect(answer.status).toBe('PREPARED');
    expect(Object.keys(answer.ignored).sort()).toEqual(['at', 'byName', 'remarks']);

    await expect(dialog).toHaveCount(0);
    // Focus is on the heading and the polite status is the exact sentence.
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await expect(announcerOf(page)).toHaveText(`${code} ignored. It is now in the Ignored tab.`);
    const notice = noticeOf(page);
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('status')).toBeVisible();
    await expect(notice).toContainText(/Ignored on \d{2} \w{3} \d{4}, \d{2}:\d{2} IST by /);
    await expect(notice).toContainText(`by ${lead.name}.`);
    await expect(notice).toContainText(/Remarks: Not taken forward\.\s*The customer chose another supplier\./);
    await expect(notice).toContainText('This RFQ is read-only. It cannot be changed, calculated, approved, marked as quoted or downloaded until it is restored. It was Prepared when it was ignored. Restore puts it back as Prepared.');
    await expect(badgeOf(page)).toHaveAttribute('data-status', 'IGNORED');
    await expect(badgeOf(page)).toHaveText('Ignored');
    await expect(badgeOf(page).locator('[data-slot="badge"]')).toHaveClass(/border-dashed/);
    // Read-only for everyone: no action bar, no Change customer, no download chip.
    await expect(actionBar(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Change customer' })).toHaveCount(0);
    await expect(page.locator('[data-slot="download-chip"]')).toHaveCount(0);
    await expect(ignoreButton(page)).toHaveCount(0);
    expect(await readLayer(owner.id)).toMatchObject({
      status: 'PREPARED',
      ignoredAtSet: true,
      ignoredBy: lead.id,
      remarks: REMARKS,
      ignored: 1,
      ignoredEntry: { actorId: lead.id, before: { status: 'PREPARED' }, after: { status: 'PREPARED', remarks: REMARKS } },
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    await page.unroute(IGNORE_ROUTE);

  });

  test('Restore RFQ opens a dialog, restores nothing by itself, and brings the estimate back as Prepared', async ({}, testInfo) => {
    const { code, owner, lead } = made;
    // The page is as case A left it: ignored, read-only, the Restore button live.
    await expect(badgeOf(page)).toHaveAttribute('data-status', 'IGNORED');
    // Restore: the notice's button opens a dialog and restores nothing by itself.
    let restores = 0;
    await page.route(RESTORE_ROUTE, async (route) => {
      restores += 1;
      await route.continue();
    });
    await waitUntilHydrated(page, '#review-restore');
    await restoreButton(page).focus();
    await expect(restoreButton(page)).toHaveText('Restore RFQ');
    await page.keyboard.press('Enter');
    const restoreDialog = restoreDialogOf(page, code);
    await expect(restoreDialog).toBeVisible();
    await expect(keepIgnoredOf(restoreDialog)).toBeFocused();
    await expect(restoreDialog).toContainText("It goes back to Prepared, the status it had when it was ignored, and returns to");
    await expect(restoreDialog).toContainText("Open queue. Nothing in the estimate changes.");
    // No field and no remarks of its own.
    await expect(restoreDialog.locator('textarea, input')).toHaveCount(0);
    expect(restores).toBe(0);
    expect((await readLayer(owner.id)).ignoredAtSet).toBe(true);
    if (!isDesktopProject(testInfo.project.name)) {
      for (const target of [keepIgnoredOf(restoreDialog), restoreSubmitOf(restoreDialog)]) expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
    await expectNoAxeViolations(page);

    await page.keyboard.press('Tab');
    await expect(restoreSubmitOf(restoreDialog)).toBeFocused();
    // Observe-only timestamps (nothing is asserted on them): how long the restored page takes to be drawn, and then to be editable (the editing island fetched and swapped in), as a person waits for it.
    const pressedAt = Date.now();
    await page.keyboard.press('Enter');
    await expect(restoreDialog).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await expect(announcerOf(page)).toHaveText(`${code} restored. It is back as Prepared, in Open.`);
    await expect(noticeOf(page)).toHaveCount(0);
    await expect(actionBar(page)).toBeVisible();
    const drawnAt = Date.now();
    await expect(badgeOf(page)).toHaveAttribute('data-status', 'PREPARED');
    expect(restores).toBe(1);
    await expect(page.getByRole('button', { name: 'Add main assembly' })).toBeVisible();
    const editableAt = Date.now();
    // eslint-disable-next-line no-console -- the measurement of AQP-488 (product cost of the island after Restore), read from the CI log
    console.log(`[AQP-488 restore timing] ${testInfo.project.name}: page drawn ${String(drawnAt - pressedAt)} ms after the press, tree controls ${String(editableAt - drawnAt)} ms after that`);
    expect(await readLayer(owner.id)).toMatchObject({
      status: 'PREPARED',
      ignoredAtSet: false,
      ignoredBy: null,
      remarks: null,
      restored: 1,
      restoredEntry: { actorId: lead.id, before: { status: 'PREPARED', remarks: REMARKS }, after: { status: 'PREPARED' } },
    });
  });
});

test.describe('AC-8: the Restore dialog follows the status underneath', () => {
  test('a Draft past its deadline goes back to the Open queue and says it will also show as Overdue', async ({ page }, testInfo) => {
    const { code, owner } = await openedIgnored(page, 'DRAFT', testInfo, { overdue: true });
    await expect(noticeOf(page)).toContainText('It was Draft when it was ignored. Restore puts it back as Draft.');
    await restoreButton(page).click();
    const dialog = restoreDialogOf(page, code);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('It goes back to Draft, the status it had when it was ignored, and returns to');
    await expect(dialog).toContainText(/Its deadline, \d{2} \w{3} \d{4}, \d{2}:\d{2} IST, has passed, so it will also show as Overdue\./);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(restoreButton(page)).toBeFocused();
    expect((await readLayer(owner.id)).ignoredAtSet).toBe(true);
  });

  test('a Prepared estimate with its deadline ahead goes back to the Open queue and says nothing of Overdue', async ({ page }, testInfo) => {
    const { code } = await openedIgnored(page, 'PREPARED', testInfo);
    await restoreButton(page).click();
    const dialog = restoreDialogOf(page, code);
    await expect(dialog).toContainText('It goes back to Prepared, the status it had when it was ignored, and returns to');
    await expect(dialog).not.toContainText('Overdue');
  });

  test('an Approved estimate goes back to the Closed tab, and never says Overdue, even past its deadline', async ({ page }, testInfo) => {
    const { code } = await openedIgnored(page, 'APPROVED', testInfo, { overdue: true });
    await expect(noticeOf(page)).toContainText('It was Approved when it was ignored. Restore puts it back as Approved.');
    await restoreButton(page).click();
    const dialog = restoreDialogOf(page, code);
    await expect(dialog).toContainText('It goes back to Approved, the status it had when it was ignored, and returns to the Closed tab. Nothing in the estimate changes.');
    await expect(dialog).not.toContainText('Overdue');
    await restoreSubmitOf(dialog).click();
    await expect(announcerOf(page)).toHaveText(`${code} restored. It is back as Approved, in Closed.`);
    await expect(badgeOf(page)).toHaveAttribute('data-status', 'APPROVED');
  });
});

test.describe('AC-8: the refusal and the no-answer branches of both dialogs', () => {
  test('Ignore: a refusal keeps the server\'s sentence in view with focus on it, writes nothing, and when the dialog is closed focus lands on the action bar; no answer says it could not confirm, and a second press then ignores it once', async ({ page }, testInfo) => {
    const { code, owner, lead } = await openedForIgnoring(page, 'DRAFT', testInfo);
    await page.route(IGNORE_ROUTE, async (route) => {
      await route.fulfill({ status: 409, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: LOCKED_SENTENCE, status: 409, code: 'ESTIMATE_APPROVED_IS_LOCKED' }) });
    });
    await ignoreButton(page).click();
    const dialog = ignoreDialogOf(page, code);
    await expect(dialog).toBeVisible();
    await remarksOf(dialog).fill(REMARKS);
    await ignoreSubmitOf(dialog).click();
    const alert = dialog.locator('#ignore-alert');
    await expect(alert).toContainText(LOCKED_SENTENCE);
    await expect(alert).toBeFocused();
    await expect(ignoreSubmitOf(dialog)).toBeDisabled();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    expect((await readLayer(owner.id)).ignoredAtSet).toBe(false);
    await keepOpenOf(dialog).click();
    await expect(dialog).toHaveCount(0);
    await expect(actionBar(page)).toBeFocused();

    // No answer: the sentence of the design, the button on again, the text kept.
    await page.unroute(IGNORE_ROUTE);
    await page.route(IGNORE_ROUTE, (route) => route.abort());
    await ignoreButton(page).click();
    await expect(dialog).toBeVisible();
    await remarksOf(dialog).fill(REMARKS);
    await ignoreSubmitOf(dialog).click();
    await expect(dialog).toContainText(IGNORE_UNCONFIRMED_START);
    await expect(dialog).toContainText('pressing again cannot ignore it twice');
    await expect(ignoreSubmitOf(dialog)).toBeEnabled();
    await expect(remarksOf(dialog)).toHaveValue(REMARKS);
    expect((await readLayer(owner.id)).ignoredAtSet).toBe(false);
    await page.unroute(IGNORE_ROUTE);
    await ignoreSubmitOf(dialog).click();
    await expect(noticeOf(page)).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(await readLayer(owner.id)).toMatchObject({ ignoredAtSet: true, ignoredBy: lead.id, ignored: 1 });
  });

  test('Restore: a refusal keeps the sentence with focus on it, writes nothing, and when the dialog is closed the notice stays and takes focus', async ({ page }, testInfo) => {
    const { code, owner } = await openedIgnored(page, 'PREPARED', testInfo);
    await page.route(RESTORE_ROUTE, async (route) => {
      await route.fulfill({ status: 409, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: LOCKED_SENTENCE, status: 409, code: 'ESTIMATE_APPROVED_IS_LOCKED' }) });
    });
    await restoreButton(page).click();
    const dialog = restoreDialogOf(page, code);
    await expect(dialog).toBeVisible();
    await restoreSubmitOf(dialog).click();
    const alert = dialog.locator('#restore-alert');
    await expect(alert).toContainText(LOCKED_SENTENCE);
    await expect(alert).toBeFocused();
    await expect(restoreSubmitOf(dialog)).toBeDisabled();
    expect((await readLayer(owner.id)).ignoredAtSet).toBe(true);
    await keepIgnoredOf(dialog).click();
    await expect(dialog).toHaveCount(0);
    // The page is drawn again and the notice is still there: focus is on it, since there is no action bar.
    await expect(noticeOf(page)).toBeFocused();
  });

  test('Restore: no answer says it could not confirm, turns the button back on and keeps the layer, and a second press then restores it once', async ({ page }, testInfo) => {
    const { code, owner } = await openedIgnored(page, 'PREPARED', testInfo);
    await page.route(RESTORE_ROUTE, (route) => route.abort());
    await restoreButton(page).click();
    const dialog = restoreDialogOf(page, code);
    await expect(dialog).toBeVisible();
    await restoreSubmitOf(dialog).click();
    await expect(dialog).toContainText(RESTORE_UNCONFIRMED_START);
    await expect(dialog).toContainText('pressing again cannot restore it twice');
    await expect(restoreSubmitOf(dialog)).toBeEnabled();
    expect((await readLayer(owner.id)).ignoredAtSet).toBe(true);
    await page.unroute(RESTORE_ROUTE);
    await restoreSubmitOf(dialog).click();
    await expect(dialog).toHaveCount(0);
    await expect(noticeOf(page)).toHaveCount(0);
    expect(await readLayer(owner.id)).toMatchObject({ ignoredAtSet: false, restored: 1 });
  });

  test('a second Ignore made in another window while the dialog was open is the 409, treated as done: the notice shows the first person\'s remarks, and there is one entry', async ({ page }, testInfo) => {
    const { code, owner, lead } = await openedForIgnoring(page, 'DRAFT', testInfo);
    await ignoreButton(page).click();
    const dialog = ignoreDialogOf(page, code);
    await expect(dialog).toBeVisible();
    await remarksOf(dialog).fill('Second remarks.');
    expect(await ignoreThroughTheApi(page, owner.id, 'First remarks.')).toBe(200);
    await ignoreSubmitOf(dialog).click();
    await expect(dialog).toHaveCount(0);
    await expect(noticeOf(page)).toContainText('Remarks: First remarks.');
    await expect(announcerOf(page)).toHaveText(`${code} ignored. It is now in the Ignored tab.`);
    expect(await readLayer(owner.id)).toMatchObject({ remarks: 'First remarks.', ignoredBy: lead.id, ignored: 1 });
  });

  test('a second Restore made in another window is the 409, treated as done', async ({ page }, testInfo) => {
    const { code, owner } = await openedIgnored(page, 'PREPARED', testInfo);
    await restoreButton(page).click();
    const dialog = restoreDialogOf(page, code);
    await expect(dialog).toBeVisible();
    expect(await restoreThroughTheApi(page, owner.id)).toBe(200);
    await restoreSubmitOf(dialog).click();
    await expect(dialog).toHaveCount(0);
    await expect(noticeOf(page)).toHaveCount(0);
    await expect(announcerOf(page)).toHaveText(`${code} restored. It is back as Prepared, in Open.`);
    expect(await readLayer(owner.id)).toMatchObject({ ignoredAtSet: false, restored: 1 });
  });
});

test.describe('AC-3, AC-10: the Ignored tab of the queue, for a Lead', () => {
  test('has four tabs (a 2 by 2 grid at 360 px, one row from 480 px), the dashed badge with the remarks cut at a word and "Read all remarks", "Open to restore" and no Reassign, and no overdue cue past the deadline', async ({ page }, testInfo) => {
    const { code, owner } = await estimateInStatus(page, testInfo, 'DRAFT');
    await moveDeadlineIntoThePast(owner.id);
    const long = `${'Not taken forward because the customer chose another supplier. '.repeat(3)}Last words.`;
    expect(await ignoreThroughTheApi(page, owner.id, long)).toBe(200);
    const response = await page.goto(queueAddressOf('ignored', code));
    expect(response?.status()).toBe(200);

    // Four tabs, Ignored last and selected, with its count.
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(0)).toContainText('Open');
    await expect(tabs.nth(1)).toContainText('Overdue');
    await expect(tabs.nth(2)).toContainText('Closed');
    await expect(tabs.nth(3)).toContainText('Ignored');
    await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true');
    const boxes = await Promise.all([0, 1, 2, 3].map(async (index) => defined(await tabs.nth(index).boundingBox())));
    const width = page.viewportSize()?.width ?? 1_366;
    for (const box of boxes) {
      expect(box.height).toBeGreaterThanOrEqual(TOUCH_TARGET);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    if (width < 480) {
      // Two rows of two: none out of view, and the page does not scroll sideways.
      expect(boxes[2]?.y ?? 0).toBeGreaterThan((boxes[0]?.y ?? 0) + 1);
      expect(boxes[0]?.y).toBe(boxes[1]?.y);
      expect(boxes[2]?.y).toBe(boxes[3]?.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    } else {
      expect(new Set(boxes.map((box) => box.y)).size).toBe(1);
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // The intro line and the sort note of the tab.
    await expect(page.getByText('RFQs that were not taken forward. They are out of Open and Overdue. Open one to restore it.')).toBeVisible();
    await expect(page.getByText('Sorted by deadline, earliest first.', { exact: true })).toBeVisible();

    // The row: the dashed badge, the remarks cut, the link to read them all, "Open to restore" and no Reassign, and no overdue cue.
    const row = page.locator(`[data-task-code="${code}"]:visible`);
    await expect(row).toBeVisible();
    await expect(row.locator('[data-slot="status-badge"]')).toHaveAttribute('data-status', 'IGNORED');
    await expect(row.locator('[data-slot="badge"]')).toHaveClass(/border-dashed/);
    const remarks = row.locator('[data-ignored-remarks]');
    await expect(remarks).toContainText('Not taken forward because the customer chose another supplier.');
    await expect(remarks).toContainText('…');
    await expect(remarks).not.toContainText('Last words.');
    await expect(row.getByRole('link', { name: `Read all remarks, ${code}` })).toBeVisible();
    await expect(row.getByRole('link', { name: `Open to restore, ${code}` })).toHaveAttribute('href', `/estimates/${code}`);
    await expect(row.getByRole('link', { name: /Reassign/ })).toHaveCount(0);
    await expect(row.locator('[data-overdue-marker]')).toHaveCount(0);
    await expect(row).not.toContainText('Overdue by');
    await expectNoAxeViolations(page);

    // The same task is in no other tab, whatever its deadline: not in Open, not in Overdue.
    for (const tab of ['open', 'overdue']) {
      await page.goto(queueAddressOf(tab, code));
      await expect(page.locator(`[data-task-code="${code}"]:visible`)).toHaveCount(0);
    }

    // "Read all remarks" opens the task, where the whole text is.
    await page.goto(queueAddressOf('ignored', code));
    await row.getByRole('link', { name: `Read all remarks, ${code}` }).click();
    await expectHeading(page, code);
    await expect(noticeOf(page)).toContainText('Last words.');
  });
});

test.describe('AC-7, AC-8, AC-9, AC-10: what the Engineer is shown', () => {
  test('an Engineer reads their own task in the Ignored tab, with the remarks as typed, the intro line, no Actions column and no restore link', async ({ page }, testInfo) => {
    const { code, owner, lead } = await estimateInStatus(page, testInfo, 'DRAFT');
    await setLayer(owner.id, lead.id, ENGINEER_REMARKS);
    await signInAs(page, owner);

    // The queue: their own Ignored tab, the remarks as text, no Actions column and no restore link.
    await page.goto(`/queue?tab=ignored&q=${encodeURIComponent(code)}`);
    await expect(page.getByRole('tab')).toHaveCount(4);
    await expect(page.getByRole('tab').nth(3)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Tasks that a Lead or Admin set aside. You can read them but not change them.')).toBeVisible();
    const row = page.locator(`[data-task-code="${code}"]:visible`);
    await expect(row).toBeVisible();
    await expect(row.locator('[data-ignored-remarks]')).toContainText('<b>x</b> first line second line');
    expect(await row.locator('[data-ignored-remarks] b').count()).toBe(0);
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toHaveCount(0);
    await expect(row.getByRole('link', { name: /Open to restore|Reassign/ })).toHaveCount(0);
  });

  test('the page has the notice in its own words, the remarks as typed, every input read-only and focusable and none disabled, and no action bar; another Engineer\'s task is not found', async ({ page }, testInfo) => {
    const { code, owner, lead } = await estimateInStatus(page, testInfo, 'DRAFT');
    await setLayer(owner.id, lead.id, ENGINEER_REMARKS);
    await signInAs(page, owner);
    // The notice (its own words, the remarks as typed), the badge, read-only inputs that stay focusable, no controls that change anything.
    await page.goto(`/estimates/${code}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Estimate ${code}`);
    const notice = noticeOf(page);
    await expect(notice).toContainText(`This task was ignored on`);
    await expect(notice).toContainText(`by ${lead.name}.`);
    await expect(notice).toContainText(ENGINEER_NOTICE_BODY);
    await expect(notice.locator('[data-ignored-remarks]')).toContainText('<b>x</b> first line');
    expect(await notice.locator('b').count()).toBe(0);
    await expect(notice).not.toContainText(/Restore RFQ|download/);
    await expect(notice.getByRole('button')).toHaveCount(0);
    await expect(badgeOf(page)).toHaveAttribute('data-status', 'IGNORED');
    await expect(badgeOf(page)).toHaveText('Ignored');
    await expect(partForm(page)).toBeVisible();
    // The materials come with the form: the list is enabled once they are here, and only then can "none disabled" be judged.
    await expect(control(page, 'E')).toBeEnabled();
    await expect(control(page, 'J')).toBeVisible();
    await expect(control(page, 'J')).toHaveAttribute('readonly', '');
    await expect(control(page, 'J')).toHaveAttribute('aria-readonly', 'true');
    await expect(control(page, 'E')).toHaveAttribute('aria-readonly', 'true');
    // None of the form's controls is disabled (they stay in the reading order), and the one at the top can be focused and read.
    await expect(partForm(page).locator(':disabled')).toHaveCount(0);
    await control(page, 'J').focus();
    await expect(control(page, 'J')).toBeFocused();
    // The select cannot be changed from the keyboard: the value stays.
    const before = await control(page, 'E').inputValue();
    await control(page, 'E').focus();
    await page.keyboard.press('ArrowDown');
    expect(await control(page, 'E').inputValue()).toBe(before);
    // Nothing that changes the estimate is on the page: no Save draft, no Calculate, no action bar, no new part.
    await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Calculate/ })).toHaveCount(0);
    await expect(page.locator('[data-calculate-bar]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Add main assembly|New item|Replace|Remove/ })).toHaveCount(0);
    await expect(page.locator('[data-last-saved]')).not.toContainText('saves on its own');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoAxeViolations(page);

    // Another Engineer finds this task as they find any task that is not theirs: not found.
    const other = await createDisposableUser('scan', testInfo);
    await signInAs(page, other);
    const refused = await page.goto(`/estimates/${code}`);
    expect(refused?.status()).toBe(404);
  });

  test('the server refuses an Engineer\'s save of an ignored estimate with the 409 and says so in one alert that takes focus, offers Reload page, stops the page being editable, and Reload page draws the notice', async ({ page }, testInfo) => {
    const owner = await openForm(page, testInfo);
    const lead = await createDisposableUser('axe', testInfo, 'LEAD');
    // A Lead ignores the task while the Engineer works: the page does not know yet.
    await setLayer(owner.id, lead.id, REMARKS);
    await control(page, 'J').fill('7');
    await control(page, 'J').blur();
    const alert = page.locator('#estimate-ignored-alert');
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('alert')).toHaveText(ENGINEER_ALERT);
    await expect(alert).toBeFocused();
    await expect(page.getByRole('alert').filter({ hasText: 'The change was not saved' })).toHaveCount(0);
    // The page is read-only from now on, and there is no bar of Save draft and Calculate.
    await expect(control(page, 'J')).toHaveAttribute('readonly', '');
    await expect(page.locator('[data-calculate-bar]')).toHaveCount(0);
    await expect(badgeOf(page)).toHaveAttribute('data-status', 'IGNORED');
    await expectNoAxeViolations(page);

    await alert.getByRole('button', { name: 'Reload page' }).click();
    await expect(noticeOf(page)).toBeVisible();
    await expect(noticeOf(page)).toContainText(/Remarks: Not taken forward\.\s*The customer chose another supplier\./);
    await expect(page.locator('#estimate-ignored-alert')).toHaveCount(0);
  });
});

test.describe('AC-1, AC-4, AC-6: who is offered it and who is refused', () => {
  test('a Quoted estimate has no Ignore button, and the route refuses it 409 with nothing written', async ({ page }, testInfo) => {
    const { code, owner } = await approvedEstimate(page, testInfo);
    expect(await markQuotedThroughTheApi(page, owner.id)).toBe(200);
    await openedReview(page, code);
    await expect(page.locator('#review-unlock')).toBeVisible();
    await expect(ignoreButton(page)).toHaveCount(0);
    expect(await ignoreThroughTheApi(page, owner.id, REMARKS)).toBe(409);
    expect(await readLayer(owner.id)).toMatchObject({ status: 'QUOTED', ignoredAtSet: false, ignored: 0 });
  });

  test('an ignored estimate refuses the download (summary and file) as every other change (A-CR01-8), and an Engineer is refused 403 by both routes, whatever the ID', async ({ page }, testInfo) => {
    const second = await estimateInStatus(page, testInfo, 'PREPARED');
    expect(await ignoreThroughTheApi(page, second.owner.id, REMARKS)).toBe(200);
    for (const route of ['export', 'export-summary']) expect((await page.request.get(`/api/v1/estimates/${second.owner.id}/${route}`)).status(), route).toBe(409);

    // An Engineer is refused 403 by both routes, whatever the ID, and has no button on their own page.
    await signInAs(page, second.owner);
    expect(await ignoreThroughTheApi(page, second.owner.id, REMARKS)).toBe(403);
    expect(await restoreThroughTheApi(page, second.owner.id)).toBe(403);
    expect(await restoreThroughTheApi(page, '00000000-0000-4000-8000-00000000dead')).toBe(403);
    expect(await readLayer(second.owner.id)).toMatchObject({ ignoredAtSet: true, ignored: 1, restored: 0 });
  });
});

/** The value, or a failure that names what was missing (a bounding box exists only for a visible element). */
function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('A value that should be there is not.');
  return value;
}
