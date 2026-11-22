import { randomBytes } from 'node:crypto';

import { z } from 'zod';

import { SESSION_ENDED_CODE } from '../../lib/auth/session-ended';
import { STEP_UP_FAILED_MESSAGE, STEP_UP_LOCKED_MESSAGE } from '../../lib/auth/step-up';
import { plainUse, type FieldUse } from '../../lib/fields/uses';

import {
  ActiveAdminExistsError,
  ConfigVersionChangedError,
  CalculateBlockedError,
  AppError,
  DatabaseBusyError,
  ExportBusyError,
  FieldInUseError,
  FieldValidationError,
  ForbiddenError,
  MasterInUseError,
  ProcessItemInUseError,
  StepUpFailed,
  StepUpLocked,
  TreeChangedError,
  UnauthorizedError,
  type EstimateUse,
  type FormulaUse,
} from '../../lib/errors';
import type { PartView } from '../../lib/estimate/part-view';
import type { BlockedPart } from '../../lib/estimate/calculate-check';
import { CalculateAckRequiredError } from '../../lib/estimate/calculate-ack-required-error';
import { warningLine } from '../../lib/estimate/warning-copy';

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

/** One row of the 409 `CALCULATE_ACK_REQUIRED`: the code, the part, the field to take the person to, the Sl. No, the name as typed and the sentence. */
export interface AckWarning {
  readonly code: string;
  readonly nodeId: string;
  readonly fieldId: string;
  readonly slNo: string;
  readonly label: string;
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
  /** Extension member of the 409 of a configuration edit made from an older version (STORY-08.02 AC-9): the number of the latest version. */
  readonly currentVersion?: number;
  /** Extension member of the refusal to delete a rate a formula uses (STORY-02.01 AC-4): each formula's column letter and label. */
  readonly usedBy?: ReadonlyArray<FormulaUse>;
  /** Extension member of the refusal to delete a field something uses (STORY-08.04 AC-2): every use, a formula with its text in display form. Admin only (NFR-002). */
  readonly uses?: ReadonlyArray<FieldUse>;
  /** Extension member of the 409 of a parts tree that changed under the person (STORY-05.02 AC-6): the tree as it is now, the same six facts per part as `GET /tree`, and no figure. */
  readonly tree?: ReadonlyArray<PartView>;
  /** Extension member of the 422 of a Calculate that found missing inputs (STORY-05.09 AC-1): each part with its Sl. No, name and missing fields. No value and no figure. */
  readonly parts?: ReadonlyArray<BlockedPart>;
  /** Extension members of the 409 `CALCULATE_ACK_REQUIRED` (STORY-05.12 AC-2): the estimate's input revision, which the acknowledgement sends back, and each row with a 0 in QTY per Assy. No figure. */
  readonly inputsRevision?: number;
  readonly warnings?: ReadonlyArray<AckWarning>;
  /** Extension members of the refusal to delete a customer or a material an open estimate uses (STORY-02.07): the first estimates, and how many there are in all. */
  readonly estimates?: ReadonlyArray<EstimateUse>;
  readonly estimateTotal?: number;
}

/** Fixed words for the refusals, so a role refusal reads the same for every route and every ID asked for (CR-33). */
export const FORBIDDEN_TITLE = 'You do not have access to this.';
export const FORBIDDEN_CODE = 'FORBIDDEN';
export const UNAUTHORIZED_TITLE = 'Sign in to continue.';
export const SESSION_ENDED_PROBLEM_TITLE = 'Your session ended. Sign in again.';
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

/**
 * The 401 of a session that ended (STORY-01.06 AC-4): its own code, so the browser can go to SCR-01 in its "Session ended" state
 * rather than treat it as a visit with no session. Fixed words and no data, like every other 401.
 */
