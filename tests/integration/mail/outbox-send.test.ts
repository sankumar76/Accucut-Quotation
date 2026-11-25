import { createTransport } from 'nodemailer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SmtpEnv } from '@/lib/env';
import { idempotencyKeys, type MailEvent } from '@/lib/mail/events';
import { createFixedClock, MILLISECONDS_PER_MINUTE, type FixedClock } from '@/lib/time';
import { performOutboxSend, runOutboxSend, type OutboxSendDependencies } from '@/server/jobs/outbox-send';
import { createJobRunWriter } from '@/server/repositories/job-run-repository';
import { runJob } from '@/server/jobs/run-job';
import { LOGO_CONTENT_ID, renderMail } from '@/server/mail/layout';
import { createMailer } from '@/server/mail/send';
import { buildTransportOptions, type MailTransport } from '@/server/mail/transport';
import { createEmailOutboxRepository, type EmailOutboxRepository, type OutboxMessage } from '@/server/repositories/email-outbox-repository';
import { createTransactionRunner, type TransactionRunner } from '@/server/repositories/transaction';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { startFakeSmtp, type FakeSmtp } from '../../support/fake-smtp';
import { openMailCapture, type CapturedMail, type MailCapture } from '../../support/mail-capture';

/**
 * STORY-09.01 AC-4 to AC-9, end to end: a row is enqueued in PostgreSQL, the job `outbox-send` claims it, the message goes through the real transport to a capturing mail server
 * (Mailpit when the run has one, an in-process stub otherwise: `tests/support/mail-capture.ts`) and is read back with its To, Cc, subject, HTML and plain text; then the rules around
 * it: two runs at once send a row once, the alerts switch, the finality of a skip, recipients read at send time, the sender read at send time, expiry, secret blanking, and a planted
 * fake secret that must not appear in a log line, a row, a `job_runs` row or a returned answer when sends are forced to fail. The clock is controlled. Every value is invented.
 */

const NOW = new Date('2026-11-18T10:00:00.000Z');
const PLANTED_PASSWORD = 'planted-smtp-password';
const PLANTED_SECRET = 'planted-client-secret-value';

let db: AuthDatabase;
let repository: EmailOutboxRepository;
let transactions: TransactionRunner;
let capture: MailCapture;
let clock: FixedClock;
let dependencies: OutboxSendDependencies;
let engineerId = '';
let leadId = '';
let inactiveId = '';
const addressOf: Record<string, string> = {};

async function plantUser(name: string, email: string, role: 'ENGINEER' | 'LEAD', active: boolean): Promise<string> {
  const { rows } = await db.owner.query<{ id: string }>("INSERT INTO users (name, email, password_hash, role, is_active) VALUES ($1, $2, 'invented-hash', $3, $4) RETURNING id::text", [name, email, role, active]);
  const id = rows[0]?.id ?? '';
  addressOf[id] = email;
  return id;
}

let counter = 0;
/** A message with a subject that is unique to the test, so a shared Mailpit can be searched for it. */
function message(overrides: Partial<OutboxMessage> = {}): OutboxMessage {
  counter += 1;
  const rendered = renderMail({ heading: 'Heading', paragraphs: [`Paragraph ${counter}`] });
  return {
    idempotencyKey: `backup-missed:send-${counter}`,
    event: 'backup-missed',
    toUserId: engineerId,
    ccUserIds: [],
    subject: `AQP-348 test ${process.pid}-${counter}`,
    bodyHtml: rendered.html,
    bodyText: rendered.text,
    ...overrides,
  };
}

async function enqueue(overrides: Partial<OutboxMessage> = {}): Promise<OutboxMessage> {
  const planted = message(overrides);
  await transactions.run((tx) => repository.enqueue(tx, planted, clock.now()));
  return planted;
}

/** A row that has already used 3 attempts: its next send is the 4th, so a failure is final (STORY-09.06 AC-1). The retries themselves are `retries.test.ts`. */
async function enqueueOnLastAttempt(overrides: Partial<OutboxMessage> = {}): Promise<OutboxMessage> {
  const planted = await enqueue(overrides);
  await db.owner.query('UPDATE email_outbox SET attempts = 3 WHERE idempotency_key = $1', [planted.idempotencyKey]);
  return planted;
}

