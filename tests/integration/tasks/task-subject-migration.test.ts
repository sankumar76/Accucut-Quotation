import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMigratedScratchDatabase, type ScratchDatabase } from '../../support/scratch-database';

/**
 * CR-01 item 6 (AQP-390, architecture section 4.11 a): the migration `20261122110000_task_subject_title_required` against real PostgreSQL, over a database that already holds tasks and estimates.
 * The scratch database has every migration applied, so the test first runs the **rollback note written in the migration's own header** (read from the file, not copied), which gives back the
 * schema as it was: `title` optional and no `subject`. It then plants the tasks an existing install could hold (no title, an empty title, a title of spaces, a normal one, one of 120 characters,
 * one of emoji) with their estimates (one with a customer, one without), and runs the migration file again, as `prisma migrate deploy` does. Every name is invented.
 */

const MIGRATION_SQL = fileURLToPath(new URL('../../../prisma/migrations/20261122110000_task_subject_title_required/migration.sql', import.meta.url));
const migration = readFileSync(MIGRATION_SQL, 'utf8');
const ROLLBACK_STATEMENTS = migration
  .split(/\r?\n/)
  .filter((line) => /^--   (?:DROP|ALTER) .*;$/.test(line))
  .map((line) => line.slice('--   '.length));

const LONG_TITLE = `${'L'.repeat(79)}XYZ${'M'.repeat(38)}`;
const EMOJI_TITLE = '\u{1F600}'.repeat(100);

const planted: ReadonlyArray<{ readonly code: string; readonly title: string | null }> = [
  { code: 'Q-2026-0001', title: null },
  { code: 'Q-2026-0002', title: '' },
  { code: 'Q-2026-0003', title: '   ' },
  { code: 'Q-2026-0004', title: 'Hopper cover' },
  { code: 'Q-2026-0005', title: LONG_TITLE },
  { code: 'Q-2026-0006', title: EMOJI_TITLE },
];

let scratch: ScratchDatabase;
let owner: Client;
let customerId = '';

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
  it('runs as one transaction: it holds no BEGIN;, COMMIT; or ROLLBACK; statement of its own, so Prisma wraps it and a failure undoes the whole file', () => {
    expect(migration).not.toMatch(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im);
  });

  it('has a rollback note of three statements, in reverse order: the CHECKs, the title back to optional, the column', () => {
    expect(ROLLBACK_STATEMENTS).toHaveLength(3);
    expect(ROLLBACK_STATEMENTS[0]).toMatch(/^ALTER TABLE "tasks" DROP CONSTRAINT "ck_tasks_subject_length", DROP CONSTRAINT "ck_tasks_subject_not_blank", DROP CONSTRAINT "ck_tasks_title_not_blank";$/);
    expect(ROLLBACK_STATEMENTS[1]).toBe('ALTER TABLE "tasks" ALTER COLUMN "title" DROP NOT NULL;');
    expect(ROLLBACK_STATEMENTS[2]).toBe('ALTER TABLE "tasks" DROP COLUMN "subject";');
  });
});

describe('the rollback note, the plant and the migration over existing tasks (run in order, in one database)', () => {
  it('the rollback note gives back the schema as it was: a task can be inserted with no title and no subject', async () => {
    for (const statement of ROLLBACK_STATEMENTS) await owner.query(statement);
    expect(await rows("SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'subject'")).toHaveLength(0);
    const { is_nullable } = (await rows<{ is_nullable: string }>("SELECT is_nullable FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'title'"))[0] ?? { is_nullable: '' };
    expect(is_nullable).toBe('YES');
  });

  it('plants the tasks of an existing install, one estimate each, one of them with a customer', async () => {
    const user = await rows<{ id: string }>("INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Invented Lead', 'lead.migration@example.com', 'invented-hash', 'LEAD', true) RETURNING id::text");
    const lead = user[0]?.id ?? '';
    const customer = await rows<{ id: string }>("INSERT INTO customers (name, short_name) VALUES ('Invented customer', 'INVCUST') RETURNING id::text").catch(async () => {
      // The schema is rolled back for tasks only: the customers' short name is still there.
      throw new Error('The customers table must still have its short name.');
    });
    customerId = customer[0]?.id ?? '';
    for (const [index, task] of planted.entries()) {
      const inserted = await rows<{ id: string }>(
        `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title) VALUES ($1, $2::uuid, $2::uuid, '\\\\server\\share\\RFQ', now() + interval '3 days', $3) RETURNING id::text`,
        [task.code, lead, task.title],
      );
      await owner.query('INSERT INTO estimates (task_id, customer_id) VALUES ($1::uuid, $2::uuid)', [inserted[0]?.id, index === 3 ? customerId : null]);
    }
    expect(await rows('SELECT 1 FROM tasks')).toHaveLength(planted.length);
  });

  it('fills an empty title with the task code, cuts the subject from the title to 80 characters, and never shortens a title', async () => {
    const estimatesBefore = await rows('SELECT * FROM estimates ORDER BY id');
    const titlesBefore = await rows<{ code: string; title: string | null }>('SELECT code, title FROM tasks ORDER BY code');
    await owner.query(migration);
    const after = await rows<{ code: string; title: string; subject: string }>('SELECT code, title, subject FROM tasks ORDER BY code');
    expect(after).toEqual([
      { code: 'Q-2026-0001', title: 'Q-2026-0001', subject: 'Q-2026-0001' },
      { code: 'Q-2026-0002', title: 'Q-2026-0002', subject: 'Q-2026-0002' },
      { code: 'Q-2026-0003', title: 'Q-2026-0003', subject: 'Q-2026-0003' },
      { code: 'Q-2026-0004', title: 'Hopper cover', subject: 'Hopper cover' },
      { code: 'Q-2026-0005', title: LONG_TITLE, subject: `${'L'.repeat(79)}X` },
      { code: 'Q-2026-0006', title: EMOJI_TITLE, subject: '\u{1F600}'.repeat(80) },
    ]);
    // No non-empty value is overwritten.
    for (const before of titlesBefore.filter((row) => row.title !== null && row.title.trim() !== '')) {
      expect(after.find((row) => row.code === before.code)?.title).toBe(before.title);
    }
    // No estimate row changes: the customer stays where it was, nothing is invented for an estimate that has none.
    expect(await rows('SELECT * FROM estimates ORDER BY id')).toEqual(estimatesBefore);
  });

  it('leaves an estimate with no customer saveable: its customer stays NULL and a later update is accepted', async () => {
    const rowsWithout = await rows<{ id: string }>('SELECT id::text FROM estimates WHERE customer_id IS NULL');
    expect(rowsWithout).toHaveLength(planted.length - 1);
    await owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE customer_id IS NULL');
  });

  it('every subject the migration made is within the code limit of 80 and the title limit of 120, and none is blank', async () => {
    const all = await rows<{ title: string; subject: string }>('SELECT title, subject FROM tasks');
    expect(all.every((row) => Array.from(row.subject).length <= 80 && Array.from(row.title).length <= 120 && row.subject.trim() !== '' && row.title.trim() !== '')).toBe(true);
  });
});

