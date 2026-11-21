import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { FORGOT_ACCEPTED_MESSAGE, RESET_LINK_INVALID_MESSAGE } from '@/lib/auth/password-reset';

import { defined } from '../support/defined';
import { createFakeResetWorld, NEW_PASSWORD, tokenOf, type FakeResetWorld } from '../support/fake-password-reset';

/**
 * STORY-09.07 AC-2 to AC-4 and AC-6 to AC-9, the contract of the two public routes through the real `withPublicRoute` and the real service over in-memory repositories: the same 202, the same body
 * and the same headers for a known e-mail, an unknown one, a deactivated person and `FEATURE_EMAIL` off; 422 for a malformed address for everyone alike; the 429; 204 with no body for a reset;
 * 400 and 422 with their words; the origin check; and that no log line holds a token, a password or an e-mail. Every name and address is invented.
 */

const ORIGIN = 'https://portal.example.test';
const logged = vi.hoisted(() => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }));
const holder = vi.hoisted(() => ({ service: undefined as unknown as import('@/server/services/password-reset-service').PasswordResetService }));

vi.mock('@/lib/logger', () => ({ logger: logged }));
vi.mock('@/server/composition', () => ({ getPasswordResetService: () => holder.service }));

const { POST: FORGOT } = await import('@/app/api/v1/account/password/forgot/route');
const { POST: RESET } = await import('@/app/api/v1/account/password/reset/route');

const record = z.record(z.string(), z.unknown());
let world: FakeResetWorld;

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  for (const method of Object.values(logged)) method.mockClear();
  world = createFakeResetWorld();
  holder.service = world.service;
});

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const forgot = (email: unknown, headers: Record<string, string> = {}) => FORGOT(post('/api/v1/account/password/forgot', { email }, headers));
const reset = (body: unknown) => RESET(post('/api/v1/account/password/reset', body));

describe('AC-2, AC-3: POST /api/v1/account/password/forgot', () => {
  it('is 202 with the one message, no-store, and a request ID', async () => {
    const response = await forgot('invented.person@example.test');
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ message: FORGOT_ACCEPTED_MESSAGE });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-request-id')).toMatch(/^req-[0-9a-f]{8}$/);
  });

  it('a malformed address is 422 under email, the same for everyone, and makes nothing', async () => {
    for (const email of ['not-an-email', '', '   ', 'a@b', `${'x'.repeat(250)}@example.test`, 42, null]) {
      const response = await forgot(email);
      expect(response.status).toBe(422);
      const body = record.parse(await response.json());
      expect(body['code']).toBe('VALIDATION_FAILED');
      expect(JSON.stringify(body['errors'])).toContain('"field":"email"');
    }
    expect(world.tokens).toEqual([]);
  });

  it('reads nothing but an e-mail: an extra key, a missing key and a body that is not JSON are refused', async () => {
    expect((await FORGOT(post('/api/v1/account/password/forgot', { email: 'invented.person@example.test', to: 'someone-else@example.test' }))).status).toBe(422);
    expect((await FORGOT(post('/api/v1/account/password/forgot', {}))).status).toBe(422);
    expect((await FORGOT(post('/api/v1/account/password/forgot', 'not json'))).status).toBe(400);
    expect(world.queued).toEqual([]);
  });

  it('nothing from the request becomes an address: the row names the person by ID, whatever the headers say', async () => {
    await forgot('invented.person@example.test', { host: 'evil.example', 'x-forwarded-host': 'evil.example', 'x-forwarded-for': '203.0.113.9' });
    const message = defined(world.queued[0]);
    expect(message.toUserId).toBe(world.personId);
    expect(world.linkOfLastMessage().startsWith(`${ORIGIN}/reset-password?token=`)).toBe(true);
    expect(JSON.stringify(message)).not.toContain('evil.example');
  });

  it('a request from another origin is refused before anything is read', async () => {
    const response = await forgot('invented.person@example.test', { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' });
    expect(response.status).toBe(403);
    expect(record.parse(await response.json())['code']).toBe('ORIGIN_REFUSED');
    expect(world.throttles.rows.size).toBe(0);
  });
});

