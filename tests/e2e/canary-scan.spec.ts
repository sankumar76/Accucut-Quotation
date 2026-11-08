import { expect, test, type Page } from '@playwright/test';

import { ROUTE_MANIFEST } from '../../src/server/http/route-manifest';
import { canaryMasters, forbiddenStrings, NEGATIVE_CONTROL_SENTINEL, PROCESS_CANARY_RATES } from '../support/canary-masters';
import { defined } from '../support/defined';
import {
  cacheControlProblems,
  decodeFlightPayload,
  describeFinding,
  fixedForbiddenProblem,
  scanResponse,
  scanResponses,
  type RecordedResponse,
} from '../support/scanner';

import {
  createDisposableUser,
  E2E_ADMIN,
  E2E_PASSWORD,
  ensureCanaryProcessRates,
  ensureCanaryUser,
  readFormulaTexts,
  signInThroughThePage,
  useFreshAddress,
  type E2eUser,
} from './support/auth';
import { callInBrowser, engineerApiCalls, engineerPages, fetchReferencedFiles, fillPath, refusedApiCalls, refusedPages, ScanRecorder, validCall } from './support/canary-scan';
import { PRODUCTION_URL } from './support/servers';

/**
 * STORY-01.03 (AC-3, AC-4, AC-5, AC-6, AC-8; SPEC section 14.1, NFR-002; ADR-008 layer 5; test strategy section 6): the cost-confidentiality
 * scan, on the PRODUCTION build (`next start`, the artefact that ships) and a real database.
 *
 * `canaryMasters` gives every Restricted value an invented sentinel, and the three Process Master canary rates of STORY-02.01 are put in the
 * database. An Engineer signs in through the sign-in page, opens every page the manifest lists for them, calls every API route the manifest
 * lists for them directly, and the scan looks in everything they were sent, for each sentinel as plain digits, in Indian grouping and in
 * two-decimal form, for rate names, `{{f:`, `{{rate:`, `{{mat:` and the stored formula text: HTML, RSC flight payloads (also fetched with
 * `RSC: 1`), JSON, headers, and the JavaScript chunks the pages load or name. Typed values are not on the list (FR-008).
 *
 * The pages and routes come from the route manifest, so a story that opens a route to an Engineer, or adds a Lead or Admin route, is covered with
 * no change here (AC-6); its own tasks add its Restricted values to `canaryMasters`. The scan is the stage 12 gate of every pull request and is
 * never quarantined (test strategy section 10, flaky-test policy; AC-8).
 *
 * Controls, because a green scan is only worth something if it can go red: the Admin is sent the canary rates by the same routes and the same scan
 * finds them (real data); a sentinel planted in a header, an RSC payload and a script is reported in each place; `/api/test-only/leak` is absent.
 *
 * Width: nothing here reads layout (an HTTP status, a header, a body, a script), so these tests are candidates for the one-width tag of test strategy section 10.5; they carry no tag
 * until test strategy section 10.5 rules on them (AQP-57 hand-off).
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

const INVENTED_ID = '00000000-0000-4000-8000-0000000000fe';
const INVENTED_PAGE_VALUE = 'invented-code';

/** Signs in through the page. The test has set a client address of its own first (`useFreshAddress`), so no other test's failures count against it. */
async function signIn(page: Page, person: E2eUser): Promise<void> {
  await page.goto('/sign-in');
  await signInThroughThePage(page, person.email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/queue$/);
}

const sentenceOf = (findings: ReadonlyArray<ReturnType<typeof scanResponse>[number]>): string[] => findings.map(describeFinding);