describe('the constraints the migration leaves', () => {
  let lead = '';
  let number = 100;

  const insert = (title: string | null, subject: string | null): Promise<unknown> => {
    number += 1;
    return owner.query(
      `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject) VALUES ($1, $2::uuid, $2::uuid, '\\\\server\\share\\RFQ', now() + interval '3 days', $3, $4)`,
      [`Q-2026-${String(number).padStart(4, '0')}`, lead, title, subject],
    );
  };

  beforeAll(async () => {
    lead = (await rows<{ id: string }>("SELECT id::text FROM users WHERE email = 'lead.migration@example.com'"))[0]?.id ?? '';
  });

  it('refuses a task with no title, a blank title, no subject and a blank subject', async () => {
    await expect(insert(null, 'Subject')).rejects.toMatchObject({ code: '23502' });
    await expect(insert('   ', 'Subject')).rejects.toMatchObject({ code: '23514', constraint: 'ck_tasks_title_not_blank' });
    await expect(insert('Title', null)).rejects.toMatchObject({ code: '23502' });
    await expect(insert('Title', '  ')).rejects.toMatchObject({ code: '23514', constraint: 'ck_tasks_subject_not_blank' });
  });

  it('keeps the title limit of 120 as it was', async () => {
    await insert('T'.repeat(120), 'Subject');
    await expect(insert('T'.repeat(121), 'Subject')).rejects.toMatchObject({ code: '23514', constraint: 'ck_tasks_title_length' });
  });

  it('allows a subject up to the database ceiling of 200 (the code limit is 80, so raising it is a code-only change) and refuses 201', async () => {
    await insert('Title', 'S'.repeat(200));
    await expect(insert('Title', 'S'.repeat(201))).rejects.toMatchObject({ code: '23514', constraint: 'ck_tasks_subject_length' });
  });
});

describe('the rollback note after the migration', () => {
  it('drops the CHECKs and the column and makes the title optional again, and the migration then runs again with the same result', async () => {
    const before = await rows<{ code: string; title: string; subject: string }>("SELECT code, title, subject FROM tasks WHERE code <= 'Q-2026-0006' ORDER BY code");
    for (const statement of ROLLBACK_STATEMENTS) await owner.query(statement);
    expect(await rows("SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'subject'")).toHaveLength(0);
    // Titles filled with the task code stay (harmless), as the note says.
    expect((await rows<{ title: string | null }>("SELECT title FROM tasks WHERE code = 'Q-2026-0001'"))[0]?.title).toBe('Q-2026-0001');
    // The tasks typed after the migration have a subject that is typed, not derived: a re-run only cuts the title for what it can derive.
    await owner.query("DELETE FROM estimates WHERE task_id IN (SELECT id FROM tasks WHERE code > 'Q-2026-0006')");
    await owner.query("DELETE FROM tasks WHERE code > 'Q-2026-0006'");
    await owner.query(migration);
    const after = await rows<{ code: string; title: string; subject: string }>("SELECT code, title, subject FROM tasks WHERE code <= 'Q-2026-0006' ORDER BY code");
    expect(after).toEqual(before);
  });
});
