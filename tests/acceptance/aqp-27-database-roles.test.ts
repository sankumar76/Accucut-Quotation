import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * QA acceptance tests for AQP-27 AC-9, written from the acceptance criterion and the test plan:
 * PostgreSQL 17 pinned by digest on a private port, an owner role for migrations and a runtime role
 * with no DDL rights. The developer's own test (tests/integration/database-roles.test.ts) proves the
 * role names and the basic DDL refusals; these add the privilege-escalation routes a runtime role
 * must not have (switching role, extensions, server files, programs, roles, databases).
 *
 * Needs MIGRATE_DATABASE_URL (owner) and DATABASE_URL (runtime). The global set-up has already refused
 * any host that is not local, CI or staging. Every table name and value is invented.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PROBE_TABLE = 'aqp27_qa_probe';

function requiredUrl(name: 'MIGRATE_DATABASE_URL' | 'DATABASE_URL'): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} is not set. Start the test database first: docker compose -f compose.dev.yml up -d db`);
  }
  return value;
}

describe('[AQP-27 AC-9] compose.dev.yml and the role script', () => {
  const compose = readFileSync(join(ROOT, 'compose.dev.yml'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');

  it('[AQP-27 AC-9] uses PostgreSQL 17 pinned by digest', () => {
    expect(compose).toMatch(/image:\s*postgres:17@sha256:[0-9a-f]{64}\b/);
  });

  it('[AQP-27 AC-9] publishes the database on the loopback address only', () => {
    const ports = [...compose.matchAll(/^\s*-\s*'?(\S+?:\d+:\d+)'?\s*$/gm)].map((match) => match[1] ?? '');
    expect(ports.length).toBeGreaterThan(0);
    for (const mapping of ports) expect(mapping).toMatch(/^127\.0\.0\.1:/);
  });

  it('[AQP-27 AC-9] refuses to start without the two passwords (no default password in the file)', () => {
    expect(compose).toMatch(/DB_OWNER_PASSWORD:\s*\$\{DB_OWNER_PASSWORD:\?/);
    expect(compose).toMatch(/DB_APP_PASSWORD:\s*\$\{DB_APP_PASSWORD:\?/);
  });

  it('[AQP-27 AC-9] the role script reads passwords from the environment, never from its own text', () => {
    // The statements are in the one SQL source that the Windows install reads too (STORY-10.04).
    const script = readFileSync(join(ROOT, 'deploy/db/create-roles.psql'), 'utf8');
    expect(script).toContain('\\getenv owner_password DB_OWNER_PASSWORD');
    expect(script).toContain('\\getenv app_password DB_APP_PASSWORD');
    expect(script).not.toMatch(/PASSWORD\s+'[^']+'/);
  });
});

describe('[AQP-27 AC-9] the runtime role cannot escalate or change structure', () => {
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

  it('[AQP-27 AC-9] the server is PostgreSQL 17', async () => {
    const { rows } = await runtime.query('SHOW server_version_num');
    expect(Math.floor(Number(rows[0]?.server_version_num) / 10_000)).toBe(17);
  });

  it('[AQP-27 AC-9] the owner role is not a superuser and cannot create roles', async () => {
    const { rows } = await owner.query(
      "SELECT rolsuper, rolcreaterole FROM pg_roles WHERE rolname = 'accucut_owner'",
    );
    expect(rows).toEqual([{ rolsuper: false, rolcreaterole: false }]);
  });

  it('[AQP-27 AC-9] the runtime role belongs to no other role', async () => {
    const { rows } = await owner.query(
      "SELECT count(*)::int AS memberships FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member WHERE r.rolname = 'accucut_app'",
    );
    expect(rows).toEqual([{ memberships: 0 }]);
  });

  it.each([
    ['switch to the owner role', 'SET ROLE accucut_owner'],
    ['switch to the bootstrap superuser', 'SET ROLE postgres'],
    ['create a table in the public schema', 'CREATE TABLE public.aqp27_qa_not_allowed (id integer)'],
    ['create a temporary table', 'CREATE TEMP TABLE aqp27_qa_temp (id integer)'],
    ['create an extension', 'CREATE EXTENSION IF NOT EXISTS pgcrypto'],
    ['read password hashes', 'SELECT rolpassword FROM pg_authid LIMIT 1'],
    ['read a file on the server', "SELECT pg_read_file('/etc/hostname', 0, 10)"],
    ['run a program on the server', "COPY (SELECT 1) TO PROGRAM 'true'"],
    ['create a role', 'CREATE ROLE aqp27_qa_evil'],
    ['create a database', 'CREATE DATABASE aqp27_qa_evil'],
    ['drop the database', 'DROP DATABASE accucut'],
    ['add a column to a table the owner created', `ALTER TABLE ${PROBE_TABLE} ADD COLUMN extra text`],
    ['drop a table the owner created', `DROP TABLE ${PROBE_TABLE}`],
    ['truncate a table the owner created', `TRUNCATE ${PROBE_TABLE}`],
  ])('[AQP-27 AC-9] the runtime role cannot %s', async (_name, statement) => {
    await expect(runtime.query(statement)).rejects.toThrow(/permission denied|must be owner|must be superuser/);
  });

  it('[AQP-27 AC-9] granting itself more rights does nothing (PostgreSQL only warns when the grantor owns nothing)', async () => {
    await runtime.query(`GRANT ALL ON ${PROBE_TABLE} TO accucut_app`);
    const { rows } = await owner.query(
      `SELECT has_table_privilege('accucut_app', '${PROBE_TABLE}', 'TRUNCATE') AS can_truncate,
              has_table_privilege('accucut_app', '${PROBE_TABLE}', 'REFERENCES') AS can_reference,
              has_table_privilege('accucut_app', '${PROBE_TABLE}', 'TRIGGER') AS can_trigger`,
    );
    expect(rows).toEqual([{ can_truncate: false, can_reference: false, can_trigger: false }]);
  });

  it('[AQP-27 AC-9] a table the owner creates later is readable and writable by the runtime role without a new grant', async () => {
    await runtime.query(`INSERT INTO ${PROBE_TABLE} (id, label) VALUES (1, 'invented')`);
    await runtime.query(`UPDATE ${PROBE_TABLE} SET label = 'changed' WHERE id = 1`);
    expect((await runtime.query(`SELECT label FROM ${PROBE_TABLE} WHERE id = 1`)).rows).toEqual([{ label: 'changed' }]);
    await runtime.query(`DELETE FROM ${PROBE_TABLE} WHERE id = 1`);
  });

  it('[AQP-27 AC-9] the runtime role may create objects in no schema', async () => {
    const { rows } = await owner.query(
      "SELECT nspname FROM pg_namespace WHERE has_schema_privilege('accucut_app', oid, 'CREATE') AND nspname NOT LIKE 'pg\\_%' ESCAPE '\\'",
    );
    expect(rows).toEqual([]);
  });
});
