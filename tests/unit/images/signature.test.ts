import { describe, expect, it } from 'vitest';

import { detectImageType, holdsScriptMarker, isImageMime } from '@/lib/images/signature';
import { checkPicture, MAX_PICTURE_BYTES } from '@/lib/images/picture-rules';

import { jpegOfSize, PLAIN_TEXT, pngOfSize, SCRIPT_TAIL, smallGif, smallJpeg, smallPng, smallWebp, SVG_TEXT, webpOfSize } from '../../support/pictures';

/**
 * STORY-05.07 T1 (AC-2, NFR-005, ADR-013): the type of a picture is decided by its content. The magic-byte table for the four kinds, the files that must be refused (a text
 * file renamed `.png`, an SVG, an empty file, a cut-short file, a picture with a script appended: a polyglot), and the limit to the byte. Every file is built from invented
 * bytes (`tests/support/pictures.ts`); nothing is a real photograph.
 */

const KB = 1024;

describe('the four kinds are found by their content (AC-2)', () => {
  it.each([
    ['PNG', smallPng(), 'image/png'],
    ['JPEG', smallJpeg(), 'image/jpeg'],
    ['GIF', smallGif(), 'image/gif'],
    ['WebP', smallWebp(), 'image/webp'],
  ] as const)('%s', (_name, bytes, mime) => {
    expect(detectImageType(bytes)).toBe(mime);
  });

  it('accepts the other spelling of the GIF header (GIF87a) and a JPEG with zero bytes after its end', () => {
    const gif87 = Buffer.from(smallGif());
    gif87.write('GIF87a', 0, 'ascii');
    expect(detectImageType(gif87)).toBe('image/gif');
    expect(detectImageType(Buffer.concat([smallJpeg(), Buffer.alloc(8)]))).toBe('image/jpeg');
  });

  it('does not read the name or the declared type: only the bytes (a PNG is a PNG whatever it is called)', () => {
    expect(detectImageType(smallPng())).toBe('image/png');
    expect(detectImageType(PLAIN_TEXT)).toBeNull();
  });
});

