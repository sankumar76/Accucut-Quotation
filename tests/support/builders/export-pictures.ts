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

/** One picture of `size` bytes. The `index` only varies the dimensions the header names, so no two pictures are the same shape; the filler is different every time. */
export function incompressiblePicture(index: number, size: number = PERF_PICTURE_BYTES): Uint8Array {
  const bytes = new Uint8Array(pngOfDimensions(800 + (index % 200), 600, size));
  randomFillSync(bytes, KEEP_AT_START, bytes.length - KEEP_AT_START - KEEP_AT_END);
  return bytes;
}
