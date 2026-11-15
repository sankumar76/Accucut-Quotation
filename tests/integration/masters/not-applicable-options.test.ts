import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { FieldValidationError, NAME_RESERVED_CODE, NAME_TAKEN_CODE, NotFoundError } from '@/lib/errors';
import { NOT_APPLICABLE_MATERIAL_ID, NOT_APPLICABLE_NAME, NOT_APPLICABLE_TREATMENT_ID } from '@/lib/masters/system-entries';

import { contextOf, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { loadCanaryMaterials } from '../../support/material-canary-loader';
import { MATERIAL_CANARIES } from '../../support/material-master-canary';
import { withoutUuids } from '../../support/random-members';
import { clearMaterials, clearTreatments } from '../../support/system-rows';
import { OTHER_TREATMENT_ID } from '../../support/treatment-canary';
import { refusal } from '../../support/user-service-fixture';

/**
 * STORY-02.06 (AQP-305) AC-4, AC-5 and AC-6 over the real repositories and PostgreSQL: the hidden "Not applicable" rows are in the options and in no list, a
 * change or a delete of one is "not found" in the words of an unknown ID and writes no audit entry, the options carry no number, the calculation's lookup
 * finds the material, and the name is reserved (422, no echo) with the unique index behind it. Names and numbers are invented (ADR-014).
 */

let db: AuditDatabase;
let adminId: string;

const by = () => contextOf(adminId);
const MISSING_ID = '00000000-0000-4000-8000-0ccc00000009';
const ADDED = { materialInDrawing: 'Invented-sheet-grade-A', materialConsidered: 'Invented steel', pricePerKg: '58.37', specificGravity: '7.37', scrapRate: '22.37' } as const;

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await clearMaterials(db.owner);
  await clearTreatments(db.owner);
});

describe('AC-5: the options offer "Not applicable" last, with no number, and no list holds it', () => {
  it('materials: the listed materials in the order added, then the hidden entry with a null Material Considered', async () => {
    await loadCanaryMaterials(db.owner);
    const options = await db.mastersService.listMaterialOptions();
    expect(options.slice(0, -1).map((option) => option.name)).toEqual(MATERIAL_CANARIES.map((material) => material.materialInDrawing));
    expect(options.at(-1)).toEqual({ id: NOT_APPLICABLE_MATERIAL_ID, name: NOT_APPLICABLE_NAME, materialConsidered: null });
    for (const option of options) expect(Object.keys(option).sort()).toEqual(['id', 'materialConsidered', 'name']);
    // No number of any canary row, in any form, in what an Engineer is sent (the id is a UUID that may hold digits by chance, DEF-028).
    const text = withoutUuids(JSON.stringify(options));
    for (const material of MATERIAL_CANARIES) for (const value of [material.pricePerKg, material.specificGravity, material.scrapRate]) expect(text).not.toContain(value);
  });

  it('materials: with none typed, the one choice is the hidden entry; no Admin list and no repository list holds it', async () => {
    expect(await db.mastersService.listMaterialOptions()).toEqual([{ id: NOT_APPLICABLE_MATERIAL_ID, name: NOT_APPLICABLE_NAME, materialConsidered: null }]);
    expect(await db.masterRepository.listMaterials()).toEqual([]);
    expect(await db.masterRepository.listMaterialOptions()).toEqual([]);
    expect(await db.mastersService.listMaterials()).toEqual([]);
  });

  it('treatments: "Other" first, the others in the order added, then the hidden entry, with an ID and a name and nothing else', async () => {
    await db.owner.query("INSERT INTO treatments (name) VALUES ('Invented powder coat')");
    const options = await db.mastersService.listTreatmentOptions();
    expect(options.map((option) => option.name)).toEqual(['Other', 'Invented powder coat', NOT_APPLICABLE_NAME]);
    expect(options.at(0)?.id).toBe(OTHER_TREATMENT_ID);
    expect(options.at(-1)).toEqual({ id: NOT_APPLICABLE_TREATMENT_ID, name: NOT_APPLICABLE_NAME });
    for (const option of options) expect(Object.keys(option).sort()).toEqual(['id', 'name']);
    expect((await db.mastersService.listTreatments()).map((treatment) => treatment.id)).not.toContain(NOT_APPLICABLE_TREATMENT_ID);
  });

  it('another hidden row cannot pass for the entry: only the one with the fixed ID is offered', async () => {
    await db.owner.query("INSERT INTO materials (material_in_drawing, material_considered, is_system, is_hidden) VALUES ('Invented lookalike', NULL, true, true)");
    await db.owner.query("INSERT INTO treatments (name, is_system, is_hidden) VALUES ('Invented lookalike', true, true)");
    expect((await db.mastersService.listMaterialOptions()).map((option) => option.name)).toEqual([NOT_APPLICABLE_NAME]);
    expect((await db.mastersService.listTreatmentOptions()).map((option) => option.name)).toEqual(['Other', NOT_APPLICABLE_NAME]);
  });

  it('the calculation finds the hidden material (A-17): all three numbers 0, no Material Considered; the finders for a change never do', async () => {
    // The batched reader of STORY-05.09 (`findMaterialsForCalculation`) finds the fixed hidden row, in a batch with an unknown ID (which has no entry), and inside a transaction.
    const unknownId = '00000000-0000-4000-8000-0000000000fd';
    const expected = {
      id: NOT_APPLICABLE_MATERIAL_ID,
      materialInDrawing: NOT_APPLICABLE_NAME,
      materialConsidered: null,
      pricePerKg: '0.00',
      specificGravity: '0.00',
      scrapRate: '0.00',
      deleted: false,
    };
    expect(await db.masterRepository.findMaterialsForCalculation([NOT_APPLICABLE_MATERIAL_ID])).toEqual([expected]);
    expect(await db.masterRepository.findMaterialsForCalculation([unknownId, NOT_APPLICABLE_MATERIAL_ID])).toEqual([expected]);
    expect(await db.transactions.run((tx) => db.masterRepository.findMaterialsForCalculation([NOT_APPLICABLE_MATERIAL_ID], tx))).toEqual([expected]);
    expect(await db.transactions.run((tx) => db.masterRepository.findMaterialForUpdate(NOT_APPLICABLE_MATERIAL_ID, tx))).toBeNull();
    expect(await db.transactions.run((tx) => db.masterRepository.findTreatmentForUpdate(NOT_APPLICABLE_TREATMENT_ID, tx))).toBeNull();
  });
});

