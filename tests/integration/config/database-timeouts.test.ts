import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DatabaseBusyError } from '../../../src/lib/errors';
import { createConfigRepository } from '../../../src/server/repositories/config-repository';
import {
  createPrismaClient,
  DATABASE_CLIENT_KINDS,
  POOL_SETTINGS,
  type PrismaClient,
} from '../../../src/server/repositories/prisma-client';
import { ensureSeedVersion } from '../../../src/server/services/config-service';
import { createMigratedScratchDatabase, type ScratchDatabase } from '../../support/scratch-database';
import { createTestPrismaClient } from '../../support/test-prisma-client';
import { SEED_VERSION_REASON, seedConfig } from '../../support/seed-config';

/**
 * Architecture ruling R4 (PRF-01, PRF-03, deferred #18): the pool and the timeouts really reach PostgreSQL,
 * and each timeout becomes a 503 DATABASE_BUSY error instead of a hang. One test per timeout.
 */

function requiredUrl(): string {
  const value = process.env['DATABASE_URL'];
  if (value === undefined || value === '') {
    throw new Error('DATABASE_URL is not set. Start the test database first: docker compose -f compose.dev.yml up -d db');
  }
  return value;
}

const MILLISECONDS_PER_SECOND = 1_000;

function showSetting(client: PrismaClient, name: 'statement_timeout' | 'idle_in_transaction_session_timeout' | 'application_name') {
  // `SHOW` takes no parameters; the name is one of the three literals above.
  return client.$queryRawUnsafe<Array<Record<string, string>>>(`SHOW ${name}`).then((rows) => rows[0]?.[name]);
}

describe('timeouts reach the server (R4)', { timeout: 60_000 }, () => {
  it.each(DATABASE_CLIENT_KINDS)('a %s client runs with its ruled statement timeout, idle-in-transaction timeout and name', async (kind) => {
    const client = createPrismaClient(kind, requiredUrl());
    try {
      const settings = POOL_SETTINGS[kind];
      expect(await showSetting(client, 'statement_timeout')).toBe(`${settings.statementTimeoutMillis / MILLISECONDS_PER_SECOND}s`);
      expect(await showSetting(client, 'idle_in_transaction_session_timeout')).toBe(
        `${settings.idleInTransactionTimeoutMillis / MILLISECONDS_PER_SECOND}s`,
      );
      expect(await showSetting(client, 'application_name')).toBe(settings.applicationName);
    } finally {
      await client.$disconnect();
    }
  });
});

describe('statement timeout becomes DATABASE_BUSY (R4)', { timeout: 60_000 }, () => {
  let database: ScratchDatabase;
  let blocker: Client;
  let client: PrismaClient;

  beforeAll(async () => {
    database = await createMigratedScratchDatabase();
    blocker = new Client({ connectionString: database.ownerUrl });
    await blocker.connect();
    client = createTestPrismaClient('script', database.ownerUrl, { statement_timeout: 500 });
  });
  afterAll(async () => {
    await client.$disconnect();
    await blocker.end();
    await database.drop();
  });

  it('a statement that waits longer than the limit is cancelled and surfaces as a 503, not a hang', async () => {
    // An open transaction holds version 1 uncommitted, so the seed insert waits on the unique index.
    await blocker.query('BEGIN');
    await blocker.query(`INSERT INTO config_versions (number, snapshot, reason) VALUES (1, '{}'::jsonb, 'held')`);
    try {
      // Cancelled by the 500 ms limit rather than left waiting: the call settles, and as DATABASE_BUSY.
      await expect(
        ensureSeedVersion(createConfigRepository(client), { document: seedConfig, reason: SEED_VERSION_REASON }),
      ).rejects.toMatchObject({ code: 'DATABASE_BUSY', httpStatus: 503 });
    } finally {
      await blocker.query('ROLLBACK');
    }
  });

  it('the original error is kept as the cause for the log', async () => {
    await blocker.query('BEGIN');
    await blocker.query(`INSERT INTO config_versions (number, snapshot, reason) VALUES (1, '{}'::jsonb, 'held')`);
    try {
      const error = await ensureSeedVersion(createConfigRepository(client), { document: seedConfig, reason: SEED_VERSION_REASON }).then(
        () => undefined,
        (thrown: unknown) => thrown,
      );
      expect(error).toBeInstanceOf(DatabaseBusyError);
      expect(error instanceof DatabaseBusyError && error.cause instanceof Error).toBe(true);
    } finally {
      await blocker.query('ROLLBACK');
    }
  });
});

