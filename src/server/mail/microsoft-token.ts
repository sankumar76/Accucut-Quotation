import { z } from 'zod';

import { type Clock, MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND } from '../../lib/time';

/**
 * The access token for Microsoft 365 mail, by OAuth 2.0 client credentials (STORY-09.01 AC-3; architecture section 4.7 "Mail transport"; ADR-011).
 *
 * A tenant administrator registers the app, grants it `SMTP.SendAsApp` and gives it one dedicated mailbox. The portal then asks Microsoft's token endpoint for a token with its client
 * ID and secret, and hands the token to Nodemailer's XOAUTH2 through `provisionCallback` (see `transport.ts`). The platform `fetch` does the request, so there is no new dependency.
 * Nodemailer's documentation has no Microsoft client-credentials recipe, so this is unproven until one real send (RISK-014, STORY-09.08).
 *
 * The secret rules (architecture section 9.4, NFR-006): the client secret is sent only in the body of the one request to the token endpoint, never in a URL, a header or a log, and
 * a failure becomes `MailTokenError`, whose message is fixed text. The body of Microsoft's answer is never read into an error, because it can echo the client ID and the tenant.
 *
 * The token URL base is a parameter, never an environment variable, so tests point it at a local stub and nothing on a host can send the secret to another address.
 */

/** Microsoft's sign-in address. The token URL is `<base>/<tenant>/oauth2/v2.0/token`. */
export const MICROSOFT_LOGIN_BASE = 'https://login.microsoftonline.com';

/** The scope that SMTP.SendAsApp tokens carry (Microsoft Learn, "OAuth for SMTP"). */
export const OUTLOOK_SCOPE = 'https://outlook.office365.com/.default';

/** A token is renewed this long before it expires, so one is never presented in its last minutes. Never more than half of its life, for a short-lived token. */
export const TOKEN_RENEWAL_MARGIN_MILLISECONDS = 5 * MILLISECONDS_PER_MINUTE;

/** The longest the token request may take: a stuck endpoint must not hold the worker beyond the 5-minute lock of the rows it claimed. */
export const TOKEN_REQUEST_TIMEOUT_MILLISECONDS = 10 * MILLISECONDS_PER_SECOND;

export type TokenFailureReason = 'refused' | 'unreachable' | 'malformed';

/** A token request that failed. The text is fixed: it never holds the secret, the tenant, the client ID or anything Microsoft said. The class is `AUTH_FAILED`. */
export class MailTokenError extends Error {
  readonly code = 'AUTH_FAILED';
  readonly reason: TokenFailureReason;

  constructor(reason: TokenFailureReason) {
    super(`The mail token request failed (${reason}).`);
    this.name = 'MailTokenError';
    this.reason = reason;
  }
}

export interface AccessToken {
  readonly accessToken: string;
  /** When Nodemailer should ask again, in milliseconds since the epoch: the end of the token's life less the renewal margin. */
  readonly renewAtMs: number;
}

export interface MicrosoftTokenCredentials {
  readonly tenantId: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface MicrosoftTokenDependencies {
  readonly clock: Clock;
  /** The platform `fetch`; a test passes its own. */
  readonly fetch?: typeof fetch;
  /** Replaces `MICROSOFT_LOGIN_BASE`; for tests only (a local stub). */
  readonly baseUrl?: string;
  readonly timeoutMilliseconds?: number;
}

export interface MicrosoftTokenProvider {
  /** The cached token while it is fresh; a new one when it is near its end, absent, or `renew` is true (Nodemailer says the last one was refused). */
  getToken(renew: boolean): Promise<AccessToken>;
}

const tokenAnswerSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.coerce.number().positive().finite(),
});

export function createMicrosoftTokenProvider(credentials: MicrosoftTokenCredentials, dependencies: MicrosoftTokenDependencies): MicrosoftTokenProvider {
  const { clock } = dependencies;
  const request = dependencies.fetch ?? fetch;
  const base = (dependencies.baseUrl ?? MICROSOFT_LOGIN_BASE).replace(/\/+$/, '');
  const timeout = dependencies.timeoutMilliseconds ?? TOKEN_REQUEST_TIMEOUT_MILLISECONDS;
  const url = `${base}/${encodeURIComponent(credentials.tenantId)}/oauth2/v2.0/token`;

  let cached: AccessToken | undefined;
  let inFlight: Promise<AccessToken> | undefined;

  async function requestToken(): Promise<AccessToken> {
    const body = new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      scope: OUTLOOK_SCOPE,
      grant_type: 'client_credentials',
    });
    let response: Response;
    try {
      // `redirect: 'error'`: a redirect would send the secret on to another address.
      response = await request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(timeout),
      });
    } catch {
      throw new MailTokenError('unreachable');
    }
    if (!response.ok) throw new MailTokenError('refused');
    let answer: z.infer<typeof tokenAnswerSchema>;
    try {
      answer = tokenAnswerSchema.parse(await response.json());
    } catch {
      throw new MailTokenError('malformed');
    }
    const lifetime = answer.expires_in * MILLISECONDS_PER_SECOND;
    const margin = Math.min(TOKEN_RENEWAL_MARGIN_MILLISECONDS, lifetime / 2);
    return { accessToken: answer.access_token, renewAtMs: clock.now().getTime() + lifetime - margin };
  }

  return {
    async getToken(renew) {
      // `renew` means the token in use was refused, so it is dropped: it must not come back from the cache if the new request fails.
      if (renew) cached = undefined;
      if (cached !== undefined && cached.renewAtMs > clock.now().getTime()) return cached;
      // One request at a time: the claim sends up to 25 messages in a row, and a stampede of token requests would only be refused.
      inFlight ??= requestToken()
        .then((token) => {
          cached = token;
          return token;
        })
        .finally(() => {
          inFlight = undefined;
        });
      return inFlight;
    },
  };
}
