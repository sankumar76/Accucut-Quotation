import { Decimal } from '../../src/lib/decimal';
import type { CostsView } from '../../src/server/views/schemas/costs';
import type { NodeCostsView } from '../../src/server/views/schemas/node-costs';
import { createConfigRepository } from '../../src/server/repositories/config-repository';
import type { AuditContext } from '../../src/server/services/audit-service';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '../../src/server/services/config-service';
import { createCostDetailsService, type CostDetailsService } from '../../src/server/services/cost-details-service';
import type { EstimateViewer } from '../../src/server/services/estimate-service';
import { createEstimateReviewService, type EstimateReviewService } from '../../src/server/services/estimate-review-service';

import { contextOf, insertPersonAsOwner } from './audit-database';
import { currentCalculationOf, engineerOf, leadOf, PRICE, requestFor } from './approval-helpers';
import { type CalculationDatabase, idOf, openCalculationDatabase } from './calculation-database';
import { completePartInputs } from './complete-part';
import { defined } from './defined';

/**
 * What the tests of STORY-06.09 share (FR-065, NFR-026; ADR-007): a throwaway database as the **runtime role**, the review and the cost details services over it as the composition builds
 * them, an Admin who changes the masters **through the real master services**, and an estimate that is calculated and approved. `approvedValuesOf` gathers everything an approved estimate shows
 * and stores in one place, so a test compares the whole of it before and after with one deep equality. Every name, ID and number is invented.
 *
 * **The hook for the export (STORY-07.03).** `exportCellsOf` is where the cells of the exported file will be read. The export holds no figure yet (STORY-07.01 is the header row alone), so it answers
 * `null`; STORY-07.03 replaces it with the cells of the real file and the one test that names it (`aqp-approved-immutable.test.ts`, "EXPORT HOOK") then asserts them. Nothing here is skipped.
 */

export interface ApprovedWorld {
  readonly db: CalculationDatabase;
  readonly review: EstimateReviewService;
  readonly details: CostDetailsService;
  /** The Lead who reads the screens and approves. */
  readonly lead: EstimateViewer;
  /** Who changes the masters, as the master services are called: an Admin's audit context. */
  readonly admin: AuditContext;
}

export async function openApprovedWorld(): Promise<ApprovedWorld> {
  const db = await openCalculationDatabase();
  const configurations = createConfigRepository(db.prisma);
  const cache = createConfigVersionCache();
  const configuration = { current: () => getCurrentVersion(configurations, cache), byId: (id: string) => getVersionById(configurations, id, cache) };
  const adminId = await insertPersonAsOwner(db, 'Approval Admin', 'ADMIN');
  return {
    db,
    review: createEstimateReviewService({ calculations: db.calculations, approvals: db.approvals, nodes: db.nodes, configuration }),
    details: createCostDetailsService({ calculations: db.calculations, nodes: db.nodes, configuration }),
    lead: leadOf(db),
    admin: contextOf(adminId, 'Invented Approval Admin'),
  };
}

let sequence = 0;

export interface CalculatedEstimate {
  readonly estimateId: string;
  readonly materialId: string;
  readonly materialName: string;
  readonly materialConsidered: string;
  readonly treatmentId: string;
  readonly treatmentName: string;
  readonly nodeIds: ReadonlyArray<string>;
}

/**
 * An estimate of the Engineer's with two parts, calculated (SUBMITTED, the figures current). Its material and its treatment are new entries of the masters made through the Admin's services, used by no
 * other estimate, so a test can rename and delete them. `materialId` names an existing material to use instead (a second estimate over the same material).
 */
export async function calculatedEstimateOf(world: ApprovedWorld, options: { readonly materialId?: string } = {}): Promise<CalculatedEstimate> {
  const { db, admin } = world;
  sequence += 1;
  const treatment = await db.mastersService.createTreatment(admin, { name: `Invented approved gloss ${String(sequence)}` });
  const material =
    options.materialId === undefined
      ? await db.mastersService.createMaterial(admin, {
          materialInDrawing: `Invented approved plate ${String(sequence)}`,
          materialConsidered: `Invented approved steel ${String(sequence)}`,
          pricePerKg: '60',
          specificGravity: '7.85',
          scrapRate: '25',
        })
      : defined((await db.mastersService.listMaterials()).find((candidate) => candidate.id === options.materialId));
  const estimateId = await db.addEstimate({ engineer: true });
  const nodeIds: string[] = [];
  let parentId: string | null = null;
  for (const [index, part] of [{ h: '3', cost: '10' }, { h: '2', cost: '5.5' }].entries()) {
    const inputs = {
      ...completePartInputs(),
      [idOf('E')]: material.id,
      [idOf('G')]: { id: treatment.id, text: treatment.name },
      [idOf('H')]: part.h,
      [idOf('AP')]: part.cost,
      [idOf('D')]: `Invented approved part ${String(index + 1)}`,
    };
    parentId = await db.addPart(estimateId, { parentId, sortIndex: 0, inputs });
    nodeIds.push(parentId);
  }
  await db.service.calculate(engineerOf(db), estimateId);
  return {
    estimateId,
    materialId: material.id,
    materialName: material.materialInDrawing,
    materialConsidered: material.materialConsidered,
    treatmentId: treatment.id,
    treatmentName: treatment.name,
    nodeIds,
  };
}