describe('AC-4: a change or a delete of a hidden ID is 404, as an unknown ID is, and writes nothing', () => {
  it('materials: the repository finds nothing to change and nothing to delete', async () => {
    expect(await db.transactions.run((tx) => db.masterRepository.updateMaterial(NOT_APPLICABLE_MATERIAL_ID, { scrapRate: '9.37' }, tx))).toBeNull();
    expect(await db.transactions.run((tx) => db.masterRepository.softDeleteMaterial(NOT_APPLICABLE_MATERIAL_ID, tx))).toBe(false);
  });

  it('materials: the service answers PATCH and DELETE with the words of an unknown ID, and writes no audit entry', async () => {
    const entries = await entryCount(db);
    const patched = await refusal(db.mastersService.updateMaterial(by(), NOT_APPLICABLE_MATERIAL_ID, { scrapRate: '9.37' }));
    const patchedUnknown = await refusal(db.mastersService.updateMaterial(by(), MISSING_ID, { scrapRate: '9.37' }));
    const deleted = await refusal(db.mastersService.deleteMaterial(by(), NOT_APPLICABLE_MATERIAL_ID));
    const deletedUnknown = await refusal(db.mastersService.deleteMaterial(by(), MISSING_ID));
    for (const error of [patched, patchedUnknown, deleted, deletedUnknown]) expect(error).toBeInstanceOf(NotFoundError);
    expect((patched as Error).message).toBe((patchedUnknown as Error).message);
    expect((deleted as Error).message).toBe((deletedUnknown as Error).message);
    expect(await entryCount(db)).toBe(entries);
    const { rows } = await db.owner.query('SELECT scrap_rate::text, deleted_at FROM materials WHERE id = $1::uuid', [NOT_APPLICABLE_MATERIAL_ID]);
    expect(rows).toEqual([{ scrap_rate: '0.0000', deleted_at: null }]);
  });

  it('a reserved name sent for the hidden ID is still 404: the resource is judged before the name (the order of refusals)', async () => {
    const answer = await refusal(db.mastersService.updateMaterial(by(), NOT_APPLICABLE_MATERIAL_ID, { materialInDrawing: 'Not applicable' }));
    expect(answer).toBeInstanceOf(NotFoundError);
  });

  it('treatments: the repository finds nothing to rename and nothing to delete, and the service answers in the words of an unknown ID', async () => {
    expect(await db.transactions.run((tx) => db.masterRepository.renameTreatment(NOT_APPLICABLE_TREATMENT_ID, 'Invented renamed', tx))).toBeNull();
    expect(await db.transactions.run((tx) => db.masterRepository.deleteTreatment(NOT_APPLICABLE_TREATMENT_ID, tx))).toBe(false);
    const entries = await entryCount(db);
    const patched = await refusal(db.mastersService.updateTreatment(by(), NOT_APPLICABLE_TREATMENT_ID, { name: 'Invented renamed' }));
    const patchedUnknown = await refusal(db.mastersService.updateTreatment(by(), MISSING_ID, { name: 'Invented renamed' }));
    const deleted = await refusal(db.mastersService.deleteTreatment(by(), NOT_APPLICABLE_TREATMENT_ID));
    const deletedUnknown = await refusal(db.mastersService.deleteTreatment(by(), MISSING_ID));
    for (const error of [patched, patchedUnknown, deleted, deletedUnknown]) expect(error).toBeInstanceOf(NotFoundError);
    expect(String(patched)).toBe(String(patchedUnknown));
    expect(String(deleted)).toBe(String(deletedUnknown));
    expect(await entryCount(db)).toBe(entries);
  });
});

