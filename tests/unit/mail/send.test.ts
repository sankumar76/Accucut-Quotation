import { createTransport } from 'nodemailer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SmtpEnv } from '@/lib/env';
import { createFixedClock } from '@/lib/time';
import { LOGO_CONTENT_ID, renderMail } from '@/server/mail/layout';
import { MailTokenError } from '@/server/mail/microsoft-token';
import { classifySendError, createMailer, type OutgoingMail } from '@/server/mail/send';
import { buildTransportOptions, type MailTransport } from '@/server/mail/transport';

import { startFakeSmtp, type FakeSmtp } from '../../support/fake-smtp';

/**
 * STORY-09.01 AC-3, AC-7 and AC-8: one path to the mail server; a failure becomes one of five class codes and nothing else; the secrets that the failing sends carry (a planted fake
 * SMTP password and a planted fake client secret) appear in no result, no thrown error and no line written to the console. The server side of the failures is real: a small local
 * SMTP server (`tests/support/fake-smtp.ts`) that refuses the sign-in by echoing the credentials, or the sender with Microsoft's 5.7.60, so Nodemailer's own error shapes are the ones
 * classified. All values are invented.
 */

const PLANTED_PASSWORD = 'planted-smtp-password';
const PLANTED_SECRET = 'planted-client-secret-value';
const clock = createFixedClock(new Date('2026-11-18T10:00:00.000Z'));

const sender = { name: 'Accucut Portal', mailbox: 'portal@example.com' };
const rendered = renderMail({ heading: 'A test', paragraphs: ['Hello.'] });
const mail: OutgoingMail = { to: 'engineer@example.com', cc: ['lead@example.com'], subject: 'A test', html: rendered.html, text: rendered.text };

describe('classifySendError (AC-7)', () => {
  it.each([
    ['a failed token request', new MailTokenError('refused'), 'AUTH_FAILED'],
    ['Nodemailer EAUTH', { code: 'EAUTH', message: 'Invalid login' }, 'AUTH_FAILED'],
    ['an SMTP 535', { responseCode: 535, response: '535 5.7.3 Authentication unsuccessful' }, 'AUTH_FAILED'],
    ['Microsoft 5.7.60', { code: 'EENVELOPE', responseCode: 550, response: '550 5.7.60 SMTP; Client does not have permissions to send as this sender' }, 'SENDER_NOT_ALLOWED'],
    ['5.7.60 whatever the code says', { code: 'EAUTH', response: '550 5.7.60 not allowed' }, 'SENDER_NOT_ALLOWED'],
    ['ECONNECTION', { code: 'ECONNECTION' }, 'CONNECTION'],
    ['ETIMEDOUT', { code: 'ETIMEDOUT' }, 'CONNECTION'],
    ['ESOCKET', { code: 'ESOCKET' }, 'CONNECTION'],
    ['ECONNREFUSED', { code: 'ECONNREFUSED' }, 'CONNECTION'],
    ['ENOTFOUND', { code: 'ENOTFOUND' }, 'CONNECTION'],
    ['EDNS', { code: 'EDNS' }, 'CONNECTION'],
    ['an Error with no code', new Error('boom'), 'UNKNOWN'],
    ['an SMTP 554', { code: 'EMESSAGE', responseCode: 554, response: '554 5.2.0 refused' }, 'UNKNOWN'],
    ['a string', 'boom', 'UNKNOWN'],
    ['null', null, 'UNKNOWN'],
    ['undefined', undefined, 'UNKNOWN'],
  ])('AC-7: %s is %s', (_name, error, code) => {
    expect(classifySendError(error)).toBe(code);
  });

  it('AC-7: returns a code and nothing of the error: a message that holds a secret is not in the answer', () => {
    const error = Object.assign(new Error(`login failed for ${PLANTED_PASSWORD}`), { code: 'EAUTH', response: `535 ${PLANTED_PASSWORD}` });
    expect(classifySendError(error)).toBe('AUTH_FAILED');
    expect(JSON.stringify(classifySendError(error))).not.toContain(PLANTED_PASSWORD);
  });
});

describe('createMailer: what goes to the transport (AC-8)', () => {
  function recording(): { transport: MailTransport; sent: Array<Parameters<MailTransport['sendMail']>[0]> } {
    const sent: Array<Parameters<MailTransport['sendMail']>[0]> = [];
    return { sent, transport: { sendMail: (message) => Promise.resolve(void sent.push(message)) } };
  }

  it('AC-8: sends From the settings sender, to and cc, with an HTML body and a plain-text body, and answers ok', async () => {
    const { transport, sent } = recording();
    expect(await createMailer(transport).send(mail, sender)).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ from: { name: 'Accucut Portal', address: 'portal@example.com' }, to: 'engineer@example.com', cc: ['lead@example.com'], subject: 'A test', html: rendered.html, text: rendered.text });
  });

  it('attaches the logo inline by content ID when the HTML refers to it, and does not when it does not', async () => {
    const { transport, sent } = recording();
    const mailer = createMailer(transport);
    await mailer.send(mail, sender);
    await mailer.send({ ...mail, html: '<p>plain</p>' }, sender);
    expect(sent[0]?.attachments).toEqual([expect.objectContaining({ cid: LOGO_CONTENT_ID, contentDisposition: 'inline', contentType: 'image/jpeg', filename: 'accucut-logo.jpg' })]);
    expect(sent[1]?.attachments).toEqual([]);
  });

  it.each([
    ['an empty mailbox', { name: 'Accucut Portal', mailbox: '' }],
    ['a blank mailbox', { name: 'Accucut Portal', mailbox: '   ' }],
    ['a mailbox that is not an address', { name: 'Accucut Portal', mailbox: 'not-an-address' }],
  ])('AC-5: %s fails with NO_SENDER and the transport is not touched', async (_name, noSender) => {
    const { transport, sent } = recording();
    expect(await createMailer(transport).send(mail, noSender)).toEqual({ ok: false, code: 'NO_SENDER' });
    expect(sent).toEqual([]);
  });

  it('AC-7: a transport that throws gives { ok: false, code } and never throws; the error text is not in the answer', async () => {
    const transport: MailTransport = { sendMail: () => Promise.reject(Object.assign(new Error(`bad ${PLANTED_SECRET}`), { code: 'ESOCKET' })) };
    const result = await createMailer(transport).send(mail, sender);
    expect(result).toEqual({ ok: false, code: 'CONNECTION' });
  });
});

