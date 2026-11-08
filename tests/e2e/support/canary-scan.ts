import type { APIResponse, BrowserContext, Page, Response as PlaywrightResponse } from '@playwright/test';

import { allowsRole, ROUTE_MANIFEST, type HttpMethod, type RouteRow } from '../../../src/server/http/route-manifest';
import { validCallFor } from '../../support/route-calls';
import { staticFileUrls, type RecordedResponse } from '../../support/scanner';
import { nonEmpty } from '../../support/security-loops';

/**
 * The browser side of the cost-confidentiality scan (STORY-01.03 T2 and T6; test strategy section 6). `tests/e2e/canary-scan.spec.ts`
 * uses it to record what a signed-in person is sent; `tests/support/scanner.ts` judges what was recorded and holds no browser.
 *
 * What it records: every response the browser receives in a context (pages, scripts, style sheets, fetches), every direct call the
 * test makes with the context's session, and every static file that a recorded page or payload names, fetched even when the
 * browser has not asked for it yet (a lazily loaded chunk is a chunk the Engineer's pages load). The route lists come from the
 * manifest, so a story that adds a route is covered with no edit here (AC-6).
 */

/** Text bodies are read; images and fonts are not text and are skipped (their headers are still scanned). */
const TEXT_CONTENT_TYPE = /text\/|json|javascript|ecmascript|xml|x-component|html|css/i;
const REDIRECT_FIRST = 300;
const REDIRECT_LAST = 399;
/** Scripts name scripts; a build is a few levels deep. More rounds than that is a loop, not a build. */
const MAX_CRAWL_ROUNDS = 8;

const pathOf = (url: string): string => new URL(url).pathname;
const withoutQuery = (url: string): string => {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
};

function bodyIsReadable(status: number, contentType: string): boolean {
  return TEXT_CONTENT_TYPE.test(contentType) && status >= 200 && status !== 204 && !(status >= REDIRECT_FIRST && status <= REDIRECT_LAST);
}

export class ScanRecorder {
  readonly responses: RecordedResponse[] = [];
  /** Responses the browser got but whose body could not be read (a page left before it finished). Informational. */
  readonly unreadable: string[] = [];
  private readonly pending = new Set<Promise<void>>();

  /**
   * @param readBodies also read the body of every response the browser receives. Off by default: the listener then records each response's
   * status, headers and URL, and the bodies come from the scan's own calls (a page's main document, every API route, the RSC payload of each
   * page, every build file), which are the same bytes and cannot be left unread. A read made from the browser's event waits for a body that
   * the page may abandon when it moves on to the next page, and such a read never ended (the scan hung until its time limit). Only for a test
   * that serves a file the server does not (the planted leak of the negative control) and stays on its page until the reads are done.
   */
  constructor(private readonly readBodies = false) {}

  /** Records every response of the context, from now on. */
  attach(context: BrowserContext): void {
    context.on('response', (response) => {
      const task: Promise<void> = this.capture(response).finally(() => this.pending.delete(task));
      this.pending.add(task);
    });
  }

  /** Waits for every response seen so far to be read. Call it before judging what was recorded. */
  async settled(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }

  private async capture(response: PlaywrightResponse): Promise<void> {
    const request = response.request();
    const type = request.resourceType();
    const label = `${request.method()} ${pathOf(response.url())} (${type})`;
    try {
      const headers = await response.allHeaders();
      const body = this.readBodies && bodyIsReadable(response.status(), headers['content-type'] ?? '') ? await response.text() : null;
      this.responses.push({ label, url: response.url(), status: response.status(), headers, body });
    } catch (error) {
      this.unreadable.push(`${label}: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`);
    }
  }

  /** Records the answer of a direct call (`request.get`, `page.request.fetch`) or of a page's main document. */
  async recordApi(label: string, response: APIResponse): Promise<RecordedResponse> {
    const headers = response.headers();
    const body = bodyIsReadable(response.status(), headers['content-type'] ?? '') ? await response.text() : null;
    const recorded: RecordedResponse = { label, url: response.url(), status: response.status(), headers, body };
    this.responses.push(recorded);
    return recorded;
  }

  /** Records a file fetched by the browser itself (`fetchReferencedFiles`). Text only: a build file that is not text has nothing to scan. */
  recordFetched(label: string, url: string, answer: BrowserFetch): RecordedResponse {
    const body = bodyIsReadable(answer.status, answer.headers['content-type'] ?? '') ? answer.text : null;
    const recorded: RecordedResponse = { label, url, status: answer.status, headers: answer.headers, body };
    this.responses.push(recorded);
    return recorded;
  }

