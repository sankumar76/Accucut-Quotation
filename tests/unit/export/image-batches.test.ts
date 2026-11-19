import { describe, expect, it } from 'vitest';

import { IMAGE_BATCH_SIZE, readPictures, type PictureReader } from '@/server/export/image-batches';
import { READ_MANY_LIMIT, type ExportedImage } from '@/server/repositories/image-repository';

import { gifOfDimensions, jpegOfDimensions, pngOfDimensions, smallWebp } from '../../support/pictures';

/**
 * The pictures of an export are read in batches of 50 (STORY-07.02 AC-4, NFR-005): one batch at a time, never more than 50 files in one read, each distinct picture once, a kind the workbook cannot hold
 * left out. The reader is a function the test holds, so the batches it is asked for are seen exactly. Every picture is a few invented bytes.
 */

const idOf = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const imageOf = (n: number, mime: ExportedImage['mime'] = 'image/png'): ExportedImage => ({ id: idOf(n), mime, bytes: new Uint8Array(pngOfDimensions(10 + n, 10)) });

/** A reader over `stored`, which records each batch it is asked for and whether two reads were ever open at once. */
function readerOver(stored: ReadonlyArray<ExportedImage>) {
  const batches: string[][] = [];
  let open = 0;
  let overlapped = false;
  const read: PictureReader = async (ids) => {
    open += 1;
    if (open > 1) overlapped = true;
    batches.push([...ids]);
    // One turn of the event loop, so a reader that was started without waiting for the last would be seen to overlap.
    await Promise.resolve();
    open -= 1;
    return stored.filter((image) => ids.includes(image.id));
  };
  return { read, batches, overlapped: () => overlapped };
}

describe('readPictures: batches of 50, one at a time', () => {
  it('is the repository\'s own limit, 50', () => {
    expect(IMAGE_BATCH_SIZE).toBe(50);
    expect(IMAGE_BATCH_SIZE).toBe(READ_MANY_LIMIT);
  });

  it('reads 120 pictures as 50, 50 and 20, in order, each read finished before the next starts', async () => {
    const stored = Array.from({ length: 120 }, (_, index) => imageOf(index + 1));
    const world = readerOver(stored);
    const { pictures } = await readPictures(world.read, stored.map((image) => image.id));
    expect(world.batches.map((batch) => batch.length)).toEqual([50, 50, 20]);
    expect(world.batches.flat()).toEqual(stored.map((image) => image.id));
    expect(world.overlapped()).toBe(false);
    expect(pictures).toHaveLength(120);
  });

  it('reads nothing for no pictures, and exactly one batch for exactly 50', async () => {
    const none = readerOver([]);
    expect(await readPictures(none.read, [])).toEqual({ pictures: [], indexOf: expect.any(Function) });
    expect(none.batches).toEqual([]);
    const stored = Array.from({ length: 50 }, (_, index) => imageOf(index + 1));
    const fifty = readerOver(stored);
    await readPictures(fifty.read, stored.map((image) => image.id));
    expect(fifty.batches.map((batch) => batch.length)).toEqual([50]);
  });
});

describe('readPictures: what is held', () => {
  it('holds each distinct picture once, whatever number of times an ID is named, and answers its place by ID', async () => {
    const stored = [imageOf(1), imageOf(2)];
    const world = readerOver(stored);
    const { pictures, indexOf } = await readPictures(world.read, [idOf(1), idOf(2), idOf(1), idOf(1)]);
    expect(world.batches).toEqual([[idOf(1), idOf(2)]]);
    expect(pictures).toHaveLength(2);
    expect(indexOf(idOf(1))).toBe(0);
    expect(indexOf(idOf(2))).toBe(1);
    expect(indexOf(idOf(3))).toBeUndefined();
  });

  it('names the kind of each picture the workbook holds, and leaves out a WebP, which it cannot embed, so its cell is empty', async () => {
    const stored: ExportedImage[] = [
      { id: idOf(1), mime: 'image/png', bytes: new Uint8Array(pngOfDimensions(5, 5)) },
      { id: idOf(2), mime: 'image/jpeg', bytes: new Uint8Array(jpegOfDimensions(5, 5)) },
      { id: idOf(3), mime: 'image/gif', bytes: new Uint8Array(gifOfDimensions(5, 5)) },
      { id: idOf(4), mime: 'image/webp', bytes: new Uint8Array(smallWebp()) },
    ];
    const { pictures, indexOf } = await readPictures(readerOver(stored).read, stored.map((image) => image.id));
    expect(pictures.map((picture) => picture.extension)).toEqual(['png', 'jpeg', 'gif']);
    expect(indexOf(idOf(4))).toBeUndefined();
  });

  it('leaves out a picture the reader does not return (not this estimate\'s, or not there), without failing', async () => {
    const { pictures, indexOf } = await readPictures(readerOver([imageOf(1)]).read, [idOf(1), idOf(2)]);
    expect(pictures).toHaveLength(1);
    expect(indexOf(idOf(2))).toBeUndefined();
  });

  it('passes the bytes on as they were read, without copying them again', async () => {
    const image = imageOf(1);
    const { pictures } = await readPictures(readerOver([image]).read, [image.id]);
    expect(pictures[0]?.bytes).toBe(image.bytes);
  });
});
