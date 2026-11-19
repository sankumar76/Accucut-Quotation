import { describe, expect, it, vi } from 'vitest';

import { convertedName, convertWebp, ENCODE_QUALITIES, ENCODE_SCALES, type DecodedPicture } from '@/lib/images/convert-webp';
import { MAX_PICTURE_BYTES } from '@/lib/images/picture-rules';

/**
 * The browser's conversion of a WebP before it is uploaded (STORY-05.07 with AQP-332, SQR-01; delivery lead's decision option A of 2026-11-18): PNG when the picture has transparency, else JPEG, the quality
 * stepped down and then the size, until the result is **under** 200 KB. The server still never decodes a picture (ADR-013) and still accepts what it accepts today. The browser's own decoder and canvas are
 * not here: the test passes a decoder whose encoder answers a size chosen by the test, so the steps taken are seen exactly. Every value is invented.
 */

const webp = (name = 'invented-front.webp', bytes = 5): File => new File([new Uint8Array(bytes)], name, { type: 'image/webp' });

interface Call {
  readonly type: string;
  readonly scale: number;
  readonly quality: number | undefined;
}

/** A decoded picture whose encoder answers `sizeOf(call)` bytes (or null), and which records what it was asked. */
function decoded(options: { transparent?: boolean; sizeOf: (call: Call) => number | null }): { picture: DecodedPicture; calls: Call[]; closed: () => number } {
  const calls: Call[] = [];
  let closes = 0;
  const picture: DecodedPicture = {
    transparent: options.transparent ?? false,
    encode: (type, { scale, quality }) => {
      const call = { type, scale, quality };
      calls.push(call);
      const size = options.sizeOf(call);
      return Promise.resolve(size === null ? null : new Blob([new Uint8Array(size)], { type }));
    },
    close: () => {
      closes += 1;
    },
  };
  return { picture, calls, closed: () => closes };
}

const convert = (file: File, picture: DecodedPicture) => convertWebp(file, { decode: () => Promise.resolve(picture) });

describe('an opaque picture becomes a JPEG', () => {
  it('is encoded once, at the first quality and full size, when that is already small enough', async () => {
    const { picture, calls } = decoded({ sizeOf: () => 50_000 });
    const result = await convert(webp(), picture);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected a file');
    expect(result.file.type).toBe('image/jpeg');
    expect(result.file.name).toBe('invented-front.jpg');
    expect(result.file.size).toBe(50_000);
    expect(calls).toEqual([{ type: 'image/jpeg', scale: 1, quality: ENCODE_QUALITIES[0] }]);
  });

  it('steps the quality down, at full size, until the result is under 200 KB', async () => {
    // Too large at the first three qualities, small enough at the fourth.
    const { picture, calls } = decoded({ sizeOf: ({ quality }) => ((quality ?? 0) > (ENCODE_QUALITIES[3] ?? 0) ? MAX_PICTURE_BYTES + 10 : 150_000) });
    const result = await convert(webp(), picture);
    expect(result.ok).toBe(true);
    expect(calls.map((call) => call.quality)).toEqual(ENCODE_QUALITIES.slice(0, 4));
    expect(calls.every((call) => call.scale === 1 && call.type === 'image/jpeg')).toBe(true);
  });

  it('steps the size down once the qualities are used up, and starts the qualities again at the smaller size', async () => {
    const { picture, calls } = decoded({ sizeOf: ({ scale }) => (scale === 1 ? MAX_PICTURE_BYTES + 1 : 90_000) });
    const result = await convert(webp(), picture);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(ENCODE_QUALITIES.length + 1);
    expect(calls.at(-1)).toEqual({ type: 'image/jpeg', scale: ENCODE_SCALES[1], quality: ENCODE_QUALITIES[0] });
  });

  it('refuses a result of exactly 200 KB: the picture must be strictly under the limit (A-06)', async () => {
    const { picture } = decoded({ sizeOf: ({ quality }) => (quality === ENCODE_QUALITIES[0] ? MAX_PICTURE_BYTES : MAX_PICTURE_BYTES - 1) });
    const result = await convert(webp(), picture);
    expect(result.ok && result.file.size).toBe(MAX_PICTURE_BYTES - 1);
  });
});

