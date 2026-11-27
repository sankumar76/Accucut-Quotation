import { randomFillSync } from 'node:crypto';

import { pngOfDimensions } from '../pictures';

/**
 * The invented pictures of the export timings (STORY-07.05; NFR-010): a PNG of the size of the largest picture the portal accepts as the benchmark used it (199 KB), whose bytes between the opening and
 * the closing chunks are **random**, so the file does not compress, as a photograph does not (a compressible filler would make the workbook, and the time to zip it, smaller than a real one). The signature
 * and the end of the file are as the server's check reads them (`detectImageType`), so the picture is accepted as a real one would be; nothing decodes it. Every byte is invented.
 */

/** The size of a picture in the benchmark of the architecture (section 4.6) and in AC-8 of STORY-07.02. */
export const PERF_PICTURE_BYTES = 199 * 1024;

/** The opening of the PNG (signature and header chunk) and the closing chunk stay as they were; only the filler between them is random. */
const KEEP_AT_START = 60;
const KEEP_AT_END = 80;

const LESS_THAN = 0x3c;
const EQUALS = 0x3d;

/**
 * Writes every `<` of `bytes[from, to)` as `=`. The portal's content check refuses a file that holds the opening of a page, a script or an SVG anywhere in it (`<script`, `<svg`, `<html`...), and random
 * filler holds one by chance (about 1 picture in 2,500: issue 821). Without a `<` there is no such opening, and the filler stays random (one byte value in 256 is taken over by another), so it does not compress.
 */
export function withoutMarkupOpenings(bytes: Uint8Array, from: number, to: number): void {
  for (let at = from; at < to; at += 1) if (bytes[at] === LESS_THAN) bytes[at] = EQUALS;
}

/**
 * One picture of `size` bytes. The `index` only varies the dimensions the header names, so no two pictures are the same shape; the filler is different every time, and it never holds a script marker, so the
 * server's check accepts the picture every time.
 */
export function incompressiblePicture(index: number, size: number = PERF_PICTURE_BYTES): Uint8Array {
  const bytes = new Uint8Array(pngOfDimensions(800 + (index % 200), 600, size));
  const end = bytes.length - KEEP_AT_END;
  randomFillSync(bytes, KEEP_AT_START, end - KEEP_AT_START);
  withoutMarkupOpenings(bytes, KEEP_AT_START, end);
  return bytes;
}
