import { Prisma } from '../../generated/prisma/client';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the audit log (STORY-01.07; architecture sections 5.1 and 8, NFR-007). The table is append-only: the database
 * refuses a change or a removal (a trigger, and no `UPDATE` or `DELETE` grant for the runtime role), and this repository has
 * no method that tries one. Reading is for the Admin only (the route's role check, before anything is read).
 *
 * `append` takes the caller's `Transaction` as a required argument. An entry exists only if the change it records is
 * committed, so there is no way to write one on its own, and the compiler refuses a call without a transaction.
 */

/** A JSON value, as stored in `before` and `after`. */
export type JsonValue = string | number | boolean | null | { readonly [key: string]: JsonValue } | ReadonlyArray<JsonValue>;

/** One entry to append. `before` is null for a creation; the time is stamped by the database. */
export interface NewAuditRow {
  readonly actorId: string;
  /** The actor's name now, kept as it is: a later rename does not change how this entry reads. */
  readonly actorLabel: string;
  readonly event: string;
  readonly objectType: string;
  readonly objectId: string;
  /** The name the object has now, kept as it is (AC-5). */
  readonly objectLabel: string;
  readonly before: JsonValue;
  readonly after: JsonValue;
  readonly requestId: string;
}

/** What a read may narrow by. Every field is optional; all given are required together. */
export interface AuditRowFilter {
  readonly actorId?: string | undefined;
  /** The entry's event is one of these. An empty list matches nothing. */
  readonly events?: ReadonlyArray<string> | undefined;
  /** From this instant, inclusive. */
  readonly createdFrom?: Date | undefined;
  /** Until this instant, exclusive. */
  readonly createdBefore?: Date | undefined;
}

/** A place in the newest-first order: entries strictly older than this one come after it. */
export interface AuditPosition {
  readonly createdAt: Date;
  readonly id: string;
}

export interface AuditPageRequest {
  readonly limit: number;
  /** Continue after this entry (the last one of the previous page). */
  readonly after?: AuditPosition | undefined;
}

/**
 * An entry as stored. `actorLabel` is the name the actor had when they made the change (never a join with their current name),
 * and `actorId` is for the Who filter. `before` and `after` are the stored JSON.
 */
export interface AuditRow {
  readonly id: string;
  readonly createdAt: Date;
  readonly actorId: string;
  readonly actorLabel: string;
  readonly event: string;
  readonly objectType: string;
  readonly objectId: string;
  readonly objectLabel: string;
  readonly before: unknown;
  readonly after: unknown;
}

export interface AuditRowPage {
  readonly rows: ReadonlyArray<AuditRow>;
  /** True if an older entry matching the filter exists beyond these rows. */
  readonly hasMore: boolean;
}

export interface AuditRepository {
  /** Adds one entry in the caller's transaction. Rolled back with it. */
  append(row: NewAuditRow, tx: Transaction): Promise<void>;
  /** A page of entries, newest first, that match the filter. */
  list(filter: AuditRowFilter, page: AuditPageRequest): Promise<AuditRowPage>;
  /** How many entries match the filter, however many pages that is. */
  count(filter: AuditRowFilter): Promise<number>;
}

/** SQL NULL, not the JSON value `null`, so a creation's missing `before` is a null column and not the text "null". */
function jsonColumn(value: JsonValue): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null ? Prisma.DbNull : value;
}

function whereOf(filter: AuditRowFilter, after?: AuditPosition): Prisma.AuditLogWhereInput {
  const clauses: Prisma.AuditLogWhereInput[] = [];
  if (filter.actorId !== undefined) clauses.push({ actorId: filter.actorId });
  if (filter.events !== undefined) clauses.push({ event: { in: [...filter.events] } });
  if (filter.createdFrom !== undefined) clauses.push({ createdAt: { gte: filter.createdFrom } });
  if (filter.createdBefore !== undefined) clauses.push({ createdAt: { lt: filter.createdBefore } });
  if (after !== undefined) {
    // Keyset paging on the order of the index: older than the last entry seen, or the same instant and a smaller ID.
    clauses.push({ OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }] });
  }
  return { AND: clauses };
}

const ROW_SELECT = {
  id: true,
  createdAt: true,
  actorId: true,
  actorLabel: true,
  event: true,
  objectType: true,
  objectId: true,
  objectLabel: true,
  before: true,
  after: true,
} as const;

export function createAuditRepository(db: PrismaClient): AuditRepository {
  return {
    append(row, tx) {
      return withDatabaseErrors(async () => {
        await clientFor(db, tx).auditLog.create({
          data: {
            actorId: row.actorId,
            actorLabel: row.actorLabel,
            event: row.event,
            objectType: row.objectType,
            objectId: row.objectId,
            objectLabel: row.objectLabel,
            before: jsonColumn(row.before),
            after: jsonColumn(row.after),
            requestId: row.requestId,
          },
          select: { id: true },
        });
      });
    },

    list(filter, page) {
      return withDatabaseErrors(async () => {
        // One more than asked for, to learn whether another page exists without a second query.
        const found = await db.auditLog.findMany({
          where: whereOf(filter, page.after),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: page.limit + 1,
          select: ROW_SELECT,
        });
        return { rows: found.slice(0, page.limit), hasMore: found.length > page.limit };
      });
    },

    count(filter) {
      return withDatabaseErrors(() => db.auditLog.count({ where: whereOf(filter) }));
    },
  };
}
