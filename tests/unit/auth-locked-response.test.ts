import { describe, expect, it } from 'vitest';

import { withSignInStatus } from '@/server/auth/locked-response';

/** Architecture section 6: a blocked sign-in answers 429, every other refusal stays next-auth's 401. */

const json = (body: unknown, status: number, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('a blocked sign-in answers 429', () => {
  it('changes the status and keeps the body and the headers exactly', async () => {
    const original = json({ url: 'http://localhost:3000/sign-in?error=locked' }, 401, { 'X-Test': 'kept' });
    const result = await withSignInStatus(original);
    expect(result.status).toBe(429);
    expect(result.headers.get('X-Test')).toBe('kept');
    expect(result.headers.get('Content-Type')).toBe('application/json');
    expect(await result.json()).toEqual({ url: 'http://localhost:3000/sign-in?error=locked' });
  });

  it('reads a relative address too', async () => {
    expect((await withSignInStatus(json({ url: '/sign-in?error=locked&provider=credentials' }, 401))).status).toBe(429);
  });
});

describe('everything else is left alone', () => {
  it('an invalid sign-in stays 401', async () => {
    const result = await withSignInStatus(json({ url: 'http://localhost:3000/sign-in?error=CredentialsSignin' }, 401));
    expect(result.status).toBe(401);
  });

  it('an "unavailable" sign-in (the database was busy or down) answers 503, the retryable status of ruling R4 (QLT-34)', async () => {
    const result = await withSignInStatus(json({ url: '/sign-in?error=unavailable' }, 401, { 'X-Test': 'kept' }));
    expect(result.status).toBe(503);
    expect(result.headers.get('X-Test')).toBe('kept');
    expect(await result.json()).toEqual({ url: '/sign-in?error=unavailable' });
  });

  it('a reason that is only a property name of an object finds no status', async () => {
    expect((await withSignInStatus(json({ url: '/sign-in?error=constructor' }, 401))).status).toBe(401);
    expect((await withSignInStatus(json({ url: '/sign-in?error=toString' }, 401))).status).toBe(401);
  });

  it('a successful sign-in stays 200, even if the address mentions the word', async () => {
    expect((await withSignInStatus(json({ url: '/queue?error=locked' }, 200))).status).toBe(200);
  });

  it.each([
    ['a body that is not JSON', new Response('not json', { status: 401 })],
    ['JSON that is not an object', new Response('"locked"', { status: 401 })],
    ['an object with no address', json({ other: 1 }, 401)],
    ['an address that is not text', json({ url: 7 }, 401)],
    ['an address that cannot be read', json({ url: 'http://[bad' }, 401)],
  ])('%s stays 401', async (_name, response) => {
    expect((await withSignInStatus(response)).status).toBe(401);
  });

  it('does not use up the original body (it can be read after the check)', async () => {
    const original = json({ url: '/sign-in?error=CredentialsSignin' }, 401);
    const result = await withSignInStatus(original);
    expect(await result.json()).toEqual({ url: '/sign-in?error=CredentialsSignin' });
  });
});
