import { LOCKED_ERROR_CODE } from './options';

/**
 * next-auth answers every refused sign-in with 401. A blocked key is a different case: architecture section 6
 * gives it 429 ("throttled"). The route handler passes each response through this function, which changes the
 * status of a blocked sign-in and nothing else, so the body, the cookies and the headers are exactly next-auth's.
 *
 * next-auth reports the reason in the `error` parameter of the address it returns (`{ "url": ".../sign-in?error=locked" }`).
 */

const THROTTLED_STATUS = 429;
const REFUSED_STATUS = 401;
/** Only used to read the query string of an address that may be relative. */
const PROBE_ORIGIN = 'http://locked-response.invalid';

async function isLockedBody(response: Response): Promise<boolean> {
  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    // Not JSON (a form post without `json=true` answers with a redirect, which is not a 401). Not ours to change.
    return false;
  }
  if (typeof body !== 'object' || body === null || !('url' in body) || typeof body.url !== 'string') return false;
  try {
    return new URL(body.url, PROBE_ORIGIN).searchParams.get('error') === LOCKED_ERROR_CODE;
  } catch {
    return false;
  }
}

export async function withThrottledStatus(response: Response): Promise<Response> {
  if (response.status !== REFUSED_STATUS || !(await isLockedBody(response))) return response;
  return new Response(response.body, { status: THROTTLED_STATUS, headers: response.headers });
}
