import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Client } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { NOT_APPLICABLE_MATERIAL_ID, NOT_APPLICABLE_NAME, NOT_APPLICABLE_TREATMENT_ID } from '@/lib/masters/system-entries';

import { openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { clearMaterials, clearTreatments } from '../../support/system-rows';
import { OTHER_TREATMENT_ID } from '../../support/treatment-canary';

/**
 * STORY-02.06 (AQP-305) AC-1, AC-2 and AC-3 against real PostgreSQL in a throwaway database: the migration inserts the two hidden "Not applicable" rows with
 * fixed IDs (not the seed), and the trigger `refuse_system_row_change()` on `materials` and `treatments` refuses to change or delete a system row (the two
 * hidden rows and "Other") for the runtime role and for the owner, refuses to make an ordinary row a system row, lets an ordinary rename and delete through, and
 * does not guard an INSERT. `ck_treatments_name_not_blank` is the `\S` check. Names are invented.
 */

const MIGRATION_SQL = fileURLToPath(new URL('../../../prisma/migrations/20261114140000_not_applicable_entries/migration.sql', import.meta.url));
const SEED_DIRECTORY = fileURLToPath(new URL('../../../prisma/seed/', import.meta.url));

let db: AuditDatabase;

beforeAll(async () => {
  db = await openAuditDatabase();
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await clearMaterials(db.owner);
  await clearTreatments(db.owner);
});

interface Roles {
  readonly name: 'the runtime role' | 'the owner';
  client(): Client;
}

/** The two roles the guard must hold against. The owner may drop the trigger by DDL, as a migration does; it cannot change a system row by DML. */
const ROLES: ReadonlyArray<Roles> = [
  { name: 'the runtime role', client: () => db.runtime },
  { name: 'the owner', client: () => db.owner },
];

const GUARD_MESSAGE = /A system row of table "(?:materials|treatments)" cannot be changed or deleted\./;
const BECOME_SYSTEM_MESSAGE = /A row of table "(?:materials|treatments)" cannot be made a system row\./;

async function snapshotOfSystemRows(): Promise<string> {
  const materials = await db.owner.query('SELECT * FROM materials WHERE is_system OR is_hidden ORDER BY id');
  const treatments = await db.owner.query('SELECT * FROM treatments WHERE is_system OR is_hidden ORDER BY id');
  return JSON.stringify([materials.rows, treatments.rows]);
}

describe('AC-1: the migration inserts the hidden rows, with fixed IDs, and the seed does not', () => {
  it('materials holds one hidden "Not applicable" row: is_system and is_hidden true, every number 0, no Material Considered, not deleted', async () => {
    const { rows } = await db.owner.query(
      `SELECT id::text, material_in_drawing, material_considered, price_per_kg::text, specific_gravity::text, scrap_rate::text, is_system, is_hidden, deleted_at
       FROM materials WHERE is_hidden`,
    );
    expect(rows).toEqual([
      {
        id: NOT_APPLICABLE_MATERIAL_ID,
        material_in_drawing: NOT_APPLICABLE_NAME,
        material_considered: null,
        price_per_kg: '0.0000',
        specific_gravity: '0.0000',
        scrap_rate: '0.0000',
        is_system: true,
        is_hidden: true,
        deleted_at: null,
      },
    ]);
    expect((await db.owner.query('SELECT 1 FROM materials')).rowCount).toBe(1);
  });

  it('treatments holds one hidden "Not applicable" row, beside the visible "Other" (a system row that is not hidden)', async () => {
    const { rows } = await db.owner.query('SELECT id::text, name, is_system, is_hidden FROM treatments ORDER BY id');
    expect(rows).toEqual([
      { id: OTHER_TREATMENT_ID, name: 'Other', is_system: true, is_hidden: false },
      { id: NOT_APPLICABLE_TREATMENT_ID, name: NOT_APPLICABLE_NAME, is_system: true, is_hidden: true },
    ]);
  });

  it('the IDs of the code are the ones the migration inserts, and the migration, not the seed, inserts them', () => {
    const migration = readFileSync(MIGRATION_SQL, 'utf8');
    expect(migration).toContain(`'${NOT_APPLICABLE_MATERIAL_ID}'`);
    expect(migration).toContain(`'${NOT_APPLICABLE_TREATMENT_ID}'`);
    // The seed may say the words (a form hint does); it must not name either ID or the hidden flag, which is how it would insert a row.
    const writesTheRows = (text: string): boolean => [NOT_APPLICABLE_MATERIAL_ID, NOT_APPLICABLE_TREATMENT_ID, 'isHidden', 'is_hidden'].some((needle) => text.includes(needle));
    const inSeed = (directory: string): string[] =>
      readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);
        if (statSync(path).isDirectory()) return inSeed(path);
        return writesTheRows(readFileSync(path, 'utf8')) ? [path] : [];
      });
    expect(inSeed(SEED_DIRECTORY)).toEqual([]);
  });
});