/** How long the test's pool waits for a connection: short, so the refusal comes well before the holder lets go. */
const POOL_WAIT_MILLISECONDS = 2_000;
/** How long one request holds the pool's only connection: three times the wait above, under the app pool's 10 s statement limit. */
const HOLD_SECONDS = 6;
/** Tries at opening the first connection. On a busy machine one connect can take longer than the short wait. */
const WARM_UP_ATTEMPTS = 5;
/** The messages `pg` gives when no connection is ready within `connectionTimeoutMillis` (as in database-errors.ts). */
const CONNECT_TIMEOUT_MESSAGES: ReadonlyArray<string> = [
  'timeout exceeded when trying to connect',
  'Connection terminated due to connection timeout',
];
/** A cause chain this long is not a real one; stopping keeps a cyclic cause from looping. */
const MAX_CAUSE_DEPTH = 4;

/** True only for the connect timeout, in the error or in its cause chain. Anything else is a real failure. */
function isConnectTimeout(error: unknown, depth = 0): boolean {
  if (!(error instanceof Error) || depth > MAX_CAUSE_DEPTH) return false;
  return CONNECT_TIMEOUT_MESSAGES.includes(error.message) || isConnectTimeout(error.cause, depth + 1);
}

describe('waiting for a connection becomes DATABASE_BUSY (R4)', { timeout: 60_000 }, () => {
  let client: PrismaClient;

  // Set-up, not the behaviour under test (test strategy section 10, DEF-003): open the pool's one connection, trying
  // again if a slow machine needs longer than the pool's short wait to connect.
  beforeAll(async () => {
    client = createTestPrismaClient('app', requiredUrl(), { max: 1, connectionTimeoutMillis: POOL_WAIT_MILLISECONDS });
    for (let attempt = 1; ; attempt += 1) {
      try {
        await client.$queryRaw`SELECT 1 AS warm`;
        return;
      } catch (error) {
        if (!isConnectTimeout(error) || attempt >= WARM_UP_ATTEMPTS) throw error;
      }
    }
  });
  afterAll(() => client.$disconnect());

  it('a second request on a full pool fails after the connect timeout instead of waiting for ever', async () => {
    // One request holds the only connection. The test then knows it is held: the holder has sent its query.
    let holderDone = false;
    const { promise: held, resolve: holding } = Promise.withResolvers<void>();
    const holder = client
      .$transaction(
        async (transaction) => {
          holding();
          await transaction.$queryRaw`SELECT 1 AS held FROM pg_sleep(${HOLD_SECONDS}::double precision)`;
        },
        { timeout: (HOLD_SECONDS + 30) * MILLISECONDS_PER_SECOND },
      )
      .finally(() => {
        holderDone = true;
      });
    await held;

    await expect(createConfigRepository(client).findLatestRef()).rejects.toMatchObject({ code: 'DATABASE_BUSY', httpStatus: 503 });
    // It was refused while the connection was still held: by the wait limit, not by the holder letting go. This is an
    // order of events, not a wall-clock bound, so a slow machine cannot make it fail (DEF-003).
    expect(holderDone).toBe(false);
    // Only let the holder finish. How it ends is not what this test checks: on a starved machine its own sleep can
    // run past the pool's statement limit, which is the previous describe's subject.
    await Promise.allSettled([holder]);
  });
});
