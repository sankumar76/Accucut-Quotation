import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';

import { PrismaClient } from '../../generated/prisma/client';

export type { PrismaClient };

/**
 * The one place a Prisma client is built (architecture section 10: only `src/server/repositories`
 * imports Prisma). Prisma 7 talks to PostgreSQL through the `pg` driver adapter.
 *
 * The pool and the timeouts are fixed constants, not settings (architecture ruling R4, PRF-01, deferred
 * issue #18): nobody tunes them in production, and each variable would be one more thing to validate. A
 * change is a release. Without them `pg` waits for a free connection for ever, lets a query run for ever
 * and lets an abandoned transaction hold its locks, so one slow request would hang every other.
 *
 * Callers pass the kind of process they are: `app` for the web process, `worker` for the job runner, and
 * `script` for a one-shot (`ensure-seed-version`, `bootstrap-admin`, `import-masters`).
 */

export const DATABASE_CLIENT_KINDS = ['app', 'worker', 'script'] as const;
export type DatabaseClientKind = (typeof DATABASE_CLIENT_KINDS)[number];

export interface PoolSettings {
  /** Most connections the process holds. 15 of PostgreSQL's 100 default leaves room for `migrate`, backups and an operator. */
  readonly max: number;
  /** How long to wait for a free or new connection before failing with an error instead of hanging. */
  readonly connectionTimeoutMillis: number;
  /** How long an unused connection stays open. */
  readonly idleTimeoutMillis: number;
  /** PostgreSQL cancels a statement that runs longer than this (error 57014). */
  readonly statementTimeoutMillis: number;
  /** PostgreSQL ends a session whose transaction sits idle this long, releasing its locks (error 25P03). */
  readonly idleInTransactionTimeoutMillis: number;
  /** Shown in `pg_stat_activity`, to tell the pools apart. */
  readonly applicationName: string;
}

const SECOND = 1_000;

export const POOL_SETTINGS = {
  app: {
    max: 10,
    connectionTimeoutMillis: 5 * SECOND,
    idleTimeoutMillis: 30 * SECOND,
    // The longest legitimate statement is a 500-row insert for one calculation, well under NFR-008's 2 s.
    statementTimeoutMillis: 10 * SECOND,
    idleInTransactionTimeoutMillis: 30 * SECOND,
    applicationName: 'accucut-app',
  },
  worker: {
    max: 3,
    connectionTimeoutMillis: 5 * SECOND,
    idleTimeoutMillis: 10 * SECOND,
    statementTimeoutMillis: 30 * SECOND,
    idleInTransactionTimeoutMillis: 30 * SECOND,
    applicationName: 'accucut-worker',
  },
  script: {
    max: 2,
    connectionTimeoutMillis: 5 * SECOND,
    idleTimeoutMillis: 10 * SECOND,
    statementTimeoutMillis: 30 * SECOND,
    idleInTransactionTimeoutMillis: 30 * SECOND,
    applicationName: 'accucut-script',
  },
} as const satisfies Readonly<Record<DatabaseClientKind, PoolSettings>>;

/**
 * The `pg` pool configuration for a kind of process. Exported so a test can check what reaches the pool.
 * It takes no overrides: the ruled limits cannot be loosened from production code (STD-15). A test that
 * needs a short timeout builds its client with `tests/support/test-prisma-client.ts`.
 */
export function poolConfigFor(kind: DatabaseClientKind, connectionString: string): PoolConfig {
  const settings: PoolSettings = POOL_SETTINGS[kind];
  return {
    connectionString,
    max: settings.max,
    connectionTimeoutMillis: settings.connectionTimeoutMillis,
    idleTimeoutMillis: settings.idleTimeoutMillis,
    statement_timeout: settings.statementTimeoutMillis,
    idle_in_transaction_session_timeout: settings.idleInTransactionTimeoutMillis,
    application_name: settings.applicationName,
  };
}

/**
 * Builds a client for one kind of process. Pass `DATABASE_URL` (the runtime role) from `app` and `worker`,
 * and `MIGRATE_DATABASE_URL` (the owner role) from the `migrate` step only. The caller validates the URL
 * (`src/lib/env.ts`) and closes the client with `$disconnect()`.
 *
 * Not a singleton yet: the first `app` or `worker` caller adds `getPrismaClient(kind)` with the
 * `globalThis` cache (a second pool per Next.js route bundle would exceed `max`).
 */
export function createPrismaClient(kind: DatabaseClientKind, connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg(poolConfigFor(kind, connectionString)) });
}
