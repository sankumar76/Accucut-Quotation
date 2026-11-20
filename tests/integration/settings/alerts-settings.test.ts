import { createTransport } from 'nodemailer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SmtpEnv } from '@/lib/env';
import { FieldValidationError, MailTestFailedError, ValidationError } from '@/lib/errors';
import { createFixedClock, MILLISECONDS_PER_MINUTE, type FixedClock } from '@/lib/time';
import { idempotencyKeys } from '@/lib/mail/events';
import { performOutboxSend, runOutboxSend, type OutboxSendDependencies } from '@/server/jobs/outbox-send';
import { renderMail } from '@/server/mail/layout';
import { createMailService } from '@/server/mail/mail-service';
import { createMailer } from '@/server/mail/send';
import { buildTransportOptions, type MailTransport } from '@/server/mail/transport';
import { createEmailOutboxRepository, type EmailOutboxRepository } from '@/server/repositories/email-outbox-repository';
import { createSettingsRepository } from '@/server/repositories/settings-repository';
import { createTransactionRunner, type TransactionRunner } from '@/server/repositories/transaction';
import { createSettingsService, type SettingsService } from '@/server/services/settings-service';

import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { fakeSettingsDependencies } from '../../support/fake-settings';
import { startFakeSmtp, type FakeSmtp } from '../../support/fake-smtp';
import { openMailCapture, type CapturedMail, type MailCapture } from '../../support/mail-capture';

/**
 * STORY-09.02 (AQP-349) against real PostgreSQL, as the runtime role, and a real mail transport (Mailpit when the run has one, an in-process stub otherwise: `tests/support/mail-capture.ts`):
 *   AC-3  the row is saved and read back; the shared rules refuse a bad name or address, ON with no address, and header injection; a save writes no audit row;
 *   AC-4  the test e-mail arrives at the Admin's own address read from `users`, from the saved sender, and at no other address;
 *   AC-5  a refusal with Microsoft's 5.7.60 (a stub SMTP server) is `SENDER_NOT_ALLOWED`; a refused sign-in and an unreachable server are their own classes; the planted secret the server echoes is in
 *         no error, answer or table;
 *   AC-7  the switch is read at claim time: OFF skips an alert row, ON sends one, and a row skipped while OFF stays skipped after ON (decision D-d);
 *   AC-2  `settings` holds no credential column and no answer carries one.
 * Every value is invented (example.com).
 */

// The info line of a save is the unit tests' (`alerts-service.test.ts`); here it would only fill the run's output.
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const NOW = new Date('2026-11-19T10:00:00.000Z');
const ADMIN_ADDRESS = 'settings.admin.349@example.com';
const ENGINEER_ADDRESS = 'settings.engineer.349@example.com';
const PLANTED_PASSWORD = 'planted-smtp-password-349';

let db: AuthDatabase;
let capture: MailCapture;
let clock: FixedClock;
let service: SettingsService;
let outbox: EmailOutboxRepository;
let transactions: TransactionRunner;
let adminId = '';
let engineerId = '';
let emailOn = true;

async function plantUser(name: string, email: string, role: 'ADMIN' | 'ENGINEER'): Promise<string> {
  const { rows } = await db.owner.query<{ id: string }>("INSERT INTO users (name, email, password_hash, role, is_active) VALUES ($1, $2, 'invented-hash', $3, true) RETURNING id::text", [name, email, role]);
  return rows[0]?.id ?? '';
}

function serviceWith(transport: MailTransport): SettingsService {
  const mail = createMailService({ outbox: createEmailOutboxRepository(db.prisma), mailer: createMailer(transport), clock });
  return createSettingsService({ ...fakeSettingsDependencies(), settings: createSettingsRepository(db.prisma), users: db.users, mail, emailEnabled: () => emailOn, clock });
}

async function storedRow(): Promise<{ alerts_enabled: boolean; sender_name: string; sender_mailbox: string; updated_at: Date }> {
  const { rows } = await db.owner.query<{ alerts_enabled: boolean; sender_name: string; sender_mailbox: string; updated_at: Date }>('SELECT alerts_enabled, sender_name, sender_mailbox, updated_at FROM settings WHERE id = 1');
  const row = rows[0];
  if (row === undefined) throw new Error('The settings row is missing.');
  return row;
}

const auditRows = async (): Promise<number> => Number((await db.owner.query<{ count: string }>('SELECT count(*) FROM audit_log')).rows[0]?.count ?? '0');
const toAdmin = async (): Promise<ReadonlyArray<CapturedMail>> => (await capture.list()).filter((mail) => mail.to.includes(ADMIN_ADDRESS));

