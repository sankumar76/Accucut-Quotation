import { Client } from 'pg';

import { createPrismaClient, type PrismaClient } from '../../src/server/repositories/prisma-client';
import { createThrottleRepository, type ThrottleRepository } from '../../src/server/repositories/throttle-repository';
import { createUserRepository, type UserRepository } from '../../src/server/repositories/user-repository';

import { createMigratedScratchDatabase, type ScratchDatabase } from './scratch-database';

/**
 * A throwaway migrated database with the auth repositories over the runtime role, and plain `pg` clients for the
 * owner and the runtime role to look at the tables the way the database sees them. Open it in `beforeAll` and
 * close it in `afterAll` (test strategy section 10: set-up in hooks).
 */

export interface AuthDatabase {
  readonly database: ScratchDatabase;
  readonly prisma: PrismaClient;
  readonly users: UserRepository;
  readonly throttles: ThrottleRepository;
  readonly owner: Client;
  readonly runtime: Client;
  close(): Promise<void>;
}

export async function openAuthDatabase(): Promise<AuthDatabase> {
  const database = await createMigratedScratchDatabase();
  const prisma = createPrismaClient('app', database.runtimeUrl);
  const owner = new Client({ connectionString: database.ownerUrl });
  const runtime = new Client({ connectionString: database.runtimeUrl });
  await Promise.all([owner.connect(), runtime.connect()]);
  return {
    database,
    prisma,
    users: createUserRepository(prisma),
    throttles: createThrottleRepository(prisma),
    owner,
    runtime,
    async close() {
      await prisma.$disconnect();
      await Promise.all([owner.end(), runtime.end()]);
      await database.drop();
    },
  };
}
