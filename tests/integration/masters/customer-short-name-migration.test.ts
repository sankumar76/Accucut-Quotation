import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMigratedScratchDatabase, type ScratchDatabase } from '../../support/scratch-database';

/**
 * CR-01 item 6 (AQP-390, architecture section 4.11 a): the migration `20261122100000_customer_short_name` against real PostgreSQL, over a database that already holds customers. The scratch
 * database has every migration applied, so the test first runs the **rollback note written in the migration's own header** (the statements are read from the file, not copied), which gives back
 * the schema as it was before: no `short_name`. It then plants the customers an existing install could hold (names that collapse to one base, a name with nothing usable in it, a name that is
 * more than 10 letters long, a soft-deleted customer) and runs the migration file again, as `prisma migrate deploy` does. Every name is invented.
 */

const MIGRATION_SQL = fileURLToPath(new URL('../../../prisma/migrations/20261122100000_customer_short_name/migration.sql', import.meta.url));
const migration = readFileSync(MIGRATION_SQL, 'utf8');
const ROLLBACK_STATEMENTS = migration
  .split(/\r?\n/)
  .filter((line) => /^--   (?:DROP|ALTER) .*;$/.test(line))
  .map((line) => line.slice('--   '.length));

/** Making a second migrated scratch database takes a few seconds, more than the default 5 s of a test. */
const SECOND_DATABASE_TIMEOUT = 60_000;

let scratch: ScratchDatabase;
let owner: Client;

const planted = [
  // [name, created_at, deleted]
  ['Acme Works', '2026-11-01T10:00:00Z', false],
  ['acme-works', '2026-11-01T10:00:01Z', false],
  ['Acme_Works', '2026-11-01T10:00:02Z', true],
  ['!!!', '2026-11-01T10:00:03Z', false],
  ['???', '2026-11-01T10:00:04Z', false],
  ['International Business Machines', '2026-11-01T10:00:05Z', false],
  ['International Business Systems', '2026-11-01T10:00:06Z', false],
  ['Tamarind Switchgear Ltd.', '2026-11-01T10:00:07Z', false],
  ['Ünïcode Ltd', '2026-11-01T10:00:08Z', false],
] as const;

async function rows<T extends Record<string, unknown>>(sql: string, values: ReadonlyArray<unknown> = []): Promise<T[]> {
  return (await owner.query<T>(sql, [...values])).rows;
}

beforeAll(async () => {
  scratch = await createMigratedScratchDatabase();
  owner = new Client({ connectionString: scratch.ownerUrl });
  await owner.connect();
});

afterAll(async () => {
  await owner.end();
  await scratch.drop();
});

describe('the migration file', () => {
  it('runs as one transaction: it holds no BEGIN;, COMMIT; or ROLLBACK; statement of its own (the BEGIN of the DO block is plpgsql), so Prisma wraps it and a failure undoes the whole file', () => {
    expect(migration).not.toMatch(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im);
  });

  it('has a rollback note of three statements, in reverse order: the index, the two CHECKs, the column', () => {
    expect(ROLLBACK_STATEMENTS).toHaveLength(3);
    expect(ROLLBACK_STATEMENTS[0]).toBe('DROP INDEX "uq_customers_short_name_lower";');
    expect(ROLLBACK_STATEMENTS[1]).toMatch(/^ALTER TABLE "customers" DROP CONSTRAINT "ck_customers_short_name_length", DROP CONSTRAINT "ck_customers_short_name_not_blank";$/);
    expect(ROLLBACK_STATEMENTS[2]).toBe('ALTER TABLE "customers" DROP COLUMN "short_name";');
  });
});

