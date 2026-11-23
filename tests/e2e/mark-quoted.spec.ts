import { expect, test, type Locator, type Page } from '@playwright/test';

import { approvedEstimate } from './support/approved-estimate';
import { useFreshAddress } from './support/auth';
import { signInAs } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow, isDesktopProject, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { ignoreEstimate, markQuotedThroughTheApi, readQuote } from './support/quoted';

/**
 * CR-01 item 7C (AQP-400; AC-1 to AC-6, AC-9; FR-110; NFR-016 to NFR-018): Mark as quoted, SCR-06 and its dialog, for a Lead at `/estimates/<code>`, at 360x800, 768x1024 and 1366x768. Each test makes an Engineer of its own with an
 * estimate and has it calculated and approved **through the API** (`support/approved-estimate.ts`), so the 30 s of a test are spent on the mark and not on the page loads of the approval. What it checks: the dialog opens from the
 * button with focus on the safe choice "Not yet", says that the quote has been sent, that only Unlock can reverse it and what the download marker says, keeps focus inside, has no sideways scroll, no axe violation and
 * 44 px targets below 1024 px, and Escape sends nothing; a good mark shows "Marking as quoted", then the Quoted notice with who and when, the status Quoted, Unlock still offered and Approve, Mark as quoted and the Approved
 * notice gone, and the task in the Closed tab as Quoted, while the Engineer sees the status word and nothing of who marked it; a second press made in another window is the 409, treated as done; an ignored estimate is not
 * offered the button and is refused by the route; an Engineer is refused by the route; and Unlock takes a Quoted estimate back to Draft, with no "not quoted" or undo anywhere. The words are the UX spec's and the story's,
 * written out here and not imported. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const SLOW_MILLISECONDS = 800;
const MARK_ROUTE = '**/api/v1/estimates/*/quoted';
const UNLOCK_REASON = 'The customer asked for a new fixture.';
const NO_UNDO = 'This cannot be undone, except by Unlock.';
const NOT_APPROVED_SENTENCE = 'This estimate has not been approved.';
const UNCONFIRMED_START = 'We could not confirm that the estimate was marked as quoted.';
const INTRO = /Do this once the quote has been sent to .+\. The status becomes Quoted, with your name and the time\./;

const markButton = (page: Page) => page.locator('#review-mark-quoted');
const unlockButton = (page: Page) => page.locator('#review-unlock');
const dialogOf = (page: Page, code: string) => page.getByRole('alertdialog', { name: `Mark ${code} as quoted?` });
const notYetOf = (dialog: Locator) => dialog.getByRole('button', { name: 'Not yet' });
const submitOf = (dialog: Locator) => dialog.getByRole('button', { name: /^(Mark as quoted|Marking as quoted)$/ });
const noticeOf = (page: Page) => page.locator('#review-quoted-notice');
const badgeOf = (page: Page) => page.locator('[data-slot="status-badge"]').first();

/** An estimate approved through the API, then opened as the Lead who approved it, with the Mark as quoted button on and its script live. */
async function openedApproved(page: Page, testInfo: Parameters<typeof approvedEstimate>[1]) {
  const approved = await approvedEstimate(page, testInfo);
  const response = await page.goto(`/estimates/${approved.code}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(approved.code);
  await expect(markButton(page)).toBeEnabled();
  await waitUntilHydrated(page, '#review-mark-quoted');
  return approved;
}

async function openDialog(page: Page, code: string): Promise<Locator> {
  await markButton(page).click();
  const dialog = dialogOf(page, code);
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('AC-1, AC-4, AC-9: the dialog', () => {
  test('opens with focus on "Not yet", says the quote has been sent, that only Unlock can reverse it and the download marker, keeps focus inside, scrolls no way sideways, has no axe violation and 44 px targets below 1024 px; Escape sends nothing and gives focus back', async ({ page }, testInfo) => {
    const { code, owner } = await openedApproved(page, testInfo);
    let sent = 0;
    await page.route(MARK_ROUTE, async (route) => {
      sent += 1;
      await route.continue();
    });
    await expect(markButton(page)).toHaveText('Mark as quoted');
    await expect(unlockButton(page)).toBeVisible();
    await markButton(page).focus();
    await page.keyboard.press('Enter');
    const dialog = dialogOf(page, code);
    await expect(dialog).toBeVisible();

    await expect(notYetOf(dialog)).toBeFocused();
    await expect(dialog).toContainText(INTRO);
    await expect(dialog).toContainText(NO_UNDO);
    await expect(dialog.locator('[data-slot="download-chip"]')).toContainText('Not downloaded');
    await expect(submitOf(dialog)).toBeEnabled();
    await expect(dialog).not.toContainText(/not quoted|unmark|undo the/i);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    if (!isDesktopProject(testInfo.project.name)) {
      for (const control of [notYetOf(dialog), submitOf(dialog)]) expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }

    // Tab stays inside the dialog: Not yet, Mark as quoted, and round again.
    const inside = dialog.locator(':focus');
    for (let press = 0; press < 4; press += 1) {
      await page.keyboard.press('Tab');
      await expect(inside).toHaveCount(1);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(markButton(page)).toBeFocused();
    expect(sent).toBe(0);
    expect(await readQuote(owner.id)).toMatchObject({ status: 'APPROVED', quotedBy: null, quotedAtSet: false, entries: 0 });
  });
});

test.describe('AC-2, AC-5, AC-7: a good mark', () => {
  test('shows "Marking as quoted" while it is under way, then the Quoted notice with who and when, the status Quoted, Unlock still offered and nothing else of the approval\'s actions; the task is in the Closed tab as Quoted', async ({ page }, testInfo) => {
    const { code, owner, lead } = await openedApproved(page, testInfo);
    await page.route(MARK_ROUTE, async (route) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, SLOW_MILLISECONDS);
      });
      await route.continue();
    });
    const dialog = await openDialog(page, code);
    const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/estimates/${owner.id}/quoted`));
    await submitOf(dialog).click();
    await expect(dialog.getByRole('button', { name: 'Marking as quoted' })).toBeDisabled();
    // The dialog cannot be dismissed while the request is under way.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    const response = await answered;
    expect(response.status()).toBe(200);
    const answer = (await response.json()) as { status: string; quoted: Record<string, unknown> };
    expect(Object.keys(answer).sort()).toEqual(['quoted', 'status']);
    expect(Object.keys(answer.quoted).sort()).toEqual(['at', 'byName']);

    await expect(dialog).toHaveCount(0);
    const notice = noticeOf(page);
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(`by ${lead.name}.`);
    await expect(notice).toContainText(/Quoted on \d{2} \w{3} \d{4}, \d{2}:\d{2} IST by /);
    await expect(notice).toContainText('This is the last status; the estimate stays locked at the approved figures.');
    await expect(notice).toBeFocused();
    await expect(badgeOf(page)).toHaveAttribute('data-status', 'QUOTED');
    await expect(badgeOf(page)).toHaveText('Quoted');
    // The estimate stays locked as an approved one: Unlock is the way back, Approve and Mark as quoted are gone, the Approved notice is replaced, and the file is still there.
    await expect(markButton(page)).toHaveCount(0);
    await expect(page.locator('#review-approve')).toHaveCount(0);
    await expect(page.locator('#review-approved-notice')).toHaveCount(0);
    await expect(unlockButton(page)).toBeVisible();
    await expect(page.locator('#review-download')).toBeVisible();
    await expect(page.getByText(/not quoted|unmark/i)).toHaveCount(0);
    expect(await readQuote(owner.id)).toMatchObject({ status: 'QUOTED', quotedBy: lead.id, quotedAtSet: true, entries: 1, entry: { actorId: lead.id, before: { status: 'APPROVED' }, after: { status: 'QUOTED' } } });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);

    // The Closed tab: the task stays closed, now as Quoted.
    await page.goto(`/queue?tab=closed&assignedBy=anyone&q=${encodeURIComponent(code)}`);
    const row = page.locator(`[data-task-code="${code}"]:visible`);
    await expect(row).toBeVisible();
    await expect(row.locator('[data-slot="status-badge"]')).toHaveAttribute('data-status', 'QUOTED');
    await expect(row.locator('[data-slot="status-badge"]')).toHaveText('Quoted');

  });
});

