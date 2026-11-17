import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Decimal } from '@/lib/decimal';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createConfigVersionCache, getCurrentVersion } from '@/server/services/config-service';

import { approvedEstimateOf, approvedValuesOf, changeTheMasters, openApprovedWorld, totalOfANewCalculation, type ApprovedWorld } from '../support/approved-world';
import { idOf } from '../support/calculation-database';
import { defined } from '../support/defined';
import { seedConfig, seedFieldAt } from '../support/seed-config';

/**
 * STORY-06.09 AC-1, AC-2, AC-3, AC-4 and AC-6 (FR-065, NFR-026, NFR-007; ADR-007; architecture sections 4.8 and 5.1; test strategy section 9) against real PostgreSQL in a throwaway database, as the **runtime
 * role**: an estimate is calculated and approved, the Admin then changes the masters **through the real master services** (a process rate, a material price, an exchange rate; a rename and a delete of
 * the material and of the treatment; a reset and a rename of the customer) and a new configuration version is written, and what the approved estimate shows (the review, the cost details of every part)
 * and stores (the record, its rows, the approval) is compared with what it was, by deep equality, to the last digit. Each test first shows that the change **did** change what a calculation made now would
 * give, so a pass cannot come from an edit that changed nothing. Every name and number is invented.
 *
 * **Which customer name is shown (AC-3).** The review's header shows the customer's **current** name: the estimate holds the customer by ID (`estimates.customer_id`) and the workspace reads its name
 * from `customers` (`estimate-repository.findWorkspaceByCode`). The name the calculation used is kept in `calculations.master_snapshot` and is shown nowhere, but it is unchanged. This is decided and
 * documented here and in `review-page.tsx`; every figure and every word of the approved record stays as it was.
 *
 * **The words (AC-2).** The material's and the treatment's words are in the record: `calculation_rows.inputs` holds the resolved text of E and F and the treatment's words under G, and the snapshot holds
 * the material's words then. The cost details find the row's material in the snapshot **by those words**, so a read that used the current name of a renamed or deleted material would fail or differ here.
 *
 * **The export (AC-1, last words).** The export holds no figure yet (STORY-07.01 is the header row). STORY-07.03 fills `exportCellsOf` in `tests/support/approved-world.ts` and replaces the expectation of
 * the test named "EXPORT HOOK"; the screen data above are compared by the same function, so the file's cells join the same equality. Nothing in this file is skipped.
 */

let world: ApprovedWorld;

beforeAll(async () => {
  world = await openApprovedWorld();
}, 120_000);

afterAll(async () => {
  await world.db.close();
});

describe('AC-1 (NFR-026): changing the masters changes nothing an approved estimate shows or stores', () => {
  it('a process rate, a material price and an exchange rate changed by the Admin: the review, the cost details and the record are identical to the last digit', async () => {
    const approved = await approvedEstimateOf(world);
    const before = await approvedValuesOf(world, approved.estimateId);
    expect(before.costs).toMatchObject({ state: 'current', approval: { price: '1000.00' } });
    expect(before.nodeCosts).toHaveLength(2);
    for (const view of before.nodeCosts) expect(view.details).not.toBeNull();

    await changeTheMasters(world, approved.materialId);

    // The change is real: a calculation made now, with the same inputs, gives another total.
    const approvedTotal = defined(before.costs.totals).totalPrice;
    expect(await totalOfANewCalculation(world, approved.materialId)).not.toBe(approvedTotal);

    expect(await approvedValuesOf(world, approved.estimateId)).toEqual(before);
  });

  it('the price that was approved is the one stored, and BO shows it after the change too', async () => {
    const approved = await approvedEstimateOf(world, '4321.50');
    await changeTheMasters(world, approved.materialId);
    const costs = await world.review.getCosts(world.lead, approved.estimateId);
    expect(costs.approval).toMatchObject({ price: '4321.50' });
    const stored = await world.db.owner.query<{ approved_price: string }>('SELECT approved_price::text FROM approvals WHERE estimate_id = $1::uuid', [approved.estimateId]);
    expect(stored.rows).toEqual([{ approved_price: '4321.50' }]);
  });

  it('EXPORT HOOK (STORY-07.03): the exported file holds no figure yet, so there is nothing to compare; 07.03 replaces exportCellsOf and this expectation with the cells of the file', async () => {
    const approved = await approvedEstimateOf(world);
    expect((await approvedValuesOf(world, approved.estimateId)).exportCells).toBeNull();
  });
});

