import { DatabaseBusyError } from '../../lib/errors';

/**
 * Turns the two timeouts of architecture ruling R4 into a typed 503 error (PRF-01). A request that waited
 * too long for a connection, or a statement PostgreSQL cancelled, is "busy", not "broken": the caller
 * can try again. Every other database error passes through unchanged.
 *
 * Only a repository may see the driver's error shapes (they come from `pg` and Prisma), so the mapping
 * lives here and the repositories call `withDatabaseErrors`.
 */

/** PostgreSQL's error code for a statement cancelled by `statement_timeout`. */
const STATEMENT_CANCELLED = '57014';

/** The messages `pg` gives when a pool or a new connection is not available within `connectionTimeoutMillis`. */
const CONNECT_TIMEOUT_MESSAGES: ReadonlyArray<string> = [
  'timeout exceeded when trying to connect',
  'Connection terminated due to connection timeout',
];

/** A cause chain this long is not a real chain; stopping keeps a cyclic cause from looping. */
const MAX_CAUSE_DEPTH = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The PostgreSQL code of an error: directly (`pg`), or inside the driver-adapter error Prisma 7 wraps it in. */
function postgresCodeOf(error: Record<string, unknown>): unknown {
  if (error['code'] === STATEMENT_CANCELLED) return error['code'];
  const adapterError = isRecord(error['meta']) ? error['meta']['driverAdapterError'] : undefined;
  const driverCause = isRecord(adapterError) ? adapterError['cause'] : undefined;
  return isRecord(driverCause) ? (driverCause['originalCode'] ?? driverCause['code']) : undefined;
}

function isBusyError(error: unknown, depth = 0): boolean {
  if (!isRecord(error) || depth > MAX_CAUSE_DEPTH) return false;
  if (postgresCodeOf(error) === STATEMENT_CANCELLED) return true;
  if (error instanceof Error && CONNECT_TIMEOUT_MESSAGES.includes(error.message)) return true;
  return isBusyError(error['cause'], depth + 1);
}

/** PostgreSQL's error code for a unique constraint or unique index that refused a row. */
const UNIQUE_VIOLATION = '23505';

/** Prisma's own code for the same refusal, when a driver adapter did not carry the PostgreSQL code through. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

function stringsOf(value: unknown): ReadonlyArray<string> {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * What a unique constraint or unique index named when it refused a row: the column names (Prisma's driver adapter
 * reads them from the error's detail line), or the constraint's own name. `null` when the error is not a unique violation.
 * The partial index that allows one active Admin names its column `role`, and the e-mail constraint names `email`,
 * so a repository can tell the two apart without reading a message.
 */
export function uniqueViolationOf(error: unknown): ReadonlyArray<string> | null {
  if (!isRecord(error)) return null;
  const adapterError = isRecord(error['meta']) ? error['meta']['driverAdapterError'] : undefined;
  const driverCause = isRecord(adapterError) ? adapterError['cause'] : undefined;
  if (isRecord(driverCause) && (driverCause['originalCode'] === UNIQUE_VIOLATION || driverCause['kind'] === 'UniqueConstraintViolation')) {
    const constraint = driverCause['constraint'];
    if (isRecord(constraint)) {
      const names = [...stringsOf(constraint['fields']), ...stringsOf([constraint['index']])];
      if (names.length > 0) return names;
    }
    return [];
  }
  if (error['code'] === PRISMA_UNIQUE_VIOLATION) return isRecord(error['meta']) ? stringsOf(error['meta']['target']) : [];
  // A raw `pg` error: it names the constraint or index.
  if (error['code'] === UNIQUE_VIOLATION) return typeof error['constraint'] === 'string' ? [error['constraint']] : [];
  return null;
}

/** Prisma's code for an update or delete of a row that is not there. */
const RECORD_NOT_FOUND = 'P2025';

/** Is this the error Prisma raises when the row an update asked for does not exist? Repositories turn it into `null`. */
export function isRecordNotFound(error: unknown): boolean {
  return isRecord(error) && error['code'] === RECORD_NOT_FOUND;
}

/** `DatabaseBusyError` (with the original as its cause) for a timeout; the same value for anything else. */
export function translateDatabaseError(error: unknown): unknown {
  return isBusyError(error) ? new DatabaseBusyError({ cause: error }) : error;
}

/** Runs a database operation and translates its timeout errors. Wrap each repository method in it. */
export async function withDatabaseErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw translateDatabaseError(error);
  }
}
