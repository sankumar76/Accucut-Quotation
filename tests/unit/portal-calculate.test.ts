import { afterEach, describe, expect, it, vi } from 'vitest';

import { calculateOverHttp, signInOverHttp } from '../../scripts/lib/portal-calculate';

/**
 * G8-C-NFR9: the two calls that make the calculated estimate of the Lighthouse run (`scripts/seed-lighthouse-data.ts`), over a stubbed `fetch`: the sign-in is the CSRF token and then the
 * credentials, the cookies of the first answer go with the second call, and a refusal or a status other than 200 fails with no password or cookie in the message.
 */

const ORIGIN = 'http://localhost:3000';
const ESTIMATE_ID = '00000000-0000-4000-8000-000000000001';

function answer(body: unknown, init: { readonly status?: number; readonly cookies?: ReadonlyArray<string> } = {}): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  for (const cookie of init.cookies ?? []) headers.append('set-cookie', cookie);
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

interface Call {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function stubFetch(...answers: ReadonlyArray<Response>): Call[] {
  const calls: Call[] = [];
  const queue = [...answers];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const next = queue.shift();
      if (next === undefined) throw new Error('fetch was called more often than the test expected');
      return Promise.resolve(next);
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signInOverHttp', () => {
  it('asks for the CSRF token, posts the credentials with the cookie of the first answer and returns the cookies of the session', async () => {
    const calls = stubFetch(
      answer({ csrfToken: 'token-1' }, { cookies: ['authjs.csrf-token=abc%7Cdef; Path=/; HttpOnly'] }),
      answer({ url: `${ORIGIN}/queue` }, { cookies: ['authjs.session-token=session-1; Path=/; HttpOnly', 'authjs.callback-url=x; Path=/'] }),
    );
    const jar = await signInOverHttp(ORIGIN, 'someone@example.test', 'invented-password');

    expect(calls.map((call) => call.url)).toEqual([`${ORIGIN}/api/auth/csrf`, `${ORIGIN}/api/auth/callback/credentials`]);
    const post = calls[1]?.init;
    expect(post?.method).toBe('POST');
    expect(post?.headers).toMatchObject({ cookie: 'authjs.csrf-token=abc%7Cdef', origin: ORIGIN });
    const form = new URLSearchParams(String(post?.body));
    expect(Object.fromEntries(form)).toEqual({ csrfToken: 'token-1', email: 'someone@example.test', password: 'invented-password', json: 'true' });
    expect(Object.fromEntries(jar)).toEqual({ 'authjs.csrf-token': 'abc%7Cdef', 'authjs.session-token': 'session-1', 'authjs.callback-url': 'x' });
  });

  it('fails when the token call is refused or is not a token, without naming a value', async () => {
    stubFetch(answer({}, { status: 500 }));
    await expect(signInOverHttp(ORIGIN, 'someone@example.test', 'invented-password')).rejects.toThrow('The sign-in of the measurement Engineer was refused.');
    stubFetch(answer({ nothing: true }));
    await expect(signInOverHttp(ORIGIN, 'someone@example.test', 'invented-password')).rejects.toThrow('refused');
  });

  it('fails when the portal names an error in the address it answers with, and the message holds neither the password nor the e-mail', async () => {
    stubFetch(answer({ csrfToken: 't' }), answer({ url: `${ORIGIN}/sign-in?error=CredentialsSignin` }));
    const failure = await signInOverHttp(ORIGIN, 'someone@example.test', 'invented-password').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    const message = failure instanceof Error ? failure.message : '';
    expect(message).toBe('The sign-in of the measurement Engineer was refused.');
    expect(message).not.toContain('invented-password');
    expect(message).not.toContain('someone@example.test');
  });

  it('fails when the credentials call itself is not a success', async () => {
    stubFetch(answer({ csrfToken: 't' }), answer({ url: `${ORIGIN}/queue` }, { status: 403 }));
    await expect(signInOverHttp(ORIGIN, 'someone@example.test', 'invented-password')).rejects.toThrow('refused');
  });

  it('ignores a Set-Cookie line that has no name', async () => {
    stubFetch(answer({ csrfToken: 't' }, { cookies: ['=novalue', 'plain'] }), answer({ url: `${ORIGIN}/queue` }, { cookies: ['session=1'] }));
    expect(Object.fromEntries(await signInOverHttp(ORIGIN, 'someone@example.test', 'invented-password'))).toEqual({ session: '1' });
  });
});

describe('calculateOverHttp', () => {
  it('posts Calculate for the estimate with the session cookies and the portal\'s own origin', async () => {
    const calls = stubFetch(answer({}));
    await calculateOverHttp(ORIGIN, new Map([['session', '1'], ['other', '2']]), ESTIMATE_ID);
    expect(calls[0]?.url).toBe(`${ORIGIN}/api/v1/estimates/${ESTIMATE_ID}/calculate`);
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.headers).toEqual({ cookie: 'session=1; other=2', origin: ORIGIN });
  });

  it('fails with the status when the portal does not answer 200', async () => {
    stubFetch(answer({}, { status: 409 }));
    await expect(calculateOverHttp(ORIGIN, new Map(), ESTIMATE_ID)).rejects.toThrow('Calculate answered 409, not 200.');
  });
});
