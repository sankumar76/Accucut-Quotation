import { expect, type BrowserContext, type Page, type Response as PlaywrightResponse, type Route } from '@playwright/test';

import { allowsRole, ROUTE_MANIFEST, type HttpMethod, type RouteRow } from '../../../src/server/http/route-manifest';
import { recipeProblem, validCallFor, validPageAddress } from '../../support/route-calls';
import { decodeFlightPayload, staticFileUrls, type RecordedResponse } from '../../support/scanner';
import { nonEmpty } from '../../support/security-loops';

/**
 * The browser side of the cost-confidentiality scan (STORY-01.03 T2 and T6; test strategy section 6). `tests/e2e/canary-scan.spec.ts`
 * uses it to record what a signed-in person is sent; `tests/support/scanner.ts` judges what was recorded and holds no browser.
 *
 * What it records, and where each body comes from:
 *   - a page's main document, read at once by `recordNavigation`;
 *   - every response to a `fetch` or XHR the browser makes (the page's own calls, Link prefetches of RSC payloads, and the scan's calls),
 *     by INTERCEPTION: the body is read before the page gets it, so it cannot be left unread when the page moves on (G6 QLT-03). A
 *     response type that cannot be intercepted (a WebSocket or an event stream) is not used by the portal; if one arrives, name it in the
 *     pull request, never skip it silently;
 *   - scripts, style sheets, images and fonts the browser loads: headers by the response event; the text of every script and style
 *     sheet that a recorded page, payload or script names is fetched again by `fetchReferencedFiles`, even when the browser has not
 *     asked for it yet (a lazily loaded chunk is a chunk the Engineer's pages load).
 * The route lists come from the manifest, so a story that adds a route is covered with no edit here (AC-6).
 */

/** Text bodies are read; images and fonts are not text and are skipped (their headers are still scanned). */
const TEXT_CONTENT_TYPE = /text\/|json|javascript|ecmascript|xml|x-component|html|css/i;
const REDIRECT_FIRST = 300;
const REDIRECT_LAST = 399;
/** Scripts name scripts; a build is a few levels deep. More rounds than that is a loop, not a build. */
const MAX_CRAWL_ROUNDS = 8;
/** Build files fetched at once (PRF-03): enough to overlap the round trips, few enough for the browser's own limit of six per host. */
const CRAWL_BATCH = 8;

const pathOf = (url: string): string => new URL(url).pathname;
const withoutQuery = (url: string): string => {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
};

function bodyIsReadable(status: number, contentType: string): boolean {
  return TEXT_CONTENT_TYPE.test(contentType) && status >= 200 && status !== 204 && !(status >= REDIRECT_FIRST && status <= REDIRECT_LAST);
}

export interface BrowserRequest {
  readonly method: string;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface BrowserFetch {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly text: string;
}

/** Changes the body of a response the browser fetches before the page gets it: how the negative controls plant a leak. */
export type Plant = (request: { readonly url: string; readonly method: string }, body: string) => string;

export class ScanRecorder {
  readonly responses: RecordedResponse[] = [];
  /** Responses that could not be read or intercepted. The scan tests assert it is empty (STD-07). */
  readonly unreadable: string[] = [];
  private signedIn = false;
  private readonly pending = new Set<Promise<void>>();
  private readonly intercepted = new Map<string, number>();

  /** @param plant used only by a negative control, to put a sentinel into a response the browser fetches. */
  constructor(private readonly plant?: Plant) {}

  /** Records every response of the context from now on: fetches and XHRs by interception, everything else by its headers. */
  async attach(context: BrowserContext): Promise<void> {
    context.on('response', (response) => {
      const type = response.request().resourceType();
      if (type === 'fetch' || type === 'xhr') return;
      const task: Promise<void> = this.captureHeaders(response).finally(() => this.pending.delete(task));
      this.pending.add(task);
    });
    await context.route('**/*', (route) => this.intercept(route));
  }

