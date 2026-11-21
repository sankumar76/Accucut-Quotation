import { performance } from 'node:perf_hooks';

import { signIn } from '../../../scripts/lib/js-budget-http';

/**
 * The small HTTP client of the load script (STORY-10.09 AC-1, AC-10; test strategy 8.1 and 8.2). It uses `fetch` only, signs a person in the way the sign-in page does (the two calls of
 * `scripts/lib/js-budget-http.ts`), keeps the session cookie, sends the portal's own `Origin` with every call (a state-changing call from anywhere else is refused, CSRF), and times a
 * request as the client sees it: from just before `fetch` until the whole body has been read, which includes all the server's time. Nothing here prints a password or a cookie.
 */

/** A request that takes longer than this is a timeout, and counts as an error (NFR-011: no error and no timeout). */
export const REQUEST_TIMEOUT_MS = 30_000;

export type Failure = 'timeout' | 'network';

/** What came back, or what went wrong. `status` is 0 when the portal did not answer. */
export interface Reply {
  readonly status: number;
  /** Round trip in milliseconds. */
  readonly ms: number;
  /** The decoded size of the body (the body as the page code reads it, after the transport's compression is undone). */
  readonly bytes: number;
  readonly body: string;
  /** `performance.now()` at the moment the request left. */
  readonly startedAt: number;
  readonly failure?: Failure;
}

/** One signed-in person. The cookie changes when the portal sends a new one (a password change does). */
export interface Session {
  readonly baseUrl: string;
  readonly label: string;
  cookies: Map<string, string>;
}

function cookieHeader(cookies: ReadonlyMap<string, string>): string {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
}

function parseCookieHeader(header: string): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at > 0) cookies.set(part.slice(0, at).trim(), part.slice(at + 1).trim());
  }
  return cookies;
}

function keepNewCookies(session: Session, response: Response): void {
  for (const line of response.headers.getSetCookie()) {
    const pair = line.split(';')[0] ?? '';
    const at = pair.indexOf('=');
    if (at > 0) session.cookies.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
  }
}

/** Signs in and returns the session. The message of a failure names the step and the status, never a credential (`signIn`). */
export async function openSession(baseUrl: string, label: string, email: string, password: string): Promise<Session> {
  return { baseUrl, label, cookies: parseCookieHeader(await signIn(baseUrl, { email, password })) };
}

export interface CallOptions {
  /** A JSON body, for a call that sends one. */
  readonly json?: unknown;
  /** A multipart body (a picture). The content type, with its boundary, is set by `fetch`. */
  readonly form?: FormData;
}

/** One timed call. Never throws: a network failure or a timeout comes back as `status` 0 with the `failure`. */
export async function call(session: Session, method: string, path: string, options: CallOptions = {}): Promise<Reply> {
  const headers: Record<string, string> = { cookie: cookieHeader(session.cookies), origin: session.baseUrl, accept: path.startsWith('/api/') ? 'application/json' : 'text/html' };
  if (options.json !== undefined) headers['content-type'] = 'application/json';
  const init: RequestInit = { method, headers, redirect: 'manual', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
  if (options.json !== undefined) init.body = JSON.stringify(options.json);
  if (options.form !== undefined) init.body = options.form;
  const startedAt = performance.now();
  try {
    const response = await fetch(`${session.baseUrl}${path}`, init);
    const buffer = await response.arrayBuffer();
    const ms = performance.now() - startedAt;
    keepNewCookies(session, response);
    return { status: response.status, ms, bytes: buffer.byteLength, body: new TextDecoder().decode(buffer), startedAt };
  } catch (error) {
    const timedOut = error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return { status: 0, ms: performance.now() - startedAt, bytes: 0, body: '', startedAt, failure: timedOut ? 'timeout' : 'network' };
  }
}

/** The JSON of a reply, or `undefined` when the body is not JSON. */
export function jsonOf(reply: Reply): unknown {
  try {
    return JSON.parse(reply.body);
  } catch {
    return undefined;
  }
}

/** A status that is not the one expected, as a message that names the call and the status and holds no body (a body may carry a value). */
export class UnexpectedReply extends Error {
  constructor(what: string, status: number, expected: number) {
    super(`${what} answered HTTP ${status}, expected ${expected}`);
    this.name = 'UnexpectedReply';
  }
}

/** Calls and demands the expected status. Used by the set-up, where a wrong answer means the data is not what the run needs. */
export async function mustCall(session: Session, what: string, method: string, path: string, expected: number, options: CallOptions = {}): Promise<Reply> {
  const reply = await call(session, method, path, options);
  if (reply.status !== expected) throw new UnexpectedReply(what, reply.status, expected);
  return reply;
}
