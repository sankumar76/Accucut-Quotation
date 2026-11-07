import { randomBytes } from 'node:crypto';

import { z } from 'zod';

import {
  ActiveAdminExistsError,
  AppError,
  DatabaseBusyError,
  FieldValidationError,
  ForbiddenError,
  ProcessItemInUseError,
  UnauthorizedError,
  type FormulaUse,
} from '../../lib/errors';

/**
 * The error answer of every API route (architecture section 6, "Error model"): `application/problem+json`
 * (RFC 9457), built in this one place from an `AppError` or a failure of the input, with a request ID the person can
 * read out and the log carries. Nothing technical reaches the body: no stack, no query, no setting, no cause.
 */

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';
export const NO_STORE = 'private, no-store';
export const REQUEST_ID_HEADER = 'X-Request-Id';

const REQUEST_ID_BYTES = 4;

/** `req-` and eight hex digits, the form SCR-26 shows (`req-7f3a91`). Made here, never taken from the request. */
export function newRequestId(): string {
  return `req-${randomBytes(REQUEST_ID_BYTES).toString('hex')}`;
}

export interface ProblemDetail {
  readonly field: string;
  readonly message: string;
}

export interface Problem {
  readonly type: 'about:blank';
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly errors?: ReadonlyArray<ProblemDetail>;
  /** Extension member of a second-Admin refusal (RFC 9457): who holds the one place. Present only on that 409. */
  readonly currentAdmin?: { readonly id: string; readonly name: string };
  /** Extension member of the refusal to delete a rate a formula uses (STORY-02.01 AC-4): each formula's column letter and label. */
  readonly usedBy?: ReadonlyArray<FormulaUse>;
}

/** Fixed words for the refusals, so a role refusal reads the same for every route and every ID asked for (CR-33). */
export const FORBIDDEN_TITLE = 'You do not have access to this.';
export const FORBIDDEN_CODE = 'FORBIDDEN';
export const UNAUTHORIZED_TITLE = 'Sign in to continue.';
export const ORIGIN_REFUSED_CODE = 'ORIGIN_REFUSED';
export const ORIGIN_REFUSED_TITLE = 'This request did not come from the portal.';
export const MALFORMED_CODE = 'MALFORMED_REQUEST';
export const MALFORMED_TITLE = 'The request could not be read.';
export const VALIDATION_CODE = 'VALIDATION_FAILED';
export const VALIDATION_TITLE = 'Check the values and try again.';
export const INTERNAL_CODE = 'INTERNAL_ERROR';
export const INTERNAL_TITLE = 'Something went wrong on our side.';

const STATUS_FORBIDDEN = 403;
const STATUS_BAD_REQUEST = 400;
const STATUS_UNPROCESSABLE = 422;
const STATUS_INTERNAL = 500;
const STATUS_UNAUTHORIZED = 401;

export function problem(status: number, code: string, title: string, requestId: string, errors?: ReadonlyArray<ProblemDetail>): Problem {
  return { type: 'about:blank', title, status, code, requestId, ...(errors === undefined ? {} : { errors }) };
}

/** The 403 of a role that the manifest does not list: the same body for every route, apart from the request ID. */
export function forbiddenProblem(requestId: string): Problem {
  return problem(STATUS_FORBIDDEN, FORBIDDEN_CODE, FORBIDDEN_TITLE, requestId);
}

export function unauthorizedProblem(requestId: string): Problem {
  return problem(STATUS_UNAUTHORIZED, 'UNAUTHORIZED', UNAUTHORIZED_TITLE, requestId);
}

export function originRefusedProblem(requestId: string): Problem {
  return problem(STATUS_FORBIDDEN, ORIGIN_REFUSED_CODE, ORIGIN_REFUSED_TITLE, requestId);
}

export function malformedProblem(requestId: string): Problem {
  return problem(STATUS_BAD_REQUEST, MALFORMED_CODE, MALFORMED_TITLE, requestId);
}

/** A failed zod parse as a 422 with one entry per issue. Zod's messages name what was expected, never the value given. */
export function validationProblem(error: z.ZodError, requestId: string): Problem {
  const errors = error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
  return problem(STATUS_UNPROCESSABLE, VALIDATION_CODE, VALIDATION_TITLE, requestId, errors);
}

/**
 * An application error as a problem. A 401 and a role 403 use the fixed words whatever the message says; a 5xx other
 * than "the database is busy" uses the generic words, because its message can name a setting.
 */
export function problemFromAppError(error: AppError, requestId: string): Problem {
  if (error instanceof UnauthorizedError) return unauthorizedProblem(requestId);
  if (error instanceof ForbiddenError && error.code === FORBIDDEN_CODE) return forbiddenProblem(requestId);
  if (error instanceof FieldValidationError) return problem(error.httpStatus, error.code, VALIDATION_TITLE, requestId, error.fields);
  if (error instanceof ActiveAdminExistsError) {
    const base = problem(error.httpStatus, error.code, error.message, requestId);
    return error.currentAdmin === null ? base : { ...base, currentAdmin: error.currentAdmin };
  }
  if (error instanceof ProcessItemInUseError) {
    return { ...problem(error.httpStatus, error.code, error.message, requestId), usedBy: error.usedBy.map(({ letter, label }) => ({ letter, label })) };
  }
  if (error.httpStatus >= STATUS_INTERNAL && !(error instanceof DatabaseBusyError)) {
    return problem(error.httpStatus, error.code, INTERNAL_TITLE, requestId);
  }
  return problem(error.httpStatus, error.code, error.message, requestId);
}

export function internalProblem(requestId: string): Problem {
  return problem(STATUS_INTERNAL, INTERNAL_CODE, INTERNAL_TITLE, requestId);
}

/** The Response for a problem: its status, the problem media type, `no-store` and the request ID in a header. */
export function problemResponse(body: Problem): Response {
  return new Response(JSON.stringify(body), {
    status: body.status,
    headers: { 'Content-Type': PROBLEM_CONTENT_TYPE, 'Cache-Control': NO_STORE, [REQUEST_ID_HEADER]: body.requestId },
  });
}
