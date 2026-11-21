import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { readXlsxParts } from '../../support/xlsx-parts';

/**
 * GitHub #536: `uuid` below 11.1.1 has a missing buffer bounds check (GHSA-w5hq-g745-h8pq). ExcelJS 4.4.0 asks for `uuid` ^8.3.0, so `package.json` carries an `overrides` entry that gives ExcelJS `uuid` 11.1.1.
 * These tests keep that override honest: the copy ExcelJS resolves is a patched one, and ExcelJS's one call site (`v4`, in the conditional-format extension writer) still works with it.
 */

const MINIMUM_PATCHED = [11, 1, 1] as const;

/** The version of the `uuid` package that ExcelJS itself resolves, found from ExcelJS's own location. */
function uuidVersionSeenByExcelJs(): string {
  const requireFromHere = createRequire(import.meta.url);
  const excelJsEntry = requireFromHere.resolve('exceljs');
  const requireFromExcelJs = createRequire(excelJsEntry);
  const uuidEntry = requireFromExcelJs.resolve('uuid');
  let directory = path.dirname(uuidEntry);
  for (;;) {
    const manifest = path.join(directory, 'package.json');
    try {
      const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string; version?: string };
      if (parsed.name === 'uuid' && parsed.version !== undefined) return parsed.version;
    } catch {
      // No manifest at this level: look one level up.
    }
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error('The manifest of the uuid package that ExcelJS resolves was not found.');
    directory = parent;
  }
}

function isAtLeast(version: string, minimum: readonly [number, number, number]): boolean {
  const parts = version.split('.').map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < minimum.length; index += 1) {
    const have = parts[index] ?? 0;
    if (have !== minimum[index]) return have > (minimum[index] ?? 0);
  }
  return true;
}

describe('the uuid package under ExcelJS (GitHub #536)', () => {
  it('is a version with the buffer bounds check (11.1.1 or later)', () => {
    const version = uuidVersionSeenByExcelJs();
    expect(isAtLeast(version, MINIMUM_PATCHED), `ExcelJS resolves uuid ${version}`).toBe(true);
  });

  it('still lets ExcelJS write a conditional format that needs a version 4 id, as a braced upper-case GUID', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet');
    sheet.getCell('A1').value = 1;
    sheet.addConditionalFormatting({
      ref: 'A1:A3',
      rules: [
        {
          type: 'dataBar',
          priority: 1,
          gradient: false,
          minLength: 0,
          maxLength: 100,
          cfvo: [{ type: 'min' }, { type: 'max' }],
        },
      ],
    });
    const bytes = new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
    const sheetXml = readXlsxParts(bytes).get('xl/worksheets/sheet1.xml');
    expect(sheetXml).toBeDefined();
    expect(sheetXml).toMatch(/<x14:id>\{[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}\}<\/x14:id>/);
  });
});
