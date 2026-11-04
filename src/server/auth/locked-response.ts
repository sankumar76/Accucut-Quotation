import { LOCKED_ERROR_CODE, UNAVAILABLE_ERROR_CODE } from './options';

/**
 * next-auth answers every refused sign-in with 401. Two refusals are not "wrong e-mail or password" and get their own
 * status (architecture section 6; ruling R4):
 *   - a blocked key (`locked`) is **429**, "throttled";
 *   - a sign-in that could not be checked (`unavailable`: the database was busy or down) is **503**, the retryable
 *     answer R4 gives a timeout, so a monitor or a script does not read it as a wrong password (G6 QLT-34).
 *
 * The route handler passes each response through `withSignInStatus`, which changes the status of those two and nothing
 * else, so the body, the cookies and the headers are exactly next-auth's. The body stays generic: no cause in it.
 *
 * next-auth reports the reason in the `error` parameter of the address it returns (`{ "url": ".../sign-in?error=locked" }`).
 */

/** A Map, so a reason like `constructor` in a forged address finds nothing. */
const STATUS_FOR_REASON: ReadonlyMap<string, number> = new Map([
  [LOCKED_ERROR_CODE, 429],
  [UNAVAILABLE_ERROR_CODE, 503],
]);
const REFUSED_STATUS = 401;
/** Only used to read the query string of an address that may be relative. */
const PROBE_ORIGIN = 'http://locked-response.invalid';

/** The reason next-auth named in the body of a refusal, or null when the body is not one. */
async function reasonOf(response: Response): Promise<string | null> {
  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    // Not JSON (a form post without `json=true` answers with a redirect, which is not a 401). Not ours to change.
    return null;
  }
  if (typeof body !== 'object' || body === null || !('url' in body) || typeof body.url !== 'string') return null;
  try {
    return new URL(body.url, PROBE_ORIGIN).searchParams.get('error');
  } catch {
    return null;
  }
}

export async function withSignInStatus(response: Response): Promise<Response> {
  if (response.status !== REFUSED_STATUS) return response;
  const reason = await reasonOf(response);
  const status = reason === null ? undefined : STATUS_FOR_REASON.get(reason);
  return status === undefined ? response : new Response(response.body, { status, headers: response.headers });
}
