import { JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';
import { TOO_MANY_ATTEMPTS_CODE } from '../errors';

import type { ChangePasswordProblems } from './change-password';

/**
 * The browser's side of `POST /api/v1/account/password` (SCR-23, STORY-01.05): one small call, and the reading of its answer through the
 * shared `sendJson`. Nothing here decides anything; the current password, the rule and the attempt limit are the server's. It takes `fetch`
 * as an argument so a test can answer for the server. The server's answer for a refusal names the field (`currentPassword` or
 * `newPassword`) and carries the UX spec's words.
 */

const CHANGE_PASSWORD_PATH = '/api/v1/account/password';

export interface ChangePasswordRequest {
  readonly currentPassword: string;
  readonly newPassword: string;
}

/** The answer is 204. On success the server has also set the person's fresh session cookie. */
export function changeOwnPassword(request: ChangePasswordRequest, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(
    doFetch,
    CHANGE_PASSWORD_PATH,
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(request) },
    () => true,
  );
}

/**
 * What the form shows for an answer (UX spec SCR-23 "final words"):
 *   - `saved`: the password was changed;
 *   - `blocked`: five wrong current passwords (429);
 *   - `fields`: the server named a field (the current password is wrong, or the new one fails the rule or equals the current one);
 *   - `refused`: the server said no with no field to put it under (409 changed elsewhere, a 403, a 401 that is not a session ended): its
 *     own `title` is shown, never the connection sentence, because the connection worked;
 *   - `failed`: no usable answer at all (the network, a server fault, an answer of the wrong shape).
 */
export type ChangeResult =
  | { readonly kind: 'saved' }
  | { readonly kind: 'blocked' }
  | { readonly kind: 'fields'; readonly problems: ChangePasswordProblems }
  | { readonly kind: 'refused'; readonly title: string }
  | { readonly kind: 'failed' };

const FAILED: ChangeResult = { kind: 'failed' };

/** The messages of a refusal that name a field of the change form. */
function fieldProblems(fields: Readonly<Record<string, string>>): ChangePasswordProblems {
  const found: { currentPassword?: string; newPassword?: string } = {};
  const current = fields['currentPassword'];
  const next = fields['newPassword'];
  if (current !== undefined) found.currentPassword = current;
  if (next !== undefined) found.newPassword = next;
  return found;
}

export function resultOf(outcome: Outcome<true>): ChangeResult {
  if (outcome.status === 'ok') return { kind: 'saved' };
  if (outcome.status === 'failed') return FAILED;
  if (outcome.code === TOO_MANY_ATTEMPTS_CODE) return { kind: 'blocked' };
  const problems = fieldProblems(outcome.fields);
  if (Object.keys(problems).length > 0) return { kind: 'fields', problems };
  return FAILED;
}
