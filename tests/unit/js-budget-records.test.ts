import { describe, expect, it } from 'vitest';

import { CUSTOMER_PAGE_ROUTE, ESTIMATE_PAGE_ROUTE, makeRecordPaths } from '../../scripts/lib/js-budget-records';

/**
 * The records the JS budget check opens its dynamic routes at (STORY-02.02 and STORY-05.01, STORY-10.10 AC-2): made through the portal's API as the invented Admin
 * (a customer; an Engineer and one task for them); when one cannot be made no path is returned for its route, so the route fails with its reason, and the line
 * that says why holds no credential. Every value is invented.
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

interface Answer {
  readonly status: number;
  readonly body: unknown;
}

const OK: Readonly<Record<string, Answer>> = {
  '/api/v1/customers': { status: 201, body: { id: 'a b/1' } },
  '/api/v1/users': { status: 201, body: { id: 'invented-engineer-id' } },
  '/api/v1/tasks': { status: 201, body: { code: 'Q-2026-0007' } },
};

/** A portal that signs the Admin in and answers each POST as told (`OK` unless overridden by path). */
function portal(overrides: Readonly<Record<string, Answer>> = {}, seen: Seen[] = []): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    seen.push({ url, method: init?.method ?? 'GET', headers: { ...(init?.headers as Record<string, string> | undefined) }, body: String(init?.body ?? '') });
    if (url.endsWith('/api/auth/csrf')) return new Response(JSON.stringify({ csrfToken: 'invented-csrf' }), { status: 200 });
    if (url.endsWith('/api/auth/callback/credentials')) return new Response('{}', { status: 200, headers: { 'set-cookie': `${SESSION_COOKIE}; Path=/` } });
    const answer = { ...OK, ...overrides }[new URL(url).pathname];
    return new Response(JSON.stringify(answer?.body ?? {}), { status: answer?.status ?? 404 });
  }) as typeof fetch;
}

const post = (seen: ReadonlyArray<Seen>, path: string): Seen | undefined => seen.find((request) => request.url === `${BASE}${path}`);

