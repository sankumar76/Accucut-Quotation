/**
 * Typed application errors. Throw one of these and let the single HTTP wrapper (`withRoute`, EPIC-01)
 * map it to a response; never swallow an error silently (coding standards section 10).
 *
 * Messages must be safe to show: no secret, no personal data, and no cost figure.
 */

export interface AppErrorOptions {
  /** Machine-readable code. Defaults to the subclass's code. */
  readonly code?: string;
  /** The underlying error, kept for the server log and never sent to the client. */
  readonly cause?: unknown;
}

export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, httpStatus: number, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(options.code ?? 'VALIDATION_FAILED', 422, message, options.cause);
  }
}

/** One message for one field of a form, as the API returns it (`errors` in the problem body). */
export interface FieldProblem {
  readonly field: string;
  readonly message: string;
}

/** A 422 that names the fields at fault, so a form shows each message under its own field. Messages are safe to show. */
export class FieldValidationError extends ValidationError {
  constructor(readonly fields: ReadonlyArray<FieldProblem>, options: AppErrorOptions = {}) {
    super(fields.map((entry) => entry.message).join(' '), options);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Sign in to continue.', options: AppErrorOptions = {}) {
    super(options.code ?? 'UNAUTHORIZED', 401, message, options.cause);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this.', options: AppErrorOptions = {}) {
    super(options.code ?? 'FORBIDDEN', 403, message, options.cause);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found.', options: AppErrorOptions = {}) {
    super(options.code ?? 'NOT_FOUND', 404, message, options.cause);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(options.code ?? 'CONFLICT', 409, message, options.cause);
  }
}

/** The `code` of the 429 of a counted try that is blocked (STORY-01.05 AC-6). The browser compares with it too. */
export const TOO_MANY_ATTEMPTS_CODE = 'TOO_MANY_ATTEMPTS';

/**
 * Too many tries on something that is counted: 429 (STORY-01.05 AC-6: five wrong current passwords on the change form block it). The message
 * is the caller's, so the minutes it names are written once, from the policy (`BLOCK_MINUTES`), and never typed here.
 */
export class TooManyAttemptsError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(options.code ?? TOO_MANY_ATTEMPTS_CODE, 429, message, options.cause);
  }
}

/** The `code` of the 422 of a wrong password given for a protected action (STORY-06.14 AC-2, ADR-009). The browser compares with it to show SCR-18's message. */
export const STEP_UP_FAILED_CODE = 'STEP_UP_FAILED';

/** The `code` of the 429 of a step-up that is blocked after five wrong passwords (STORY-06.14 AC-3, assumption A-1). */
export const STEP_UP_LOCKED_CODE = 'STEP_UP_LOCKED';

/**
 * The password given with a protected action is not the signed-in person's own (STORY-06.14 AC-2). 422, never 401: a 401 reads as a
 * lost session and the screen would sign the person out (ADR-009). The words are the caller's, one sentence for every wrong case.
 */
export class StepUpFailed extends AppError {
  constructor(message: string) {
    super(STEP_UP_FAILED_CODE, 422, message);
  }
}

/** The step-up of this person is blocked, even for the right password, until the block ends (STORY-06.14 AC-3): 429. */
export class StepUpLocked extends AppError {
  constructor(message: string) {
    super(STEP_UP_LOCKED_CODE, 429, message);
  }
}

/** A password that does not meet the rule (STORY-01.05 AC-2, FR-098): the 422 names the part that failed, under the field it belongs to. */
export const PASSWORD_RULE_CODE = 'PASSWORD_RULE';

/** The current password given on the change form is not the person's (STORY-01.05 AC-3): a 422 under the field, never a 401, which a screen reads as a lost session. */
export const CURRENT_PASSWORD_WRONG_CODE = 'CURRENT_PASSWORD_WRONG';

/** The person must set a new password before anything else (STORY-01.05 AC-5, FR-004): every route but the change is refused with this code. */
export const PASSWORD_CHANGE_REQUIRED_CODE = 'PASSWORD_CHANGE_REQUIRED';

/** The one Admin the portal allows is already active (STORY-01.04 AC-3, CONSTRAINT-04). */
export const ADMIN_ALREADY_ACTIVE_CODE = 'ADMIN_ALREADY_ACTIVE';

/**
 * A second active Admin was asked for. The sentence is fixed; the current Admin is named in `currentAdmin` so the page can
 * say who it is (SCR-14). It is null when the Admin could not be read back, which only a race between two requests causes.
 */
export class ActiveAdminExistsError extends ConflictError {
  constructor(readonly currentAdmin: { readonly id: string; readonly name: string } | null) {
    super('There is already an active Admin. Only one Admin can be active.', { code: ADMIN_ALREADY_ACTIVE_CODE });
  }
}

/** A name that another master entry (a rate, a material or a treatment) already has, ignoring letter case (STORY-02.01 AC-2, STORY-02.03 AC-2, STORY-02.05 AC-2): said under the name field. */
export const NAME_TAKEN_CODE = 'NAME_TAKEN';

/** A treatment name the system keeps for itself ("Other", "Not applicable") in any letter case (STORY-02.05 AC-2; architecture section 4.9). The message does not name the hidden entry. */
export const NAME_RESERVED_CODE = 'NAME_RESERVED';

/** A change or a delete was asked of a locked system entry, the treatment "Other" (STORY-02.05 AC-3): refused with 409, nothing changes. */
export const TREATMENT_LOCKED_CODE = 'TREATMENT_LOCKED';

/** A rate name a formula could read as something else, alone or in the set of names (DEF-006, `rateNameIssues`, `rateSetIssues`). */
export const NAME_REFUSED_CODE = 'RATE_NAME_REFUSED';

/** A rate was deleted that a formula of the current configuration uses (STORY-02.01 AC-4). */
export const PROCESS_ITEM_IN_USE_CODE = 'PROCESS_ITEM_IN_USE';

/** One formula that uses a rate, as the refusal names it: the field's column letter and its label. */
export interface FormulaUse {
  readonly letter: string;
  readonly label: string;
}

/**
 * The refusal of deleting a rate that a formula uses: 409, with the formulas named so the screen can list them. The message is
 * the sentence of SCR-11 and holds the rate's name, which is structure and not a value (ADR-014); the formulas' text is not
 * carried, only each field's letter and label.
 */
export class ProcessItemInUseError extends ConflictError {
  constructor(
    rateName: string,
    readonly usedBy: ReadonlyArray<FormulaUse>,
  ) {
    super(`${rateName} cannot be deleted while a formula uses it`, { code: PROCESS_ITEM_IN_USE_CODE });
  }
}

/** The process was started with a missing or invalid setting. Never carries a setting's value. */
export class ConfigurationError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(options.code ?? 'CONFIGURATION_INVALID', 500, message, options.cause);
  }
}

/**
 * The database did not answer in time: a request waited too long for a connection, or PostgreSQL cancelled
 * a statement that ran too long (architecture ruling R4). `withRoute` maps it to 503 `DATABASE_BUSY`; a
 * script exits with an error. The original error is kept as the cause for the log and never sent.
 */
export class DatabaseBusyError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super(options.code ?? 'DATABASE_BUSY', 503, 'The service is busy. Try again in a moment.', options.cause);
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
