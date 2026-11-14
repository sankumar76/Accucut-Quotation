import { readdirSync } from 'node:fs';

import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { z } from 'zod';

import { SEED_PROCESS_ITEMS } from '../../prisma/seed/config/seed-ids';
import { canaryMasters, forbiddenStrings, NEGATIVE_CONTROL_SENTINEL, PROCESS_CANARY_RATES } from '../support/canary-masters';
import { CUSTOMER_CANARIES, CUSTOMER_CANARY_PHONE, CUSTOMER_CANARY_VALUES } from '../support/customer-canary';
import { EXCHANGE_RATE_CANARIES } from '../support/exchange-rate-canary';
import { MATERIAL_CANARIES } from '../support/material-master-canary';
import { defined } from '../support/defined';
import { cacheControlProblems, describeFinding, fixedForbiddenProblem, isBuiltFile, maskRequestId, scanResponses } from '../support/scanner';

import {
  createDisposableUser,
  E2E_ADMIN,
  E2E_PASSWORD,
  ensureCanaryCustomers,
  ensureCanaryExchangeRates,
  ensureCanaryMaterials,
  ensureCanaryProcessRates,
  ensureCanaryUser,
  readExchangeRatesFromDatabase,
  readFormulaTexts,
  signInThroughThePage,
  useFreshAddress,
  type E2eUser,
} from './support/auth';
import {
  callInBrowser,
  expectScanSawEnough,
  fillPath,
  refusedApiCalls,
  refusedPages,
  ScanRecorder,
  scanAsEngineer,
  validCall,
  type Plant,
} from './support/canary-scan';
import { seedQueueTask, setEstimateStatus, type SeededQueueTask } from './support/queue';
import { PRODUCTION_URL } from './support/servers';

/**
 * STORY-01.03 (AC-3, AC-4, AC-5, AC-6, AC-8; SPEC section 14.1, NFR-002; ADR-008 layer 5; test strategy section 6): the cost-confidentiality
 * scan, on the PRODUCTION build (`next start`, the artefact that ships) and a real database.
 *
 * `canaryMasters` gives every Restricted value an invented sentinel, and the three Process Master canary rates of STORY-02.01 are put in the
 * database. An Engineer signs in through the sign-in page, and `scanAsEngineer` opens every page the manifest lists for them (each with a
 * real-value recipe, status 200 and the address asked for), calls every API route the manifest lists for them (each with its recipe's status),
 * records the body of every response the browser fetches, and fetches the scripts the pages name. The scan looks in all of it for each sentinel
 * as plain digits, in Indian grouping and in two-decimal form, for rate names, `{{f:`, `{{rate:`, `{{mat:` and the stored formula text in its
 * internal and display forms: HTML, RSC flight payloads, JSON, headers and JavaScript chunks. Typed values are not on the list (FR-008).
 *
 * The pages and routes come from the route manifest, so a story that opens a route to an Engineer, or adds a Lead or Admin route, is covered with
 * no change here (AC-6); its own tasks add its Restricted values to `canaryMasters` and its recipes to `tests/support/route-calls.ts`. The scan is
 * the stage 12 gate of every pull request and is never quarantined (test strategy section 10, flaky-test policy; AC-8).
 *
 * Controls, because a green scan is only worth something if it can go red: the Admin is sent the canary rates by the same routes and the same scan
 * finds them (real data); a sentinel planted in a header and an RSC payload, and one planted in a script chunk and in a response the browser fetches
 * (through the very helper the Engineer scan uses), are each reported; `/api/test-only/leak` is absent from the production build.
 *
 * Width: nothing here reads layout (an HTTP status, a header, a body, a script), so these tests are candidates for the one-width tag of test
 * strategy section 10.5; they carry no tag until that section rules on them.
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

/** The answer of `GET /api/v1/options/materials`, read loosely on purpose: the test counts the keys, so a leaked key must survive the parse. */
const optionsBody = z.object({ options: z.array(z.record(z.string(), z.unknown())) });

const INVENTED_ID = '00000000-0000-4000-8000-0000000000fe';
const INVENTED_PAGE_VALUE = 'invented-code';
const NO_ACCESS_TITLE = 'You do not have access to this page';

/** Files of `public/` are public by design and carry no session data, so they may be cached; the build's files are exempt too (QLT-09). */
const PUBLIC_FILES: ReadonlyArray<string> = readdirSync('public').map((name) => `/${name}`);
const isExempt = (pathname: string): boolean => isBuiltFile(pathname) || PUBLIC_FILES.includes(pathname);

