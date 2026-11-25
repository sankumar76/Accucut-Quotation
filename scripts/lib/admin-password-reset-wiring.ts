import { loadServerCommandEnv, type EnvSource } from '../../src/lib/env';
import { passwordHasher } from '../../src/server/auth/password-hasher';
import { createAuditRepository } from '../../src/server/repositories/audit-repository';
import { createPrismaClient } from '../../src/server/repositories/prisma-client';
import { createThrottleRepository } from '../../src/server/repositories/throttle-repository';
import { createTransactionRunner } from '../../src/server/repositories/transaction';
import { createUserRepository } from '../../src/server/repositories/user-repository';
import { createAuditService } from '../../src/server/services/audit-service';
import { createUserService, type UserService } from '../../src/server/services/user-service';

/**
 * The real services of the server command that resets the Admin's password (STORY-01.10; architecture section 8): the settings are `DATABASE_URL` and `AUTH_SECRET` alone (the runtime role,
 * through Node's `--env-file=C:\Accucut\config\.env`), and the user service is built over the runtime role exactly as the web process builds it, with the same audit service and the same
 * throttle key. Nothing connects until the first query, so an unreachable database shows there, as exit 1 with no database text.
 *
 * It is loaded only when the command is asked for (`scripts/bootstrap-admin.ts` imports it on that path), so the install path does not pull in the audit service and what it imports.
 */
export function openAdminPasswordReset(source: EnvSource = process.env): Promise<{ readonly service: UserService; readonly close: () => Promise<void> }> {
  const { DATABASE_URL, AUTH_SECRET } = loadServerCommandEnv(source);
  const client = createPrismaClient('script', DATABASE_URL);
  const service = createUserService({
    users: createUserRepository(client),
    throttles: createThrottleRepository(client),
    hasher: passwordHasher,
    transactions: createTransactionRunner(client),
    audit: createAuditService({ audit: createAuditRepository(client) }),
    keySecret: AUTH_SECRET,
  });
  return Promise.resolve({ service, close: () => client.$disconnect() });
}
