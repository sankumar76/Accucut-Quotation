import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '@/server/repositories/prisma-client';
import { createConfigRepository, SEED_CHECKPOINT_NAME } from '@/server/repositories/config-repository';

import { createMigratedScratchDatabase, type ScratchDatabase } from '../../support/scratch-database';

/**
 * STORY-08.06 AC-1 (architecture section 5.6): the migration that creates `config_checkpoints` also gives an install that **already holds version 1** (every Release 1 install) the seed checkpoint
 * "Original configuration", with no person, and running that step twice leaves one. A wrong backfill would leave an install with no checkpoint to return to, so it has its own test. The scratch database is fully
 * migrated (an empty table, no version), so the test stores version 1 as the owner does on a live install and then runs the migration's own backfill statement, read from the migration file (not retyped), once and again.
 * The seed step on a new install (`ensure-seed-version`) is `ensure-seed-version-script.test.ts`. The migration must not touch version 1 or any estimate: both are compared before and after.
 */

const MIGRATION = fileURLToPath(new URL('../../../prisma/migrations/20261120120000_config_checkpoints/migration.sql', import.meta.url));

/** The backfill is the last statement of the migration: from its own `INSERT INTO "config_checkpoints"` to the end. */
function backfillStatement(): string {
  const sql = readFileSync(MIGRATION, 'utf8');
  const start = sql.lastIndexOf('INSERT INTO "config_checkpoints"');
  if (start < 0) throw new Error('The migration holds no backfill statement.');
  return sql.slice(start);
}

describe('the migration of config_checkpoints (AC-1)', { timeout: 120_000 }, () => {
  let database: ScratchDatabase;
  let client: Client;

  beforeAll(async () => {
    database = await createMigratedScratchDatabase();
    client = new Client({ connectionString: database.ownerUrl });
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
    await database.drop();
  });

  const checkpoints = async () => (await client.query<{ name: string; number: number; created_by: string | null }>('SELECT c.name, v.number, c.created_by FROM config_checkpoints c JOIN config_versions v ON v.id = c.config_version_id')).rows;

  it('names its seed checkpoint with the constant the seed step uses', () => {
    expect(backfillStatement()).toContain(`'${SEED_CHECKPOINT_NAME}'`);
  });

  it('adds nothing on a database with no version: a new install gets its checkpoint from ensure-seed-version', async () => {
    await client.query(backfillStatement());
    expect(await checkpoints()).toEqual([]);
  });

  it('gives an install that already holds version 1 one seed checkpoint on it, with no person, and leaves version 1 as it was', async () => {
    await client.query("INSERT INTO config_versions (number, snapshot, created_by, reason) VALUES (1, '{\"invented\": true}'::jsonb, NULL, 'Invented live install')");
    const versionBefore = (await client.query('SELECT id::text, number, snapshot, created_by, reason, created_at FROM config_versions')).rows;
    await client.query(backfillStatement());
    expect(await checkpoints()).toEqual([{ name: SEED_CHECKPOINT_NAME, number: 1, created_by: null }]);
    expect((await client.query('SELECT id::text, number, snapshot, created_by, reason, created_at FROM config_versions')).rows).toEqual(versionBefore);
  });

  it('run again, it leaves one (the unique name settles it) and does not fail', async () => {
    await client.query(backfillStatement());
    await client.query(backfillStatement());
    expect(await checkpoints()).toEqual([{ name: SEED_CHECKPOINT_NAME, number: 1, created_by: null }]);
  });

  it('does not touch an estimate, a calculation, an approval or a master: it names no such table', () => {
    const sql = readFileSync(MIGRATION, 'utf8').replace(/--.*$/gm, '').replace(/ON (?:DELETE|UPDATE) NO ACTION/g, '');
    // Every table the statements act on is written in quotes after its keyword: INSERT INTO, ALTER TABLE, CREATE TABLE, ON TABLE (REVOKE) and ON (an index or a trigger).
    const touched = [...sql.matchAll(/\b(?:INSERT\s+INTO|ALTER\s+TABLE|CREATE\s+TABLE|ON\s+TABLE|ON)\s+"([a-z_]+)"/g)].map((match) => defined(match[1]));
    expect(new Set(touched)).toEqual(new Set(['config_checkpoints']));
    // The one read of another table is the version the seed checkpoint names.
    expect(sql).toMatch(/FROM "config_versions" WHERE "number" = 1/);
  });
});

function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Expected a value.');
  return value;
}

/**
 * A restored copy that is one migration behind the installed release is migrated forward by the step of that release (`deploy/windows/tests/Restore.Tests.ps1`, R3: the older schema, the newer script). The step must
 * still store version 1 where the table of checkpoints does not exist yet, and store the seed checkpoint with it where it does.
 */
describe('the seed step against a schema without the table of checkpoints', { timeout: 120_000 }, () => {
  let database: ScratchDatabase;

  beforeAll(async () => {
    database = await createMigratedScratchDatabase();
  });
  afterAll(() => database.drop());

  const seedStep = async (): Promise<boolean> => {
    const client = createPrismaClient('script', database.ownerUrl);
    try {
      return await createConfigRepository(client).insertSeedVersionIfNone({ snapshot: { invented: true }, reason: 'Invented seed step' });
    } finally {
      await client.$disconnect();
    }
  };

  it('stores version 1, and no checkpoint, when the table is not there', async () => {
    const owner = new Client({ connectionString: database.ownerUrl });
    await owner.connect();
    try {
      await owner.query('DROP TABLE config_checkpoints');
      expect(await seedStep()).toBe(true);
      expect((await owner.query('SELECT number FROM config_versions')).rows).toEqual([{ number: 1 }]);
      // Run again: nothing changes and it still answers false.
      expect(await seedStep()).toBe(false);
    } finally {
      await owner.end();
    }
  });
});
