import { JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';
import { TOO_MANY_ATTEMPTS_CODE } from '../errors';

import { FORGOT_PASSWORD_API_PATH, RESET_LINK_INVALID_CODE, RESET_PASSWORD_API_PATH } from './password-reset';

/**
 * The browser's side of the two public routes of the reset by e-mailed link (STORY-09.07, SCR-02): one small call each, and the reading of the answer through the shared `sendJson`. Nothing
 * here decides anything; whether an e-mail has an account, the rule, the limit and whether a link works are the server's. It takes `fetch` as an argument so a test can answer for the server.
 */

function messageOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const message: unknown = Reflect.get(body, 'message');
  return typeof message === 'string' && message !== '' ? message : null;
}

/** The answer is 202 with the one fixed message. */
export function requestResetLink(email: string, doFetch: Fetch = fetch): Promise<Outcome<string>> {
  return sendJson(doFetch, FORGOT_PASSWORD_API_PATH, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ email }) }, messageOf);
}

/** The answer is 204. No session is issued: the person signs in with the new password. */
export function resetPasswordWithLink(token: string, newPassword: string, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(doFetch, RESET_PASSWORD_API_PATH, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ token, newPassword }) }, () => true);
}

/**
 * What the request form shows (UX spec SCR-02): `sent` (the one message, whoever was asked about), `blocked` (429, with the server's words), `field` (422 under the e-mail field) or `failed` (no
 * usable answer: the network, a server fault).
 */
export type ForgotResult =
  | { readonly kind: 'sent'; readonly message: string }
  | { readonly kind: 'blocked'; readonly message: string }
  | { readonly kind: 'field'; readonly message: string }
  | { readonly kind: 'failed' };

export function forgotResultOf(outcome: Outcome<string>): ForgotResult {
  if (outcome.status === 'ok') return { kind: 'sent', message: outcome.value };
  if (outcome.status === 'failed') return { kind: 'failed' };
  if (outcome.code === TOO_MANY_ATTEMPTS_CODE) return { kind: 'blocked', message: outcome.title };
  const message = outcome.fields['email'];
  return message === undefined ? { kind: 'failed' } : { kind: 'field', message };
}

/**
 * What the reset form shows: `done` (204), `invalid` (400 `RESET_LINK_INVALID`: used, expired or unknown, one answer for all), `fields` (422 naming the new password) or `failed` (no usable answer, or a
 * refusal this form has no words for).
 */
export type ResetResult =
  | { readonly kind: 'done' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'fields'; readonly problems: { readonly newPassword: string } }
  | { readonly kind: 'failed' };

export function resetResultOf(outcome: Outcome<true>): ResetResult {
  if (outcome.status === 'ok') return { kind: 'done' };
  if (outcome.status === 'failed') return { kind: 'failed' };
  if (outcome.code === RESET_LINK_INVALID_CODE) return { kind: 'invalid' };
  const message = outcome.fields['newPassword'];
  return message === undefined ? { kind: 'failed' } : { kind: 'fields', problems: { newPassword: message } };
}
