import { describe, expect, it, vi } from 'vitest';

import type { SmtpEnv } from '@/lib/env';
import { createFixedClock } from '@/lib/time';
import { MailTokenError } from '@/server/mail/microsoft-token';
import { buildTransportOptions, createMailTransport } from '@/server/mail/transport';

/**
 * STORY-09.01 AC-3: each `SMTP_AUTH_MODE` builds the expected Nodemailer options (no connection is opened here), and in OAuth mode the `provisionCallback` asks the token endpoint
 * (a stand-in `fetch`) and hands Nodemailer the token with the time to ask again. AC-7: no setting appears where it should not. Every value below is invented.
 */

const clock = createFixedClock(new Date('2026-11-18T10:00:00.000Z'));
const PLANTED_PASSWORD = 'planted-smtp-password';
const PLANTED_SECRET = 'planted-client-secret-value';

const none: SmtpEnv = { SMTP_AUTH_MODE: 'none', SMTP_HOST: 'mail.example.com', SMTP_PORT: 1025 };
const password: SmtpEnv = { SMTP_AUTH_MODE: 'password', SMTP_HOST: 'mail.example.com', SMTP_PORT: 587, SMTP_USER: 'portal@example.com', SMTP_PASSWORD: PLANTED_PASSWORD };
const oauth: SmtpEnv = {
  SMTP_AUTH_MODE: 'oauth2-client-credentials',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: 587,
  SMTP_USER: 'portal@example.com',
  SMTP_OAUTH_TENANT_ID: 'tenant-for-tests',
  SMTP_OAUTH_CLIENT_ID: 'client-for-tests',
  SMTP_OAUTH_CLIENT_SECRET: PLANTED_SECRET,
};

describe('buildTransportOptions: one set of options per mode (AC-3)', () => {
  it('AC-3: none is host and port only, with no sign-in and no forced TLS', () => {
    const options = buildTransportOptions(none, { clock });
    expect(options).toMatchObject({ host: 'mail.example.com', port: 1025, secure: false });
    expect(options.auth).toBeUndefined();
    expect(options.requireTLS).toBeUndefined();
  });

  it('AC-3: password is user and password over STARTTLS on 587 (TLS required, not implicit)', () => {
    const options = buildTransportOptions(password, { clock });
    expect(options).toMatchObject({ host: 'mail.example.com', port: 587, secure: false, requireTLS: true, auth: { user: 'portal@example.com', pass: PLANTED_PASSWORD } });
  });

  it('AC-3: port 465 uses implicit TLS', () => {
    expect(buildTransportOptions({ ...password, SMTP_PORT: 465 }, { clock }).secure).toBe(true);
  });

  it('AC-3: oauth2-client-credentials is XOAUTH2 for the mailbox, with a provisionCallback and no password', () => {
    const options = buildTransportOptions(oauth, { clock });
    expect(options).toMatchObject({ host: 'smtp.example.com', port: 587, secure: false, requireTLS: true });
    expect(options.auth).toMatchObject({ type: 'OAuth2', user: 'portal@example.com' });
    expect(typeof (options.auth && 'provisionCallback' in options.auth ? options.auth.provisionCallback : undefined)).toBe('function');
    expect(options.auth).not.toHaveProperty('pass');
    expect(options.auth).not.toHaveProperty('clientSecret');
  });

  it('every mode has timeouts, so a stuck server cannot hold a run beyond the 5-minute lock, and Nodemailer logging is off', () => {
    for (const smtp of [none, password, oauth]) {
      const options = buildTransportOptions(smtp, { clock });
      expect(options.connectionTimeout).toBeLessThanOrEqual(30_000);
      expect(options.greetingTimeout).toBeLessThanOrEqual(30_000);
      expect(options.socketTimeout).toBeLessThanOrEqual(60_000);
      expect(options.logger).toBe(false);
      expect(options.debug).toBe(false);
    }
  });

  it('AC-7: the secret is in the closure only: it is in no value that can be printed from the options', () => {
    const shown = JSON.stringify(buildTransportOptions(oauth, { clock }));
    expect(shown).not.toContain(PLANTED_SECRET);
  });
});

describe('the OAuth provisionCallback (AC-3)', () => {
  function provision(fetchStub: typeof fetch) {
    const options = buildTransportOptions(oauth, { clock, fetch: fetchStub, tokenBaseUrl: 'http://127.0.0.1:9' });
    const auth = options.auth;
    if (auth === undefined || !('provisionCallback' in auth) || auth.provisionCallback === undefined) throw new Error('No provisionCallback.');
    const callback = auth.provisionCallback;
    return (renew: boolean) =>
      new Promise<{ error: Error | null; token: string | undefined; renewAt: number | undefined }>((resolve) => {
        callback('portal@example.com', renew, (error, token, renewAt) => resolve({ error, token, renewAt }));
      });
  }

  it('AC-3: asks the injectable token base and gives Nodemailer the token and the time to ask again', async () => {
    const stub = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ access_token: 'token-abc', expires_in: 3600 }), { status: 200 })));
    const result = await provision(stub)(false);
    expect(result).toEqual({ error: null, token: 'token-abc', renewAt: clock.now().getTime() + 55 * 60_000 });
    expect(String(stub.mock.calls[0]?.[0])).toBe('http://127.0.0.1:9/tenant-for-tests/oauth2/v2.0/token');
  });

  it('AC-3: a token failure reaches Nodemailer as an error that is a MailTokenError (the send then fails with AUTH_FAILED), and holds no secret', async () => {
    const stub = vi.fn<typeof fetch>(() => Promise.resolve(new Response(`bad ${PLANTED_SECRET}`, { status: 401 })));
    const result = await provision(stub)(false);
    expect(result.token).toBeUndefined();
    expect(result.error).toBeInstanceOf(MailTokenError);
    expect(`${result.error?.message} ${String(result.error?.stack)}`).not.toContain(PLANTED_SECRET);
  });
});

describe('createMailTransport', () => {
  it('builds a transport that can send, for every mode, without opening a connection', () => {
    for (const smtp of [none, password, oauth]) expect(typeof createMailTransport(smtp, { clock }).sendMail).toBe('function');
  });
});