  /** From now on every response is to a request that carried the session (QLT-09). Call it once sign-in has landed. */
  markSignedIn(): void {
    this.signedIn = true;
  }

  /** Forgets what was recorded, for a test that wants a clean pass before it plants something. */
  reset(): void {
    this.responses.length = 0;
    this.intercepted.clear();
  }

  /** Waits for every response seen so far to be recorded. Call it before judging what was recorded. */
  async settled(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }

  private async captureHeaders(response: PlaywrightResponse): Promise<void> {
    const label = `${response.request().method()} ${pathOf(response.url())} (${response.request().resourceType()})`;
    try {
      const headers = await response.allHeaders();
      this.responses.push({ label, url: response.url(), status: response.status(), headers, body: null, carriedSession: this.signedIn });
    } catch (error) {
      this.unreadable.push(`${label}: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`);
    }
  }

  private async intercept(route: Route): Promise<void> {
    const request = route.request();
    if (request.resourceType() !== 'fetch' && request.resourceType() !== 'xhr') return route.fallback();
    const label = `${request.method()} ${pathOf(request.url())} (${request.resourceType()}, intercepted)`;
    try {
      const response = await route.fetch();
      const headers = response.headers();
      const original = bodyIsReadable(response.status(), headers['content-type'] ?? '') ? await response.text() : null;
      const body = original === null || this.plant === undefined ? original : this.plant({ url: request.url(), method: request.method() }, original);
      this.intercepted.set(`${request.method()} ${request.url()}`, this.responses.length);
      this.responses.push({ label, url: request.url(), status: response.status(), headers, body, carriedSession: this.signedIn });
      await (body !== null && body !== original ? route.fulfill({ response, body }) : route.fulfill({ response }));
    } catch (error) {
      this.unreadable.push(`${label}: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`);
      await route.abort().catch(() => undefined);
    }
  }

  /**
   * The record of a call the scan made from the page. While interception is on, the interceptor has already recorded it with the body the
   * page received, so that record is given the scan's label and returned; otherwise the answer is recorded here.
   */
  recordFetched(label: string, method: string, url: string, answer: BrowserFetch): RecordedResponse {
    const index = this.intercepted.get(`${method} ${url}`);
    const seen = index === undefined ? undefined : this.responses[index];
    if (index !== undefined && seen !== undefined) {
      const relabelled: RecordedResponse = { ...seen, label };
      this.responses[index] = relabelled;
      this.intercepted.delete(`${method} ${url}`);
      return relabelled;
    }
    const body = bodyIsReadable(answer.status, answer.headers['content-type'] ?? '') ? answer.text : null;
    const recorded: RecordedResponse = { label, url, status: answer.status, headers: answer.headers, body, carriedSession: this.signedIn };
    this.responses.push(recorded);
    return recorded;
  }

  /** Records the main document a `page.goto` got, read at once, so the page cannot be left before its body is read. */
  async recordNavigation(label: string, response: PlaywrightResponse | null): Promise<RecordedResponse> {
    if (response === null) throw new Error(`${label}: the navigation produced no response.`);
    const headers = await response.allHeaders();
    const body = bodyIsReadable(response.status(), headers['content-type'] ?? '') ? await response.text() : null;
    const recorded: RecordedResponse = { label, url: response.url(), status: response.status(), headers, body, carriedSession: this.signedIn };
    this.responses.push(recorded);
    return recorded;
  }

  /** Responses of one kind, by the label the recorder gave them. */
  withLabelContaining(text: string): RecordedResponse[] {
    return this.responses.filter((response) => response.label.includes(text));
  }

