import { Decimal } from '../../src/lib/decimal';
import { buildWorkbook } from '../../src/server/export/build-workbook';
import { SHEET_NAME } from '../../src/server/export/export-columns';
import type { CostsView } from '../../src/server/views/schemas/costs';
import type { NodeCostsView } from '../../src/server/views/schemas/node-costs';
import { createConfigRepository } from '../../src/server/repositories/config-repository';
import { createExportRepository } from '../../src/server/repositories/export-repository';
import { createImageRepository } from '../../src/server/repositories/image-repository';
import type { AuditContext } from '../../src/server/services/audit-service';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '../../src/server/services/config-service';
import { createCostDetailsService, type CostDetailsService } from '../../src/server/services/cost-details-service';
import { createExportService, type ExportService } from '../../src/server/services/export-service';
import type { EstimateViewer } from '../../src/server/services/estimate-service';
import { createEstimateReviewService, type EstimateReviewService } from '../../src/server/services/estimate-review-service';
import { createUnlockService, type UnlockService } from '../../src/server/services/unlock-service';

import { contextOf, insertPersonAsOwner } from './audit-database';
import { currentCalculationOf, engineerOf, leadOf, PRICE, requestFor } from './approval-helpers';
import { type CalculationDatabase, idOf, openCalculationDatabase } from './calculation-database';
import { completePartInputs } from './complete-part';
import { defined } from './defined';
import { inProcessBuilder } from './in-process-builder';
import { loadWorkbook } from './xlsx-parts';

/**
 * What the tests of STORY-06.09 share (FR-065, NFR-026; ADR-007): a throwaway database as the **runtime role**, the review and the cost details services over it as the composition builds
 * them, an Admin who changes the masters **through the real master services**, and an estimate that is calculated and approved. `approvedValuesOf` gathers everything an approved estimate shows
 * and stores in one place, so a test compares the whole of it before and after with one deep equality. Every name, ID and number is invented.
 *
 * **The file (STORY-07.03; review SQR-01 of AQP-326, #478).** `exportCellsOf` builds the **real file** of the estimate: the export service over this database's own repositories, the workbook built in process by the
 * same function the thread runs, read back with ExcelJS, every cell of the sheet. So `approvedValuesOf` holds the file's cells with everything else an approved estimate shows and stores, and the one deep equality that
 * compares it before and after a change of the masters fails if a cell of the file moves. It is a hook that can fail: it reads what the export writes, not a constant.
 */

export interface ApprovedWorld {
  readonly db: CalculationDatabase;
  readonly review: EstimateReviewService;
  readonly details: CostDetailsService;
  /** The unlock service over the real repositories, as the composition builds it (STORY-06.08). */
  readonly unlock: UnlockService;
  /** The export over the same repositories, the file built in process (STORY-07.03). */
  readonly exporter: ExportService;
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
    exporter: createExportService({
      header: createExportRepository(db.prisma),
      nodes: db.nodes,
      calculations: db.calculations,
      approvals: db.approvals,
      images: createImageRepository(db.prisma),
      configuration,
      transactions: db.transactions,
      builder: inProcessBuilder(buildWorkbook),
      clock: { now: () => new Date('2026-11-14T12:00:00.000Z') },
    }),
    review: createEstimateReviewService({ calculations: db.calculations, approvals: db.approvals, nodes: db.nodes, estimates: db.estimates, masters: db.masterRepository, configuration }),
    details: createCostDetailsService({ calculations: db.calculations, nodes: db.nodes, configuration }),
    unlock: createUnlockService({
      estimates: db.estimates,
      approvals: db.approvals,
      calculations: db.calculations,
      masters: db.masterRepository,
      configuration,
      transactions: db.transactions,
      workflow: { transition: db.estimateService.transition, audit: db.audit },
    }),
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

/** Every cell of the exported file's one sheet, by row number then column number (1-based; a cell with no value is `null`): the header row, the part rows, BL2, BN2, BO2 and the footer. */
export interface ExportedCells {
  readonly sheetName: string;
  readonly rows: ReadonlyArray<ReadonlyArray<unknown>>;
}

/**
 * The cells of the file the Lead would download now, read back from the workbook: **the file name is not among them** (it carries the customer's current name and the date of the download, which the header of
 * `aqp-approved-immutable.test.ts` documents), but every cell is.
 */
export async function exportCellsOf(world: ApprovedWorld, estimateId: string): Promise<ExportedCells> {
  const { bytes } = await world.exporter.getFile(world.lead, estimateId);
  const sheet = defined((await loadWorkbook(bytes)).getWorksheet(SHEET_NAME));
  const rows: unknown[][] = [];
  for (let row = 1; row <= sheet.rowCount; row += 1) {
    rows.push(Array.from({ length: sheet.columnCount }, (_, index) => sheet.getCell(row, index + 1).value));
  }
  return { sheetName: sheet.name, rows };
}

/** Everything an approved estimate shows (the review and the cost details of every part) and stores (the record, its rows and the approval), as the owner reads it. */
export interface ApprovedValues {
  readonly costs: CostsView;
  readonly nodeCosts: ReadonlyArray<NodeCostsView>;
  readonly records: { readonly calculations: ReadonlyArray<unknown>; readonly rows: ReadonlyArray<unknown>; readonly approvals: ReadonlyArray<unknown> };
  readonly exportCells: ExportedCells;
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
    exportCells: await exportCellsOf(world, estimateId),
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
