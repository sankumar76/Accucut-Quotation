import { READ_MANY_LIMIT, type ExportedImage } from '../repositories/image-repository';

import type { ExportPicture, PictureExtension } from './export-model';

/**
 * The pictures of an export, read in batches (STORY-07.02 AC-4, NFR-005; architecture section 4.6): the distinct pictures of the calculation's rows are read **50 at a time and one batch at a time**, so no
 * read holds more than 50 files (each under 200 KB) and the database is never asked for the 2,000 of an estimate in one statement. A picture used by several rows is read once. The reader is a function, so
 * a test sees the batches exactly; in production it is `ImageRepository.readMany` of the estimate being exported, which answers only that estimate's own pictures.
 *
 * **What the workbook can hold:** PNG, JPEG and GIF. The portal also accepts WebP (STORY-05.07), which ExcelJS cannot embed, so a part whose picture is a WebP has an empty picture cell in the file (a
 * documented limit, a follow-up of this story); the picture is still on the part and on the screen.
 */

/** The size of a batch: the repository's own limit. */
export const IMAGE_BATCH_SIZE = READ_MANY_LIMIT;

/** Reads these pictures in one go. */
export type PictureReader = (imageIds: ReadonlyArray<string>) => Promise<ReadonlyArray<ExportedImage>>;

export interface ReadPictures {
  /** The distinct pictures the workbook can hold, in the order they were asked for. */
  readonly pictures: ExportPicture[];
  /** The place in `pictures` of a stored picture by its ID, or `undefined` for one that is not in the file. */
  readonly indexOf: (imageId: string) => number | undefined;
}

const EXTENSIONS: Readonly<Record<ExportedImage['mime'], PictureExtension | null>> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/gif': 'gif',
  'image/webp': null,
};

export async function readPictures(read: PictureReader, imageIds: ReadonlyArray<string>): Promise<ReadPictures> {
  const distinct = [...new Set(imageIds)];
  const pictures: ExportPicture[] = [];
  const places = new Map<string, number>();
  for (let start = 0; start < distinct.length; start += IMAGE_BATCH_SIZE) {
    const batch = distinct.slice(start, start + IMAGE_BATCH_SIZE);
    // Each read is finished before the next starts: the memory of one batch is given up before another is taken.
    const stored = await read(batch);
    const byId = new Map(stored.map((image) => [image.id, image]));
    for (const id of batch) {
      const image = byId.get(id);
      const extension = image === undefined ? null : EXTENSIONS[image.mime];
      if (image === undefined || extension === null) continue;
      places.set(id, pictures.length);
      pictures.push({ extension, bytes: image.bytes });
    }
  }
  return { pictures, indexOf: (imageId) => places.get(imageId) };
}
