import { createFixedClock, type FixedClock } from '../../src/lib/time';
import type {
  AuditPageRequest,
  AuditRepository,
  AuditRow,
  AuditRowFilter,
  AuditRowPage,
  NewAuditRow,
} from '../../src/server/repositories/audit-repository';
import { createTransactionHandle, type Transaction, type TransactionRunner } from '../../src/server/repositories/transaction';

/**
 * In-memory stand-ins for the audit repository and the transaction runner, for unit tests of the rules (no database). They keep
 * the behaviour the services rely on: an entry appended in a transaction is kept only if the transaction commits, and the list
 * is newest first with a keyset cursor, filtered the way the SQL filters it. The real repository and the real trigger are tested
 * against PostgreSQL in `tests/integration/audit`. Every name and value here is invented.
 */

export interface FakeAuditRepository extends AuditRepository {
  /** The entries of committed transactions, oldest first. */
  readonly committed: ReadonlyArray<AuditRow>;
  /** The rows as they were appended, with the request ID, oldest first. */
  readonly appended: ReadonlyArray<NewAuditRow>;
}

export interface FakeAuditWorld {
  readonly audit: FakeAuditRepository;
  readonly transactions: TransactionRunner;
  /** Moves the clock the entries are stamped with. */
  readonly clock: FixedClock;
}

const START = new Date('2026-11-05T09:00:00.000Z');

interface OpenTransaction {
  readonly rows: AuditRow[];
  readonly appended: NewAuditRow[];
}

function matches(row: AuditRow, filter: AuditRowFilter): boolean {
  if (filter.actorId !== undefined && row.actorId !== filter.actorId) return false;
  if (filter.events !== undefined && !filter.events.includes(row.event)) return false;
  if (filter.createdFrom !== undefined && row.createdAt < filter.createdFrom) return false;
  if (filter.createdBefore !== undefined && row.createdAt >= filter.createdBefore) return false;
  return true;
}

function newestFirst(a: AuditRow, b: AuditRow): number {
  return b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id);
}

/**
 * @param clock stamps each appended entry (the real table stamps it itself).
 */
export function createFakeAuditWorld(clock: FixedClock = createFixedClock(START)): FakeAuditWorld {
  const committed: AuditRow[] = [];
  const appended: NewAuditRow[] = [];
  const open = new Map<Transaction, OpenTransaction>();
  let nextId = 1;

  const audit: FakeAuditRepository = {
    committed,
    appended,
    append(row, tx) {
      const transaction = open.get(tx);
      if (transaction === undefined) return Promise.reject(new Error('The fake audit repository was given a transaction it did not open.'));
      // One millisecond apart, so the order of entries in a test is the order they were written in.
      clock.advance(1);
      transaction.rows.push({
        id: `10000000-0000-4000-8000-${String(nextId).padStart(12, '0')}`,
        createdAt: clock.now(),
        actorId: row.actorId,
        actorLabel: row.actorLabel,
        event: row.event,
        objectType: row.objectType,
        objectId: row.objectId,
        objectLabel: row.objectLabel,
        before: row.before,
        after: row.after,
      });
      transaction.appended.push(row);
      nextId += 1;
      return Promise.resolve();
    },
    list(filter: AuditRowFilter, page: AuditPageRequest): Promise<AuditRowPage> {
      const found = committed
        .filter((row) => matches(row, filter))
        .sort(newestFirst)
        .filter((row) => {
          const after = page.after;
          if (after === undefined) return true;
          return row.createdAt < after.createdAt || (row.createdAt.getTime() === after.createdAt.getTime() && row.id < after.id);
        });
      return Promise.resolve({ rows: found.slice(0, page.limit), hasMore: found.length > page.limit });
    },
    count: (filter) => Promise.resolve(committed.filter((row) => matches(row, filter)).length),
  };

  const transactions: TransactionRunner = {
    async run(work) {
      const tx = createTransactionHandle();
      const transaction: OpenTransaction = { rows: [], appended: [] };
      open.set(tx, transaction);
      try {
        const result = await work(tx);
        committed.push(...transaction.rows);
        appended.push(...transaction.appended);
        return result;
      } finally {
        open.delete(tx);
      }
    },
  };

  return { audit, transactions, clock };
}
