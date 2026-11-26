import { expect, test, type Page, type Request, type TestInfo } from '@playwright/test';
import { z } from 'zod';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { defined } from '../support/defined';

import { changePrivateMaterial, createDisposableUser, E2E_ADMIN, insertPrivateMaterial, makeCanaryEstimateCalculable, readEstimateState, useFreshAddress } from './support/auth';
import { unlockThroughTheApi } from './support/approved-estimate';
import { engineerWithEstimate, signInAs } from './support/calculated-estimate';
import { expectNoAxeViolations, horizontalOverflow, waitUntilHydrated } from './support/design-system';
import { DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-06.11 (AC-1, AC-2, AC-5, AC-7, AC-9, AC-10; FR-106, NFR-002, NFR-016 to NFR-018): the "Rates changed" notice of SCR-06 and its line in the approval dialog of SCR-08, for a Lead at `/estimates/<code>`, at 360x800,
 * 768x1024 and 1366x768. Each test makes an Engineer of its own with an estimate on a **material of its own** (the canary materials are shared with other tests and are not touched), has it calculated **through
 * the API** (the 30 s of a test are spent on the subject, not on page loads: AQP-340, DL-229 to DL-233), and changes the material's price afterwards, which is one material price changed since the calculation.
 * What it checks: the notice (in the UX spec's words, as a live region, with counts and no value) with its link to Recalculate, the link reached with the keyboard and the button it points at on the screen, no
 * sideways scroll and no axe violation; the one line of the approval dialog, and Approve and lock working with the notice on the page; an unlocked Draft with current figures, whose link reaches a Recalculate
 * button that works; and, through the API, the counts for the Lead and the Admin and no trace of them for an Engineer. The words are the UX spec's (v0.31), written out here and not imported. Every name,
 * path and number is invented.
 */

test.use({ storageState: { cookies: [], origins: [] } });

// A client address of this test's own, so the sign-in limit of one run never counts against another.
test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

const JSON_HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
const costsShape = z.object({ calculationId: z.string().min(1) });
const ALPHA_CUSTOMER_ID = defined(CUSTOMER_CANARIES[0]).id;
const CHEAP = { pricePerKg: '137.37', specificGravity: '7.37', scrapRate: '27.37' } as const;
const DEAR = { pricePerKg: '9137.73', specificGravity: '7.37', scrapRate: '27.37' } as const;

const TITLE = 'Rates changed since this was calculated.';
// The database is shared by every spec of the run, so another spec may have moved a customer's rate or an exchange rate in the meantime: "2 rates and 1 material price" is as right as "1 material price" here (the
// exact counts are tests/integration/estimates/rates-changed.test.ts).
const KINDS = '(?:\\d+ rates? and )?1 material price';
const SENTENCE = new RegExp(`${KINDS} changed since this was calculated at .+ IST\\.`);
const AFTER = 'to use them. Approving is not blocked.';
const DIALOG_LINE = new RegExp(`${KINDS} changed since this was calculated\\. Approving is not blocked\\. Close this window and Recalculate first if you want them used\\.`);

const noticeOf = (page: Page) => page.getByRole('status').filter({ hasText: TITLE });
const recalculateButton = (page: Page) => page.locator('#review-calculate');
const approveButton = (page: Page) => page.locator('#review-approve');

interface Subject {
  readonly ownerId: string;
  readonly code: string;
  readonly materialId: string;
}

/** An Engineer with an estimate on a material of its own, calculated through the API, with the material's price changed afterwards. The Engineer is signed in when this returns. */
async function calculatedThenRepriced(page: Page, testInfo: TestInfo): Promise<Subject> {
  const { owner, code } = await engineerWithEstimate(testInfo);
  const materialId = await insertPrivateMaterial(CHEAP);
  await makeCanaryEstimateCalculable(owner.id, materialId, ALPHA_CUSTOMER_ID);
  await signInAs(page, owner);
  const calculated = await page.request.post(`/api/v1/estimates/${owner.id}/calculate`, { headers: JSON_HEADERS });
  expect(calculated.status(), 'the Engineer\'s Calculate').toBe(200);
  await changePrivateMaterial(materialId, DEAR);
  return { ownerId: owner.id, code, materialId };
}

/** A Lead of the test's own, signed in. */
async function signInAsNewLead(page: Page, testInfo: TestInfo): Promise<void> {
  await signInAs(page, await createDisposableUser('axe', testInfo, 'LEAD'));
}

async function openedAsLead(page: Page, subject: Subject): Promise<void> {
  const response = await page.goto(`/estimates/${subject.code}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Estimate ${subject.code}`);
}

/**
 * DEF-057 (AQP-387, DL-280, DL-295): what the page and the server did after the press of Recalculate in the AC-10 case. Two attempts failed on the wait for the notice to go (runs 44577408149 and 44902999104: the notice stayed
 * for all 20 polls over 15 s, and the 30 s of the test ended first, so nothing inside the test body can report it). The record is made by listeners that only observe, and it is read in `afterEach`, which Playwright runs
 * after a timed-out test in a slot of its own. Nothing here adds a wait, a step, a case or time to the test, and every assertion stays as it was. It tells a Recalculate that was answered late (a slow dev server) from
 * one answered 200 while the notice stays (a product fault, Sev-2, DL-280).
 * **What is recorded (DL-295).** For each request after the press: when it was sent (scripts too), when its headers arrived (the `response` event) and when its body ended (`requestfinished`) or it failed: the RSC refresh streams
 * its body after its headers, so "answered" alone does not show that the payload arrived. At the end: the requests sent and not finished, with how long they have waited; the console errors and warnings and the page errors after the
 * press (at most 20); and the long tasks of the page (one observer, started just before the click) with whether the page was visible. One timing line is printed on every attempt at every width, pass or fail. No figure or
 * name is read: counts, states and times only (a console text is cut to 200 characters).
 */
const NOTED_REQUESTS_AT_MOST = 80;
const NOTED_MESSAGES_AT_MOST = 20;
const MESSAGE_CHARS_AT_MOST = 200;
const NOTED_RESOURCES = new Set(['document', 'fetch', 'xhr', 'script']);
const LONG_TASKS_KEY = '__aqp387LongTasks';
const LONG_TASKS_READ_MS = 2_000;

/** One request after the press: the times are in ms since the press. */
interface NotedRequest {
  readonly label: string;
  readonly sentAt: number;
  headersAt: number | null;
  status: number | null;
  endAt: number | null;
  failure: string | null;
}

interface RecalculateProbe {
  readonly ownerId: string;
  readonly requests: Map<Request, NotedRequest>;
  readonly messages: string[];
  readonly pressedAt: number;
  recalculate: NotedRequest | null;
  refresh: NotedRequest | null;
  calculateAnswer: { readonly status: number; readonly afterMs: number } | null;
  calculateSentAfterMs: number | null;
}

const probes = new WeakMap<TestInfo, RecalculateProbe>();

/** Just before the click, one call that can never fail the case: a `longtask` observer in the page, kept in a global the report reads. */
async function observeLongTasks(page: Page): Promise<void> {
  await page
    .evaluate((key) => {
      const durations: number[] = [];
      Reflect.set(window, key, durations);
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) durations.push(entry.duration);
      }).observe({ type: 'longtask' });
    }, LONG_TASKS_KEY)
    .catch(() => undefined);
}