describe('the records made for the dynamic routes of the JS budget check', () => {
  it('adds one customer as the Admin and returns the path of its page under the route pattern (STORY-02.02)', async () => {
    const seen: Seen[] = [];
    const recordPaths = await makeRecordPaths({ baseUrl: BASE, credentialsFor: (role) => (role === 'ADMIN' ? CREDENTIALS : undefined), fetchImpl: portal({}, seen) });
    expect(recordPaths[CUSTOMER_PAGE_ROUTE]).toBe('/masters/customers/a%20b%2F1');
    const request = post(seen, '/api/v1/customers');
    expect(request?.method).toBe('POST');
    expect(request?.headers['cookie']).toContain('next-auth.session-token=invented-session');
    expect(request?.headers['origin']).toBe(BASE);
    expect(JSON.parse(request?.body ?? '{}')).toEqual({ name: expect.stringMatching(/^Budget check customer [0-9a-f-]{36}$/) });
  });

  it('adds an Engineer, assigns them one task, and returns the path of the workspace under the route pattern (STORY-05.01)', async () => {
    const seen: Seen[] = [];
    const recordPaths = await makeRecordPaths({ baseUrl: BASE, credentialsFor: () => CREDENTIALS, fetchImpl: portal({}, seen) });
    expect(recordPaths[ESTIMATE_PAGE_ROUTE]).toBe('/estimates/Q-2026-0007');
    const user = JSON.parse(post(seen, '/api/v1/users')?.body ?? '{}');
    expect(user).toEqual({
      name: expect.stringMatching(/^Budget check engineer [0-9a-f-]{36}$/),
      email: expect.stringMatching(/^budget-check-[0-9a-f-]{36}@example\.test$/),
      role: 'ENGINEER',
      password: expect.stringMatching(/^[0-9a-f-]{36}-Aa1!$/),
    });
    const task = JSON.parse(post(seen, '/api/v1/tasks')?.body ?? '{}');
    expect(task).toEqual({ engineerId: 'invented-engineer-id', folderPath: '\\\\budget-check-server\\budget-check-share\\RFQ-budget', deadline: '2099-01-01T10:00', title: 'Budget check task', notes: 'Invented.' });
    for (const path of ['/api/v1/users', '/api/v1/tasks']) {
      expect(post(seen, path)?.headers['cookie']).toContain('next-auth.session-token=invented-session');
      expect(post(seen, path)?.headers['origin']).toBe(BASE);
    }
  });

  it('signs in once for all the records', async () => {
    const seen: Seen[] = [];
    await makeRecordPaths({ baseUrl: BASE, credentialsFor: () => CREDENTIALS, fetchImpl: portal({}, seen) });
    expect(seen.filter((request) => request.url.endsWith('/api/auth/callback/credentials'))).toHaveLength(1);
  });

  it('makes no record, and does not sign in, when the check has no Admin credentials', async () => {
    const seen: Seen[] = [];
    expect(await makeRecordPaths({ baseUrl: BASE, credentialsFor: () => undefined, fetchImpl: portal({}, seen) })).toEqual({});
    expect(seen).toEqual([]);
  });

  it.each([
    ['the portal refuses the customer POST', '/api/v1/customers', { status: 403, body: {} }, CUSTOMER_PAGE_ROUTE, /answered HTTP 403, not 201/],
    ['the customer answer has no ID', '/api/v1/customers', { status: 201, body: { name: 'x' } }, CUSTOMER_PAGE_ROUTE, /did not answer with the customer's ID/],
    ['the portal refuses to add the Engineer', '/api/v1/users', { status: 422, body: {} }, ESTIMATE_PAGE_ROUTE, /POST \/api\/v1\/users answered HTTP 422, not 201/],
    ['the Engineer answer has no ID', '/api/v1/users', { status: 201, body: {} }, ESTIMATE_PAGE_ROUTE, /did not answer with the Engineer's ID/],
    ['the portal refuses the task', '/api/v1/tasks', { status: 422, body: {} }, ESTIMATE_PAGE_ROUTE, /POST \/api\/v1\/tasks answered HTTP 422, not 201/],
    ['the task answer has no code', '/api/v1/tasks', { status: 201, body: { id: 'x' } }, ESTIMATE_PAGE_ROUTE, /did not answer with the task's code/],
  ])('makes no record for the route when %s, says which step failed without a credential or a cookie, and still makes the other route\'s', async (_name, path, answer, route, message) => {
    const lines: string[] = [];
    const recordPaths = await makeRecordPaths({ baseUrl: BASE, credentialsFor: () => CREDENTIALS, fetchImpl: portal({ [path]: answer }), warn: (line) => lines.push(line) });
    expect(recordPaths[route]).toBeUndefined();
    expect(Object.keys(recordPaths)).toHaveLength(1);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(message);
    expect(lines[0]).toContain(route);
    expect(lines[0]).not.toContain(CREDENTIALS.password);
    expect(lines[0]).not.toContain('invented-session');
  });

  it('makes no record when the sign-in is refused, and names the step and each route', async () => {
    const lines: string[] = [];
    const refused = (async (input: string | URL | Request): Promise<Response> =>
      String(input).endsWith('/api/auth/csrf') ? new Response(JSON.stringify({ csrfToken: 'invented-csrf' }), { status: 200 }) : new Response('{}', { status: 401 })) as typeof fetch;
    expect(await makeRecordPaths({ baseUrl: BASE, credentialsFor: () => CREDENTIALS, fetchImpl: refused, warn: (line) => lines.push(line) })).toEqual({});
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/sign-in was refused/);
    expect(lines[0]).toContain(CUSTOMER_PAGE_ROUTE);
    expect(lines[1]).toContain(ESTIMATE_PAGE_ROUTE);
    for (const line of lines) expect(line).not.toContain(CREDENTIALS.password);
  });
});