/** Signs in through the page. The test has set a client address of its own first (`useFreshAddress`), so no other test's failures count against it.
 * */
async function signIn(page: Page, recorder: ScanRecorder, person: E2eUser): Promise<void> {
  await page.goto('/sign-in');
  await signInThroughThePage(page, person.email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/queue$/);
  recorder.markSignedIn();
}

const sentences = (recorder: ScanRecorder, forbidden: ReturnType<typeof forbiddenStrings>): string[] =>
  scanResponses(recorder.responses, forbidden).map(describeFinding);

/** The forbidden list for this database (its stored formulas included) and a person of this test's own, with the canary rates in place. */
async function prepare(
  testInfo: TestInfo,
): Promise<{ readonly forbidden: ReturnType<typeof forbiddenStrings>; readonly engineer: Awaited<ReturnType<typeof createDisposableUser>> }> {
  await ensureCanaryProcessRates();
  await ensureCanaryMaterials();
  await ensureCanaryExchangeRates();
  await ensureCanaryCustomers();
  return { forbidden: forbiddenStrings(await readFormulaTexts()), engineer: await createDisposableUser('scan', testInfo) };
}

/**
 * The end of an Engineer scan: the canary pair was still in the database. The scan finds nothing when it looks for values that are not there, so a
 * pair changed by another test while the scan ran (QLT-02) would pass it for the wrong reason. The saving tests of `exchange-rates.spec.ts` send
 * only this pair, so they cannot change it.
 */
async function expectCanaryRatesStillStored(): Promise<void> {
  const stored = await readExchangeRatesFromDatabase();
  expect(stored, 'the canary exchange rates were in the database when the scan ended').toEqual({
    USD: Number(EXCHANGE_RATE_CANARIES.usd).toFixed(4),
    EUR: Number(EXCHANGE_RATE_CANARIES.eur).toFixed(4),
  });
}

test('AC-3: an Engineer is sent no Restricted value, name or formula by any page, payload, header or script', async ({ page, context }, testInfo) => {
  const { forbidden, engineer } = await prepare(testInfo);
  const recorder = new ScanRecorder();
  await recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, recorder, engineer);

  const scan = await scanAsEngineer(page, recorder, engineer);

  testInfo.annotations.push({
    type: 'scan',
    description: `${scan.durationMs} ms: ${scan.pages} pages, ${scan.calls} calls, ${scan.referenced} build files fetched`,
  });
  expectScanSawEnough(recorder, scan);
  expect(sentences(recorder, forbidden)).toEqual([]);
  // AC-5: `private, no-store` on every response to a request that carried the session (build files and `public/` excepted).
  expect(cacheControlProblems(recorder.responses, isExempt)).toEqual([]);
  await expectCanaryRatesStillStored();
});

/** Calls every Lead and Admin route as the signed-in Engineer, for a real ID and, where the path has one, an invented one. */
async function callRefusedRoutes(page: Page, recorder: ScanRecorder, realPersonId: string): Promise<void> {
  for (const call of refusedApiCalls()) {
    const real = validCall(call, realPersonId);
    const ids = call.row.path.includes('[') ? [real.id, INVENTED_ID] : [real.id];
    const answers = [];
    for (const id of ids) {
      const path = fillPath(call.row.path, id);
      answers.push(
        await callInBrowser(recorder, page, `${call.method} ${path} (API)`, path, {
          method: call.method,
          ...(call.method === 'GET' ? {} : { body: real.body }),
        }),
      );
    }
    for (const answer of answers) {
      expect(fixedForbiddenProblem(answer), call.name).toBeNull();
      expect(answer.headers['cache-control'], `${call.name}: Cache-Control`).toBe('private, no-store');
    }
    // The role check runs first, before any lookup: a person who exists and one who does not are told exactly the same.
    if (answers.length === 2) expect(maskRequestId(defined(answers[0]).body ?? ''), call.name).toBe(maskRequestId(defined(answers[1]).body ?? ''));
  }
}

/** Opens every page that does not list an Engineer: HTTP 403 and the "no access" page (SCR-26), with nothing of the page behind it. */
async function visitRefusedPages(page: Page, recorder: ScanRecorder): Promise<void> {
  for (const row of refusedPages()) {
    const path = fillPath(row.path, INVENTED_PAGE_VALUE);
    const document = await recorder.recordNavigation(`GET ${path} (page)`, await page.goto(path));
    expect(document.status, `${path} as an Engineer`).toBe(403);
    await expect(page.getByRole('heading', { level: 1, name: NO_ACCESS_TITLE })).toBeVisible();
  }
}

