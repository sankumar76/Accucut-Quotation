import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NOT_APPLICABLE_MATERIAL_ID, NOT_APPLICABLE_NAME, NOT_APPLICABLE_TREATMENT_ID } from '@/lib/masters/system-entries';

import { openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { OTHER_TREATMENT_ID } from '../../support/treatment-canary';

/**
 * STORY-02.06 (AQP-305): the migration is safe on an existing database that holds data, and its rollback note works. The throwaway database has every migration
 * applied, so the test first runs the **rollback note written in the migration's own header** (the statements are read from the file, not copied), which gives
 * back the schema as it was before: no trigger, the old CHECK. It then makes the data an existing install could hold (an Admin's own entries, one of them
 * named "Not applicable" in a letter case the unique index treats as the same name, and one row already at a fixed ID) and runs the migration file again,
 * as `prisma migrate deploy` would. Names are invented.
 */

const MIGRATION_SQL = fileURLToPath(new URL('../../../prisma/migrations/20261114140000_not_applicable_entries/migration.sql', import.meta.url));
const migration = readFileSync(MIGRATION_SQL, 'utf8');
/** The statements of the rollback note: header lines of the form `--   DROP ...;` and `--   ALTER ...;`. The `DELETE` lines of the note are indented further and are not run. */
const ROLLBACK_STATEMENTS = migration
  .split(/\r?\n/)
  .filter((line) => /^--   (?:DROP|ALTER) .*;$/.test(line))
  .map((line) => line.slice('--   '.length));

let db: AuditDatabase;

beforeAll(async () => {
  db = await openAuditDatabase();
});

afterAll(async () => {
  await db.close();
});

const idOf = async (sql: string, values: ReadonlyArray<string>): Promise<string> => {
  const { rows } = await db.owner.query<{ id: string }>(sql, [...values]);
  return rows[0]?.id ?? '';
};

describe('the rollback note and the migration over existing data (run in order, in one database)', () => {
  it('the header of the migration holds five rollback statements: two triggers, the function, and the CHECK back as it was', () => {
    expect(ROLLBACK_STATEMENTS).toHaveLength(5);
    expect(ROLLBACK_STATEMENTS[0]).toMatch(/^DROP TRIGGER .* ON "materials";$/);
    expect(ROLLBACK_STATEMENTS[1]).toMatch(/^DROP TRIGGER .* ON "treatments";$/);
    expect(ROLLBACK_STATEMENTS[2]).toBe('DROP FUNCTION "refuse_system_row_change"();');
  });

  it('the rollback note undoes the guard and the CHECK, and leaves the rows', async () => {
    for (const statement of ROLLBACK_STATEMENTS) await db.owner.query(statement);
    const triggers = await db.owner.query("SELECT 1 FROM pg_trigger WHERE tgname LIKE 'trg_%_refuse_system_row_change'");
    expect(triggers.rowCount).toBe(0);
    expect((await db.owner.query("SELECT 1 FROM pg_proc WHERE proname = 'refuse_system_row_change'")).rowCount).toBe(0);
    const { rows } = await db.owner.query<{ definition: string }>(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = 'ck_treatments_name_not_blank'`);
    expect(rows[0]?.definition).toContain('btrim');
    // With the guard gone the old name check lets a tab through again, which is what the rollback means.
    await db.owner.query("INSERT INTO treatments (name) VALUES (E'\\t')");
    await db.owner.query("DELETE FROM treatments WHERE name = E'\\t'");
    expect((await db.owner.query('SELECT 1 FROM materials WHERE id = $1::uuid', [NOT_APPLICABLE_MATERIAL_ID])).rowCount).toBe(1);
  });

  it('on a database with data: renames the entries that already carry the name, keeps every other one, and inserts the rows once', async () => {
    // What an install that ran an earlier release could hold: no hidden rows, and entries the Admin typed, two of them named like the hidden one.
    await db.owner.query('DELETE FROM materials WHERE id = $1::uuid', [NOT_APPLICABLE_MATERIAL_ID]);
    await db.owner.query('DELETE FROM treatments WHERE id = $1::uuid', [NOT_APPLICABLE_TREATMENT_ID]);
    const clash = await idOf(
      `INSERT INTO materials (material_in_drawing, material_considered, specific_gravity) VALUES ('NOT Applicable', 'Invented steel', 7.37) RETURNING id::text AS id`,
      [],
    );
    const spaced = await idOf(
      `INSERT INTO materials (material_in_drawing, material_considered, specific_gravity) VALUES ('Not  applicable', 'Invented alloy', 7.73) RETURNING id::text AS id`,
      [],
    );
    const kept = await idOf(
      `INSERT INTO materials (material_in_drawing, material_considered, specific_gravity) VALUES ('Invented-keep-material', 'Invented bronze', 8.37) RETURNING id::text AS id`,
      [],
    );
    const treatmentClash = await idOf(`INSERT INTO treatments (name) VALUES ('nOT applicable') RETURNING id::text AS id`, []);
    const treatmentKept = await idOf(`INSERT INTO treatments (name) VALUES ('Invented keep treatment') RETURNING id::text AS id`, []);

    await db.owner.query(migration);

    const materials = await db.owner.query<{ id: string; material_in_drawing: string; is_hidden: boolean }>('SELECT id::text, material_in_drawing, is_hidden FROM materials ORDER BY id');
    const byId = new Map(materials.rows.map((row) => [row.id, row]));
    expect(byId.get(clash)?.material_in_drawing).toBe(`NOT Applicable (renamed ${clash.slice(0, 8)})`);
    expect(byId.get(spaced)?.material_in_drawing).toBe(`Not  applicable (renamed ${spaced.slice(0, 8)})`);
    expect(byId.get(kept)?.material_in_drawing).toBe('Invented-keep-material');
    expect(byId.get(NOT_APPLICABLE_MATERIAL_ID)).toEqual({ id: NOT_APPLICABLE_MATERIAL_ID, material_in_drawing: NOT_APPLICABLE_NAME, is_hidden: true });
    expect(materials.rows.filter((row) => row.is_hidden)).toHaveLength(1);

    const treatments = await db.owner.query<{ id: string; name: string; is_hidden: boolean }>('SELECT id::text, name, is_hidden FROM treatments ORDER BY id');
    const treatmentById = new Map(treatments.rows.map((row) => [row.id, row]));
    expect(treatmentById.get(treatmentClash)?.name).toBe(`nOT applicable (renamed ${treatmentClash.slice(0, 8)})`);
    expect(treatmentById.get(treatmentKept)?.name).toBe('Invented keep treatment');
    expect(treatmentById.get(OTHER_TREATMENT_ID)?.name).toBe('Other');
    expect(treatmentById.get(NOT_APPLICABLE_TREATMENT_ID)).toEqual({ id: NOT_APPLICABLE_TREATMENT_ID, name: NOT_APPLICABLE_NAME, is_hidden: true });
    expect(treatments.rows.filter((row) => row.name === NOT_APPLICABLE_NAME)).toHaveLength(1);
  });

  it('puts the guard and the `\\S` check back, and the guard holds again', async () => {
    await expect(db.owner.query(`UPDATE treatments SET name = 'Invented renamed' WHERE id = '${NOT_APPLICABLE_TREATMENT_ID}'`)).rejects.toThrow(/cannot be changed or deleted/);
    await expect(db.owner.query(`DELETE FROM materials WHERE id = '${NOT_APPLICABLE_MATERIAL_ID}'`)).rejects.toThrow(/cannot be changed or deleted/);
    await expect(db.runtime.query("INSERT INTO treatments (name) VALUES (E'\\t')")).rejects.toMatchObject({ constraint: 'ck_treatments_name_not_blank' });
    // The renamed entries are ordinary again, and the Admin may use them as before.
    await db.runtime.query("UPDATE treatments SET name = 'Invented renamed again' WHERE name LIKE 'nOT applicable (renamed %'");
    expect((await db.owner.query("SELECT 1 FROM treatments WHERE name = 'Invented renamed again'")).rowCount).toBe(1);
  });

  it('run again over rows that are already there (a rollback and a second deploy): the rows are not inserted twice and not renamed, and nothing fails', async () => {
    for (const statement of ROLLBACK_STATEMENTS) await db.owner.query(statement);
    await db.owner.query(migration);
    const materials = await db.owner.query('SELECT id::text, material_in_drawing FROM materials WHERE is_hidden');
    const treatments = await db.owner.query('SELECT id::text, name FROM treatments WHERE is_hidden');
    expect(materials.rows).toEqual([{ id: NOT_APPLICABLE_MATERIAL_ID, material_in_drawing: NOT_APPLICABLE_NAME }]);
    expect(treatments.rows).toEqual([{ id: NOT_APPLICABLE_TREATMENT_ID, name: NOT_APPLICABLE_NAME }]);
    await expect(db.owner.query(`DELETE FROM treatments WHERE id = '${NOT_APPLICABLE_TREATMENT_ID}'`)).rejects.toThrow(/cannot be changed or deleted/);
  });
});