async function setting(column: 'alerts_enabled' | 'sender_name' | 'sender_mailbox', value: boolean | string): Promise<void> {
  await db.owner.query(`UPDATE settings SET ${column} = $1 WHERE id = 1`, [value]);
}

interface Row {
  readonly idempotency_key: string;
  readonly status: string;
  readonly attempts: number;
  readonly last_error: string | null;
  readonly sent_at: Date | null;
  readonly locked_until: Date | null;
  readonly body_html: string;
  readonly body_text: string;
}

async function rowOf(key: string): Promise<Row> {
  const { rows } = await db.owner.query<Row>('SELECT idempotency_key, status, attempts, last_error, sent_at, locked_until, body_html, body_text FROM email_outbox WHERE idempotency_key = $1', [key]);
  const row = rows[0];
  if (row === undefined) throw new Error(`No row for ${key}.`);
  return row;
}

const captured = async (subject: string): Promise<ReadonlyArray<CapturedMail>> => (await capture.list()).filter((mail) => mail.subject === subject);

beforeAll(async () => {
  db = await openAuthDatabase();
  repository = createEmailOutboxRepository(db.prisma);
  transactions = createTransactionRunner(db.prisma);
  capture = openMailCapture();
  engineerId = await plantUser('Invented Engineer', 'engineer.send@example.com', 'ENGINEER', true);
  leadId = await plantUser('Invented Lead', 'lead.send@example.com', 'LEAD', true);
  inactiveId = await plantUser('Invented Gone', 'gone.send@example.com', 'ENGINEER', false);
});

afterAll(async () => {
  await capture.close();
  await db.close();
});

beforeEach(async () => {
  clock = createFixedClock(NOW);
  dependencies = { store: repository, mailer: createMailer(capture.transport), clock, log: () => undefined, jobRuns: createJobRunWriter(db.prisma) };
  await db.owner.query('DELETE FROM email_outbox');
  await db.owner.query('DELETE FROM job_runs');
  await db.owner.query("UPDATE settings SET alerts_enabled = true, sender_name = 'Accucut Portal', sender_mailbox = 'portal@example.com' WHERE id = 1");
});

describe('AC-9: one end-to-end test through the capturing mail server', () => {
  it(`AC-9: enqueue a row, run the job, read the message back with To, Cc, subject, HTML and plain text (backend: ${process.env['MAILPIT_API_URL'] === undefined ? 'in-process stub' : 'Mailpit'})`, async () => {
    const planted = await enqueue({ toUserId: engineerId, ccUserIds: [leadId, inactiveId] });
    const summary = await runOutboxSend(dependencies);
    expect(summary).toMatchObject({ claimed: 1, sent: 1, failed: 0, skipped: 0 });

    const [mail] = await captured(planted.subject);
    expect(mail).toBeDefined();
    expect(mail?.to).toEqual(['engineer.send@example.com']);
    // The inactive Cc user is left out, the active one is there: addresses came from `users` at send time.
    expect(mail?.cc).toEqual(['lead.send@example.com']);
    expect(mail?.subject).toBe(planted.subject);
    expect(mail?.html).toContain('Paragraph');
    expect(mail?.html).toContain(`cid:${LOGO_CONTENT_ID}`);
    expect(mail?.text).toContain('Paragraph');
    expect(mail?.text).not.toMatch(/<[a-z]/i);
    expect(mail?.from).toEqual({ name: 'Accucut Portal', address: 'portal@example.com' });
    expect(mail?.inlineContentIds).toContain(LOGO_CONTENT_ID);

    const row = await rowOf(planted.idempotencyKey);
    expect(row).toMatchObject({ status: 'sent', attempts: 1, last_error: null, locked_until: null });
    expect(row.sent_at).toEqual(NOW);
  });
});

