import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STD-02, STD-03: the role script keeps passwords off the process list and names the database from
 * POSTGRES_DB, not from a literal. Reads the script text; tests/integration/database-roles.test.ts
 * proves what it does to a real database.
 */

// The statements live in deploy/db/create-roles.psql, the one source that the Windows install reads too (STORY-10.04),
// and the shell script finds and runs it. The rules below hold for the two files together.
const SCRIPT = readFileSync(fileURLToPath(new URL('../../docker/postgres-init/01-create-roles.sh', import.meta.url)), 'utf8');
const SQL = readFileSync(fileURLToPath(new URL('../../deploy/db/create-roles.psql', import.meta.url)), 'utf8');
const CODE = `${SCRIPT}\n${SQL}`
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('#') && !line.trimStart().startsWith('--'))
  .join('\n');

describe('docker/postgres-init/01-create-roles.sh and deploy/db/create-roles.psql', () => {
  it('STORY-10.04: the shell script runs the one SQL file and creates no role itself', () => {
    expect(SCRIPT).toMatch(/--file "\$roles_sql"/);
    expect(SCRIPT).not.toMatch(/CREATE ROLE/);
    expect(SQL).toMatch(/CREATE ROLE accucut_owner LOGIN PASSWORD/);
    expect(SQL).toMatch(/CREATE ROLE accucut_app LOGIN PASSWORD/);
  });

  it('STORY-10.04: the owner has CREATEDB only when the caller asks (development), never by default', () => {
    expect(SQL).toContain('\\set owner_createdb off');
    expect(SQL).toMatch(/\\if :owner_createdb\s+ALTER ROLE accucut_owner CREATEDB;\s+\\endif/);
    expect(SCRIPT).toMatch(/DB_OWNER_CREATEDB=on/);
    expect(SQL).not.toMatch(/CREATE ROLE accucut_owner[^;]*CREATEDB/);
  });

  it('STORY-10.05: the backup role gets its password from DB_BACKUP_PASSWORD through psql, or is NOLOGIN when none is given (development, CI), and is never made with a literal password', () => {
    expect(SQL).toContain("\\set backup_password ''");
    expect(SQL).toContain('\\getenv backup_password DB_BACKUP_PASSWORD');
    expect(SQL).toMatch(/CREATE ROLE accucut_backup LOGIN PASSWORD :'backup_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;/);
    expect(SQL).toMatch(/\\else\s+CREATE ROLE accucut_backup NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;\s+\\endif/);
    // The shell script (the development database and CI) does not need the variable: CI calls it with the two passwords it always had.
    expect(SCRIPT).not.toMatch(/DB_BACKUP_PASSWORD:\?/);
  });

  it('STORY-10.05 (ADR-015 Amendment 3 point 3): the backup role can connect, use the public schema and read all data, and holds nothing else here', () => {
    expect(CODE).toMatch(/GRANT CONNECT ON DATABASE :"dbname" TO accucut_owner, accucut_app, accucut_backup;/);
    expect(CODE).toMatch(/GRANT USAGE ON SCHEMA public TO accucut_app, accucut_backup;/);
    expect(CODE).toMatch(/GRANT pg_read_all_data TO accucut_backup;/);
    const mentions = CODE.split('\n').filter((line) => line.includes('accucut_backup'));
    for (const line of mentions) expect(line, line).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|SUPERUSER|CREATEDB|CREATEROLE|OWNER)\b/);
    expect(CODE).not.toMatch(/DEFAULT PRIVILEGES[^;]*accucut_backup/);
    expect(CODE).not.toMatch(/OWNER TO accucut_backup/);
  });

  it('STD-02: passes no password on the psql command line (it would show in the process list)', () => {
    expect(CODE).not.toMatch(/-v\s+\w*password/i);
    expect(CODE).not.toMatch(/--set[= ]\w*password/i);
  });

  it('STD-02: lets psql read the passwords from its own environment', () => {
    expect(CODE).toContain('\\getenv owner_password DB_OWNER_PASSWORD');
    expect(CODE).toContain('\\getenv app_password DB_APP_PASSWORD');
  });

  it('STD-02: stops early when psql is older than 15, which has no \\getenv', () => {
    expect(CODE).toMatch(/psql --version/);
    expect(CODE).toMatch(/-lt 15/);
  });

  it('STD-03: takes the database name from POSTGRES_DB for every statement that names it', () => {
    expect(CODE).toContain('\\getenv dbname POSTGRES_DB');
    expect(CODE).toMatch(/ALTER DATABASE :"dbname" OWNER TO/);
    expect(CODE).toMatch(/REVOKE ALL ON DATABASE :"dbname" FROM PUBLIC/);
    expect(CODE).toMatch(/GRANT CONNECT ON DATABASE :"dbname" TO/);
  });

  it('STD-03: has no hard-coded database name in any statement', () => {
    expect(CODE).not.toMatch(/DATABASE\s+accucut\b/i);
  });
});
