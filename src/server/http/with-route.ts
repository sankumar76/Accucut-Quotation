import 'server-only';

import { z } from 'zod';

import { loadOriginEnv } from '../../lib/env';
import { AppError, ForbiddenError, isAppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { requireUser, type AuthenticatedUser } from '../auth/session';

import { isSameOriginRequest } from './origin-check';
import {
  internalProblem,
  malformedProblem,
  newRequestId,
  NO_STORE,
  originRefusedProblem,
  problemFromAppError,
  problemResponse,
  REQUEST_ID_HEADER,
  validationProblem,
} from './problem';
import { allowsRole, findRoute, isStateChanging, type HttpMethod } from './route-manifest';

/**
 * The only way to declare an API handler (STORY-01.02 AC-1; architecture sections 4.1, 6 and 8). Every handler in
 * `src/app/api/v1/**` is `export const GET = withRoute({ ... })`, and an architecture test fails a route file that is
 * not. In this order, and nothing earlier can be skipped:
 *
 *   1. a state-changing request must come from the portal's own origin (CSRF);
 *   2. the session: `requireUser()` reads `users` on every request, so a deactivated person is refused at once (401);
 *   3. the role, taken from the route's row in the manifest, before anything is looked up or parsed (CR-33): a role the
 *      row does not list gets 403 with a fixed body, whatever ID was asked for;
 *   4. the input: query, path parameters and body are parsed with the zod schemas given (400 malformed, 422 invalid);
 *   5. the handler;
 *   6. the answer is parsed with its own strict schema, so a field the schema does not name never leaves (NFR-002).
 *
 * Every answer, success or problem, carries `Cache-Control: private, no-store` and a request ID; every failure is the
 * `application/problem+json` of `problem.ts`, with nothing technical in it. Server Actions are not used (ADR-010).
 *
 * A public route (sign-in, health) does not go through this yet: next-auth's route has its own CSRF token, and the
 * health route arrives with its story, which adds the public form of this wrapper.
 */

export interface HandlerContext<Query, Body, Params> {
  readonly user: AuthenticatedUser;
  readonly query: Query;
  readonly body: Body;
  readonly params: Params;
  readonly requestId: string;
  readonly request: Request;
}

export interface RouteOptions<Output extends z.ZodType, Query extends z.ZodType, Body extends z.ZodType, Params extends z.ZodType> {
  /** The route's path as written in the manifest, for example `/api/v1/me`. */
  readonly route: string;
  readonly method: HttpMethod;
  /** Query string, one value per name. */
  readonly query?: Query;
  /** JSON body. Parsed only when the schema is given. */
  readonly body?: Body;
  /** Path parameters of a dynamic route. */
  readonly params?: Params;
  /** The answer. Use `z.strictObject` so an unknown key is an error. */
  readonly output: Output;
  /** Default 200. With 204 the answer has no body: the output schema is `z.undefined()` and the handler returns nothing. */
  readonly status?: number;
  handler(context: HandlerContext<z.output<Query>, z.output<Body>, z.output<Params>>): z.input<Output> | Promise<z.input<Output>>;
}

/** What Next.js passes a route handler as its second argument. */
export interface NextRouteContext {
  readonly params: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}

/**
 * What `withRoute` returns: the handler Next.js calls, and the one schema its answer is parsed with. The schema is exposed
 * so the tests can hold every route an Engineer may call to "exactly one strict response schema" by reading the handler
 * itself, with no list to keep in step (STORY-01.03 AC-2, AC-6).
 */
export interface RouteHandler {
  (request: Request, context?: NextRouteContext): Promise<Response>;
  readonly responseSchema: z.ZodType;
}

const NO_INPUT = z.undefined();
const DEFAULT_STATUS = 200;
const NO_CONTENT_STATUS = 204;
const UNAUTHORIZED_STATUS = 401;

class InputRefused extends Error {
  constructor(readonly response: Response) {
    super('The input was refused.');
    this.name = 'InputRefused';
  }
}

class ResponseSchemaError extends Error {
  constructor(readonly route: string, readonly paths: ReadonlyArray<string>) {
    super(`The response of ${route} did not match its schema.`);
    this.name = 'ResponseSchemaError';
  }
}

/**
 * What the log may say about a failure: its class name, its application code when it has one and, for a response that
 * did not fit its schema, the names of the fields that did not. Never the message, stack or cause (STD-01).
 */
function describeFailure(error: unknown): { readonly errorName: string; readonly errorCode: string | undefined; readonly schemaPaths?: ReadonlyArray<string> } {
  const base = { errorName: error instanceof Error ? error.name : 'NonError', errorCode: isAppError(error) ? error.code : undefined };
  return error instanceof ResponseSchemaError ? { ...base, schemaPaths: error.paths } : base;
}

function jsonResponse(body: unknown, status: number, requestId: string): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': NO_STORE, [REQUEST_ID_HEADER]: requestId } });
}