describe('AC-4: two runs at once send each row once', () => {
  it('AC-4: eight rows, two runs started together: every row is sent exactly once and every message arrives exactly once', async () => {
    const planted: OutboxMessage[] = [];
    for (let index = 0; index < 8; index += 1) planted.push(await enqueue());
    const summaries = await Promise.all([runOutboxSend(dependencies), runOutboxSend(dependencies)]);
    expect(summaries.reduce((total, summary) => total + summary.sent, 0)).toBe(8);
    for (const row of planted) {
      expect(await captured(row.subject), row.subject).toHaveLength(1);
      expect((await rowOf(row.idempotencyKey)).status).toBe('sent');
    }
  });

  it('AC-4: a run claims no more than 25 rows: 30 due rows take two runs', async () => {
    for (let index = 0; index < 30; index += 1) await enqueue();
    expect((await runOutboxSend(dependencies)).claimed).toBe(25);
    expect((await runOutboxSend(dependencies)).claimed).toBe(5);
    expect((await runOutboxSend(dependencies)).claimed).toBe(0);
  });

  it('AC-4: a row that was sent is not sent again by a later run', async () => {
    const planted = await enqueue();
    await runOutboxSend(dependencies);
    clock.advance(10 * MILLISECONDS_PER_MINUTE);
    await runOutboxSend(dependencies);
    expect(await captured(planted.subject)).toHaveLength(1);
  });
});

describe('AC-5: the alerts switch, the sender and the recipients', () => {
  it('AC-5: alerts OFF: an alert event is skipped and nothing is sent; password-reset is still sent', async () => {
    await setting('alerts_enabled', false);
    const alert = await enqueue({ event: 'task-assigned', idempotencyKey: idempotencyKeys.taskAssigned('t1', 1) });
    const reset = await enqueue({ event: 'password-reset', idempotencyKey: idempotencyKeys.passwordReset('tok-1') });
    const summary = await runOutboxSend(dependencies);
    expect(summary).toMatchObject({ claimed: 1, sent: 1, skipped: 1 });
    expect(await captured(alert.subject)).toEqual([]);
    expect(await captured(reset.subject)).toHaveLength(1);
    expect(await rowOf(alert.idempotencyKey)).toMatchObject({ status: 'skipped', last_error: 'ALERTS_OFF', sent_at: null });
  });

  it('AC-5, D-d: a skipped row stays skipped after alerts are switched ON, and is never sent', async () => {
    await setting('alerts_enabled', false);
    const alert = await enqueue({ event: 'daily-digest', idempotencyKey: idempotencyKeys.dailyDigest('e1', '2026-11-18') });
    await runOutboxSend(dependencies);
    await setting('alerts_enabled', true);
    clock.advance(MILLISECONDS_PER_MINUTE);
    expect(await runOutboxSend(dependencies)).toMatchObject({ claimed: 0, sent: 0, skipped: 0 });
    expect(await captured(alert.subject)).toEqual([]);
    expect((await rowOf(alert.idempotencyKey)).status).toBe('skipped');
  });

  it('AC-5: the sender is read from settings at send time: a change between two sends applies to the next', async () => {
    const first = await enqueue();
    await runOutboxSend(dependencies);
    await setting('sender_name', 'Renamed Sender');
    await setting('sender_mailbox', 'other@example.com');
    const second = await enqueue();
    await runOutboxSend(dependencies);
    expect((await captured(first.subject))[0]?.from).toEqual({ name: 'Accucut Portal', address: 'portal@example.com' });
    expect((await captured(second.subject))[0]?.from).toEqual({ name: 'Renamed Sender', address: 'other@example.com' });
  });

  it('AC-5: an empty sender fails the attempt with NO_SENDER (final on the 4th), and nothing is sent', async () => {
    await setting('sender_mailbox', '');
    const planted = await enqueueOnLastAttempt();
    expect(await runOutboxSend(dependencies)).toMatchObject({ claimed: 1, sent: 0, failed: 1, failures: { NO_SENDER: 1 } });
    expect(await captured(planted.subject)).toEqual([]);
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'failed', last_error: 'NO_SENDER', attempts: 4, locked_until: null });
  });

  it('AC-5 (ruling of 2026-11-18): an address that changed before the send is the one used, and a person who is inactive gets nothing (skipped, NO_RECIPIENT)', async () => {
    const changed = await plantUser('Invented Mover', 'mover.before@example.com', 'ENGINEER', true);
    const gone = await plantUser('Invented Leaver', 'leaver@example.com', 'ENGINEER', true);
    const moved = await enqueue({ toUserId: changed });
    const left = await enqueue({ toUserId: gone, event: 'password-reset', idempotencyKey: idempotencyKeys.passwordReset('tok-gone'), bodyText: 'https://portal.example.com/reset/secret-link' });
    await db.owner.query("UPDATE users SET email = 'mover.after@example.com' WHERE id = $1", [changed]);
    await db.owner.query('UPDATE users SET is_active = false WHERE id = $1', [gone]);
    const summary = await runOutboxSend(dependencies);
    expect(summary).toMatchObject({ claimed: 2, sent: 1, skipped: 1, failed: 0 });
    expect((await captured(moved.subject))[0]?.to).toEqual(['mover.after@example.com']);
    expect(await captured(left.subject)).toEqual([]);
    // The reset link is blanked: the person is not mailed it, and it does not stay in the table.
    expect(await rowOf(left.idempotencyKey)).toMatchObject({ status: 'skipped', last_error: 'NO_RECIPIENT', body_html: '', body_text: '' });
  });

  it('a row past its send_before is skipped as EXPIRED and not sent, whatever its event (a late reset row never mails a dead link)', async () => {
    const late = await enqueue({ event: 'password-reset', idempotencyKey: idempotencyKeys.passwordReset('tok-late'), sendBefore: new Date(NOW.getTime() - 1) });
    const timely = await enqueue({ event: 'password-reset', idempotencyKey: idempotencyKeys.passwordReset('tok-timely'), sendBefore: new Date(NOW.getTime() + 60 * MILLISECONDS_PER_MINUTE) });
    await runOutboxSend(dependencies);
    expect(await captured(late.subject)).toEqual([]);
    expect(await rowOf(late.idempotencyKey)).toMatchObject({ status: 'skipped', last_error: 'EXPIRED', body_html: '', body_text: '' });
    expect(await captured(timely.subject)).toHaveLength(1);
  });

  it('a secret-bearing body is emptied as the row is sent: the reset link is not kept in the e-mail log; an alert keeps its body', async () => {
    const reset = await enqueue({ event: 'password-reset', idempotencyKey: idempotencyKeys.passwordReset('tok-sent'), bodyText: 'https://portal.example.com/reset/live-link' });
    const alert = await enqueue();
    await runOutboxSend(dependencies);
    expect((await captured(reset.subject))[0]?.text).toContain('live-link');
    expect(await rowOf(reset.idempotencyKey)).toMatchObject({ status: 'sent', body_html: '', body_text: '' });
    expect((await rowOf(alert.idempotencyKey)).body_text).toBe(alert.bodyText);
  });
});

