import { blockedSentence, type FieldUse } from './fields/uses';
import { blockedSummary, CALCULATE_BLOCKED_CODE } from './estimate/calculate-words';
import type { PartView } from './estimate/part-view';
import type { BlockedPart } from './estimate/calculate-check';

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

/** A body or a file over the size a route accepts (STORY-05.07: an upload over its ceiling, or a picture of 200 KB or more): 413. The message is safe to show. */
export class PayloadTooLargeError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(options.code ?? 'PAYLOAD_TOO_LARGE', 413, message, options.cause);
  }
}

/** A file whose content is not one of the kinds a route accepts (STORY-05.07: a picture that is not a PNG, JPEG or GIF by its content, a WebP included, which the browser converts before it is sent, DL-237): 415. */
export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(options.code ?? 'UNSUPPORTED_MEDIA_TYPE', 415, message, options.cause);
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

/**
 * A reset link that is used, expired, unknown, or for a person who is not active (STORY-09.07 AC-7): 400. One class, one code and one message for all four, so the answer
 * cannot tell them apart and a person holding a token learns nothing about it. The message is the caller's (SCR-02's sentence).
 */
export class ResetLinkInvalidError extends AppError {
  constructor(message: string, code: string) {
    super(code, 400, message);
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

/** The `code` of the 409 of a configuration edit made from a version that is no longer the latest (STORY-08.02 AC-9). */
export const CONFIG_VERSION_CHANGED_CODE = 'CONFIG_VERSION_CHANGED';

/**
 * Another save made a newer configuration version after this edit began (STORY-08.02 AC-9): nothing was stored and nothing was overwritten. `currentVersion` is the number of the version that is the latest now,
 * so the screen can say so. It is a number, not a formula and not a rate, so it may sit in the problem body.
 */
export class ConfigVersionChangedError extends ConflictError {
  constructor(
    readonly currentVersion: number,
    message: string,
  ) {
    super(message, { code: CONFIG_VERSION_CHANGED_CODE });
  }
}

/** The `code` of the 409 of a checkpoint name that another checkpoint has, in any letter case (STORY-08.06 AC-2). The screen shows the sentence under the name field. */
export const CHECKPOINT_NAME_TAKEN_CODE = 'CHECKPOINT_NAME_TAKEN';

/** The `code` of the 409 of a revert to a version whose content is the current configuration already (STORY-08.06 AC-4): nothing would change, and no password was asked for. */
export const NOTHING_TO_REVERT_CODE = 'NOTHING_TO_REVERT';

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

/** A treatment or material name the system keeps for itself ("Other" for a treatment, "Not applicable" for both) in any letter case (STORY-02.05 AC-2, STORY-02.06 AC-6; architecture section 4.9). The message does not name the hidden entry. */
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

/** A field was deleted that a formula, a hide-when-zero rule, a visibility rule or a stage total uses (STORY-08.04 AC-2). The code of the 409, which the dialog compares with. */
export const FIELD_IN_USE_CODE = 'FIELD_IN_USE';

/**
 * The refusal of deleting a field that something uses: 409, with every use named so the dialog can list them and link each formula to SCR-18. The message is the SCR-20 sentence ("Cannot delete AL Cutting Cost
 * yet. 1 formula uses this field."). **Restricted** (NFR-002): a formula use holds the formula's text in display form, so the only route that raises it is the Admin's.
 */
export class FieldInUseError extends ConflictError {
  constructor(
    letter: string,
    label: string,
    readonly uses: ReadonlyArray<FieldUse>,
  ) {
    super(blockedSentence(letter, label, uses), { code: FIELD_IN_USE_CODE });
  }
}

/** The `code` of the 409 of a change to a parts tree that is no longer as the person saw it (STORY-05.02 AC-6). */
export const TREE_CHANGED_CODE = 'TREE_CHANGED';

/**
 * A part, or the count of parts under it, is no longer as the person saw it: another change got there first, so nothing was written. 409, and the body carries the
 * tree as it is now (the same cost-free shape as a read, `tree`), so the screen can show it. It is raised only after the estimate was found to be the person's,
 * so it never tells a stranger anything.
 */
export class TreeChangedError extends ConflictError {
  constructor(readonly tree: ReadonlyArray<PartView>) {
    super('The parts were changed by someone else. The tree has been refreshed. Check it and try again.', { code: TREE_CHANGED_CODE });
  }
}

/**
 * Calculate found a part with a missing input (STORY-05.09 AC-1; FR-055): 422, nothing was written. The body names each part with its Sl. No and name and each missing
 * field by ID and label, so the screen can list them and link to them (`parts`), and nothing else: no value, rate or figure is carried (NFR-002). It is raised only after the
 * estimate was found to be the person's and a draft, so it tells a stranger nothing.
 */
export class CalculateBlockedError extends ValidationError {
  constructor(readonly parts: ReadonlyArray<BlockedPart>) {
    super(blockedSummary(parts.length), { code: CALCULATE_BLOCKED_CODE });
  }
}

/** A customer was deleted while a Draft or Prepared estimate uses it (STORY-02.07 AC-2, BR-053): 409, nothing changes. */
export const CUSTOMER_IN_USE_CODE = 'CUSTOMER_IN_USE';

/** A material was deleted while a Draft or Prepared estimate uses it (STORY-02.07 AC-3, BR-053): 409, nothing changes. */
export const MATERIAL_IN_USE_CODE = 'MATERIAL_IN_USE';

/** One open estimate that uses a customer or a material, as the refusal names it: the task's code and the estimate's status. Neither is a cost figure. */
export interface EstimateUse {
  readonly code: string;
  readonly status: 'DRAFT' | 'PREPARED';
}

/**
 * The refusal of deleting a customer or a material that a Draft or Prepared estimate uses: 409, with the estimates named so the screen can list them
 * (architecture section 6, "409 with the open estimates using it"). `estimates` holds the first few only; `total` is how many there are in all, so the
 * screen can say "and N more". The message holds the master's own name, which is structure and not a value (ADR-014); no rate, price or figure is carried.
 */
export class MasterInUseError extends ConflictError {
  constructor(
    code: typeof CUSTOMER_IN_USE_CODE | typeof MATERIAL_IN_USE_CODE,
    name: string,
    readonly estimates: ReadonlyArray<EstimateUse>,
    readonly total: number,
  ) {
    super(`${name} cannot be deleted while an open estimate uses it`, { code });
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

/** How long a person is told to wait before asking for the export again (`Retry-After`). */
export const EXPORT_RETRY_AFTER_SECONDS = 10;

/**
 * Too many exports are being built at once (STORY-07.01, architecture section 4.6, review QS-01): each runs in its own thread with its own memory, so the number is capped. `withRoute` maps it to
 * 503 `EXPORT_BUSY` with fixed words and a `Retry-After` header, and the portal's other work is not affected.
 */
export class ExportBusyError extends AppError {
  readonly retryAfterSeconds = EXPORT_RETRY_AFTER_SECONDS;

  constructor() {
    super('EXPORT_BUSY', 503, 'Other files are being built right now. Try again in a moment.');
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/** The code of a 422 for a test e-mail that cannot be sent because no usable sender is saved (STORY-09.02 AC-5). */
export const NO_SENDER_CODE = 'NO_SENDER';

/**
 * The mail server refused or did not answer when the Settings test e-mail was sent (STORY-09.02 AC-5). The code is the class of the failure (`SENDER_NOT_ALLOWED`, `AUTH_FAILED`,
 * `CONNECTION`, `UNKNOWN`: `src/lib/mail/codes.ts`) and nothing of the server's own words is kept, because a reply can carry an address or a host and a token request can carry a secret.
 * `withRoute` maps it to 502 with that code and the generic title; the page chooses its words from the code.
 */
export class MailTestFailedError extends AppError {
  constructor(code: string) {
    super(code, 502, 'The test e-mail was not sent.');
  }
}
