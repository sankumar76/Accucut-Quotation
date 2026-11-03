import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client';

export type { PrismaClient };

/**
 * The one place a Prisma client is built (architecture section 10: only `src/server/repositories`
 * imports Prisma). Prisma 7 talks to PostgreSQL through the `pg` driver adapter.
 *
 * Pass `DATABASE_URL` (the runtime role) from `app` and `worker`, and `MIGRATE_DATABASE_URL` (the owner
 * role) from the `migrate` step only. The caller validates the URL (`src/lib/env.ts`) and closes the
 * client with `$disconnect()`.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
