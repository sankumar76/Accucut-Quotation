/**
 * The HTTP side of the JS budget check: ask the running portal for a page, as anonymous or signed in (STORY-10.10 AC-1).
 *
 * Sign-in is the portal's own, through next-auth's two endpoints (ADR-009): fetch the CSRF token, then post the
 * credentials. The session cookie is held here and sent back; nothing is written to disk and nothing about the
 * credentials is ever printed. `fetch` is injected so a test can answer without a network.
 */
import { z } from 'zod';

import type { Observation, PageFetcher, Viewer } from './js-budget-check';

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/** The credentials to sign in a role with, or `undefined` when none were provided. */
export type CredentialsProvider = (role: string) => Credentials | undefined;

export interface HttpOptions {
  readonly baseUrl: string;
  readonly credentialsFor: CredentialsProvider;
  readonly fetchImpl?: typeof fetch;
}

const REQUEST_TIMEOUT_MS = 30_000;
const CSRF_PATH = '/api/auth/csrf';
const CALLBACK_PATH = '/api/auth/callback/credentials';
const SESSION_COOKIE = /next-auth\.session-token/;
/** A made-up client address, set as the proxy would, so the sign-in's per-address counter never mixes with a person's. */
const INVENTED_CLIENT_ADDRESS = '198.51.100.169';

const csrfSchema = z.object({ csrfToken: z.string().min(1) });

type CookieJar = Map<string, string>;

function remember(jar: CookieJar, response: Response): void {
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';')[0] ?? '';
    const separator = pair.indexOf('=');
    if (separator > 0) jar.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
  }
}

function cookieHeader(jar: CookieJar): string {
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

function hasSession(jar: CookieJar): boolean {
  return [...jar].some(([name, value]) => SESSION_COOKIE.test(name) && value !== '');
}

/**
 * Signs in and returns the cookies to send afterwards. Throws a message that names the step and the HTTP status, never
 * a credential, when the portal does not start a session.
 */
export async function signIn(baseUrl: string, credentials: Credentials, fetchImpl: typeof fetch = fetch): Promise<string> {
  const jar: CookieJar = new Map();
  const common = { redirect: 'manual' as const, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
  const csrfResponse = await fetchImpl(`${baseUrl}${CSRF_PATH}`, { ...common, headers: { 'x-forwarded-for': INVENTED_CLIENT_ADDRESS } });
  if (csrfResponse.status !== 200) throw new Error(`sign-in could not start: ${CSRF_PATH} answered HTTP ${csrfResponse.status}`);
  const csrf = csrfSchema.safeParse(await csrfResponse.json());
  if (!csrf.success) throw new Error(`sign-in could not start: ${CSRF_PATH} did not return a token`);
  remember(jar, csrfResponse);

  const body = new URLSearchParams({
    csrfToken: csrf.data.csrfToken,
    email: credentials.email,
    password: credentials.password,
    callbackUrl: baseUrl,
    json: 'true',
  });
  const response = await fetchImpl(`${baseUrl}${CALLBACK_PATH}`, {
    ...common,
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader(jar), 'x-forwarded-for': INVENTED_CLIENT_ADDRESS },
    body,
  });
  remember(jar, response);
  if (!hasSession(jar)) throw new Error(`sign-in was refused: the portal answered HTTP ${response.status} and started no session`);
  return cookieHeader(jar);
}

/** A page fetcher that signs in once per role, the first time that role is needed. */
export function createPageFetcher(options: HttpOptions): PageFetcher {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sessions = new Map<string, Promise<string>>();

  const sessionFor = (viewer: Viewer): Promise<string> => {
    const known = sessions.get(viewer.name);
    if (known !== undefined) return known;
    const credentials = options.credentialsFor(viewer.name);
    if (credentials === undefined) {
      return Promise.reject(new Error(`no credentials were provided for the role ${viewer.name}, so its pages cannot be requested signed in`));
    }
    const started = signIn(options.baseUrl, credentials, fetchImpl);
    sessions.set(viewer.name, started);
    return started;
  };

  return async (path, viewer): Promise<Observation> => {
    const headers: Record<string, string> = { accept: 'text/html' };
    if (viewer.isSignedIn) headers['cookie'] = await sessionFor(viewer);
    const response = await fetchImpl(`${options.baseUrl}${path}`, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { status: response.status, html: await response.text(), location: response.headers.get('location') ?? undefined };
  };
}
