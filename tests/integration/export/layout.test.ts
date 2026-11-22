import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createConfigRepository } from '@/server/repositories/config-repository';
import { buildWorkbook } from '@/server/export/build-workbook';
import { createExportRepository } from '@/server/repositories/export-repository';
import { createExportService, type ExportService } from '@/server/services/export-service';
import { createImageRepository } from '@/server/repositories/image-repository';
import { attachmentDisposition } from '@/server/http/content-disposition';
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

/** The task code and subject of an estimate and the short name of its customer, read as the owner (the truth the repository is held to). */
async function headerAsStored(estimateId: string): Promise<{ readonly code: string; readonly customerShortName: string | null; readonly subject: string }> {
  const { rows } = await db.owner.query<{ code: string; customerShortName: string | null; subject: string }>(
    'SELECT t.code AS "code", c.short_name AS "customerShortName", t.subject AS "subject" FROM estimates e JOIN tasks t ON t.id = e.task_id LEFT JOIN customers c ON c.id = e.customer_id WHERE e.id = $1::uuid',
    [estimateId],
  );
  return defined(rows[0]);
}

/** Sets the subject of the estimate's task and, for a short name, adds a customer with it and chooses that customer on the estimate (as the owner). */
async function setNameParts(estimateId: string, parts: { readonly subject?: string; readonly shortName?: string }): Promise<void> {
  if (parts.subject !== undefined) await db.owner.query('UPDATE tasks SET subject = $1 WHERE id = (SELECT task_id FROM estimates WHERE id = $2::uuid)', [parts.subject, estimateId]);
  if (parts.shortName !== undefined) {
    const customer = await db.owner.query<{ id: string }>('INSERT INTO customers (name, short_name) VALUES ($1, $2) RETURNING id::text', [`Invented customer ${parts.shortName}`, parts.shortName]);
    await db.owner.query('UPDATE estimates SET customer_id = $1::uuid WHERE id = $2::uuid', [defined(customer.rows[0]).id, estimateId]);
  }
}

describe('the export repository, as the runtime role', () => {
  it('reads the task code, the subject and the customer\'s short name of an estimate with a customer, and a null short name for one without', async () => {
    const withCustomer = await db.addEstimate({ engineer: true, withCustomer: true });
    const without = await db.addEstimate({ engineer: true, withCustomer: false });
    const repository = createExportRepository(db.prisma);
    expect(await repository.findHeader(withCustomer)).toEqual(await headerAsStored(withCustomer));
    expect(defined(await repository.findHeader(withCustomer)).customerShortName).not.toBeNull();
    expect(await repository.findHeader(without)).toEqual({ ...(await headerAsStored(without)), customerShortName: null });
    expect(defined(await repository.findHeader(without)).subject).toBe('Invented subject');
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
      expect(file.fileName).toBe(`${defined(header.customerShortName)}_Invented-subject_14-11-2026.xlsx`);
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

describe('AQP-391 AC-1, AC-3, AC-7, AC-8: the file name is <short name>_<subject>_<DD-MM-YYYY>.xlsx, read from the data', () => {
  it('cleans a short name and a subject with a space, a slash and non-ASCII letters, and the file and the summary carry the same name, which the header encodes', async () => {
    const estimateId = await db.addCompleteEstimate();
    await db.service.calculate(engineer(), estimateId);
    await setNameParts(estimateId, { shortName: 'M A/S', subject: 'Kühler Ø 40 – 工场/x' });
    const expected = 'M-A-S_Kühler-Ø-40-–-工场-x_14-11-2026.xlsx';
    const file = exportFileSchema.parse(await exporter.getFile(lead(), estimateId));
    expect(file.fileName).toBe(expected);
    expect(exportSummarySchema.parse(await exporter.getSummary(lead(), estimateId)).fileName).toBe(expected);
    expect(attachmentDisposition(file.fileName)).toBe(
      `attachment; filename="M-A-S_Khler--40---x_14-11-2026.xlsx"; filename*=UTF-8''M-A-S_K%C3%BChler-%C3%98-40-%E2%80%93-%E5%B7%A5%E5%9C%BA-x_14-11-2026.xlsx`,
    );
  });

  it('is "Customer" while no customer is chosen, and the task code for a subject that is empty once cleaned (a legacy-shaped estimate)', async () => {
    const estimateId = await db.addEstimate({ engineer: true, withCustomer: false });
    await setNameParts(estimateId, { subject: '​' });
    const header = await headerAsStored(estimateId);
    expect(exportSummarySchema.parse(await exporter.getSummary(lead(), estimateId)).fileName).toBe(`Customer_${header.code}_14-11-2026.xlsx`);
  });

  it('cuts the end of a subject of 80 under a short name of 10, so the date stays', async () => {
    const estimateId = await db.addEstimate({ engineer: true, withCustomer: false });
    await setNameParts(estimateId, { shortName: 'ABCDEFGHIJ', subject: 'y'.repeat(80) });
    expect(exportSummarySchema.parse(await exporter.getSummary(lead(), estimateId)).fileName).toBe(`ABCDEFGHIJ_${'y'.repeat(78)}_14-11-2026.xlsx`);
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
