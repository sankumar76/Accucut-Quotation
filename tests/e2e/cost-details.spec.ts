import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { createDisposableUser, E2E_PASSWORD, readEstimateState, saveCanaryQuantity, signInWithoutThePage, useFreshAddress, type E2eUser } from './support/auth';
import { calculateAsEngineer, engineerWithEstimate, signInAsLead } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow, tokenColour } from './support/design-system';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-06.03 (AC-1 to AC-9; NFR-002): the cost details of a row, SCR-07, for a Lead and an Admin at `/estimates/<code>/costs/1`, at 360x800, 768x1024 and 1366x768. Each test makes an Engineer of its own with
 * an estimate (the recipe of the confidentiality scan), has the Engineer calculate it through the portal, and opens the page as a Lead. What it checks: the six panels with each line's tag, name, formula,
 * working and value; that the page only reads (no field, no button that changes anything); the cleared and not-calculated states; that the Engineer gets the fixed 403 from the route and SCR-26 from the
 * page, and sees no link to either; the phone's accordion with only stage 1 open, the side-by-side layout from 1280 px, the keyboard, no sideways scroll and no axe violation. The words are the UX spec's and the
 * story's, written out here and not imported. The figures and the working of the hand-worked row are held by `tests/unit/estimate/cost-working.test.ts` and `tests/unit/cost-details-screen.test.ts` (the
 * canary materials here have prices that no hand repeat of a 4-decimal working could reproduce); the cost scan reads the same page and route as an Engineer and as a Lead (`canary-scan.spec.ts`).
 * Every name and path is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

/**
 * AQP-411 (DEF-069, DL-335 (6)): a warm-up of the cost route, once per worker, before its first case of this file. WHY: no test calls the route between `canary-scan.spec.ts` and the two cases below, so when the
 * file's cases reach it the development server has not been asked for it for 70 to 94 s. In the seven attempt-1 readings of the AC-8 case that were read (the three widths of run 45128502168 and four earlier runs),
 * the Engineer's first request to it took 1.9 s (mobile), 3.8 and 4.5 s (tablet) and 5.1 to 6.7 s (desktop), and the Lead's request to the same route in "cleared" ended 0.11 to 0.46 s after it every time. If both
 * waited for the first use of the route after that gap, the wait now happens here, in the hook, on a Lead's request. If they did not, the readings stay as they were, and that is the answer. The warm-up does NOT
 * stand in for any Engineer's request: the cases still send all of those, after a real sign-in, with their status and time printed. It asks for an estimate that is not there, so it is a Lead's 404 from the service
 * (its lookup finds nothing) and nothing is made. A failure here is a failure of the hook, which every case of the worker shows. It prints one `[AQP-411 warm-up]` line.
 */
const NO_SUCH_ID = '11111111-1111-4111-8111-111111111111';
test.beforeAll(async ({ browser }, testInfo) => {
  const started = Date.now();
  const context = await browser.newContext({ baseURL: DEVELOPMENT_URL });
  try {
    await useFreshAddress(context);
    const page = await context.newPage();
    const lead = await createDisposableUser('axe', testInfo, 'LEAD');
    await signInWithoutThePage(page, lead.email, E2E_PASSWORD);
    const asked = Date.now();
    const answer = await page.request.get(`/api/v1/estimates/${NO_SUCH_ID}/nodes/${NO_SUCH_ID}/costs`);
    expect(answer.status(), 'a Lead is told there is no such estimate').toBe(404);
    process.stdout.write(`[AQP-411 warm-up] ${testInfo.project.name} | worker ${String(testInfo.workerIndex)} | the Lead's request to the cost route took ${String(Date.now() - asked)} ms, the hook ${String(Date.now() - started)} ms\n`);
  } finally {
    await context.close();
  }
});

const PHONE_MAX = 767;
const STAGE_TITLES = ['1 · Weights & Areas', '2 · Material Cost', '3 · Process Costs', '4 · Sub Total', '5 · Rejection, Overheads & Logistics', '6 · Pricing'];
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1_000) <= PHONE_MAX;
const stage = (page: Page, number: number) => page.locator(`details[data-stage="${number}"]`);

