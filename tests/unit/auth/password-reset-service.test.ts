import { beforeEach, describe, expect, it } from 'vitest';

import { FORGOT_ACCEPTED_MESSAGE, RESET_LINK_INVALID_CODE, RESET_LINK_INVALID_MESSAGE } from '@/lib/auth/password-reset';
import { FieldValidationError, ResetLinkInvalidError, TooManyAttemptsError } from '@/lib/errors';
import { MILLISECONDS_PER_MINUTE } from '@/lib/time';
import { generateResetToken, hashResetToken } from '@/server/auth/reset-token';
import { accountThrottleKey, passwordChangeThrottleKey, resetAddressThrottleKey, resetRequestThrottleKey, stepUpThrottleKey } from '@/server/auth/throttle-key';

import { defined } from '../../support/defined';
import { APP_ORIGIN, createFakeResetWorld, NEW_PASSWORD, OLD_PASSWORD, RESET_KEY_SECRET, tokenOf, type FakeResetWorld } from '../../support/fake-password-reset';
import { refusal } from '../../support/user-service-fixture';

/**
 * STORY-09.07 AC-1 to AC-4 and AC-6 to AC-8 at the level of the rules, over in-memory repositories and a controlled clock: what a request makes (one token and one outbox row for an
 * active person, nothing for anyone else or with the switch off), that the work has the same shape for every address, the limits on the address and the typed e-mail, and the use of a link
 * (single use, 60 minutes, the rule, the person the claim named). The same rules run against PostgreSQL in `tests/integration/auth/password-reset.test.ts`. Every name and password is invented.
 */

const MINUTE = MILLISECONDS_PER_MINUTE;
const PERSON_EMAIL = 'invented.person@example.test';
const IP = '203.0.113.7';

let world: FakeResetWorld;

beforeEach(() => {
  world = createFakeResetWorld();
});

const request = (email: string, ipAddress: string | null = IP) => world.service.requestReset({ email, ipAddress });
const person = () => defined(world.users.records.find((record) => record.id === world.personId));

/** Asks for a link as the person and returns the raw token, as their mailbox would show it. */
async function linkToken(email = PERSON_EMAIL): Promise<string> {
  await request(email);
  return tokenOf(world.linkOfLastMessage());
}

describe('AC-2: a request for an active person', () => {
  it('makes one token (only its SHA-256 stored, 60 minutes) and one outbox row in the same transaction', async () => {
    await request(PERSON_EMAIL);
    const row = defined(world.tokens[0]);
    expect(world.tokens).toHaveLength(1);
    expect(world.queued).toHaveLength(1);
    expect(world.statements).toEqual(['issue', 'enqueue']);

    const token = tokenOf(world.linkOfLastMessage());
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(row.tokenHash).toBe(hashResetToken(token));
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.userId).toBe(world.personId);
    expect(row.expiresAt.getTime() - world.clock.now().getTime()).toBe(60 * MINUTE);
  });

  it('queues the password-reset event to the person BY ID, never an address, with the token row\'s expiry as send_before and the link from APP_ORIGIN', async () => {
    await request(PERSON_EMAIL);
    const message = defined(world.queued[0]);
    const row = defined(world.tokens[0]);
    expect(message).toMatchObject({
      idempotencyKey: `password-reset:${row.id}`,
      event: 'password-reset',
      toUserId: world.personId,
      ccUserIds: [],
      sendBefore: row.expiresAt,
    });
    expect(message.subject).toBe('Reset your password');
    expect(world.linkOfLastMessage().startsWith(`${APP_ORIGIN}/reset-password?token=`)).toBe(true);
    for (const text of [message.subject, message.bodyHtml, message.bodyText, JSON.stringify(message)]) {
      expect(text).not.toContain(PERSON_EMAIL);
    }
    // The message greets the person by name and holds no password.
    expect(message.bodyText).toContain('Hello Invented Person');
    expect(message.bodyHtml).not.toContain(OLD_PASSWORD);
  });

  it('finds the person whatever the letter case and spacing of the typed e-mail, and sends nothing to an address from the request', async () => {
    await request('  INVENTED.Person@EXAMPLE.test ');
    expect(world.queued).toHaveLength(1);
    expect(defined(world.queued[0]).toUserId).toBe(world.personId);
  });

  it('is sent whatever the alerts switch says: the service never reads it', async () => {
    // The service has no dependency on the switch at all (FR-019 limits it to FR-081 to FR-084), so there is nothing to turn off.
    await request(PERSON_EMAIL);
    expect(world.queued).toHaveLength(1);
  });

  it('a second request makes a second token and a second row, each with its own key', async () => {
    await request(PERSON_EMAIL);
    await request(PERSON_EMAIL);
    expect(world.tokens).toHaveLength(2);
    expect(new Set(world.queued.map((message) => message.idempotencyKey)).size).toBe(2);
    expect(world.tokens[0]?.tokenHash).not.toBe(world.tokens[1]?.tokenHash);
  });
});