describe('what is refused (AC-2)', () => {
  it.each([
    ['a text file renamed .png', PLAIN_TEXT],
    ['an SVG', SVG_TEXT],
    ['a file of 0 bytes', Buffer.alloc(0)],
    ['a single byte', Buffer.from([0x89])],
    ['a PDF', Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n', 'ascii')],
    ['a BMP', Buffer.concat([Buffer.from('BM', 'ascii'), Buffer.alloc(60)])],
    ['a Windows program', Buffer.concat([Buffer.from('MZ', 'ascii'), Buffer.alloc(80)])],
  ])('%s', (_name, bytes) => {
    expect(detectImageType(bytes)).toBeNull();
  });

  it('refuses a picture that is cut short, whatever its start says', () => {
    const png = smallPng();
    expect(detectImageType(png.subarray(0, png.length - 1))).toBeNull();
    expect(detectImageType(png.subarray(0, 20))).toBeNull();
    const jpeg = smallJpeg();
    expect(detectImageType(jpeg.subarray(0, jpeg.length - 2))).toBeNull();
    const gif = smallGif();
    expect(detectImageType(gif.subarray(0, gif.length - 1))).toBeNull();
    const webp = smallWebp();
    expect(detectImageType(webp.subarray(0, webp.length - 2))).toBeNull();
  });

  it('refuses a WebP whose size does not match the file, or whose first chunk is not a picture', () => {
    const longer = Buffer.concat([smallWebp(), Buffer.from([0, 0])]);
    expect(detectImageType(longer)).toBeNull();
    const unnamed = Buffer.from(smallWebp());
    unnamed.write('XXXX', 12, 'ascii');
    expect(detectImageType(unnamed)).toBeNull();
  });

  it('refuses a PNG whose first chunk is not the header', () => {
    const png = Buffer.from(smallPng());
    png.write('IDAT', 12, 'ascii');
    expect(detectImageType(png)).toBeNull();
  });
});

describe('polyglots: a real picture with something appended or hidden in it (AC-2, NFR-005)', () => {
  it.each([
    ['a PNG with a script after its end', Buffer.concat([smallPng(), SCRIPT_TAIL])],
    ['a JPEG with a script after its end', Buffer.concat([smallJpeg(), SCRIPT_TAIL])],
    ['a GIF with a script after its end', Buffer.concat([smallGif(), SCRIPT_TAIL])],
    ['a WebP with a script after its end', Buffer.concat([smallWebp(), SCRIPT_TAIL])],
    ['a GIF header followed by an SVG', Buffer.concat([Buffer.from('GIF89a', 'ascii'), SVG_TEXT, Buffer.from([0x3b])])],
  ])('%s is refused', (_name, bytes) => {
    expect(detectImageType(bytes)).toBeNull();
  });

  it('refuses a file that starts and ends as a PNG does but holds a page inside, in any letter case', () => {
    expect(detectImageType(pngOfSize(200))).toBe('image/png');
    for (const marker of ['<script>', '<SCRIPT src=x>', '<Svg onload=x>', '<html>', '<iframe>', '<!DOCTYPE html>', '<?xml version="1.0"?>']) {
      const hidden = Buffer.from(smallPng());
      const withMarker = Buffer.concat([hidden.subarray(0, hidden.length - 12), Buffer.from(marker, 'ascii'), hidden.subarray(hidden.length - 12)]);
      expect(detectImageType(withMarker), marker).toBeNull();
    }
  });

  it('finds a marker anywhere and ignores near misses', () => {
    expect(holdsScriptMarker(Buffer.from('xxxx<ScRiPt', 'ascii'))).toBe(true);
    expect(holdsScriptMarker(Buffer.from('<scrip', 'ascii'))).toBe(false);
    expect(holdsScriptMarker(Buffer.from('script', 'ascii'))).toBe(false);
    expect(holdsScriptMarker(Buffer.alloc(0))).toBe(false);
  });
});

describe('the size limit is strictly under 200 x 1024 bytes (AC-2, NFR-005, A-06)', () => {
  it('has the limit at 204,800 bytes', () => {
    expect(MAX_PICTURE_BYTES).toBe(204_800);
  });

  it('accepts a PNG of 199 KB and of 204,799 bytes', () => {
    expect(checkPicture('p.png', pngOfSize(199 * KB))).toEqual({ ok: true, mime: 'image/png' });
    expect(checkPicture('p.png', pngOfSize(MAX_PICTURE_BYTES - 1))).toEqual({ ok: true, mime: 'image/png' });
  });

  it('refuses 200 KB exactly (204,800 bytes) and 201 KB as too large, with the SCR-05 words and nothing stored', () => {
    const exact = checkPicture('cabinet-photo.png', pngOfSize(MAX_PICTURE_BYTES));
    expect(exact).toEqual({ ok: false, status: 413, code: 'PICTURE_TOO_LARGE', message: '"cabinet-photo.png" is 200 KB. Pictures must be under 200 KB. Choose a smaller picture.' });
    const over = checkPicture('cabinet-photo.png', pngOfSize(201 * KB));
    expect(over).toEqual({ ok: false, status: 413, code: 'PICTURE_TOO_LARGE', message: '"cabinet-photo.png" is 201 KB. Pictures must be under 200 KB. Choose a smaller picture.' });
  });

  it('names a size rounded up, so a file over the limit is never called 200 KB when it is 204,801 bytes', () => {
    const result = checkPicture('a.png', pngOfSize(MAX_PICTURE_BYTES + 1));
    expect(result).toMatchObject({ ok: false, message: '"a.png" is 201 KB. Pictures must be under 200 KB. Choose a smaller picture.' });
  });

  it('accepts a JPEG of 199 KB and refuses one of 201 KB by size', () => {
    expect(checkPicture('p.jpg', jpegOfSize(199 * KB))).toEqual({ ok: true, mime: 'image/jpeg' });
    expect(checkPicture('p.jpg', jpegOfSize(201 * KB))).toMatchObject({ ok: false, status: 413 });
  });

  it('refuses a text file, an SVG and an empty file as the wrong type, with the SCR-05 words', () => {
    for (const bytes of [PLAIN_TEXT, SVG_TEXT, Buffer.alloc(0)]) {
      expect(checkPicture('x.png', bytes)).toEqual({ ok: false, status: 415, code: 'PICTURE_TYPE_REFUSED', message: 'Only PNG, JPG, GIF or WebP pictures are accepted.' });
    }
  });

  it('refuses a WebP as the wrong type, in the existing words (DL-237, OQ-PM-10): the browser converts it before it is sent, and the server never stores one; the kind is still found', () => {
    expect(detectImageType(smallWebp())).toBe('image/webp');
    expect(checkPicture('front.webp', smallWebp())).toEqual({ ok: false, status: 415, code: 'PICTURE_TYPE_REFUSED', message: 'Only PNG, JPG, GIF or WebP pictures are accepted.' });
    expect(checkPicture('front.png', webpOfSize(100 * KB))).toMatchObject({ ok: false, status: 415, code: 'PICTURE_TYPE_REFUSED' });
  });

  it('judges the size of a WebP first: one of 204,800 bytes is "too large" (413) and one of 204,798 is the wrong type (415)', () => {
    expect(checkPicture('front.webp', webpOfSize(204_800))).toMatchObject({ ok: false, status: 413, code: 'PICTURE_TOO_LARGE' });
    expect(checkPicture('front.webp', webpOfSize(204_798))).toMatchObject({ ok: false, status: 415, code: 'PICTURE_TYPE_REFUSED' });
  });

  it('judges the size before the content: a large text file is "too large"', () => {
    expect(checkPicture('x.png', Buffer.alloc(MAX_PICTURE_BYTES, 0x61))).toMatchObject({ ok: false, status: 413 });
  });
});

describe('the helpers of the tests make the sizes they say', () => {
  it('makes a PNG and a JPEG of an exact size', () => {
    for (const size of [200, 1000, 70_000, 199 * KB, 204_800, 262_144]) {
      expect(pngOfSize(size).length).toBe(size);
      expect(jpegOfSize(size).length).toBe(size);
    }
  });

  it('knows the four stored types', () => {
    expect(['image/png', 'image/jpeg', 'image/gif', 'image/webp'].every(isImageMime)).toBe(true);
    expect(isImageMime('image/svg+xml')).toBe(false);
    expect(isImageMime('text/html')).toBe(false);
  });
});
