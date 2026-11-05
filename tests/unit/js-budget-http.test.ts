import { describe, expect, it } from 'vitest';

import { ANONYMOUS } from '../../scripts/lib/js-budget-check';
import { createPageFetcher, signIn, type Credentials } from '../../scripts/lib/js-budget-http';

/**
 * STORY-10.10 AC-1: the sign-in used for routes that ask for one. A fake `fetch` answers like next-auth's two endpoints,
 * so no network is used. The credentials are invented.
 */

const BASE = 'http://localhost:3999';
const CREDENTIALS: Credentials = { email: 'measure@example.test', password: 'invented-measurement-password' };
const VIEWER = { name: 'ADMIN', isSignedIn: true } as const;

interface RecordedRequest {
  readonly url: string;
  readonly method: string;
  readonly cookie: string | undefined;
  readonly body: string | undefined;
  readonly redirect: string | undefined;
}

function responseWith(status: number, body: string, cookies: ReadonlyArray<string> = [], headers: Record<string, string> = {}): Response {
  const response = new Response(body, { status, headers });
  for (const cookie of cookies) response.headers.append('set-cookie', cookie);
  return response;
}

/** Answers the two auth endpoints like next-auth; any other path is a page that echoes who asked. */
function portal(options: { readonly csrfStatus?: number; readonly startSession?: boolean } = {}): { fetchImpl: typeof fetch; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    requests.push({
      url,
      method: init?.method ?? 'GET',
      cookie: headers.get('cookie') ?? undefined,
      body: init?.body === undefined ? undefined : String(init.body),
      redirect: init?.redirect,
    });
    if (url.endsWith('/api/auth/csrf')) {
      return responseWith(options.csrfStatus ?? 200, JSON.stringify({ csrfToken: 'invented-csrf-token' }), ['__Host-next-auth.csrf-token=invented-csrf-token%7Chash; Path=/; HttpOnly; Secure; SameSite=Lax']);
    }
    if (url.endsWith('/api/auth/callback/credentials')) {
      const cookies = options.startSession === false ? [] : ['__Secure-next-auth.session-token=invented-session; Path=/; HttpOnly; Secure; SameSite=Lax'];
      return responseWith(200, JSON.stringify({ url: BASE }), cookies);
    }
    return responseWith(headers.has('cookie') ? 200 : 307, '<html></html>', [], headers.has('cookie') ? {} : { location: '/sign-in' });
  };
  return { fetchImpl, requests };
}

describe('signIn', () => {
  it('fetches the CSRF token, posts the credentials with the token cookie, and returns the cookies to send afterwards', async () => {
    const { fetchImpl, requests } = portal();
    const cookie = await signIn(BASE, CREDENTIALS, fetchImpl);
    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([`GET ${BASE}/api/auth/csrf`, `POST ${BASE}/api/auth/callback/credentials`]);
    const form = new URLSearchParams(requests[1]?.body);
    expect(form.get('csrfToken')).toBe('invented-csrf-token');
    expect(form.get('email')).toBe(CREDENTIALS.email);
    expect(form.get('json')).toBe('true');
    expect(requests[1]?.cookie).toBe('__Host-next-auth.csrf-token=invented-csrf-token%7Chash');
    expect(requests.every((request) => request.redirect === 'manual')).toBe(true);
    expect(cookie).toBe('__Host-next-auth.csrf-token=invented-csrf-token%7Chash; __Secure-next-auth.session-token=invented-session');
  });

  it('throws, without the password, when the portal starts no session', async () => {
    const error = await signIn(BASE, CREDENTIALS, portal({ startSession: false }).fetchImpl).catch((caught: unknown) => caught);
    const message = error instanceof Error ? error.message : '(not an error)';
    expect(message).toBe('sign-in was refused: the portal answered HTTP 200 and started no session');
    expect(message).not.toContain(CREDENTIALS.password);
  });

  it('throws when the CSRF endpoint does not answer 200, or does not return a token', async () => {
    await expect(signIn(BASE, CREDENTIALS, portal({ csrfStatus: 500 }).fetchImpl)).rejects.toThrow('/api/auth/csrf answered HTTP 500');
    const noToken = async (): Promise<Response> => responseWith(200, JSON.stringify({ nothing: true }));
    await expect(signIn(BASE, CREDENTIALS, noToken)).rejects.toThrow('did not return a token');
  });
});

describe('createPageFetcher', () => {
  it('asks as the anonymous viewer without a cookie, and does not follow a redirect', async () => {
    const { fetchImpl, requests } = portal();
    const fetchPage = createPageFetcher({ baseUrl: BASE, credentialsFor: () => CREDENTIALS, fetchImpl });
    const answer = await fetchPage('/queue', ANONYMOUS);
    expect(answer).toEqual({ status: 307, html: '<html></html>', location: '/sign-in' });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ url: `${BASE}/queue`, cookie: undefined, redirect: 'manual' });
  });

  it('signs in once for a role, the first time it is needed, and sends the session with every page after', async () => {
    const { fetchImpl, requests } = portal();
    const fetchPage = createPageFetcher({ baseUrl: BASE, credentialsFor: (role) => (role === 'ADMIN' ? CREDENTIALS : undefined), fetchImpl });
    expect((await fetchPage('/queue', VIEWER)).status).toBe(200);
    expect((await fetchPage('/', VIEWER)).status).toBe(200);
    expect(requests.filter((request) => request.url.endsWith('/callback/credentials'))).toHaveLength(1);
    expect(requests.at(-1)?.cookie).toContain('__Secure-next-auth.session-token=invented-session');
  });

  it('fails, naming the role but no credential, when no credentials were provided for it', async () => {
    const { fetchImpl } = portal();
    const fetchPage = createPageFetcher({ baseUrl: BASE, credentialsFor: () => undefined, fetchImpl });
    await expect(fetchPage('/queue', { name: 'LEAD', isSignedIn: true })).rejects.toThrow('no credentials were provided for the role LEAD');
  });

  it('uses the global fetch when none is given', () => {
    expect(typeof createPageFetcher({ baseUrl: BASE, credentialsFor: () => undefined })).toBe('function');
  });
});
