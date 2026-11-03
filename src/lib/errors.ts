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
