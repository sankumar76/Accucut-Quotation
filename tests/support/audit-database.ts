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
  return { ...base, close: base.close, auditRepository, transactions, audit, userService };
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