describe('AC-1 (decision D-1): FEATURE_EMAIL off', () => {
  it('answers as always but makes no token and no outbox row, for a known and an unknown address alike', async () => {
    world.state.emailEnabled = false;
    await expect(request(PERSON_EMAIL)).resolves.toBeUndefined();
    await expect(request('nobody@example.test')).resolves.toBeUndefined();
    expect(world.tokens).toEqual([]);
    expect(world.queued).toEqual([]);
    expect(world.statements).toEqual([]);
  });

  it('asks for the switch at every request, so turning it on needs no restart', async () => {
    world.state.emailEnabled = false;
    await request(PERSON_EMAIL);
    world.state.emailEnabled = true;
    await request(PERSON_EMAIL);
    expect(world.tokens).toHaveLength(1);
  });
});

describe('AC-3: no way to tell which e-mails exist', () => {
  it.each([
    ['an address nobody has', 'nobody@example.test'],
    ['a person who is deactivated', 'invented.former@example.test'],
  ])('%s: the request resolves as for anyone, with no token and no row', async (_name, email) => {
    await expect(request(email)).resolves.toBeUndefined();
    expect(world.tokens).toEqual([]);
    expect(world.queued).toEqual([]);
  });

  it('does the same number of operations in its transaction for a person and for no one (the work has one shape)', async () => {
    await request(PERSON_EMAIL, '203.0.113.1');
    const known = [...world.statements];
    world.statements.length = 0;
    await request('nobody@example.test', '203.0.113.2');
    await request('invented.former@example.test', '203.0.113.3');
    expect(known).toHaveLength(2);
    expect(world.statements).toHaveLength(4);
    // Each unknown or deactivated request is two operations, as the known one is.
    expect(world.statements).toEqual(['simulateIssue-1', 'simulateIssue-2', 'simulateIssue-1', 'simulateIssue-2']);
  });

  it('counts a known and an unknown typed e-mail on keys that are hashes, so neither the address nor the e-mail is stored', async () => {
    await request(PERSON_EMAIL, IP);
    await request('nobody@example.test', IP);
    const keys = [...world.throttles.rows.keys()];
    expect(keys).toHaveLength(3);
    for (const key of keys) {
      expect(key).toMatch(/^[0-9a-f]{64}$/);
      expect(key).not.toContain(IP);
    }
    expect(keys).toContain(resetAddressThrottleKey(RESET_KEY_SECRET, IP));
    expect(keys).toContain(resetRequestThrottleKey(RESET_KEY_SECRET, PERSON_EMAIL));
    expect(keys).toContain(resetRequestThrottleKey(RESET_KEY_SECRET, 'nobody@example.test'));
  });
});

