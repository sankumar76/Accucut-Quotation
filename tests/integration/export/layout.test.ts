import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createConfigRepository } from '@/server/repositories/config-repository';
import { buildWorkbook } from '@/server/export/build-workbook';
import { createExportRepository } from '@/server/repositories/export-repository';
import { createExportService, type ExportService } from '@/server/services/export-service';
import { createImageRepository } from '@/server/repositories/image-repository';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { exportFileSchema, exportSummarySchema } from '@/server/views/schemas/export';

import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';
import { inProcessBuilder } from '../../support/in-process-builder';
import { loadWorkbook } from '../../support/xlsx-parts';

/**
 * STORY-07.01 AC-1, AC-2, AC-3 and AC-6 (FR-066, FR-071; NFR-002; architecture section 4.6) against real PostgreSQL in a throwaway database, as the **runtime role**: the export repository reads the task
 * code and the customer's name of an estimate, and the export service builds the workbook of the registry's columns from the version the estimate's calculation was made with, which is read back with
 * ExcelJS (header row, widths, centring, number formats from the registry). Since STORY-07.02 the file holds a row for each part below the header, so the estimate is calculated first. An Engineer is
 * refused before anything is read. Every name and number is invented.
 */

let db: CalculationDatabase;
let exporter: ExportService;

const lead = () => ({ id: db.personId, role: 'LEAD' as const });
const admin = () => ({ id: db.personId, role: 'ADMIN' as const });
const engineer = () => ({ id: db.engineerId, role: 'ENGINEER' as const });

beforeAll(async () => {
  db = await openCalculationDatabase();
  const configurations = createConfigRepository(db.prisma);
  const cache = createConfigVersionCache();
  exporter = createExportService({
    header: createExportRepository(db.prisma),
    nodes: db.nodes,
    calculations: db.calculations,
    approvals: db.approvals,
    images: createImageRepository(db.prisma),
    configuration: { current: () => getCurrentVersion(configurations, cache), byId: (id) => getVersionById(configurations, id, cache) },
    transactions: db.transactions,
    builder: inProcessBuilder(buildWorkbook),
    clock: { now: () => new Date('2026-11-14T12:00:00.000Z') },
  });
}, 120_000);

afterAll(async () => {
  await db.close();
});

/** The task code of an estimate and the name of its customer, read as the owner (the truth the repository is held to). */
async function headerAsStored(estimateId: string): Promise<{ readonly code: string; readonly customerName: string | null }> {
  const { rows } = await db.owner.query<{ code: string; customerName: string | null }>(
    'SELECT t.code AS "code", c.name AS "customerName" FROM estimates e JOIN tasks t ON t.id = e.task_id LEFT JOIN customers c ON c.id = e.customer_id WHERE e.id = $1::uuid',
    [estimateId],
  );
  return defined(rows[0]);
}

describe('the export repository, as the runtime role', () => {
  it('reads the task code and the customer\'s name of an estimate with a customer, and a null name for one without', async () => {
    const withCustomer = await db.addEstimate({ engineer: true, withCustomer: true });
    const without = await db.addEstimate({ engineer: true, withCustomer: false });
    const repository = createExportRepository(db.prisma);
    expect(await repository.findHeader(withCustomer)).toEqual(await headerAsStored(withCustomer));
    expect(defined(await repository.findHeader(withCustomer)).customerName).not.toBeNull();
    expect(await repository.findHeader(without)).toEqual({ ...(await headerAsStored(without)), customerName: null });
  });

  it('is null for an estimate that does not exist and for an ID that is not a UUID, without asking the database', async () => {
    const repository = createExportRepository(db.prisma);
    expect(await repository.findHeader('00000000-0000-4000-8000-00000000dead')).toBeNull();
    expect(await repository.findHeader('not-an-id')).toBeNull();
  });
});

describe('AC-1, AC-2, AC-6: the file and the summary of a real estimate, for a Lead and an Admin', () => {
  it('builds the registry\'s 67 columns in row 1 with its widths and formats, centred, a row below for the part, named after the task and the IST date', async () => {
    const estimateId = await db.addCompleteEstimate();
    await db.service.calculate(engineer(), estimateId);
    const header = await headerAsStored(estimateId);
    const configurations = createConfigRepository(db.prisma);
    const { document } = await getCurrentVersion(configurations, createConfigVersionCache());

    for (const viewer of [lead(), admin()]) {
      const file = exportFileSchema.parse(await exporter.getFile(viewer, estimateId));
      expect(file.fileName).toMatch(new RegExp(`^Quotation_[A-Za-z0-9_-]+_${header.code}_2026-11-14\\.xlsx$`));
      const sheet = defined((await loadWorkbook(file.bytes)).getWorksheet('Quotation'));
      expect(sheet.columnCount).toBe(document.fields.length);
      // The header, the one part, and the footer of the total Tool Cost two rows below it (row 4 is empty): 3 rows with values (STORY-07.03).
      expect(sheet.actualRowCount).toBe(3);
      for (const field of [...document.fields].sort((a, b) => a.position - b.position)) {
        const column = sheet.getColumn(field.position);
        expect(column.width, field.key).toBe(field.width);
        const cell = sheet.getCell(1, field.position);
        expect(cell.value, field.key).toBe(field.label);
        expect(cell.alignment, field.key).toEqual({ horizontal: 'center', vertical: 'middle' });
      }
    }
  });

  it('the summary counts the parts and lists them in tree order, and holds no figure', async () => {
    const estimateId = await db.addEstimate({ engineer: true });
    const first = await db.addPart(estimateId, { inputs: { [idOf('D')]: 'Invented first' } });
    await db.addPart(estimateId, { parentId: first, inputs: { [idOf('D')]: 'Invented second', [idOf('H')]: '3' } });
    const summary = exportSummarySchema.parse(await exporter.getSummary(lead(), estimateId));
    expect(summary).toMatchObject({ partCount: 2, pictureCount: 0, columns: { first: 'A', last: 'BO', count: 67 } });
    expect(summary.rows).toEqual([
      { slNo: '1', name: 'Invented first', count: null },
      { slNo: '1.1', name: 'Invented second', count: '3' },
    ]);
    expect(JSON.stringify(summary)).not.toMatch(/₹|price|cost/i);
  });
});

describe('AC-3 (NFR-002): an Engineer is refused, and an estimate that is not there is not found', () => {
  it('refuses the Engineer who owns the estimate, for the file and the summary', async () => {
    const estimateId = await db.addEstimate({ engineer: true });
    await expect(exporter.getFile(engineer(), estimateId)).rejects.toMatchObject({ httpStatus: 403 });
    await expect(exporter.getSummary(engineer(), estimateId)).rejects.toMatchObject({ httpStatus: 403 });
  });

  it('is a 404 for an estimate that does not exist', async () => {
    await expect(exporter.getFile(lead(), '00000000-0000-4000-8000-00000000dead')).rejects.toMatchObject({ httpStatus: 404 });
    await expect(exporter.getSummary(admin(), 'not-an-id')).rejects.toMatchObject({ httpStatus: 404 });
  });
});
