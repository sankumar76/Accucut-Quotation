/**
 * What kind of picture a file is, judged by its **content** and nothing else (STORY-05.07 AC-2, NFR-005; ADR-013; architecture section 8 "Input validation"). The name, the
 * `Content-Type` a browser sent and the extension are never read: a text file renamed `.png` and a PNG called `.txt` are told apart by their bytes. No dependency, and the file
 * is **never decoded**: only its first and last few bytes are read, so a crafted picture cannot reach an image library.
 *
 * Four kinds are accepted (PNG, JPEG, GIF, WebP). SVG is not: it is a scripted document, not a picture. A file is accepted only when it **starts and ends as that kind of
 * file does**, so a real picture with a page or a script appended to it (a polyglot) is refused, and not only a file whose first bytes are wrong:
 *   - PNG: the eight signature bytes, then the `IHDR` chunk of 13 bytes, and the file ends with the 12 bytes of the `IEND` chunk;
 *   - JPEG: `FF D8 FF`, and the last two bytes are the end of image `FF D9` (a run of zero bytes after it, which some cameras write, is allowed and nothing else);
 *   - GIF: `GIF87a` or `GIF89a`, and the last byte is the trailer `3B`;
 *   - WebP: `RIFF`, a size that matches the file exactly, `WEBP`, and a first chunk that is `VP8 `, `VP8L` or `VP8X`.
 * As a second guard, a file that holds the opening of a page, a script or an SVG anywhere in it is refused, whatever it starts and ends with.
 *
 * Pure and free of Node and browser APIs, so the server (the judge) and the browser (a quick answer before the upload) read one rule.
 */

export const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
export type ImageMime = (typeof IMAGE_MIMES)[number];

const ASCII = (text: string): ReadonlyArray<number> => Array.from(text, (character) => character.charCodeAt(0));

const PNG_SIGNATURE: ReadonlyArray<number> = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** The length of the `IHDR` data (13) as a big-endian number, then the chunk's name. */
const PNG_HEADER_CHUNK: ReadonlyArray<number> = [0x00, 0x00, 0x00, 0x0d, ...ASCII('IHDR')];
/** The whole `IEND` chunk: a length of 0, its name and its fixed checksum. */
const PNG_END_CHUNK: ReadonlyArray<number> = [0x00, 0x00, 0x00, 0x00, ...ASCII('IEND'), 0xae, 0x42, 0x60, 0x82];
const PNG_MIN_LENGTH = PNG_SIGNATURE.length + 25 + PNG_END_CHUNK.length;

const JPEG_START: ReadonlyArray<number> = [0xff, 0xd8, 0xff];
const JPEG_END: ReadonlyArray<number> = [0xff, 0xd9];
const JPEG_MIN_LENGTH = JPEG_START.length + JPEG_END.length;

const GIF_87: ReadonlyArray<number> = ASCII('GIF87a');
const GIF_89: ReadonlyArray<number> = ASCII('GIF89a');
const GIF_TRAILER = 0x3b;
/** The header, the screen descriptor and the trailer. */
const GIF_MIN_LENGTH = 6 + 7 + 1;

const RIFF = ASCII('RIFF');
const WEBP = ASCII('WEBP');
const WEBP_CHUNKS: ReadonlyArray<ReadonlyArray<number>> = [ASCII('VP8 '), ASCII('VP8L'), ASCII('VP8X')];
const WEBP_HEADER_LENGTH = 12;
const WEBP_MIN_LENGTH = WEBP_HEADER_LENGTH + 8;
/** What the RIFF size leaves out: the word `RIFF` and the size itself. */
const RIFF_SIZE_OFFSET = 8;

/** The opening of a page, a script or an SVG, in any letter case: no picture holds one, and a polyglot does. */
const SCRIPT_MARKERS: ReadonlyArray<ReadonlyArray<number>> = ['<script', '<svg', '<html', '<iframe', '<!doctype', '<?xml'].map(ASCII);

const lower = (byte: number): number => (byte >= 0x41 && byte <= 0x5a ? byte + 0x20 : byte);

function matchesAt(bytes: Uint8Array, signature: ReadonlyArray<number>, at: number): boolean {
  if (at < 0 || at + signature.length > bytes.length) return false;
  return signature.every((byte, index) => bytes[at + index] === byte);
}

function endsWith(bytes: Uint8Array, signature: ReadonlyArray<number>): boolean {
  return matchesAt(bytes, signature, bytes.length - signature.length);
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= PNG_MIN_LENGTH && matchesAt(bytes, PNG_SIGNATURE, 0) && matchesAt(bytes, PNG_HEADER_CHUNK, PNG_SIGNATURE.length) && endsWith(bytes, PNG_END_CHUNK);
}

function isJpeg(bytes: Uint8Array): boolean {
  if (bytes.length < JPEG_MIN_LENGTH || !matchesAt(bytes, JPEG_START, 0)) return false;
  let end = bytes.length;
  while (end > JPEG_MIN_LENGTH && bytes[end - 1] === 0) end -= 1;
  return matchesAt(bytes, JPEG_END, end - JPEG_END.length);
}

function isGif(bytes: Uint8Array): boolean {
  return bytes.length >= GIF_MIN_LENGTH && (matchesAt(bytes, GIF_87, 0) || matchesAt(bytes, GIF_89, 0)) && bytes[bytes.length - 1] === GIF_TRAILER;
}

function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < WEBP_MIN_LENGTH || !matchesAt(bytes, RIFF, 0) || !matchesAt(bytes, WEBP, 8)) return false;
  // The RIFF size is a little-endian number that counts everything after itself, so it must be the file's length less the eight bytes before it.
  const size = (bytes[4] ?? 0) + (bytes[5] ?? 0) * 0x100 + (bytes[6] ?? 0) * 0x10000 + (bytes[7] ?? 0) * 0x1000000;
  return size === bytes.length - RIFF_SIZE_OFFSET && WEBP_CHUNKS.some((chunk) => matchesAt(bytes, chunk, WEBP_HEADER_LENGTH));
}

/** True when the bytes hold the opening of a page, a script or an SVG anywhere, ignoring letter case. */
export function holdsScriptMarker(bytes: Uint8Array): boolean {
  const first = new Set(SCRIPT_MARKERS.map((marker) => marker[0]));
  for (let at = 0; at < bytes.length; at += 1) {
    if (!first.has(bytes[at])) continue;
    if (SCRIPT_MARKERS.some((marker) => marker.every((byte, index) => lower(bytes[at + index] ?? 0) === byte))) return true;
  }
  return false;
}

/** The kind of picture these bytes are, or `null` when they are none of the four kinds, are cut short, or have anything appended. */
export function detectImageType(bytes: Uint8Array): ImageMime | null {
  let kind: ImageMime | null = null;
  if (isPng(bytes)) kind = 'image/png';
  else if (isJpeg(bytes)) kind = 'image/jpeg';
  else if (isGif(bytes)) kind = 'image/gif';
  else if (isWebp(bytes)) kind = 'image/webp';
  return kind !== null && !holdsScriptMarker(bytes) ? kind : null;
}

/** True for one of the four types a picture is stored and served with. The database holds the same list (a CHECK on `part_images.mime`). */
export function isImageMime(value: string): value is ImageMime {
  return IMAGE_MIMES.some((mime) => mime === value);
}
