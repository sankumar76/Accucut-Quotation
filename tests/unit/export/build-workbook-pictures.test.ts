import { randomFillSync } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { columnLetterToIndex } from '@/lib/columns';
import { buildWorkbook } from '@/server/export/build-workbook';
import { exportModelSchema, type ExportModel, type ExportPicture } from '@/server/export/export-model';

import { gifOfDimensions, jpegOfDimensions, pngOfDimensions } from '../../support/pictures';
import { loadWorkbook, readXlsxParts } from '../../support/xlsx-parts';

/**
 * The picture of a part in the file (STORY-07.02 AC-4, AC-8; FR-067, NFR-005, NFR-010): embedded in column C of its own row, scaled to fit the cell with its proportions kept, a part with no picture leaves the
 * cell empty. The file is built in process and read back with ExcelJS and, for the media, at the level of its zip. Every picture is a few invented bytes.
 */

/** The ceiling of the timing test under the combined coverage run of CI, which slows the build several times over (the 10 s line is the perf test's). */
const LOOSE_BOUND_SECONDS = 90;

const COLUMNS = [
  { letter: 'A', header: 'Sl. No', width: 8, numFmt: '@' },
  { letter: 'B', header: 'Name', width: 20, numFmt: '@' },
  { letter: 'C', header: 'Part Model', width: 18, numFmt: '@' },
];
/** Excel's own arithmetic for a column of 18 characters, and the row height the file gives a row with a picture (75 points at 96 dots per inch). */
const CELL_WIDTH_PX = 18 * 7 + 5;
const CELL_HEIGHT_PX = 100;

/** The files inside the zip's media folder (the folder's own entry is not a file). */
const mediaOf = (bytes: Uint8Array): string[] => [...readXlsxParts(bytes).keys()].filter((name) => name.startsWith('xl/media/') && !name.endsWith('/'));

const picture = (extension: ExportPicture['extension'], bytes: Uint8Array): ExportPicture => ({ extension, bytes });
const model = (rows: ExportModel['rows'], pictures: ExportPicture[]): ExportModel => ({ sheetName: 'Quotation', columns: COLUMNS, rows, pictures, pictureColumn: 'C' });

/** What ExcelJS reads back of a picture anchored at one corner: where it starts and how large it is (its typings name only the two-corner form). */
const anchoredSchema = z.object({ range: z.object({ tl: z.object({ col: z.number(), row: z.number() }), ext: z.object({ width: z.number(), height: z.number() }) }) });

async function imagesOf(bytes: Uint8Array) {
  const sheet = (await loadWorkbook(bytes)).getWorksheet('Quotation');
  if (sheet === undefined) throw new Error('No sheet.');
  return { sheet, images: sheet.getImages().map((image) => anchoredSchema.parse(image)) };
}

describe('AC-4: the picture is embedded in column C of its own row', () => {
  it('anchors each picture in the cell of column C of its row, and a row with none has no picture and an empty cell', async () => {
    const bytes = await buildWorkbook(
      model(
        [
          { cells: { A: '1', B: 'First', C: null }, picture: 0 },
          { cells: { A: '2', B: 'Second', C: null }, picture: null },
          { cells: { A: '3', B: 'Third', C: null }, picture: 1 },
          { cells: { A: '4', B: 'Fourth', C: null } },
        ],
        [picture('png', pngOfDimensions(400, 200)), picture('jpeg', jpegOfDimensions(300, 300))],
      ),
    );
    const { sheet, images } = await imagesOf(bytes);
    expect(images).toHaveLength(2);
    const places = images.map((image) => ({ col: Math.floor(image.range.tl.col), row: Math.floor(image.range.tl.row) }));
    // Zero-based: column C is 2, and the rows of the first and third parts are rows 2 and 4 of the sheet.
    expect(places).toEqual([
      { col: columnLetterToIndex('C') - 1, row: 1 },
      { col: columnLetterToIndex('C') - 1, row: 3 },
    ]);
    for (const address of ['C2', 'C3', 'C4', 'C5']) expect(sheet.getCell(address).value).toBeNull();
  });

  it('scales a wide picture to the cell\'s width and a tall one to its height, keeping the proportions, and never above its own size', async () => {
    const bytes = await buildWorkbook(
      model(
        [
          { cells: { A: '1' }, picture: 0 },
          { cells: { A: '2' }, picture: 1 },
          { cells: { A: '3' }, picture: 2 },
        ],
        [picture('png', pngOfDimensions(2000, 500)), picture('gif', gifOfDimensions(100, 800)), picture('jpeg', jpegOfDimensions(20, 10))],
      ),
    );
    const { images } = await imagesOf(bytes);
    const [wide, tall, small] = images.map((image) => image.range.ext);
    expect(wide?.width).toBeLessThanOrEqual(CELL_WIDTH_PX);
    expect(wide?.height).toBeLessThanOrEqual(CELL_HEIGHT_PX);
    expect((wide?.width ?? 0) / (wide?.height ?? 1)).toBeCloseTo(4, 1);
    expect(tall?.height).toBeLessThanOrEqual(CELL_HEIGHT_PX);
    expect((tall?.width ?? 0) / (tall?.height ?? 1)).toBeCloseTo(100 / 800, 1);
    expect(small).toEqual({ width: 20, height: 10 });
  });

  it('fills the cell when the picture\'s size cannot be read, rather than leaving the cell without its picture', async () => {
    const unreadable = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
    const { images } = await imagesOf(await buildWorkbook(model([{ cells: { A: '1' }, picture: 0 }], [picture('jpeg', unreadable)])));
    const ext = images[0]?.range.ext;
    expect(ext?.width).toBeLessThanOrEqual(CELL_WIDTH_PX);
    expect(ext?.height).toBeLessThanOrEqual(CELL_HEIGHT_PX);
    expect(ext?.width).toBeGreaterThan(CELL_WIDTH_PX - 10);
  });

  it('gives a row with a picture a height the picture can be seen at, and leaves the other rows at the default', async () => {
    const { sheet } = await imagesOf(await buildWorkbook(model([{ cells: { A: '1' }, picture: 0 }, { cells: { A: '2' } }], [picture('png', pngOfDimensions(10, 10))])));
    expect(sheet.getRow(2).height).toBe(75);
    expect(sheet.getRow(3).height).toBeUndefined();
  });

  it('writes a picture used by two rows once, and anchors it twice', async () => {
    const bytes = await buildWorkbook(model([{ cells: { A: '1' }, picture: 0 }, { cells: { A: '2' }, picture: 0 }], [picture('png', pngOfDimensions(64, 64))]));
    expect(mediaOf(bytes)).toHaveLength(1);
    expect((await imagesOf(bytes)).images).toHaveLength(2);
  });

  it('stores the three kinds as their own media files', async () => {
    const bytes = await buildWorkbook(
      model(
        [
          { cells: { A: '1' }, picture: 0 },
          { cells: { A: '2' }, picture: 1 },
          { cells: { A: '3' }, picture: 2 },
        ],
        [picture('png', pngOfDimensions(8, 8)), picture('jpeg', jpegOfDimensions(8, 8)), picture('gif', gifOfDimensions(8, 8))],
      ),
    );
    expect(mediaOf(bytes).map((name) => name.split('.').pop()).sort()).toEqual(['gif', 'jpeg', 'png']);
  });

  it('is a file with no drawing at all when no row has a picture', async () => {
    const bytes = await buildWorkbook({ sheetName: 'Quotation', columns: COLUMNS, rows: [{ cells: { A: '1' }, picture: null }] });
    expect([...readXlsxParts(bytes).keys()].some((name) => name.startsWith('xl/drawings/') || name.startsWith('xl/media/'))).toBe(false);
  });

  it('refuses a row whose picture the model does not hold', async () => {
    await expect(buildWorkbook(model([{ cells: { A: '1' }, picture: 3 }], [picture('png', pngOfDimensions(8, 8))]))).rejects.toThrow('The model has no picture at place 3.');
  });
});