const SAVED = { alertsEnabled: true, senderName: 'Accucut Portal', senderAddress: 'portal@example.com' } as const;

beforeAll(async () => {
  db = await openAuthDatabase();
  capture = openMailCapture();
  await capture.clear();
  outbox = createEmailOutboxRepository(db.prisma);
  transactions = createTransactionRunner(db.prisma);
  adminId = await plantUser('Invented Admin', ADMIN_ADDRESS, 'ADMIN');
  engineerId = await plantUser('Invented Engineer', ENGINEER_ADDRESS, 'ENGINEER');
});

afterAll(async () => {
  await capture.close();
  await db.close();
});

beforeEach(async () => {
  clock = createFixedClock(NOW);
  emailOn = true;
  service = serviceWith(capture.transport);
  await db.owner.query("UPDATE settings SET alerts_enabled = false, sender_name = '', sender_mailbox = '' WHERE id = 1");
  await db.owner.query('DELETE FROM email_outbox');
});

describe('AC-3: save and read back, as the runtime role', () => {
  it('saves the switch and the sender, answers the row as saved, and reads it back', async () => {
    const answer = await service.updateAlertSettings({ alertsEnabled: true, senderName: '  Accucut Portal ', senderAddress: ' portal@example.com ' }, { id: adminId });
    expect(answer).toEqual({ ...SAVED, emailEnabled: true });
    expect(await service.getAlertSettings()).toEqual({ ...SAVED, emailEnabled: true });
    const row = await storedRow();
    expect(row).toMatchObject({ alerts_enabled: true, sender_name: 'Accucut Portal', sender_mailbox: 'portal@example.com' });
  });

  it('moves updated_at forward on a save', async () => {
    const before = (await storedRow()).updated_at;
    await new Promise((resolve) => setTimeout(resolve, 15));
    await service.updateAlertSettings({ alertsEnabled: false, senderName: 'Accucut Portal', senderAddress: '' }, { id: adminId });
    expect((await storedRow()).updated_at.getTime()).toBeGreaterThan(before.getTime());
  });

  it('turning alerts ON with no sender address is refused, and nothing is saved', async () => {
    await expect(service.updateAlertSettings({ alertsEnabled: true, senderName: 'Accucut Portal', senderAddress: '' }, { id: adminId })).rejects.toBeInstanceOf(FieldValidationError);
    expect(await storedRow()).toMatchObject({ alerts_enabled: false, sender_name: '', sender_mailbox: '' });
  });

  it.each([
    ['a line break in the name', { senderName: 'Portal\r\nBcc: spy@example.com', senderAddress: 'portal@example.com' }],
    ['a line break in the address', { senderName: 'Portal', senderAddress: 'portal@example.com\r\nBcc: spy@example.com' }],
    ['a comma in the address', { senderName: 'Portal', senderAddress: 'portal@example.com,spy@example.com' }],
    ['an address over 254 characters', { senderName: 'Portal', senderAddress: `${'a'.repeat(250)}@example.com` }],
    ['a name over 100 characters', { senderName: 'A'.repeat(101), senderAddress: 'portal@example.com' }],
  ])('refuses %s, and nothing is saved', async (_label, values) => {
    await expect(service.updateAlertSettings({ alertsEnabled: true, ...values }, { id: adminId })).rejects.toBeInstanceOf(FieldValidationError);
    expect(await storedRow()).toMatchObject({ sender_name: '', sender_mailbox: '' });
  });

  it('writes no audit row (decision D-i)', async () => {
    const before = await auditRows();
    await service.updateAlertSettings(SAVED, { id: adminId });
    expect(await auditRows()).toBe(before);
  });

  it('the row holds no credential: its columns are the switch, the sender and two bookkeeping columns', async () => {
    const { rows } = await db.owner.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' ORDER BY column_name");
    expect(rows.map((row) => row.column_name)).toEqual(['alerts_enabled', 'id', 'sender_mailbox', 'sender_name', 'updated_at']);
  });
});

