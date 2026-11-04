/**
 * Makes the invented Admin that the performance checks sign in as (STORY-10.10; JS budget check and Lighthouse run).
 *
 * Reads `MEASUREMENT_ADMIN_EMAIL` and `MEASUREMENT_ADMIN_PASSWORD` (invented values; CI generates the password inside the
 * job) and `DATABASE_URL`. Creates one active Admin through the same test builder and repository the tests use, with no
 * forced password change, so no page redirects away from what is measured. If a user with that e-mail exists it is left
 * as it is. It is meant for a throwaway database only: the database guard of the tests refuses any other. The password
 * is never printed.
 *
 * Usage: npx tsx scripts/ensure-measurement-user.ts
 */
import { loadDatabaseEnv } from '../src/lib/env';
import { isAppError } from '../src/lib/errors';
import { createPrismaClient } from '../src/server/repositories/prisma-client';
import { createUserRepository } from '../src/server/repositories/user-repository';
import { assertSafeDatabaseTarget } from '../tests/support/db-guard';
import { buildUser, createTestHasher } from '../tests/support/builders/user';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`${name} is not set`);
  return value;
}

async function run(): Promise<void> {
  const email = required('MEASUREMENT_ADMIN_EMAIL');
  const password = required('MEASUREMENT_ADMIN_PASSWORD');
  const { DATABASE_URL } = loadDatabaseEnv();
  assertSafeDatabaseTarget({ ...process.env, DATABASE_URL });
  const client = createPrismaClient('script', DATABASE_URL);
  try {
    const users = createUserRepository(client);
    if ((await users.findCredentialsByEmail(email)) !== null) {
      process.stdout.write('ensure-measurement-user: the user already exists; nothing was changed.\n');
      return;
    }
    const hasher = createTestHasher();
    await users.create(await buildUser(hasher, { name: 'Measurement Admin', email, password, role: 'ADMIN', mustChangePassword: false }));
    process.stdout.write('ensure-measurement-user: the invented Admin was created.\n');
  } finally {
    await client.$disconnect();
  }
}

run().catch((error: unknown) => {
  // A database error is not printed: it may carry a connection detail.
  const message = isAppError(error) || (error instanceof Error && error.message.endsWith('is not set')) ? error.message : 'unexpected error (see the database and the settings)';
  process.stderr.write(`ensure-measurement-user failed: ${message}\n`);
  process.exitCode = 1;
});
