import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Decimal } from '@/lib/decimal';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createConfigVersionCache, getCurrentVersion } from '@/server/services/config-service';

import { auditOf, currentCalculationOf } from '../support/approval-helpers';
import { approvedEstimateOf, approvedValuesOf, changeTheMasters, exportCellsOf, openApprovedWorld, totalOfANewCalculation, type ApprovedWorld } from '../support/approved-world';
import { idOf } from '../support/calculation-database';
import { defined } from '../support/defined';
import { seedConfig, seedFieldAt } from '../support/seed-config';

/**
 * STORY-06.09 AC-1 to AC-4, AC-6 and AC-7 (FR-065, NFR-026, NFR-007; ADR-007; architecture sections 4.8 and 5.1; test strategy section 9) against real PostgreSQL in a throwaway database, as the **runtime
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
 * **The export (AC-1, last words; STORY-07.03 AC-7; review SQR-01 of AQP-326, #478).** The cells of the real file (`exportCellsOf` in `tests/support/approved-world.ts`: the export service over this database,
 * the workbook built and read back) are part of `approvedValuesOf`, so every equality below compares the file with the screens and the records, and a cell of the file that moved would fail it. The test named
 * "EXPORT" shows the file is not empty (it holds the header, the parts, BL2, BN2, BO2 and the footer), so the equality cannot pass on a constant. Nothing in this file is skipped.
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
    // Each of the 15 rate changes now also moves the customers that held the old default (STORY-02.08): a few statements more each, and 5 s was too little with the whole suite running.
  }, 30_000);

  it('the price that was approved is the one stored, and BO shows it after the change too', async () => {
    const approved = await approvedEstimateOf(world, '4321.50');
    await changeTheMasters(world, approved.materialId);
    const costs = await world.review.getCosts(world.lead, approved.estimateId);
    expect(costs.approval).toMatchObject({ price: '4321.50' });
    const stored = await world.db.owner.query<{ approved_price: string }>('SELECT approved_price::text FROM approvals WHERE estimate_id = $1::uuid', [approved.estimateId]);
    expect(stored.rows).toEqual([{ approved_price: '4321.50' }]);
  });

  it('EXPORT (STORY-07.03 AC-7): the file of an approved estimate holds its header, its parts, BL2, BN2, BO2 and the footer, and its cells are identical after the masters change', async () => {
    const approved = await approvedEstimateOf(world, '4321.50');
    const before = await exportCellsOf(world, approved.estimateId);
    const total = defined((await world.review.getCosts(world.lead, approved.estimateId)).totals);
    // Not a constant: a header, two parts, one empty row and the footer, with the product's figures in row 2 and the approved price in BO2.
    expect(before.rows).toHaveLength(5);
    expect(before.rows[0]?.[0]).toBe('Sl. No');
    expect(before.rows[1]?.[seedFieldAt('BL').position - 1]).toBe(Number(defined(total.totalPrice)));
    expect(before.rows[1]?.[seedFieldAt('BO').position - 1]).toBe(4321.5);
    expect(before.rows[4]?.[seedFieldAt('BM').position - 2]).toBe('Total Tool Cost');
    expect(before.rows[4]?.[seedFieldAt('BM').position - 1]).toBe(Number(defined(total.toolCostTotal)));

    await changeTheMasters(world, approved.materialId);
    expect(await totalOfANewCalculation(world, approved.materialId)).not.toBe(total.totalPrice);

    expect(await exportCellsOf(world, approved.estimateId)).toEqual(before);
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
    expect(workspace.customer).toEqual({ id: db.customerId, name: 'Renamed approval customer', shortName: (await masters.getCustomer(db.customerId)).shortName });
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

describe('AC-7: an unlocked-then-recalculated estimate uses the current masters, and the earlier calculation stays as it was', () => {
  it('unlock, then Recalculate: a new calculation from the masters as they are now is linked, the old record and the earlier approval are unchanged and readable', async () => {
    const approved = await approvedEstimateOf(world, '1000.00');
    const { db, lead } = world;
    const before = await approvedValuesOf(world, approved.estimateId);
    const oldTotal = defined(before.costs.totals).totalPrice;
    const oldRecord = await db.calculations.findCalculation(approved.calculationId);

    await changeTheMasters(world, approved.materialId);
    const unlocked = await world.unlock.unlock(lead, approved.estimateId, { reason: 'Rates have moved since.', audit: auditOf(db) });
    expect(unlocked.status).toBe('DRAFT');
    await db.service.recalculate(lead, approved.estimateId);

    // A new calculation, from the masters as they are now (FR-063).
    const newId = await currentCalculationOf(db, approved.estimateId);
    expect(newId).not.toBe(approved.calculationId);
    const created = await db.owner.query<{ n: number }>('SELECT count(*)::int AS n FROM calculations WHERE estimate_id = $1::uuid', [approved.estimateId]);
    expect(defined(created.rows[0]).n).toBe(2);
    const fresh = defined(await db.calculations.findCalculation(newId));
    expect(new Decimal(defined(fresh.masterSnapshot.materials[0]).pricePerKg).equals(999)).toBe(true);
    expect(new Decimal(defined(fresh.masterSnapshot.exchangeRates.usd)).equals(101)).toBe(true);
    expect(new Decimal(defined(fresh.masterSnapshot.exchangeRates.eur)).equals(111)).toBe(true);
    const costs = await world.review.getCosts(lead, approved.estimateId);
    expect(costs.state).toBe('current');
    expect(costs.calculationId).toBe(newId);
    const newTotal = defined(costs.totals).totalPrice;
    expect(newTotal).not.toBe(oldTotal);
    // It is the total a calculation of the same inputs would give now, to the last digit.
    expect(newTotal).toBe(await totalOfANewCalculation(world, approved.materialId));
    // The price approved earlier stays the price on record until a new approval replaces it.
    expect(costs.approval).toMatchObject({ price: '1000.00', unlock: { reason: 'Rates have moved since.' } });

    // The old calculation is as it was: the record as the repository reads it, and its rows, to the last digit.
    expect(await db.calculations.findCalculation(approved.calculationId)).toEqual(oldRecord);
    const after = await approvedValuesOf(world, approved.estimateId);
    expect(after.records.calculations).toContainEqual(defined(before.records.calculations[0]));
    const oldRows = after.records.rows.filter((row) => (row as { calculation_id: string }).calculation_id === approved.calculationId);
    expect(oldRows).toEqual(before.records.rows);
    expect(defined(oldRecord).productValues.totalPrice).toBe(oldTotal);

    // The earlier approval record points to the old calculation and holds its approved values; only the unlock columns were set.
    const approvals = await db.owner.query<Record<string, unknown>>(
      'SELECT calculation_id::text, approved_price::text, calculated_bl::text, is_override, approved_by::text, approved_at, unlocked_at FROM approvals WHERE estimate_id = $1::uuid',
      [approved.estimateId],
    );
    const earlier = before.records.approvals[0] as Record<string, unknown>;
    expect(approvals.rows).toHaveLength(1);
    expect(approvals.rows[0]).toMatchObject({
      calculation_id: approved.calculationId,
      approved_price: '1000.00',
      calculated_bl: earlier['calculated_bl'],
      is_override: earlier['is_override'],
      approved_by: earlier['approved_by'],
      approved_at: earlier['approved_at'],
    });
    expect(defined(approvals.rows[0])['unlocked_at']).not.toBeNull();
  });
});