describe('AC-4: the test e-mail', () => {
  it("arrives at the Admin's own address, read from users, from the saved sender, and goes to no one else", async () => {
    await service.updateAlertSettings({ alertsEnabled: false, senderName: 'Accucut Portal', senderAddress: 'portal@example.com' }, { id: adminId });
    const answer = await service.sendTestEmail(adminId);
    expect(answer).toEqual({ sentTo: ADMIN_ADDRESS });

    const mails = await toAdmin();
    expect(mails).toHaveLength(1);
    const [mail] = mails;
    expect(mail?.to).toEqual([ADMIN_ADDRESS]);
    expect(mail?.cc).toEqual([]);
    expect(mail?.from).toEqual({ name: 'Accucut Portal', address: 'portal@example.com' });
    expect(mail?.subject).toBe('Accucut Quotation Portal: test e-mail');
    expect(mail?.html).toContain('test e-mail');
    expect(mail?.text).toContain('test e-mail');
    // Nothing went to the Engineer's address or anyone else's.
    expect((await capture.list()).some((sent) => sent.to.includes(ENGINEER_ADDRESS))).toBe(false);
  });

  it('works while the e-mail feature is off (alerts OFF, FEATURE_EMAIL off)', async () => {
    emailOn = false;
    await service.updateAlertSettings({ alertsEnabled: false, senderName: 'Accucut Portal', senderAddress: 'portal@example.com' }, { id: adminId });
    expect((await service.getAlertSettings()).emailEnabled).toBe(false);
    await expect(service.sendTestEmail(adminId)).resolves.toEqual({ sentTo: ADMIN_ADDRESS });
  });

  it('with no sender saved is a 422 NO_SENDER and sends nothing', async () => {
    const before = (await toAdmin()).length;
    await expect(service.sendTestEmail(adminId)).rejects.toMatchObject({ code: 'NO_SENDER', httpStatus: 422 });
    expect(await service.sendTestEmail(adminId).catch((error: unknown) => error)).toBeInstanceOf(ValidationError);
    expect((await toAdmin()).length).toBe(before);
  });

  it('the Engineer is not the recipient even when the call is made with the Engineer\'s ID: the recipient is whoever the ID names, read from the database', async () => {
    await service.updateAlertSettings({ alertsEnabled: false, senderName: 'Accucut Portal', senderAddress: 'portal@example.com' }, { id: adminId });
    await expect(service.sendTestEmail(engineerId)).resolves.toEqual({ sentTo: ENGINEER_ADDRESS });
    // The route passes the signed-in person's own ID (`user.id`) and nothing from the request; this proves the service takes its address from `users` for exactly that ID.
    expect((await capture.list()).filter((sent) => sent.to.includes(ENGINEER_ADDRESS))).toHaveLength(1);
  });
});

describe('AC-5: failures, with a stub SMTP server and a planted secret', () => {
  let smtp: FakeSmtp | undefined;
  afterEach(async () => {
    await smtp?.close();
    smtp = undefined;
    vi.restoreAllMocks();
  });

  const passwordMode: SmtpEnv = { SMTP_AUTH_MODE: 'password', SMTP_HOST: 'x', SMTP_PORT: 587, SMTP_USER: 'portal@example.com', SMTP_PASSWORD: PLANTED_PASSWORD };

  function stubTransport(port: number): MailTransport {
    const options = buildTransportOptions({ ...passwordMode, SMTP_HOST: '127.0.0.1', SMTP_PORT: port }, { clock });
    return createTransport({ ...options, requireTLS: false, ignoreTLS: true });
  }

  async function failureFor(transport: MailTransport): Promise<{ readonly error: unknown; readonly text: string }> {
    const failing = serviceWith(transport);
    await failing.updateAlertSettings({ alertsEnabled: false, senderName: 'Accucut Portal', senderAddress: 'portal@example.com' }, { id: adminId });
    const logged: string[] = [];
    const record = (chunk: unknown): boolean => {
      logged.push(String(chunk));
      return true;
    };
    vi.spyOn(process.stdout, 'write').mockImplementation(record);
    vi.spyOn(process.stderr, 'write').mockImplementation(record);
    const error = await failing.sendTestEmail(adminId).catch((thrown: unknown) => thrown);
    vi.restoreAllMocks();
    const { rows } = await db.owner.query('SELECT row_to_json(settings)::text AS row FROM settings');
    const everything = [...logged, JSON.stringify(error), String(error instanceof Error ? error.message : error), JSON.stringify(Object.entries(error as object)), ...rows.map((row) => String(row.row))].join('\n');
    return { error, text: everything };
  }

  it("Microsoft's 5.7.60 is a 502 SENDER_NOT_ALLOWED", async () => {
    smtp = await startFakeSmtp({ mechanism: 'PLAIN', auth: 'accept', sender: 'sender-not-allowed' });
    const { error } = await failureFor(stubTransport(smtp.port));
    expect(error).toBeInstanceOf(MailTestFailedError);
    expect(error).toMatchObject({ code: 'SENDER_NOT_ALLOWED', httpStatus: 502 });
  });

  it('a refused sign-in is AUTH_FAILED, and the planted password the server echoes is in no error, log or row', async () => {
    smtp = await startFakeSmtp({ mechanism: 'PLAIN', auth: 'reject-echo', sender: 'accept' });
    const { error, text } = await failureFor(stubTransport(smtp.port));
    expect(error).toMatchObject({ code: 'AUTH_FAILED', httpStatus: 502 });
    expect(smtp.lines.some((line) => line.startsWith('AUTH PLAIN'))).toBe(true);
    expect(text).not.toContain(PLANTED_PASSWORD);
    expect(text).not.toContain(Buffer.from(`\u0000portal@example.com\u0000${PLANTED_PASSWORD}`).toString('base64'));
  });

  it('a server that is not there is CONNECTION', async () => {
    const closed = await startFakeSmtp({ mechanism: 'PLAIN', auth: 'accept', sender: 'accept' });
    const { port } = closed;
    await closed.close();
    const { error } = await failureFor(stubTransport(port));
    expect(error).toMatchObject({ code: 'CONNECTION', httpStatus: 502 });
  });
});

