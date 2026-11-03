import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';

import { PrismaClient } from '../../src/generated/prisma/client';
import { poolConfigFor, type DatabaseClientKind } from '../../src/server/repositories/prisma-client';

/**
 * A Prisma client whose pool settings a test may lower, to provoke a timeout (architecture ruling R4). It
 * lives here and not in `createPrismaClient` so production code has no way to pass an override and loosen
 * the ruled limits (STD-15).
 */

/** The ruled pool configuration for a kind, with the test's overrides on top. */
export function testPoolConfig(kind: DatabaseClientKind, connectionString: string, overrides: Partial<PoolConfig> = {}): PoolConfig {
  return { ...poolConfigFor(kind, connectionString), ...overrides };
}

export function createTestPrismaClient(kind: DatabaseClientKind, connectionString: string, overrides: Partial<PoolConfig> = {}): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg(testPoolConfig(kind, connectionString, overrides)) });
}