describe('the rollback note, the plant and the migration over existing customers (run in order, in one database)', () => {
  it('the rollback note gives back the schema as it was: a customer can be inserted with no short name', async () => {
    for (const statement of ROLLBACK_STATEMENTS) await owner.query(statement);
    expect(await rows("SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'short_name'")).toHaveLength(0);
    await owner.query("INSERT INTO customers (name) VALUES ('Invented rollback check')");
    await owner.query("DELETE FROM customers WHERE name = 'Invented rollback check'");
  });

  it('plants the customers of an existing install', async () => {
    for (const [name, createdAt, deleted] of planted) {
      await owner.query('INSERT INTO customers (name, created_at, deleted_at) VALUES ($1, $2, $3)', [name, createdAt, deleted ? createdAt : null]);
    }
    expect(await rows('SELECT 1 FROM customers')).toHaveLength(planted.length);
  });

  it('gives every customer, the soft-deleted one included, a unique short name by the rule: letters and digits only, upper case, 10 at most, CUST for nothing, a number on a clash', async () => {
    const before = await rows<{ id: string; name: string; phone: string | null; deleted_at: Date | null }>('SELECT id::text, name, phone, deleted_at FROM customers ORDER BY created_at, id');
    await owner.query(migration);
    const after = await rows<{ name: string; short_name: string }>('SELECT name, short_name FROM customers ORDER BY created_at, id');
    expect(Object.fromEntries(after.map((row) => [row.name, row.short_name]))).toEqual({
      'Acme Works': 'ACMEWORKS',
      'acme-works': 'ACMEWORKS2',
      'Acme_Works': 'ACMEWORKS3',
      '!!!': 'CUST',
      '???': 'CUST2',
      'International Business Machines': 'INTERNATIO',
      'International Business Systems': 'INTERNATI2',
      'Tamarind Switchgear Ltd.': 'TAMARINDSW',
      'Ünïcode Ltd': 'NCODELTD',
    });
    // Nothing is lost or renamed: the same rows, the same names, the same soft delete.
    const names = await rows<{ id: string; name: string; phone: string | null; deleted_at: Date | null }>('SELECT id::text, name, phone, deleted_at FROM customers ORDER BY created_at, id');
    expect(names).toEqual(before);
  });

  it('generates short names that satisfy the rules the application applies: at most 10 characters, none blank, unique ignoring letter case', async () => {
    const all = await rows<{ short_name: string }>('SELECT short_name FROM customers');
    expect(all.every((row) => row.short_name.length >= 1 && row.short_name.length <= 10)).toBe(true);
    expect(new Set(all.map((row) => row.short_name.toLowerCase())).size).toBe(all.length);
  });

  it('is deterministic: the same customers in the same order get the same names on a second database', async () => {
    const second = await createMigratedScratchDatabase();
    const client = new Client({ connectionString: second.ownerUrl });
    await client.connect();
    try {
      for (const statement of ROLLBACK_STATEMENTS) await client.query(statement);
      for (const [name, createdAt, deleted] of planted) {
        await client.query('INSERT INTO customers (name, created_at, deleted_at) VALUES ($1, $2, $3)', [name, createdAt, deleted ? createdAt : null]);
      }
      await client.query(migration);
      const again = (await client.query<{ name: string; short_name: string }>('SELECT name, short_name FROM customers ORDER BY created_at, id')).rows;
      const first = await rows<{ name: string; short_name: string }>('SELECT name, short_name FROM customers ORDER BY created_at, id');
      expect(again).toEqual(first);
    } finally {
      await client.end();
      await second.drop();
    }
  }, SECOND_DATABASE_TIMEOUT);
});

describe('the constraints the migration leaves', () => {
  const insert = (name: string, shortName: string, deleted = false): Promise<unknown> =>
    owner.query('INSERT INTO customers (name, short_name, deleted_at) VALUES ($1, $2, $3)', [name, shortName, deleted ? new Date() : null]);

  it('refuses a customer with no short name, a blank one and one of spaces only', async () => {
    await expect(owner.query("INSERT INTO customers (name) VALUES ('Invented no short name')")).rejects.toMatchObject({ code: '23502' });
    await expect(insert('Invented blank', '')).rejects.toMatchObject({ code: '23514', constraint: 'ck_customers_short_name_not_blank' });
    await expect(insert('Invented spaces', '   ')).rejects.toMatchObject({ code: '23514', constraint: 'ck_customers_short_name_not_blank' });
  });

  it('allows a short name up to the database ceiling of 20 characters (the code limit is 10, so raising it is a code-only change) and refuses 21', async () => {
    await insert('Invented twenty', 'T'.repeat(20));
    await expect(insert('Invented twenty-one', 'U'.repeat(21))).rejects.toMatchObject({ code: '23514', constraint: 'ck_customers_short_name_length' });
  });

  it('refuses a repeat of a short name ignoring letter case, by the index named uq_customers_short_name_lower', async () => {
    await insert('Invented case one', 'CaseKey');
    await expect(insert('Invented case two', 'CASEKEY')).rejects.toMatchObject({ code: '23505', constraint: 'uq_customers_short_name_lower' });
  });

  it('keeps the short name of a soft-deleted customer reserved: the index covers every row', async () => {
    await insert('Invented deleted one', 'GoneKey', true);
    await expect(insert('Invented deleted two', 'gonekey')).rejects.toMatchObject({ code: '23505', constraint: 'uq_customers_short_name_lower' });
  });

  it('counts characters, not bytes, against the ceiling: 20 letters outside the basic plane fit', async () => {
    await insert('Invented emoji', '\u{1F600}'.repeat(20));
  });
});

describe('the rollback note after the migration', () => {
  it('drops the index, the CHECKs and the column, and the migration then runs again over the same rows with the same result', async () => {
    const withShortNames = await rows<{ name: string; short_name: string }>('SELECT name, short_name FROM customers WHERE name IN ($1, $2) ORDER BY name', ['Acme Works', 'acme-works']);
    for (const statement of ROLLBACK_STATEMENTS) await owner.query(statement);
    expect(await rows("SELECT 1 FROM pg_indexes WHERE indexname = 'uq_customers_short_name_lower'")).toHaveLength(0);
    expect(await rows("SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'short_name'")).toHaveLength(0);
    // Rows typed after the migration (with ceiling-length or case-only differences) would clash with the generated names in a re-run: remove them, as a rollback followed by a re-run would.
    await owner.query("DELETE FROM customers WHERE name LIKE 'Invented %'");
    await owner.query(migration);
    const again = await rows<{ name: string; short_name: string }>('SELECT name, short_name FROM customers WHERE name IN ($1, $2) ORDER BY name', ['Acme Works', 'acme-works']);
    expect(again).toEqual(withShortNames);
  });
});