test('AC-5: every Lead and Admin route, called as an Engineer, is the fixed 403 with no data, for a real ID and an invented one', async ({
  page,
  context,
}, testInfo) => {
  const { forbidden, engineer } = await prepare(testInfo);
  const realPersonId = await ensureCanaryUser();
  const recorder = new ScanRecorder();
  await recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, recorder, engineer);

  await callRefusedRoutes(page, recorder, realPersonId);
  await visitRefusedPages(page, recorder);

  await page.waitForLoadState('networkidle');
  await recorder.settled();
  expect(recorder.unreadable, 'responses the scan could not read').toEqual([]);
  expect(sentences(recorder, forbidden)).toEqual([]);
  expect(cacheControlProblems(recorder.responses, isExempt)).toEqual([]);
  await expectCanaryRatesStillStored();
});

test('AC-3, AC-4 (control with real data): the same scan finds the canary rates in what the Admin is sent', async ({ page, context }) => {
  await ensureCanaryProcessRates();
  await ensureCanaryMaterials();
  const forbidden = forbiddenStrings(await readFormulaTexts());
  const recorder = new ScanRecorder();
  await recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, recorder, E2E_ADMIN);

  await callInBrowser(recorder, page, 'GET /api/v1/process-items (API, Admin)', '/api/v1/process-items');
  await recorder.recordNavigation('GET /masters/process (page, Admin)', await page.goto('/masters/process'));
  await page.waitForLoadState('networkidle');
  await recorder.settled();

  const found = new Set(scanResponses(recorder.responses, forbidden).map((finding) => finding.found));
  for (const rate of PROCESS_CANARY_RATES) expect(found.has(rate.value), `the scan finds the value of ${rate.name}`).toBe(true);
  expect(found.has(defined(PROCESS_CANARY_RATES[0]).name), 'the scan finds the canary name').toBe(true);
  expect(recorder.unreadable, 'responses the scan could not read').toEqual([]);
});

test('AC-6 (control with real data, STORY-02.03): the same scan finds the canary materials\' price, specific gravity and scrap rate in what the Admin is sent', async ({
  page,
  context,
}) => {
  await ensureCanaryMaterials();
  const forbidden = forbiddenStrings(await readFormulaTexts());
  const recorder = new ScanRecorder();
  await recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, recorder, E2E_ADMIN);

  await callInBrowser(recorder, page, 'GET /api/v1/materials (API, Admin)', '/api/v1/materials');
  await recorder.recordNavigation('GET /masters/materials (page, Admin)', await page.goto('/masters/materials'));
  await page.waitForLoadState('networkidle');
  await recorder.settled();

  const found = new Set(scanResponses(recorder.responses, forbidden).map((finding) => finding.found));
  for (const material of MATERIAL_CANARIES) {
    for (const value of [material.pricePerKg, material.specificGravity, material.scrapRate]) {
      expect(found.has(value), `the scan finds ${value} of ${material.materialInDrawing}`).toBe(true);
    }
  }
  expect(recorder.unreadable, 'responses the scan could not read').toEqual([]);
});

/**
 * The customers' rates (STORY-02.02 AC-7). The canary customer is in the database (`prepare` loads it for the Engineer scans), and the same scan finds its two rates
 * and its phone number in what the Admin is sent by the list route and by the customer's own page, so a green Engineer scan means the rates were looked for and
 * not there. The Engineer side is the scan above: the customers routes and pages are in no Engineer list, and `/api/v1/options/customers` is, with an ID and a name.
 */
test('AC-7 (control with real data, STORY-02.02): the same scan finds the canary customer\'s rates and phone number in what the Admin is sent', async ({ page, context }) => {
  await ensureCanaryCustomers();
  const forbidden = forbiddenStrings(await readFormulaTexts());
  const recorder = new ScanRecorder();
  await recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, recorder, E2E_ADMIN);

  await callInBrowser(recorder, page, 'GET /api/v1/customers (API, Admin)', '/api/v1/customers');
  const canary = defined(CUSTOMER_CANARIES[0]);
  await recorder.recordNavigation('GET /masters/customers/{id} (page, Admin)', await page.goto(`/masters/customers/${canary.id}`));
  await page.waitForLoadState('networkidle');
  await recorder.settled();

  const found = new Set(scanResponses(recorder.responses, forbidden).map((finding) => finding.found));
  for (const value of CUSTOMER_CANARY_VALUES) expect(found.has(value), `the scan finds the customer rate ${value}`).toBe(true);
  // The phone number is Confidential, not a sentinel of the forbidden list: it is looked for in the same responses by plain text.
  expect(recorder.responses.some((response) => (response.body ?? '').includes(CUSTOMER_CANARY_PHONE)), 'the Admin is sent the phone number').toBe(true);
  expect(recorder.unreadable, 'responses the scan could not read').toEqual([]);
});

