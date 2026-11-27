import { expect, test, type Locator, type Page, type Request as PlaywrightRequest, type TestInfo } from '@playwright/test';

import { createDisposableUser, readEstimateState, saveCanaryQuantity, useFreshAddress } from './support/auth';
import { calculateAsEngineer, engineerWithEstimate, signInAs, signInAsLead } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-06.06 (AC-1, AC-2, AC-4, AC-5, AC-8; FR-062, NFR-002, NFR-016 to NFR-018): Approve and lock, SCR-06 and SCR-08, for a Lead at `/estimates/<code>`, at 360x800, 768x1024 and 1366x768. Each test makes an
 * Engineer of its own with an estimate (the recipe of the confidentiality scan), has the Engineer calculate it through the portal, and opens the same address as a Lead. What it checks: the dialog opens from the
 * enabled button with the field set to the calculated total and focus on it, a price that is not rupees shows the spec's sentence and sends nothing, Escape closes the dialog and gives focus back, the "Approving"
 * state, a good approval (the page shows the approved state, BO, Unlock in place of Approve, and focus on the notice), the two states of a page that went out of date while the dialog was open ("Estimate changed
 * while open" and "Figures recalculated while open", in the UX spec's words), what the Engineer sees afterwards ("Approved and locked." and no price), and no sideways scroll and no axe violation with the dialog
 * open. The words are the UX spec's (v0.30), written out here and not imported. Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const CHANGED_COUNT = '7';
const SLOW_MILLISECONDS = 800;
const APPROVE_ROUTE = '**/api/v1/estimates/*/approve';
const RUPEES = /^₹ [\d,]+\.\d{2}$/;
const PRICE_MESSAGE = 'Enter a price in rupees, 0 or more, with up to 2 decimals.';
const OUT_OF_DATE_ALERT = 'An input changed while this window was open. The total is cleared, so nothing was approved. Press Recalculate, then approve and lock again.';
const RECALCULATED_ALERT = 'The figures were calculated again after this page was loaded, so nothing was approved. Show the new figures and check the total before you approve.';

const tiles = (page: Page) => page.getByRole('region', { name: 'Totals' });
const approveButton = (page: Page) => page.locator('#review-approve');
const dialogOf = (page: Page) => page.getByRole('dialog', { name: 'Approve and lock' });
const priceField = (page: Page) => dialogOf(page).locator('#approve-price');
const submitOf = (page: Page) => dialogOf(page).getByRole('button', { name: /^(Approve and lock|Approving)$/ });

/**
 * AQP-416 (DEF-073, DL-334 (5), DL-327 (5)): step timing for the one case of this file that has run out of its 30 s on attempt 1 and passed on the retry, "AC-8: the dialog at this width", twice, each time waiting at
 * its last-but-one line for the product's own `#review-approved-notice`. It prints one line per step on **every** attempt at every width, not only a failed one, so the next stall names the step that used the time.
 * Nothing here is an assertion, a timeout, a retry or a trace (CLAUDE.md section 9 item 4): the case makes the same calls in the same order with the same checks as before, and the other cases of the file are untouched.
 *
 * Line format (fields separated by " | "; QA greps for the prefix):
 *   [AQP-416 step timing] <project> | attempt <n> | <case> | step <k> | <step> | <took> ms | at +<ms> ms | <detail>
 *   [AQP-416 step timing] <project> | attempt <n> | <case> | <request> | <event> | at +<ms> ms | <detail>
 * where "at" is counted from the start of the test body, and a `<request>` line is the Approve request (the POST of the dialog) or the refresh request (the RSC GET of `/estimates/<code>` that follows its answer), seen
 * from the page: sent, released (the end of the 800 ms hold the case puts on the Approve route), answered (the status), and the end of the body. The last line of an attempt is
 *   [AQP-416 step timing] <project> | attempt <n> | <case> | end | <status> | total <ms> ms | <the step standing, if any, and for how long> | Approve request: <what the page saw> | refresh request: <what the page saw>
 * and is printed by the afterEach hook, which still runs when the 30 s are used up, so a stall names its step and says whether the Approve request was answered. Only roles and statuses are printed, never an address.
 *
 * The set-up repeats the calls of `calculateWithoutThePage` and `signInAsLead` (support/calculated-estimate.ts) with the same checks, so that each can be timed without a change to the shared helpers: if those change,
 * change `openedAsLeadTimed` to match or take this observation out. AQP-416 (DEF-073, DL-342 (B)) took the Engineer's page load out of the set-up of this case: the step lines of run 45161052093 had the set-up at 55 to
 * 60 % of the case (desktop 14.9 s of 25.8 s), and nothing of the case is about the Engineer's page.
 */
const STEP_TIMING = '[AQP-416 step timing]';

interface TrackedRequest {
  readonly name: string;
  sentAt: number | null;
  releasedAt: number | null;
  answeredAt: number | null;
  summary: string;
}

class StepTimer {
  private readonly startedAt = Date.now();
  private steps = 0;
  private standing: { readonly name: string; readonly since: number } | null = null;
  private ended = false;
  private readonly approve: TrackedRequest = { name: 'Approve request', sentAt: null, releasedAt: null, answeredAt: null, summary: 'none was sent' };
  private readonly refresh: TrackedRequest = { name: 'refresh request', sentAt: null, releasedAt: null, answeredAt: null, summary: 'none was sent after the answer' };

  constructor(
    private readonly testInfo: TestInfo,
    private readonly label: string,
  ) {}

  private prefix(): string {
    return `${STEP_TIMING} ${this.testInfo.project.name} | attempt ${String(this.testInfo.retry + 1)} | ${this.label}`;
  }

  private print(text: string): void {
    process.stdout.write(`${this.prefix()} | ${text}${this.ended ? ' | printed after the end line' : ''}\n`);
  }

  private elapsed(): string {
    return `at +${String(Date.now() - this.startedAt)} ms`;
  }

  /** Runs one step, prints its line (also when it throws), and keeps it as the standing step while it runs. */
  async step<T>(name: string, run: () => Promise<T>, describe: (value: T) => string = () => ''): Promise<T> {
    this.steps += 1;
    const number = this.steps;
    const began = Date.now();
    this.standing = { name, since: began };
    const print = (detail: string): void => {
      const tail = detail === '' ? '' : ` | ${detail}`;
      this.print(`step ${String(number)} | ${name} | ${String(Date.now() - began)} ms | ${this.elapsed()}${tail}`);
    };
    try {
      const value = await run();
      print(describe(value));
      return value;
    } catch (error) {
      print(`FAILED: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]?.slice(0, 200) ?? ''}`);
      throw error;
    } finally {
      if (!this.ended) this.standing = null;
    }
  }

  /** The Approve route's hold is over and the request goes on to the server. */
  released(): void {
    this.approve.releasedAt = Date.now();
    this.print(`${this.approve.name} | released | ${this.elapsed()} | the ${String(SLOW_MILLISECONDS)} ms hold of the case is over`);
  }

  /** Prints what the page sees of the Approve request and of the refresh that follows its answer. Passive: the listeners change nothing the case does. */
  watch(page: Page): void {
    const which = (request: PlaywrightRequest): TrackedRequest | null => {
      const { pathname } = new URL(request.url());
      if (request.method() === 'POST' && pathname.endsWith('/approve')) return this.approve;
      if (this.approve.answeredAt !== null && request.method() === 'GET' && request.url().includes('_rsc=') && pathname.startsWith('/estimates/')) return this.refresh;
      return null;
    };
    const since = (from: number | null): string => (from === null ? 'no start' : `${String(Date.now() - from)} ms`);
    page.on('request', (request) => {
      const tracked = which(request);
      if (tracked === null) return;
      tracked.sentAt = Date.now();
      tracked.summary = 'sent, not answered yet';
      this.print(`${tracked.name} | sent | ${this.elapsed()}`);
    });
    page.on('response', (response) => {
      const tracked = which(response.request());
      if (tracked === null) return;
      tracked.answeredAt = Date.now();
      const released = tracked.releasedAt === null ? '' : ` | ${since(tracked.releasedAt)} after the hold was released`;
      tracked.summary = `answered with status ${String(response.status())}, ${since(tracked.sentAt)} after it was sent${released}`;
      this.print(`${tracked.name} | answered | ${this.elapsed()} | status ${String(response.status())} | ${since(tracked.sentAt)} after sent${released}`);
    });
    page.on('requestfinished', (request) => {
      const tracked = which(request);
      if (tracked !== null) this.print(`${tracked.name} | body end | ${this.elapsed()} | ${since(tracked.sentAt)} after sent`);
    });
    page.on('requestfailed', (request) => {
      const tracked = which(request);
      if (tracked === null) return;
      tracked.summary = `FAILED after ${since(tracked.sentAt)}: ${request.failure()?.errorText ?? 'no reason'}`;
      this.print(`${tracked.name} | FAILED | ${this.elapsed()} | ${tracked.summary}`);
    });
  }

  /** The last line of an attempt: how it ended, the step that was still running, and what the page had seen of the two requests. */
  finish(): void {
    const now = Date.now();
    const standing = this.standing === null ? 'no step was standing' : `STANDING STEP: ${this.standing.name} for ${String(now - this.standing.since)} ms`;
    this.print(`end | ${String(this.testInfo.status)} | total ${String(now - this.startedAt)} ms | ${standing} | Approve request: ${this.approve.summary} | refresh request: ${this.refresh.summary}`);
    this.ended = true;
  }
}

const stepTimers = new Map<string, StepTimer>();

function startStepTiming(testInfo: TestInfo, label: string): StepTimer {
  const timer = new StepTimer(testInfo, label);
  stepTimers.set(testInfo.testId, timer);
  return timer;
}

// Runs after a test that used up its time too, so the end line of a stalled attempt names the step that was standing.
test.afterEach(() => {
  const testInfo = test.info();
  stepTimers.get(testInfo.testId)?.finish();
  stepTimers.delete(testInfo.testId);
});

const statusOf = (response: { status(): number } | null): string => `status ${response === null ? 'none' : String(response.status())}`;

/** `openedAsLead` with its steps timed: the same calls, in the same order, with the same checks. */
async function openedAsLeadTimed(timer: StepTimer, page: Page, testInfo: TestInfo) {
  const { owner, code } = await timer.step('Engineer and estimate made', () => engineerWithEstimate(testInfo));
  await timer.step('Engineer sign-in', () => signInAs(page, owner));
  // No page load for the Engineer (DEF-073 fix, DL-342 (B)): the press of Calculate is the request the button sends, as `calculateWithoutThePage` makes it, and nothing of this case is about the Engineer's page.
  const answer = await timer.step('Engineer Calculate: POST (no page)', () => page.request.post(`/api/v1/estimates/${owner.id}/calculate`, { headers: { origin: DEVELOPMENT_URL } }), (value) => statusOf(value));
  expect(answer.status(), 'the Calculate of the Engineer').toBe(200);
  expect(await timer.step('Engineer Calculate: read the estimate state', () => readEstimateState(owner.id))).toEqual({ status: 'PREPARED', calculations: 1 });
  const lead = await timer.step('Lead made', () => createDisposableUser('axe', testInfo, 'LEAD'));
  await timer.step('Lead sign-in', () => signInAs(page, lead));
  const response = await timer.step('Lead review page: goto', () => page.goto(`/estimates/${code}`), (answer) => statusOf(answer));
  expect(response?.status()).toBe(200);
  await timer.step('Lead review page: heading is the code', () => expect(page.getByRole('heading', { level: 1 })).toHaveText(`Estimate ${code}`));
  await timer.step('Lead review page: Approve enabled', () => expect(approveButton(page)).toBeEnabled());
  await timer.step('Lead review page: Approve hydrated', () => waitUntilHydrated(page, '#review-approve'));
  return { owner, code };
}

/** A calculated estimate opened as a Lead, with the figures current and Approve and lock on. */
async function openedAsLead(page: Page, testInfo: Parameters<typeof signInAsLead>[1]) {
  const { owner, code } = await engineerWithEstimate(testInfo);
  await calculateAsEngineer(page, owner, code);
  await signInAsLead(page, testInfo);
  const response = await page.goto(`/estimates/${code}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Estimate ${code}`);
  await expect(approveButton(page)).toBeEnabled();
  await waitUntilHydrated(page, '#review-approve');
  return { owner, code };
}

/** The calculated total as the BL tile shows it, without the rupee sign and the grouping: what the field starts as. */
async function totalOnTheTile(page: Page): Promise<string> {
  const text = await tiles(page).getByText(RUPEES).first().innerText();
  return text.replace('₹ ', '').replaceAll(',', '');
}

async function openDialog(page: Page): Promise<Locator> {
  await approveButton(page).click();
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('AC-1: the dialog', () => {
  test('opens from the enabled button with the field set to the calculated total and focus on it, and says what an override is', async ({ page }, testInfo) => {
    const { code } = await openedAsLead(page, testInfo);
    const total = await totalOnTheTile(page);
    const dialog = await openDialog(page);

    // AQP-478 (DEF-121, SCR-08): the heading names the estimate, the lead-in describes the dialog, the two rows say the calculated total and the customer, and the hint sits under the price.
    await expect(dialog.getByRole('heading', { name: `Approve and lock ${code}`, exact: true })).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription('Set the Approved Quote Price. After you approve, inputs become read-only and the task moves to Closed.');
    await expect(dialog.locator('dt', { hasText: /^Calculated total (B[A-Z])$/ }).locator('xpath=following-sibling::dd[1]')).toHaveText(/^₹ [d,]+.d{2}$/);
    await expect(dialog.locator('dt', { hasText: /^Customer$/ }).locator('xpath=following-sibling::dd[1]')).not.toBeEmpty();
    await expect(dialog).toContainText('Starts as the calculated total. Edit it to set a different price.');
    await expect(priceField(page)).toHaveAccessibleDescription(/Starts as the calculated total. Edit it to set a different price./);
    await expect(priceField(page)).toHaveValue(total);
    await expect(priceField(page)).toBeFocused();
    await expect(dialog).toContainText('Approved Quote Price');
    await expect(dialog).toContainText('If you change the price, the difference is recorded as an override. You can add a reason for it; the reason is optional.');
    await expect(submitOf(page)).toBeEnabled();
  });

  test('a price that is not rupees shows the spec\'s sentence under the field, sends nothing, and keeps what was typed; Escape closes and gives focus back', async ({ page }, testInfo) => {
    const { owner } = await openedAsLead(page, testInfo);
    let sent = 0;
    await page.route(APPROVE_ROUTE, async (route) => {
      sent += 1;
      await route.continue();
    });
    await openDialog(page);
    await priceField(page).fill('12.345');
    await submitOf(page).click();

    await expect(dialogOf(page).getByText(PRICE_MESSAGE)).toBeVisible();
    await expect(priceField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(priceField(page)).toHaveValue('12.345');
    await expect(priceField(page)).toBeFocused();
    expect(sent).toBe(0);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 1 });

    await page.keyboard.press('Escape');
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(approveButton(page)).toBeFocused();
  });
});

test.describe('AC-8: the dialog at this width', () => {
  test('is keyboard operable, has no sideways scroll and no axe violation, and shows "Approving" while the request is under way', async ({ page }, testInfo) => {
    const timer = startStepTiming(testInfo, 'AC-8');
    const { owner } = await openedAsLeadTimed(timer, page, testInfo);
    timer.watch(page);
    await page.route(APPROVE_ROUTE, async (route) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, SLOW_MILLISECONDS);
      });
      timer.released();
      await route.continue();
    });
    await timer.step('Approve button: focus, Enter', async () => {
      await approveButton(page).focus();
      await page.keyboard.press('Enter');
    });
    await timer.step('dialog is visible', () => expect(dialogOf(page)).toBeVisible());
    await timer.step('price field is focused', () => expect(priceField(page)).toBeFocused());
    expect(await timer.step('horizontal overflow read', () => horizontalOverflow(page))).toBeLessThanOrEqual(0);
    await timer.step('axe scan, dialog open', () => expectNoAxeViolations(page));

    // Tab stays inside the dialog: price, Cancel, Approve and lock, and round again.
    const inside = dialogOf(page).locator(':focus');
    await timer.step('five Tab presses inside the dialog', async () => {
      for (let press = 0; press < 5; press += 1) {
        await page.keyboard.press('Tab');
        await expect(inside).toHaveCount(1);
      }
    });

    await timer.step('price field: focus, Enter (the approval is sent)', async () => {
      await priceField(page).focus();
      await page.keyboard.press('Enter');
    });
    await timer.step('"Approving" button is disabled', () => expect(dialogOf(page).getByRole('button', { name: 'Approving' })).toBeDisabled());
    // The dialog cannot be dismissed while the request is under way.
    await timer.step('Escape pressed', () => page.keyboard.press('Escape'));
    await timer.step('dialog is still visible', () => expect(dialogOf(page)).toBeVisible());
    await timer.step('approved notice is visible (#review-approved-notice)', () => expect(page.locator('#review-approved-notice')).toBeVisible());
    expect(await timer.step('estimate state read', () => readEstimateState(owner.id))).toEqual({ status: 'APPROVED', calculations: 1 });
  });
});

