import { z } from 'zod';

import { IMAGE_MIMES, type ImageMime } from '../../lib/images/signature';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the part pictures (STORY-05.07; ADR-013; architecture sections 5.1 `part_images`, 6 "Image" and 8). A picture is stored **whole, as received**, in `bytea`, once for
 * each distinct file of an estimate (`sha256`): the table is immutable, so the runtime role can only add and read, and a replacement is a new row. Nothing here decodes a picture,
 * and no query that does not need the bytes selects them, so reading a part never touches the table's weight.
 *
 * Who may see a picture is decided by its estimate: `findOwner` answers the estimate and the Engineer it belongs to, **without the bytes**, and only then `readImage` takes them, so a
 * request for a picture that is not the caller's never reads one. An ID that is not a UUID is "not found", never a database error. No rate, cost or formula is stored or selected here
 * (class Confidential: a picture of the part, NFR-002 is not engaged).
 */

/** What is shown of a stored picture: its ID, the sanitised name and the size. Never the bytes. */
export interface PictureRecord {
  readonly id: string;
  readonly fileName: string;
  readonly sizeBytes: number;
}

/** A picture to store: the type the content check found, the hash of the bytes as lower-case hex, the sanitised name, and the bytes. */
export interface NewImage {
  readonly sha256: string;
  readonly mime: ImageMime;
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

/** Whose a picture is: its estimate and the Engineer of that estimate's task. */
export interface ImageOwner {
  readonly estimateId: string;
  readonly engineerId: string;
}

/** A picture as served: its stored type and its bytes. */
export interface StoredImage {
  readonly mime: ImageMime;
  readonly bytes: Uint8Array;
}

/** A picture read for the export: its ID too, because the rows are matched to the files by it. */
export interface ExportedImage extends StoredImage {
  readonly id: string;
}

/** The most pictures one `readMany` takes: the export reads its pictures in batches of this many (STORY-07.02 AC-4, NFR-005), so no read holds more than 50 files of up to 200 KB at once. */
export const READ_MANY_LIMIT = 50;

export interface ImageRepository {
  /**
   * Stores the picture for the estimate, in the caller's transaction, or finds the one this estimate already has with the same bytes (`sha256`): the same file added again is not stored
   * twice and keeps the name it was first stored with. The caller holds the estimate's lock. Answers the row that now holds the bytes.
   */
  storeImage(estimateId: string, image: NewImage, tx: Transaction): Promise<PictureRecord>;
  /** The picture with this ID **in this estimate**, without its bytes, or null (unknown, another estimate's, or not an ID). */
  findPicture(estimateId: string, imageId: string, tx?: Transaction): Promise<PictureRecord | null>;
  /** The estimate and the Engineer a picture belongs to, without its bytes, or null (unknown, or not an ID). */
  findOwner(imageId: string): Promise<ImageOwner | null>;
  /** The stored type and bytes of a picture, or null (unknown, or not an ID). Call it only after `findOwner` said the caller may see it. */
  readImage(imageId: string): Promise<StoredImage | null>;
  /**
   * The stored type and bytes of up to `READ_MANY_LIMIT` pictures **of this estimate** (STORY-07.02 AC-4), in one read. An ID that is not a UUID, that is unknown or that belongs to another estimate is left out
   * of the answer, so a picture is never read through an estimate that does not own it. Each file's bytes are copied into a buffer of their own, which the export can hand to its thread by transfer. More
   * than `READ_MANY_LIMIT` IDs is a mistake of the caller (a `RangeError`), never a larger read. Call it only for a Lead or an Admin who may export the estimate.
   */
  readMany(estimateId: string, imageIds: ReadonlyArray<string>): Promise<ExportedImage[]>;
}

const PICTURE_SELECT = { id: true, fileName: true, sizeBytes: true } as const;
const PICTURE_ROW = z.strictObject({ id: z.string(), fileName: z.string(), sizeBytes: z.number().int() });
const OWNER_ROWS = z.array(z.strictObject({ estimateId: z.string(), engineerId: z.string() }));
const IMAGE_ROW = z.strictObject({ mime: z.enum(IMAGE_MIMES), bytes: z.instanceof(Uint8Array) });
const MANY_ROW = z.strictObject({ id: z.string(), mime: z.enum(IMAGE_MIMES), bytes: z.instanceof(Uint8Array) });

const isUuid = (id: string): boolean => z.uuid().safeParse(id).success;

/** Builds the picture methods over a Prisma client. Every method turns a pool or statement timeout into `DatabaseBusyError`. */
export function createImageRepository(db: PrismaClient): ImageRepository {
  return {
    storeImage: (estimateId, image, tx) =>
      withDatabaseErrors(async () => {
        const client = clientFor(db, tx);
        // `ON CONFLICT DO NOTHING` on (estimate, hash): the same bytes are found below, whoever stored them first. The size is the bytes' own length, never a number from outside.
        await client.partImage.createMany({
          data: [{ estimateId, sha256: image.sha256, mime: image.mime, fileName: image.fileName, sizeBytes: image.bytes.byteLength, bytes: new Uint8Array(image.bytes) }],
          skipDuplicates: true,
        });
        const row = await client.partImage.findFirstOrThrow({ where: { estimateId, sha256: image.sha256 }, select: PICTURE_SELECT });
        return PICTURE_ROW.parse(row);
      }),

    findPicture: (estimateId, imageId, tx) =>
      withDatabaseErrors(async () => {
        if (!isUuid(imageId)) return null;
        const row = await clientFor(db, tx).partImage.findFirst({ where: { id: imageId, estimateId }, select: PICTURE_SELECT });
        return row === null ? null : PICTURE_ROW.parse(row);
      }),

    findOwner: (imageId) =>
      withDatabaseErrors(async () => {
        if (!isUuid(imageId)) return null;
        const rows = await db.$queryRaw`
          SELECT i.estimate_id::text AS "estimateId", t.engineer_id::text AS "engineerId"
          FROM part_images i
          JOIN estimates e ON e.id = i.estimate_id
          JOIN tasks t ON t.id = e.task_id
          WHERE i.id = ${imageId}::uuid`;
        return OWNER_ROWS.parse(rows)[0] ?? null;
      }),

    readImage: (imageId) =>
      withDatabaseErrors(async () => {
        if (!isUuid(imageId)) return null;
        const row = await db.partImage.findUnique({ where: { id: imageId }, select: { mime: true, bytes: true } });
        return row === null ? null : IMAGE_ROW.parse(row);
      }),

    readMany: (estimateId, imageIds) => {
      if (imageIds.length > READ_MANY_LIMIT) throw new RangeError(`At most ${String(READ_MANY_LIMIT)} pictures are read at once.`);
      return withDatabaseErrors(async () => {
        const ids = imageIds.filter(isUuid);
        if (!isUuid(estimateId) || ids.length === 0) return [];
        const rows = await db.partImage.findMany({ where: { estimateId, id: { in: ids } }, select: { id: true, mime: true, bytes: true } });
        return rows.map((row) => {
          const parsed = MANY_ROW.parse(row);
          return { id: parsed.id, mime: parsed.mime, bytes: new Uint8Array(parsed.bytes) };
        });
      });
    },
  };
}