describe('AC-7: the switch takes effect at claim time, without a restart', () => {
  let dependencies: OutboxSendDependencies;
  let counter = 0;

  async function enqueueAlert(): Promise<string> {
    counter += 1;
    const rendered = renderMail({ heading: 'Heading', paragraphs: ['Body'] });
    const message = {
      idempotencyKey: idempotencyKeys.backupMissed(`settings-${process.pid}-${counter}`),
      event: 'backup-missed' as const,
      toUserId: engineerId,
      ccUserIds: [],
      subject: `AQP-349 effect ${process.pid}-${counter}`,
      bodyHtml: rendered.html,
      bodyText: rendered.text,
    };
    await transactions.run((tx) => outbox.enqueue(tx, message, clock.now()));
    return message.idempotencyKey;
  }

  const statusOf = async (key: string): Promise<{ status: string; last_error: string | null }> => {
    const { rows } = await db.owner.query<{ status: string; last_error: string | null }>('SELECT status, last_error FROM email_outbox WHERE idempotency_key = $1', [key]);
    const row = rows[0];
    if (row === undefined) throw new Error('No such row.');
    return row;
  };

  beforeEach(() => {
    dependencies = { store: outbox, mailer: createMailer(capture.transport), clock };
  });

  it('OFF: an alert row is skipped. ON: the next row is sent. A row skipped while OFF stays skipped after ON (D-d)', async () => {
    await service.updateAlertSettings({ alertsEnabled: false, senderName: 'Accucut Portal', senderAddress: 'portal@example.com' }, { id: adminId });
    const whileOff = await enqueueAlert();
    await runOutboxSend(dependencies);
    expect(await statusOf(whileOff)).toEqual({ status: 'skipped', last_error: 'ALERTS_OFF' });

    // Switched ON through the service, and the same job (no restart, no new dependencies) now sends.
    await service.updateAlertSettings({ alertsEnabled: true, senderName: 'Accucut Portal', senderAddress: 'portal@example.com' }, { id: adminId });
    const whileOn = await enqueueAlert();
    clock.advance(MILLISECONDS_PER_MINUTE);
    const summary = await runOutboxSend({ ...dependencies, clock });
    expect(summary).toMatchObject({ claimed: 1, sent: 1, skipped: 0 });
    expect(await statusOf(whileOn)).toMatchObject({ status: 'sent', last_error: null });
    expect(await statusOf(whileOff)).toEqual({ status: 'skipped', last_error: 'ALERTS_OFF' });

    clock.advance(MILLISECONDS_PER_MINUTE);
    await performOutboxSend({ ...dependencies, clock }, () => undefined);
    expect(await statusOf(whileOff)).toEqual({ status: 'skipped', last_error: 'ALERTS_OFF' });
  });
});

describe('AC-2: no credential in anything the service answers', () => {
  it('the answer of a read and of a save holds the four fields and no key that looks like a credential', async () => {
    const saved = await service.updateAlertSettings(SAVED, { id: adminId });
    const read = await service.getAlertSettings();
    for (const answer of [saved, read]) {
      expect(Object.keys(answer).sort()).toEqual(['alertsEnabled', 'emailEnabled', 'senderAddress', 'senderName']);
      expect(JSON.stringify(answer)).not.toMatch(/password|secret|token|SMTP_/i);
    }
  });
});