test.describe('AC-2, AC-5: a good approval', () => {
  test('locks the estimate: the page shows the approved state with BO, Unlock in place of Approve and lock, and focus on the notice; the Engineer then sees "Approved and locked." and no price', async ({ page }, testInfo) => {
    const { owner, code } = await openedAsLead(page, testInfo);
    await openDialog(page);
    await priceField(page).fill('48271.37');
    const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/estimates/${owner.id}/approve`));
    await submitOf(page).click();
    const response = await answered;
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'APPROVED', approvedPrice: '48271.37' });

    await expect(dialogOf(page)).toHaveCount(0);
    const notice = page.locator('#review-approved-notice');
    await expect(notice).toContainText('Approved and locked on');
    await expect(notice).toContainText('Locked. Values stay as approved even if rates change later.');
    await expect(notice).toContainText('Only the Admin can cancel an approval.');
    await expect(notice).toBeFocused();
    await expect(tiles(page)).toContainText('₹ 48,271.37');
    await expect(tiles(page)).toContainText('Approved by');
    await expect(approveButton(page)).toHaveCount(0);
    // Unlock works from STORY-06.08: the button is on (its own tests are `unlock.spec.ts`).
    await expect(page.locator('#review-unlock')).toBeEnabled();
    // STORY-07.07: the figures are current, so Download is the link to SCR-10, approved or not.
    await expect(page.locator('#review-download')).toHaveAttribute('href', `/estimates/${code}/export`);
    expect(await readEstimateState(owner.id)).toEqual({ status: 'APPROVED', calculations: 1 });

    // The Engineer, on the same address, is told it is approved and locked and sees no price (NFR-002).
    await signInAs(page, owner);
    const own = await page.goto(`/estimates/${code}`);
    expect(own?.status()).toBe(200);
    await expect(page.getByText('Approved and locked.', { exact: true })).toBeVisible();
    await expect(page.getByText('48,271.37')).toHaveCount(0);
    await expect(page.getByText('Approved Quote Price')).toHaveCount(0);
    await expect(page.locator('#calculate-button')).toHaveCount(0);
  });
});

test.describe('the page changed while the dialog was open', () => {
  test('an input changed (409 TOTALS_OUT_OF_DATE): the spec\'s alert, Approve and lock off, "Recalculate first" in place of Cancel, and nothing approved', async ({ page }, testInfo) => {
    const { owner } = await openedAsLead(page, testInfo);
    await openDialog(page);
    await saveCanaryQuantity(owner.id, CHANGED_COUNT);
    await submitOf(page).click();

    await expect(dialogOf(page).getByRole('alert').filter({ hasText: OUT_OF_DATE_ALERT })).toBeVisible();
    await expect(submitOf(page)).toBeDisabled();
    await expect(dialogOf(page).getByRole('button', { name: 'Cancel' })).toHaveCount(0);
    const wayOn = dialogOf(page).getByRole('button', { name: 'Recalculate first' });
    await expect(wayOn).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 1 });

    await wayOn.click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'The total is cleared because an input changed.' })).toBeVisible();
    await expect(page.locator('#review-calculate')).toHaveText('Recalculate');
    await expect(approveButton(page)).toBeDisabled();
  });

  test('the figures were calculated again (409 CALCULATION_CHANGED): the alert in the spec\'s words, "Show the new figures" has focus, and the next dialog starts from the new total', async ({ page }, testInfo) => {
    const { owner } = await openedAsLead(page, testInfo);
    await openDialog(page);
    // Someone presses Recalculate in another tab: the estimate stays Prepared with a newer calculation.
    const recalculated = await page.evaluate(async (id) => (await fetch(`/api/v1/estimates/${id}/recalculate`, { method: 'POST' })).status, owner.id);
    expect(recalculated).toBe(200);
    await priceField(page).fill('1.00');
    await submitOf(page).click();

    await expect(dialogOf(page).getByRole('alert').filter({ hasText: RECALCULATED_ALERT })).toBeVisible();
    await expect(submitOf(page)).toBeDisabled();
    const wayOn = dialogOf(page).getByRole('button', { name: 'Show the new figures' });
    await expect(wayOn).toBeFocused();
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 2 });

    await wayOn.click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page.locator('#review-calculated')).toBeFocused();

    // The new dialog is a new one: the field starts as the total again, and the price typed before ("1.00") is not kept. Nothing was approved by the refused press.
    const total = await totalOnTheTile(page);
    await openDialog(page);
    await expect(priceField(page)).toHaveValue(total);
    await expect(priceField(page)).not.toHaveValue('1.00');
    expect(await readEstimateState(owner.id)).toEqual({ status: 'PREPARED', calculations: 2 });
  });
});
