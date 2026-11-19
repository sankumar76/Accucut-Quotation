import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { columnLetterToIndex } from '@/lib/columns';
import { buildWorkbook } from '@/server/export/build-workbook';
import { exportColumnsOf, headerOnlyModel, SHEET_NAME } from '@/server/export/export-columns';
import type { ExportColumn, ExportModel } from '@/server/export/export-model';

import { seedConfig } from '../../support/seed-config';
import { loadWorkbook, readXlsxParts } from '../../support/xlsx-parts';

/**
 * The layout of the worksheet (STORY-07.01 AC-1, AC-4; GitHub #394): the file is built in process from an `ExportModel` and read back with ExcelJS and, for the formula check, at the level of its XML.
 * Every value is invented. The four characters that start a formula in Excel are `=`, `+`, `-` and `@`.
 */

const FORMULA_STARTS = ['=', '+', '-', '@'] as const;
const INR_FORMAT = '[$₹-4009] #,##0.00';
const USD_FORMAT = '[$$-409] #,##0.00';
const EUR_FORMAT = '[$€-2] #,##0.00';

async function read(bytes: Uint8Array): Promise<ExcelJS.Worksheet> {
  const workbook = await loadWorkbook(bytes);
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (sheet === undefined) throw new Error('The workbook has no sheet of the expected name.');
  return sheet;
}

const smallColumns: ExportColumn[] = [
  { letter: 'A', header: 'Sl. No', width: 8, numFmt: '@' },
  { letter: 'B', header: 'Part', width: 30, numFmt: '@' },
  { letter: 'C', header: 'Unit Price (INR)', width: 18, numFmt: INR_FORMAT },
  { letter: 'D', header: 'Unit Price (USD)', width: 18, numFmt: USD_FORMAT },
  { letter: 'E', header: 'Unit Price (EUR)', width: 18, numFmt: EUR_FORMAT },
];

describe('the header row (AC-1)', () => {
  it('has the registry\'s columns A to BO in letter order, with the registry\'s labels as text in row 1', async () => {
    const model = headerOnlyModel(seedConfig);
    const sheet = await read(await buildWorkbook(model));
    expect(model.columns).toHaveLength(67);
    expect(model.columns[0]?.letter).toBe('A');
    expect(model.columns[66]?.letter).toBe('BO');
    const header = sheet.getRow(1);
    for (const column of model.columns) {
      const cell = header.getCell(columnLetterToIndex(column.letter));
      expect(cell.value).toBe(column.header);
      expect(cell.type).toBe(ExcelJS.ValueType.String);
    }
    // The header row is the whole file for now: node rows are STORY-07.02's.
    expect(sheet.actualRowCount).toBe(1);
  });

  it('takes each width from the registry, per column letter', async () => {
    const model = headerOnlyModel(seedConfig);
    const sheet = await read(await buildWorkbook(model));
    for (const column of model.columns) expect(sheet.getColumn(columnLetterToIndex(column.letter)).width).toBe(column.width);
  });

  it('centres every header cell horizontally and vertically', async () => {
    const sheet = await read(await buildWorkbook(headerOnlyModel(seedConfig)));
    sheet.getRow(1).eachCell((cell) => expect(cell.alignment).toEqual({ horizontal: 'center', vertical: 'middle' }));
  });

  it('moves a column when the registry is re-lettered: letters come from position, never from a stored letter', () => {
    const shifted = { ...seedConfig, fields: seedConfig.fields.map((field, index) => (index === 0 ? { ...field, position: field.position + 100 } : field)) };
    const letters = exportColumnsOf(shifted).map((column) => column.letter);
    expect(letters[0]).toBe('B');
    expect(letters.at(-1)).toBe('CW');
  });
});

describe('the cells (AC-1)', () => {
  const model: ExportModel = {
    sheetName: SHEET_NAME,
    columns: smallColumns,
    rows: [{ cells: { A: '1', B: 'Base frame', C: 1234.5678901234, D: 14.8123456789, E: 13.6, } }, { cells: { A: '1.1', B: 'Leg', C: null } }],
  };

  it('writes a number as the number at full precision, with the column\'s format (₹, $ or € shown by the format, not the value)', async () => {
    const sheet = await read(await buildWorkbook(model));
    expect(sheet.getCell('C2').value).toBe(1234.5678901234);
    expect(sheet.getCell('D2').value).toBe(14.8123456789);
    expect(sheet.getCell('C2').numFmt).toBe(INR_FORMAT);
    expect(sheet.getCell('D2').numFmt).toBe(USD_FORMAT);
    expect(sheet.getCell('E2').numFmt).toBe(EUR_FORMAT);
  });

  it('centres body cells horizontally and vertically, empty ones too, and leaves an empty cell empty', async () => {
    const sheet = await read(await buildWorkbook(model));
    for (const address of ['A2', 'B2', 'C2', 'E2', 'C3', 'D3']) expect(sheet.getCell(address).alignment).toEqual({ horizontal: 'center', vertical: 'middle' });
    expect(sheet.getCell('C3').value).toBeNull();
    expect(sheet.getCell('D3').value).toBeNull();
  });

  it('refuses a number that is not finite instead of writing a file Excel would repair', async () => {
    const bad: ExportModel = { ...model, rows: [{ cells: { C: Number.NaN } }] };
    await expect(buildWorkbook(bad)).rejects.toThrow(RangeError);
    await expect(buildWorkbook({ ...model, rows: [{ cells: { C: Number.POSITIVE_INFINITY } }] })).rejects.toThrow('C2');
  });
});

