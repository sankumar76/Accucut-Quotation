import { createAuditRepository, type AuditRepository } from '../../src/server/repositories/audit-repository';
import { createTransactionRunner, type TransactionRunner } from '../../src/server/repositories/transaction';
import { createAuditService, type AuditService } from '../../src/server/services/audit-service';
import { createUserService, type UserService } from '../../src/server/services/user-service';

import { openAuthDatabase, type AuthDatabase } from './auth-database';
import { createTestHasher } from './builders/user';

/**
 * A throwaway migrated database with the audit pieces over the runtime role: the audit repository and service, the transaction
 * runner, and the user service wired to them as the web process wires it (`src/server/composition.ts`). The audit table cannot be
 * emptied, even by the owner, so every test file opens a database of its own and drops it (test strategy section 4).
 */

export interface AuditDatabase extends AuthDatabase {
  readonly auditRepository: AuditRepository;
  readonly transactions: TransactionRunner;
  readonly audit: AuditService;
  readonly userService: UserService;
}

const KEY_SECRET = 'invented-throttle-key-material';

export async function openAuditDatabase(): Promise<AuditDatabase> {
  const base = await openAuthDatabase();
  const auditRepository = createAuditRepository(base.prisma);
  const transactions = createTransactionRunner(base.prisma);
  const audit = createAuditService({ audit: auditRepository });
  const userService = createUserService({
    users: base.users,
    throttles: base.throttles,
    hasher: createTestHasher(),
    transactions,
    audit,
    keySecret: KEY_SECRET,
  });
  return { ...base, auditRepository, transactions, audit, userService };
}

export const AUDIT_REQUEST_ID = 'req-0a0b0c0d';
export const FIRST_PASSWORD = 'invented-first-password-1';
/** The name `insertPersonAsOwner(db, 'Admin', ...)` gives the person: "Invented " and the label. */
export const ADMIN_NAME = 'Invented Admin';

/** Who is making a change, on one request: the actor, their name at the time, and the request. */
export function contextOf(actorId: string, actorName: string = ADMIN_NAME) {
  return { actorId, actorLabel: actorName, requestId: AUDIT_REQUEST_ID } as const;
}

/** A new person for `UserService.create`, with an invented name, e-mail address and password. */
export function newPerson(label: string, role: 'LEAD' | 'ENGINEER' = 'ENGINEER') {
  return { name: `Invented ${label}`, email: `${label}@example.test`, role, password: FIRST_PASSWORD } as const;
}

/** An audit row as the database holds it, with the JSON also as text (to read what was really stored). */
export interface StoredEntry {
  readonly event: string;
  readonly actor_id: string;
  readonly actor_label: string;
  readonly object_type: string;
  readonly object_id: string;
  readonly object_label: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly before_text: string | null;
  readonly after_text: string | null;
  readonly request_id: string;
  readonly created_at: Date;
}

/** The entries about one object, oldest first. */
export async function entriesFor(db: AuthDatabase, objectId: string): Promise<ReadonlyArray<StoredEntry>> {
  const { rows } = await db.owner.query<StoredEntry>(
    `SELECT event, actor_id, actor_label, object_type, object_id, object_label, before, after,
            before::text AS before_text, after::text AS after_text, request_id, created_at
     FROM audit_log WHERE object_id = $1 ORDER BY created_at, id`,
    [objectId],
  );
  return rows;
}

export async function entryCount(db: AuthDatabase): Promise<number> {
  const { rows } = await db.owner.query<{ count: string }>('SELECT count(*) FROM audit_log');
  return Number(rows[0]?.count);
}

export async function userRow(db: AuthDatabase, id: string) {
  const { rows } = await db.owner.query<{ name: string; role: string; is_active: boolean; must_change_password: boolean }>(
    'SELECT name, role, is_active, must_change_password FROM users WHERE id = $1',
    [id],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('No such user row.');
  return row;
}

/** Inserts a person as the owner (so no audit entry is made) and returns their ID. For the actor and the object of an entry. */
export async function insertPersonAsOwner(db: AuthDatabase, label: string, role: 'ADMIN' | 'LEAD' | 'ENGINEER' = 'ENGINEER', isActive = true): Promise<string> {
  const { rows } = await db.owner.query<{ id: string }>(
    `INSERT INTO users (name, email, password_hash, role, is_active) VALUES ($1, $2, 'invented-hash', $3::user_role, $4) RETURNING id`,
    [`Invented ${label}`, `${label.toLowerCase().replaceAll(' ', '.')}@example.test`, role, isActive],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('The insert returned no row.');
  return row.id;
}
