import { describe, expect, it } from 'vitest';

import { CUSTOMER_PAGE_ROUTE, makeRecordPaths } from '../../scripts/lib/js-budget-records';

/**
 * The record the JS budget check opens `/masters/customers/[id]` at (STORY-02.02, STORY-10.10 AC-2): made through the portal's API as the invented Admin;
 * when it cannot be made no path is returned, so the route fails with its reason, and the line that says why holds no credential. Every value is invented.
 */

const BASE = 'http://127.0.0.1:4999';
const CREDENTIALS = { email: 'invented-admin@example.test', password: 'invented-password-for-the-test' };
const SESSION_COOKIE = '__Secure-next-auth.session-token=invented-session';

interface Seen {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: string;
}

/** A portal that signs the Admin in and answers the POST as told. */
function portal(post: { readonly status: number; readonly body: unknown }, seen: Seen[] = []): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    seen.push({ url, method: init?.method ?? 'GET', headers: { ...(init?.headers as Record<string, string> | undefined) }, body: String(init?.body ?? '') });
    if (url.endsWith('/api/auth/csrf')) return new Response(JSON.stringify({ csrfToken: 'invented-csrf' }), { status: 200 });
    if (url.endsWith('/api/auth/callback/credentials')) return new Response('{}', { status: 200, headers: { 'set-cookie': `${SESSION_COOKIE}; Path=/` } });
    return new Response(JSON.stringify(post.body), { status: post.status });
  }) as typeof fetch;
}

describe('the records made for the dynamic routes of the JS budget check (STORY-02.02)', () => {
  it('adds one customer as the Admin and returns the path of its page under the route pattern', async () => {
    const seen: Seen[] = [];
    const recordPaths = await makeRecordPaths({ baseUrl: BASE, credentialsFor: (role) => (role === 'ADMIN' ? CREDENTIALS : undefined), fetchImpl: portal({ status: 201, body: { id: 'a b/1' } }, seen) });
    expect(recordPaths).toEqual({ [CUSTOMER_PAGE_ROUTE]: '/masters/customers/a%20b%2F1' });
    const post = seen.find((request) => request.url === `${BASE}/api/v1/customers`);
    expect(post?.method).toBe('POST');
    expect(post?.headers['cookie']).toContain('next-auth.session-token=invented-session');
    expect(post?.headers['origin']).toBe(BASE);
    expect(JSON.parse(post?.body ?? '{}')).toEqual({ name: expect.stringMatching(/^Budget check customer [0-9a-f-]{36}$/) });
  });

  it('makes no record, and does not sign in, when the check has no Admin credentials', async () => {
    const seen: Seen[] = [];
    expect(await makeRecordPaths({ baseUrl: BASE, credentialsFor: () => undefined, fetchImpl: portal({ status: 201, body: { id: 'x' } }, seen) })).toEqual({});
    expect(seen).toEqual([]);
  });

  it.each([
    ['the portal refuses the POST', { status: 403, body: {} }, /answered HTTP 403, not 201/],
    ['the answer has no ID', { status: 201, body: { name: 'x' } }, /did not answer with the customer's ID/],
  ])('makes no record when %s, and says which step failed without a credential or a cookie', async (_name, post, message) => {
    const lines: string[] = [];
    const recordPaths = await makeRecordPaths({ baseUrl: BASE, credentialsFor: () => CREDENTIALS, fetchImpl: portal(post), warn: (line) => lines.push(line) });
    expect(recordPaths).toEqual({});
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(message);
    expect(lines[0]).toContain(CUSTOMER_PAGE_ROUTE);
    expect(lines[0]).not.toContain(CREDENTIALS.password);
    expect(lines[0]).not.toContain('invented-session');
  });

  it('makes no record when the sign-in is refused, and names the step', async () => {
    const lines: string[] = [];
    const refused = (async (input: string | URL | Request): Promise<Response> =>
      String(input).endsWith('/api/auth/csrf') ? new Response(JSON.stringify({ csrfToken: 'invented-csrf' }), { status: 200 }) : new Response('{}', { status: 401 })) as typeof fetch;
    expect(await makeRecordPaths({ baseUrl: BASE, credentialsFor: () => CREDENTIALS, fetchImpl: refused, warn: (line) => lines.push(line) })).toEqual({});
    expect(lines[0]).toMatch(/sign-in was refused/);
    expect(lines[0]).not.toContain(CREDENTIALS.password);
  });
});