describe('AC-2: the guard refuses a change to a system row, for the runtime role and for the owner', () => {
  describe.each(ROLES)('as $name', ({ client }) => {
    it.each([
      ['rename the hidden material', `UPDATE materials SET material_in_drawing = 'Invented renamed' WHERE id = '${NOT_APPLICABLE_MATERIAL_ID}'`],
      ['change a number of the hidden material', `UPDATE materials SET price_per_kg = 1 WHERE id = '${NOT_APPLICABLE_MATERIAL_ID}'`],
      ['soft-delete the hidden material', `UPDATE materials SET deleted_at = now() WHERE id = '${NOT_APPLICABLE_MATERIAL_ID}'`],
      ['show the hidden material', `UPDATE materials SET is_hidden = false WHERE id = '${NOT_APPLICABLE_MATERIAL_ID}'`],
      ['release the hidden material (is_system false)', `UPDATE materials SET is_system = false WHERE id = '${NOT_APPLICABLE_MATERIAL_ID}'`],
      ['"change" the hidden material to what it already is (a no-op UPDATE is a change too)', `UPDATE materials SET material_in_drawing = material_in_drawing WHERE id = '${NOT_APPLICABLE_MATERIAL_ID}'`],
      ['rename the hidden treatment', `UPDATE treatments SET name = 'Invented renamed' WHERE id = '${NOT_APPLICABLE_TREATMENT_ID}'`],
      ['show the hidden treatment', `UPDATE treatments SET is_hidden = false WHERE id = '${NOT_APPLICABLE_TREATMENT_ID}'`],
      ['delete the hidden treatment', `DELETE FROM treatments WHERE id = '${NOT_APPLICABLE_TREATMENT_ID}'`],
      ['rename "Other"', `UPDATE treatments SET name = 'Invented renamed' WHERE id = '${OTHER_TREATMENT_ID}'`],
      ['release "Other" (is_system false)', `UPDATE treatments SET is_system = false WHERE id = '${OTHER_TREATMENT_ID}'`],
      ['hide "Other"', `UPDATE treatments SET is_hidden = true WHERE id = '${OTHER_TREATMENT_ID}'`],
      ['delete "Other"', `DELETE FROM treatments WHERE id = '${OTHER_TREATMENT_ID}'`],
    ])('refuses to %s, and the rows are as they were', async (_what, statement) => {
      const before = await snapshotOfSystemRows();
      await expect(client().query(statement)).rejects.toThrow(GUARD_MESSAGE);
      expect(await snapshotOfSystemRows()).toBe(before);
    });

    it('refuses to delete the hidden material: the owner by the trigger, the runtime role earlier still, for it has no DELETE right on materials', async () => {
      const before = await snapshotOfSystemRows();
      const statement = `DELETE FROM materials WHERE id = '${NOT_APPLICABLE_MATERIAL_ID}'`;
      await expect(client().query(statement)).rejects.toThrow(client() === db.runtime ? /permission denied/ : GUARD_MESSAGE);
      expect(await snapshotOfSystemRows()).toBe(before);
    });

    it('refuses to make an ordinary row a system row, or a hidden one, and the row stays ordinary', async () => {
      const material = await db.owner.query<{ id: string }>(
        `INSERT INTO materials (material_in_drawing, material_considered, specific_gravity) VALUES ('Invented ordinary material', 'Invented steel', 7.37) RETURNING id::text`,
      );
      const treatment = await db.owner.query<{ id: string }>(`INSERT INTO treatments (name) VALUES ('Invented ordinary treatment') RETURNING id::text`);
      const materialId = material.rows[0]?.id ?? '';
      const treatmentId = treatment.rows[0]?.id ?? '';
      for (const statement of [
        `UPDATE materials SET is_system = true WHERE id = '${materialId}'`,
        `UPDATE materials SET is_hidden = true WHERE id = '${materialId}'`,
        `UPDATE treatments SET is_system = true WHERE id = '${treatmentId}'`,
        `UPDATE treatments SET is_hidden = true WHERE id = '${treatmentId}'`,
      ]) {
        await expect(client().query(statement), statement).rejects.toThrow(BECOME_SYSTEM_MESSAGE);
      }
      const flags = await db.owner.query('SELECT is_system, is_hidden FROM materials WHERE id = $1::uuid UNION ALL SELECT is_system, is_hidden FROM treatments WHERE id = $2::uuid', [materialId, treatmentId]);
      expect(flags.rows).toEqual([
        { is_system: false, is_hidden: false },
        { is_system: false, is_hidden: false },
      ]);
    });

    it('names the table and no row in its message', async () => {
      const error = await client()
        .query(`UPDATE treatments SET name = 'Invented renamed' WHERE id = '${NOT_APPLICABLE_TREATMENT_ID}'`)
        .then(
          () => null,
          (thrown: unknown) => thrown as { message: string; code: string },
        );
      expect(error?.message).toBe('A system row of table "treatments" cannot be changed or deleted.');
      // integrity_constraint_violation
      expect(error?.code).toBe('23000');
    });
  });

  it('lets an ordinary treatment be renamed and deleted by the runtime role, and by the owner', async () => {
    for (const { client } of ROLES) {
      const made = await db.owner.query<{ id: string }>(`INSERT INTO treatments (name) VALUES ('Invented ordinary') RETURNING id::text`);
      const id = made.rows[0]?.id ?? '';
      await client().query(`UPDATE treatments SET name = 'Invented ordinary, renamed' WHERE id = $1::uuid`, [id]);
      expect((await db.owner.query('SELECT name FROM treatments WHERE id = $1::uuid', [id])).rows).toEqual([{ name: 'Invented ordinary, renamed' }]);
      await client().query('DELETE FROM treatments WHERE id = $1::uuid', [id]);
      expect((await db.owner.query('SELECT 1 FROM treatments WHERE id = $1::uuid', [id])).rowCount).toBe(0);
    }
  });

  it('lets an ordinary material be renamed and soft-deleted by the runtime role (it has no DELETE right), and deleted by the owner', async () => {
    const made = await db.owner.query<{ id: string }>(
      `INSERT INTO materials (material_in_drawing, material_considered, specific_gravity) VALUES ('Invented ordinary', 'Invented steel', 7.37) RETURNING id::text`,
    );
    const id = made.rows[0]?.id ?? '';
    await db.runtime.query(`UPDATE materials SET material_in_drawing = 'Invented ordinary, renamed' WHERE id = $1::uuid`, [id]);
    await db.runtime.query('UPDATE materials SET deleted_at = now() WHERE id = $1::uuid', [id]);
    expect((await db.owner.query('SELECT material_in_drawing FROM materials WHERE id = $1::uuid AND deleted_at IS NOT NULL', [id])).rows).toEqual([
      { material_in_drawing: 'Invented ordinary, renamed' },
    ]);
    await db.owner.query('DELETE FROM materials WHERE id = $1::uuid', [id]);
    expect((await db.owner.query('SELECT 1 FROM materials WHERE id = $1::uuid', [id])).rowCount).toBe(0);
  });

  it('does not guard an INSERT: a row with is_system or is_hidden true can be inserted (only migrations do, and no service sets the flags)', async () => {
    for (const { client } of ROLES) {
      const suffix = client() === db.runtime ? 'runtime' : 'owner';
      await client().query(
        `INSERT INTO materials (material_in_drawing, material_considered, is_system, is_hidden) VALUES ('Invented system material ${suffix}', NULL, true, true)`,
      );
      await client().query(`INSERT INTO treatments (name, is_system, is_hidden) VALUES ('Invented system treatment ${suffix}', true, true)`);
    }
    expect((await db.owner.query("SELECT 1 FROM materials WHERE material_in_drawing LIKE 'Invented system material%'")).rowCount).toBe(2);
    expect((await db.owner.query("SELECT 1 FROM treatments WHERE name LIKE 'Invented system treatment%'")).rowCount).toBe(2);
  });

  it('is one function on two tables: BEFORE UPDATE and BEFORE DELETE, for each row, enabled', async () => {
    // `tgtype` bits: 1 for each row, 2 BEFORE, 4 INSERT, 8 DELETE, 16 UPDATE, 32 TRUNCATE.
    const { rows } = await db.owner.query<{ table_name: string; trigger_name: string; enabled: string; is_before: boolean; is_row: boolean; on_update: boolean; on_delete: boolean; on_insert: boolean }>(
      `SELECT t.tgrelid::regclass::text AS table_name, t.tgname AS trigger_name, t.tgenabled AS enabled,
              (t.tgtype & 2) <> 0 AS is_before, (t.tgtype & 1) <> 0 AS is_row,
              (t.tgtype & 16) <> 0 AS on_update, (t.tgtype & 8) <> 0 AS on_delete, (t.tgtype & 4) <> 0 AS on_insert
       FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
       WHERE p.proname = 'refuse_system_row_change' AND NOT t.tgisinternal ORDER BY t.tgrelid::regclass::text`,
    );
    expect(rows).toEqual([
      { table_name: 'materials', trigger_name: 'trg_materials_refuse_system_row_change', enabled: 'O', is_before: true, is_row: true, on_update: true, on_delete: true, on_insert: false },
      { table_name: 'treatments', trigger_name: 'trg_treatments_refuse_system_row_change', enabled: 'O', is_before: true, is_row: true, on_update: true, on_delete: true, on_insert: false },
    ]);
  });
});

