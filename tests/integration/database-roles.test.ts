import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * AC-9: against a real PostgreSQL (compose.dev.yml locally, the Postgres service in CI), two roles
 * exist: an owner for migrations and a runtime role with no DDL rights.
 *
 * Needs MIGRATE_DATABASE_URL (owner) and DATABASE_URL (runtime). The global set-up has already
 * refused any host that is not local, CI or staging.
 */

const OWNER_ROLE = 'accucut_owner';
const RUNTIME_ROLE = 'accucut_app';
const BACKUP_ROLE = 'accucut_backup';
const PROBE_TABLE = 'aqp_role_probe';

function requiredUrl(name: 'MIGRATE_DATABASE_URL' | 'DATABASE_URL'): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} is not set. Start the test database first: docker compose -f compose.dev.yml up -d db`);
  }
  return value;
}

describe('database roles (AC-9)', () => {
  const owner = new Client({ connectionString: requiredUrl('MIGRATE_DATABASE_URL') });
  const runtime = new Client({ connectionString: requiredUrl('DATABASE_URL') });

  beforeAll(async () => {
    await Promise.all([owner.connect(), runtime.connect()]);
    await owner.query(`DROP TABLE IF EXISTS ${PROBE_TABLE}`);
    await owner.query(`CREATE TABLE ${PROBE_TABLE} (id integer PRIMARY KEY, label text NOT NULL)`);
  });

  afterAll(async () => {
    await owner.query(`DROP TABLE IF EXISTS ${PROBE_TABLE}`);
    await Promise.all([owner.end(), runtime.end()]);
  });

  it('AC-9: connects as the two different roles', async () => {
    expect((await owner.query('SELECT current_user')).rows[0]).toEqual({ current_user: OWNER_ROLE });
    expect((await runtime.query('SELECT current_user')).rows[0]).toEqual({ current_user: RUNTIME_ROLE });
  });

  it('STD-03: the role script acted on the database it connected to (it is owned by the owner role)', async () => {
    const { rows } = await owner.query(
      'SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = current_database()',
    );
    expect(rows).toEqual([{ owner: OWNER_ROLE }]);
  });

  it('AC-9: the runtime role is not a superuser and cannot create databases or roles', async () => {
    const { rows } = await owner.query(
      'SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = $1',
      [RUNTIME_ROLE],
    );
    expect(rows).toEqual([{ rolsuper: false, rolcreatedb: false, rolcreaterole: false }]);
  });

  it('AC-9: the runtime role can read and write rows of tables the owner created', async () => {
    await runtime.query(`INSERT INTO ${PROBE_TABLE} (id, label) VALUES (1, 'invented')`);
    await runtime.query(`UPDATE ${PROBE_TABLE} SET label = 'changed' WHERE id = 1`);
    expect((await runtime.query(`SELECT label FROM ${PROBE_TABLE}`)).rows).toEqual([{ label: 'changed' }]);
    await runtime.query(`DELETE FROM ${PROBE_TABLE} WHERE id = 1`);
  });

  it.each([
    ['create a table', 'CREATE TABLE aqp_not_allowed (id integer)'],
    ['create a schema', 'CREATE SCHEMA aqp_not_allowed'],
    ['alter a table', `ALTER TABLE ${PROBE_TABLE} ADD COLUMN extra text`],
    ['drop a table', `DROP TABLE ${PROBE_TABLE}`],
    ['truncate a table', `TRUNCATE ${PROBE_TABLE}`],
  ])('AC-9: the runtime role cannot %s (no DDL rights)', async (_name, statement) => {
    await expect(runtime.query(statement)).rejects.toThrow(/permission denied|must be owner/);
  });

  it('STORY-10.05 (ADR-015 Amendment 3 point 3): the backup role is no superuser, cannot create databases or roles, reads all data (pg_read_all_data) and can write and change nothing', async () => {
    const flags = await owner.query('SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = $1', [BACKUP_ROLE]);
    expect(flags.rows).toEqual([{ rolsuper: false, rolcreatedb: false, rolcreaterole: false }]);
    const privileges = await owner.query(
      `SELECT pg_has_role($1, 'pg_read_all_data', 'member') AS reads_all,
              has_table_privilege($1, '${PROBE_TABLE}', 'SELECT') AS can_select,
              has_table_privilege($1, '${PROBE_TABLE}', 'INSERT') AS can_insert,
              has_table_privilege($1, '${PROBE_TABLE}', 'UPDATE') AS can_update,
              has_table_privilege($1, '${PROBE_TABLE}', 'DELETE') AS can_delete,
              has_table_privilege($1, '${PROBE_TABLE}', 'TRUNCATE') AS can_truncate,
              has_schema_privilege($1, 'public', 'USAGE') AS can_use_public,
              has_schema_privilege($1, 'public', 'CREATE') AS can_create_in_public`,
      [BACKUP_ROLE],
    );
    expect(privileges.rows).toEqual([
      { reads_all: true, can_select: true, can_insert: false, can_update: false, can_delete: false, can_truncate: false, can_use_public: true, can_create_in_public: false },
    ]);
  });

  it('AC-9: the owner can run DDL', async () => {
    await owner.query(`ALTER TABLE ${PROBE_TABLE} ADD COLUMN extra text`);
    const { rows } = await owner.query(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position',
      [PROBE_TABLE],
    );
    expect(rows.map((row) => row.column_name)).toEqual(['id', 'label', 'extra']);
  });
});