  /** Script bodies that were really read: a header-only record does not count (QLT-04). */
  scriptBodies(): RecordedResponse[] {
    return this.responses.filter(
      (response) => response.body !== null && response.url.includes('/_next/static/chunks/') && /javascript/.test(response.headers['content-type'] ?? ''),
    );
  }
}

/** Calls made by the browser itself, from the page, with its cookies. A batch is one round trip into the page. */
async function fetchInBrowser(page: Page, requests: ReadonlyArray<{ readonly url: string; readonly init: BrowserRequest }>): Promise<BrowserFetch[]> {
  return page.evaluate(
    (items) =>
      Promise.all(
        items.map(async ({ url, init }) => {
          const answer = await fetch(url, {
            method: init.method,
            credentials: 'same-origin',
            headers: { ...(init.body === undefined ? {} : { 'content-type': 'application/json' }), ...init.headers },
            ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
          });
          const headers: Record<string, string> = {};
          answer.headers.forEach((value, name) => {
            headers[name.toLowerCase()] = value;
          });
          return { status: answer.status, headers, text: await answer.text() };
        }),
      ),
    requests,
  );
}

/** A call made by the browser itself, recorded under `label`. A state-changing call carries the portal's own `Origin`, as it does from a page. */
export async function callInBrowser(
  recorder: ScanRecorder,
  page: Page,
  label: string,
  address: string,
  init: BrowserRequest = { method: 'GET' },
): Promise<RecordedResponse> {
  const url = new URL(address, page.url()).toString();
  const [answer] = await fetchInBrowser(page, [{ url, init }]);
  if (answer === undefined) throw new Error(`${label}: the browser returned no answer.`);
  return recorder.recordFetched(label, init.method, url, answer);
}

/** The build files that a recorded page, payload or script names (or that the browser loaded, headers only), not yet recorded with a body. */
function filesToFetch(recorder: ScanRecorder, origin: string, requested: ReadonlySet<string>): Map<string, string> {
  const wanted = new Map<string, string>();
  for (const response of recorder.responses) {
    if (response.body === null && /\((?:script|stylesheet)\)$/.test(response.label) && !requested.has(withoutQuery(response.url))) {
      wanted.set(withoutQuery(response.url), response.url);
    }
    if (response.body === null) continue;
    for (const url of staticFileUrls(response.body, origin)) if (!requested.has(withoutQuery(url))) wanted.set(withoutQuery(url), url);
  }
  return wanted;
}

/**
 * Fetches every script and style sheet that a recorded page, payload or script names and that has not been recorded with a body, in
 * batches, and records it, until no new file is named. Returns how many it fetched. This is the chunk path of AC-3: the planted-chunk
 * control calls it through `scanAsEngineer`, so the live control drives the same code (QLT-04).
 */
export async function fetchReferencedFiles(recorder: ScanRecorder, page: Page, origin: string): Promise<number> {
  const requested = new Set(recorder.responses.filter((response) => response.body !== null).map((response) => withoutQuery(response.url)));
  let fetched = 0;
  for (let round = 0; round < MAX_CRAWL_ROUNDS; round += 1) {
    const wanted = filesToFetch(recorder, origin, requested);
    if (wanted.size === 0) return fetched;
    const urls = [...wanted];
    for (let from = 0; from < urls.length; from += CRAWL_BATCH) {
      const batch = urls.slice(from, from + CRAWL_BATCH);
      const answers = await fetchInBrowser(
        page,
        batch.map(([, url]) => ({ url, init: { method: 'GET' } })),
      );
      batch.forEach(([key, url], index) => {
        requested.add(key);
        const answer = answers[index];
        if (answer !== undefined) recorder.recordFetched(`GET ${pathOf(url)} (referenced file)`, 'GET', url, answer);
      });
      fetched += batch.length;
    }
  }
  throw new Error(`The files named by the pages kept naming more files after ${MAX_CRAWL_ROUNDS} rounds.`);
}

/** `/estimates/[code]` with a value for each segment. */
export function fillPath(path: string, value: string): string {
  return path.replace(/\[(?:\.\.\.)?[^\]]+\]/g, value);
}