test.describe('AC-8: what the Engineer is told', () => {
  test('the Engineer reads the status word Quoted on their own task, and no notice, no name of who marked it and no time of it', async ({ page }, testInfo) => {
    const { code, owner, lead } = await approvedEstimate(page, testInfo);
    // The mark is made through the API as another window would send it: this test is about what the Engineer is shown, and the mark itself is the test above.
    expect(await markQuotedThroughTheApi(page, owner.id)).toBe(200);
    await signInAs(page, owner);
    const own = await page.goto(`/estimates/${code}`);
    expect(own?.status()).toBe(200);
    await expect(badgeOf(page)).toHaveAttribute('data-status', 'QUOTED');
    await expect(badgeOf(page)).toHaveText('Quoted');
    await expect(page.locator('#review-quoted-notice')).toHaveCount(0);
    expect(await page.locator('main').innerText()).not.toContain(lead.name);
    expect(await page.locator('main').innerText()).not.toMatch(/Quoted on /);
  });
});

test.describe('AC-3, AC-4: the dialog when the mark is refused or no answer comes', () => {
  test('a refusal keeps the server\'s sentence in view with focus on it and nothing is written; the page is drawn again only when the dialog is closed, and focus lands on the action bar', async ({ page }, testInfo) => {
    const { code, owner } = await openedApproved(page, testInfo);
    await page.route(MARK_ROUTE, async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/problem+json',
        body: JSON.stringify({ type: 'about:blank', title: NOT_APPROVED_SENTENCE, status: 409, code: 'ESTIMATE_NOT_APPROVED' }),
      });
    });
    const dialog = await openDialog(page, code);
    await submitOf(dialog).click();
    const alert = dialog.locator('#mark-quoted-alert');
    await expect(alert).toContainText(NOT_APPROVED_SENTENCE);
    await expect(alert).toBeFocused();
    // The sentence stays: nothing redraws the page behind it, and a repeat is off.
    await expect(submitOf(dialog)).toBeDisabled();
    await expect(dialog).toBeVisible();
    await expect(alert).toContainText(NOT_APPROVED_SENTENCE);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    expect(await readQuote(owner.id)).toMatchObject({ status: 'APPROVED', quotedBy: null, quotedAtSet: false, entries: 0 });

    await notYetOf(dialog).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#review-actions')).toBeFocused();
  });

  test('no answer shows the "could not confirm" sentence and turns the button back on; a second press then marks it once', async ({ page }, testInfo) => {
    const { code, owner, lead } = await openedApproved(page, testInfo);
    await page.route(MARK_ROUTE, async (route) => {
      await route.abort();
    });
    const dialog = await openDialog(page, code);
    await submitOf(dialog).click();
    await expect(dialog).toContainText(UNCONFIRMED_START);
    await expect(dialog).toContainText('pressing again cannot mark it twice');
    await expect(submitOf(dialog)).toBeEnabled();
    expect(await readQuote(owner.id)).toMatchObject({ status: 'APPROVED', quotedBy: null, entries: 0 });

    await page.unroute(MARK_ROUTE);
    await submitOf(dialog).click();
    await expect(noticeOf(page)).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(await readQuote(owner.id)).toMatchObject({ status: 'QUOTED', quotedBy: lead.id, entries: 1 });
  });
});

