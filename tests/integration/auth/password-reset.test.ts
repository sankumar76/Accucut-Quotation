import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { RESET_LINK_INVALID_CODE } from '@/lib/auth/password-reset';
import { createFixedClock, MILLISECONDS_PER_MINUTE, type FixedClock } from '@/lib/time';
import { runOutboxSend } from '@/server/jobs/outbox-send';
import { resolveSession } from '@/server/auth/resolve-session-user';
import { createMailService } from '@/server/mail/mail-service';
import { createMailer } from '@/server/mail/send';
import { createEmailOutboxRepository } from '@/server/repositories/email-outbox-repository';
import { createPasswordResetRepository, type PasswordResetRepository } from '@/server/repositories/password-reset-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createAuthService } from '@/server/services/auth-service';
import { createPasswordResetService, type PasswordResetService } from '@/server/services/password-reset-service';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { insertUser, createTestHasher } from '../../support/builders/user';
import { defined } from '../../support/defined';
import { openMailCapture, type CapturedMail, type MailCapture } from '../../support/mail-capture';
import { refusal } from '../../support/user-service-fixture';

/**
 * STORY-09.07 against real PostgreSQL in a throwaway database and a capturing mail server (Mailpit when the run has one): the reset by e-mailed link from the request to a new sign-in. What only the
 * database and the real mail path can prove: the token row holds a hash and nothing else, the outbox row names the person by ID and is blanked once it is sent, the single-use claim is one atomic
 * statement (two posts at once give one 204), the 60 minutes are exact, the new password replaces the old at sign-in and ends the old sessions, the limit is counted on hashed keys, a deactivated
 * person's link is refused with the claim rolled back, no audit row is written, and the runtime role cannot delete a link. The clock is controlled. Every name, address and password is invented.
 */

const ORIGIN = 'https://portal.example.test';
const KEY_SECRET = 'invented-throttle-key-material';
const OLD = 'Tn4#vLm8@Qz-current';
const NEW = 'Pr9$kWd3!Rx-fresh';
const START = new Date('2026-11-21T10:00:00.000Z');
const MINUTE = MILLISECONDS_PER_MINUTE;
const hasher = createTestHasher();

const logged = vi.hoisted(() => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }));
const holder = vi.hoisted(() => ({ service: undefined as unknown as import('@/server/services/password-reset-service').PasswordResetService }));
vi.mock('@/lib/logger', () => ({ logger: logged }));
vi.mock('@/server/composition', () => ({ getPasswordResetService: () => holder.service }));

let db: AuthDatabase;
let capture: MailCapture;
let clock: FixedClock;
let resets: PasswordResetRepository;
let service: PasswordResetService;
let flag = { emailEnabled: true };
let counter = 0;
const RUN_TAG = `${process.pid}-${Date.now() % 100_000}`;

/** The service over the real repositories, the real mail service and the real throttle, with `overrides` for a racing repository. */
function buildService(overrides: Partial<PasswordResetRepository> = {}, users = db.users): PasswordResetService {
  return createPasswordResetService({
    resets: { ...resets, ...overrides },
    users,
    throttles: db.throttles,
    hasher,
    transactions: createTransactionRunner(db.prisma),
    mail: createMailService({ outbox: createEmailOutboxRepository(db.prisma), mailer: createMailer(capture.transport), clock }),
    clock,
    keySecret: KEY_SECRET,
    appOrigin: () => ORIGIN,
    emailEnabled: () => flag.emailEnabled,
  });
}

beforeAll(async () => {
  db = await openAuthDatabase();
  resets = createPasswordResetRepository(db.prisma);
  capture = openMailCapture();
  vi.stubEnv('APP_ORIGIN', ORIGIN);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await capture.close();
  await db.close();
});

beforeEach(async () => {
  clock = createFixedClock(START);
  flag = { emailEnabled: true };
  service = buildService();
  holder.service = service;
  await db.owner.query("UPDATE settings SET alerts_enabled = false, sender_name = 'Accucut Portal', sender_mailbox = 'portal@example.com' WHERE id = 1");
  // The worker claims at most 25 rows a run: an earlier test's rows must not stand between this one's row and the send.
  await db.owner.query('DELETE FROM email_outbox');
  for (const method of Object.values(logged)) method.mockClear();
});

