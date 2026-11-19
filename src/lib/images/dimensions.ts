/**
 * The size of a picture in pixels, read from the first bytes of its file and nothing else (STORY-07.02 AC-4: the export scales a picture to fit its cell, so it needs the picture's proportions).
 * Like `signature.ts` it **never decodes** a file: only the header of each kind is read (the PNG header chunk, the GIF screen descriptor, the first JPEG start-of-frame segment), so a crafted
 * picture cannot reach an image library. A header that is cut short, or holds a size of 0, answers `null` and the caller fills the whole cell instead. Pure, free of Node and browser APIs.
 */

import { assertNever } from '../assert-never';

export type DimensionsKind = 'png' | 'jpeg' | 'gif';

export interface PictureDimensions {
  readonly width: number;
  readonly height: number;
}

/** PNG: the 8 signature bytes, then the length (4) and the name (4) of the first chunk, then width and height as 32-bit big-endian numbers. */
const PNG_WIDTH_AT = 16;
const PNG_HEIGHT_AT = 20;
const PNG_HEADER_LENGTH = 24;

/** GIF: `GIF89a`, then width and height as 16-bit little-endian numbers. */
const GIF_WIDTH_AT = 6;
const GIF_HEIGHT_AT = 8;
const GIF_HEADER_LENGTH = 10;

const JPEG_MARKER_START = 0xff;
/** After the start of image (`FF D8`) the segments begin. */
const JPEG_FIRST_SEGMENT_AT = 2;
const JPEG_STANDALONE_MIN = 0xd0; // RSTn
const JPEG_STANDALONE_MAX = 0xd9; // up to and with EOI
const JPEG_TEM = 0x01;
/** The start-of-frame markers, which carry the size: C0 to CF except C4 (huffman table), C8 (reserved) and CC (arithmetic conditioning). */
const JPEG_FRAME_MIN = 0xc0;
const JPEG_FRAME_MAX = 0xcf;
const JPEG_NOT_FRAMES: ReadonlyArray<number> = [0xc4, 0xc8, 0xcc];
/** A frame segment: marker (2), length (2), precision (1), height (2), width (2). */
const JPEG_FRAME_MIN_LENGTH = 9;

const pictureSize = (width: number, height: number): PictureDimensions | null => (width > 0 && height > 0 ? { width, height } : null);

const readUInt32BE = (bytes: Uint8Array, at: number): number => ((bytes[at] ?? 0) * 0x1000000) + ((bytes[at + 1] ?? 0) << 16) + ((bytes[at + 2] ?? 0) << 8) + (bytes[at + 3] ?? 0);
const readUInt16BE = (bytes: Uint8Array, at: number): number => ((bytes[at] ?? 0) << 8) + (bytes[at + 1] ?? 0);
const readUInt16LE = (bytes: Uint8Array, at: number): number => (bytes[at] ?? 0) + ((bytes[at + 1] ?? 0) << 8);

function jpegDimensions(bytes: Uint8Array): PictureDimensions | null {
  let at = JPEG_FIRST_SEGMENT_AT;
  while (at + 1 < bytes.length) {
    if (bytes[at] !== JPEG_MARKER_START) return null;
    const marker = bytes[at + 1] ?? 0;
    // A run of 0xFF bytes is padding before a marker.
    if (marker === JPEG_MARKER_START) {
      at += 1;
      continue;
    }
    if (marker === JPEG_TEM || (marker >= JPEG_STANDALONE_MIN && marker <= JPEG_STANDALONE_MAX)) {
      at += 2;
      continue;
    }
    if (marker >= JPEG_FRAME_MIN && marker <= JPEG_FRAME_MAX && !JPEG_NOT_FRAMES.includes(marker)) {
      if (at + JPEG_FRAME_MIN_LENGTH > bytes.length) return null;
      return pictureSize(readUInt16BE(bytes, at + 7), readUInt16BE(bytes, at + 5));
    }
    // Any other segment: its length counts the two length bytes and not the marker.
    const length = readUInt16BE(bytes, at + 2);
    if (length < 2) return null;
    at += 2 + length;
  }
  return null;
}

/** The pixel size the header of a PNG, JPEG or GIF names, or `null` when the header is cut short or names no size. */
export function dimensionsOf(bytes: Uint8Array, kind: DimensionsKind): PictureDimensions | null {
  switch (kind) {
    case 'png':
      return bytes.length < PNG_HEADER_LENGTH ? null : pictureSize(readUInt32BE(bytes, PNG_WIDTH_AT), readUInt32BE(bytes, PNG_HEIGHT_AT));
    case 'gif':
      return bytes.length < GIF_HEADER_LENGTH ? null : pictureSize(readUInt16LE(bytes, GIF_WIDTH_AT), readUInt16LE(bytes, GIF_HEIGHT_AT));
    case 'jpeg':
      return jpegDimensions(bytes);
    default:
      return assertNever(kind, 'picture kind');
  }
}

