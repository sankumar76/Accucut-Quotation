/**
 * Makes the invented Admin that the performance checks sign in as (STORY-10.10; JS budget check and Lighthouse run).
 *
 * Reads `MEASUREMENT_ADMIN_EMAIL` and `MEASUREMENT_ADMIN_PASSWORD` (invented values; CI generates the password inside the
 * job) and `DATABASE_URL`. Creates one active Admin with no forced password change, so no page redirects away from what is
 * measured. If a user with that e-mail exists it is left as it is. If another Admin holds the one place, it stops with a
 * message that says what to do. It runs only against a throwaway database (localhost, the Compose service or the CI
 * service; never staging): see `scripts/lib/measurement-user.ts`. The password is never printed.
 *
 * Usage: npx tsx scripts/ensure-measurement-user.ts
 */
import { loadDatabaseEnv } from '../src/lib/env';
import { isAppError } from '../src/lib/errors';
import { createPasswordHasher } from '../src/server/auth/password-hasher';
import { createPrismaClient } from '../src/server/repositories/prisma-client';
import { createUserRepository } from '../src/server/repositories/user-repository';

import { MeasurementUserError, assertThrowawayDatabase, ensureMeasurementUser } from './lib/measurement-user';

/** A small argon2id cost: this user exists for one run and its password is invented, so the full cost would only slow the run. */
const MEASUREMENT_HASH_COST = { memoryCost: 64, timeCost: 1, parallelism: 1 } as const;

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') throw new MeasurementUserError(`${name} is not set`);
  return value;
}

async function run(): Promise<void> {
  const email = required('MEASUREMENT_ADMIN_EMAIL');
  const password = required('MEASUREMENT_ADMIN_PASSWORD');
  const { DATABASE_URL } = loadDatabaseEnv();
  assertThrowawayDatabase(DATABASE_URL, process.env['NODE_ENV']);
  const client = createPrismaClient('script', DATABASE_URL);
  try {
    const outcome = await ensureMeasurementUser(createUserRepository(client), createPasswordHasher(MEASUREMENT_HASH_COST), { email, password });
    process.stdout.write(
      outcome === 'created' ? 'ensure-measurement-user: the invented Admin was created.\n' : 'ensure-measurement-user: the user already exists; nothing was changed.\n',
    );
  } finally {
    await client.$disconnect();
  }
}

run().catch((error: unknown) => {
  // A database error is not printed: it may carry a connection detail.
  const message = error instanceof MeasurementUserError || isAppError(error) ? error.message : 'unexpected error (see the database and the settings)';
  process.stderr.write(`ensure-measurement-user failed: ${message}\n`);
  process.exitCode = 1;
});
