import { describe, expect, it } from 'vitest';

import {
  ActiveAdminExistsError,
  AppError,
  ConfigurationError,
  ConflictError,
  FieldValidationError,
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

describe('FieldValidationError (STORY-01.04 AC-1)', () => {
  it('is a 422 that names the fields, so a form can show each message under its own field', () => {
    const error = new FieldValidationError([{ field: 'email', message: 'A user with this e-mail already exists.' }], { code: 'EMAIL_TAKEN' });
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.httpStatus).toBe(422);
    expect(error.code).toBe('EMAIL_TAKEN');
    expect(error.fields).toEqual([{ field: 'email', message: 'A user with this e-mail already exists.' }]);
  });
});

describe('ActiveAdminExistsError (STORY-01.04 AC-3)', () => {
  it('is a 409 with a fixed sentence that names the current Admin', () => {
    const error = new ActiveAdminExistsError({ id: 'u-1', name: 'Invented Admin' });
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.httpStatus).toBe(409);
    expect(error.code).toBe('ADMIN_ALREADY_ACTIVE');
    expect(error.message).toBe('There is already an active Admin. Only one Admin can be active.');
    expect(error.currentAdmin).toEqual({ id: 'u-1', name: 'Invented Admin' });
  });

  it('can be raised when the Admin could not be read back (a race): the sentence is the same and nobody is named', () => {
    expect(new ActiveAdminExistsError(null).currentAdmin).toBeNull();
  });
});