describe('AC-4: the 429', () => {
  it('the 6th request from one address is 429 as a problem body, for a known and an unknown e-mail alike, whatever its first X-Forwarded-For entries say', async () => {
    const answers: number[] = [];
    for (let count = 0; count < 7; count += 1) {
      // Only the last entry is our proxy's; the earlier ones are forged and change on every request.
      answers.push((await forgot(`someone.${count}@example.test`, { 'x-forwarded-for': `10.0.0.${count}, 203.0.113.50` })).status);
    }
    expect(answers).toEqual([202, 202, 202, 202, 202, 429, 429]);
    const refused = await forgot('invented.person@example.test', { 'x-forwarded-for': '203.0.113.50' });
    expect(refused.status).toBe(429);
    const body = record.parse(await refused.json());
    expect(body).toMatchObject({ code: 'TOO_MANY_ATTEMPTS', status: 429, title: 'Too many requests. Try again in 15 minutes.' });
    expect(refused.headers.get('content-type')).toContain('application/problem+json');
    expect(world.tokens).toEqual([]);
  });
});

describe('AC-6 to AC-9: POST /api/v1/account/password/reset', () => {
  async function token(): Promise<string> {
    await forgot('invented.person@example.test');
    return tokenOf(world.linkOfLastMessage());
  }

  it('is 204 with no body, no-store and no cookie: the person signs in with the new password', async () => {
    const response = await reset({ token: await token(), newPassword: NEW_PASSWORD });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('a second use is 400 RESET_LINK_INVALID with the SCR-02 sentence', async () => {
    const valid = await token();
    await reset({ token: valid, newPassword: NEW_PASSWORD });
    const response = await reset({ token: valid, newPassword: NEW_PASSWORD });
    expect(response.status).toBe(400);
    expect(record.parse(await response.json())).toMatchObject({ code: 'RESET_LINK_INVALID', title: RESET_LINK_INVALID_MESSAGE, status: 400 });
  });

  it('a password that breaks the rule is 422 under newPassword and the same link then works', async () => {
    const valid = await token();
    const response = await reset({ token: valid, newPassword: 'short1!' });
    expect(response.status).toBe(422);
    expect(record.parse(await response.json())).toMatchObject({ code: 'PASSWORD_RULE', errors: [{ field: 'newPassword', message: 'The new password must be at least 10 characters.' }] });
    expect((await reset({ token: valid, newPassword: NEW_PASSWORD })).status).toBe(204);
  });

  it('is strict: a missing token, a missing password, an extra key and an empty body are refused', async () => {
    const valid = await token();
    for (const body of [{ newPassword: NEW_PASSWORD }, { token: valid }, { token: valid, newPassword: NEW_PASSWORD, userId: world.leadId }, {}]) {
      expect((await reset(body)).status).toBe(422);
    }
    expect((await RESET(post('/api/v1/account/password/reset', ''))).status).toBe(400);
  });

  it('a request from another origin is refused, and the link is not used', async () => {
    const valid = await token();
    const response = await RESET(post('/api/v1/account/password/reset', { token: valid, newPassword: NEW_PASSWORD }, { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }));
    expect(response.status).toBe(403);
    expect(defined(world.tokens[0]).usedAt).toBeNull();
  });
});

describe('AC-9: what the logs hold', () => {
  it('a whole flow writes no log line with the token, the new password, the e-mail or the address; the one line of the reset has the user ID and the request ID', async () => {
    const email = 'invented.person@example.test';
    await forgot(email, { 'x-forwarded-for': '203.0.113.77' });
    const valid = tokenOf(world.linkOfLastMessage());
    await reset({ token: valid, newPassword: 'short1!' });
    await reset({ token: 'A'.repeat(43), newPassword: NEW_PASSWORD });
    const response = await reset({ token: valid, newPassword: NEW_PASSWORD });
    await reset({ token: valid, newPassword: NEW_PASSWORD });

    const lines = Object.values(logged).flatMap((method) => method.mock.calls.map((call) => JSON.stringify(call)));
    const everything = lines.join('\n');
    for (const secret of [valid, NEW_PASSWORD, email, '203.0.113.77', 'hash:']) expect(everything).not.toContain(secret);
    expect(logged.info.mock.calls).toHaveLength(1);
    expect(logged.info.mock.calls[0]?.[0]).toEqual({ requestId: response.headers.get('x-request-id'), userId: world.personId });
    expect(logged.info.mock.calls[0]?.[1]).toBe('A person reset their password with an e-mailed link.');
  });

  it('a fault of ours is logged by kind and request ID only, and answered with the generic words', async () => {
    holder.service = world.build({ resets: { findRequester: () => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.9 invented.person@example.test')) } });
    const response = await forgot('invented.person@example.test');
    expect(response.status).toBe(500);
    expect(record.parse(await response.json())['title']).toBe('Something went wrong on our side.');
    const everything = JSON.stringify(logged.error.mock.calls);
    expect(everything).not.toContain('ECONNREFUSED');
    expect(everything).not.toContain('invented.person@example.test');
  });
});
