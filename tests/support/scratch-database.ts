import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

/**
 * A throwaway database for tests of immutable tables (test strategy section 4).
 *
 * `config_versions` and its kin cannot be emptied, even by the owner (that is the point of them), so a
 * test that needs an empty table or its own history cannot share the development database. This creates
 * a new database next to it, applies every migration to it as the owner, and drops it afterwards.
 *
 * It is only ever created on the server the test settings name, which the global set-up has already
 * checked is local, CI or staging (`db-guard.ts`). Needs the owner role to hold CREATEDB, which the role
 * script gives it.
 */

const OWNER_ROLE = 'accucut_owner';
const RUNTIME_ROLE = 'accucut_app';
const MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../../prisma/migrations/', import.meta.url));
const NAME_RANDOM_BYTES = 6;

/**
 * DDL (`CREATE DATABASE`, `DROP DATABASE`, `GRANT`) cannot take bind parameters, so these statements are built
 * by interpolation. That is safe here because every interpolated value is internal: a name generated below
 * from random bytes and checked against this pattern before it is used, and two constant role names.
 */
const SCRATCH_NAME = /^aqp_scratch_[0-9a-f]+$/;

function assertScratchName(name: string): void {
  if (!SCRATCH_NAME.test(name)) throw new Error('Unexpected scratch database name.');
}

export interface ScratchDatabase {
  /** Connection URL of the owner role (what `ensure-seed-version` uses). */
  readonly ownerUrl: string;
  /** Connection URL of the runtime role (what `app` and `worker` use). */
  readonly runtimeUrl: string;
  /** Drops the database. Call it in `afterAll`. */
  drop(): Promise<void>;
}

function requiredUrl(name: 'MIGRATE_DATABASE_URL' | 'DATABASE_URL'): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} is not set. Start the test database first: docker compose -f compose.dev.yml up -d db`);
  }
  return value;
}

function withDatabase(connectionUrl: string, database: string): string {
  const url = new URL(connectionUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

/** Migration folders in order, as Prisma applies them. The folder name starts with a timestamp. */
function migrationScripts(): string[] {
  return readdirSync(MIGRATIONS_DIRECTORY)
    .filter((name) => statSync(join(MIGRATIONS_DIRECTORY, name)).isDirectory())
    .sort()
    .map((name) => readFileSync(join(MIGRATIONS_DIRECTORY, name, 'migration.sql'), 'utf8'));
}

async function withClient<T>(url: string, action: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await action(client);
  } finally {
    await client.end();
  }
}

export async function createMigratedScratchDatabase(): Promise<ScratchDatabase> {
  const ownerBase = requiredUrl('MIGRATE_DATABASE_URL');
  const runtimeBase = requiredUrl('DATABASE_URL');
  const name = `aqp_scratch_${randomBytes(NAME_RANDOM_BYTES).toString('hex')}`;
  assertScratchName(name);
  const ownerUrl = withDatabase(ownerBase, name);
  const runtimeUrl = withDatabase(runtimeBase, name);

  await withClient(ownerBase, (client) => client.query(`CREATE DATABASE "${name}"`));
  try {
    await withClient(ownerUrl, async (client) => {
      // What the role script sets up in the main database: the runtime role may use the schema and
      // reads and writes what the owner creates; a migration then takes rights away per table.
      await client.query(`GRANT USAGE ON SCHEMA public TO ${RUNTIME_ROLE}`);
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${OWNER_ROLE} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${RUNTIME_ROLE}`,
      );
      for (const script of migrationScripts()) await client.query(script);
    });
  } catch (error) {
    await withClient(ownerBase, (client) => client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
    throw error;
  }

  return {
    ownerUrl,
    runtimeUrl,
    drop: () => withClient(ownerBase, async (client) => void (await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`))),
  };
}