/** A person with a password and an address of their own (a shared Mailpit is searched by address). */
async function person(label: string, active = true) {
  counter += 1;
  const made = await insertUser(db.users, hasher, { email: `${label}.${RUN_TAG}.${counter}@example.com`, name: `Invented ${label}`, password: OLD, mustChangePassword: true });
  if (!active) await db.owner.query('UPDATE users SET is_active = false WHERE id = $1::uuid', [made.id]);
  return made;
}

/** A client address that no other call of this file has used, so the limit of 5 per address never carries from one test to the next (the throttle table lives as long as the database). */
let nextAddress = 0;
const freshAddress = (): string => {
  nextAddress += 1;
  return `10.${Math.floor(nextAddress / 250)}.${nextAddress % 250}.9`;
};

const ask = (email: string, ipAddress: string | null = freshAddress()) => service.requestReset({ email, ipAddress });

/** Runs the worker's job once, as the minute tick does. */
const sendQueued = () => runOutboxSend({ store: createEmailOutboxRepository(db.prisma), mailer: createMailer(capture.transport), clock, log: () => undefined, jobRuns: { recordRun: () => Promise.resolve() } });

async function mailTo(address: string): Promise<CapturedMail> {
  const mails = (await capture.list()).filter((mail) => mail.to.includes(address));
  return defined(mails.at(-1), `a message to ${address}`);
}

/** The token in the e-mailed link, as the person's mailbox shows it. */
function tokenIn(mail: CapturedMail): string {
  const link = defined(/https:\/\/\S+\/reset-password\?token=[A-Za-z0-9_-]+/.exec(mail.text)?.[0], 'the link in the text part');
  expect(mail.html).toContain(link);
  return defined(new URL(link).searchParams.get('token'));
}

/** Asks, sends and reads the link: the whole path a person takes to a token. */
async function emailedToken(address: string): Promise<string> {
  await ask(address);
  await sendQueued();
  return tokenIn(await mailTo(address));
}

interface TokenRow {
  readonly id: string;
  readonly token_hash: string;
  readonly user_id: string;
  readonly expires_at: Date;
  readonly used_at: Date | null;
  readonly created_at: Date;
}
const tokenRows = async (userId: string): Promise<TokenRow[]> =>
  (await db.owner.query<TokenRow>('SELECT id::text, token_hash, user_id::text, expires_at, used_at, created_at FROM password_reset_tokens WHERE user_id = $1::uuid ORDER BY created_at, id', [userId])).rows;
const outboxRows = async (userId: string) =>
  (await db.owner.query<{ idempotency_key: string; event: string; status: string; last_error: string | null; send_before: Date | null; body_html: string; body_text: string; to_user_id: string; cc_user_ids: string[] }>(
    'SELECT idempotency_key, event, status, last_error, send_before, body_html, body_text, to_user_id::text, cc_user_ids::text[] FROM email_outbox WHERE to_user_id = $1::uuid ORDER BY created_at, id',
    [userId],
  )).rows;
const userRow = async (id: string) =>
  defined((await db.owner.query<{ password_hash: string; session_version: number; must_change_password: boolean }>('SELECT password_hash, session_version, must_change_password FROM users WHERE id = $1::uuid', [id])).rows[0]);

