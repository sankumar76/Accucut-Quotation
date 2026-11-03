import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DatabaseBusyError } from '../../src/lib/errors';
import { ConfigDocumentError, parseConfigDocument } from '../../src/lib/fields/schema';
import { createConfigRepository } from '../../src/server/repositories/config-repository';
import { withDatabaseErrors } from '../../src/server/repositories/database-errors';
import {
  createPrismaClient,
  poolConfigFor,
  POOL_SETTINGS,
  type PrismaClient,
} from '../../src/server/repositories/prisma-client';
import {
  createConfigVersionCache,
  ensureSeedVersion,
  getCurrentVersion,
} from '../../src/server/services/config-service';
import { defined } from '../support/defined';
import { createMigratedScratchDatabase, type ScratchDatabase } from '../support/scratch-database';
import { cloneSeedConfig, SEED_VERSION_REASON, seedConfig } from '../support/seed-config';

/**
 * QA acceptance tests for AQP-97 (STORY-03.01) AC-6 and the pool and timeout rules (architecture rulings
 * R4 and R5), against real PostgreSQL in throwaway databases. They add attacks the developer's tests do
 * not make: statements the trigger and grant must also stop (upsert, MERGE, DDL, replication-role
 * bypass), real concurrency (12 callers, and 4 real processes), a corrupt row written by SQL, the pool
 * ceiling and the production timeouts with no override.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HOOK_TIMEOUT = 60_000;
const INSERT_VERSION = `INSERT INTO config_versions (number, snapshot, reason) VALUES ($1, $2::jsonb, $3)`;

async function connect(url: string): Promise<Client> {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

async function countVersions(client: Client): Promise<number> {
  const { rows } = await client.query<{ count: string }>('SELECT count(*) FROM config_versions');
  return Number(rows[0]?.count);
}

async function snapshotOfRows(client: Client): Promise<string> {
  const { rows } = await client.query<{ digest: string }>(
    `SELECT coalesce(md5(string_agg(md5(t::text), ',' ORDER BY number)), 'empty') AS digest FROM config_versions t`,
  );
  return defined(rows[0]).digest;
}

interface Pair {
  readonly database: ScratchDatabase;
  readonly owner: Client;
  readonly runtime: Client;
}

async function openPair(): Promise<Pair> {
  const database = await createMigratedScratchDatabase();
  const [owner, runtime] = await Promise.all([connect(database.ownerUrl), connect(database.runtimeUrl)]);
  return { database, owner, runtime };
}

async function closePair(pair: Pair | undefined): Promise<void> {
  if (pair === undefined) return;
  await Promise.all([pair.owner.end(), pair.runtime.end()]);
  await pair.database.drop();
}

function repositoryOver(client: PrismaClient) {
  return createConfigRepository(client);
}

// ---- AC-6: more ways to change or remove a row --------------------------------------------------------------

describe('[AQP-97 AC-6] config_versions cannot be changed or removed, by either role, by any statement shape', () => {
  let pair: Pair;
  let before: string;

  beforeAll(async () => {
    pair = await openPair();
    const client = createPrismaClient('script', pair.database.ownerUrl);
    try {
      await ensureSeedVersion(repositoryOver(client), { document: seedConfig, reason: SEED_VERSION_REASON });
    } finally {
      await client.$disconnect();
    }
    before = await snapshotOfRows(pair.owner);
  }, HOOK_TIMEOUT);
  afterAll(() => closePair(pair), HOOK_TIMEOUT);

  const ATTACKS: ReadonlyArray<readonly [string, string]> = [
    ['UPDATE of created_by', `UPDATE config_versions SET created_by = gen_random_uuid()`],
    ['UPDATE of created_at', `UPDATE config_versions SET created_at = now()`],
    ['UPDATE of the id', `UPDATE config_versions SET id = gen_random_uuid()`],
    ['UPDATE of every column at once', `UPDATE config_versions SET number = 9, snapshot = '{}'::jsonb, reason = 'x', created_by = NULL`],
    ['UPDATE ... FROM another table', `UPDATE config_versions c SET reason = 'x' FROM (SELECT 1) AS other WHERE c.number = 1`],
    ['UPDATE ... RETURNING', `UPDATE config_versions SET reason = 'x' RETURNING *`],
    ['DELETE of the one row by number', `DELETE FROM config_versions WHERE number = 1`],
    ['DELETE ... RETURNING', `DELETE FROM config_versions RETURNING *`],
    ['DELETE ... USING', `DELETE FROM config_versions c USING (SELECT 1) AS other WHERE c.number = 1`],
    ['TRUNCATE ONLY', `TRUNCATE ONLY config_versions`],
    ['TRUNCATE ... RESTART IDENTITY CASCADE', `TRUNCATE config_versions RESTART IDENTITY CASCADE`],
    ['an upsert (INSERT ... ON CONFLICT DO UPDATE)', `INSERT INTO config_versions (number, snapshot, reason) VALUES (1, '{}'::jsonb, 'x') ON CONFLICT (number) DO UPDATE SET snapshot = EXCLUDED.snapshot`],
    ['MERGE ... WHEN MATCHED THEN UPDATE', `MERGE INTO config_versions c USING (SELECT 1 AS n) s ON c.number = s.n WHEN MATCHED THEN UPDATE SET reason = 'x'`],
    ['MERGE ... WHEN MATCHED THEN DELETE', `MERGE INTO config_versions c USING (SELECT 1 AS n) s ON c.number = s.n WHEN MATCHED THEN DELETE`],
  ];

  it.each(ATTACKS)('[AQP-97 AC-6] %s is refused for the runtime role and nothing changes', async (_name, statement) => {
    await expect(pair.runtime.query(statement)).rejects.toMatchObject({ code: '42501' });
    expect(await snapshotOfRows(pair.owner)).toBe(before);
  });

  it.each(ATTACKS)('[AQP-97 AC-6] %s is refused for the owner and nothing changes', async (_name, statement) => {
    await expect(pair.owner.query(statement)).rejects.toMatchObject({ code: '23000' });
    expect(await snapshotOfRows(pair.owner)).toBe(before);
  });

  it('[AQP-97 AC-6] a refused statement inside a transaction aborts it, and a rollback leaves the row as it was', async () => {
    await pair.owner.query('BEGIN');
    await expect(pair.owner.query(`UPDATE config_versions SET reason = 'x'`)).rejects.toMatchObject({ code: '23000' });
    await expect(pair.owner.query('SELECT 1')).rejects.toMatchObject({ code: '25P02' });
    await pair.owner.query('ROLLBACK');
    expect(await snapshotOfRows(pair.owner)).toBe(before);
  });

  it('[AQP-97 AC-6] the refusal message names the table and the operation, not the row', async () => {
    const error = await pair.owner.query(`UPDATE config_versions SET reason = 'sentinel-reason-4d2'`).then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(Error);
    const message = error instanceof Error ? error.message : '';
    expect(message).toBe('Table "config_versions" is immutable: UPDATE is not allowed.');
    expect(message).not.toContain('sentinel-reason-4d2');
    expect(message).not.toContain(SEED_VERSION_REASON);
  });

  it('[AQP-97 AC-6] an owner UPDATE or DELETE that matches no row changes nothing (the trigger fires per row)', async () => {
    const update = await pair.owner.query(`UPDATE config_versions SET reason = 'x' WHERE false`);
    const remove = await pair.owner.query(`DELETE FROM config_versions WHERE number = 999`);
    expect([update.rowCount, remove.rowCount]).toEqual([0, 0]);
    expect(await snapshotOfRows(pair.owner)).toBe(before);
  });

  it('[AQP-97 AC-6] the runtime role cannot remove the guard: no DDL, no trigger changes, no new grant, no replication-role bypass', async () => {
    const statements = [
      'ALTER TABLE config_versions DISABLE TRIGGER ALL',
      'ALTER TABLE config_versions DISABLE TRIGGER trg_config_versions_forbid_change',
      'DROP TRIGGER trg_config_versions_forbid_change ON config_versions',
      'DROP TABLE config_versions',
      'ALTER TABLE config_versions RENAME TO config_versions_old',
      `CREATE OR REPLACE FUNCTION forbid_immutable_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$`,
      'DROP FUNCTION forbid_immutable_change() CASCADE',
      'CREATE TABLE sneaky (id int)',
      'SET session_replication_role = replica',
    ];
    for (const statement of statements) {
      await expect(pair.runtime.query(statement), statement).rejects.toMatchObject({ code: '42501' });
    }
    // GRANT by a role without the grant option is a warning, not an error, so it is checked by its effect.
    await pair.runtime.query('GRANT UPDATE, DELETE, TRUNCATE ON config_versions TO accucut_app');
    const { rows } = await pair.owner.query<{ update: boolean; delete: boolean; truncate: boolean }>(
      `SELECT has_table_privilege('accucut_app','config_versions','UPDATE') AS update,
              has_table_privilege('accucut_app','config_versions','DELETE') AS delete,
              has_table_privilege('accucut_app','config_versions','TRUNCATE') AS truncate`,
    );
    expect(rows).toEqual([{ update: false, delete: false, truncate: false }]);
    expect(await snapshotOfRows(pair.owner)).toBe(before);
  });

  it('[AQP-97 AC-6] the owner is not a superuser: it cannot switch triggers off for a session with session_replication_role', async () => {
    await expect(pair.owner.query('SET session_replication_role = replica')).rejects.toMatchObject({ code: '42501' });
    const { rows } = await pair.owner.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
    );
    expect(rows).toEqual([{ rolsuper: false, rolbypassrls: false }]);
  });

  it('[AQP-97 AC-6] the runtime role holds exactly SELECT and INSERT on the table and on every column, and PUBLIC holds nothing', async () => {
    const { rows } = await pair.owner.query<{ privilege: string; granted: boolean }>(
      `SELECT privilege, has_table_privilege('accucut_app', 'config_versions', privilege) AS granted
       FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS privilege`,
    );
    expect(Object.fromEntries(rows.map((row) => [row.privilege, row.granted]))).toEqual({
      SELECT: true,
      INSERT: true,
      UPDATE: false,
      DELETE: false,
      TRUNCATE: false,
      REFERENCES: false,
      TRIGGER: false,
    });
    const columns = await pair.owner.query<{ column_name: string; can_update: boolean }>(
      `SELECT column_name, has_column_privilege('accucut_app', 'config_versions', column_name, 'UPDATE') AS can_update
       FROM information_schema.columns WHERE table_name = 'config_versions'`,
    );
    expect(columns.rows.map((row) => row.column_name).sort()).toEqual(['created_at', 'created_by', 'id', 'number', 'reason', 'snapshot']);
    expect(columns.rows.every((row) => !row.can_update)).toBe(true);
    const grantees = await pair.owner.query<{ grantee: string }>(
      `SELECT DISTINCT grantee FROM information_schema.table_privileges WHERE table_name = 'config_versions' ORDER BY grantee`,
    );
    expect(grantees.rows.map((row) => row.grantee)).toEqual(['accucut_app', 'accucut_owner']);
  });

  it('[AQP-97 AC-6] both triggers exist, are enabled, and are BEFORE: row UPDATE/DELETE, and statement TRUNCATE', async () => {
    const { rows } = await pair.owner.query<{ tgname: string; tgenabled: string; before: boolean; per_row: boolean; update: boolean; delete: boolean; truncate: boolean; fn: string }>(
      `SELECT tgname, tgenabled,
              (tgtype & 2) <> 0 AS before, (tgtype & 1) <> 0 AS per_row,
              (tgtype & 16) <> 0 AS update, (tgtype & 8) <> 0 AS delete, (tgtype & 32) <> 0 AS truncate,
              p.proname AS fn
         FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE tgrelid = 'config_versions'::regclass AND NOT tgisinternal ORDER BY tgname`,
    );
    expect(rows).toEqual([
      { tgname: 'trg_config_versions_forbid_change', tgenabled: 'O', before: true, per_row: true, update: true, delete: true, truncate: false, fn: 'forbid_immutable_change' },
      { tgname: 'trg_config_versions_forbid_truncate', tgenabled: 'O', before: true, per_row: false, update: false, delete: false, truncate: true, fn: 'forbid_immutable_change' },
    ]);
  });

  it('[AQP-97 AC-6] the trigger function pins its search_path to pg_catalog', async () => {
    const { rows } = await pair.owner.query<{ proconfig: string[] | null }>(`SELECT proconfig FROM pg_proc WHERE proname = 'forbid_immutable_change'`);
    expect(rows[0]?.proconfig).toEqual(['search_path=pg_catalog']);
  });

  it('[AQP-97 AC-6] the table has the columns of the AC, a unique number, and no updated_at', async () => {
    const { rows } = await pair.owner.query<{ column_name: string; data_type: string; is_nullable: string }>(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'config_versions' ORDER BY ordinal_position`,
    );
    expect(rows).toEqual([
      { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
      { column_name: 'number', data_type: 'integer', is_nullable: 'NO' },
      { column_name: 'snapshot', data_type: 'jsonb', is_nullable: 'NO' },
      { column_name: 'created_by', data_type: 'uuid', is_nullable: 'YES' },
      { column_name: 'reason', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
    ]);
    const unique = await pair.owner.query<{ indexname: string; indexdef: string }>(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'config_versions' ORDER BY indexname`);
    expect(unique.rows.map((row) => row.indexname)).toEqual(['config_versions_pkey', 'uq_config_versions_number']);
    expect(defined(unique.rows[1]).indexdef).toContain('UNIQUE');
  });

  it('[AQP-97 AC-6] the stored version 1 is the seed: number 1, no author, the seed reason, a UTC timestamp, the same document', async () => {
    const { rows } = await pair.owner.query(`SELECT number, created_by, reason, snapshot, created_at, pg_typeof(created_at)::text AS created_type FROM config_versions`);
    expect(rows).toHaveLength(1);
    const row = defined(rows[0]);
    expect(row).toMatchObject({ number: 1, created_by: null, reason: SEED_VERSION_REASON, created_type: 'timestamp with time zone' });
    expect(Math.abs(Date.now() - new Date(row.created_at).getTime())).toBeLessThan(10 * 60_000);
    expect(parseConfigDocument(row.snapshot)).toEqual(seedConfig);
    expect(row.snapshot.fields).toHaveLength(67);
  });
});

// ---- AC-6: a corrupt row written by SQL is never served ---------------------------------------------------------

describe('[AQP-97 AC-6] the schema is enforced on read as well as on seed', () => {
  let pair: Pair;
  let prisma: PrismaClient;

  beforeAll(async () => {
    pair = await openPair();
    prisma = createPrismaClient('app', pair.database.runtimeUrl);
  }, HOOK_TIMEOUT);
  afterAll(async () => {
    await prisma.$disconnect();
    await closePair(pair);
  }, HOOK_TIMEOUT);

  it('[AQP-97 AC-6] a later version written straight into the table (the runtime role may INSERT) that breaks a rule is refused on read, and the last good version is not used instead', async () => {
    const repository = repositoryOver(prisma);
    await pair.runtime.query(INSERT_VERSION, [1, JSON.stringify(seedConfig), 'good']);
    const cache = createConfigVersionCache();
    expect((await getCurrentVersion(repository, cache)).number).toBe(1);

    const leaking = cloneSeedConfig();
    defined(leaking.fields.find((field) => field.kind === 'output')).engineerVisible = true;
    await pair.runtime.query(INSERT_VERSION, [2, JSON.stringify(leaking), 'a bad write']);
    await expect(getCurrentVersion(repository, cache)).rejects.toBeInstanceOf(ConfigDocumentError);
    expect(cache.size()).toBe(1);
  });

  it('[AQP-97 AC-6] the latest version is the highest number, compared as a number (10 after 2), not as text or by time', async () => {
    const repository = repositoryOver(prisma);
    // Version 2 is already the bad one above and rows cannot be removed, so valid ones are added above it.
    await pair.runtime.query(INSERT_VERSION, [10, JSON.stringify(seedConfig), 'ten']);
    await pair.runtime.query(INSERT_VERSION, [3, JSON.stringify(seedConfig), 'three, written after ten']);
    const latest = await getCurrentVersion(repository, createConfigVersionCache());
    expect([latest.number, latest.reason]).toEqual([10, 'ten']);
  });

  it('[AQP-97 AC-6] a new version written by another process is seen on the next call; the earlier parsed version is not served in its place', async () => {
    const repository = repositoryOver(prisma);
    const cache = createConfigVersionCache();
    const first = await getCurrentVersion(repository, cache);
    expect(await getCurrentVersion(repository, cache)).toBe(first);
    await pair.runtime.query(INSERT_VERSION, [11, JSON.stringify(seedConfig), 'eleven']);
    const next = await getCurrentVersion(repository, cache);
    expect(next.number).toBe(11);
    expect(next).not.toBe(first);
    expect(first.number).toBe(10);
  });

  it('[AQP-97 AC-6] the version served is deep-frozen and its time is text', async () => {
    const version = await getCurrentVersion(repositoryOver(prisma), createConfigVersionCache());
    expect(Object.isFrozen(version)).toBe(true);
    expect(Object.isFrozen(version.document)).toBe(true);
    expect(Object.isFrozen(defined(version.document.fields[0]))).toBe(true);
    expect(typeof version.createdAt).toBe('string');
    expect(new Date(version.createdAt).toISOString()).toBe(version.createdAt);
    expect(() => {
      defined(version.document.fields[0]).label = 'changed';
    }).toThrow(TypeError);
  });
});

// ---- ensureSeedVersion: concurrency ---------------------------------------------------------------------------

describe('[AQP-97 AC-6] ensure-seed-version under concurrency', () => {
  const CALLERS = 12;

  it.each([1, 2, 3])('[AQP-97 AC-6] round %i: 12 callers at once, each with its own connection pool, create version 1 exactly once', async () => {
    const pair = await openPair();
    const clients = Array.from({ length: CALLERS }, () => createPrismaClient('script', pair.database.ownerUrl));
    try {
      const results = await Promise.all(
        clients.map((client) => ensureSeedVersion(repositoryOver(client), { document: seedConfig, reason: SEED_VERSION_REASON })),
      );
      expect(results.filter((result) => result.created)).toHaveLength(1);
      expect(results.filter((result) => !result.created)).toHaveLength(CALLERS - 1);
      expect(await countVersions(pair.owner)).toBe(1);
      const { rows } = await pair.owner.query('SELECT number FROM config_versions');
      expect(rows).toEqual([{ number: 1 }]);
    } finally {
      await Promise.all(clients.map((client) => client.$disconnect()));
      await closePair(pair);
    }
  }, HOOK_TIMEOUT);

  it('[AQP-97 AC-6] callers racing with different documents still store one version, and it is whole (one winner, not a mix)', async () => {
    const pair = await openPair();
    const clients = Array.from({ length: 6 }, () => createPrismaClient('script', pair.database.ownerUrl));
    try {
      const documents = clients.map((_client, index) => {
        const document = cloneSeedConfig();
        defined(document.fields[1]).label = `Variant ${index}`;
        return document;
      });
      const results = await Promise.all(
        clients.map((client, index) => ensureSeedVersion(repositoryOver(client), { document: defined(documents[index]), reason: `Variant ${index}` })),
      );
      expect(results.filter((result) => result.created)).toHaveLength(1);
      const { rows } = await pair.owner.query<{ reason: string; snapshot: unknown }>('SELECT reason, snapshot FROM config_versions');
      expect(rows).toHaveLength(1);
      const winner = Number(defined(rows[0]).reason.replace('Variant ', ''));
      expect(parseConfigDocument(defined(rows[0]).snapshot)).toEqual(documents[winner]);
    } finally {
      await Promise.all(clients.map((client) => client.$disconnect()));
      await closePair(pair);
    }
  }, HOOK_TIMEOUT);

  interface ProcessResult {
    readonly status: number | null;
    readonly stdout: string;
    readonly stderr: string;
  }

  function runStepAsync(environment: Record<string, string>): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const base = { ...process.env };
      delete base['MIGRATE_DATABASE_URL'];
      delete base['DATABASE_URL'];
      const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/ensure-seed-version.ts'], { cwd: ROOT, env: { ...base, ...environment } });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => void (stdout += chunk.toString()));
      child.stderr.on('data', (chunk: Buffer) => void (stderr += chunk.toString()));
      child.on('error', reject);
      child.on('close', (status) => resolve({ status, stdout, stderr }));
    });
  }

  it('[AQP-97 AC-6] four real ensure-seed-version processes started together: all exit 0, exactly one says created, one row', async () => {
    const pair = await openPair();
    try {
      const results = await Promise.all(Array.from({ length: 4 }, () => runStepAsync({ MIGRATE_DATABASE_URL: pair.database.ownerUrl })));
      expect(results.map((result) => result.status)).toEqual([0, 0, 0, 0]);
      expect(results.filter((result) => result.stdout.includes('configuration version 1 created'))).toHaveLength(1);
      expect(results.filter((result) => result.stdout.includes('already exists; nothing changed'))).toHaveLength(3);
      expect(await countVersions(pair.owner)).toBe(1);
      const { rows } = await pair.owner.query('SELECT number, created_by, reason, snapshot FROM config_versions');
      expect(defined(rows[0])).toMatchObject({ number: 1, created_by: null, reason: SEED_VERSION_REASON });
      expect(parseConfigDocument(defined(rows[0]).snapshot)).toEqual(seedConfig);
      for (const result of results) expect(result.stderr).toBe('');
    } finally {
      await closePair(pair);
    }
  }, 120_000);

  it('[AQP-97 AC-6] the step on a database that has no config_versions table (migrate did not run) exits 1, says so, and prints no password', async () => {
    const pair = await openPair();
    const name = `aqp_scratch_${randomBytes(6).toString('hex')}`;
    const ownerUrl = new URL(pair.database.ownerUrl);
    const admin = await connect(defined(process.env['MIGRATE_DATABASE_URL'], 'MIGRATE_DATABASE_URL'));
    try {
      await admin.query(`CREATE DATABASE "${name}"`);
      ownerUrl.pathname = `/${name}`;
      const result = await runStepAsync({ MIGRATE_DATABASE_URL: ownerUrl.toString() });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('ensure-seed-version failed');
      expect(result.stderr).not.toContain(ownerUrl.password);
      expect(result.stdout).not.toContain('created');
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
      await closePair(pair);
    }
  }, 120_000);

  it('[AQP-97 AC-6] a wrong password exits 1 and prints neither the password nor the connection string', async () => {
    const pair = await openPair();
    try {
      const wrong = new URL(pair.database.ownerUrl);
      wrong.password = 'wrong-password-sentinel-81c';
      const result = await runStepAsync({ MIGRATE_DATABASE_URL: wrong.toString() });
      expect(result.status).toBe(1);
      const output = result.stdout + result.stderr;
      expect(output).not.toContain('wrong-password-sentinel-81c');
      expect(output).not.toContain(pair.database.ownerUrl);
      expect(await countVersions(pair.owner)).toBe(0);
    } finally {
      await closePair(pair);
    }
  }, 120_000);
});

// ---- Pool and timeouts (ruling R4) -----------------------------------------------------------------------------

describe('[AQP-97 R4] pool and timeout settings', () => {
  it('[AQP-97 R4] the constants are the ruled table: max, connect, idle, statement and idle-in-transaction timeouts and names, per process kind', () => {
    expect(POOL_SETTINGS).toEqual({
      app: { max: 10, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000, statementTimeoutMillis: 10_000, idleInTransactionTimeoutMillis: 30_000, applicationName: 'accucut-app' },
      worker: { max: 3, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 10_000, statementTimeoutMillis: 30_000, idleInTransactionTimeoutMillis: 30_000, applicationName: 'accucut-worker' },
      script: { max: 2, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 10_000, statementTimeoutMillis: 30_000, idleInTransactionTimeoutMillis: 30_000, applicationName: 'accucut-script' },
    });
  });

  it('[AQP-97 R4] what reaches the pool is those values under the pg names, and nothing else changes with the connection string', () => {
    for (const kind of ['app', 'worker', 'script'] as const) {
      const settings = POOL_SETTINGS[kind];
      expect(poolConfigFor(kind, 'postgresql://u:p@127.0.0.1:1/x')).toEqual({
        connectionString: 'postgresql://u:p@127.0.0.1:1/x',
        max: settings.max,
        connectionTimeoutMillis: settings.connectionTimeoutMillis,
        idleTimeoutMillis: settings.idleTimeoutMillis,
        statement_timeout: settings.statementTimeoutMillis,
        idle_in_transaction_session_timeout: settings.idleInTransactionTimeoutMillis,
        application_name: settings.applicationName,
      });
    }
  });

  it('[AQP-97 R4] production code cannot loosen the limits: poolConfigFor and createPrismaClient take two parameters and no override', () => {
    expect(poolConfigFor.length).toBe(2);
    expect(createPrismaClient.length).toBe(2);
  });
});

describe('[AQP-97 R4] the pool ceiling and the timeouts, with the production settings and no override', () => {
  let pair: Pair;

  beforeAll(async () => {
    pair = await openPair();
  }, HOOK_TIMEOUT);
  afterAll(() => closePair(pair), HOOK_TIMEOUT);

  async function peakConnections(applicationName: string, concurrent: number, sleepSeconds: number, kind: 'app' | 'script'): Promise<number> {
    const url = kind === 'app' ? pair.database.runtimeUrl : pair.database.ownerUrl;
    const client = createPrismaClient(kind, url);
    try {
      // A Prisma query starts only when it is awaited, so each one is started here by wrapping it in a real promise.
      const work = Array.from({ length: concurrent }, () => Promise.resolve(client.$queryRawUnsafe(`SELECT 1 AS held FROM pg_sleep(${sleepSeconds})`)));
      await new Promise((resolve) => setTimeout(resolve, 600));
      // A role sees the details of its own sessions only, so the count is taken as the role the client uses.
      const observer = kind === 'app' ? pair.runtime : pair.owner;
      const { rows } = await observer.query<{ count: string }>(
        `SELECT count(*) FROM pg_stat_activity WHERE application_name = $1 AND datname = current_database()`,
        [applicationName],
      );
      await Promise.all(work);
      return Number(defined(rows[0]).count);
    } finally {
      await client.$disconnect();
    }
  }

  it('[AQP-97 R4] an app client opens no more than 10 connections however many requests arrive at once (25 sent)', async () => {
    const peak = await peakConnections('accucut-app', 25, 1.5, 'app');
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(10);
  }, 60_000);

  it('[AQP-97 R4] a script client opens no more than 2 connections (6 sent)', async () => {
    const peak = await peakConnections('accucut-script', 6, 1.5, 'script');
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(2);
  }, 60_000);

  it('[AQP-97 R4] a statement that runs past the production limit (10 s) is cancelled and becomes DATABASE_BUSY, 503, with the driver error kept as the cause and out of the message', async () => {
    const client = createPrismaClient('app', pair.database.runtimeUrl);
    try {
      const started = Date.now();
      const error = await withDatabaseErrors(() => client.$queryRaw`SELECT 1 AS held FROM pg_sleep(14)`).then(
        () => undefined,
        (thrown: unknown) => thrown,
      );
      const elapsed = Date.now() - started;
      expect(error).toBeInstanceOf(DatabaseBusyError);
      expect(error).toMatchObject({ code: 'DATABASE_BUSY', httpStatus: 503, message: 'The service is busy. Try again in a moment.' });
      expect(error instanceof Error && error.cause instanceof Error).toBe(true);
      expect(JSON.stringify(error)).not.toContain('pg_sleep');
      expect(JSON.stringify(error)).not.toContain(new URL(pair.database.runtimeUrl).password);
      expect(elapsed).toBeGreaterThan(9_000);
      expect(elapsed).toBeLessThan(13_000);
    } finally {
      await client.$disconnect();
    }
  }, 60_000);

  it('[AQP-97 R4] the 11th request on a full app pool fails after about 5 s with DATABASE_BUSY, not after the holders finish', async () => {
    const client = createPrismaClient('app', pair.database.runtimeUrl);
    try {
      const holders = Array.from({ length: 10 }, () => Promise.resolve(client.$queryRaw`SELECT 1 AS held FROM pg_sleep(8)`));
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      const started = Date.now();
      const error = await createConfigRepository(client).findLatestRef().then(
        () => undefined,
        (thrown: unknown) => thrown,
      );
      const elapsed = Date.now() - started;
      expect(error).toBeInstanceOf(DatabaseBusyError);
      expect(error).toMatchObject({ code: 'DATABASE_BUSY', httpStatus: 503 });
      expect(elapsed).toBeGreaterThan(4_000);
      expect(elapsed).toBeLessThan(7_500);
      await Promise.all(holders);
      // The pool recovers: the same request now succeeds.
      await expect(createConfigRepository(client).findLatestRef()).resolves.not.toBeUndefined();
    } finally {
      await client.$disconnect();
    }
  }, 60_000);

  it('[AQP-97 R4] errors that are not timeouts pass through the repository wrapper unchanged', async () => {
    const client = createPrismaClient('app', pair.database.runtimeUrl);
    try {
      const original = new Error('not a timeout');
      await expect(withDatabaseErrors(() => Promise.reject(original))).rejects.toBe(original);
      const denied = await withDatabaseErrors(() => client.$executeRaw`UPDATE config_versions SET reason = 'x'`).then(
        () => undefined,
        (thrown: unknown) => thrown,
      );
      expect(denied).toBeInstanceOf(Error);
      expect(denied).not.toBeInstanceOf(DatabaseBusyError);
    } finally {
      await client.$disconnect();
    }
  }, 60_000);
});
