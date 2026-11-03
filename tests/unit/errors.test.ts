import { describe, expect, it } from 'vitest';

import {
  AppError,
  ConfigurationError,
  ConflictError,
  ForbiddenError,
  isAppError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/errors';

describe('AppError subclasses', () => {
  it.each([
    [new ValidationError('bad input'), 'VALIDATION_FAILED', 422],
    [new UnauthorizedError(), 'UNAUTHORIZED', 401],
    [new ForbiddenError(), 'FORBIDDEN', 403],
    [new NotFoundError(), 'NOT_FOUND', 404],
    [new ConflictError('changed'), 'CONFLICT', 409],
    [new ConfigurationError('bad config'), 'CONFIGURATION_INVALID', 500],
  ])('maps %o to its code and HTTP status', (error, code, httpStatus) => {
    expect(error.code).toBe(code);
    expect(error.httpStatus).toBe(httpStatus);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it('names the error after its class', () => {
    expect(new NotFoundError().name).toBe('NotFoundError');
  });

  it('lets a specific code replace the default', () => {
    expect(new ConflictError('stale', { code: 'APPROVAL_CHANGED' }).code).toBe('APPROVAL_CHANGED');
  });

  it('keeps the cause for the log without putting it in the message', () => {
    const cause = new Error('driver detail');
    const error = new ValidationError('bad input', { cause });
    expect(error.cause).toBe(cause);
    expect(error.message).toBe('bad input');
  });

  it('has no cause when none is given', () => {
    expect(new ValidationError('bad input').cause).toBeUndefined();
  });

  it('recognises its own errors with isAppError', () => {
    expect(isAppError(new NotFoundError())).toBe(true);
    expect(isAppError(new Error('plain'))).toBe(false);
    expect(isAppError('text')).toBe(false);
  });
});