describe('AC-6: the name "Not applicable" is reserved, in any letter case or spacing, and the message does not echo it', () => {
  const SPELLINGS = ['Not applicable', 'NOT APPLICABLE', 'not applicable', ' not  applicable ', 'Not\tapplicable'];

  it.each(SPELLINGS)('a material named %j is refused with 422 NAME_RESERVED, nothing is stored or recorded', async (name) => {
    const entries = await entryCount(db);
    const error = await refusal(db.mastersService.createMaterial(by(), { ...ADDED, materialInDrawing: name }));
    expect(error).toBeInstanceOf(FieldValidationError);
    expect(error).toMatchObject({ code: NAME_RESERVED_CODE, httpStatus: 422, fields: [{ field: 'materialInDrawing', message: 'That name cannot be used.' }] });
    expect(await entryCount(db)).toBe(entries);
    expect((await db.owner.query('SELECT 1 FROM materials')).rowCount).toBe(1);
  });

  it.each(SPELLINGS)('a material renamed to %j is refused the same way and keeps its name', async (name) => {
    const created = await db.mastersService.createMaterial(by(), ADDED);
    const entries = await entryCount(db);
    const error = await refusal(db.mastersService.updateMaterial(by(), created.id, { materialInDrawing: name }));
    expect(error).toMatchObject({ code: NAME_RESERVED_CODE, httpStatus: 422, fields: [{ field: 'materialInDrawing', message: 'That name cannot be used.' }] });
    expect(await entryCount(db)).toBe(entries);
    expect((await db.owner.query('SELECT material_in_drawing FROM materials WHERE id = $1::uuid', [created.id])).rows).toEqual([{ material_in_drawing: ADDED.materialInDrawing }]);
  });

  it.each(SPELLINGS)('a treatment named or renamed to %j is refused with 422 NAME_RESERVED and the same sentence', async (name) => {
    const made = await db.owner.query<{ id: string }>("INSERT INTO treatments (name) VALUES ('Invented powder coat') RETURNING id::text");
    const id = made.rows[0]?.id ?? '';
    const added = await refusal(db.mastersService.createTreatment(by(), { name }));
    const renamed = await refusal(db.mastersService.updateTreatment(by(), id, { name }));
    for (const error of [added, renamed]) {
      expect(error).toMatchObject({ code: NAME_RESERVED_CODE, httpStatus: 422, fields: [{ field: 'name', message: 'That name cannot be used.' }] });
    }
  });

  it('the unique index is the backstop: a row with the name is refused to the runtime role and to the owner, whatever the service checked (INSERT is not guarded, the name is)', async () => {
    for (const client of [db.runtime, db.owner]) {
      await expect(client.query("INSERT INTO materials (material_in_drawing, material_considered, specific_gravity) VALUES ('NOT APPLICABLE', 'Invented', 7.37)")).rejects.toMatchObject({
        constraint: 'uq_materials_material_in_drawing_lower',
      });
      await expect(client.query("INSERT INTO treatments (name) VALUES ('NOT APPLICABLE')")).rejects.toMatchObject({ constraint: 'uq_treatments_name_lower' });
    }
  });

  it('a name taken by an ordinary entry is still NAME_TAKEN, not NAME_RESERVED', async () => {
    await db.mastersService.createMaterial(by(), ADDED);
    const error = await refusal(db.mastersService.createMaterial(by(), { ...ADDED, materialInDrawing: 'INVENTED-SHEET-GRADE-A' }));
    expect(error).toMatchObject({ code: NAME_TAKEN_CODE });
  });
});
