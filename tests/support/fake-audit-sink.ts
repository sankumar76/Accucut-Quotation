import type { AuditRepository, NewAuditRow } from '../../src/server/repositories/audit-repository';
import { createAuditService, type AuditService } from '../../src/server/services/audit-service';

/**
 * An audit service that keeps what it is given, for the unit tests of a service that writes an entry in a transaction **another fake opened** (`fake-audit.ts` keeps the entries of its own
 * transactions only, and the calculation fake has a runner of its own). The real `AuditService` runs over it, so an entry that does not fit its event's schema, or that holds a secret, is refused
 * as in production; only the storage is in memory. What a committed entry looks like in PostgreSQL, and that it goes with its change, is tested in `tests/integration`. Every value is invented.
 */
export interface AuditSink {
  readonly service: AuditService;
  /** The rows appended, oldest first, whether or not the transaction that held them later rolled back (the caller's fake rolls back its own state). */
  readonly rows: NewAuditRow[];
}

export function createAuditSink(): AuditSink {
  const rows: NewAuditRow[] = [];
  const repository: AuditRepository = {
    append(row) {
      rows.push(row);
      return Promise.resolve();
    },
    list: () => Promise.resolve({ rows: [], hasMore: false }),
    count: () => Promise.resolve(0),
  };
  return { service: createAuditService({ audit: repository }), rows };
}