test('AC-3: an Engineer is sent no Restricted value, name or formula by any page, payload, header or script', async ({ page, context }, testInfo) => {
  await ensureCanaryProcessRates();
  const forbidden = forbiddenStrings(await readFormulaTexts());
  const engineer = await createDisposableUser('scan', testInfo);
  const recorder = new ScanRecorder();
  recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, engineer);

  // The journeys that exist: every page the manifest lists for an Engineer, as a person opens it and as a client navigation fetches it.
  const pages = engineerPages();
  for (const row of pages) {
    const path = fillPath(row.path, INVENTED_PAGE_VALUE);
    const document = await recorder.recordNavigation(`GET ${path} (page)`, await page.goto(path));
    if (row.hiddenInProduction === true) expect(document.status, `${path} is a review page, absent from the production build`).toBe(404);
    expect(document.status, path).toBeLessThan(500);
    const payload = await callInBrowser(recorder, page, `GET ${path} (RSC)`, path, { method: 'GET', headers: { RSC: '1' } });
    expect(payload.status, `${path} as an RSC request`).toBeLessThan(500);
  }

  // Every API route the manifest lists for an Engineer, called directly, with the valid call of the role matrix.
  const calls = engineerApiCalls();
  for (const call of calls) {
    const { id, body } = validCall(call, INVENTED_ID);
    const path = fillPath(call.row.path, id);
    const answer = await callInBrowser(recorder, page, `${call.method} ${path} (API)`, path, { method: call.method, ...(call.method === 'GET' ? {} : { body }) });
    expect(answer.status, call.name).toBeLessThan(500);
  }

  // The scripts and style sheets the pages load, and the ones their payloads name (a lazily loaded chunk is one the pages load).
  await page.waitForLoadState('networkidle');
  await recorder.settled();
  const referenced = await fetchReferencedFiles(recorder, page, PRODUCTION_URL);
  await recorder.settled();

  // Not vacuous: the scan really saw pages, payloads, JSON and scripts, and the canary rates are in the database it ran against.
  const withType = (type: RegExp): RecordedResponse[] => recorder.responses.filter((response) => type.test(response.headers['content-type'] ?? ''));
  expect(withType(/text\/html/).length).toBeGreaterThanOrEqual(pages.length);
  expect(withType(/text\/x-component/).length).toBeGreaterThanOrEqual(pages.length);
  expect(withType(/application\/json/).length).toBeGreaterThanOrEqual(calls.length);
  const scripts = recorder.responses.filter((response) => response.url.includes('/_next/static/chunks/') && /javascript/.test(response.headers['content-type'] ?? ''));
  expect(scripts.length, `scripts scanned (${referenced} of them fetched from the names in pages and payloads)`).toBeGreaterThan(0);
  const queuePage = recorder.responses.find((response) => response.label === 'GET /queue (page)');
  expect(decodeFlightPayload(queuePage?.body ?? '').length, 'the queue page carries an RSC flight payload').toBeGreaterThan(0);
  for (const row of pages) expect(recorder.withLabelContaining(`GET ${fillPath(row.path, INVENTED_PAGE_VALUE)} (page)`).length, row.path).toBeGreaterThan(0);

  expect(sentenceOf(scanResponses(recorder.responses, forbidden))).toEqual([]);
  // AC-5: `private, no-store` on every response that answers a protected route or page.
  expect(cacheControlProblems(recorder.responses, ROUTE_MANIFEST)).toEqual([]);
});

test('AC-5: every Lead and Admin route, called as an Engineer, is the fixed 403 with no data, for a real ID and an invented one', async ({ page, context }, testInfo) => {
  await ensureCanaryProcessRates();
  const forbidden = forbiddenStrings(await readFormulaTexts());
  const realPersonId = await ensureCanaryUser();
  const engineer = await createDisposableUser('scan', testInfo);
  const recorder = new ScanRecorder();
  recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, engineer);

  const calls = refusedApiCalls();
  const withoutRequestId = (answer: RecordedResponse | undefined): string => defined(answer, 'answer').body?.replace(/req-[0-9a-f]{8}/, 'req-') ?? '';
  for (const call of calls) {
    const real = validCall(call, realPersonId);
    const answers: RecordedResponse[] = [];
    for (const id of [real.id, INVENTED_ID]) {
      const path = fillPath(call.row.path, id);
      answers.push(await callInBrowser(recorder, page, `${call.method} ${path} (API)`, path, { method: call.method, ...(call.method === 'GET' ? {} : { body: real.body }) }));
    }
    for (const answer of answers) {
      expect(fixedForbiddenProblem(answer), call.name).toBeNull();
      expect(answer.headers['cache-control'], `${call.name}: Cache-Control`).toBe('private, no-store');
    }
    // The role check runs first, before any lookup: a person who exists and one who does not are told exactly the same.
    expect(withoutRequestId(answers[0]), call.name).toBe(withoutRequestId(answers[1]));
  }

  // The pages: HTTP 403 and the "no access" page (SCR-26), with nothing of the page behind it.
  for (const row of refusedPages()) {
    const path = fillPath(row.path, INVENTED_PAGE_VALUE);
    const document = await recorder.recordNavigation(`GET ${path} (page)`, await page.goto(path));
    expect(document.status, `${path} as an Engineer`).toBe(403);
    await expect(page.getByRole('heading', { level: 1, name: 'You do not have access to this page' })).toBeVisible();
  }

  await page.waitForLoadState('networkidle');
  await recorder.settled();
  expect(sentenceOf(scanResponses(recorder.responses, forbidden))).toEqual([]);
  expect(cacheControlProblems(recorder.responses, ROUTE_MANIFEST)).toEqual([]);
});

