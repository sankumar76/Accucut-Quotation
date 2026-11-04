import { describe, expect, it } from 'vitest';

import { signInWithPassword, signOutOfPortal } from '@/lib/auth/auth-client';

/**
 * The browser's two calls to next-auth's routes (STORY-01.01 AC-1, AC-2, AC-3, AC-4). A scripted `fetch` answers for
 * the server, and the calls it received are checked: the CSRF token comes first, then the post, as next-auth requires.
 */

interface Call {
  readonly url: string;
  readonly method: string;
  readonly body: URLSearchParams | undefined;
}

type Answer = Response | Error;

function scripted(answers: ReadonlyArray<Answer>): { readonly doFetch: typeof fetch; readonly calls: Call[] } {
  const calls: Call[] = [];
  let index = 0;
  const doFetch: typeof fetch = (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: init?.body instanceof URLSearchParams ? init.body : undefined,
    });
    const answer = answers[index];
    index += 1;
    if (answer === undefined) return Promise.reject(new Error('Unexpected request.'));
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  return { doFetch, calls };
}

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const csrf = (): Response => json({ csrfToken: 'invented-csrf-token' });

describe('signInWithPassword', () => {
  it('asks for a CSRF token, then posts the e-mail and password with it, and reports a sign-in', async () => {
    const { doFetch, calls } = scripted([csrf(), json({ url: 'http://localhost:3000/queue' })]);
    expect(await signInWithPassword('a@example.test', 'pw', doFetch)).toEqual({ status: 'signed-in' });
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual(['GET /api/auth/csrf', 'POST /api/auth/callback/credentials']);
    expect(Object.fromEntries(calls[1]?.body ?? [])).toEqual({
      csrfToken: 'invented-csrf-token',
      email: 'a@example.test',
      password: 'pw',
      json: 'true',
    });
  });

  it.each([
    ['the one generic refusal (401)', json({ url: 'http://localhost:3000/sign-in?error=CredentialsSignin' }, 401), 'CredentialsSignin'],
    ['a block (429)', json({ url: '/sign-in?error=locked' }, 429), 'locked'],
    ['"could not be checked" (401)', json({ url: '/sign-in?error=unavailable' }, 401), 'unavailable'],
  ])('reports %s with the reason the server named', async (_name, answer, error) => {
    const { doFetch } = scripted([csrf(), answer]);
    expect(await signInWithPassword('a@example.test', 'pw', doFetch)).toEqual({ status: 'refused', error });
  });

  it.each([
    ['no CSRF token (a server fault)', [json({}, 500)]],
    ['a CSRF answer that is not JSON', [new Response('<html>', { status: 200 })]],
    ['a CSRF answer without a token', [json({ other: 1 })]],
    ['a network failure at the CSRF call', [new Error('offline')]],
    ['a network failure at the post', [csrf(), new Error('offline')]],
    ['a server fault with a page instead of JSON', [csrf(), new Response('<html>oops</html>', { status: 502 })]],
    ['a success answer with no address', [csrf(), json({ ok: true })]],
    ['a 500 with JSON that names no reason', [csrf(), json({ message: 'x' }, 500)]],
  ])('reports "failed", never "signed in", for %s', async (_name, answers) => {
    const { doFetch } = scripted(answers);
    expect(await signInWithPassword('a@example.test', 'pw', doFetch)).toEqual({ status: 'failed' });
  });

  it('reports an unreadable address in the answer as no reason, so it is not a refusal it understands', async () => {
    const { doFetch } = scripted([csrf(), json({ url: 'http://[bad' }, 401)]);
    expect(await signInWithPassword('a@example.test', 'pw', doFetch)).toEqual({ status: 'failed' });
  });
});

describe('signOutOfPortal', () => {
  it('asks for a CSRF token and posts it to sign out', async () => {
    const { doFetch, calls } = scripted([csrf(), json({ url: 'http://localhost:3000/sign-in' })]);
    expect(await signOutOfPortal(doFetch)).toBe(true);
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual(['GET /api/auth/csrf', 'POST /api/auth/signout']);
    expect(Object.fromEntries(calls[1]?.body ?? [])).toEqual({ csrfToken: 'invented-csrf-token', json: 'true' });
  });

  it.each([
    ['a refused post', [csrf(), json({}, 403)]],
    ['no CSRF token', [json({}, 500)]],
    ['a network failure at the CSRF call', [new Error('offline')]],
    ['a network failure at the post', [csrf(), new Error('offline')]],
  ])('answers false for %s, so the page does not pretend the person is signed out', async (_name, answers) => {
    const { doFetch } = scripted(answers);
    expect(await signOutOfPortal(doFetch)).toBe(false);
  });
});
