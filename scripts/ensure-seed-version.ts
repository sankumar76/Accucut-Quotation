/**
 * The `ensure-seed-version` step (STORY-03.01 AC-6; architecture sections 5.5 and 5.6).
 *
 * Run by the `migrate` one-shot right after `prisma migrate deploy`, with the owner role
 * (`MIGRATE_DATABASE_URL`). It stores the SPEC section 7 field registry as configuration version 1, **only
 * if no version exists**, so it can run on every start and never touches a live install. It loads
 * structure, not master data (ADR-014). If it fails it exits non-zero, `migrate` fails, and `app` and
 * `worker` do not start.
 *
 * Usage: node --conditions=react-server --import tsx scripts/ensure-seed-version.ts
 *
 * The condition is required. The seed and the registry schema import the formula engine, whose files start with
 * `import 'server-only'`, and that package throws under plain Node and loads only under the `react-server`
 * condition (architecture section 10). The `migrate` one-shot runs the step the same way.
 */
import { SEED_VERSION_REASON, seedConfig } from '../prisma/seed/config';
import { loadMigrateEnv } from '../src/lib/env';
import { createConfigRepository } from '../src/server/repositories/config-repository';
import { createPrismaClient } from '../src/server/repositories/prisma-client';
import { ensureSeedVersion } from '../src/server/services/config-service';

async function run(): Promise<void> {
  const { MIGRATE_DATABASE_URL } = loadMigrateEnv();
  const client = createPrismaClient('script', MIGRATE_DATABASE_URL);
  try {
    const { created } = await ensureSeedVersion(createConfigRepository(client), {
      document: seedConfig,
      reason: SEED_VERSION_REASON,
    });
    process.stdout.write(
      created
        ? 'ensure-seed-version: configuration version 1 created.\n'
        : 'ensure-seed-version: a configuration version already exists; nothing changed.\n',
    );
  } finally {
    await client.$disconnect();
  }
}

run().catch((error: unknown) => {
  // The message names variables or rules, never a value (src/lib/env.ts, ConfigDocumentError).
  const message = error instanceof Error ? error.message : 'unknown error';
  process.stderr.write(`ensure-seed-version failed: ${message}\n`);
  process.exitCode = 1;
});
