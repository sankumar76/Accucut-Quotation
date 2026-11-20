import { decode, type JWT } from 'next-auth/jwt';

import { loadAppEnv } from '../../lib/env';
import { logger as sharedLogger } from '../../lib/logger';
import { sessionCookieName } from '../auth/session-cookie';
import { isWithinSession, sessionTokenSchema } from '../auth/session-token';
import { newRequestId, REQUEST_ID_HEADER } from '../http/problem';

/**
 * Every page or component that throws while rendering is one `error` line in the log (STORY-10.09a AC-2, AC-8, AC-9; NFR-024, NFR-006, NFR-028; architecture section 9.4).
 * `onRequestError` in `src/instrumentation.ts` hands the error here. The line holds:
 *
 *   - the time (the logger adds it) and a request ID: the `X-Request-Id` header when the request has one in the form this app makes, else a new one;
 *   - the route's pattern (`/estimates/[id]`, never the address, whose query string can hold anything), the method, the kind of route and, for a render, which part of it;
 *   - the class of the error and, when the framework gave one, its digest (a hash it makes of the error, which says nothing of the message);
 *   - the user ID, when the person was signed in. It is read from the session cookie's token, **with no database read**: the session is a JWT (ADR-009) whose `sub` is the user ID, so
 *     the hook decodes the token and checks its signature with the auth secret (the decode `next-auth` itself uses), validates it with `sessionTokenSchema` and the 12 hours of
 *     `isWithinSession`. When there is no cookie, or the token is expired, invalid or unreadable, `userId` is left out and the line says why in `userIdAbsent`.
 *
 * It never logs a body, a cookie or a header value, and never the error's message, stack or cause (a message can hold an e-mail address, a connection string or a value from a request,
 * coding standards section 4). The cookie is read here and goes no further: the decode is in its own `try/catch`, and so is everything else, so the hook can never throw.
 */

/** What Next.js gives `onRequestError` about the request. Only the method and two headers are read; the path (it carries the query string) is never logged. */
export interface FailedRequest {
  readonly path: string;
  readonly method: string;
  readonly headers: Readonly<NodeJS.Dict<string | string[]>>;
}

/** What Next.js gives `onRequestError` about the route. */
export interface FailedRequestContext {
  readonly routePath: string;
  readonly routeType: string;
  readonly routerKind: string;
  readonly renderSource?: string | undefined;
}

export interface RequestErrorDependencies {
  /** The line goes here, at `error`. */
  readonly logError: (fields: Readonly<Record<string, string>>, message: string) => void;
  /** `AUTH_SECRET`. May throw (the settings are missing); the hook then logs the line without a user. */
  readonly secret: () => string;
  /** True in a production build: the session cookie is `__Secure-` prefixed. */
  readonly production: boolean;
  readonly now: () => Date;
  readonly newRequestId: () => string;
  /** The decode `next-auth` uses for the session cookie; it throws for a token that is expired, tampered with or not a token. */
  readonly decodeToken: (token: string, secret: string) => Promise<JWT | null>;
}

/** A request ID of the form this app makes (`req-0a1b2c3d`) and nothing longer or wider: a header is the caller's, so it is not copied into the log as it comes. */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const METHOD_PATTERN = /^[A-Z]{1,10}$/;
/** The digest Next.js makes of an error is a short string of digits (or a framework code of letters and underscores); anything else is not logged. */
const DIGEST_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const ROUTE_PATTERN_MAX_LENGTH = 200;
const UNKNOWN = 'unknown';

function headerValue(headers: FailedRequest['headers'], name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== wanted) continue;
    return typeof value === 'string' ? value : value?.[0];
  }
  return undefined;
}

function requestIdOf(request: FailedRequest, newId: () => string): string {
  const supplied = headerValue(request.headers, REQUEST_ID_HEADER);
  return supplied !== undefined && REQUEST_ID_PATTERN.test(supplied) ? supplied : newId();
}

/** The value of the session cookie in a `Cookie` header, or undefined. Only the one named cookie is looked at; nothing else of the header is kept. */
function sessionCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  if (cookieHeader === undefined) return undefined;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      const value = part.slice(separator + 1).trim();
      return value === '' ? undefined : value;
    }
  }
  return undefined;
}

/** Why a line has no user ID: there was no session cookie at all, or there was one that does not name a person now (expired, invalid or unreadable). */
type UserIdAbsent = 'no-cookie' | 'unreadable-token';

type WhoIsIt = { readonly userId: string } | { readonly userIdAbsent: UserIdAbsent };

/**
 * The user ID in the request's session cookie, with no database read. Never throws: any failure of the decode, the settings or the checks is "unreadable".
 */
async function whoIsIt(request: FailedRequest, dependencies: RequestErrorDependencies): Promise<WhoIsIt> {
  const cookie = sessionCookieValue(headerValue(request.headers, 'cookie'), sessionCookieName(dependencies.production));
  if (cookie === undefined) return { userIdAbsent: 'no-cookie' };
  try {
    const payload = await dependencies.decodeToken(cookie, dependencies.secret());
    const claims = sessionTokenSchema.safeParse(payload);
    if (!claims.success || !isWithinSession(claims.data.signedAt, dependencies.now())) return { userIdAbsent: 'unreadable-token' };
    return { userId: claims.data.sub };
  } catch {
    // The reason is not logged: an error from the decode can carry part of the token.
    return { userIdAbsent: 'unreadable-token' };
  }
}

function digestOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return undefined;
  const { digest } = error;
  return typeof digest === 'string' && DIGEST_PATTERN.test(digest) ? digest : undefined;
}

/**
 * Logs one `error` line for a request that failed in the framework. Resolves whatever happens: a decode that throws, a logger that throws, settings that are missing.
 */
export async function logRequestError(error: unknown, request: FailedRequest, context: FailedRequestContext, dependencies: RequestErrorDependencies): Promise<void> {
  try {
    const who = await whoIsIt(request, dependencies);
    const digest = digestOf(error);
    const fields: Record<string, string> = {
      requestId: requestIdOf(request, dependencies.newRequestId),
      routePath: context.routePath.slice(0, ROUTE_PATTERN_MAX_LENGTH),
      routeType: context.routeType,
      method: METHOD_PATTERN.test(request.method) ? request.method : UNKNOWN,
      errorName: error instanceof Error ? error.name : 'NonError',
      ...(digest === undefined ? {} : { digest }),
      ...(context.renderSource === undefined ? {} : { renderSource: context.renderSource }),
      ...who,
    };
    dependencies.logError(fields, context.routeType === 'render' ? 'page render failed' : 'request failed');
  } catch {
    // Nothing left to say it to: the hook must never throw into the framework.
  }
}

/** The real dependencies: the shared pino logger, `AUTH_SECRET` from the validated settings, the system clock and `next-auth`'s own decode. */
export function productionRequestErrorDependencies(): RequestErrorDependencies {
  return {
    logError: (fields, message) => sharedLogger.error(fields, message),
    secret: () => loadAppEnv().AUTH_SECRET,
    production: process.env.NODE_ENV === 'production',
    now: () => new Date(),
    newRequestId,
    decodeToken: (token, secret) => decode({ token, secret }),
  };
}
