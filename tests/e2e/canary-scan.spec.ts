import { readdirSync } from 'node:fs';

import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { SEED_PROCESS_ITEMS } from '../../prisma/seed/config/seed-ids';
import { canaryMasters, forbiddenStrings, NEGATIVE_CONTROL_SENTINEL, PROCESS_CANARY_RATES } from '../support/canary-masters';
import { defined } from '../support/defined';
import { cacheControlProblems, describeFinding, fixedForbiddenProblem, isBuiltFile, maskRequestId, scanResponses } from '../support/scanner';

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
  return { forbidden: forbiddenStrings(await readFormulaTexts()), engineer: await createDisposableUser('scan', testInfo) };
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
});

test('AC-3, AC-4 (control with real data): the same scan finds the canary rates in what the Admin is sent', async ({ page, context }) => {
  await ensureCanaryProcessRates();
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
});

test('AC-4: the test-only route that leaks one sentinel is absent from the production build, even when the sentinel is supplied', async ({ request }) => {
  const answer = await request.get('/api/test-only/leak');
  expect(answer.status()).toBe(404);
  expect(await answer.text()).toBe('');
  expect(JSON.stringify(answer.headersArray())).not.toContain(NEGATIVE_CONTROL_SENTINEL);
});
