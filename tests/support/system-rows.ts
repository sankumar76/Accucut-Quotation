import type { Client } from 'pg';

import { NOT_APPLICABLE_MATERIAL_ID, NOT_APPLICABLE_TREATMENT_ID } from '../../src/lib/masters/system-entries';

import { OTHER_TREATMENT_ID } from './treatment-canary';

/**
 * Putting `materials` and `treatments` back to what the migrations leave (STORY-02.06). The migration inserts the hidden "Not applicable" row of each, and
 * "Other" for the treatments, and a trigger (`refuse_system_row_change`) refuses to change or delete them, for the owner too. A test that built its own state
 * (rows, some of them hidden or system on purpose, to see the default filter work) must clear it **without** touching the rows the migrations made, and
 * a plain `DELETE FROM materials` now stops at the first system row, so the delete of the others goes through here.
 *
 * Each test file works in its own throwaway database (`createMigratedScratchDatabase`), so the trigger is switched off only for the one statement, inside a
 * transaction, and switched on again before it ends; a failure rolls both back. The owner may do this: it owns the tables. Nothing in `src` does.
 */

export const MATERIALS_GUARD_TRIGGER = 'trg_materials_refuse_system_row_change';
export const TREATMENTS_GUARD_TRIGGER = 'trg_treatments_refuse_system_row_change';

async function deleteOutsideTheGuard(owner: Client, table: 'materials' | 'treatments', trigger: string, keep: ReadonlyArray<string>): Promise<void> {
  await owner.query('BEGIN');
  try {
    // The table and trigger names are constants of this file, never input: DDL cannot take a bind parameter.
    await owner.query(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
    await owner.query(`DELETE FROM ${table} WHERE NOT (id = ANY($1::uuid[]))`, [keep]);
    await owner.query(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
    await owner.query('COMMIT');
  } catch (error) {
    await owner.query('ROLLBACK');
    throw error;
  }
}

/** Deletes every material except the hidden "Not applicable" row. */
export function clearMaterials(owner: Client): Promise<void> {
  return deleteOutsideTheGuard(owner, 'materials', MATERIALS_GUARD_TRIGGER, [NOT_APPLICABLE_MATERIAL_ID]);
}

/** Deletes every treatment except "Other" and the hidden "Not applicable" row. */
export function clearTreatments(owner: Client): Promise<void> {
  return deleteOutsideTheGuard(owner, 'treatments', TREATMENTS_GUARD_TRIGGER, [OTHER_TREATMENT_ID, NOT_APPLICABLE_TREATMENT_ID]);
}