describe('AC-7: no secret leaks (forced failures with a planted fake secret)', () => {
  let smtp: FakeSmtp | undefined;
  afterEach(async () => {
    vi.restoreAllMocks();
    await smtp?.close();
    smtp = undefined;
  });

  function clearTextTransport(mode: SmtpEnv, port: number, fetchStub?: typeof fetch): MailTransport {
    const options = buildTransportOptions({ ...mode, SMTP_HOST: '127.0.0.1', SMTP_PORT: port }, { clock, ...(fetchStub === undefined ? {} : { fetch: fetchStub }) });
    return createTransport({ ...options, requireTLS: false, ignoreTLS: true });
  }

  const passwordMode: SmtpEnv = { SMTP_AUTH_MODE: 'password', SMTP_HOST: 'x', SMTP_PORT: 587, SMTP_USER: 'portal@example.com', SMTP_PASSWORD: PLANTED_PASSWORD };
  const oauthMode: SmtpEnv = {
    SMTP_AUTH_MODE: 'oauth2-client-credentials',
    SMTP_HOST: 'x',
    SMTP_PORT: 587,
    SMTP_USER: 'portal@example.com',
    SMTP_OAUTH_TENANT_ID: 'tenant-for-tests',
    SMTP_OAUTH_CLIENT_ID: 'client-for-tests',
    SMTP_OAUTH_CLIENT_SECRET: PLANTED_SECRET,
  };

  /** Every place a secret could end up: the log lines of the run, the whole outbox and job_runs tables as text, and the answers. */
  async function everythingKept(logs: ReadonlyArray<string>, answers: unknown): Promise<string> {
    const { rows: outbox } = await db.owner.query('SELECT row_to_json(email_outbox)::text AS row FROM email_outbox');
    const { rows: runs } = await db.owner.query('SELECT row_to_json(job_runs)::text AS row FROM job_runs');
    return [...logs, JSON.stringify(answers), ...outbox.map((row) => String(row.row)), ...runs.map((row) => String(row.row))].join('\n');
  }

  async function forcedFailure(transport: MailTransport, planted: ReadonlyArray<OutboxMessage>) {
    const logs: string[] = [];
    const printed: string[] = [];
    const record = (chunk: unknown): boolean => {
      printed.push(String(chunk));
      return true;
    };
    vi.spyOn(process.stdout, 'write').mockImplementation(record);
    vi.spyOn(process.stderr, 'write').mockImplementation(record);
    const deps: OutboxSendDependencies = { ...dependencies, mailer: createMailer(transport) };
    // Through the job wrapper, as the worker runs it: every line it writes is kept, with its fields.
    await runJob({ name: 'outbox-send', log: (message, level, fields) => void logs.push(JSON.stringify({ message, level, ...fields })), now: () => new Date(NOW) }, () => performOutboxSend(deps));
    const summary = await runOutboxSend({ ...deps, clock: createFixedClock(new Date(NOW.getTime() + MILLISECONDS_PER_MINUTE)) });
    vi.restoreAllMocks();
    return { text: await everythingKept([...logs, ...printed], [summary, planted.length]), logs };
  }

  it('AC-7: a refused password sign-in: the row is failed with AUTH_FAILED, and the planted password (echoed by the server) is in no log, row, job_runs row or answer', async () => {
    smtp = await startFakeSmtp({ mechanism: 'PLAIN', auth: 'reject-echo', sender: 'accept' });
    const planted = await enqueueOnLastAttempt();
    const { text, logs } = await forcedFailure(clearTextTransport(passwordMode, smtp.port), [planted]);
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'failed', last_error: 'AUTH_FAILED', attempts: 4 });
    expect(logs.join('\n')).toContain('"summary":"outbox-send: claimed 1, sent 0, retrying 0, skipped 0, failed 1 (AUTH_FAILED 1)"');
    expect(logs.join('\n')).toContain('"level":"error"');
    expect(smtp.lines.some((line) => line.startsWith('AUTH PLAIN'))).toBe(true);
    expect(text).not.toContain(PLANTED_PASSWORD);
  });

  it('AC-7: a failed token request in OAuth mode: AUTH_FAILED, and the planted client secret (echoed by the token endpoint) is nowhere', async () => {
    smtp = await startFakeSmtp({ mechanism: 'XOAUTH2', auth: 'accept', sender: 'accept' });
    const tokenEndpoint = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ error: 'invalid_client', error_description: `secret ${PLANTED_SECRET}` }), { status: 401 })));
    const planted = await enqueueOnLastAttempt();
    const { text } = await forcedFailure(clearTextTransport(oauthMode, smtp.port, tokenEndpoint), [planted]);
    expect(tokenEndpoint).toHaveBeenCalled();
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'failed', last_error: 'AUTH_FAILED' });
    expect(text).not.toContain(PLANTED_SECRET);
  });

  it('AC-7: Microsoft 5.7.60 gives SENDER_NOT_ALLOWED in the row', async () => {
    smtp = await startFakeSmtp({ mechanism: 'PLAIN', auth: 'accept', sender: 'sender-not-allowed' });
    const planted = await enqueueOnLastAttempt();
    await forcedFailure(clearTextTransport(passwordMode, smtp.port), [planted]);
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'failed', last_error: 'SENDER_NOT_ALLOWED' });
  });

  it('AC-7: a server that is not there gives CONNECTION', async () => {
    const closed = await startFakeSmtp({ mechanism: 'PLAIN', auth: 'accept', sender: 'accept' });
    const { port } = closed;
    await closed.close();
    const planted = await enqueueOnLastAttempt();
    await forcedFailure(clearTextTransport(passwordMode, port), [planted]);
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'failed', last_error: 'CONNECTION' });
  });

  it('AC-7: a row that failed on its 4th attempt is final: attempts = 4, and the second run does not send it again', async () => {
    smtp = await startFakeSmtp({ mechanism: 'PLAIN', auth: 'reject-echo', sender: 'accept' });
    const planted = await enqueueOnLastAttempt();
    await forcedFailure(clearTextTransport(passwordMode, smtp.port), [planted]);
    expect((await rowOf(planted.idempotencyKey)).attempts).toBe(4);
  });

  it('AC-7: a failed secret-bearing row has its link emptied, and last_error is only a class code', async () => {
    smtp = await startFakeSmtp({ mechanism: 'PLAIN', auth: 'reject-echo', sender: 'accept' });
    const planted = await enqueueOnLastAttempt({ event: 'password-reset', idempotencyKey: idempotencyKeys.passwordReset('tok-fail'), bodyText: 'https://portal.example.com/reset/live-link', bodyHtml: '<a href="https://portal.example.com/reset/live-link">x</a>' });
    await forcedFailure(clearTextTransport(passwordMode, smtp.port), [planted]);
    const row = await rowOf(planted.idempotencyKey);
    expect(row).toMatchObject({ status: 'failed', body_html: '', body_text: '' });
    expect(['SENDER_NOT_ALLOWED', 'AUTH_FAILED', 'CONNECTION', 'NO_SENDER', 'UNKNOWN']).toContain(row.last_error);
  });
});

