import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  ActiveAdminExistsError,
  ConfigurationError,
  ConflictError,
  DatabaseBusyError,
  FieldValidationError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/errors';
import {
  forbiddenProblem,
  FORBIDDEN_CODE,
  FORBIDDEN_TITLE,
  internalProblem,
  INTERNAL_TITLE,
  malformedProblem,
  newRequestId,
  problemFromAppError,
  problemResponse,
  PROBLEM_CONTENT_TYPE,
  validationProblem,
} from '@/server/http/problem';

/**
 * STORY-01.02 AC-1 and AC-4: every API failure is `application/problem+json` with a request ID, built in one place,
 * with nothing technical in the body. A role refusal reads the same for every route (CR-33).
 */

const ID = 'req-0123abcd';

describe('the request ID', () => {
  it('is req- and eight hex digits, and different each time', () => {
    const first = newRequestId();
    expect(first).toMatch(/^req-[0-9a-f]{8}$/);
    expect(newRequestId()).not.toBe(first);
  });
});

describe('the problem of an application error', () => {
  it('a 401 uses the fixed words whatever the message says', () => {
    expect(problemFromAppError(new UnauthorizedError('the token for user 42 expired'), ID)).toEqual({
      type: 'about:blank',
      title: 'Sign in to continue.',
      status: 401,
      code: 'UNAUTHORIZED',
      requestId: ID,
    });
  });

  it('a role refusal is the fixed 403, the same for every route and every message (CR-33, AC-4)', () => {
    const fixed = forbiddenProblem(ID);
    expect(fixed).toEqual({ type: 'about:blank', title: FORBIDDEN_TITLE, status: 403, code: FORBIDDEN_CODE, requestId: ID });
    expect(problemFromAppError(new ForbiddenError(), ID)).toEqual(fixed);
    expect(problemFromAppError(new ForbiddenError('estimate Q-2026-0001 belongs to someone else'), ID)).toEqual(fixed);
  });

  it('a 403 with a code of its own (a service refusal) keeps its message and code', () => {
    const refused = problemFromAppError(new ForbiddenError('Only the Admin can do this.', { code: 'ADMIN_ONLY' }), ID);
    expect(refused).toMatchObject({ status: 403, code: 'ADMIN_ONLY', title: 'Only the Admin can do this.' });
  });

  it('other 4xx errors keep their safe message and code', () => {
    expect(problemFromAppError(new NotFoundError(), ID)).toMatchObject({ status: 404, code: 'NOT_FOUND', title: 'Not found.' });
    expect(problemFromAppError(new ConflictError('Someone else changed this.', { code: 'REVISION_CONFLICT' }), ID)).toMatchObject({
      status: 409,
      code: 'REVISION_CONFLICT',
    });
    expect(problemFromAppError(new ValidationError('Enter a value.'), ID)).toMatchObject({ status: 422, code: 'VALIDATION_FAILED' });
  });

  it('a 5xx hides its message, because it can name a setting', () => {
    const configuration = new ConfigurationError('AUTH_SECRET is too short');
    const body = problemFromAppError(configuration, ID);
    expect(body).toMatchObject({ status: 500, code: 'CONFIGURATION_INVALID', title: INTERNAL_TITLE });
    expect(JSON.stringify(body)).not.toContain('AUTH_SECRET');
  });

  it('a busy database is a 503 with its own safe message', () => {
    expect(problemFromAppError(new DatabaseBusyError(), ID)).toMatchObject({ status: 503, code: 'DATABASE_BUSY', title: 'The service is busy. Try again in a moment.' });
  });

  it('a field error is a 422 with the fields named and the title of every other validation failure (STORY-01.04 AC-1)', () => {
    const body = problemFromAppError(new FieldValidationError([{ field: 'email', message: 'A user with this e-mail already exists.' }], { code: 'EMAIL_TAKEN' }), ID);
    expect(body).toEqual({
      type: 'about:blank',
      title: 'Check the values and try again.',
      status: 422,
      code: 'EMAIL_TAKEN',
      requestId: ID,
      errors: [{ field: 'email', message: 'A user with this e-mail already exists.' }],
    });
  });

  it('a second Admin is a 409 with the fixed sentence as its title and the current Admin named (STORY-01.04 AC-3)', () => {
    const body = problemFromAppError(new ActiveAdminExistsError({ id: 'u-1', name: 'Invented Admin' }), ID);
    expect(body).toEqual({
      type: 'about:blank',
      title: 'There is already an active Admin. Only one Admin can be active.',
      status: 409,
      code: 'ADMIN_ALREADY_ACTIVE',
      requestId: ID,
      currentAdmin: { id: 'u-1', name: 'Invented Admin' },
    });
  });

  it('a second Admin whose current Admin could not be read back names nobody and omits the member', () => {
    expect(problemFromAppError(new ActiveAdminExistsError(null), ID)).not.toHaveProperty('currentAdmin');
  });

  it('never carries the cause of an error', () => {
    const body = JSON.stringify(problemFromAppError(new ConflictError('Changed.', { cause: new Error('select * from users where password_hash = x') }), ID));
    expect(body).not.toContain('select');
  });
});

describe('the other problems', () => {
  it('an unexpected failure is a generic 500 with the reference', () => {
    expect(internalProblem(ID)).toEqual({ type: 'about:blank', title: INTERNAL_TITLE, status: 500, code: 'INTERNAL_ERROR', requestId: ID });
  });

  it('a body that cannot be read is a 400', () => {
    expect(malformedProblem(ID)).toMatchObject({ status: 400, code: 'MALFORMED_REQUEST' });
  });

  it('a failed parse is a 422 with one entry per issue and a path, and the value given is not echoed', () => {
    const parsed = z.strictObject({ name: z.string(), count: z.number().int() }).safeParse({ name: 'secret-looking-value', count: 'seven' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const body = validationProblem(parsed.error, ID);
    expect(body.status).toBe(422);
    expect(body.errors?.map((entry) => entry.field)).toEqual(['count']);
    expect(JSON.stringify(body)).not.toContain('seven');
    expect(JSON.stringify(body)).not.toContain('secret-looking-value');
  });
});

describe('the response of a problem', () => {
  it('has its status, the problem media type, no-store and the request ID in a header', async () => {
    const response = problemResponse(forbiddenProblem(ID));
    expect(response.status).toBe(403);
    expect(response.headers.get('Content-Type')).toBe(PROBLEM_CONTENT_TYPE);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Request-Id')).toBe(ID);
    expect(await response.json()).toEqual(forbiddenProblem(ID));
  });
});
