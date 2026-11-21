import { createTransport, type SendMailOptions, type SMTPTransportOptions } from 'nodemailer';

import type { SmtpEnv } from '../../lib/env';
import { type Clock, MILLISECONDS_PER_SECOND } from '../../lib/time';

import { createMicrosoftTokenProvider } from './microsoft-token';

/**
 * The one place that builds the Nodemailer transport and its sign-in mode (STORY-09.01 AC-3; architecture section 3 component table and section 4.7 "Mail transport"; ADR-011).
 *
 * `SMTP_AUTH_MODE` has three values, each with its own required variables (`src/lib/env.ts` checks them at start-up, so a mode cannot lack its fields here):
 *   - `none`: host and port only. Mailpit, in local development, CI and staging.
 *   - `password`: user and password, over STARTTLS (port 587). For a provider that still allows it.
 *   - `oauth2-client-credentials`: Microsoft 365. Nodemailer's XOAUTH2 with a `provisionCallback` that asks Microsoft's token endpoint for a token and renews it (`microsoft-token.ts`).
 *
 * Credentials come only from the environment (architecture section 9.4). Nodemailer's own logger and debug output are switched off, because its SMTP trace carries the
 * AUTH exchange; nothing here logs a setting. The timeouts keep one stuck server from holding the worker beyond the 5-minute lock of the rows it claimed.
 */

/** What the rest of the mail code needs from a transport: one `sendMail`. A real `Transporter` fits, and so does the capture stub of a test. */
export interface MailTransport {
  sendMail(message: SendMailOptions): Promise<unknown>;
}

const CONNECTION_TIMEOUT_MILLISECONDS = 15 * MILLISECONDS_PER_SECOND;
const GREETING_TIMEOUT_MILLISECONDS = 15 * MILLISECONDS_PER_SECOND;
const SOCKET_TIMEOUT_MILLISECONDS = 30 * MILLISECONDS_PER_SECOND;

/** The port of SMTP over implicit TLS. Every other port starts in clear text and upgrades with STARTTLS. */
const IMPLICIT_TLS_PORT = 465;

export interface TransportDependencies {
  readonly clock: Clock;
  readonly fetch?: typeof fetch;
  /** Replaces Microsoft's sign-in address; for tests only (a local stub of the token endpoint). */
  readonly tokenBaseUrl?: string;
}

/** The Nodemailer options for the configured mode. Exported so a test can check each mode without opening a connection. */
export function buildTransportOptions(smtp: SmtpEnv, dependencies: TransportDependencies): SMTPTransportOptions {
  const common = {
    host: smtp.SMTP_HOST,
    port: smtp.SMTP_PORT,
    secure: smtp.SMTP_PORT === IMPLICIT_TLS_PORT,
    connectionTimeout: CONNECTION_TIMEOUT_MILLISECONDS,
    greetingTimeout: GREETING_TIMEOUT_MILLISECONDS,
    socketTimeout: SOCKET_TIMEOUT_MILLISECONDS,
    logger: false,
    debug: false,
  } satisfies SMTPTransportOptions;

  switch (smtp.SMTP_AUTH_MODE) {
    case 'none':
      return common;
    case 'password':
      return { ...common, requireTLS: true, auth: { user: smtp.SMTP_USER, pass: smtp.SMTP_PASSWORD } };
    case 'oauth2-client-credentials': {
      const tokens = createMicrosoftTokenProvider(
        { tenantId: smtp.SMTP_OAUTH_TENANT_ID, clientId: smtp.SMTP_OAUTH_CLIENT_ID, clientSecret: smtp.SMTP_OAUTH_CLIENT_SECRET },
        {
          clock: dependencies.clock,
          ...(dependencies.fetch === undefined ? {} : { fetch: dependencies.fetch }),
          ...(dependencies.tokenBaseUrl === undefined ? {} : { baseUrl: dependencies.tokenBaseUrl }),
        },
      );
      return {
        ...common,
        requireTLS: true,
        auth: {
          type: 'OAuth2',
          user: smtp.SMTP_USER,
          provisionCallback: (_user, renew, done) => {
            tokens.getToken(renew).then(
              (token) => done(null, token.accessToken, token.renewAtMs),
              (error: unknown) => done(error instanceof Error ? error : new Error('The mail token request failed.')),
            );
          },
        },
      };
    }
  }
}

/** The real transport for the configured mode. Built when first needed, never at import. */
export function createMailTransport(smtp: SmtpEnv, dependencies: TransportDependencies): MailTransport {
  return createTransport(buildTransportOptions(smtp, dependencies));
}
