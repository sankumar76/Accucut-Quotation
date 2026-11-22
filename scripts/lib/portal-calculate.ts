/**
 * Presses Calculate on an estimate the way its Engineer does, through the running portal (NFR-009 run: the cost-details screen needs a calculated estimate, and Calculate is the
 * one path that writes one). The sign-in is the two calls the sign-in page makes (the CSRF token, then the credentials, as `tests/e2e/support/auth.ts` `signInWithoutThePage`),
 * and the Calculate carries the portal's own `Origin`, as a call from a page does. Nothing here prints a password or a cookie.
 */

import { z } from 'zod';

const SIGN_IN_FAILED = 'The sign-in of the measurement Engineer was refused.';

const TOKEN = z.object({ csrfToken: z.string() });
const ANSWER = z.object({ url: z.string() });

/** A cookie jar of the two or three cookies of one sign-in: name to value, attributes ignored (the calls go to one origin). */
export type Jar = Map<string, string>;

function remember(jar: Jar, response: Response): void {
  for (const line of response.headers.getSetCookie()) {
    const pair = line.split(';')[0] ?? '';
    const at = pair.indexOf('=');
    if (at > 0) jar.set(pair.slice(0, at), pair.slice(at + 1));
  }
}

const cookieHeader = (jar: Jar): string => [...jar].map(([name, value]) => `${name}=${value}`).join('; ');

/** Signs in with the e-mail and password and returns the cookies of the session. Throws, with no value in the message, when the portal refuses. */
export async function signInOverHttp(origin: string, email: string, password: string): Promise<Jar> {
  const jar: Jar = new Map();
  const token = await fetch(`${origin}/api/auth/csrf`);
  if (!token.ok) throw new Error(SIGN_IN_FAILED);
  remember(jar, token);
  const parsedToken = TOKEN.safeParse(await token.json());
  if (!parsedToken.success) throw new Error(SIGN_IN_FAILED);
  const { csrfToken } = parsedToken.data;
  const answer = await fetch(`${origin}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader(jar), origin },
    body: new URLSearchParams({ csrfToken, email, password, json: 'true' }),
  });
  remember(jar, answer);
  const parsedAnswer = ANSWER.safeParse(await answer.json());
  if (!answer.ok || !parsedAnswer.success || new URL(parsedAnswer.data.url, origin).searchParams.get('error') !== null) throw new Error(SIGN_IN_FAILED);
  return jar;
}

/** Calculate, as the signed-in owner of the estimate. Throws with the status when the portal does not answer 200. */
export async function calculateOverHttp(origin: string, jar: Jar, estimateId: string): Promise<void> {
  const answer = await fetch(`${origin}/api/v1/estimates/${estimateId}/calculate`, { method: 'POST', headers: { cookie: cookieHeader(jar), origin } });
  if (answer.status !== 200) throw new Error(`Calculate answered ${answer.status}, not 200.`);
}