/**
 * The exchange rates (STORY-02.04 AC-6). The Admin saves the canary pair through the route, as the screen does, and the same scan finds both values in
 * the answer. The answer of the PUT is the state written in the same transaction, so no other test's save can change what this one looks for. The Engineer
 * side of the story is the scan above: the route is in no Engineer list, the pair is in the database (`prepare`), and the scan finds neither value.
 */
test('AC-6 (control with real data, STORY-02.04): the same scan finds both canary exchange rates in what the Admin is sent', async ({ page, context }) => {
  const forbidden = forbiddenStrings(await readFormulaTexts());
  const recorder = new ScanRecorder();
  await recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, recorder, E2E_ADMIN);

  const answer = await callInBrowser(recorder, page, 'PUT /api/v1/exchange-rates (API, Admin)', '/api/v1/exchange-rates', { method: 'PUT', body: EXCHANGE_RATE_CANARIES });
  expect(answer.status).toBe(200);
  await recorder.settled();

  const found = new Set(scanResponses(recorder.responses, forbidden).map((finding) => finding.found));
  for (const [currency, value] of Object.entries(EXCHANGE_RATE_CANARIES)) expect(found.has(value), `the scan finds the ${currency} rate ${value}`).toBe(true);
  expect(recorder.unreadable, 'responses the scan could not read').toEqual([]);
});

test('AC-4, AC-6 (STORY-02.03): the options list an Engineer is sent names the canary materials, carries no rate of any kind, and holds no number of them in any form', async ({
  page,
  context,
}, testInfo) => {
  await ensureCanaryMaterials();
  const forbidden = forbiddenStrings(await readFormulaTexts());
  const engineer = await createDisposableUser('scan', testInfo);
  const recorder = new ScanRecorder();
  await recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, recorder, engineer);

  const answer = await callInBrowser(recorder, page, 'GET /api/v1/options/materials (API, Engineer)', '/api/v1/options/materials');
  expect(answer.status).toBe(200);
  const options = optionsBody.parse(JSON.parse(answer.body ?? '{}')).options;
  const ours = options.filter((option) => MATERIAL_CANARIES.some((material) => material.id === option['id']));
  expect(ours.map((option) => option['name']).sort()).toEqual(MATERIAL_CANARIES.map((material) => material.materialInDrawing).sort());
  for (const option of ours) expect(Object.keys(option).sort(), 'no rate of any kind').toEqual(['id', 'materialConsidered', 'name']);
  await recorder.settled();
  expect(sentences(recorder, forbidden)).toEqual([]);
});

test('AC-5, AC-7 (STORY-02.02): the options list an Engineer is sent names the canary customer with an ID and a name only: no contact detail, no rate, in any form', async ({
  page,
  context,
}, testInfo) => {
  await ensureCanaryCustomers();
  const forbidden = forbiddenStrings(await readFormulaTexts());
  const engineer = await createDisposableUser('scan', testInfo);
  const recorder = new ScanRecorder();
  await recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, recorder, engineer);

  const answer = await callInBrowser(recorder, page, 'GET /api/v1/options/customers (API, Engineer)', '/api/v1/options/customers');
  expect(answer.status).toBe(200);
  const options = optionsBody.parse(JSON.parse(answer.body ?? '{}')).options;
  const ours = options.filter((option) => CUSTOMER_CANARIES.some((customer) => customer.id === option['id']));
  expect(ours.map((option) => option['name']).sort()).toEqual(CUSTOMER_CANARIES.map((customer) => customer.name).sort());
  for (const option of ours) expect(Object.keys(option).sort(), 'no contact detail and no rate').toEqual(['id', 'name']);
  expect(answer.body ?? '').not.toContain(CUSTOMER_CANARY_PHONE);
  await recorder.settled();
  expect(sentences(recorder, forbidden)).toEqual([]);
});