describe('the limit applies to the converted file (DL-237)', () => {
  it('converts a WebP of about 100 KB, whatever its own size, to a file the server will take', async () => {
    const { picture } = decoded({ sizeOf: () => 70 * 1024 });
    const result = await convert(webp('photo.webp', 100 * 1024), picture);
    expect(result.ok && result.file.size).toBe(70 * 1024);
  });

  it('converts a WebP that was itself over 200 KB when the converted file is under the limit', async () => {
    const { picture } = decoded({ sizeOf: () => 120_000 });
    expect((await convert(webp('big.webp', 400 * 1024), picture)).ok).toBe(true);
  });

  it('refuses a converted file of 204,800 bytes or more, and says its size', async () => {
    const { picture } = decoded({ sizeOf: () => MAX_PICTURE_BYTES });
    expect(await convert(webp(), picture)).toEqual({ ok: false, reason: 'too-large', bytes: 204_800 });
  });
});

describe('a picture with transparency becomes a PNG', () => {
  it('is encoded as a PNG, never as a JPEG, which would turn its transparent pixels black', async () => {
    const { picture, calls } = decoded({ transparent: true, sizeOf: () => 80_000 });
    const result = await convert(webp('logo.webp'), picture);
    expect(result.ok && result.file.type).toBe('image/png');
    expect(result.ok && result.file.name).toBe('logo.png');
    expect(calls).toEqual([{ type: 'image/png', scale: 1, quality: undefined }]);
  });

  it('steps only the size down, since a PNG has no quality, until the result is under 200 KB', async () => {
    const { picture, calls } = decoded({ transparent: true, sizeOf: ({ scale }) => (scale > (ENCODE_SCALES[2] ?? 0) ? MAX_PICTURE_BYTES + 5_000 : 120_000) });
    const result = await convert(webp(), picture);
    expect(result.ok).toBe(true);
    expect(calls.map((call) => call.scale)).toEqual(ENCODE_SCALES.slice(0, 3));
    expect(calls.every((call) => call.type === 'image/png' && call.quality === undefined)).toBe(true);
  });
});

describe('a picture that cannot be converted', () => {
  it('is "too large" when no quality and no size gets it under 200 KB, after every step has been tried', async () => {
    const { picture, calls } = decoded({ sizeOf: () => MAX_PICTURE_BYTES + 1 });
    // The smallest size tried is told: here every file was the same size, so it is that size.
    expect(await convert(webp(), picture)).toEqual({ ok: false, reason: 'too-large', bytes: MAX_PICTURE_BYTES + 1 });
    expect(calls).toHaveLength(ENCODE_SCALES.length * ENCODE_QUALITIES.length);
  });

  it('is "unreadable" when the browser cannot decode the file', async () => {
    const result = await convertWebp(webp(), { decode: () => Promise.reject(new Error('not a picture')) });
    expect(result).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('is "unreadable" when the browser cannot encode the type', async () => {
    const { picture } = decoded({ sizeOf: () => null });
    expect(await convert(webp(), picture)).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('lets the decoded picture go in every case: a file, a refusal and a failed encode', async () => {
    const ok = decoded({ sizeOf: () => 1_000 });
    await convert(webp(), ok.picture);
    const large = decoded({ sizeOf: () => MAX_PICTURE_BYTES + 1 });
    await convert(webp(), large.picture);
    const failing = decoded({ sizeOf: () => null });
    await convert(webp(), failing.picture);
    const throwing: DecodedPicture = { transparent: false, encode: () => Promise.reject(new Error('canvas lost')), close: vi.fn() };
    expect(await convert(webp(), throwing)).toEqual({ ok: false, reason: 'unreadable' });
    expect([ok.closed(), large.closed(), failing.closed(), vi.mocked(throwing.close).mock.calls.length]).toEqual([1, 1, 1, 1]);
  });
});

describe('convertedName', () => {
  it.each([
    ['photo.webp', 'jpg', 'photo.jpg'],
    ['photo.WEBP', 'jpg', 'photo.jpg'],
    ['my.part.front.webp', 'png', 'my.part.front.png'],
    ['no-extension', 'jpg', 'no-extension.jpg'],
    ['photo.webp.webp', 'jpg', 'photo.webp.jpg'],
    ['', 'png', 'picture.png'],
    ['.webp', 'jpg', 'picture.jpg'],
  ])('%j with the extension %s is named %j', (name, extension, expected) => {
    expect(convertedName(name, extension as 'jpg' | 'png')).toBe(expected);
  });
});
