import { createHash } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';

/**
 * Tiny pictures made from bytes, for the tests of the picture upload (STORY-05.07). Nothing here is a real photograph and nothing is read from disk: each file is built from
 * a few invented bytes, and `padded` adds an ancillary chunk (PNG), a comment segment (JPEG) or a comment extension (GIF) of filler to reach an exact size, so the limit of
 * 200 x 1024 bytes can be tested to the byte. The files are well formed as far as the signature check reads them; they are never decoded.
 */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_CHUNK_OVERHEAD = 12;

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

/** A 1 x 1 PNG of one grey pixel, whole and well formed. */
function basePng(extra: Buffer = Buffer.alloc(0)): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(0, 9); // greyscale
  return Buffer.concat([PNG_SIGNATURE, pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(Buffer.from([0x00, 0x80]))), extra, pngChunk('IEND', Buffer.alloc(0))]);
}

/** A PNG of exactly `size` bytes (at least the size of the smallest one, about 70). */
export function pngOfSize(size: number): Buffer {
  const smallest = basePng().length;
  if (size === smallest) return basePng();
  if (size < smallest + PNG_CHUNK_OVERHEAD) throw new Error(`The smallest padded PNG is ${String(smallest + PNG_CHUNK_OVERHEAD)} bytes.`);
  return basePng(pngChunk('prVt', Buffer.alloc(size - smallest - PNG_CHUNK_OVERHEAD, 0x61)));
}

export const smallPng = (): Buffer => basePng();

const JPEG_START = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
const JPEG_END = [0xff, 0xd9];
const JPEG_COMMENT_OVERHEAD = 4;
const JPEG_MAX_SEGMENT = 0xffff;

/** A JPEG made of its start of image, a JFIF header, comment segments of filler and its end of image: `size` bytes in all. */
export function jpegOfSize(size: number): Buffer {
  const fixed = JPEG_START.length + JPEG_END.length;
  let filler = size - fixed;
  if (filler !== 0 && filler < JPEG_COMMENT_OVERHEAD) throw new Error('A padded JPEG is at least 26 bytes.');
  const parts: Buffer[] = [Buffer.from(JPEG_START)];
  while (filler > 0) {
    const segment = Math.min(filler, JPEG_MAX_SEGMENT + 2);
    // A segment is FF FE, a length that counts itself and the filler, and the filler; a remainder under 4 bytes is added to the last segment instead of left over.
    const take = filler - segment > 0 && filler - segment < JPEG_COMMENT_OVERHEAD ? segment - JPEG_COMMENT_OVERHEAD : segment;
    const comment = Buffer.alloc(take, 0x61);
    comment[0] = 0xff;
    comment[1] = 0xfe;
    comment.writeUInt16BE(take - 2, 2);
    parts.push(comment);
    filler -= take;
  }
  parts.push(Buffer.from(JPEG_END));
  return Buffer.concat(parts);
}

export const smallJpeg = (): Buffer => jpegOfSize(40);

/** A 1 x 1 GIF (the well-known 35 byte one). */
export const smallGif = (): Buffer => Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/** A 1 x 1 lossless WebP (34 bytes). */
export const smallWebp = (): Buffer => Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');

/** The words of a scripted page that no picture holds: appended to a real file, they make a polyglot the check must refuse. */
export const SCRIPT_TAIL = Buffer.from('<script>alert(1)</script>', 'ascii');
export const SVG_TEXT = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><script>alert(1)</script></svg>', 'ascii');
export const PLAIN_TEXT = Buffer.from('This is not a picture, only a text file renamed.\n', 'ascii');

/** The SHA-256 of some bytes as lower-case hex, as the picture table stores it. */
export const sha256Hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** The hash of `smallPng()`, the one canary picture of the harness and of the E2E database. */
export const CANARY_PICTURE_HASH = sha256Hex(smallPng());

/** A blob of these bytes (copied, so it owns a plain buffer whatever the bytes were read into). */
export const blobOf = (bytes: Uint8Array, type = ''): Blob => new Blob([new Uint8Array(bytes)], { type });

/** One multipart form with one file, as a browser sends it, for a request body. */
export function uploadForm(bytes: Uint8Array, fileName = 'invented-part.png', type = 'image/png', field = 'file'): FormData {
  const form = new FormData();
  form.append(field, new File([new Uint8Array(bytes)], fileName, { type }));
  return form;
}