/**
 * AQP-411 (DEF-069, DL-327 (5)): step timing for the two cases of this file that have run out of their 30 s on attempt 1 and passed on the retry, the "not found" case and the NFR-002 case of AC-8. It prints one
 * line per step on **every** attempt at every width, not only a failed one, so the next stall names the step that used the time and a slow sign-in is told from a slow refusal of the cost route. Nothing here
 * is an assertion, a timeout, a retry or a trace (CLAUDE.md section 9 item 4), and the two cases prove what they proved before: every check is kept. The one change in the calls since the lines were first printed (AQP-411,
 * the fix of DL-335 (6)): the Engineer presses Calculate without loading the estimate page first (`calculateTimed`), so the steps are numbered one lower from there on and "estimate page: goto" of the owner is gone from the
 * list. The AC-8 case still opens the owner's page, as "own estimate page: goto", where it is the subject.
 *
 * Line format (fields separated by " | "; QA greps for the prefix):
 *   [AQP-411 step timing] <project> | attempt <n> | <case> | step <k> | <step> | <took> ms | at +<ms> ms | <detail>
 * where "at" is the end of the step counted from the start of the test body. The last line of an attempt is
 *   [AQP-411 step timing] <project> | attempt <n> | <case> | end | <status> | total <ms> ms | <the step standing, if any, and for how long>
 * and is printed by the afterEach hook, which still runs when the 30 s are used up, so a stall names its step there. A cost-route fetch of an Engineer also prints the time its request took inside the page, to the
 * end of the body, and marks the line when that is over 5 s, the product trigger of DL-327 (6)(b). Only the role of a person is printed, never an e-mail address or a password.
 *
 * The sign-in below repeats the calls of `signInWithoutThePage` (support/auth.ts), with the same checks, so that the CSRF GET, its body read and the credentials POST can each be timed without a change to the
 * shared helper: if that helper changes, change this to match or take this observation out.
 */
const STEP_TIMING = '[AQP-411 step timing]';
const FORBIDDEN_ROUTE_OVER_MS = 5_000;

class StepTimer {
  private readonly startedAt = Date.now();
  private steps = 0;
  private standing: { readonly name: string; readonly since: number } | null = null;
  private ended = false;

  constructor(
    private readonly testInfo: TestInfo,
    private readonly label: string,
  ) {}

  private prefix(): string {
    return `${STEP_TIMING} ${this.testInfo.project.name} | attempt ${String(this.testInfo.retry + 1)} | ${this.label}`;
  }

