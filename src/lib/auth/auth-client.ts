/**
 * The browser's side of sign-in and sign-out: two small calls to next-auth's own routes (`/api/auth/*`, architecture
 * section 6). It stands in for `next-auth/react`, whose client adds about 11 KB (gzip) to the first load of every
 * signed-in page for these two calls (NFR-009: 200 KB per route; STORY-01.01 keeps the budget). The server side is
 * unchanged: next-auth's CSRF token protects both calls, exactly as it does for its own client.
 *
 * Pure of Next.js: it takes `fetch` as an argument so a test can answer for the server.
 */

const CSRF_PATH = '/api/auth/csrf';
const SIGN_IN_PATH = '/api/auth/callback/credentials';
const SIGN_OUT_PATH = '/api/auth/signout';
/** next-auth answers with JSON instead of a redirect when the form says `json=true`. */
const JSON_ANSWER = { json: 'true' } as const;
const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' } as const;
/** Only used to read the query string of an address that may be relative. */
const PROBE_ORIGIN = 'http://auth-client.invalid';

type Fetch = typeof fetch;

/** What a sign-in attempt came to. `error` is the code the server put in the answer (`locked`, `unavailable`, `CredentialsSignin`). */
export type SignInOutcome =
  | { readonly status: 'signed-in' }
  | { readonly status: 'refused'; readonly error: string | null }
  | { readonly status: 'failed' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** The CSRF token for the next post, or null when the server did not give one. */
async function fetchCsrfToken(doFetch: Fetch): Promise<string | null> {
  const response = await doFetch(CSRF_PATH, { credentials: 'same-origin' });
  const body = await readJson(response);
  return response.ok && isRecord(body) && typeof body['csrfToken'] === 'string' ? body['csrfToken'] : null;
}

/** The `error` parameter of the address next-auth returns, or null if there is none. */
function errorOf(body: unknown): string | null {
  if (!isRecord(body) || typeof body['url'] !== 'string') return null;
  try {
    return new URL(body['url'], PROBE_ORIGIN).searchParams.get('error');
  } catch {
    return null;
  }
}

/**
 * Posts the e-mail and password. `refused` carries the server's reason (blocked, could not be checked, or the one
 * generic refusal); `failed` means no usable answer came back (the network, or a server fault).
 */
export async function signInWithPassword(email: string, password: string, doFetch: Fetch = fetch): Promise<SignInOutcome> {
  try {
    const csrfToken = await fetchCsrfToken(doFetch);
    if (csrfToken === null) return { status: 'failed' };
    const response = await doFetch(SIGN_IN_PATH, {
      method: 'POST',
      credentials: 'same-origin',
      headers: FORM_HEADERS,
      body: new URLSearchParams({ csrfToken, email, password, ...JSON_ANSWER }),
    });
    const body = await readJson(response);
    const error = errorOf(body);
    if (error !== null) return { status: 'refused', error };
    // No reason named: either the server accepted the sign-in (200 with an address to go to), or the answer is not one
    // this code understands (a server fault, a page instead of JSON), which is "failed", never "signed in".
    return response.ok && isRecord(body) && typeof body['url'] === 'string' ? { status: 'signed-in' } : { status: 'failed' };
  } catch {
    return { status: 'failed' };
  }
}

/** Asks the server to end the session. Resolves true when it did; false on any other answer. */
export async function signOutOfPortal(doFetch: Fetch = fetch): Promise<boolean> {
  try {
    const csrfToken = await fetchCsrfToken(doFetch);
    if (csrfToken === null) return false;
    const response = await doFetch(SIGN_OUT_PATH, {
      method: 'POST',
      credentials: 'same-origin',
      headers: FORM_HEADERS,
      body: new URLSearchParams({ csrfToken, ...JSON_ANSWER }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