/** A calculated estimate that the Lead then approves at `price`. */
export async function approvedEstimateOf(world: ApprovedWorld, price: string = PRICE): Promise<CalculatedEstimate & { readonly calculationId: string }> {
  const calculated = await calculatedEstimateOf(world);
  const calculationId = await currentCalculationOf(world.db, calculated.estimateId);
  await world.db.approvalService.approve(world.lead, calculated.estimateId, requestFor(world.db, calculationId, price));
  return { ...calculated, calculationId };
}

/** The cells of the exported file of an estimate. STORY-07.03 fills this in (see the header); until then the export holds no figure. */
export function exportCellsOf(): Promise<null> {
  return Promise.resolve(null);
}

/** Everything an approved estimate shows (the review and the cost details of every part) and stores (the record, its rows and the approval), as the owner reads it. */
export interface ApprovedValues {
  readonly costs: CostsView;
  readonly nodeCosts: ReadonlyArray<NodeCostsView>;
  readonly records: { readonly calculations: ReadonlyArray<unknown>; readonly rows: ReadonlyArray<unknown>; readonly approvals: ReadonlyArray<unknown> };
  readonly exportCells: null;
}

export async function approvedValuesOf(world: ApprovedWorld, estimateId: string): Promise<ApprovedValues> {
  const { db, review, details, lead } = world;
  const costs = await review.getCosts(lead, estimateId);
  const nodes = await db.nodes.listNodes(estimateId);
  const nodeCosts: NodeCostsView[] = [];
  for (const node of nodes) nodeCosts.push(await details.getNodeCosts(lead, estimateId, node.id));
  const calculations = await db.owner.query('SELECT * FROM calculations WHERE estimate_id = $1::uuid ORDER BY id', [estimateId]);
  const rows = await db.owner.query('SELECT r.* FROM calculation_rows r JOIN calculations c ON c.id = r.calculation_id WHERE c.estimate_id = $1::uuid ORDER BY r.id', [estimateId]);
  const approvals = await db.owner.query('SELECT * FROM approvals WHERE estimate_id = $1::uuid ORDER BY id', [estimateId]);
  return {
    costs,
    nodeCosts,
    records: { calculations: calculations.rows, rows: rows.rows, approvals: approvals.rows },
    exportCells: await exportCellsOf(),
  };
}

const bumped = (value: string): string => new Decimal(value).plus(1).toFixed();

/**
 * A process rate, a material price and an exchange rate changed by the Admin, each through the master service the screen calls (the Process Master's defaults and the customer's own rates, the
 * material's price and scrap rate, both exchange rates). Every figure a calculation reads from the masters is different afterwards.
 */
export async function changeTheMasters(world: ApprovedWorld, materialId: string): Promise<void> {
  const { db, admin } = world;
  const masters = db.mastersService;
  for (const item of await masters.listProcessItems()) await masters.updateProcessItem(admin, item.id, { defaultValue: bumped(item.defaultValue) });
  const customer = await masters.getCustomer(db.customerId);
  await masters.updateCustomer(admin, db.customerId, { rates: customer.rates.map((rate) => ({ processItemId: rate.processItemId, value: bumped(rate.value) })) });
  await masters.updateMaterial(admin, materialId, { pricePerKg: '999', scrapRate: '30' });
  await masters.saveExchangeRates(admin, { usd: '101', eur: '111' });
}

/** The total (BL) a calculation made now would give: a second estimate over the same material, calculated, read through the review. Used to show the masters really changed. */
export async function totalOfANewCalculation(world: ApprovedWorld, materialId: string): Promise<string> {
  const fresh = await calculatedEstimateOf(world, { materialId });
  const costs = await world.review.getCosts(world.lead, fresh.estimateId);
  return defined(defined(costs.totals).totalPrice);
}