test('AC-4 (negative control): a sentinel planted in a header and in an RSC payload is reported in each place', async ({ page, context }) => {
  const material = defined(canaryMasters.find((sentinel) => sentinel.kind === 'material-price')).value;
  const customer = defined(canaryMasters.find((sentinel) => sentinel.kind === 'customer-rate')).value;
  const forbidden = forbiddenStrings();
  const recorder = new ScanRecorder();
  await recorder.attach(context);

  // A clean pass first: nothing is found in the page as it is, so what is found after is what was planted.
  await recorder.recordNavigation('GET /sign-in (page)', await page.goto('/sign-in'));
  await page.waitForLoadState('networkidle');
  await recorder.settled();
  expect(sentences(recorder, forbidden)).toEqual([]);
  recorder.reset();

  await context.route('**/sign-in', async (route) => {
    const original = await route.fetch();
    const flight = JSON.stringify(`0:{"rate":"${customer}"}\n`);
    const body = (await original.text()).replace('</body>', `<script>self.__next_f.push([1,${flight}])</script></body>`);
    await route.fulfill({ response: original, body, headers: { ...original.headers(), 'x-planted-rate': material } });
  });
  await recorder.recordNavigation('GET /sign-in (page, planted)', await page.goto('/sign-in'));
  await page.waitForLoadState('networkidle');
  await recorder.settled();

  const findings = scanResponses(recorder.responses, forbidden).map((finding) => `${finding.place} | ${finding.found}`);
  expect(findings).toEqual(expect.arrayContaining([`headers | ${material}`, `decoded RSC payload | ${customer}`]));
  expect(recorder.unreadable, 'responses the scan could not read').toEqual([]);
});

test('AC-4 (negative control): a sentinel planted in a script chunk and in a response the browser fetches is found by the Engineer scan itself', async ({
  page,
  context,
}, testInfo) => {
  const customer = defined(canaryMasters.find((sentinel) => sentinel.kind === 'customer-rate')).value;
  const rateName = defined(SEED_PROCESS_ITEMS[0]).name;
  let chunkPlanted = false;
  const plant: Plant = ({ url }, body) => {
    if (url.includes('/_next/static/chunks/') && !chunkPlanted) {
      chunkPlanted = true;
      return `${body}\n;/* ${rateName} */`;
    }
    return new URL(url).pathname === '/api/v1/me' ? `${body} ${customer}` : body;
  };
  const { forbidden, engineer } = await prepare(testInfo);
  const recorder = new ScanRecorder(plant);
  await recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, recorder, engineer);

  const scan = await scanAsEngineer(page, recorder, engineer);

  expect(chunkPlanted, 'the crawl fetched a chunk through the browser, so it could be planted').toBe(true);
  expect(scan.referenced).toBeGreaterThan(0);
  const findings = scanResponses(recorder.responses, forbidden);
  expect(
    findings.some((finding) => finding.label.includes('/_next/static/chunks/') && finding.found === rateName),
    'the rate name planted in a chunk',
  ).toBe(true);
  expect(
    findings.some((finding) => finding.label.includes('/api/v1/me') && finding.found === customer),
    'the sentinel planted in a fetched response',
  ).toBe(true);
  await expectCanaryRatesStillStored();
});

/**
 * STORY-04.04 AC-6: the queue and the task page with tasks in each state. The Engineer owns a task in DRAFT, one in SUBMITTED, one APPROVED, and one that was approved and
 * then unlocked (DRAFT again), and the scan opens the queue (every tab, as a page and as the API behind it), each task's page and `GET /api/v1/tasks/{id}`, and looks for
 * every Restricted value in what comes back. "Approved" is a word and shows no amount. The scan above (AC-3) already opens these routes for the Engineer who owns the canary
 * task; this one adds the states, so a status that carried a figure would be found.
 */
interface StatedTasks {
  readonly draft: SeededQueueTask;
  readonly submitted: SeededQueueTask;
  readonly approved: SeededQueueTask;
  readonly unlocked: SeededQueueTask;
}

const DAY_MS = 86_400_000;

async function seedAllStates(engineerId: string): Promise<StatedTasks> {
  const later = new Date(Date.now() + 30 * DAY_MS).toISOString();
  const earlier = new Date(Date.now() - 10 * DAY_MS).toISOString();
  const unlocked = await seedQueueTask(engineerId, later, 'APPROVED', 'Scan unlocked');
  await setEstimateStatus(unlocked.id, 'DRAFT');
  return {
    draft: await seedQueueTask(engineerId, later, 'DRAFT', 'Scan draft'),
    submitted: await seedQueueTask(engineerId, later, 'SUBMITTED', 'Scan submitted'),
    approved: await seedQueueTask(engineerId, earlier, 'APPROVED', 'Scan approved'),
    unlocked,
  };
}