/** Starts the record at the press: call it just before the click. The listeners only observe. */
async function watchRecalculate(page: Page, ownerId: string, testInfo: TestInfo): Promise<void> {
  await observeLongTasks(page);
  const pressedAt = Date.now();
  const probe: RecalculateProbe = { ownerId, requests: new Map(), messages: [], pressedAt, recalculate: null, refresh: null, calculateAnswer: null, calculateSentAfterMs: null };
  const sinceThePress = (): number => Date.now() - pressedAt;
  const isCalculate = (request: Request): boolean => request.method() === 'POST' && ['calculate', 'recalculate'].some((name) => new URL(request.url()).pathname === `/api/v1/estimates/${ownerId}/${name}`);
  const isRefresh = (request: Request): boolean => request.method() === 'GET' && new URL(request.url()).pathname.startsWith('/estimates/') && new URL(request.url()).searchParams.has('_rsc');
  const labelOf = (request: Request): string => `${request.method()} ${new URL(request.url()).pathname}${new URL(request.url()).searchParams.has('_rsc') ? ' (rsc)' : ''}`;
  const noteMessage = (text: string): void => {
    if (probe.messages.length < NOTED_MESSAGES_AT_MOST) probe.messages.push(`+${String(sinceThePress())} ms ${text.slice(0, MESSAGE_CHARS_AT_MOST)}`);
  };
  page.on('request', (request) => {
    const subject = isCalculate(request) || (probe.refresh === null && isRefresh(request));
    if (!subject && (probe.requests.size >= NOTED_REQUESTS_AT_MOST || !NOTED_RESOURCES.has(request.resourceType()))) return;
    const entry: NotedRequest = { label: labelOf(request), sentAt: sinceThePress(), headersAt: null, status: null, endAt: null, failure: null };
    probe.requests.set(request, entry);
    if (isCalculate(request)) {
      probe.calculateSentAfterMs = entry.sentAt;
      probe.recalculate = entry;
    } else if (probe.refresh === null && isRefresh(request)) probe.refresh = entry;
  });
  page.on('response', (response) => {
    if (isCalculate(response.request())) probe.calculateAnswer = { status: response.status(), afterMs: sinceThePress() };
    const entry = probe.requests.get(response.request());
    if (entry !== undefined) Object.assign(entry, { headersAt: sinceThePress(), status: response.status() });
  });
  page.on('requestfinished', (request) => {
    const entry = probe.requests.get(request);
    if (entry !== undefined) entry.endAt = sinceThePress();
  });
  page.on('requestfailed', (request) => {
    const entry = probe.requests.get(request);
    if (entry !== undefined) Object.assign(entry, { endAt: sinceThePress(), failure: request.failure()?.errorText ?? 'failed' });
  });
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') noteMessage(`console ${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => noteMessage(`page error: ${error.message}`));
  probes.set(testInfo, probe);
}