export interface ApiCall {
  readonly name: string;
  readonly row: RouteRow;
  readonly method: HttpMethod;
}

const isProtected = (row: RouteRow): boolean => row.status === 'implemented' && row.roles !== 'public';
const callsOf = (rows: ReadonlyArray<RouteRow>): ApiCall[] =>
  rows.flatMap((row) => row.methods.filter((method) => method !== 'HEAD').map((method) => ({ name: `${method} ${row.path}`, row, method })));

/** The pages an Engineer may open, from the manifest. Throws when there is none, so the scan cannot pass on nothing. */
export function engineerPages(): ReadonlyArray<RouteRow> {
  return nonEmpty(
    'Engineer pages',
    ROUTE_MANIFEST.filter((row) => row.kind === 'page' && isProtected(row) && allowsRole(row, 'ENGINEER')),
  );
}

/** Every method of every API route an Engineer may call. */
export function engineerApiCalls(): ReadonlyArray<ApiCall> {
  return nonEmpty('Engineer API calls', callsOf(ROUTE_MANIFEST.filter((row) => row.kind === 'api' && isProtected(row) && allowsRole(row, 'ENGINEER'))));
}

/** Every method of every API route that does not list an Engineer: the Lead's and the Admin's. */
export function refusedApiCalls(): ReadonlyArray<ApiCall> {
  return nonEmpty(
    'API calls an Engineer is refused',
    callsOf(ROUTE_MANIFEST.filter((row) => row.kind === 'api' && isProtected(row) && !allowsRole(row, 'ENGINEER'))),
  );
}

/** The pages that do not list an Engineer. */
export function refusedPages(): ReadonlyArray<RouteRow> {
  return nonEmpty(
    'pages an Engineer is refused',
    ROUTE_MANIFEST.filter((row) => row.kind === 'page' && isProtected(row) && !allowsRole(row, 'ENGINEER')),
  );
}

/**
 * The valid call for a route (an ID that exists, a body that passes, the status it answers), from the recipes of the role matrix, so a
 * story that adds a route with a body adds it once. `targetId` is a person who is not the caller, or the owner of the record to open.
 * Throws for a dynamic route that has no real-value recipe (AC-6, QLT-02, QLT-08).
 */
export function validCall(call: ApiCall, targetId: string): { readonly id: string; readonly body: unknown; readonly query: string; readonly status: number } {
  const { id, body, query = '', status } = validCallFor(call.method, call.row.path, { targetId });
  const problem = recipeProblem(call.row.path, id);
  if (problem !== null) throw new Error(`${call.name}: ${problem}`);
  return { id, body, query, status };
}

export interface EngineerScan {
  readonly pages: number;
  /** The address of every page the scan opened, hidden review pages included, so each can be required to have a body that was read (QLT-16). */
  readonly addresses: ReadonlyArray<string>;
  readonly calls: number;
  readonly referenced: number;
  readonly durationMs: number;
}

/** Opens every page the manifest lists for an Engineer, as a person does and as a client navigation fetches it. Returns their addresses. */
async function openEngineerPages(page: Page, recorder: ScanRecorder, owner: { readonly id: string }): Promise<string[]> {
  const addresses: string[] = [];
  for (const row of engineerPages()) {
    const address = validPageAddress(row.path, { ownerId: owner.id });
    addresses.push(address);
    const document = await recorder.recordNavigation(`GET ${address} (page)`, await page.goto(address));
    const hidden = row.hiddenInProduction === true;
    expect(document.status, `${address} ${hidden ? 'is a review page, absent from the production build' : 'must answer 200'}`).toBe(hidden ? 404 : 200);
    // A session lost on the way would land on the sign-in page and answer 200 there: the final address must be the one asked for.
    if (!hidden) expect(pathOf(document.url), `${address} was redirected`).toBe(address);
    const payload = await callInBrowser(recorder, page, `GET ${address} (RSC)`, address, { method: 'GET', headers: { RSC: '1' } });
    // An RSC request for a page that is not found is answered 200 with a not-found payload, so a hidden page is held to "no server error".
    if (hidden) expect(payload.status, `${address} as an RSC request`).toBeLessThan(500);
    else expect(payload.status, `${address} as an RSC request`).toBe(200);
  }
  return addresses;
}