/** Opens the queue and every task as the signed-in Engineer, recording each page and each call. */
async function visitQueueAndTasks(page: Page, recorder: ScanRecorder, tasks: StatedTasks): Promise<void> {
  const queue = await recorder.recordNavigation('GET /queue (page, states)', await page.goto('/queue'));
  expect(queue.status).toBe(200);
  for (const tab of ['open', 'closed', 'overdue']) {
    const answer = await callInBrowser(recorder, page, `GET /api/v1/tasks?tab=${tab} (API, states)`, `/api/v1/tasks?tab=${tab}`);
    expect(answer.status, `the ${tab} tab`).toBe(200);
  }
  for (const [name, task] of Object.entries(tasks)) {
    const document = await recorder.recordNavigation(`GET /estimates/${task.code} (page, ${name})`, await page.goto(`/estimates/${task.code}`));
    expect(document.status, `${name} task page`).toBe(200);
    const answer = await callInBrowser(recorder, page, `GET /api/v1/tasks/${task.id} (API, ${name})`, `/api/v1/tasks/${task.id}`);
    expect(answer.status, `${name} task API`).toBe(200);
  }
  await page.waitForLoadState('networkidle');
  await recorder.settled();
}

test('AC-6 (STORY-04.04): the queue, the task page and the task route, with a task in each state, send an Engineer no Restricted value', async ({ page, context }, testInfo) => {
  const { forbidden, engineer } = await prepare(testInfo);
  const tasks = await seedAllStates(engineer.id);
  const recorder = new ScanRecorder();
  await recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, recorder, engineer);

  await visitQueueAndTasks(page, recorder, tasks);

  // The scan looked at something: the page of each state was read with its words, and the status the route sent is the one stored.
  for (const [name, word] of [
    ['draft', 'Draft'],
    ['submitted', 'Submitted'],
    ['approved', 'Approved'],
    ['unlocked', 'Draft'],
  ] as const) {
    const read = recorder.withLabelContaining(`GET /estimates/${tasks[name].code} (page, ${name})`);
    expect(read.length, `the ${name} task page was recorded`).toBeGreaterThan(0);
    expect(read.every((response) => (response.body ?? '').includes(word)), `the ${name} page says "${word}"`).toBe(true);
  }
  const approvedStatus = recorder.withLabelContaining(`GET /api/v1/tasks/${tasks.approved.id} (API, approved)`);
  expect(JSON.parse(approvedStatus[0]?.body ?? '{}')).toMatchObject({ status: 'APPROVED' });
  const unlockedStatus = recorder.withLabelContaining(`GET /api/v1/tasks/${tasks.unlocked.id} (API, unlocked)`);
  expect(JSON.parse(unlockedStatus[0]?.body ?? '{}')).toMatchObject({ status: 'DRAFT' });
  expect(recorder.unreadable, 'responses the scan could not read').toEqual([]);
  expect(sentences(recorder, forbidden)).toEqual([]);
  expect(cacheControlProblems(recorder.responses, isExempt)).toEqual([]);
  await expectCanaryRatesStillStored();
});

test('AC-6 (negative control, STORY-04.04): a sentinel planted in the task route\'s answer is found by the same scan', async ({ page, context }, testInfo) => {
  const customer = defined(canaryMasters.find((sentinel) => sentinel.kind === 'customer-rate')).value;
  const plant: Plant = ({ url }, body) => (new URL(url).pathname.startsWith('/api/v1/tasks/') ? `${body} ${customer}` : body);
  const { forbidden, engineer } = await prepare(testInfo);
  const tasks = await seedAllStates(engineer.id);
  const recorder = new ScanRecorder(plant);
  await recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, recorder, engineer);

  await visitQueueAndTasks(page, recorder, tasks);

  const findings = scanResponses(recorder.responses, forbidden);
  expect(
    findings.some((finding) => finding.label.includes(`/api/v1/tasks/${tasks.approved.id}`) && finding.found === customer),
    'the sentinel planted in the task route\'s answer',
  ).toBe(true);
});

test('AC-4: the test-only route that leaks one sentinel is absent from the production build, even when the sentinel is supplied', async ({ request }) => {
  const answer = await request.get('/api/test-only/leak');
  expect(answer.status()).toBe(404);
  expect(await answer.text()).toBe('');
  expect(JSON.stringify(answer.headersArray())).not.toContain(NEGATIVE_CONTROL_SENTINEL);
});