describe('AC-2: a request for an active person', () => {
  it('writes ONE token (hash only, expiring in 60 minutes) and ONE outbox row in the same transaction, naming the person by ID', async () => {
    const { id, email } = await person('request');
    await ask(email);
    const [token, ...moreTokens] = await tokenRows(id);
    const [row, ...moreRows] = await outboxRows(id);
    expect(moreTokens).toEqual([]);
    expect(moreRows).toEqual([]);
    expect(defined(token)).toMatchObject({ user_id: id, used_at: null });
    expect(defined(token).token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(defined(token).expires_at.getTime() - START.getTime()).toBe(60 * MINUTE);
    expect(defined(row)).toMatchObject({ event: 'password-reset', status: 'pending', last_error: null, to_user_id: id, cc_user_ids: [], idempotency_key: `password-reset:${defined(token).id}` });
    expect(defined(row).send_before).toEqual(defined(token).expires_at);
    // The row holds the person's ID and no address: the address is read from users when it is sent (NFR-028).
    expect(JSON.stringify(row)).not.toContain(email);
  });

  it('is sent by the worker, whatever the alerts switch says, to the person\'s own address from the database, and the body of the row is emptied', async () => {
    const { id, email } = await person('send');
    await db.owner.query('UPDATE settings SET alerts_enabled = false WHERE id = 1');
    await ask(email);
    const [queued] = await outboxRows(id);
    // Until it is sent the row holds the link, which holds the token.
    expect(defined(queued).body_text).toContain('/reset-password?token=');

    expect(await sendQueued()).toMatchObject({ claimed: 1, sent: 1, skipped: 0, failed: 0 });
    const mail = await mailTo(email);
    expect(mail.to).toEqual([email]);
    expect(mail.subject).toBe('Reset your password');
    expect(mail.text).toContain('Hello Invented send');
    expect(mail.text).toContain('works once and for 60 minutes');
    expect(mail.text).not.toContain(OLD);
    const token = tokenIn(mail);

    const [sent] = await outboxRows(id);
    expect(defined(sent)).toMatchObject({ status: 'sent', body_html: '', body_text: '' });
    // AC-9: the raw token is in the e-mail and nowhere in the database.
    const everything = await db.owner.query<{ text: string }>("SELECT (SELECT coalesce(string_agg(t::text, ' '), '') FROM password_reset_tokens t) || ' ' || (SELECT coalesce(string_agg(o::text, ' '), '') FROM email_outbox o) AS text");
    expect(defined(everything.rows[0]).text).not.toContain(token);
  });

  it('a person who is no longer active when the row is claimed gets no mail: the row is skipped NO_RECIPIENT and its body is emptied', async () => {
    const { id, email } = await person('gone-after');
    await ask(email);
    await db.owner.query('UPDATE users SET is_active = false WHERE id = $1::uuid', [id]);
    await sendQueued();
    expect(defined((await outboxRows(id))[0])).toMatchObject({ status: 'skipped', last_error: 'NO_RECIPIENT', body_html: '', body_text: '' });
    expect((await capture.list()).filter((mail) => mail.to.includes(email))).toEqual([]);
  });

  it('a row whose 4th send fails (the mail server cannot be reached) is failed for good, with a class code and no body: the link does not outlive its chance to be sent', async () => {
    const { id, email } = await person('fails-for-good');
    await ask(email);
    await db.owner.query("UPDATE email_outbox SET attempts = 3 WHERE to_user_id = $1::uuid AND event = 'password-reset'", [id]);
    const unreachable = { sendMail: () => Promise.reject(Object.assign(new Error(`connect ECONNREFUSED 10.9.8.7:587 ${email}`), { code: 'ECONNREFUSED' })) };
    expect(await runOutboxSend({ store: createEmailOutboxRepository(db.prisma), mailer: createMailer(unreachable), clock, log: () => undefined, jobRuns: { recordRun: () => Promise.resolve() } })).toMatchObject({ failed: 1, sent: 0 });
    const [row] = await outboxRows(id);
    expect(defined(row)).toMatchObject({ status: 'failed', last_error: 'CONNECTION', body_html: '', body_text: '' });
    expect(JSON.stringify(row)).not.toContain(email);
  });

  it('a row that waits past the link\'s 60 minutes is skipped EXPIRED, never mailed, and its body is emptied', async () => {
    const { id, email } = await person('late-worker');
    await ask(email);
    clock.advance(61 * MINUTE);
    await sendQueued();
    expect(defined((await outboxRows(id))[0])).toMatchObject({ status: 'skipped', last_error: 'EXPIRED', body_html: '', body_text: '' });
    expect((await capture.list()).filter((mail) => mail.to.includes(email))).toEqual([]);
  });
});

describe('AC-1 (D-1) and AC-3: nothing for FEATURE_EMAIL off, a deactivated person or an unknown address', () => {
  it('FEATURE_EMAIL off: the same answer (it resolves) and no token and no outbox row', async () => {
    const { id, email } = await person('flag-off');
    flag.emailEnabled = false;
    await expect(ask(email)).resolves.toBeUndefined();
    expect(await tokenRows(id)).toEqual([]);
    expect(await outboxRows(id)).toEqual([]);
  });

  it.each([
    ['a deactivated person', async () => (await person('deactivated', false)).email],
    ['an address nobody has', () => Promise.resolve(`nobody.${RUN_TAG}@example.com`)],
  ])('%s: it resolves as for anyone, and writes no token and no row at all', async (_name, address) => {
    const email = await address();
    const tokens = Number(defined((await db.owner.query<{ count: string }>('SELECT count(*) FROM password_reset_tokens')).rows[0]).count);
    const rows = Number(defined((await db.owner.query<{ count: string }>("SELECT count(*) FROM email_outbox WHERE event = 'password-reset'")).rows[0]).count);
    await expect(ask(email)).resolves.toBeUndefined();
    expect(Number(defined((await db.owner.query<{ count: string }>('SELECT count(*) FROM password_reset_tokens')).rows[0]).count)).toBe(tokens);
    expect(Number(defined((await db.owner.query<{ count: string }>("SELECT count(*) FROM email_outbox WHERE event = 'password-reset'")).rows[0]).count)).toBe(rows);
  });
});

describe('AC-4: the limit, counted on hashed keys', () => {
  it.each([
    ['a known e-mail', async () => (await person('limit-known')).email],
    ['an unknown e-mail', () => Promise.resolve(`limit-unknown.${RUN_TAG}@example.com`)],
  ])('the 6th request for %s within 15 minutes is 429 with no extra token or row; it works again after the window', async (_name, address) => {
    const email = await address();
    for (let count = 0; count < 5; count += 1) await ask(email, `198.51.100.${count + 1}`);
    const before = Number(defined((await db.owner.query<{ count: string }>("SELECT count(*) FROM email_outbox WHERE event = 'password-reset'")).rows[0]).count);
    expect(await refusal(ask(email, '198.51.100.99'))).toMatchObject({ httpStatus: 429, code: 'TOO_MANY_ATTEMPTS' });
    expect(Number(defined((await db.owner.query<{ count: string }>("SELECT count(*) FROM email_outbox WHERE event = 'password-reset'")).rows[0]).count)).toBe(before);
    clock.advance(15 * MINUTE + 1);
    await expect(ask(email, '198.51.100.100')).resolves.toBeUndefined();
  });

  it('the 6th request from one address is 429 whatever e-mail it types; no e-mail and no address is stored in clear', async () => {
    const typed = Array.from({ length: 6 }, (_, index) => `address-limit-${index}.${RUN_TAG}@example.com`);
    for (const email of typed.slice(0, 5)) await ask(email, '192.0.2.44');
    await expect(ask(typed[5] ?? '', '192.0.2.44')).rejects.toMatchObject({ httpStatus: 429 });
    const { rows } = await db.owner.query<{ key_hash: string }>('SELECT key_hash FROM login_throttles');
    const keys = rows.map((row) => row.key_hash).join(' ');
    expect(keys).not.toContain('192.0.2.44');
    expect(keys).not.toContain('address-limit');
    for (const row of rows) expect(row.key_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('AC-6, AC-7: using the link', () => {
  it('sets the new password: the old one stops working, the new one signs in, the flag is cleared and every old session ends', async () => {
    const { id, email } = await person('uses-link');
    const token = await emailedToken(email);
    const before = await userRow(id);
    const signedAt = Math.floor(START.getTime() / 1000);
    expect((await resolveSession({ userId: id, sessionVersion: before.session_version, signedAt }, db.users, START)).status).toBe('active');
    expect(await service.isLinkUsable(token)).toBe(true);

    await expect(service.resetPassword({ token, newPassword: NEW })).resolves.toEqual({ userId: id });

    const after = await userRow(id);
    expect(after).toMatchObject({ must_change_password: false, session_version: before.session_version + 1 });
    expect(after.password_hash.startsWith('$argon2id$')).toBe(true);
    expect(after.password_hash).not.toContain(NEW);
    const auth = createAuthService({ users: db.users, throttles: db.throttles, hasher, clock, keySecret: KEY_SECRET });
    expect(await auth.authenticate({ email, password: OLD, ipAddress: null })).toEqual({ status: 'refused', reason: 'invalid' });
    expect((await auth.authenticate({ email, password: NEW, ipAddress: null })).status).toBe('signed-in');
    expect(await resolveSession({ userId: id, sessionVersion: before.session_version, signedAt }, db.users, START)).toEqual({ status: 'refused' });
    expect(defined((await tokenRows(id))[0]).used_at).toEqual(START);
    expect(await service.isLinkUsable(token)).toBe(false);
  });

  it('lifts the sign-in block of the person, as the Admin\'s reset does (FR-004)', async () => {
    const { email } = await person('unblocks');
    const token = await emailedToken(email);
    const auth = createAuthService({ users: db.users, throttles: db.throttles, hasher, clock, keySecret: KEY_SECRET });
    for (let count = 0; count < 5; count += 1) await auth.authenticate({ email, password: 'Wrong-password-1!', ipAddress: '203.0.113.200' });
    expect(await auth.authenticate({ email, password: OLD, ipAddress: '203.0.113.201' })).toEqual({ status: 'refused', reason: 'locked' });
    await service.resetPassword({ token, newPassword: NEW });
    expect((await auth.authenticate({ email, password: NEW, ipAddress: '203.0.113.202' })).status).toBe('signed-in');
  });

  it('a second use is 400 RESET_LINK_INVALID and the new password does not change twice', async () => {
    const { id, email } = await person('second-use');
    const token = await emailedToken(email);
    await service.resetPassword({ token, newPassword: NEW });
    const after = await userRow(id);
    expect(await refusal(service.resetPassword({ token, newPassword: 'Another9#password' }))).toMatchObject({ httpStatus: 400, code: RESET_LINK_INVALID_CODE });
    expect(await userRow(id)).toEqual(after);
  });

  it('marks the person\'s other unused links used, so an older link is dead once a newer one is used', async () => {
    const { id, email } = await person('older-link');
    const older = await emailedToken(email);
    const newer = await emailedToken(email);
    await service.resetPassword({ token: newer, newPassword: NEW });
    expect((await tokenRows(id)).every((row) => row.used_at !== null)).toBe(true);
    expect(await refusal(service.resetPassword({ token: older, newPassword: 'Another9#password' }))).toMatchObject({ code: RESET_LINK_INVALID_CODE });
  });

  it('works at 59 minutes 59 seconds and not at 60 minutes (expires_at > now, to the millisecond)', async () => {
    const early = await person('expiry-early');
    const late = await person('expiry-late');
    const earlyToken = await emailedToken(early.email);
    const lateToken = await emailedToken(late.email);
    const lateBefore = await userRow(late.id);
    clock.advance(60 * MINUTE - 1);
    await expect(service.resetPassword({ token: earlyToken, newPassword: NEW })).resolves.toBeDefined();
    clock.advance(1);
    expect(await refusal(service.resetPassword({ token: lateToken, newPassword: NEW }))).toMatchObject({ httpStatus: 400, code: RESET_LINK_INVALID_CODE });
    expect(await userRow(late.id)).toEqual(lateBefore);
    expect(defined((await tokenRows(late.id))[0]).used_at).toBeNull();
  });

  it('two posts at once with one token (both have read it before either claims): exactly one succeeds, the other is 400, and the version is raised once', async () => {
    const { id, email } = await person('parallel');
    const token = await emailedToken(email);
    const before = await userRow(id);
    let arrived = 0;
    let open!: () => void;
    const opened = new Promise<void>((resolve) => {
      open = resolve;
    });
    const racing = buildService({
      findUsable: async (hash, now) => {
        const link = await resets.findUsable(hash, now);
        arrived += 1;
        if (arrived === 2) open();
        await opened;
        return link;
      },
    });
    const results = await Promise.allSettled([racing.resetPassword({ token, newPassword: NEW }), racing.resetPassword({ token, newPassword: 'Another9#password' })]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: { httpStatus: 400, code: RESET_LINK_INVALID_CODE } });
    expect((await userRow(id)).session_version).toBe(before.session_version + 1);
  });

  it('a person deactivated after the link was made: the link is refused, nothing changes and the token stays unused', async () => {
    const { id, email } = await person('deactivated-later');
    const token = await emailedToken(email);
    await db.owner.query('UPDATE users SET is_active = false WHERE id = $1::uuid', [id]);
    const before = await userRow(id);
    expect(await refusal(service.resetPassword({ token, newPassword: NEW }))).toMatchObject({ httpStatus: 400, code: RESET_LINK_INVALID_CODE });
    expect(await userRow(id)).toEqual(before);
    expect(defined((await tokenRows(id))[0]).used_at).toBeNull();
  });

  it('a person deactivated between the claim and the password write: the whole transaction rolls back, the claim too (the stale-read pattern of GitHub issue 509)', async () => {
    const { id, email } = await person('deactivated-mid');
    const token = await emailedToken(email);
    const before = await userRow(id);
    const racingUsers = {
      ...db.users,
      setPasswordFromReset: async (...args: Parameters<typeof db.users.setPasswordFromReset>) => {
        await db.owner.query('UPDATE users SET is_active = false WHERE id = $1::uuid', [id]);
        return db.users.setPasswordFromReset(...args);
      },
    };
    expect(await refusal(buildService({}, racingUsers).resetPassword({ token, newPassword: NEW }))).toMatchObject({ httpStatus: 400, code: RESET_LINK_INVALID_CODE });
    expect(await userRow(id)).toEqual(before);
    expect(defined((await tokenRows(id))[0]).used_at).toBeNull();
  });
});

describe('AC-8: a password that breaks the rule keeps the link', () => {
  it('422 naming the part, the token is not consumed, and the same link then works within its hour', async () => {
    const { id, email } = await person('bad-password');
    const token = await emailedToken(email);
    for (const [password, message] of [
      ['Ab1!', 'The new password must be at least 10 characters.'],
      [email.toUpperCase(), 'The password cannot be the same as your e-mail address.'],
    ] as const) {
      expect(await refusal(service.resetPassword({ token, newPassword: password }))).toMatchObject({ httpStatus: 422, code: 'PASSWORD_RULE', fields: [{ field: 'newPassword', message }] });
    }
    expect(defined((await tokenRows(id))[0]).used_at).toBeNull();
    await expect(service.resetPassword({ token, newPassword: NEW })).resolves.toBeDefined();
  });
});

describe('AC-9: secrets, the audit log and the grants', () => {
  it('a whole flow through the real routes writes no log line with the token, the password, the e-mail or the address, and no audit row', async () => {
    const { POST: FORGOT } = await import('@/app/api/v1/account/password/forgot/route');
    const { POST: RESET } = await import('@/app/api/v1/account/password/reset/route');
    const { id, email } = await person('logs');
    const audit = () => db.owner.query<{ count: string }>('SELECT count(*) FROM audit_log');
    const auditBefore = defined((await audit()).rows[0]).count;
    const call = (path: string, body: unknown, headers: Record<string, string> = {}) =>
      new Request(`${ORIGIN}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers }, body: JSON.stringify(body) });

    expect((await FORGOT(call('/api/v1/account/password/forgot', { email }, { 'x-forwarded-for': '203.0.113.88' }))).status).toBe(202);
    await sendQueued();
    const token = tokenIn(await mailTo(email));
    expect((await RESET(call('/api/v1/account/password/reset', { token, newPassword: 'short1!' }))).status).toBe(422);
    const done = await RESET(call('/api/v1/account/password/reset', { token, newPassword: NEW }));
    expect(done.status).toBe(204);
    expect((await RESET(call('/api/v1/account/password/reset', { token, newPassword: NEW }))).status).toBe(400);

    const everything = Object.values(logged).flatMap((method) => method.mock.calls.map((args) => JSON.stringify(args))).join('\n');
    for (const secret of [token, NEW, email, '203.0.113.88', '$argon2']) expect(everything).not.toContain(secret);
    expect(logged.info.mock.calls).toEqual([[{ requestId: done.headers.get('x-request-id'), userId: id }, 'A person reset their password with an e-mailed link.']]);
    expect(defined((await audit()).rows[0]).count).toBe(auditBefore);
  });

  it('the runtime role can read, add and mark a link used, but cannot delete one, and the table refuses anything but a SHA-256 in token_hash', async () => {
    const { id } = await person('grants');
    const hash = 'a'.repeat(64);
    await db.runtime.query("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1, $2::uuid, now() + interval '1 hour')", [hash, id]);
    await db.runtime.query('UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1', [hash]);
    await expect(db.runtime.query('DELETE FROM password_reset_tokens WHERE token_hash = $1', [hash])).rejects.toMatchObject({ code: '42501' });
    await expect(db.runtime.query('TRUNCATE password_reset_tokens')).rejects.toMatchObject({ code: '42501' });
    for (const raw of ['not-a-hash', 'A'.repeat(64), 'a'.repeat(63)]) {
      await expect(db.runtime.query("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1, $2::uuid, now() + interval '1 hour')", [raw, id])).rejects.toMatchObject({ code: '23514' });
    }
    await expect(db.runtime.query("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1, $2::uuid, now())", [hash, id])).rejects.toMatchObject({ code: '23505' });
  });

  it('the token column is unique and a link cannot be made for a person who does not exist', async () => {
    await expect(db.runtime.query("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1, gen_random_uuid(), now() + interval '1 hour')", ['b'.repeat(64)])).rejects.toMatchObject({ code: '23503' });
  });
});
