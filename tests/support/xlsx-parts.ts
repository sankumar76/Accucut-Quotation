import { inflateRawSync } from 'node:zlib';

import ExcelJS from 'exceljs';

/** A workbook read back with ExcelJS. Its typings name an older `Buffer` than the one of this Node's types, so the one cast is here. */
export async function loadWorkbook(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
}

/**
 * The parts of an `.xlsx` file (a zip), read with no library (STORY-07.01 AC-4): the zip-level sanity check of the export's tests looks at the XML ExcelJS wrote, not only at what ExcelJS reads back.
 * It reads the central directory, so it needs no sizes from the local headers (a streamed zip has none there), and it handles the two methods a workbook uses: stored and deflated.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_LENGTH = 22;
const STORED = 0;
const DEFLATED = 8;

export class XlsxFormatError extends Error {}

/** Every file of the zip, by its name inside it, as text. Throws `XlsxFormatError` for bytes that are not a zip of the kind a workbook is. */
export function readXlsxParts(bytes: Uint8Array): ReadonlyMap<string, string> {
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let index = data.length - EOCD_MIN_LENGTH; index >= 0; index -= 1) {
    if (data.readUInt32LE(index) === EOCD_SIGNATURE) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new XlsxFormatError('No end of central directory: not a zip file.');
  const count = data.readUInt16LE(eocd + 10);
  let cursor = data.readUInt32LE(eocd + 16);
  const parts = new Map<string, string>();
  for (let entry = 0; entry < count; entry += 1) {
    if (data.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) throw new XlsxFormatError('A central directory entry is damaged.');
    const method = data.readUInt16LE(cursor + 10);
    const compressedSize = data.readUInt32LE(cursor + 20);
    const nameLength = data.readUInt16LE(cursor + 28);
    const extraLength = data.readUInt16LE(cursor + 30);
    const commentLength = data.readUInt16LE(cursor + 32);
    const localOffset = data.readUInt32LE(cursor + 42);
    const name = data.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    if (data.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) throw new XlsxFormatError(`The local header of ${name} is damaged.`);
    const start = localOffset + 30 + data.readUInt16LE(localOffset + 26) + data.readUInt16LE(localOffset + 28);
    const raw = data.subarray(start, start + compressedSize);
    if (method !== STORED && method !== DEFLATED) throw new XlsxFormatError(`${name} uses an unsupported compression method.`);
    parts.set(name, (method === STORED ? raw : inflateRawSync(raw)).toString('utf8'));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return parts;
}

/**
 * The text of every XML part of a workbook, one after the other, for a scan that looks for a value inside the file (review QS-07 of AQP-331: the text of a workbook is compressed, so a value in it is
 * invisible to a scan of the raw bytes). The pictures are binary and are left out. Throws for bytes that do not start with the `PK` of a zip, so a body that was not a workbook is never scanned as empty.
 */
export function workbookText(bytes: Uint8Array): string {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new XlsxFormatError('The bytes do not start with PK: not a workbook.');
  return [...readXlsxParts(bytes)]
    .filter(([name]) => !name.startsWith('xl/media/'))
    .map(([name, text]) => `<!-- ${name} -->\n${text}`)
    .join('\n');
}

