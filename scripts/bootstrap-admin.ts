/**
 * The `bootstrap-admin` step (STORY-01.01 AC-7; architecture section 8 "First Admin"), in two modes chosen by its arguments (STORY-01.10, architecture section 8 "Emergency Admin password reset"):
 *
 * **No argument (the install path, unchanged).** Creates the first Admin from `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` (environment variables, read once), with
 * `must_change_password` set. It refuses, and changes nothing, when any Admin already exists. The password is stored
 * as an argon2id hash and is never printed. A password that does not meet the password rule (STORY-01.05: 10 to 128 characters, a
 * number, a symbol, not the e-mail address, not a common password) is refused with the part that failed, and nothing is created.
 * Uses the runtime database role (`DATABASE_URL`): it needs only INSERT.
 *
 * **`--reset-admin-password` (the emergency command).** Run on the server by an administrator, from an interactive console only, it sets a temporary password for the one active
 * Admin who has forgotten theirs while e-mail is off. It reads `DATABASE_URL` and `AUTH_SECRET` (Node's `--env-file=C:\Accucut\config\.env`, the runtime role), never `ADMIN_EMAIL`
 * or `ADMIN_INITIAL_PASSWORD`, and takes the password only from a hidden prompt. The steps, the exit codes (0 done, 1 failed, 2 not exactly one active Admin, 3 password refused,
 * 4 usage) and the words are in `scripts/lib/admin-password-reset-cli.ts`. Any other argument exits 4 and changes nothing.
 *
 * Usage: npx tsx scripts/bootstrap-admin.ts
 * Local use: set the two variables in `.env` (see `.env.example`), start the database, run `npx prisma migrate
 * deploy`, run this command, then sign in at http://localhost:3000/sign-in and remove the password from `.env`.
 * Emergency reset, locally (a real terminal): node --conditions=react-server --import tsx --env-file=.env scripts/bootstrap-admin.ts --reset-admin-password
 * The condition is how the packaged bundle is built too (`scripts/package-windows.ps1`): the audit service reaches modules that import `server-only`, which only that condition lets load outside Next.js.
 */
import { randomUUID } from 'node:crypto';
import { userInfo } from 'node:os';
import type { ReadStream } from 'node:tty';

import { loadAdminBootstrapEnv, loadDatabaseEnv } from '../src/lib/env';
import { isAppError, PASSWORD_RULE_CODE } from '../src/lib/errors';
import { passwordHasher } from '../src/server/auth/password-hasher';
import { createPrismaClient } from '../src/server/repositories/prisma-client';
import { createUserRepository } from '../src/server/repositories/user-repository';
import { ADMIN_EXISTS_CODE, bootstrapAdmin } from '../src/server/services/bootstrap-admin-service';

import { bootstrapMode, EXIT_USAGE, runAdminPasswordReset, USAGE_MESSAGE, windowsAccountName } from './lib/admin-password-reset-cli';
import { readHiddenLine, readVisibleLine } from './lib/hidden-prompt';

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
    if (isAppError(error) && error.code === PASSWORD_RULE_CODE) {
      // The message names the failing part and holds nothing of the password.
      process.stderr.write(`bootstrap-admin: ADMIN_INITIAL_PASSWORD does not meet the password rule. ${error.message} Nothing was changed.\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  } finally {
    await client.$disconnect();
  }
}

/** The settings and the services are loaded only now: the install path never pulls in the audit service and what it imports. */
async function openForReset() {
  const { openAdminPasswordReset } = await import('./lib/admin-password-reset-wiring');
  return openAdminPasswordReset();
}

async function runReset(): Promise<void> {
  const input = process.stdin as unknown as ReadStream;
  const output = process.stdout;
  process.exitCode = await runAdminPasswordReset({
    // A misuse guard, not a security boundary (DL-381 (2)): it cannot be piped, scheduled or reached from a service.
    interactive: process.stdin.isTTY === true && process.stdout.isTTY === true,
    out: (text) => void output.write(text),
    err: (text) => void process.stderr.write(text),
    ask: (prompt) => readVisibleLine(input, output, prompt),
    askHidden: (prompt) => readHiddenLine(input, output, prompt),
    open: openForReset,
    windowsAccount: windowsAccountName(process.env, userInfo().username),
    newRequestId: randomUUID,
  });
}

function failed(error: unknown): void {
  // The message names variables or rules, never a value (src/lib/env.ts). A database error is not printed: it
  // may carry a connection detail.
  const message = isAppError(error) ? error.message : 'unexpected error (see the database and the settings)';
  process.stderr.write(`bootstrap-admin failed: ${message}\n`);
  process.exitCode = 1;
}

const mode = bootstrapMode(process.argv.slice(2));
if (mode === 'usage') {
  process.stderr.write(`${USAGE_MESSAGE}\n`);
  process.exitCode = EXIT_USAGE;
} else {
  (mode === 'install' ? run() : runReset()).catch(failed);
}