describe('text is only ever text (AC-4; GitHub #394)', () => {
  const typed = FORMULA_STARTS.flatMap((start) => [`${start}1+1`, `${start}SUM(A1:A9)`, `${start}cmd|' /C calc'!A0`, `${start}HYPERLINK("http://example.invalid","x")`]);
  const model: ExportModel = { sheetName: SHEET_NAME, columns: smallColumns, rows: typed.map((value, index) => ({ cells: { A: String(index + 1), B: value } })) };

  it.each(FORMULA_STARTS)('a value that starts with %s is stored as a string cell, and ExcelJS reads it back as that exact text', async (start) => {
    const sheet = await read(await buildWorkbook(model));
    const own = typed.map((value, index) => ({ value, row: index + 2 })).filter((entry) => entry.value.startsWith(start));
    expect(own.length).toBeGreaterThan(0);
    for (const { value, row } of own) {
      const cell = sheet.getCell(`B${row}`);
      expect(cell.type).toBe(ExcelJS.ValueType.String);
      expect(cell.value).toBe(value);
      expect(cell.formula).toBeUndefined();
    }
  });

  it('has no formula element anywhere in the sheet XML, and every typed value is a shared string', async () => {
    const parts = readXlsxParts(await buildWorkbook(model));
    const sheetXml = parts.get('xl/worksheets/sheet1.xml') ?? '';
    const shared = parts.get('xl/sharedStrings.xml') ?? '';
    expect(sheetXml).not.toMatch(/<f[ >/]/);
    // A cell of a typed text is `t="s"` (an index into the shared strings), never a formula cell and never a number.
    const column = [...sheetXml.matchAll(/<c r="B(\d+)"([^>]*)>/g)].filter((match) => Number(match[1]) >= 2);
    expect(column).toHaveLength(typed.length);
    for (const match of column) expect(match[2]).toMatch(/t="s"/);
    for (const value of ['=1+1', '+1+1', '-1+1', '@1+1']) expect(shared).toContain(value);
  });

  // Review QS-05: Excel and its imports skip a leading tab, carriage return or line feed before a formula character, so these are the same attack as the four above.
  const LEADING_SPACE = ['\t', '\r', '\n'] as const;
  const spaced = LEADING_SPACE.flatMap((space) => FORMULA_STARTS.map((start) => `${space}${start}1+1`));
  const spacedModel: ExportModel = { sheetName: SHEET_NAME, columns: smallColumns, rows: spaced.map((value, index) => ({ cells: { A: String(index + 1), B: value } })) };

  it.each(LEADING_SPACE)('a value that starts with a %j and then a formula character is stored as a string cell with exactly the typed text, and is no formula in the XML', async (space) => {
    const bytes = await buildWorkbook(spacedModel);
    const sheet = await read(bytes);
    const own = spaced.map((value, index) => ({ value, row: index + 2 })).filter((entry) => entry.value.startsWith(space));
    expect(own).toHaveLength(FORMULA_STARTS.length);
    for (const { value, row } of own) {
      const cell = sheet.getCell(`B${row}`);
      expect(cell.type).toBe(ExcelJS.ValueType.String);
      // An XML reader folds a raw carriage return into a line feed, as Excel does: the cell is still the same string of text, with a line break before the character.
      expect(cell.value).toBe(value.replace('\r', '\n'));
      expect(cell.formula).toBeUndefined();
    }
    const sheetXml = readXlsxParts(bytes).get('xl/worksheets/sheet1.xml') ?? '';
    expect(sheetXml).not.toMatch(/<f[ >/]/);
    const column = [...sheetXml.matchAll(/<c r="B(\d+)"([^>]*)>/g)].filter((match) => Number(match[1]) >= 2);
    expect(column).toHaveLength(spaced.length);
    for (const match of column) expect(match[2]).toMatch(/t="s"/);
  });

  it('writes the registry\'s own header the same way, so a label that starts with a formula character is text too', async () => {
    const columns: ExportColumn[] = [{ letter: 'A', header: '=HYPERLINK("http://example.invalid")', width: 10, numFmt: '@' }];
    const bytes = await buildWorkbook({ sheetName: SHEET_NAME, columns, rows: [] });
    const cell = (await read(bytes)).getCell('A1');
    expect(cell.type).toBe(ExcelJS.ValueType.String);
    expect(readXlsxParts(bytes).get('xl/worksheets/sheet1.xml')).not.toMatch(/<f[ >/]/);
  });
});

