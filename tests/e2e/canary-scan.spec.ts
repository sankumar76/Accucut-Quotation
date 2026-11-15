import { readdirSync } from 'node:fs';

import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { z } from 'zod';

import { SEED_PROCESS_ITEMS } from '../../prisma/seed/config/seed-ids';
import { forbiddenCalculated } from '../support/calculated-values';
import { canaryMasters, forbiddenStrings, NEGATIVE_CONTROL_SENTINEL, PROCESS_CANARY_RATES } from '../support/canary-masters';
import { CUSTOMER_CANARIES, CUSTOMER_CANARY_PHONE, CUSTOMER_CANARY_VALUES } from '../support/customer-canary';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
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
  fillCanaryPart,
  insertPrivateMaterial,
  makeCanaryEstimateCalculable,
  readCalculatedValues,
  readEstimateState,
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
import { waitUntilHydrated } from './support/design-system';
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
  const forbidden = forbiddenStrings(await readFormulaTexts());
  const engineer = await createDisposableUser('scan', testInfo);
  // STORY-05.04 AC-7, review SQR-05: the person's canary part holds what an Engineer types into every section of the form, and a Restricted price and a key that is no field, which no answer may carry.
  await fillCanaryPart(engineer.id);
  return { forbidden, engineer };
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
  // STORY-02.06 AC-5: the hidden "Not applicable" entries are offered to an Engineer too, with no Material Considered and no number (a literal ID, as the migration writes it).
  expect(options.find((option) => option['id'] === '00000000-0000-4000-8000-000500000001'), 'the hidden material is offered').toEqual({
    id: '00000000-0000-4000-8000-000500000001',
    name: 'Not applicable',
    materialConsidered: null,
  });
  const treatmentAnswer = await callInBrowser(recorder, page, 'GET /api/v1/options/treatments (API, Engineer)', '/api/v1/options/treatments');
  expect(treatmentAnswer.status).toBe(200);
  const treatments = optionsBody.parse(JSON.parse(treatmentAnswer.body ?? '{}')).options;
  expect(treatments.find((option) => option['id'] === '00000000-0000-4000-8000-000700000002'), 'the hidden treatment is offered').toEqual({
    id: '00000000-0000-4000-8000-000700000002',
    name: 'Not applicable',
  });
  for (const option of treatments) expect(Object.keys(option).sort(), 'no rate of any kind').toEqual(['id', 'name']);
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

/**
 * STORY-05.09 AC-6 (NFR-002; test strategy section 6, "Also asserted: Calculate's Engineer response equals exactly {status, message}"): the Calculate journey. The Engineer owns an estimate that
 * can be calculated, with the canary customer's rates and a canary material, and presses Calculate in the browser; the page afterwards, the routes that read the estimate, and a second press are
 * recorded too. Every Restricted value exists in the database, as plain digits, in Indian grouping and in two-decimal form, and none of them, nor any calculated output, may be in anything the
 * Engineer was sent. The answer to the press is exactly `{status, message}`, and a second press is the 409 and sends nothing either. The part also holds a planted price under Material Rate / Kg
 * and an unknown key (`fillCanaryPart`), which Calculate must ignore.
 */
const CALCULATE_ANSWER = { status: 'SUBMITTED', message: 'Cost will be calculated based on the input fields and sent for review/approval.' };

/**
 * Opens the estimate page as the signed-in Engineer, presses Calculate in the browser and waits until the page is quiet, checking the answer is exactly `{status, message}`. `mark` is how many
 * responses were recorded when the press was made, so what was sent from the press on is `recorder.responses.slice(mark)`.
 */
