import { describe, expect, it } from 'vitest';

import { DatabaseBusyError, isAppError } from '@/lib/errors';
import { translateDatabaseError, withDatabaseErrors } from '@/server/repositories/database-errors';

/**
 * Architecture ruling R4 (PRF-01): a pool timeout or a statement cancelled by PostgreSQL becomes a typed
 * 503 DATABASE_BUSY error. Any other error passes through untouched. The shapes below are the ones the
 * driver and Prisma really produce (see tests/integration/config/database-timeouts.test.ts).
 */

/** What Prisma 7 throws for a statement PostgreSQL cancelled, reduced to the fields the mapping reads. */
function prismaStatementTimeout(): Error {
  return Object.assign(new Error('Raw query failed. Code: `57014`.'), {
    code: 'P2010',
    meta: { driverAdapterError: { name: 'DriverAdapterError', cause: { originalCode: '57014', code: '57014' } } },
  });
}

describe('DatabaseBusyError', () => {
  it('is an application error: 503, code DATABASE_BUSY, a message that is safe to show', () => {
    const error = new DatabaseBusyError({ cause: new Error('internal detail') });
    expect(isAppError(error)).toBe(true);
    expect(error).toMatchObject({ code: 'DATABASE_BUSY', httpStatus: 503 });
    expect(error.message).not.toContain('internal detail');
    expect(error.cause).toMatchObject({ message: 'internal detail' });
  });
});

describe('translateDatabaseError (R4)', () => {
  it.each([
    ['the pool waited too long for a connection', new Error('timeout exceeded when trying to connect')],
    ['a new connection took too long', new Error('Connection terminated due to connection timeout')],
    ['Prisma reports a statement PostgreSQL cancelled', prismaStatementTimeout()],
    ['the driver reports a cancelled statement directly', Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' })],
    ['a cancelled statement sits one level down as the cause', new Error('wrapper', { cause: prismaStatementTimeout() })],
  ])('maps %s to DATABASE_BUSY and keeps the original as the cause', (_name, original) => {
    const mapped = translateDatabaseError(original);
    expect(mapped).toBeInstanceOf(DatabaseBusyError);
    expect(mapped).toMatchObject({ code: 'DATABASE_BUSY', httpStatus: 503, cause: original });
  });

  it.each([
    ['a unique violation', Object.assign(new Error('duplicate key'), { code: '23505' })],
    ['a Prisma error of another kind', Object.assign(new Error('x'), { code: 'P2002', meta: { driverAdapterError: { cause: { originalCode: '23505' } } } })],
    ['an ordinary error', new Error('boom')],
    ['a string', 'timeout exceeded when trying to connect'],
    ['null', null],
    ['an object with a non-object meta', { meta: 'x' }],
  ])('leaves %s as it is', (_name, original) => {
    expect(translateDatabaseError(original)).toBe(original);
  });

  it('stops looking after a few levels of cause, so a cycle cannot loop for ever', () => {
    const looping: { cause?: unknown } = {};
    looping.cause = looping;
    expect(translateDatabaseError(looping)).toBe(looping);
  });
});

describe('withDatabaseErrors', () => {
  it('returns the result when the operation succeeds', async () => {
    await expect(withDatabaseErrors(async () => 42)).resolves.toBe(42);
  });

  it('throws DatabaseBusyError for a timeout and the original error for anything else', async () => {
    await expect(withDatabaseErrors(async () => Promise.reject(prismaStatementTimeout()))).rejects.toBeInstanceOf(DatabaseBusyError);
    const other = new Error('boom');
    await expect(withDatabaseErrors(async () => Promise.reject(other))).rejects.toBe(other);
  });
});
