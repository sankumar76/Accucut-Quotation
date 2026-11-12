import { JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

/**
 * The browser's side of `POST /api/v1/account/password` (SCR-23, STORY-01.05): one small call, and the reading of its answer through the
 * shared `sendJson`. Nothing here decides anything; the current password, the rule and the attempt limit are the server's. It takes `fetch`
 * as an argument so a test can answer for the server. The server's answer for a refusal names the field (`currentPassword` or
 * `newPassword`) and carries the UX spec's words.
 */

const CHANGE_PASSWORD_PATH = '/api/v1/account/password';

/** The code of the 422 that says the current password given is wrong, and of the 429 that says the form is blocked. */
export const CURRENT_PASSWORD_WRONG_RESPONSE = 'CURRENT_PASSWORD_WRONG';
export const TOO_MANY_ATTEMPTS_RESPONSE = 'TOO_MANY_ATTEMPTS';

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
