import { existsSync } from 'node:fs';

import { defineConfig } from 'prisma/config';

// Prisma 7 does not read `.env` itself. Load it for local use; CI and hosts set real variables.
if (existsSync('.env')) process.loadEnvFile('.env');

/**
 * Prisma CLI configuration (architecture sections 5.6 and 10).
 * Migrations run with the OWNER role (`MIGRATE_DATABASE_URL`). The runtime role has no DDL rights
 * and is never used here. `prisma generate` needs no connection, so the URL may be unset then.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    url: process.env['MIGRATE_DATABASE_URL'] ?? '',
  },
});
