import { describe, expect, it } from 'vitest';

import { dimensionsOf } from '@/lib/images/dimensions';

import { gifOfDimensions, jpegOfDimensions, pngOfDimensions, smallGif, smallJpeg, smallPng } from '../../support/pictures';

/**
 * The size of a picture, read from its first bytes (STORY-07.02 AC-4: "scaled to fit the cell" needs the picture's proportions). Nothing is decoded: only the header of each kind is read, as the
 * signature check does, so a crafted file cannot reach an image library. A header that is cut short or holds no size answers `null`, and the file then fills its cell.
 */

describe('dimensionsOf', () => {
  it('reads the width and height of a PNG from its header chunk', () => {
    expect(dimensionsOf(pngOfDimensions(640, 480), 'png')).toEqual({ width: 640, height: 480 });
    expect(dimensionsOf(smallPng(), 'png')).toEqual({ width: 1, height: 1 });
  });

  it('reads a GIF from its screen descriptor, both numbers little-endian', () => {
    expect(dimensionsOf(gifOfDimensions(300, 120), 'gif')).toEqual({ width: 300, height: 120 });
    expect(dimensionsOf(smallGif(), 'gif')).toEqual({ width: 1, height: 1 });
  });

  it('reads a JPEG from its first start-of-frame segment, past the segments before it', () => {
    expect(dimensionsOf(jpegOfDimensions(1024, 768), 'jpeg')).toEqual({ width: 1024, height: 768 });
  });

  it('answers null for a JPEG that has no frame segment, a segment that runs past the end, or a stray byte', () => {
    expect(dimensionsOf(smallJpeg(), 'jpeg')).toBeNull();
    expect(dimensionsOf(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff, 0x00]), 'jpeg')).toBeNull();
    expect(dimensionsOf(Uint8Array.from([0xff, 0xd8, 0x00, 0x00, 0x00, 0x00]), 'jpeg')).toBeNull();
  });

  it.each([
    ['a PNG cut short', Uint8Array.from([0x89, 0x50, 0x4e, 0x47]), 'png'],
    ['a GIF cut short', Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01]), 'gif'],
    ['a PNG whose width is 0', pngOfDimensions(0, 10), 'png'],
    ['a GIF whose height is 0', gifOfDimensions(10, 0), 'gif'],
    ['nothing at all', new Uint8Array(0), 'jpeg'],
  ] as const)('answers null for %s', (_name, bytes, extension) => {
    expect(dimensionsOf(bytes, extension)).toBeNull();
  });
});