  /** Records the main document a `page.goto` got, read at once, so the page cannot be left before its body is read. */
  async recordNavigation(label: string, response: PlaywrightResponse | null): Promise<RecordedResponse> {
    if (response === null) throw new Error(`${label}: the navigation produced no response.`);
    const headers = await response.allHeaders();
    const body = bodyIsReadable(response.status(), headers['content-type'] ?? '') ? await response.text() : null;
    const recorded: RecordedResponse = { label, url: response.url(), status: response.status(), headers, body };
    this.responses.push(recorded);
    return recorded;
  }

  /** Responses of one kind, by the label the recorder gave them. */
  withLabelContaining(text: string): RecordedResponse[] {
    return this.responses.filter((response) => response.label.includes(text));
  }
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

/**
 * One GET made by the browser itself, from the page, with its cookies. A build file is asked for the way a person's browser asks, not
 * through the test runner's own HTTP client: that client reuses a socket the server may have closed while the test was busy, and a
 * request on such a socket waited for the whole of the test's time limit.
 */
async function fetchInBrowser(page: Page, url: string, init: BrowserRequest = { method: 'GET' }): Promise<BrowserFetch> {
  return page.evaluate(async ({ target, request }) => {
    const answer = await fetch(target, {
      method: request.method,
      credentials: 'same-origin',
      headers: { ...(request.body === undefined ? {} : { 'content-type': 'application/json' }), ...request.headers },
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    });
    const headers: Record<string, string> = {};
    answer.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });
    return { status: answer.status, headers, text: await answer.text() };
  }, { target: url, request: init });
}

/**
 * Fetches every script and style sheet that a recorded page, payload or script names and that has not been recorded yet, and
 * records it, until no new file is named. Returns how many it fetched. A chunk the browser loaded is already recorded and is
 * not asked for again.
 */
export async function fetchReferencedFiles(recorder: ScanRecorder, page: Page, origin: string): Promise<number> {
  const requested = new Set(recorder.responses.filter((response) => response.body !== null).map((response) => withoutQuery(response.url)));
  let fetched = 0;
  for (let round = 0; round < MAX_CRAWL_ROUNDS; round += 1) {
    const wanted = new Map<string, string>();
    for (const response of recorder.responses) {
      // A script or style sheet the browser loaded, recorded by its headers only: fetch it, so its text is scanned too.
      if (response.body === null && /\((?:script|stylesheet)\)$/.test(response.label) && !requested.has(withoutQuery(response.url))) {
        wanted.set(withoutQuery(response.url), response.url);
      }
      if (response.body === null) continue;
      for (const url of staticFileUrls(response.body, origin)) if (!requested.has(withoutQuery(url))) wanted.set(withoutQuery(url), url);
    }
    if (wanted.size === 0) return fetched;
    for (const [key, url] of wanted) {
      requested.add(key);
      recorder.recordFetched(`GET ${pathOf(url)} (referenced file)`, url, await fetchInBrowser(page, url));
      fetched += 1;
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
  return nonEmpty('Engineer pages', ROUTE_MANIFEST.filter((row) => row.kind === 'page' && isProtected(row) && allowsRole(row, 'ENGINEER')));
}

/** Every method of every API route an Engineer may call. */
export function engineerApiCalls(): ReadonlyArray<ApiCall> {
  return nonEmpty('Engineer API calls', callsOf(ROUTE_MANIFEST.filter((row) => row.kind === 'api' && isProtected(row) && allowsRole(row, 'ENGINEER'))));
}

/** Every method of every API route that does not list an Engineer: the Lead's and the Admin's. */
export function refusedApiCalls(): ReadonlyArray<ApiCall> {
  return nonEmpty('API calls an Engineer is refused', callsOf(ROUTE_MANIFEST.filter((row) => row.kind === 'api' && isProtected(row) && !allowsRole(row, 'ENGINEER'))));
}

/** The pages that do not list an Engineer. */
export function refusedPages(): ReadonlyArray<RouteRow> {
  return nonEmpty('pages an Engineer is refused', ROUTE_MANIFEST.filter((row) => row.kind === 'page' && isProtected(row) && !allowsRole(row, 'ENGINEER')));
}

/**
 * The valid call for a route (an ID that exists, a body that passes), from the recipes of the role matrix, so a story that adds a
 * route with a body adds it once. `targetId` is a person who is not the caller, for a route that changes someone.
 */
export function validCall(call: ApiCall, targetId: string): { readonly id: string; readonly body: unknown } {
  const { id, body } = validCallFor(call.method, call.row.path, { targetId });
  return { id, body };
}

/** A call made by the browser itself, recorded under `label`. A state-changing call carries the portal's own `Origin`, as it does from a page. */
export async function callInBrowser(recorder: ScanRecorder, page: Page, label: string, url: string, request: BrowserRequest = { method: 'GET' }): Promise<RecordedResponse> {
  return recorder.recordFetched(label, new URL(url, page.url()).toString(), await fetchInBrowser(page, url, request));
}