/** One read of the page or the server, as text; a read that fails says so and never stops the report. */
async function readOrSay(work: () => Promise<unknown>): Promise<string> {
  try {
    return JSON.stringify(await work());
  } catch (error) {
    return `unreadable (${error instanceof Error ? (error.message.split('\n')[0] ?? '') : 'error'})`;
  }
}

const atOf = (at: number | null): string => (at === null ? 'none' : `+${String(at)} ms`);

/** "sent +a ms, headers +b ms (status), body end +c ms" for one request, or what is missing of it. */
function timesOf(entry: NotedRequest | null): string {
  if (entry === null) return 'never sent';
  const end = entry.failure === null ? `body end ${atOf(entry.endAt)}` : `FAILED ${entry.failure} ${atOf(entry.endAt)}`;
  return `sent ${atOf(entry.sentAt)}, headers ${atOf(entry.headersAt)}${entry.status === null ? '' : ` (${String(entry.status)})`}, ${end}`;
}

/** The long tasks the page saw since the click, and whether it was visible; read with a short limit so a hung page cannot hold the report. */
async function longTasksOf(page: Page): Promise<unknown> {
  let timer: NodeJS.Timeout | undefined;
  const gone = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer in ${String(LONG_TASKS_READ_MS)} ms`)), LONG_TASKS_READ_MS);
  });
  try {
    const read = await Promise.race([
      page.evaluate((key) => {
        const seen: unknown = Reflect.get(window, key);
        const durations = Array.isArray(seen) ? seen.filter((item): item is number => typeof item === 'number') : null;
        return { durations, visibility: document.visibilityState };
      }, LONG_TASKS_KEY),
      gone,
    ]);
    const durations = read.durations ?? [];
    return { observed: read.durations !== null, count: durations.length, totalMs: Math.round(durations.reduce((sum, ms) => sum + ms, 0)), longestMs: Math.round(Math.max(0, ...durations)), visibility: read.visibility };
  } finally {
    clearTimeout(timer);
  }
}

/** One line on every attempt at every width, pass or fail (DL-295): the POST and the refresh, each as sent, headers and body end since the press, and how long the test took. */
function printTiming(testInfo: TestInfo): void {
  const probe = probes.get(testInfo);
  const what = probe === undefined ? 'the press was not reached' : `POST recalculate: ${timesOf(probe.recalculate)} | refresh (rsc): ${timesOf(probe.refresh)}`;
  process.stdout.write(`[AQP-387 timing] ${testInfo.project.name} | attempt ${String(testInfo.retry + 1)} | ${testInfo.status ?? 'unknown'} | test ${String(Math.round(testInfo.duration))} ms | ${what}\n`);
}

/** Printed and attached when the case failed after the press: the requests seen, then the state of the page and a second read of the server. The case then fails as it did. */
async function reportRecalculateOutcome(page: Page, testInfo: TestInfo): Promise<void> {
  printTiming(testInfo);
  const probe = probes.get(testInfo);
  if (probe === undefined || testInfo.status === testInfo.expectedStatus) return;
  const noticeCount = await noticeOf(page)
    .count()
    .catch(() => -1);
  const costsOf = async () => {
    const response = await page.request.get(`/api/v1/estimates/${probe.ownerId}/costs`, { timeout: 5_000 });
    const body = (await response.json()) as Record<string, unknown>;
    return { status: response.status(), state: body.state, ratesChanged: body.ratesChanged };
  };
  const answer = probe.calculateAnswer;
  let verdict = `Recalculate was answered ${String(answer?.status)}`;
  if (answer === null) verdict = 'no answer to the Recalculate request was seen';
  else if (answer.status === 200 && noticeCount > 0) verdict = 'RECALCULATE ANSWERED 200 AND THE NOTICE IS STILL SHOWN (the Sev-2 trigger of DL-280)';
  const reportedAt = Date.now() - probe.pressedAt;
  const entries = [...probe.requests.values()];
  const unfinished = entries.filter((entry) => entry.endAt === null);
  const report = [
    `[AQP-387 rates-changed diagnostic] ${testInfo.project.name} | attempt ${String(testInfo.retry + 1)} | after the press the test ended as "${String(testInfo.status)}" | ${verdict}`,
    `  Recalculate request: sent +${String(probe.calculateSentAfterMs)} ms after the press; answer ${answer === null ? 'none' : `${String(answer.status)} at +${String(answer.afterMs)} ms`}`,
    `  this report was made +${String(reportedAt)} ms after the press`,
    `  notice elements still on the page: ${String(noticeCount)}`,
    `  notice and status texts: ${await readOrSay(() => page.getByRole('status').allInnerTexts())}`,
    `  alert texts: ${await readOrSay(() => page.getByRole('alert').allInnerTexts())}`,
    `  Recalculate button: ${await readOrSay(async () => ({ count: await recalculateButton(page).count(), busy: await recalculateButton(page).getAttribute('aria-busy', { timeout: 2_000 }) }))}`,
    `  Approve enabled: ${await readOrSay(() => approveButton(page).isEnabled({ timeout: 2_000 }))}`,
    `  page: ${await readOrSay(() => Promise.resolve(new URL(page.url()).pathname + new URL(page.url()).hash))}`,
    `  long tasks of the page since the click: ${await readOrSay(() => longTasksOf(page))}`,
    `  second read of the server, costs view: ${await readOrSay(costsOf)}`,
    `  second read of the server, stored estimate: ${await readOrSay(() => readEstimateState(probe.ownerId))}`,
    `  requests sent and not finished at the end: ${String(unfinished.length)}`,
    ...unfinished.map((entry) => `  UNFINISHED ${entry.label}: sent +${String(entry.sentAt)} ms, headers ${atOf(entry.headersAt)}, waited ${String(reportedAt - entry.sentAt)} ms so far`),
    `  console errors and warnings and page errors after the press (at most ${String(NOTED_MESSAGES_AT_MOST)}): ${String(probe.messages.length)}`,
    ...probe.messages.map((message) => `  message ${message}`),
    ...entries.map((entry) => `  request ${entry.label}: ${timesOf(entry)}`),
  ].join('\n');
  process.stdout.write(`${report}\n`);
  await testInfo.attach('rates-changed-diagnostic', { body: report, contentType: 'text/plain' });
}

test.describe('AC-1, AC-9: the notice', () => {
  test('says what changed by kind, with no value, in a live region; its link is reached with the keyboard and the Recalculate button it points at is on the screen; no sideways scroll and no axe violation', async ({ page }, testInfo) => {
    const subject = await calculatedThenRepriced(page, testInfo);
    await signInAsNewLead(page, testInfo);
    await openedAsLead(page, subject);

    const notice = noticeOf(page);
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(TITLE);
    await expect(notice).toContainText(SENTENCE);
    await expect(notice).toContainText(AFTER);
    // Counts by kind and the time only: no rupee figure, no price, no name of a master.
    await expect(notice).not.toContainText('₹');
    await expect(notice).not.toContainText(/9137\.73|137\.37/);
    // Approving is not blocked: Approve and lock is on beside it.
    await expect(approveButton(page)).toBeEnabled();

    // The link is reachable with the keyboard and leads to a button that is on the screen (AC-10).
    const link = notice.getByRole('link', { name: 'Recalculate' });
    await expect(recalculateButton(page)).toBeVisible();
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#review-calculate$/);
    await expect(recalculateButton(page)).toBeInViewport();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    expect(await readEstimateState(subject.ownerId)).toEqual({ status: 'PREPARED', calculations: 1 });
  });
});

test.describe('AC-2: the approval dialog', () => {
  test('says the same in one line, and Approve and lock works; the notice is gone once the estimate is approved (its figures stand)', async ({ page }, testInfo) => {
    const subject = await calculatedThenRepriced(page, testInfo);
    await signInAsNewLead(page, testInfo);
    await openedAsLead(page, subject);
    await expect(approveButton(page)).toBeEnabled();
    await waitUntilHydrated(page, '#review-approve');

    await approveButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Approve and lock' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(TITLE);
    await expect(dialog).toContainText(DIALOG_LINE);
    await expect(dialog).not.toContainText(/9137\.73|137\.37/);
    await expect(dialog.getByRole('button', { name: 'Approve and lock' })).toBeEnabled();
    await expectNoAxeViolations(page);

    await dialog.getByRole('button', { name: 'Approve and lock' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#review-approved-notice')).toBeVisible();
    await expect(noticeOf(page)).toHaveCount(0);
    expect(await readEstimateState(subject.ownerId)).toEqual({ status: 'APPROVED', calculations: 1 });
  });
});

test.describe('AC-10: an unlocked Draft with current figures', () => {
  // DEF-057: the record of the press is read here, after the test body (and after a time-out), and only for a first attempt that failed.
  test.afterEach(async ({ page }, testInfo) => {
    await reportRecalculateOutcome(page, testInfo);
  });

  test('shows the notice, its link reaches a Recalculate button that is on the screen, and pressing it calculates again: the notice goes and the estimate is Prepared', async ({ page }, testInfo) => {
    const subject = await calculatedThenRepriced(page, testInfo);
    // The Lead of the test approves and unlocks through the API; the price moved after the calculation, so the Draft that comes back has current figures and changed rates.
    await signInAsNewLead(page, testInfo);
    const costs = costsShape.parse(await (await page.request.get(`/api/v1/estimates/${subject.ownerId}/costs`)).json());
    const approved = await page.request.post(`/api/v1/estimates/${subject.ownerId}/approve`, { headers: JSON_HEADERS, data: { calculationId: costs.calculationId, price: '48271.37' } });
    expect(approved.status(), 'the approval').toBe(200);
    expect(await unlockThroughTheApi(page, subject.ownerId, 'The customer asked for a new fixture.'), 'the unlock').toBe(200);

    await openedAsLead(page, subject);
    await expect(noticeOf(page)).toBeVisible();
    await expect(noticeOf(page)).toContainText(SENTENCE);
    await expect(recalculateButton(page)).toBeVisible();
    await waitUntilHydrated(page, '#review-calculate');

    await noticeOf(page).getByRole('link', { name: 'Recalculate' }).click();
    await expect(page).toHaveURL(/#review-calculate$/);
    await expect(recalculateButton(page)).toBeInViewport();

    await watchRecalculate(page, subject.ownerId, testInfo);
    await recalculateButton(page).click();
    await expect(noticeOf(page)).toHaveCount(0);
    await expect(approveButton(page)).toBeEnabled();
    expect(await readEstimateState(subject.ownerId)).toEqual({ status: 'PREPARED', calculations: 2 });
  });
});

test.describe('AC-5, AC-7 (NFR-002): who gets the counts', () => {
  test('the Lead and the Admin read them from GET /costs as counts by kind and nothing else; the Engineer is refused and the refusal carries no trace of them', async ({ page }, testInfo) => {
    const subject = await calculatedThenRepriced(page, testInfo);
    const engineerCosts = await page.request.get(`/api/v1/estimates/${subject.ownerId}/costs`);
    expect(engineerCosts.status()).toBe(403);
    const refusal = await engineerCosts.text();
    expect(refusal).not.toMatch(/ratesChanged|materialPrices|processRates|exchangeRates/);

    for (const who of ['LEAD', 'ADMIN'] as const) {
      await signInAs(page, who === 'ADMIN' ? E2E_ADMIN : await createDisposableUser('axe', testInfo, 'LEAD'));
      const response = await page.request.get(`/api/v1/estimates/${subject.ownerId}/costs`);
      expect(response.status(), who).toBe(200);
      const body = (await response.json()) as { ratesChanged: unknown };
      // Three whole counts and nothing else: no value, no name, no ID. Another spec may have moved a rate, so only the material of this test is counted exactly.
      expect(body.ratesChanged, who).toMatchObject({ materialPrices: 1 });
      expect(Object.keys(body.ratesChanged as object).sort(), who).toEqual(['exchangeRates', 'materialPrices', 'processRates']);
      expect(Object.values(body.ratesChanged as object).every((count) => Number.isInteger(count)), who).toBe(true);
    }
  });
});
