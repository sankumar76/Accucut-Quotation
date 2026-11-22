import { afterEach, describe, expect, it, vi } from 'vitest';

import { call, jsonOf, mustCall, openSession, UnexpectedReply, type Session } from '../perf/load/client';

/**
 * STORY-10.09 AC-1 and AC-10: the load script's HTTP client. `fetch` is replaced, so no network is used. The rules held: the portal's own Origin goes with every call (CSRF), the session cookie is kept and
 * replaced when the portal sends a new one, a timeout or a network failure is an answer of status 0 and not a throw, and no message holds a body or a credential.
 */

const BASE = 'http://portal.example.test:3000';

function session(cookies: Record<string, string> = { 'next-auth.session-token': 'abc' }): Session {
  return { baseUrl: BASE, label: 'user-1', cookies: new Map(Object.entries(cookies)) };
}

function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>): Array<{ url: string; init: RequestInit }> {
  const seen: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    seen.push({ url, init });
    return Promise.resolve(handler(url, init));
  });
  return seen;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AC-1: a call is timed as the client sees it and carries the cookie and the portal\'s own origin', () => {
  it('sends the cookies and the Origin, JSON with its content type, and reports status, size and a time', async () => {
    const seen = stubFetch(() => new Response('{"ok":true}', { status: 200 }));
    const reply = await call(session(), 'PATCH', '/api/v1/x', { json: { a: 1 } });
    expect(reply.status).toBe(200);
    expect(reply.bytes).toBe(11);
    expect(reply.ms).toBeGreaterThanOrEqual(0);
    expect(jsonOf(reply)).toEqual({ ok: true });
    const headers = seen[0]?.init.headers as Record<string, string>;
    expect(seen[0]?.url).toBe(`${BASE}/api/v1/x`);
    expect(headers['cookie']).toBe('next-auth.session-token=abc');
    expect(headers['origin']).toBe(BASE);
    expect(headers['content-type']).toBe('application/json');
    expect(seen[0]?.init.body).toBe('{"a":1}');
  });

  it('sends a multipart body as it is and leaves the content type to fetch (the boundary is its)', async () => {
    const seen = stubFetch(() => new Response('{}'));
    const form = new FormData();
    form.set('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'part-1.png');
    await call(session(), 'PUT', '/api/v1/estimates/e/nodes/n/image', { form });
    const headers = seen[0]?.init.headers as Record<string, string>;
    expect(seen[0]?.init.body).toBe(form);
    expect(headers['content-type']).toBeUndefined();
  });

  it('asks for HTML for a page and for JSON for the API', async () => {
    const seen = stubFetch(() => new Response('x'));
    await call(session(), 'GET', '/masters/customers/abc');
    await call(session(), 'GET', '/api/v1/customers');
    expect((seen[0]?.init.headers as Record<string, string>)['accept']).toBe('text/html');
    expect((seen[1]?.init.headers as Record<string, string>)['accept']).toBe('application/json');
  });

  it('sends no body and no content type for a read', async () => {
    const seen = stubFetch(() => new Response('[]'));
    await call(session(), 'GET', '/api/v1/tasks');
    const headers = seen[0]?.init.headers as Record<string, string>;
    expect(headers['content-type']).toBeUndefined();
    expect(seen[0]?.init.body).toBeUndefined();
  });

  it('keeps a new cookie the portal sends, replacing the same name and leaving the others (a password change sends one)', async () => {
    stubFetch(() => new Response(null, { status: 204, headers: [['set-cookie', 'next-auth.session-token=fresh; Path=/; HttpOnly'], ['set-cookie', 'other=1; Path=/']] }));
    const current = session({ 'next-auth.session-token': 'old', keep: 'me' });
    await call(current, 'POST', '/api/v1/account/password', { json: {} });
    expect(Object.fromEntries(current.cookies)).toEqual({ 'next-auth.session-token': 'fresh', keep: 'me', other: '1' });
  });
});