test('AC-3, AC-4 (control with real data): the same scan finds the canary rates in what the Admin is sent', async ({ page, context }) => {
  await ensureCanaryProcessRates();
  const forbidden = forbiddenStrings(await readFormulaTexts());
  const recorder = new ScanRecorder();
  recorder.attach(context);
  await useFreshAddress(context);
  await signIn(page, E2E_ADMIN);

  await callInBrowser(recorder, page, 'GET /api/v1/process-items (API, Admin)', '/api/v1/process-items');
  await recorder.recordNavigation('GET /masters/process (page, Admin)', await page.goto('/masters/process'));
  await page.waitForLoadState('networkidle');
  await recorder.settled();

  const found = new Set(scanResponses(recorder.responses, forbidden).map((finding) => finding.found));
  for (const rate of PROCESS_CANARY_RATES) expect(found.has(rate.value), `the scan finds the value of ${rate.name}`).toBe(true);
  expect(found.has(defined(PROCESS_CANARY_RATES[0]).name), 'the scan finds the canary name').toBe(true);
});

test('AC-4 (negative control): a sentinel planted in a header, an RSC payload and a script is reported in each place', async ({ page, context }) => {
  const material = defined(canaryMasters.find((sentinel) => sentinel.kind === 'material-price')).value;
  const customer = defined(canaryMasters.find((sentinel) => sentinel.kind === 'customer-rate')).value;
  const rateName = 'Cutting-Rate-per-Sec';
  const forbidden = forbiddenStrings();
  // The planted script is served by the test, not the server, so only the browser's copy holds it: this recorder reads script bodies too.
  const recorder = new ScanRecorder(true);
  recorder.attach(context);

  // A clean pass first: nothing is found in the page as it is, so what is found after is what was planted.
  await recorder.recordNavigation('GET /sign-in (page)', await page.goto('/sign-in'));
  await page.waitForLoadState('networkidle');
  await recorder.settled();
  expect(sentenceOf(scanResponses(recorder.responses, forbidden))).toEqual([]);
  recorder.responses.length = 0;

  let planted = false;
  await context.route('**/sign-in', async (route) => {
    const original = await route.fetch();
    const flight = JSON.stringify(`0:{"rate":"${customer}"}\n`);
    const body = (await original.text()).replace('</body>', `<script>self.__next_f.push([1,${flight}])</script></body>`);
    await route.fulfill({ response: original, body, headers: { ...original.headers(), 'x-planted-rate': material } });
  });
  await context.route('**/_next/static/chunks/*.js', async (route) => {
    const original = await route.fetch();
    if (planted) return route.fulfill({ response: original });
    planted = true;
    return route.fulfill({ response: original, body: `${await original.text()}\n;/* ${rateName} */` });
  });
  await recorder.recordNavigation('GET /sign-in (page, planted)', await page.goto('/sign-in'));
  await page.waitForLoadState('networkidle');
  await recorder.settled();

  const findings = scanResponses(recorder.responses, forbidden).map((finding) => `${finding.place} | ${finding.found}`);
  expect(findings).toEqual(expect.arrayContaining([`headers | ${material}`, `decoded RSC payload | ${customer}`]));
  expect(
    scanResponses(recorder.responses.filter((response) => response.url.includes('/_next/static/chunks/')), forbidden).map((finding) => finding.found),
    'the rate name planted in a script chunk',
  ).toContain(rateName);
});

test('AC-4: the test-only route that leaks one sentinel is absent from the production build, even when the sentinel is supplied', async ({ request }) => {
  const answer = await request.get('/api/test-only/leak');
  expect(answer.status()).toBe(404);
  expect(await answer.text()).toBe('');
  expect(JSON.stringify(answer.headersArray())).not.toContain(NEGATIVE_CONTROL_SENTINEL);
});