function noContentResponse(requestId: string): Response {
  return new Response(null, { status: NO_CONTENT_STATUS, headers: { 'Cache-Control': NO_STORE, [REQUEST_ID_HEADER]: requestId } });
}

function queryOf(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams);
}

async function bodyOf(request: Request, requestId: string): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InputRefused(problemResponse(malformedProblem(requestId)));
  }
}

function parseInput(schema: z.ZodType, value: unknown, requestId: string): unknown {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new InputRefused(problemResponse(validationProblem(parsed.error, requestId)));
  return parsed.data;
}

export function withRoute<
  Output extends z.ZodType,
  Query extends z.ZodType = z.ZodUndefined,
  Body extends z.ZodType = z.ZodUndefined,
  Params extends z.ZodType = z.ZodUndefined,
>(options: RouteOptions<Output, Query, Body, Params>): RouteHandler;
export function withRoute(options: RouteOptions<z.ZodType, z.ZodType, z.ZodType, z.ZodType>): RouteHandler {
  const row = findRoute(options.route, options.method);
  // A handler with no row, or on a public row, is a mistake in the code, found when the module loads and by the tests.
  if (row === undefined) throw new Error(`withRoute: ${options.method} ${options.route} is not in the route manifest.`);
  if (row.roles === 'public') throw new Error(`withRoute: ${options.route} is public; this wrapper is for routes that need a session.`);
  const allowed = row;

  async function run(request: Request, context: NextRouteContext | undefined, requestId: string): Promise<Response> {
    if ((isStateChanging(request.method) || isStateChanging(options.method)) && !isSameOriginRequest(request.headers, loadOriginEnv().APP_ORIGIN)) {
      return problemResponse(originRefusedProblem(requestId));
    }
    const user = await requireUser();
    if (!allowsRole(allowed, user.role)) throw new ForbiddenError();

    const query = parseInput(options.query ?? NO_INPUT, options.query === undefined ? undefined : queryOf(request), requestId);
    const params = parseInput(options.params ?? NO_INPUT, options.params === undefined ? undefined : await context?.params, requestId);
    const body = parseInput(options.body ?? NO_INPUT, options.body === undefined ? undefined : await bodyOf(request, requestId), requestId);

    const result = await options.handler({ user, query, body, params, requestId, request });
    const answer = options.output.safeParse(result);
    if (!answer.success) throw new ResponseSchemaError(options.route, answer.error.issues.map((issue) => issue.path.join('.')));
    const status = options.status ?? DEFAULT_STATUS;
    if (status === NO_CONTENT_STATUS) {
      // A 204 has no body: whatever the handler returned would be dropped, so returning anything is a mistake in the code.
      if (answer.data !== undefined) throw new ResponseSchemaError(options.route, []);
      return noContentResponse(requestId);
    }
    return jsonResponse(answer.data, status, requestId);
  }

  async function handle(request: Request, context?: NextRouteContext): Promise<Response> {
    const requestId = newRequestId();
    try {
      return await run(request, context, requestId);
    } catch (error) {
      if (error instanceof InputRefused) return error.response;
      if (error instanceof AppError) {
        const body = problemFromAppError(error, requestId);
        if (body.status >= 500) logger.error({ requestId, route: options.route, method: options.method, ...describeFailure(error) }, 'route failed');
        else if (body.status === UNAUTHORIZED_STATUS) logger.debug({ requestId, route: options.route, method: options.method }, 'signed-out request');
        else logger.warn({ requestId, route: options.route, method: options.method, status: body.status, code: body.code }, 'route refused');
        return problemResponse(body);
      }
      // The log gets the kind of failure and the request ID, and the body only what went wrong in general. Neither carries the
      // message, the stack or the cause: they can hold an e-mail address, a value from a query or a rate (coding standards section 4).
      logger.error({ requestId, route: options.route, method: options.method, ...describeFailure(error) }, 'route failed unexpectedly');
      return problemResponse(internalProblem(requestId));
    }
  }

  return Object.assign(handle, { responseSchema: options.output });
}