describe('AC-1: a failure is an answer of status 0, so the loop counts it and carries on', () => {
  it('reports a timeout as failure "timeout"', async () => {
    stubFetch(() => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')) as never);
    const reply = await call(session(), 'GET', '/api/v1/tasks');
    expect(reply).toMatchObject({ status: 0, failure: 'timeout', bytes: 0 });
  });

  it('reports any other failure as "network", with no message of the cause', async () => {
    stubFetch(() => Promise.reject(new TypeError('fetch failed')) as never);
    const reply = await call(session(), 'GET', '/api/v1/tasks');
    expect(reply).toMatchObject({ status: 0, failure: 'network' });
    expect(reply.body).toBe('');
  });
});

describe('AC-10: the set-up demands the expected status and says nothing of the body', () => {
  it('returns the reply on the expected status', async () => {
    stubFetch(() => new Response('{}', { status: 201 }));
    await expect(mustCall(session(), 'adding a customer', 'POST', '/api/v1/customers', 201)).resolves.toMatchObject({ status: 201 });
  });

  it('throws a message that names the call and both statuses and holds no part of the body', async () => {
    stubFetch(() => new Response('{"detail":"secret-value-123"}', { status: 422 }));
    const failure = await mustCall(session(), 'adding a customer', 'POST', '/api/v1/customers', 201).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(UnexpectedReply);
    expect((failure as Error).message).toBe('adding a customer answered HTTP 422, expected 201');
  });

  it('adds the code of the refusal when the answer is a problem with one, and never any other field of it', async () => {
    stubFetch(() => new Response('{"code":"PICTURE_TYPE","title":"secret-title","errors":[{"message":"secret-field"}]}', { status: 415 }));
    const failure = await mustCall(session(), 'adding picture 3', 'PUT', '/api/v1/x', 200).catch((error: unknown) => error);
    expect((failure as Error).message).toBe('adding picture 3 answered HTTP 415 (PICTURE_TYPE), expected 200');
  });

  it('ignores a code that is not an upper-case identifier', async () => {
    stubFetch(() => new Response('{"code":"a value with spaces 12345"}', { status: 500 }));
    const failure = await mustCall(session(), 'x', 'GET', '/api/v1/x', 200).catch((error: unknown) => error);
    expect((failure as Error).message).toBe('x answered HTTP 500, expected 200');
  });

  it('reads a body that is not JSON as undefined', async () => {
    stubFetch(() => new Response('<html>'));
    expect(jsonOf(await call(session(), 'GET', '/x'))).toBeUndefined();
  });
});

describe('AC-1: a session is opened by the sign-in the page makes, once, and its cookie is used afterwards', () => {
  it('fetches the CSRF token, posts the credentials, and keeps the session cookie; the message of a refusal names a step, not a credential', async () => {
    const seen = stubFetch((url) => {
      if (url.endsWith('/api/auth/csrf')) return Response.json({ csrfToken: 'csrf-1' }, { headers: { 'set-cookie': 'next-auth.csrf-token=c; Path=/' } });
      return new Response('{}', { status: 200, headers: { 'set-cookie': 'next-auth.session-token=sess; Path=/; HttpOnly' } });
    });
    const opened = await openSession(BASE, 'user-1', 'perf-admin@example.test', 'an-invented-password-1!');
    expect(opened.cookies.get('next-auth.session-token')).toBe('sess');
    expect(seen).toHaveLength(2);

    stubFetch((url) => (url.endsWith('/api/auth/csrf') ? Response.json({ csrfToken: 'csrf-1' }) : new Response('{}', { status: 401 })));
    const refusal = await openSession(BASE, 'user-1', 'perf-admin@example.test', 'an-invented-password-1!').catch((error: unknown) => error);
    expect((refusal as Error).message).toContain('sign-in was refused');
    expect((refusal as Error).message).not.toContain('an-invented-password-1!');
  });
});