  /** Runs one step, prints its line (also when it throws), and keeps it as the standing step while it runs. */
  async step<T>(name: string, run: () => Promise<T>, describe: (value: T) => string = () => ''): Promise<T> {
    this.steps += 1;
    const number = this.steps;
    const began = Date.now();
    this.standing = { name, since: began };
    const print = (detail: string): void => {
      const tail = detail === '' ? '' : ` | ${detail}`;
      const late = this.ended ? ' | printed after the end line' : '';
      process.stdout.write(`${this.prefix()} | step ${String(number)} | ${name} | ${String(Date.now() - began)} ms | at +${String(Date.now() - this.startedAt)} ms${tail}${late}\n`);
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

  /** The last line of an attempt: how it ended and the step that was still running, if any. */
  finish(): void {
    const now = Date.now();
    const standing = this.standing === null ? 'no step was standing' : `STANDING STEP: ${this.standing.name} for ${String(now - this.standing.since)} ms`;
    process.stdout.write(`${this.prefix()} | end | ${String(this.testInfo.status)} | total ${String(now - this.startedAt)} ms | ${standing}\n`);
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

/** The sign-in of `signInWithoutThePage`, one step per call. `role` is the word printed, never the address. */
async function signInTimed(timer: StepTimer, page: Page, role: string, person: E2eUser): Promise<void> {
  await timer.step(`${role} sign-in: clear cookies`, () => page.context().clearCookies());
  const token = await timer.step(`${role} sign-in: CSRF GET`, () => page.request.get('/api/auth/csrf'), (response) => statusOf(response));
  expect(token.ok(), 'the CSRF token of the sign-in').toBe(true);
  const { csrfToken } = await timer.step(`${role} sign-in: CSRF body read`, async () => (await token.json()) as { readonly csrfToken: string });
  const answer = await timer.step(
    `${role} sign-in: credentials POST`,
    () => page.request.post('/api/auth/callback/credentials', { form: { csrfToken, email: person.email, password: E2E_PASSWORD, json: 'true' } }),
    (response) => statusOf(response),
  );
  expect(answer.ok(), 'the credentials post of the sign-in').toBe(true);
  const { url } = await timer.step(`${role} sign-in: credentials body read`, async () => (await answer.json()) as { readonly url: string });
  expect(new URL(url, 'http://sign-in.invalid').searchParams.get('error'), 'the error the server names, if it refused').toBeNull();
}

/**
 * `calculateWithoutThePage` (support/calculated-estimate.ts) with its steps timed: the sign-in, the press and the check of the state. The press is the request the button sends, with the portal's own `Origin`,
 * and no page is loaded first: neither case is about the Engineer's page at this point, and that load was 2.4 to 6.6 s of each case's 30 s (DEF-069, step 7 of the lines of 45128502168). The Engineer's own
 * estimate page is still opened by the AC-8 case later, where it is the subject.
 */
async function calculateTimed(timer: StepTimer, page: Page, owner: E2eUser & { readonly id: string }): Promise<void> {
  await signInTimed(timer, page, 'Engineer (owner)', owner);
  const status = await timer.step(
    'Engineer (owner) Calculate: request without a page',
    async () => (await page.request.post(`/api/v1/estimates/${owner.id}/calculate`, { headers: { origin: DEVELOPMENT_URL } })).status(),
    (value) => `status ${String(value)}`,
  );
  expect(status, 'the Calculate of the Engineer').toBe(200);
  expect(await timer.step('Engineer (owner) Calculate: read the estimate state', () => readEstimateState(owner.id))).toEqual({ status: 'PREPARED', calculations: 1 });
}

/** One `fetch` of the cost route from the page, with its time inside the page from the request to the end of the body (DL-327 (5)). */
async function fetchCostRoute(timer: StepTimer, page: Page, role: string, id: string): Promise<{ readonly status: number; readonly body: string }> {
  const isEngineer = role.startsWith('Engineer');
  return timer.step(
    `${role} cost-route fetch`,
    () =>
      page.evaluate(async (nodeId) => {
        const began = performance.now();
        const response = await fetch(`/api/v1/estimates/${nodeId}/nodes/${nodeId}/costs`);
        const body = await response.text();
        return { status: response.status, body, ms: Math.round(performance.now() - began) };
      }, id),
    (answer) =>
      `status ${String(answer.status)} | request to body end ${String(answer.ms)} ms in the page${isEngineer && answer.ms > FORBIDDEN_ROUTE_OVER_MS ? ` | OVER ${String(FORBIDDEN_ROUTE_OVER_MS)} ms: the product trigger of DL-327 (6)(b)` : ''}`,
  );
}

async function openCostDetails(page: Page, code: string, slNo = '1'): Promise<void> {
  const response = await page.goto(`/estimates/${code}/costs/${slNo}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cost details');
}

/** Opens every stage. On a phone the script closes stages 2 to 6 after load, so this waits for that first and then opens what is closed: a line in a closed panel is not visible. */
async function openAllStages(page: Page): Promise<void> {
  if (isPhone(page)) await expect(stage(page, 6)).not.toHaveAttribute('open', '');
  for (const number of [1, 2, 3, 4, 5, 6]) {
    if ((await stage(page, number).getAttribute('open')) === null) await stage(page, number).locator('summary').click();
    await expect(stage(page, number)).toHaveAttribute('open', '');
  }
}

test.describe('AC-1, AC-2: a calculated estimate, as a Lead', () => {
  test('AC-1: six panels with the number and name of each stage, the total in the summary, and each line with its tag, name, formula and working', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await signInAsLead(page, testInfo);
    await openCostDetails(page, code);

    // AQP-452 (DEF-113; UX spec SCR-07, the mock-up): the breadcrumb "Task queue / <code> / Cost details <Sl. No>", the description, the row's heading and its one box.
    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(crumbs.getByRole('link', { name: 'Task queue' })).toHaveAttribute('href', '/queue');
    await expect(crumbs.getByRole('link', { name: code })).toHaveAttribute('href', `/estimates/${code}`);
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText(/^Cost details \d/);
    await expect(page.getByRole('main')).toContainText('Every calculated value for this row, in six stages, each with its formula. Lead and Admin only.');
    await expect(page.getByRole('main')).toContainText('Cost details for one row');
    await expect(page.getByRole('main').getByText('This row, on screen and in the Excel row')).toBeVisible();
    // The parts tree column: a link for each row to its own cost details, the open row marked, names and kinds and no figure; from 1024 px it is a column of the tree's width.
    const tree = page.getByRole('navigation', { name: 'Parts tree' });
    if ((page.viewportSize()?.width ?? 0) < 1024) {
      // Below 1024 px (AQP-491, DEF-137; ruling scr07-layout L7-1, L7-2): the panel is before the row heading, closed, and says the open row in its summary; opening it lists the rows.
      const panel = page.locator('[data-cost-tree]');
      const [treeTop, headingTop] = await Promise.all([panel.boundingBox(), page.getByText('Cost details for one row').boundingBox()]);
      expect(treeTop?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(headingTop?.y ?? 0);
      await expect(panel).not.toHaveAttribute('open', '');
      await expect(panel.locator('summary')).toHaveText(/^Parts tree · \d+(\.\d+)* /);
      await panel.locator('summary').click();
      await expect(panel).toHaveAttribute('open', '');
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    }
    await expect(tree.getByRole('link').first()).toHaveAttribute('aria-current', 'page');
    await expect(tree.locator('[aria-current="page"]')).toHaveCount(1);
    // No figure of any row: the text of the tree without its Sl. No. cells holds no number with decimals (a Sl. No. such as 1.10 is taken out first).
    const treeText = await tree.evaluate((element) => {
      const copy = element.cloneNode(true) as Element;
      for (const cell of copy.querySelectorAll('[data-sl-no]')) cell.remove();
      return copy.textContent ?? '';
    });
    expect(treeText).not.toMatch(/\d\.\d{2}/);
    expect(treeText).not.toContain('₹');
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      const box = await page.locator('[data-cost-tree]').boundingBox();
      expect(Math.round(box?.width ?? 0)).toBe(Number.parseInt(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tree-w')), 10));
      // AQP-491 (DEF-136, ruling scr07-layout L7-3, L7-4): two columns, the tree 320 px and the right column 710 px (+-2), the box above the first stage and as wide as the stage cards, no stage card under 600 px; the
      // number and the name of a row have a visible gap.
      expect(Math.round(box?.width ?? 0)).toBe(320);
      const [column, boxCard, firstStage, lastStage] = await Promise.all([
        page.locator('[data-cost-body]').boundingBox(),
        page.locator('[data-slot="card"]').filter({ hasText: 'Unit Production Price' }).first().boundingBox(),
        stage(page, 1).boundingBox(),
        stage(page, 6).boundingBox(),
      ]);
      if (column === null || boxCard === null || firstStage === null || lastStage === null) throw new Error('a box is missing');
      if ((page.viewportSize()?.width ?? 0) === 1366) expect(Math.abs(column.width - 710)).toBeLessThanOrEqual(2);
      expect(boxCard.y + boxCard.height).toBeLessThanOrEqual(firstStage.y + 1);
      expect(Math.abs(boxCard.width - firstStage.width)).toBeLessThanOrEqual(2);
      expect(Math.min(firstStage.width, lastStage.width)).toBeGreaterThanOrEqual(600);
      const gaps = await tree.getByRole('link').evaluateAll((links) => links.map((link) => (link.querySelector('[data-sl-no]')?.nextElementSibling?.getBoundingClientRect().left ?? 0) - (link.querySelector('[data-sl-no]')?.getBoundingClientRect().right ?? 0)));
      for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(6);
    }

    await expect(page.locator('details[data-stage]')).toHaveCount(6);
    for (const [index, title] of STAGE_TITLES.entries()) await expect(stage(page, index + 1).locator('summary')).toContainText(title);
    await expect(stage(page, 3).locator('summary')).toContainText(/Stage total: [\d,]+\.\d{2}/);
    await openAllStages(page);

    // AQP-475 (DEF-114; UX spec SCR-07, the mock-up's .stage): each stage is a numbered card, with its badge, its heading, its total at the right of the heading and a chevron that turns when it is open; the lines
    // are rows of the card; the sub-headings are capitals; the line of the price stays dark.
    for (const number of [1, 2, 3, 4, 5, 6]) {
      const summary = stage(page, number).locator('summary');
      await expect(summary.locator('[data-stage-number]')).toHaveText(String(number));
      const [badge, chevron, card] = await Promise.all([summary.locator('[data-stage-number]').boundingBox(), summary.locator('svg').boundingBox(), stage(page, number).boundingBox()]);
      if (badge === null || chevron === null || card === null) throw new Error('a box is missing');
      // AQP-491 (DEF-114 reopened): the tile is the mock-up's 28 px square with the digit whole, not a sliver.
      expect(Math.abs(badge.width - 28)).toBeLessThanOrEqual(1);
      expect(Math.abs(badge.height - 28)).toBeLessThanOrEqual(1);
      expect(badge.x).toBeLessThan(chevron.x);
      expect(chevron.x + chevron.width).toBeLessThanOrEqual(card.x + card.width);
      // Tailwind 4 turns it with the `rotate` property, not `transform`.
      await expect(summary.locator('svg')).toHaveCSS('rotate', '180deg');
    }
    const [title, figure] = await Promise.all([stage(page, 3).locator('summary > span').nth(1).boundingBox(), stage(page, 3).locator('summary span.tabular-nums').boundingBox()]);
    if (title === null || figure === null) throw new Error('a box is missing');
    expect(figure.x).toBeGreaterThanOrEqual(title.x + title.width - 1);
    await expect(stage(page, 3).locator('h3').first()).toHaveCSS('text-transform', 'uppercase');
    await expect(stage(page, 6).locator('li').filter({ hasText: /^Excel column BG/ })).toHaveCSS('background-color', await tokenColour(page, '--nav'));

    const material = stage(page, 2);
    await expect(material).toContainText('Excel column AK');
    await expect(material.getByText('AK = (M * I) - (O * Material-Scrap-Rate)', { exact: true })).toBeVisible();
    await expect(material.getByText(/^AK = \(.+ × .+\) - \(.+ × .+\) = [\d,]+\.\d{2}$/)).toBeVisible();
    await expect(stage(page, 1).getByText('O = IF(Material-Specific-Gravity > 0, M - N, 0)', { exact: true })).toBeVisible();
    await expect(stage(page, 6).getByText(/^BG = .+ = [\d,]+\.\d{2}$/)).toBeVisible();
    await expect(page.getByText('This row, on screen and in the Excel row').first()).toBeVisible();
  });

  test('AC-2: a sentence says what the working prints and states the rounding rule', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await signInAsLead(page, testInfo);
    await openCostDetails(page, code);

    await expect(page.getByText('repeating the arithmetic by hand gives the figure printed or, now and then, a figure a hundredth or two away from it.')).toBeVisible();
    await expect(page.getByText('The portal keeps every digit, adds the unrounded values and rounds once')).toBeVisible();
    await expect(page.getByText(/^Calculated .+ · configuration version \d+$/)).toBeVisible();
  });

  test('AC-6: the page only reads: no field, no button that changes anything, no editable element, and no edit control beside a formula', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await signInAsLead(page, testInfo);
    await openCostDetails(page, code);

    await expect(page.locator('main').locator('input, textarea, select, form, button, [contenteditable]')).toHaveCount(0);
    await expect(page.getByText('This page only shows the formulas. They cannot be changed here.')).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save|change formula/i })).toHaveCount(0);
  });

  test('AC-1: an Admin sees the same page, and the review of the estimate links to it from the row', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await signInAsLead(page, testInfo, 'ADMIN');
    await page.goto(`/estimates/${code}`);
    await page.getByRole('link', { name: /^View cost details for 1/ }).click();
    await expect(page).toHaveURL(new RegExp(`/estimates/${code}/costs/1$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cost details');
    await expect(page.locator('details[data-stage]')).toHaveCount(6);
  });

  test('a part that is not in the estimate, and an address that is no Sl. No, are "not found"', async ({ page }, testInfo) => {
    const timer = startStepTiming(testInfo, 'not-found');
    const { owner, code } = await timer.step('set-up: Engineer with an estimate', () => engineerWithEstimate(testInfo));
    await calculateTimed(timer, page, owner);
    const lead = await timer.step('set-up: Lead creation', () => createDisposableUser('axe', testInfo, 'LEAD'));
    await signInTimed(timer, page, 'Lead', lead);
    for (const slNo of ['2', '1.1', 'abc']) {
      const response = await timer.step(`Lead page goto, Sl. No ${slNo}`, () => page.goto(`/estimates/${code}/costs/${slNo}`), (value) => statusOf(value));
      expect(response?.status(), slNo).toBe(404);
    }
    const unknown = await timer.step('Lead page goto, an estimate that is not there', () => page.goto('/estimates/Q-1900-0001/costs/1'), (value) => statusOf(value));
    expect(unknown?.status()).toBe(404);
  });
});

test.describe('AC-7: the states with nothing current', () => {
  test('not calculated: the row header and the way back stay, and there is no stage', async ({ page }, testInfo) => {
    const { code } = await engineerWithEstimate(testInfo);
    await signInAsLead(page, testInfo);
    await openCostDetails(page, code);

    const notice = page.getByRole('status').filter({ hasText: 'The Engineer has not calculated this estimate yet' });
    await expect(notice).toBeVisible();
    await expect(page.locator('details[data-stage]')).toHaveCount(0);
    await expect(page.getByText('Stage total')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to the estimate' })).toBeVisible();
    await expect(notice.getByRole('link', { name: 'Go to the estimate to Calculate', exact: true })).toHaveAttribute('href', `/estimates/${code}`);
  });

  test('cleared: an input changed, so the stages are replaced by "Cleared. Press Recalculate" (STORY-06.04 AC-10), with a link, and the answer of the route holds the state and no value', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    // The same change a save from another tab makes: the count of the part changes and the estimate's input revision goes up (architecture section 4.8).
    await saveCanaryQuantity(owner.id, '7');
    await signInAsLead(page, testInfo);
    await openCostDetails(page, code);

    const notice = page.getByRole('status').filter({ hasText: 'An input changed, so every calculated figure is cleared' });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('An input changed, so every calculated figure is cleared, on every row. Press Recalculate on the estimate to see the stages again.');
    await expect(notice).toContainText('Cleared. Press Recalculate');
    await expect(notice).not.toContainText('once the estimate is calculated again');
    await expect(notice.getByRole('link', { name: 'Go to the estimate to Recalculate', exact: true })).toHaveAttribute('href', `/estimates/${code}`);
    await expect(page.locator('details[data-stage]')).toHaveCount(0);
    await expect(page.getByText('Stage total')).toHaveCount(0);
    await expect(page.getByText('Excel column')).toHaveCount(0);

    const answer = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/estimates/${id}/nodes/${id}/costs`);
      return { status: response.status, body: await response.text() };
    }, owner.id);
    expect(answer.status).toBe(200);
    expect(JSON.parse(answer.body)).toEqual({ state: 'out-of-date', row: { nodeId: owner.id, slNo: '1', name: expect.any(String), kindLabel: expect.any(String) }, details: null });
    expect(answer.body).not.toMatch(/Material-Scrap-Rate|stages|formula|working/);
  });
});

test.describe('AC-8 (NFR-002): an Engineer gets nothing', () => {
  test('the route is the fixed 403 and the page is "no access" with HTTP 403, before anything is read; the Engineer sees no button or link to either; a Lead gets the answer', async ({ page }, testInfo) => {
    const timer = startStepTiming(testInfo, 'AC-8');
    const { owner, code } = await timer.step('set-up: Engineer with an estimate', () => engineerWithEstimate(testInfo));
    await calculateTimed(timer, page, owner);

    const own = await timer.step('Engineer (owner) own estimate page: goto', () => page.goto(`/estimates/${code}`), (response) => statusOf(response));
    expect(own?.status()).toBe(200);
    await timer.step('Engineer (owner) own estimate page: no "View cost details"', () => expect(page.getByText('View cost details')).toHaveCount(0));

    const refused = await fetchCostRoute(timer, page, 'Engineer (owner)', owner.id);
    expect(refused.status).toBe(403);
    expect(JSON.parse(refused.body)).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(refused.body).not.toMatch(/state|details|stages|formula|working|Material-Scrap-Rate/);

    const page403 = await timer.step('Engineer (owner) forbidden page: goto', () => page.goto(`/estimates/${code}/costs/1`), (response) => statusOf(response));
    expect(page403?.status()).toBe(403);
    await timer.step('Engineer (owner) forbidden page: heading and stage checks', async () => {
      await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Cost details');
      await expect(page.locator('details[data-stage]')).toHaveCount(0);
    });

    // Another Engineer, on this one's estimate: still the refusal, and the same for a part that is not there (the answer does not depend on the IDs).
    const other = await timer.step('set-up: second Engineer creation', () => createDisposableUser('scan', testInfo));
    await signInTimed(timer, page, 'Engineer (other)', other);
    const otherPage = await timer.step('Engineer (other) forbidden page: goto', () => page.goto(`/estimates/${code}/costs/1`), (response) => statusOf(response));
    expect(otherPage?.status()).toBe(403);
    const foreign = await fetchCostRoute(timer, page, 'Engineer (other)', owner.id);
    expect(foreign.status).toBe(403);

    const lead = await timer.step('set-up: Lead creation', () => createDisposableUser('axe', testInfo, 'LEAD'));
    await signInTimed(timer, page, 'Lead', lead);
    const allowed = await fetchCostRoute(timer, page, 'Lead', owner.id);
    expect(allowed.status).toBe(200);
    expect(JSON.parse(allowed.body)).toMatchObject({ state: 'current', details: { stages: expect.any(Array) } });

    await timer.step('signed out: clear cookies', () => page.context().clearCookies());
    const signedOut = await timer.step('signed out: request to the cost route', () => page.request.get(`/api/v1/estimates/${owner.id}/nodes/${owner.id}/costs`), (response) => statusOf(response));
    expect(signedOut.status()).toBe(401);
  });
});

test.describe('AC-9: layout and accessibility', () => {
  test('a calculated row: no sideways scroll, only stage 1 open on a phone and every stage open from 768, side by side from 1280, keyboard operable, axe finds nothing', async ({ page }, testInfo) => {
    const { owner, code } = await engineerWithEstimate(testInfo);
    await calculateAsEngineer(page, owner, code);
    await signInAsLead(page, testInfo);
    await openCostDetails(page, code);

    // The script of the phone's accordion runs after load; the assertions wait for it.
    if (isPhone(page)) {
      await expect(stage(page, 1)).toHaveAttribute('open', '');
      for (const number of [2, 3, 4, 5, 6]) await expect(stage(page, number)).not.toHaveAttribute('open', '');
    } else {
      for (const number of [1, 2, 3, 4, 5, 6]) await expect(stage(page, number)).toHaveAttribute('open', '');
    }

    // Layout: the box of the row and the stages are one column at every width, the box above the stages (AQP-491, DEF-136 ruling: they no longer sit side by side from 1280 px; the case keeps its name).
    const box = page.locator('[data-slot="card"]').filter({ hasText: 'Unit Production Price' }).first();
    const boxRect = await box.boundingBox();
    const stagesRect = await stage(page, 1).boundingBox();
    expect(boxRect).not.toBeNull();
    expect(stagesRect).not.toBeNull();
    if (boxRect !== null && stagesRect !== null) {
      expect(stagesRect.y).toBeGreaterThanOrEqual(boxRect.y + boxRect.height - 1);
    }

    // The keyboard: a summary takes focus, Enter folds the panel and Enter opens it again.
    const summary = stage(page, 2).locator('summary');
    const wasOpen = (await stage(page, 2).getAttribute('open')) !== null;
    await summary.focus();
    await expect(summary).toBeFocused();
    await page.keyboard.press('Enter');
    if (wasOpen) await expect(stage(page, 2)).not.toHaveAttribute('open', '');
    else await expect(stage(page, 2)).toHaveAttribute('open', '');
    await page.keyboard.press('Enter');
    if (wasOpen) await expect(stage(page, 2)).toHaveAttribute('open', '');
    else await expect(stage(page, 2)).not.toHaveAttribute('open', '');

    // Everything open for the checks that follow, whatever the width: formulas are text, never an image, and wrap.
    for (const number of [1, 2, 3, 4, 5, 6]) {
      if ((await stage(page, number).getAttribute('open')) === null) await stage(page, number).locator('summary').click();
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expect(page.locator('main img, main canvas')).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test('cleared and not calculated: no sideways scroll and axe finds nothing', async ({ page }, testInfo) => {
    const { code } = await engineerWithEstimate(testInfo);
    await signInAsLead(page, testInfo);
    await openCostDetails(page, code);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});