async function pressCalculate(page: Page, recorder: ScanRecorder, estimateId: string, code: string): Promise<{ readonly mark: number }> {
  const before = await recorder.recordNavigation(`GET /estimates/${code} (page, before Calculate)`, await page.goto(`/estimates/${code}`));
  expect(before.status).toBe(200);
  await waitUntilHydrated(page, '#calculate-button', 'onClick');
  const mark = recorder.responses.length;
  const answered = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/estimates/${estimateId}/calculate`));
  await page.locator('#calculate-button').click();
  const response = await answered;
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual(CALCULATE_ANSWER);
  await expect(page.locator('#calculate-button')).toHaveText('Submitted');
  await page.waitForLoadState('networkidle');
  await recorder.settled();
  return { mark };
}

/**
 * The figures of the record this estimate's Calculate wrote, as strings to look for (`tests/support/calculated-values.ts` says which are watched and which are skipped). The list is never empty: a
 * journey that watched nothing would pass for the wrong reason, so it fails here with the reason.
 */
async function figuresOfTheRecord(estimateId: string): Promise<ReturnType<typeof forbiddenCalculated>> {
  const { calculated, typed } = await readCalculatedValues(estimateId);
  const watched = forbiddenCalculated(calculated, typed);
  expect(watched.length, 'the record holds figures of three digits or more with a fraction, which the scan can look for').toBeGreaterThan(0);
  return watched;
}

test('AC-6 (STORY-05.09): the Calculate journey sends an Engineer no Restricted value, and the answer is exactly {status, message}', async ({ page, context }, testInfo) => {
  const { forbidden, engineer } = await prepare(testInfo);
  await makeCanaryEstimateCalculable(engineer.id, defined(MATERIAL_CANARIES[0]).id, defined(CUSTOMER_CANARIES[0]).id);
  const code = canaryTaskCodeFor(engineer.id);
  const recorder = new ScanRecorder();
  await recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, recorder, engineer);

  const pressed = await pressCalculate(page, recorder, engineer.id, code);

  // After the press: the page, the routes that read the estimate, and a second press.
  const after = await recorder.recordNavigation(`GET /estimates/${code} (page, after Calculate)`, await page.goto(`/estimates/${code}`));
  expect(after.status).toBe(200);
  expect(after.body ?? '').toContain('Submitted');
  for (const path of [`/api/v1/estimates/${engineer.id}/form`, `/api/v1/estimates/${engineer.id}/tree`, `/api/v1/estimates/${engineer.id}/nodes/${engineer.id}`, `/api/v1/tasks/${engineer.id}`]) {
    expect((await callInBrowser(recorder, page, `GET ${path} (API, after Calculate)`, path)).status, path).toBe(200);
  }
  const again = await callInBrowser(recorder, page, 'POST calculate (API, second press)', `/api/v1/estimates/${engineer.id}/calculate`, { method: 'POST' });
  expect(again.status).toBe(409);
  expect(JSON.parse(again.body ?? '{}')).toMatchObject({ code: 'ESTIMATE_ALREADY_SUBMITTED' });
  // STORY-06.02 AC-5: now that a current calculation exists, the route that carries its figures is still the fixed 403 for the Engineer, and the same address of the page is still their own workspace.
  const costs = await callInBrowser(recorder, page, 'GET costs (API, after Calculate)', `/api/v1/estimates/${engineer.id}/costs`);
  expect(costs.status).toBe(403);
  expect(fixedForbiddenProblem(costs)).toBeNull();
  await page.waitForLoadState('networkidle');
  await recorder.settled();

  // The scan looked at something: the estimate really was calculated, once.
  expect(await readEstimateState(engineer.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
  expect(recorder.unreadable, 'responses the scan could not read').toEqual([]);
  expect(sentences(recorder, forbidden)).toEqual([]);
  // Review SQR-02 of AQP-317: the figures the calculation itself produced (the record this press wrote) are looked for in everything the Engineer was sent from the press on.
  const watched = await figuresOfTheRecord(engineer.id);
  expect(scanResponses(recorder.responses.slice(pressed.mark), watched).map(describeFinding)).toEqual([]);
  expect(cacheControlProblems(recorder.responses, isExempt)).toEqual([]);
  await expectCanaryRatesStillStored();
});

test('AC-6 (negative control, STORY-05.09): a figure of the calculation planted in the tree\'s answer after the press is found by the same scan', async ({ page, context }, testInfo) => {
  // The figure is known only once the press has been answered, so the plant is armed after it: the tree's answer then carries one figure of the record.
  let planted: string | null = null;
  const plant: Plant = ({ url }, body) => (planted !== null && new URL(url).pathname.endsWith('/tree') ? `${body} ${planted}` : body);
  const { engineer } = await prepare(testInfo);
  await makeCanaryEstimateCalculable(engineer.id, defined(MATERIAL_CANARIES[0]).id, defined(CUSTOMER_CANARIES[0]).id);
  const recorder = new ScanRecorder(plant);
  await recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, recorder, engineer);

  const pressed = await pressCalculate(page, recorder, engineer.id, canaryTaskCodeFor(engineer.id));
  const watched = await figuresOfTheRecord(engineer.id);
  planted = defined(watched[0]).text;
  await callInBrowser(recorder, page, `GET /api/v1/estimates/${engineer.id}/tree (API, planted)`, `/api/v1/estimates/${engineer.id}/tree`);

  const findings = scanResponses(recorder.responses.slice(pressed.mark), watched);
  expect(
    findings.some((finding) => finding.label.includes('/tree (API, planted)') && finding.found === planted),
    'the figure planted in the tree\'s answer',
  ).toBe(true);
  // And the scan before the plant was armed was clean, so the finding is the plant's and not another figure's.
  expect(findings.filter((finding) => !finding.label.includes('(API, planted)')).map(describeFinding)).toEqual([]);
});

test('AC-6 (STORY-05.09): the same estimate calculated under two sets of masters gives identical answers', async ({ page, context }, testInfo) => {
  const { engineer: first } = await prepare(testInfo);
  const second = await createDisposableUser('scan', testInfo);
  await fillCanaryPart(second.id);
  // Two materials of the test's own, with different numbers (the canary materials are shared with other tests and are not touched).
  const cheap = await insertPrivateMaterial({ pricePerKg: '137.37', specificGravity: '7.37', scrapRate: '27.37' });
  const dear = await insertPrivateMaterial({ pricePerKg: '9137.73', specificGravity: '2.73', scrapRate: '93.73' });
  await makeCanaryEstimateCalculable(first.id, cheap, defined(CUSTOMER_CANARIES[0]).id);
  await makeCanaryEstimateCalculable(second.id, dear, defined(CUSTOMER_CANARIES[0]).id);

  const recorder = new ScanRecorder();
  await recorder.attach(context);
  await useFreshAddress(context);
  const bodies: string[] = [];
  for (const person of [first, second]) {
    await context.clearCookies();
    await signIn(page, recorder, person);
    const answer = await callInBrowser(recorder, page, `POST calculate (API, ${person.id})`, `/api/v1/estimates/${person.id}/calculate`, { method: 'POST' });
    expect(answer.status).toBe(200);
    bodies.push(answer.body ?? '');
  }
  expect(bodies[0]).toBe(JSON.stringify(CALCULATE_ANSWER));
  expect(bodies[1]).toBe(bodies[0]);
  expect(await readEstimateState(first.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
  expect(await readEstimateState(second.id)).toEqual({ status: 'SUBMITTED', calculations: 1 });
});

/**
 * STORY-06.02 AC-5, AC-6 (NFR-002; test strategy section 6): the estimate review. The Lead and the Admin are meant to see the calculation's figures, so the scan turns round: on the page of the review
 * (`/estimates/<code>` as a Lead) and on `GET /estimates/{id}/costs` the figures of the record **are** found (the page shows what the record holds), and **no master value, rate name or formula**
 * is (the review has no cost details yet: STORY-06.03). The figures are looked for in the forms a screen prints, whole-rupee roundings included (review SQR-12 of AQP-317). The Engineer's side of the same
 * address is the journey above (the page after Calculate, and `/costs` refused with the fixed 403) and the refusals of AC-5, which iterate the manifest and so call `/costs` as an Engineer.
 */
async function calculatedEstimateOf(
  page: Page,
  context: BrowserContext,
  testInfo: TestInfo,
): Promise<{ readonly id: string; readonly code: string; readonly forbidden: Awaited<ReturnType<typeof prepare>>['forbidden'] }> {
  const { forbidden, engineer } = await prepare(testInfo);
  await makeCanaryEstimateCalculable(engineer.id, defined(MATERIAL_CANARIES[0]).id, defined(CUSTOMER_CANARIES[0]).id);
  const code = canaryTaskCodeFor(engineer.id);
  await page.goto('/sign-in');
  await signInThroughThePage(page, engineer.email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/queue$/);
  await page.goto(`/estimates/${code}`);
  const status = await page.evaluate(async (id) => (await fetch(`/api/v1/estimates/${id}/calculate`, { method: 'POST' })).status, engineer.id);
  expect(status).toBe(200);
  await context.clearCookies();
  return { id: engineer.id, code, forbidden };
}

test('AC-6 (STORY-06.02): the Lead\'s review page and `/costs` show the figures of the record, and no master value, rate name or formula', async ({ page, context }, testInfo) => {
  await useFreshAddress(context);
  const { id, code, forbidden } = await calculatedEstimateOf(page, context, testInfo);
  const lead = await createDisposableUser('scan', testInfo, 'LEAD');
  const recorder = new ScanRecorder();
  await recorder.attach(context);
  await signIn(page, recorder, lead);

  const review = await recorder.recordNavigation(`GET /estimates/${code} (page, Lead review)`, await page.goto(`/estimates/${code}`));
  expect(review.status).toBe(200);
  expect(review.body ?? '').toContain('Total Unit Production Price');
  const costs = await callInBrowser(recorder, page, `GET /api/v1/estimates/${id}/costs (API, Lead)`, `/api/v1/estimates/${id}/costs`);
  expect(costs.status).toBe(200);
  expect(JSON.parse(costs.body ?? '{}')).toMatchObject({ state: 'current' });
  await page.waitForLoadState('networkidle');
  await recorder.settled();

  expect(recorder.unreadable, 'responses the scan could not read').toEqual([]);
  // No master value, rate name or formula, in the page or in the answer.
  expect(sentences(recorder, forbidden)).toEqual([]);
  // The control that the scan looks at something real: the figures of the record are on the page and in the answer, as the Lead is meant to see them.
  const found = scanResponses(recorder.responses, await figuresOfTheRecord(id));
  expect(found.some((finding) => finding.label.includes('(page, Lead review)')), 'a figure of the record is on the Lead\'s review page').toBe(true);
  expect(found.some((finding) => finding.label.includes('(API, Lead)')), 'a figure of the record is in the Lead\'s `/costs` answer').toBe(true);
  expect(cacheControlProblems(recorder.responses, isExempt)).toEqual([]);
  await expectCanaryRatesStillStored();
});

test('AC-6 (negative control, STORY-06.02): a master value planted in the Lead\'s `/costs` answer is found by the same scan', async ({ page, context }, testInfo) => {
  const customer = defined(canaryMasters.find((sentinel) => sentinel.kind === 'customer-rate')).value;
  const plant: Plant = ({ url }, body) => (new URL(url).pathname.endsWith('/costs') ? `${body} ${customer}` : body);
  await useFreshAddress(context);
  const { id, forbidden } = await calculatedEstimateOf(page, context, testInfo);
  const lead = await createDisposableUser('scan', testInfo, 'LEAD');
  const recorder = new ScanRecorder(plant);
  await recorder.attach(context);
  await signIn(page, recorder, lead);

  await page.goto('/queue');
  await callInBrowser(recorder, page, `GET /api/v1/estimates/${id}/costs (API, planted)`, `/api/v1/estimates/${id}/costs`);
  await recorder.settled();

  const findings = scanResponses(recorder.responses, forbidden);
  expect(
    findings.some((finding) => finding.label.includes('/costs (API, planted)') && finding.found === customer),
    'the master value planted in the `/costs` answer',
  ).toBe(true);
});

test('AC-4: the test-only route that leaks one sentinel is absent from the production build, even when the sentinel is supplied', async ({ request }) => {
  const answer = await request.get('/api/test-only/leak');
  expect(answer.status()).toBe(404);
  expect(await answer.text()).toBe('');
  expect(JSON.stringify(answer.headersArray())).not.toContain(NEGATIVE_CONTROL_SENTINEL);
});