test.describe('AC-3: a second press', () => {
  test('made in another window while the dialog was open is the 409, treated as done: the page is drawn again, the notice shows, and there is one mark and one entry', async ({ page }, testInfo) => {
    const { code, owner, lead } = await openedApproved(page, testInfo);
    const dialog = await openDialog(page, code);
    // Someone presses Mark as quoted in another window: the estimate is QUOTED.
    expect(await markQuotedThroughTheApi(page, owner.id)).toBe(200);
    await submitOf(dialog).click();

    await expect(noticeOf(page)).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(markButton(page)).toHaveCount(0);
    expect(await readQuote(owner.id)).toMatchObject({ status: 'QUOTED', quotedBy: lead.id, entries: 1 });
  });
});

test.describe('AC-1, AC-2, AC-3: who is offered it and who is refused', () => {
  test('an ignored approved estimate has no button (the action bar is not drawn while it is ignored, CR-01 item 7D), and the route refuses it as 409 ESTIMATE_IGNORED, writing nothing', async ({ page }, testInfo) => {
    const { code, owner, lead } = await approvedEstimate(page, testInfo);
    await ignoreEstimate(owner.id, lead.id);
    const response = await page.goto(`/estimates/${code}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(code);
    await expect(page.locator('#review-ignored-notice')).toBeVisible();
    await expect(page.locator('#review-actions')).toHaveCount(0);
    await expect(unlockButton(page)).toHaveCount(0);
    await expect(markButton(page)).toHaveCount(0);
    expect(await markQuotedThroughTheApi(page, owner.id)).toBe(409);
    expect(await readQuote(owner.id)).toMatchObject({ status: 'APPROVED', quotedBy: null, quotedAtSet: false, entries: 0 });
  });

  test('an Engineer is refused by the route with 403, whatever the estimate is, and has no button on their own page', async ({ page }, testInfo) => {
    const { code, owner } = await approvedEstimate(page, testInfo);
    await signInAs(page, owner);
    expect(await markQuotedThroughTheApi(page, owner.id)).toBe(403);
    expect(await markQuotedThroughTheApi(page, '00000000-0000-4000-8000-00000000dead')).toBe(403);
    const own = await page.goto(`/estimates/${code}`);
    expect(own?.status()).toBe(200);
    await expect(markButton(page)).toHaveCount(0);
    expect(await readQuote(owner.id)).toMatchObject({ status: 'APPROVED', quotedBy: null, quotedAtSet: false, entries: 0 });
  });
});

test.describe('AC-6: the only way back is Unlock', () => {
  test('a Quoted estimate is offered Unlock as an Approved one is, and unlocking returns it to Draft with the marker cleared; there is no other undo on the screen', async ({ page }, testInfo) => {
    const { code, owner, lead } = await approvedEstimate(page, testInfo);
    expect(await markQuotedThroughTheApi(page, owner.id)).toBe(200);
    expect(await readQuote(owner.id)).toMatchObject({ status: 'QUOTED', quotedBy: lead.id });
    const response = await page.goto(`/estimates/${code}`);
    expect(response?.status()).toBe(200);
    await expect(noticeOf(page)).toBeVisible();
    await expect(unlockButton(page)).toBeEnabled();
    await expect(markButton(page)).toHaveCount(0);
    await expect(page.getByText(/not quoted|unmark|undo/i)).toHaveCount(0);
    await waitUntilHydrated(page, '#review-unlock');

    await unlockButton(page).click();
    const dialog = page.getByRole('alertdialog', { name: `Unlock ${code}` });
    await expect(dialog).toBeVisible();
    await dialog.locator('#unlock-reason').fill(UNLOCK_REASON);
    await dialog.getByRole('button', { name: /^(Unlock|Unlocking)$/ }).click();

    await expect(page.locator('#review-unlocked-notice')).toBeVisible();
    await expect(noticeOf(page)).toHaveCount(0);
    await expect(markButton(page)).toHaveCount(0);
    await expect(badgeOf(page)).toHaveAttribute('data-status', 'DRAFT');
    expect(await readQuote(owner.id)).toMatchObject({ status: 'DRAFT', quotedBy: null, quotedAtSet: false, entries: 1 });
  });
});