describe('forced failures over a real connection (AC-7)', () => {
  let smtp: FakeSmtp | undefined;
  afterEach(async () => {
    vi.restoreAllMocks();
    await smtp?.close();
    smtp = undefined;
  });

  /** The options of a mode, pointed at the fake server in clear text (the real options require STARTTLS, which a plain fake does not offer). */
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

  /** Everything a failing send could print: the answer, and every write to the process output and the console. */
  async function everythingPrinted(run: () => Promise<unknown>): Promise<string> {
    const printed: string[] = [];
    const record = (chunk: unknown): boolean => {
      printed.push(String(chunk));
      return true;
    };
    vi.spyOn(process.stdout, 'write').mockImplementation(record);
    vi.spyOn(process.stderr, 'write').mockImplementation(record);
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, method).mockImplementation((...parts: unknown[]) => void printed.push(parts.map(String).join(' ')));
    const answer = await run();
    vi.restoreAllMocks();
    return `${JSON.stringify(answer)} ${printed.join(' ')}`;
  }

  it('AC-7: a refused password sign-in is AUTH_FAILED, and the planted password (which the server echoes back) is nowhere', async () => {
    smtp = await startFakeSmtp({ mechanism: 'PLAIN', auth: 'reject-echo', sender: 'accept' });
    const mailer = createMailer(clearTextTransport(passwordMode, smtp.port));
    let result: unknown;
    const printed = await everythingPrinted(async () => (result = await mailer.send(mail, sender)));
    expect(result).toEqual({ ok: false, code: 'AUTH_FAILED' });
    expect(printed).not.toContain(PLANTED_PASSWORD);
    // The server really did receive and echo it: the test would be empty if it had not.
    expect(smtp.lines.some((line) => line.startsWith('AUTH PLAIN'))).toBe(true);
  });

  it('AC-7: a failed token request in OAuth mode is AUTH_FAILED, and the planted client secret (which the token endpoint echoes back) is nowhere', async () => {
    smtp = await startFakeSmtp({ mechanism: 'XOAUTH2', auth: 'accept', sender: 'accept' });
    const tokenEndpoint = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ error: 'invalid_client', error_description: `secret ${PLANTED_SECRET}` }), { status: 401 })));
    const mailer = createMailer(clearTextTransport(oauthMode, smtp.port, tokenEndpoint));
    let result: unknown;
    const printed = await everythingPrinted(async () => (result = await mailer.send(mail, sender)));
    expect(tokenEndpoint).toHaveBeenCalled();
    expect(result).toEqual({ ok: false, code: 'AUTH_FAILED' });
    expect(printed).not.toContain(PLANTED_SECRET);
    // No mail was handed over: the sign-in never got a token.
    expect(smtp.lines.some((line) => line.toUpperCase().startsWith('MAIL FROM'))).toBe(false);
  });

  it('AC-3: with a good token, the OAuth sign-in sends the XOAUTH2 token and the message goes through', async () => {
    smtp = await startFakeSmtp({ mechanism: 'XOAUTH2', auth: 'accept', sender: 'accept' });
    const tokenEndpoint = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ access_token: 'token-abc', expires_in: 3600 }), { status: 200 })));
    const result = await createMailer(clearTextTransport(oauthMode, smtp.port, tokenEndpoint)).send(mail, sender);
    expect(result).toEqual({ ok: true });
    const authLine = smtp.lines.find((line) => line.startsWith('AUTH XOAUTH2'));
    expect(Buffer.from((authLine ?? '').split(' ')[2] ?? '', 'base64').toString('utf8')).toBe('user=portal@example.com\u0001auth=Bearer token-abc\u0001\u0001');
  });

  it('AC-7: Microsoft 5.7.60 (the sender is not the mailbox) is SENDER_NOT_ALLOWED', async () => {
    smtp = await startFakeSmtp({ mechanism: 'PLAIN', auth: 'accept', sender: 'sender-not-allowed' });
    expect(await createMailer(clearTextTransport(passwordMode, smtp.port)).send(mail, sender)).toEqual({ ok: false, code: 'SENDER_NOT_ALLOWED' });
  });

  it('AC-7: a server that is not there is CONNECTION', async () => {
    const closed = await startFakeSmtp({ mechanism: 'PLAIN', auth: 'accept', sender: 'accept' });
    const { port } = closed;
    await closed.close();
    expect(await createMailer(clearTextTransport(passwordMode, port)).send(mail, sender)).toEqual({ ok: false, code: 'CONNECTION' });
  });
});