describe('AC-3 (QLT-08): the treatment name CHECK is `\\S`: white space of any kind is not a name', () => {
  it('has the regular-expression check under its old name', async () => {
    const { rows } = await db.owner.query<{ definition: string }>(
      `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = 'ck_treatments_name_not_blank' AND conrelid = 'treatments'::regclass`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.definition).toContain(String.raw`'\S'`);
    expect(rows[0]?.definition).not.toContain('btrim');
  });

  it.each([
    ['spaces', '   '],
    ['a tab', '\t'],
    ['a line break', '\n'],
    ['spaces, a tab and a line break', ' \t\r\n '],
    ['the empty string', ''],
  ])('refuses a name of %s, for the runtime role and for the owner', async (_what, name) => {
    for (const { client } of ROLES) {
      await expect(client().query('INSERT INTO treatments (name) VALUES ($1)', [name])).rejects.toMatchObject({ constraint: 'ck_treatments_name_not_blank' });
    }
  });

  it('accepts a name with a letter in it, with white space around or inside', async () => {
    await db.runtime.query("INSERT INTO treatments (name) VALUES ('Invented name'), (E'Invented\\tname 2')");
    expect((await db.owner.query("SELECT 1 FROM treatments WHERE name LIKE 'Invented%'")).rowCount).toBe(2);
  });

  it('holds for every stored name: none fails the check', async () => {
    expect((await db.owner.query(String.raw`SELECT 1 FROM treatments WHERE name !~ '\S'`)).rowCount).toBe(0);
  });
});