describe('a file Excel opens without a repair prompt (AC-4)', () => {
  it('is a zip with the parts a workbook needs, and the XML parts are well formed at the top level', async () => {
    const parts = readXlsxParts(await buildWorkbook(headerOnlyModel(seedConfig)));
    for (const name of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']) expect(parts.has(name)).toBe(true);
    for (const [name, text] of parts) if (name.endsWith('.xml') || name.endsWith('.rels')) expect(text.startsWith('<?xml')).toBe(true);
    expect(parts.get('xl/workbook.xml')).toContain(`name="${SHEET_NAME}"`);
  });

  it('is read back by ExcelJS with the same columns and no error', async () => {
    const bytes = await buildWorkbook(headerOnlyModel(seedConfig));
    expect((await read(bytes)).columnCount).toBe(67);
  });
});

describe('the largest estimate (RISK-010, DL-217: 2,000 parts)', () => {
  it('builds 2,000 rows of 67 columns in process, as a file that reads back', async () => {
    const columns = exportColumnsOf(seedConfig);
    const rows = Array.from({ length: 2000 }, (_, index) => ({
      cells: Object.fromEntries(columns.map((column) => [column.letter, column.numFmt === '@' ? `Part ${index + 1}` : (index + 1) * 1.123456789])),
    }));
    const started = performance.now();
    const bytes = await buildWorkbook({ sheetName: SHEET_NAME, columns, rows });
    const seconds = (performance.now() - started) / 1000;
    const parts = readXlsxParts(bytes);
    expect((parts.get('xl/worksheets/sheet1.xml') ?? '').match(/<row /g)).toHaveLength(2001);
    // Measured, not asserted tightly: the figure is reported in the pull request. A generous ceiling still catches a build that has become quadratic.
    expect(seconds).toBeLessThan(60);
  }, 120_000);
});

describe('the footer of the total Tool Cost (STORY-07.03 AC-3, AC-6)', () => {
  const rows = [{ cells: { A: '1', B: 'Frame', C: 12629.987654321 } }, { cells: { A: '2', B: 'Lid', C: 0.5 } }];

  it('writes the label and the number in their own cells of the footer row, one empty row below the last part, and nothing else in that row or the one above it', async () => {
    const model: ExportModel = { sheetName: SHEET_NAME, columns: smallColumns, rows, footer: { row: 5, cells: { B: 'Total Tool Cost', C: 5 } } };
    const sheet = await read(await buildWorkbook(model));
    expect(sheet.getCell('B5').value).toBe('Total Tool Cost');
    expect(sheet.getCell('B5').type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell('C5').value).toBe(5);
    for (const address of ['A5', 'D5', 'E5', 'A4', 'B4', 'C4', 'D4', 'E4']) expect(sheet.getCell(address).value, address).toBeNull();
    // Row 2 and 3 are the parts, untouched.
    expect(sheet.getCell('C2').value).toBe(12629.987654321);
    expect(sheet.getCell('C3').value).toBe(0.5);
  });

  it('keeps the column\'s own number format on the number and the text format on the label, so Excel shows 5.00 and never reads the label as anything but text', async () => {
    const model: ExportModel = { sheetName: SHEET_NAME, columns: smallColumns, rows, footer: { row: 5, cells: { B: 'Total Tool Cost', C: 5 } } };
    const sheet = await read(await buildWorkbook(model));
    expect(sheet.getCell('C5').numFmt).toBe(INR_FORMAT);
    expect(sheet.getCell('B5').numFmt).toBe('@');
    expect(sheet.getCell('C5').alignment).toMatchObject({ horizontal: 'center', vertical: 'middle' });
  });

  it('writes a footer label that starts like a formula as the text it is', async () => {
    const model: ExportModel = { sheetName: SHEET_NAME, columns: smallColumns, rows, footer: { row: 5, cells: { B: '=1+1', C: 5 } } };
    const bytes = await buildWorkbook(model);
    expect((await read(bytes)).getCell('B5').value).toBe('=1+1');
    expect(readXlsxParts(bytes).get('xl/worksheets/sheet1.xml') ?? '').not.toContain('<f>');
  });

  it('refuses a footer number that is not finite rather than write a corrupt file', async () => {
    const model: ExportModel = { sheetName: SHEET_NAME, columns: smallColumns, rows, footer: { row: 5, cells: { C: Number.POSITIVE_INFINITY } } };
    await expect(buildWorkbook(model)).rejects.toThrow('not a finite number');
  });

  it('is no row at all when the model has no footer', async () => {
    const sheet = await read(await buildWorkbook({ sheetName: SHEET_NAME, columns: smallColumns, rows }));
    expect(sheet.actualRowCount).toBe(3);
  });
});