describe('AC-4: the limit of 5 in 15 minutes, on the typed e-mail and on the address', () => {
  it.each([
    ['a known e-mail', PERSON_EMAIL],
    ['an unknown e-mail', 'nobody@example.test'],
  ])('the 6th request for %s is 429, with no extra token and no extra row', async (_name, email) => {
    for (let count = 0; count < 5; count += 1) await request(email, `203.0.113.${count + 10}`);
    const made = world.tokens.length;
    const queued = world.queued.length;
    const error = await refusal(request(email, '203.0.113.99'));
    expect(error).toBeInstanceOf(TooManyAttemptsError);
    expect(error).toMatchObject({ httpStatus: 429, code: 'TOO_MANY_ATTEMPTS' });
    expect(world.tokens).toHaveLength(made);
    expect(world.queued).toHaveLength(queued);
  });

  it('is the same count for a known and an unknown e-mail: 5 allowed, the 6th refused, whichever it is', async () => {
    const outcomes: Record<string, string[]> = { known: [], unknown: [] };
    for (const [label, email] of [['known', PERSON_EMAIL], ['unknown', 'nobody@example.test']] as const) {
      for (let count = 0; count < 7; count += 1) {
        outcomes[label]?.push(await request(email, `198.51.100.${count + (label === 'known' ? 1 : 50)}`).then(() => 'ok', () => '429'));
      }
    }
    expect(outcomes['known']).toEqual(outcomes['unknown']);
    expect(outcomes['known']).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', '429', '429']);
  });

  it('the 6th request from one address is 429 whatever e-mail it types', async () => {
    for (let count = 0; count < 5; count += 1) await request(`someone.${count}@example.test`);
    await expect(request('another@example.test')).rejects.toBeInstanceOf(TooManyAttemptsError);
  });

  it('a refusal on the typed e-mail gives the address its place back, so a flood for one e-mail does not use up an office\'s address', async () => {
    for (let count = 0; count < 5; count += 1) await request(PERSON_EMAIL, `203.0.113.${count + 20}`);
    await expect(request(PERSON_EMAIL, '203.0.113.200')).rejects.toBeInstanceOf(TooManyAttemptsError);
    expect(world.throttles.rows.get(resetAddressThrottleKey(RESET_KEY_SECRET, '203.0.113.200'))?.failures).toBe(0);
  });

  it('works again once the 15 minutes have passed', async () => {
    for (let count = 0; count < 5; count += 1) await request(PERSON_EMAIL, `203.0.113.${count + 30}`);
    await expect(request(PERSON_EMAIL, '203.0.113.130')).rejects.toBeInstanceOf(TooManyAttemptsError);
    world.clock.advance(15 * MINUTE + 1);
    await expect(request(PERSON_EMAIL, '203.0.113.131')).resolves.toBeUndefined();
  });

  it('uses keys of its own, so it never blocks sign-in, the step-up or the change form, and they never block it', async () => {
    const signInKey = accountThrottleKey(RESET_KEY_SECRET, PERSON_EMAIL);
    world.throttles.rows.set(signInKey, { failures: 99, windowStartedAt: world.clock.now(), blockedUntil: new Date(world.clock.now().getTime() + 15 * MINUTE) });
    await expect(request(PERSON_EMAIL)).resolves.toBeUndefined();
    for (let count = 0; count < 5; count += 1) await request(PERSON_EMAIL, `203.0.113.${count + 40}`).catch(() => undefined);
    expect(world.throttles.rows.get(signInKey)?.failures).toBe(99);
    expect(world.throttles.rows.has(stepUpThrottleKey(RESET_KEY_SECRET, world.personId))).toBe(false);
    expect(world.throttles.rows.has(passwordChangeThrottleKey(RESET_KEY_SECRET, world.personId))).toBe(false);
  });

  it('gives the reservations back after a fault of ours, so a server problem never counts against anyone', async () => {
    const failing = world.build({ resets: { findRequester: () => Promise.reject(new Error('the database is down')) } });
    await expect(failing.requestReset({ email: PERSON_EMAIL, ipAddress: IP })).rejects.toThrow('the database is down');
    for (const row of world.throttles.rows.values()) expect(row.failures).toBe(0);
  });
});

