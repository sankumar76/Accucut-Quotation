/**
 * The `bootstrap-admin` step (STORY-01.01 AC-7; architecture section 8 "First Admin").
 *
 * Creates the first Admin from `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` (environment variables, read once), with
 * `must_change_password` set. It refuses, and changes nothing, when any Admin already exists. The password is stored
 * as an argon2id hash and is never printed. Uses the runtime database role (`DATABASE_URL`): it needs only INSERT.
 *
 * Usage: npx tsx scripts/bootstrap-admin.ts
 * Local use: set the two variables in `.env` (see `.env.example`), start the database, run `npx prisma migrate
 * deploy`, run this command, then sign in at http://localhost:3000/sign-in and remove the password from `.env`.
 */
import { loadAdminBootstrapEnv, loadDatabaseEnv } from '../src/lib/env';
import { isAppError } from '../src/lib/errors';
import { passwordHasher } from '../src/server/auth/password-hasher';
import { createPrismaClient } from '../src/server/repositories/prisma-client';
import { createUserRepository } from '../src/server/repositories/user-repository';
import { ADMIN_EXISTS_CODE, bootstrapAdmin } from '../src/server/services/bootstrap-admin-service';

async function run(): Promise<void> {
  const { ADMIN_EMAIL, ADMIN_INITIAL_PASSWORD } = loadAdminBootstrapEnv();
  const { DATABASE_URL } = loadDatabaseEnv();
  const client = createPrismaClient('script', DATABASE_URL);
  try {
    await bootstrapAdmin(
      { email: ADMIN_EMAIL, password: ADMIN_INITIAL_PASSWORD },
      { users: createUserRepository(client), hasher: passwordHasher },
    );
    process.stdout.write('bootstrap-admin: the first Admin was created. They must choose a new password at first sign-in.\n');
  } catch (error) {
    if (isAppError(error) && error.code === ADMIN_EXISTS_CODE) {
      process.stderr.write('bootstrap-admin: an Admin already exists; nothing was changed.\n');
      process.exitCode = 1;
      return;
    }
    throw error;
  } finally {
    await client.$disconnect();
  }
}

run().catch((error: unknown) => {
  // The message names variables or rules, never a value (src/lib/env.ts). A database error is not printed: it
  // may carry a connection detail.
  const message = isAppError(error) ? error.message : 'unexpected error (see the database and the settings)';
  process.stderr.write(`bootstrap-admin failed: ${message}\n`);
  process.exitCode = 1;
});
