import { auditCategoryLabel, type AuditCategoryId } from '../../lib/audit/categories';
import { startOfIstDay, startOfNextIstDay } from '../../lib/time';
import type { AuditRepository, AuditRowFilter } from '../repositories/audit-repository';
import type { Transaction } from '../repositories/transaction';

import { type AuditCursor, encodeAuditCursor } from './audit-cursor';
import {
  AUDIT_EVENTS,
  type AuditChangeText,
  type AuditEventName,
  type AuditEventPayload,
  eventsInCategory,
  isAuditEventName,
  NO_DETAIL,
} from './audit-events';
import { AuditEntryRefusedError, findSecretPath } from './audit-secrets';

/**
 * The audit service (STORY-01.07; FR-011, NFR-007; architecture sections 4.1, 6 and 8). Two jobs:
 *
 *   - `record` appends one entry **in the caller's transaction** (AC-2). The caller opens the transaction
 *     (`TransactionRunner.run`), makes its change and calls `record` with the same `Transaction`; both are committed or both are
 *     rolled back, so an entry exists exactly when its change does. The service opens no transaction of its own, and the
 *     repository's `append` cannot run without one.
 *   - `list` reads the log for the Admin's screen: filtered, newest first, a page at a time, with the total.
 *
 * What may be recorded is the registry's (`audit-events.ts`): a name from it, and `before` and `after` in the shape that event
 * names. An entry that does not fit, or that holds a password, a hash or a token (AC-4), is refused with
 * `AuditEntryRefusedError`, which rolls the caller's change back too: a change that cannot be recorded does not happen.
 *
 * Who may read is decided before this is reached (`withRoute` and the manifest: the Admin only). Times are stamped by the
 * database, not here, so no code can back-date an entry.
 */

/** Who is making a change and on which request: what every audited method of every service needs besides its own arguments. */
export interface AuditContext {
  readonly actorId: string;
  /** The actor's name now, from the signed-in user of the request (`requireUser()`): no new read. Kept with the entry. */
  readonly actorLabel: string;
  readonly requestId: string;
}

export interface AuditEntryInput<E extends AuditEventName> extends AuditEventPayload<E> {
  readonly event: E;
  /** Who made the change. */
  readonly actorId: string;
  /** Their name as it is when the entry is written; a later rename does not change the entry (architecture v0.27, section 5.1). */
  readonly actorLabel: string;
  /** The request the change came in on (`X-Request-Id`), so an entry can be found from a report of a problem. */
  readonly requestId: string;
  /** What changed. The label is its name **now**; a later rename does not change the entry (AC-5). */
  readonly object: { readonly id: string; readonly label: string };
  /**
   * Which master the object is, for the generic `master.*` events only (`process_item`, later `material`; architecture section 8,
   * AQP-74 ruling). Any other event has its own object type and refuses one.
   */
  readonly objectType?: string | undefined;
}

export interface AuditListQuery {
  /** The ID of the person who made the change. */
  readonly who?: string | undefined;
  readonly category?: AuditCategoryId | undefined;
  readonly event?: AuditEventName | undefined;
  /** First day, `YYYY-MM-DD`, in IST. */
  readonly from?: string | undefined;
  /** Last day, `YYYY-MM-DD`, in IST: the whole day is included. */
  readonly to?: string | undefined;
  readonly limit: number;
  readonly cursor?: AuditCursor | undefined;
}

/** One entry as the screen shows it. The stored `before` and `after` are turned into words here and do not leave the server. */
export interface AuditEntryView {
  readonly id: string;
  /** UTC, ISO 8601. The screen shows it in IST with `formatIst`. */
  readonly createdAt: string;
  /** The name the person who made the change had at the time (`actor_label`), never their current name. */
  readonly who: string;
  /** The registered event name, for example `user.created`. */
  readonly event: string;
  /** The Event column: null for an event this release does not know (a newer release wrote it). */
  readonly category: { readonly id: string; readonly label: string } | null;
  readonly objectLabel: string;
  readonly change: AuditChangeText;
}

export interface AuditPage {
  readonly entries: ReadonlyArray<AuditEntryView>;
  /** How many entries match the filter, over all pages. */
  readonly total: number;
  /** Pass as `cursor` for the next page; null on the last page. */
  readonly nextCursor: string | null;
}

