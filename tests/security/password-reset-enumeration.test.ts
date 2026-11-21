import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defined } from '../support/defined';
import { createFakeResetWorld, NEW_PASSWORD, tokenOf, type FakeResetWorld } from '../support/fake-password-reset';

/**
 * STORY-09.07 AC-3, AC-4, AC-7 (FR-001, NFR-003; the review focus of the story): the two public routes tell a stranger nothing about which e-mails have accounts and nothing about a token.
 * Everything here is read from the answers the REAL routes give (the real `withPublicRoute`, the real service, in-memory repositories): a known e-mail, an unknown one, a deactivated person, an
 * e-mail in other letters and `FEATURE_EMAIL` off give the same status, the same body byte for byte and the same set of headers (only the request ID, which is new on every answer, differs);
 * the 429 reads the same for a known and an unknown address; a used, an expired, an unknown, a malformed and a deactivated person's token give one and the same 400; and the work behind a
 * request for a real person and for no one has one shape (the same operations in its transaction), so what the request does cannot be told by what it costs. Every address is invented.
 */

const ORIGIN = 'https://portal.example.test';
const holder = vi.hoisted(() => ({ service: undefined as unknown as import('@/server/services/password-reset-service').PasswordResetService }));

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/server/composition', () => ({ getPasswordResetService: () => holder.service }));

const { POST: FORGOT } = await import('@/app/api/v1/account/password/forgot/route');
const { POST: RESET } = await import('@/app/api/v1/account/password/reset/route');

const record = z.record(z.string(), z.unknown());
let world: FakeResetWorld;

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  world = createFakeResetWorld();
  holder.service = world.service;
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}): Request =>
  new Request(`${ORIGIN}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers }, body: JSON.stringify(body) });

const forgot = (email: string, address: string) => FORGOT(post('/api/v1/account/password/forgot', { email }, { 'x-forwarded-for': address }));
const reset = (token: string) => RESET(post('/api/v1/account/password/reset', { token, newPassword: NEW_PASSWORD }));

/** Everything an outsider sees of an answer, apart from the request ID, which is different on every answer by design. */
async function seenBy(response: Response): Promise<{ status: number; body: string; headers: Array<[string, string]> }> {
  const text = await response.text();
  const body = response.headers.get('content-type')?.includes('json') === true ? JSON.stringify(Object.fromEntries(Object.entries(record.parse(JSON.parse(text))).filter(([name]) => name !== 'requestId'))) : text;
  return { status: response.status, body, headers: [...response.headers.entries()].filter(([name]) => name !== 'x-request-id').sort(([a], [b]) => a.localeCompare(b)) };
}

describe('AC-3 (FR-001): a request tells nothing about the e-mail', () => {
  it('a known e-mail, an unknown one, a deactivated person and an e-mail in other letters: the same status, body and headers, byte for byte', async () => {
    const answers = [];
    for (const [index, email] of ['invented.person@example.test', 'nobody@example.test', 'invented.former@example.test', 'INVENTED.LEAD@Example.Test', 'another.nobody@example.test'].entries()) {
      answers.push(await seenBy(await forgot(email, `203.0.113.${index + 1}`)));
    }
    expect(answers[0]?.status).toBe(202);
    for (const answer of answers) expect(answer).toEqual(answers[0]);
    // The two known ones did make a link, the others did not: that is the difference, and it is only in the database and the mailbox.
    expect(world.tokens).toHaveLength(2);
  });

  it('FEATURE_EMAIL off gives the same answer as on, and makes nothing for anyone', async () => {
    const on = await seenBy(await forgot('invented.person@example.test', '203.0.113.1'));
    world.state.emailEnabled = false;
    expect(await seenBy(await forgot('invented.lead@example.test', '203.0.113.2'))).toEqual(on);
    expect(await seenBy(await forgot('nobody@example.test', '203.0.113.3'))).toEqual(on);
    expect(world.tokens).toHaveLength(1);
  });

  it('a malformed address is the same 422 for everyone, and says nothing about whether it would have matched', async () => {
    const answers = [];
    for (const email of ['not-an-email', 'invented.person@', '@example.test']) answers.push(await seenBy(await forgot(email, '203.0.113.9')));
    expect(answers[0]?.status).toBe(422);
    for (const answer of answers) expect(answer).toEqual(answers[0]);
    expect(world.tokens).toEqual([]);
  });
});

describe('what the work costs: one shape for a person and for no one', () => {
  it('the operations inside the transaction are two for a real person and two for an unknown or a deactivated one', async () => {
    await forgot('invented.person@example.test', '203.0.113.1');
    const known = [...world.statements];
    world.statements.length = 0;
    await forgot('nobody@example.test', '203.0.113.2');
    const unknown = [...world.statements];
    world.statements.length = 0;
    await forgot('invented.former@example.test', '203.0.113.3');
    const deactivated = [...world.statements];
    expect(known).toHaveLength(2);
    expect(unknown).toHaveLength(2);
    expect(deactivated).toHaveLength(2);
  });
});

describe('AC-4: the 429 tells nothing either', () => {
  it('the 6th request for a known and for an unknown e-mail: the same 429, with the same words', async () => {
    const refused = [];
    for (const [round, email] of ['invented.person@example.test', 'nobody@example.test'].entries()) {
      for (let count = 0; count < 5; count += 1) await forgot(email, `198.51.100.${round * 20 + count + 1}`);
      refused.push(await seenBy(await forgot(email, `198.51.100.${round * 20 + 19}`)));
    }
    expect(refused[0]?.status).toBe(429);
    expect(refused[1]).toEqual(refused[0]);
  });
});

describe('AC-7: a token tells nothing either', () => {
  it('a used, an unknown, a malformed, an expired and a deactivated person\'s token are one and the same 400', async () => {
    await forgot('invented.person@example.test', '203.0.113.1');
    const used = tokenOf(world.linkOfLastMessage());
    expect((await reset(used)).status).toBe(204);
    await forgot('invented.person@example.test', '203.0.113.2');
    const expired = tokenOf(world.linkOfLastMessage());
    await forgot('invented.lead@example.test', '203.0.113.3');
    const ofDeactivated = tokenOf(world.linkOfLastMessage());
    defined(world.users.records.find((record) => record.id === world.leadId)).isActive = false;

    const answers = [];
    for (const token of [used, 'A'.repeat(43), 'not-a-token', ofDeactivated]) answers.push(await seenBy(await reset(token)));
    world.clock.advance(60 * 60_000);
    answers.push(await seenBy(await reset(expired)));
    expect(answers[0]?.status).toBe(400);
    for (const answer of answers) expect(answer).toEqual(answers[0]);
  });
});
