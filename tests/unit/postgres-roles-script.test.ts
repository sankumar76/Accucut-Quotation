import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STD-02, STD-03: the role script keeps passwords off the process list and names the database from
 * POSTGRES_DB, not from a literal. Reads the script text; tests/integration/database-roles.test.ts
 * proves what it does to a real database.
 */

const SCRIPT = readFileSync(fileURLToPath(new URL('../../docker/postgres-init/01-create-roles.sh', import.meta.url)), 'utf8');
const CODE = SCRIPT.split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('#') && !line.trimStart().startsWith('--'))
  .join('\n');

describe('docker/postgres-init/01-create-roles.sh', () => {
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