describe('the repository: marks, recipients, settings', () => {
  const LOCK = new Date(NOW.getTime() + 5 * MILLISECONDS_PER_MINUTE);

  async function claimOne(overrides: Partial<OutboxMessage> = {}): Promise<{ id: string; planted: OutboxMessage }> {
    const planted = await enqueue(overrides);
    const [claimed] = (await repository.claimDue(NOW, 1, LOCK)).claimed;
    if (claimed === undefined) throw new Error('Nothing was claimed.');
    return { id: claimed.id, planted };
  }

  it('markSent / markRetry / markFailed / markSkipped change a row only while it is sending, and say whether they did', async () => {
    const { id, planted } = await claimOne();
    const ref = { id, attempts: 1 };
    expect(await repository.markSent(ref, NOW)).toBe(true);
    expect(await repository.markRetry(ref, 'UNKNOWN', LOCK)).toBe(false);
    expect(await repository.markFailed(ref, 'UNKNOWN', NOW)).toBe(false);
    expect(await repository.markSkipped(ref, 'NO_RECIPIENT')).toBe(false);
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'sent', last_error: null });
  });

  it('a row that was never claimed cannot be marked', async () => {
    const planted = await enqueue();
    const { rows } = await db.owner.query<{ id: string }>('SELECT id::text FROM email_outbox WHERE idempotency_key = $1', [planted.idempotencyKey]);
    expect(await repository.markSent({ id: rows[0]?.id ?? '', attempts: 1 }, NOW)).toBe(false);
    expect((await rowOf(planted.idempotencyKey)).status).toBe('pending');
  });

  it('resolveRecipients: active users only; an inactive Cc is left out; a person named twice, or the To user in Cc, is one address', async () => {
    expect(await repository.resolveRecipients(engineerId, [leadId, inactiveId, leadId, engineerId])).toEqual({ to: 'engineer.send@example.com', cc: ['lead.send@example.com'] });
    expect(await repository.resolveRecipients(inactiveId, [leadId])).toEqual({ to: null, cc: ['lead.send@example.com'] });
    expect(await repository.resolveRecipients('00000000-0000-4000-8000-000000000000', [])).toEqual({ to: null, cc: [] });
  });

  it('readMailSettings reads the one row', async () => {
    expect(await repository.readMailSettings()).toEqual({ alertsEnabled: true, senderName: 'Accucut Portal', senderMailbox: 'portal@example.com' });
    await setting('alerts_enabled', false);
    expect((await repository.readMailSettings()).alertsEnabled).toBe(false);
  });

  it('the events of the lists are the events the claim knows: every alert event is skipped when OFF, whatever it is called', async () => {
    await setting('alerts_enabled', false);
    const events: MailEvent[] = ['task-assigned', 'task-overdue', 'daily-digest', 'backup-missed'];
    for (const event of events) await enqueue({ event, idempotencyKey: `${event}:probe` });
    expect((await repository.claimDue(NOW, 25, LOCK)).skipped).toHaveLength(4);
  });
});
