import { brotliDecompressSync } from 'node:zlib';

/**
 * Reads the character map of a WOFF2 font file, so a test can prove that a shipped font file really holds
 * a glyph (UX-13: the rupee sign U+20B9) instead of trusting the file name. No dependency: WOFF2 keeps the
 * `cmap` table untransformed inside one Brotli stream, so the table directory and Node's own Brotli are
 * enough (https://www.w3.org/TR/WOFF2/).
 */

const WOFF2_SIGNATURE = 0x774f4632; // 'wOF2'
const HEADER_BYTES = 48;
const ARBITRARY_TAG_INDEX = 63;
const TAG_INDEX_MASK = 0x3f;
const TRANSFORM_VERSION_SHIFT = 6;

/** The 63 table tags a WOFF2 directory entry can name by index (W3C WOFF2, section 5.1). */
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep',
  'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE',
  'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt',
  'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar',
  'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
] as const;

export class FontFormatError extends Error {}

interface Cursor {
  offset: number;
}

function readByte(bytes: Uint8Array, cursor: Cursor): number {
  const value = bytes[cursor.offset];
  if (value === undefined) throw new FontFormatError('Unexpected end of the font file.');
  cursor.offset += 1;
  return value;
}

/** A WOFF2 `UIntBase128`: up to five bytes, seven bits each, high bit set while more follow. */
function readBase128(bytes: Uint8Array, cursor: Cursor): number {
  let value = 0;
  for (let index = 0; index < 5; index += 1) {
    const byte = readByte(bytes, cursor);
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  throw new FontFormatError('Invalid UIntBase128 in the table directory.');
}

function readTag(bytes: Uint8Array, cursor: Cursor): string {
  let tag = '';
  for (let index = 0; index < 4; index += 1) tag += String.fromCharCode(readByte(bytes, cursor));
  return tag;
}

/** The decompressed bytes of table `tag`, or `undefined` when the font has no such table. */
function extractTable(file: Uint8Array, wanted: string): Uint8Array | undefined {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (file.byteLength < HEADER_BYTES || view.getUint32(0) !== WOFF2_SIGNATURE) {
    throw new FontFormatError('Not a WOFF2 file.');
  }
  const tableCount = view.getUint16(12);
  const compressedBytes = view.getUint32(20);

  const cursor: Cursor = { offset: HEADER_BYTES };
  const tables: Array<{ tag: string; length: number }> = [];
  for (let index = 0; index < tableCount; index += 1) {
    const flags = readByte(file, cursor);
    const tagIndex = flags & TAG_INDEX_MASK;
    const transformVersion = flags >> TRANSFORM_VERSION_SHIFT;
    const tag = tagIndex === ARBITRARY_TAG_INDEX ? readTag(file, cursor) : KNOWN_TAGS[tagIndex];
    if (tag === undefined) throw new FontFormatError('Unknown table tag index.');
    const originalLength = readBase128(file, cursor);
    // glyf and loca are transformed when the version is 0; every other table when it is not 0.
    const isTransformed = tag === 'glyf' || tag === 'loca' ? transformVersion === 0 : transformVersion !== 0;
    const length = isTransformed ? readBase128(file, cursor) : originalLength;
    tables.push({ tag, length });
  }

  const stream = file.subarray(cursor.offset, cursor.offset + compressedBytes);
  const data = new Uint8Array(brotliDecompressSync(stream));
  let start = 0;
  for (const table of tables) {
    if (table.tag === wanted) return data.subarray(start, start + table.length);
    start += table.length;
  }
  return undefined;
}

function glyphInFormat4(view: DataView, base: number, codePoint: number): boolean {
  const segmentCount = view.getUint16(base + 6) / 2;
  const endCodes = base + 14;
  const startCodes = endCodes + segmentCount * 2 + 2;
  const deltas = startCodes + segmentCount * 2;
  const rangeOffsets = deltas + segmentCount * 2;
  for (let segment = 0; segment < segmentCount; segment += 1) {
    if (view.getUint16(endCodes + segment * 2) < codePoint) continue;
    if (view.getUint16(startCodes + segment * 2) > codePoint) return false;
    const rangeOffset = view.getUint16(rangeOffsets + segment * 2);
    const delta = view.getInt16(deltas + segment * 2);
    if (rangeOffset === 0) return ((codePoint + delta) & 0xffff) !== 0;
    const glyphAddress =
      rangeOffsets + segment * 2 + rangeOffset + (codePoint - view.getUint16(startCodes + segment * 2)) * 2;
    const glyph = view.getUint16(glyphAddress);
    return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0;
  }
  return false;
}

function glyphInFormat12(view: DataView, base: number, codePoint: number): boolean {
  const groupCount = view.getUint32(base + 12);
  for (let group = 0; group < groupCount; group += 1) {
    const at = base + 16 + group * 12;
    if (codePoint >= view.getUint32(at) && codePoint <= view.getUint32(at + 4)) {
      return view.getUint32(at + 8) + (codePoint - view.getUint32(at)) !== 0;
    }
  }
  return false;
}

/** True when the font file maps `codePoint` to a real glyph (not glyph 0, ".notdef"). */
export function woff2HasGlyph(file: Uint8Array, codePoint: number): boolean {
  const cmap = extractTable(file, 'cmap');
  if (cmap === undefined) throw new FontFormatError('The font has no cmap table.');
  const view = new DataView(cmap.buffer, cmap.byteOffset, cmap.byteLength);
  const subtableCount = view.getUint16(2);
  for (let index = 0; index < subtableCount; index += 1) {
    const base = view.getUint32(4 + index * 8 + 4);
    const format = view.getUint16(base);
    if (format === 4 && glyphInFormat4(view, base, codePoint)) return true;
    if (format === 12 && glyphInFormat12(view, base, codePoint)) return true;
  }
  return false;
}