describe('AC-6, AC-7: using a link', () => {
  it('sets the new password, clears must_change_password, raises session_version, marks the token used and lifts the three blocks', async () => {
    const token = await linkToken();
    const before = person().sessionVersion;
    const blocked = { failures: 5, windowStartedAt: world.clock.now(), blockedUntil: new Date(world.clock.now().getTime() + 15 * MINUTE) };
    for (const key of [accountThrottleKey(RESET_KEY_SECRET, PERSON_EMAIL), passwordChangeThrottleKey(RESET_KEY_SECRET, world.personId), stepUpThrottleKey(RESET_KEY_SECRET, world.personId)]) {
      world.throttles.rows.set(key, { ...blocked });
    }

    await expect(world.service.resetPassword({ token, newPassword: NEW_PASSWORD })).resolves.toEqual({ userId: world.personId });
    expect(person()).toMatchObject({ passwordHash: `hash:${NEW_PASSWORD}`, mustChangePassword: false, sessionVersion: before + 1 });
    expect(defined(world.tokens[0]).usedAt).toEqual(world.clock.now());
    for (const key of [accountThrottleKey(RESET_KEY_SECRET, PERSON_EMAIL), passwordChangeThrottleKey(RESET_KEY_SECRET, world.personId), stepUpThrottleKey(RESET_KEY_SECRET, world.personId)]) {
      expect(world.throttles.rows.get(key)).toMatchObject({ failures: 0, blockedUntil: null });
    }
  });

  it('marks the person\'s other unused links used in the same transaction, so an older link cannot be used after a newer one', async () => {
    const older = await linkToken();
    const newer = await linkToken();
    await world.service.resetPassword({ token: newer, newPassword: NEW_PASSWORD });
    expect(world.tokens.every((row) => row.usedAt !== null)).toBe(true);
    await expect(world.service.resetPassword({ token: older, newPassword: 'Another9#password' })).rejects.toBeInstanceOf(ResetLinkInvalidError);
    expect(person().passwordHash).toBe(`hash:${NEW_PASSWORD}`);
  });

  it('a second use is 400 RESET_LINK_INVALID with the SCR-02 sentence, nothing changes, and no password is hashed for it', async () => {
    const token = await linkToken();
    await world.service.resetPassword({ token, newPassword: NEW_PASSWORD });
    const version = person().sessionVersion;
    world.hasher.hashed.length = 0;
    const error = await refusal(world.service.resetPassword({ token, newPassword: 'Another9#password' }));
    expect(error).toBeInstanceOf(ResetLinkInvalidError);
    expect(error).toMatchObject({ httpStatus: 400, code: RESET_LINK_INVALID_CODE, message: RESET_LINK_INVALID_MESSAGE });
    expect(person()).toMatchObject({ passwordHash: `hash:${NEW_PASSWORD}`, sessionVersion: version });
    expect(world.hasher.hashed).toEqual([]);
  });

  it('works at 59 minutes and is refused at 60, to the millisecond', async () => {
    const early = await linkToken();
    world.clock.advance(59 * MINUTE + 59_999);
    await expect(world.service.resetPassword({ token: early, newPassword: NEW_PASSWORD })).resolves.toBeDefined();

    world = createFakeResetWorld();
    const late = await linkToken();
    world.clock.advance(60 * MINUTE);
    await expect(world.service.resetPassword({ token: late, newPassword: NEW_PASSWORD })).rejects.toMatchObject({ code: RESET_LINK_INVALID_CODE });
    expect(person().passwordHash).toBe(`hash:${OLD_PASSWORD}`);
  });

  it('an expired, a used, an unknown and a malformed token all give the identical refusal', async () => {
    const used = await linkToken();
    await world.service.resetPassword({ token: used, newPassword: NEW_PASSWORD });
    const expired = await linkToken();
    world.clock.advance(61 * MINUTE);
    const unknown = generateResetToken().token;
    const answers = [];
    for (const token of [used, expired, unknown, 'short', '', 'x'.repeat(43), `${unknown}extra`]) {
      const error = await refusal(world.service.resetPassword({ token, newPassword: NEW_PASSWORD }));
      answers.push(JSON.stringify({ name: (error as Error).name, code: (error as ResetLinkInvalidError).code, status: (error as ResetLinkInvalidError).httpStatus, message: (error as Error).message }));
    }
    expect(new Set(answers).size).toBe(1);
  });

  it('refuses the link of a person who was deactivated after it was made, and changes nothing', async () => {
    const token = await linkToken();
    person().isActive = false;
    const version = person().sessionVersion;
    await expect(world.service.resetPassword({ token, newPassword: NEW_PASSWORD })).rejects.toMatchObject({ code: RESET_LINK_INVALID_CODE });
    expect(person()).toMatchObject({ passwordHash: `hash:${OLD_PASSWORD}`, sessionVersion: version });
    expect(defined(world.tokens[0]).usedAt).toBeNull();
  });

  it('two requests at once with one token: exactly one succeeds and one is 400 RESET_LINK_INVALID', async () => {
    const token = await linkToken();
    const results = await Promise.allSettled([
      world.service.resetPassword({ token, newPassword: NEW_PASSWORD }),
      world.service.resetPassword({ token, newPassword: 'Another9#password' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((result) => result.status === 'rejected');
    expect(failed).toMatchObject({ reason: { code: RESET_LINK_INVALID_CODE, httpStatus: 400 } });
    expect(person().sessionVersion).toBe(1);
  });

  it('sets the password of the person THE CLAIM NAMED, never one read before it (the stale-read pattern of GitHub issue 509)', async () => {
    const token = await linkToken();
    // The read says one person; by the time the claim runs the statement names another. Only the claim decides.
    const racing = world.build({ resets: { claim: (_tx, _hash, now) => { defined(world.tokens[0]).usedAt = now; return Promise.resolve(world.leadId); } } });
    await expect(racing.resetPassword({ token, newPassword: NEW_PASSWORD })).resolves.toEqual({ userId: world.leadId });
    const lead = defined(world.users.records.find((record) => record.id === world.leadId));
    expect(lead.passwordHash).toBe(`hash:${NEW_PASSWORD}`);
    expect(person().passwordHash).toBe(`hash:${OLD_PASSWORD}`);
  });
});

describe('AC-8: a password that breaks the rule keeps the link', () => {
  it.each([
    ['too short', 'Ab1!', 'The new password must be at least 10 characters.'],
    ['no number or symbol', 'abcdefghijklmnop', 'Add at least one number and one symbol, such as ! # $ or %.'],
    ['the e-mail, in capitals', 'INVENTED.PERSON@EXAMPLE.TEST', 'The password cannot be the same as your e-mail address.'],
    ['too common', 'Password123!', 'That password is too common. Choose a different one.'],
  ])('%s: 422 under newPassword naming the part; the token is not consumed and no hash is made', async (_name, password, message) => {
    const token = await linkToken();
    const error = await refusal(world.service.resetPassword({ token, newPassword: password }));
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({ httpStatus: 422, code: 'PASSWORD_RULE', fields: [{ field: 'newPassword', message }] });
    expect(defined(world.tokens[0]).usedAt).toBeNull();
    expect(world.hasher.hashed).toEqual([]);
    expect(person().passwordHash).toBe(`hash:${OLD_PASSWORD}`);
    // And the same link still works with a good one, within its hour.
    await expect(world.service.resetPassword({ token, newPassword: NEW_PASSWORD })).resolves.toBeDefined();
  });

  it('names the rule only for a link that works: a token that does not work is 400 whatever the password', async () => {
    await expect(world.service.resetPassword({ token: generateResetToken().token, newPassword: 'x' })).rejects.toMatchObject({ code: RESET_LINK_INVALID_CODE });
  });
});

describe('isLinkUsable: what the page reads', () => {
  it('is true for a link that works, and claims nothing', async () => {
    const token = await linkToken();
    await expect(world.service.isLinkUsable(token)).resolves.toBe(true);
    await expect(world.service.isLinkUsable(token)).resolves.toBe(true);
    expect(defined(world.tokens[0]).usedAt).toBeNull();
  });

  it('is false for a used, an expired, an unknown and a malformed token', async () => {
    const used = await linkToken();
    await world.service.resetPassword({ token: used, newPassword: NEW_PASSWORD });
    const expired = await linkToken();
    world.clock.advance(60 * MINUTE);
    for (const token of [used, expired, generateResetToken().token, '', 'abc']) await expect(world.service.isLinkUsable(token)).resolves.toBe(false);
  });

  it('property: no token other than the issued one validates (500 random tokens and 500 near misses)', async () => {
    const token = await linkToken();
    for (let count = 0; count < 500; count += 1) {
      const other = generateResetToken().token;
      expect(other).not.toBe(token);
      expect(await world.service.isLinkUsable(other)).toBe(false);
    }
    for (let index = 0; index < 43; index += 1) {
      const flipped = `${token.slice(0, index)}${token[index] === 'A' ? 'B' : 'A'}${token.slice(index + 1)}`;
      expect(await world.service.isLinkUsable(flipped)).toBe(false);
      expect(await world.service.isLinkUsable(`${token.slice(0, index)}${token.slice(index + 1)}`)).toBe(false);
    }
    expect(await world.service.isLinkUsable(token)).toBe(true);
  });
});

describe('AC-9: no secret in what the service throws', () => {
  it('no error holds the token, the password or the e-mail', async () => {
    const token = await linkToken();
    const errors = [
      await refusal(world.service.resetPassword({ token, newPassword: 'Ab1!' })),
      await refusal(world.service.resetPassword({ token: generateResetToken().token, newPassword: NEW_PASSWORD })),
    ];
    for (const error of errors) {
      const text = JSON.stringify(error) + String((error as Error).message) + String((error as Error).stack);
      expect(text).not.toContain(token);
      expect(text).not.toContain(NEW_PASSWORD);
      expect(text).not.toContain(PERSON_EMAIL);
    }
    expect(FORGOT_ACCEPTED_MESSAGE).not.toContain('@');
  });
});