export function sessionEndedProblem(requestId: string): Problem {
  return problem(STATUS_UNAUTHORIZED, SESSION_ENDED_CODE, SESSION_ENDED_PROBLEM_TITLE, requestId);
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
  if (error instanceof UnauthorizedError) return error.code === SESSION_ENDED_CODE ? sessionEndedProblem(requestId) : unauthorizedProblem(requestId);
  if (error instanceof ForbiddenError && error.code === FORBIDDEN_CODE) return forbiddenProblem(requestId);
  // The step-up refusals (STORY-06.14 AC-2, AC-3): fixed words and a fixed code, the same for every wrong case, whatever the message says.
  if (error instanceof StepUpFailed) return problem(error.httpStatus, error.code, STEP_UP_FAILED_MESSAGE, requestId);
  if (error instanceof StepUpLocked) return problem(error.httpStatus, error.code, STEP_UP_LOCKED_MESSAGE, requestId);
  if (error instanceof FieldValidationError) return problem(error.httpStatus, error.code, VALIDATION_TITLE, requestId, error.fields);
  if (error instanceof ActiveAdminExistsError) {
    const base = problem(error.httpStatus, error.code, error.message, requestId);
    return error.currentAdmin === null ? base : { ...base, currentAdmin: error.currentAdmin };
  }
  if (error instanceof ConfigVersionChangedError) return { ...problem(error.httpStatus, error.code, error.message, requestId), currentVersion: error.currentVersion };
  if (error instanceof ProcessItemInUseError) {
    return { ...problem(error.httpStatus, error.code, error.message, requestId), usedBy: error.usedBy.map(({ letter, label }) => ({ letter, label })) };
  }
  if (error instanceof FieldInUseError) return { ...problem(error.httpStatus, error.code, error.message, requestId), uses: error.uses.map(plainUse) };
  if (error instanceof CalculateBlockedError) {
    // Named field by field, so a part can never carry more than its Sl. No, name and missing fields even if the service one day hands over a richer record (NFR-002).
    const parts = error.parts.map(({ nodeId, slNo, name, fields }) => ({ nodeId, slNo, name, fields: fields.map(({ fieldId, label }) => ({ fieldId, label })) }));
    return { ...problem(error.httpStatus, error.code, error.message, requestId), parts };
  }
  if (error instanceof CalculateAckRequiredError) {
    // Built key by key, so a warning can never carry more than its code, part, Sl. No, name and sentence even if the service one day hands over a richer record (NFR-002). The same body for every role.
    const warnings = error.warnings.map(({ code, nodeId, slNo, label }) => ({ code, nodeId, fieldId: error.quantityFieldId, slNo, label, message: warningLine(slNo, label) }));
    return { ...problem(error.httpStatus, error.code, error.message, requestId), inputsRevision: error.inputsRevision, warnings };
  }
  if (error instanceof TreeChangedError) {
    // Named field by field, so a part can never carry more than the seven facts of the tree (the kind holds no figure, CR-01 item 3A) even if the service one day hands over a richer record.
    const tree = error.tree.map(({ id, parentId, slNo, label, nodeKind, completeness, revision }) => ({ id, parentId, slNo, label, nodeKind, completeness, revision }));
    return { ...problem(error.httpStatus, error.code, error.message, requestId), tree };
  }
  if (error instanceof MasterInUseError) {
    return {
      ...problem(error.httpStatus, error.code, error.message, requestId),
      estimates: error.estimates.map(({ code, status }) => ({ code, status })),
      estimateTotal: error.total,
    };
  }
  // A busy answer keeps its own fixed words: they tell the person to try again, which is true and holds nothing of the failure.
  if (error.httpStatus >= STATUS_INTERNAL && !(error instanceof DatabaseBusyError) && !(error instanceof ExportBusyError)) {
    return problem(error.httpStatus, error.code, INTERNAL_TITLE, requestId);
  }
  return problem(error.httpStatus, error.code, error.message, requestId);
}

export function internalProblem(requestId: string): Problem {
  return problem(STATUS_INTERNAL, INTERNAL_CODE, INTERNAL_TITLE, requestId);
}

/** The Response for a problem: its status, the problem media type, `no-store` and the request ID in a header. */
export function problemResponse(body: Problem, extraHeaders: Readonly<Record<string, string>> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: body.status,
    headers: { 'Content-Type': PROBLEM_CONTENT_TYPE, 'Cache-Control': NO_STORE, [REQUEST_ID_HEADER]: body.requestId, ...extraHeaders },
  });
}