describe('AC-2: a material and a treatment renamed, then deleted, leave the approved screens with the original words', () => {
  it('the record holds the resolved words of E, F and the treatment, and they and every screen are the same after a rename and after a delete', async () => {
    const approved = await approvedEstimateOf(world);
    const wordsOf = async (): Promise<unknown> => {
      const { rows } = await world.db.owner.query(
        `SELECT r.inputs ->> $2 AS material, r.inputs ->> $3 AS considered, r.inputs ->> $4 AS treatment
         FROM calculation_rows r WHERE r.calculation_id = $1::uuid ORDER BY r.id`,
        [approved.calculationId, idOf('E'), idOf('F'), idOf('G')],
      );
      const snapshot = await world.db.owner.query<{ materials: unknown }>("SELECT master_snapshot -> 'materials' AS materials FROM calculations WHERE id = $1::uuid", [approved.calculationId]);
      return { rows, snapshotMaterials: defined(snapshot.rows[0]).materials };
    };
    const original = { material: approved.materialName, considered: approved.materialConsidered, treatment: approved.treatmentName };
    const words = (await wordsOf()) as { rows: unknown[]; snapshotMaterials: Array<{ materialInDrawing: string }> };
    expect(words.rows).toEqual([original, original]);
    expect(defined(words.snapshotMaterials[0]).materialInDrawing).toBe(approved.materialName);
    const before = await approvedValuesOf(world, approved.estimateId);
    const { masters, admin } = { masters: world.db.mastersService, admin: world.admin };

    // Renamed: the masters hold the new words, the approved estimate the old ones.
    await masters.updateMaterial(admin, approved.materialId, { materialInDrawing: 'Renamed approved plate', materialConsidered: 'Renamed approved steel' });
    await masters.updateTreatment(admin, approved.treatmentId, { name: 'Renamed approved gloss' });
    expect((await masters.listMaterials()).find((material) => material.id === approved.materialId)).toMatchObject({ materialInDrawing: 'Renamed approved plate' });
    expect((await masters.listTreatments()).find((treatment) => treatment.id === approved.treatmentId)).toMatchObject({ name: 'Renamed approved gloss' });
    expect(await wordsOf()).toEqual(words);
    expect(await approvedValuesOf(world, approved.estimateId)).toEqual(before);

    // Deleted: treatments are removed for good, a material is hidden (soft delete, allowed because only an approved estimate uses it).
    await masters.deleteTreatment(admin, approved.treatmentId);
    await masters.deleteMaterial(admin, approved.materialId);
    expect((await masters.listTreatments()).some((treatment) => treatment.id === approved.treatmentId)).toBe(false);
    expect((await masters.listMaterials()).some((material) => material.id === approved.materialId)).toBe(false);
    expect(await wordsOf()).toEqual(words);
    expect(await approvedValuesOf(world, approved.estimateId)).toEqual(before);
  });
});

describe('AC-3: the customer\'s rates reset, or the customer renamed, change nothing of the approved estimate', () => {
  it('after the rates are moved, reset to defaults and the customer renamed, every figure and the stored snapshot are as they were, and the review\'s header shows the customer\'s current name', async () => {
    const approved = await approvedEstimateOf(world);
    const { masters, admin, db } = { masters: world.db.mastersService, admin: world.admin, db: world.db };
    const before = await approvedValuesOf(world, approved.estimateId);
    // The customer's own rates first move away from the defaults, so that the reset really replaces them.
    const own = await masters.getCustomer(db.customerId);
    await masters.updateCustomer(admin, db.customerId, { rates: own.rates.map((rate) => ({ processItemId: rate.processItemId, value: new Decimal(rate.defaultValue).plus(7).toFixed() })) });
    const snapshotOf = async (): Promise<unknown> => (await db.owner.query('SELECT master_snapshot FROM calculations WHERE id = $1::uuid', [approved.calculationId])).rows;
    const snapshot = await snapshotOf();
    const originalName = (await masters.getCustomer(db.customerId)).name;
    expect(JSON.stringify(snapshot)).toContain(originalName);

    const reset = await masters.resetCustomerRates(admin, db.customerId);
    expect(reset.count).toBeGreaterThan(0);
    await masters.updateCustomer(admin, db.customerId, { name: 'Renamed approval customer' });

    expect(await approvedValuesOf(world, approved.estimateId)).toEqual(before);
    expect(await snapshotOf()).toEqual(snapshot);
    // The name shown is the current one (documented in the header of this file and in review-page.tsx); the name then stays in the snapshot.
    const code = defined((await db.owner.query<{ code: string }>('SELECT t.code FROM tasks t JOIN estimates e ON e.task_id = t.id WHERE e.id = $1::uuid', [approved.estimateId])).rows[0]).code;
    const workspace = defined(await db.estimates.findWorkspaceByCode(code));
    expect(workspace.customer).toEqual({ id: db.customerId, name: 'Renamed approval customer' });
    expect(JSON.stringify(await snapshotOf())).toContain(originalName);
  });
});

describe('AC-4 (configuration): a later configuration version leaves the approved estimate reading with its own', () => {
  it('a new config_versions row with a changed label: the review and every part still read the version the calculation was made with', async () => {
    const approved = await approvedEstimateOf(world);
    const before = await approvedValuesOf(world, approved.estimateId);
    const pinned = await world.db.owner.query<{ config_version_id: string }>('SELECT config_version_id::text FROM calculations WHERE id = $1::uuid', [approved.calculationId]);
    expect(pinned.rows).toEqual([{ config_version_id: world.db.configVersionId }]);

    // The simulation: a version 2 whose Unit Price (BG) and count (H) are called something else, written as the owner (a version is only ever added).
    const bg = seedFieldAt('BG').id;
    const count = seedFieldAt('H').id;
    const changed = { ...seedConfig, fields: seedConfig.fields.map((field) => (field.id === bg || field.id === count ? { ...field, label: `${field.label} v2` } : field)) };
    await world.db.owner.query("INSERT INTO config_versions (number, snapshot, reason) VALUES (2, $1::jsonb, 'Invented later version')", [JSON.stringify(changed)]);
    const current = await getCurrentVersion(createConfigRepository(world.db.prisma), createConfigVersionCache());
    expect(current.number).toBe(2);
    expect(defined(current.document.fields.find((field) => field.id === bg)).label).toMatch(/ v2$/);

    const after = await approvedValuesOf(world, approved.estimateId);
    expect(after).toEqual(before);
    expect(after.costs.configurationNumber).toBe(1);
    for (const view of after.nodeCosts) expect(view.details?.configurationNumber).toBe(1);
  });
});