export interface AuditService {
  record<E extends AuditEventName>(tx: Transaction, entry: AuditEntryInput<E>): Promise<void>;
  list(query: AuditListQuery): Promise<AuditPage>;
}

export interface AuditServiceDependencies {
  readonly audit: AuditRepository;
}

const OBJECT_LABEL_MAX_LENGTH = 200;
/** The object type of the generic master events: lower snake case, as a master's name is (`process_item`). */
const MASTER_OBJECT_TYPE = /^[a-z][a-z_]{0,39}$/;
const GENERIC_MASTER_TYPE = 'master';

/** The object type an entry is stored with: the event's own, or, for the generic master events, the master the caller names. */
function objectTypeOf(definitionType: string, requested: string | undefined): string {
  if (requested === undefined) return definitionType;
  if (definitionType !== GENERIC_MASTER_TYPE || !MASTER_OBJECT_TYPE.test(requested)) throw new AuditEntryRefusedError('shape', 'objectType');
  return requested;
}

/** The events a filter allows, or undefined for no restriction. A category and an event together must both hold. */
function eventsOf(query: AuditListQuery): ReadonlyArray<string> | undefined {
  const inCategory = query.category === undefined ? undefined : eventsInCategory(query.category);
  if (query.event === undefined) return inCategory;
  return inCategory === undefined || inCategory.includes(query.event) ? [query.event] : [];
}

function filterOf(query: AuditListQuery): AuditRowFilter {
  return {
    actorId: query.who,
    events: eventsOf(query),
    createdFrom: query.from === undefined ? undefined : startOfIstDay(query.from),
    createdBefore: query.to === undefined ? undefined : startOfNextIstDay(query.to),
  };
}

export function createAuditService({ audit }: AuditServiceDependencies): AuditService {
  return {
    async record(tx, entry) {
      const definition = AUDIT_EVENTS[entry.event];
      const objectType = objectTypeOf(definition.objectType, entry.objectType);
      const label = entry.object.label;
      if (label.length === 0 || label.length > OBJECT_LABEL_MAX_LENGTH) throw new AuditEntryRefusedError('shape', 'object.label');
      if (entry.actorLabel.length === 0 || entry.actorLabel.length > OBJECT_LABEL_MAX_LENGTH) throw new AuditEntryRefusedError('shape', 'actorLabel');
      // CONTROL (QLT-11 review control, never merge): the writer checks the union again, as before QLT-11.
      const before = definition.before.safeParse(entry.before);
      if (!before.success) throw new AuditEntryRefusedError('shape', 'before');
      const after = definition.after.safeParse(entry.after);
      if (!after.success) throw new AuditEntryRefusedError('shape', 'after');
      const secret = findSecretPath({ before: before.data, after: after.data });
      if (secret !== null) throw new AuditEntryRefusedError('secret', secret);

      await audit.append(
        {
          actorId: entry.actorId,
          actorLabel: entry.actorLabel,
          event: entry.event,
          objectType,
          objectId: entry.object.id,
          objectLabel: label,
          before: before.data,
          after: after.data,
          requestId: entry.requestId,
        },
        tx,
      );
    },

    async list(query) {
      const filter = filterOf(query);
      const [page, total] = await Promise.all([
        audit.list(filter, { limit: query.limit, after: query.cursor }),
        audit.count(filter),
      ]);
      const entries = page.rows.map((row): AuditEntryView => {
        const definition = isAuditEventName(row.event) ? AUDIT_EVENTS[row.event] : undefined;
        return {
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          who: row.actorLabel,
          event: row.event,
          category: definition === undefined ? null : { id: definition.category, label: auditCategoryLabel(definition.category) ?? definition.category },
          objectLabel: row.objectLabel,
          change: definition?.describeStored(row.before, row.after, row.objectType) ?? NO_DETAIL,
        };
      });
      const last = page.rows.at(-1);
      return {
        entries,
        total,
        nextCursor: page.hasMore && last !== undefined ? encodeAuditCursor({ createdAt: last.createdAt, id: last.id }) : null,
      };
    },
  };
}
