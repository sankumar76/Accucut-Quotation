import { describe, expect, it } from 'vitest';

import { buildWorkbook } from '@/server/export/build-workbook';

import { pngOfDimensions } from '../../support/pictures';
import { workbookText, XlsxFormatError } from '../../support/xlsx-parts';

/**
 * Review QS-07 of AQP-331 (STORY-07.02): the canary scan must look **inside** the file. A workbook's text is compressed, so a figure that is in it is not in its raw bytes; `workbookText` inflates the
 * XML parts so the scan can find the figure, and a control proves the raw bytes are blind (which is why the file route's status, its lack of `Content-Disposition` and its lack of `PK` bytes were, until
 * now, the only barrier). The values are invented.
 */

const FIGURE = '4817.2603915';
const WORDS = 'Invented distinctive part name for the scan to find';

async function file(): Promise<Uint8Array> {
  return buildWorkbook({
    sheetName: 'Quotation',
    columns: [
      { letter: 'A', header: 'Name', width: 40, numFmt: '@' },
      { letter: 'B', header: 'Price', width: 12, numFmt: '#,##0.00' },
      { letter: 'C', header: 'Picture', width: 18, numFmt: '@' },
    ],
    rows: [{ cells: { A: WORDS, B: Number(FIGURE) }, picture: 0 }],
    pictures: [{ extension: 'png', bytes: new Uint8Array(pngOfDimensions(32, 32)) }],
    pictureColumn: 'C',
  });
}

describe('workbookText', () => {
  it('holds the figure and the words that are inside the file, which a scan of the raw bytes does not see (the control)', async () => {
    const bytes = await file();
    const raw = Buffer.from(bytes).toString('latin1');
    expect(raw.includes(FIGURE)).toBe(false);
    expect(raw.includes(WORDS)).toBe(false);
    const text = workbookText(bytes);
    expect(text).toContain(FIGURE);
    expect(text).toContain(WORDS);
  });

  it('names each part it read, and leaves the binary pictures out', async () => {
    const text = workbookText(await file());
    expect(text).toContain('<!-- xl/worksheets/sheet1.xml -->');
    expect(text).toContain('<!-- xl/sharedStrings.xml -->');
    expect(text).not.toContain('xl/media/');
  });

  it('refuses bytes that are not a zip, so a body that was not a workbook is never scanned as if it were empty', () => {
    expect(() => workbookText(new TextEncoder().encode('{"status":403}'))).toThrow(XlsxFormatError);
    expect(() => workbookText(new Uint8Array(0))).toThrow(XlsxFormatError);
  });
});
