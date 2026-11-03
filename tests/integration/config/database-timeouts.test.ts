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
    client = createPrismaClient('script', database.ownerUrl, { statementTimeoutMillis: 500 });
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
    const started = Date.now();
    try {
      await expect(
        ensureSeedVersion(createConfigRepository(client), { document: seedConfig, reason: SEED_VERSION_REASON }),
      ).rejects.toMatchObject({ code: 'DATABASE_BUSY', httpStatus: 503 });
      // Cancelled at about the limit, long before the 30 s a script would otherwise be allowed.
      expect(Date.now() - started).toBeLessThan(10_000);
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

describe('waiting for a connection becomes DATABASE_BUSY (R4)', { timeout: 60_000 }, () => {
  it('a second request on a full pool fails after the connect timeout instead of waiting for ever', async () => {
    const client = createPrismaClient('app', requiredUrl(), { max: 1, connectionTimeoutMillis: 300 });
    try {
      // One request holds the only connection for 2 seconds.
      const holder = client.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT 1 AS held FROM pg_sleep(2)`;
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      const started = Date.now();
      await expect(createConfigRepository(client).findLatest()).rejects.toMatchObject({ code: 'DATABASE_BUSY', httpStatus: 503 });
      expect(Date.now() - started).toBeLessThan(1_500);
      await holder;
    } finally {
      await client.$disconnect();
    }
  });
});
