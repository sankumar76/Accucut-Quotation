import 'server-only';

import { z } from 'zod';

import { loadOriginEnv } from '../../lib/env';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { clientAddressFrom } from '../auth/client-address';

import { isSameOriginRequest } from './origin-check';
import { internalProblem, malformedProblem, newRequestId, NO_STORE, originRefusedProblem, problemFromAppError, problemResponse, REQUEST_ID_HEADER, validationProblem } from './problem';
import { findRoute, isStateChanging, type HttpMethod } from './route-manifest';

/**
 * The public form of `withRoute` (STORY-09.07; architecture sections 6 and 8): for the API route of a person who has no session, because they cannot sign in (a forgotten password). It is
 * the only other way to declare an API handler, and it takes ONLY a route whose manifest row is `public`; `withRoute` refuses a public row and this refuses every other, both when the
 * module loads, so a route can never be in the wrong one. In this order:
 *
 *   1. a state-changing request must come from the portal's own origin (CSRF, the same check as `withRoute`);
 *   2. the body is parsed with the strict zod schema given (400 malformed, 422 invalid) and the answer with its own strict schema, so a field the schema does not name never leaves;
 *   3. the handler gets the body, the request ID and the client address (the last entry of `X-Forwarded-For`, which our own proxy wrote, or null), and no user: there is none.
 *
 * Every answer, success or problem, carries `Cache-Control: private, no-store` and a request ID; every failure is the `application/problem+json` of `problem.ts`. A failure's log line has the
 * route, the request ID and the kind of failure, and never the message, the body or the cause (coding standards section 4): the body of these routes holds an e-mail address, a token or a password.
 */

export interface PublicHandlerContext<Body> {
  readonly body: Body;
  readonly requestId: string;
  /** The client address as the proxy reported it, or null when none was reported. */
  readonly ipAddress: string | null;
  readonly request: Request;
}

export interface PublicRouteOptions<Output extends z.ZodType, Body extends z.ZodType> {
  /** The route's path as written in the manifest. */
  readonly route: string;
  readonly method: HttpMethod;
  /** JSON body, parsed with this schema. */
  readonly body: Body;
  /** The answer. Use `z.strictObject` so an unknown key is an error; `z.undefined()` with status 204. */
  readonly output: Output;
  /** Default 200. With 204 the answer has no body. */
  readonly status?: number;
  handler(context: PublicHandlerContext<z.output<Body>>): z.input<Output> | Promise<z.input<Output>>;
}

export interface PublicRouteHandler {
  (request: Request): Promise<Response>;
  readonly responseSchema: z.ZodType;
}

const DEFAULT_STATUS = 200;
const NO_CONTENT_STATUS = 204;

class InputRefused extends Error {
  constructor(readonly response: Response) {
    super('The input was refused.');
    this.name = 'InputRefused';
  }
}

class ResponseSchemaError extends Error {
  constructor(readonly route: string) {
    super(`The response of ${route} did not match its schema.`);
    this.name = 'ResponseSchemaError';
  }
}

function answerHeaders(requestId: string): Headers {
  return new Headers({ 'Cache-Control': NO_STORE, [REQUEST_ID_HEADER]: requestId });
}

async function bodyOf(request: Request, requestId: string): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InputRefused(problemResponse(malformedProblem(requestId)));
  }
}

export function withPublicRoute<Output extends z.ZodType, Body extends z.ZodType>(options: PublicRouteOptions<Output, Body>): PublicRouteHandler;
export function withPublicRoute(options: PublicRouteOptions<z.ZodType, z.ZodType>): PublicRouteHandler {
  const row = findRoute(options.route, options.method);
  if (row === undefined) throw new Error(`withPublicRoute: ${options.method} ${options.route} is not in the route manifest.`);
  if (row.roles !== 'public') throw new Error(`withPublicRoute: ${options.route} is not public; use withRoute for a route that needs a session.`);

  async function run(request: Request, requestId: string): Promise<Response> {
    if ((isStateChanging(request.method) || isStateChanging(options.method)) && !isSameOriginRequest(request.headers, loadOriginEnv().APP_ORIGIN)) {
      return problemResponse(originRefusedProblem(requestId));
    }
    const parsed = options.body.safeParse(await bodyOf(request, requestId));
    if (!parsed.success) throw new InputRefused(problemResponse(validationProblem(parsed.error, requestId)));

    const ipAddress = clientAddressFrom(Object.fromEntries(request.headers));
    const result = await options.handler({ body: parsed.data, requestId, ipAddress, request });
    const answer = options.output.safeParse(result);
    if (!answer.success) throw new ResponseSchemaError(options.route);

    const status = options.status ?? DEFAULT_STATUS;
    if (status === NO_CONTENT_STATUS) {
      if (answer.data !== undefined) throw new ResponseSchemaError(options.route);
      return new Response(null, { status, headers: answerHeaders(requestId) });
    }
    return Response.json(answer.data, { status, headers: answerHeaders(requestId) });
  }

  async function handle(request: Request): Promise<Response> {
    const requestId = newRequestId();
    try {
      return await run(request, requestId);
    } catch (error) {
      if (error instanceof InputRefused) return error.response;
      if (error instanceof AppError) {
        const body = problemFromAppError(error, requestId);
        if (body.status >= 500) logger.error({ requestId, route: options.route, method: options.method, errorName: error.name, errorCode: error.code }, 'route failed');
        else logger.warn({ requestId, route: options.route, method: options.method, status: body.status, code: body.code }, 'route refused');
        return problemResponse(body);
      }
      logger.error({ requestId, route: options.route, method: options.method, errorName: error instanceof Error ? error.name : 'NonError' }, 'route failed unexpectedly');
      return problemResponse(internalProblem(requestId));
    }
  }

  return Object.assign(handle, { responseSchema: options.output });
}