describe('the model\'s schema holds the pictures to the same rules (the thread reads the model through it)', () => {
  const good = model([{ cells: { A: '1' }, picture: 0 }], [picture('png', pngOfDimensions(8, 8))]);

  it('accepts a model with pictures, and one without', () => {
    expect(exportModelSchema.safeParse(good).success).toBe(true);
    expect(exportModelSchema.safeParse({ sheetName: 'Quotation', columns: COLUMNS, rows: [{ cells: { A: '1' } }] }).success).toBe(true);
  });

  it.each([
    ['a row that names a picture the model does not hold', { ...good, rows: [{ cells: { A: '1' }, picture: 1 }] }],
    ['a picture with no column to go in', { ...good, pictureColumn: undefined }],
    ['a picture of a kind a workbook cannot hold', { ...good, pictures: [{ extension: 'webp', bytes: new Uint8Array(4) }] }],
    ['a picture whose bytes are text', { ...good, pictures: [{ extension: 'png', bytes: 'not bytes' }] }],
    ['a key the model does not name', { ...good, macro: 'x' }],
  ])('refuses %s', (_name, data) => {
    expect(exportModelSchema.safeParse(data).success).toBe(false);
  });
});

describe('AC-8 (NFR-010): 50 parts with 50 pictures of 199 KB', () => {
  it('builds in process well inside the 10 s line, and the file holds every picture; the time is printed for the pull request', async () => {
    const SIZE = 199 * 1024;
    // Fifty distinct files whose filler is random, as a photograph is: it does not compress, so the file is as large as a real one and the time is not flattered.
    const pictures = Array.from({ length: 50 }, (_, index) => {
      const bytes = new Uint8Array(pngOfDimensions(800 + index, 600, SIZE));
      randomFillSync(bytes, 60, bytes.length - 80);
      return picture('png', bytes);
    });
    const rows = pictures.map((_, index) => ({ cells: { A: String(index + 1), B: `Part ${String(index + 1)}`, C: null }, picture: index }));
    const started = performance.now();
    const bytes = await buildWorkbook(model(rows, pictures));
    const seconds = (performance.now() - started) / 1000;
    process.stdout.write(`STORY-07.02 AC-8: 50 parts with 50 pictures of 199 KB built in ${seconds.toFixed(2)} s, a file of ${(bytes.byteLength / 1_048_576).toFixed(1)} MB.\n`);
    expect(mediaOf(bytes)).toHaveLength(50);
    // The 10 s line of AC-8 is measured by `tests/perf/export-memory.test.ts` on a quiet machine without coverage, and its formal gate is STORY-07.05's. The combined coverage run of CI slows ExcelJS several times over, so this ceiling only catches a build that has become many times slower.
    expect(seconds).toBeLessThan(LOOSE_BOUND_SECONDS);
  }, 120_000);
});