/** Calls every API route the manifest lists for an Engineer with its real-value recipe, and requires the recipe's status. Returns how many. */
async function callEngineerRoutes(page: Page, recorder: ScanRecorder, owner: { readonly id: string }): Promise<number> {
  const calls = engineerApiCalls();
  for (const call of calls) {
    const recipe = validCall(call, owner.id);
    const path = `${fillPath(call.row.path, recipe.id)}${recipe.query}`;
    const answer = await callInBrowser(recorder, page, `${call.method} ${path} (API)`, path, {
      method: call.method,
      ...(call.method === 'GET' ? {} : { body: recipe.body }),
    });
    expect(answer.status, `${call.name} answers its recipe's status`).toBe(recipe.status);
  }
  return calls.length;
}

/**
 * The AC-3 procedure, in one place: an Engineer's journeys over every page and route of the manifest, then the scripts and style sheets those
 * name. The scan and its negative controls both call it (QLT-04), so a control that plants a leak in a chunk or in a response the browser
 * fetches runs the very code that the real scan relies on. It asserts what makes the run meaningful (status, final address, recipe status)
 * and returns what it did; the caller judges the recorder.
 */
export async function scanAsEngineer(page: Page, recorder: ScanRecorder, owner: { readonly id: string }): Promise<EngineerScan> {
  const started = Date.now();
  const addresses = await openEngineerPages(page, recorder, owner);
  const calls = await callEngineerRoutes(page, recorder, owner);
  await page.waitForLoadState('networkidle');
  await recorder.settled();
  const referenced = await fetchReferencedFiles(recorder, page, new URL(page.url()).origin);
  await recorder.settled();
  return { pages: addresses.length, addresses, calls, referenced, durationMs: Date.now() - started };
}

/**
 * What a scan that looked at something has seen, so "0 found" means something: pages, payloads, JSON and scripts whose body was READ (a
 * header-only record does not count, QLT-04 and QLT-16), every page that was opened with a body read for the page and for its RSC payload,
 * and a flight payload.
 */
export function expectScanSawEnough(recorder: ScanRecorder, scan: EngineerScan): void {
  const readOfType = (type: RegExp): RecordedResponse[] =>
    recorder.responses.filter((response) => response.body !== null && type.test(response.headers['content-type'] ?? ''));
  expect(readOfType(/text\/html/).length, 'HTML pages read').toBeGreaterThanOrEqual(scan.pages);
  expect(readOfType(/text\/x-component/).length, 'RSC payloads read').toBeGreaterThanOrEqual(scan.pages);
  expect(readOfType(/application\/json/).length, 'JSON answers read').toBeGreaterThanOrEqual(scan.calls);
  for (const address of scan.addresses) {
    for (const kind of ['page', 'RSC']) {
      const records = recorder.withLabelContaining(`GET ${address} (${kind})`);
      expect(records.length, `${address} (${kind}) was recorded`).toBeGreaterThan(0);
      expect(
        records.every((record) => record.body !== null),
        `the body of ${address} (${kind}) was read`,
      ).toBe(true);
    }
  }
  expect(scan.referenced, 'build files fetched from the names in pages and payloads').toBeGreaterThan(0);
  expect(recorder.scriptBodies().length, 'script bodies that were read').toBeGreaterThan(0);
  const queue = recorder.responses.find((response) => response.label === 'GET /queue (page)');
  expect(decodeFlightPayload(queue?.body ?? '').length, 'the queue page carries an RSC flight payload').toBeGreaterThan(0);
  expect(recorder.unreadable, 'responses the scan could not read').toEqual([]);
}
