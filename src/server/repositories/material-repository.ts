import { z } from 'zod';

import { isRecordNotFound, withDatabaseErrors } from './database-errors';
import { STORED_DECIMALS, trimDecimalText } from './decimal-text';
import { enforcingConstraints } from './master-constraints';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the Material Master (STORY-02.03; architecture sections 4.9 and 5.1). It is the material half of `master-repository.ts`, which
 * includes it, so that file stays within its size limit (coding standards section 1).
 *
 * **Materials**: every read and every lookup for a change applies the default filter `is_hidden = false AND deleted_at IS NULL`, so the
 * "Not applicable" row of story 02.06 and a deleted material are never listed and never found by ID: a change to one is "not found", the same
 * as an unknown ID. Story 02.06 adds the one separately named method that reads the hidden row, for the estimate form's drop-down. The three
 * numbers of a material are Restricted: `listMaterialOptions` does not even read their columns.
 *
 * A material's numbers are carried as **decimal text** ("7.37"), never as a JavaScript number (coding standards section 10, "Money and rates"):
 * the columns are `Decimal(18,4)`, and the text keeps at least two decimals and drops zeros beyond them.
 *
 * Every method that changes a material takes the caller's `Transaction`, because every such change is audited in the same one (STORY-01.07;
 * architecture section 6, DEF-017). A write that repeats a name fails with `MasterConstraintError` (`master-constraints.ts`).
 */

/** A material as the Admin keeps it: the three numbers are decimal text with at least two decimals, for example "7.37". Restricted. */
export interface MaterialRecord {
  readonly id: string;
  readonly materialInDrawing: string;
  readonly materialConsidered: string;
  readonly pricePerKg: string;
  readonly specificGravity: string;
  /** Material-Scrap-Rate, per kg (SPEC D-39). */
  readonly scrapRate: string;
}

export type NewMaterial = Omit<MaterialRecord, 'id'>;

export type MaterialChanges = { readonly [Field in keyof NewMaterial]?: string | undefined };

/**
 * What the estimate form's drop-down needs of a material, and nothing else: the ID, the name (Material in Drawing) and Material
 * Considered. No number is read from the table for it. `materialConsidered` is null only for the hidden "Not applicable" row (02.06).
 */
export interface MaterialOptionRecord {
  readonly id: string;
  readonly name: string;
  readonly materialConsidered: string | null;
}

/**
 * What a calculation reads of a material (STORY-03.03; architecture section 4.2): the three numbers, as decimal text, and nothing else.
 * Restricted. The hidden "Not applicable" row has them all at 0 (SPEC section 18 D-17).
 */
export interface MaterialValuesRecord {
  readonly id: string;
  readonly pricePerKg: string;
  readonly specificGravity: string;
  readonly scrapRate: string;
}

export interface MaterialMethods {
  /** Every listed material, in the order they were added. Hidden and deleted materials are not listed. */
  listMaterials(): Promise<ReadonlyArray<MaterialRecord>>;
  /** Every listed material as a choice: ID, name and Material Considered. Reads no number. */
  listMaterialOptions(): Promise<ReadonlyArray<MaterialOptionRecord>>;
  /**
   * The numbers of the material with this ID for a calculation, or null (unknown, deleted, or not an ID alike). Unlike `findMaterialForUpdate` and the lists, it
   * **finds the hidden row**: an estimate whose part has the "Not applicable" material must still be calculated (architecture section 4.9). A plain read.
   */
  findMaterialForCalculation(id: string): Promise<MaterialValuesRecord | null>;
  /** Takes the lock that serialises changes to the materials until the transaction ends (`SHARE ROW EXCLUSIVE`). Plain reads are not held up. */
  lockMaterials(tx: Transaction): Promise<void>;
  /** The listed material with this ID, or null (unknown, hidden or deleted alike), read **with its row locked** until the transaction ends. */
  findMaterialForUpdate(id: string, tx: Transaction): Promise<MaterialRecord | null>;
  /** Adds a material and returns it. Throws `MasterConstraintError` for a name that is taken. */
  createMaterial(material: NewMaterial, tx: Transaction): Promise<MaterialRecord>;
  /** Changes a listed material and returns it, or null if there is none with this ID. Throws `MasterConstraintError` for a name that is taken. */
  updateMaterial(id: string, changes: MaterialChanges, tx: Transaction): Promise<MaterialRecord | null>;
}

const MATERIAL_SELECT = {
  id: true,
  materialInDrawing: true,
  materialConsidered: true,
  pricePerKg: true,
  specificGravity: true,
  scrapRate: true,
} as const;

/** The default filter of architecture section 4.9: what the Admin's list shows and a change may reach. */
const LISTED = { isHidden: false, deletedAt: null } as const;

const LOCKED_MATERIAL_ROWS = z.array(
  z.strictObject({
    id: z.string(),
    materialInDrawing: z.string(),
    materialConsidered: z.string(),
    pricePerKg: z.string(),
    specificGravity: z.string(),
    scrapRate: z.string(),
  }),
);

interface MaterialRow {
  readonly id: string;
  readonly materialInDrawing: string;
  readonly materialConsidered: string | null;
  readonly pricePerKg: { toFixed(places: number): string };
  readonly specificGravity: { toFixed(places: number): string };
  readonly scrapRate: { toFixed(places: number): string };
}

function decimalText(value: { toFixed(places: number): string }): string {
  return trimDecimalText(value.toFixed(STORED_DECIMALS));
}

/** A listed material always has a Material Considered (the table's CHECK says so); a row without one is damaged, and says so loudly. */
function toMaterialRecord(row: MaterialRow): MaterialRecord {
  if (row.materialConsidered === null) throw new Error('A listed material has no Material Considered.');
  return {
    id: row.id,
    materialInDrawing: row.materialInDrawing,
    materialConsidered: row.materialConsidered,
    pricePerKg: decimalText(row.pricePerKg),
    specificGravity: decimalText(row.specificGravity),
    scrapRate: decimalText(row.scrapRate),
  };
}

async function readMaterials(db: PrismaClient): Promise<ReadonlyArray<MaterialRecord>> {
  const rows = await db.material.findMany({ where: LISTED, select: MATERIAL_SELECT, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  return rows.map(toMaterialRecord);
}

/** Only the three columns a drop-down needs are selected: a price, a gravity and a scrap rate are not read at all (ARCH-R2). */
async function readMaterialOptions(db: PrismaClient): Promise<ReadonlyArray<MaterialOptionRecord>> {
  const rows = await db.material.findMany({
    where: LISTED,
    select: { id: true, materialInDrawing: true, materialConsidered: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return rows.map((row) => ({ id: row.id, name: row.materialInDrawing, materialConsidered: row.materialConsidered }));
}

async function readMaterialValues(db: PrismaClient, id: string): Promise<MaterialValuesRecord | null> {
  // PostgreSQL would refuse a text that is not a UUID with an error; a material that is asked for by one is not found.
  if (!z.uuid().safeParse(id).success) return null;
  const row = await db.material.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, pricePerKg: true, specificGravity: true, scrapRate: true },
  });
  if (row === null) return null;
  return { id: row.id, pricePerKg: decimalText(row.pricePerKg), specificGravity: decimalText(row.specificGravity), scrapRate: decimalText(row.scrapRate) };
}

async function selectMaterialForUpdate(db: PrismaClient, id: string, tx: Transaction): Promise<MaterialRecord | null> {
  // PostgreSQL would refuse a text that is not a UUID with an error; a material that is asked for by one is not found.
  if (!z.uuid().safeParse(id).success) return null;
  // Prisma has no row lock, so this is a raw statement: the ID is a bound parameter. The default filter applies (section 4.9).
  const rows = await clientFor(db, tx).$queryRaw`
    SELECT id::text AS "id", material_in_drawing AS "materialInDrawing", material_considered AS "materialConsidered",
           price_per_kg::text AS "pricePerKg", specific_gravity::text AS "specificGravity", scrap_rate::text AS "scrapRate"
    FROM materials WHERE id = ${id}::uuid AND is_hidden = false AND deleted_at IS NULL FOR UPDATE`;
  const found = LOCKED_MATERIAL_ROWS.parse(rows)[0];
  if (found === undefined) return null;
  return { ...found, pricePerKg: trimDecimalText(found.pricePerKg), specificGravity: trimDecimalText(found.specificGravity), scrapRate: trimDecimalText(found.scrapRate) };
}

async function changeMaterial(db: PrismaClient, id: string, changes: MaterialChanges, tx: Transaction): Promise<MaterialRecord | null> {
  try {
    const updated = await clientFor(db, tx).material.update({
      where: { id, ...LISTED },
      // Only the fields given are written.
      data: {
        ...(changes.materialInDrawing === undefined ? {} : { materialInDrawing: changes.materialInDrawing }),
        ...(changes.materialConsidered === undefined ? {} : { materialConsidered: changes.materialConsidered }),
        ...(changes.pricePerKg === undefined ? {} : { pricePerKg: changes.pricePerKg }),
        ...(changes.specificGravity === undefined ? {} : { specificGravity: changes.specificGravity }),
        ...(changes.scrapRate === undefined ? {} : { scrapRate: changes.scrapRate }),
      },
      select: MATERIAL_SELECT,
    });
    return toMaterialRecord(updated);
  } catch (error) {
    if (isRecordNotFound(error)) return null;
    throw error;
  }
}

/** Builds the material methods over a Prisma client. Every method turns a pool or statement timeout into `DatabaseBusyError`. */
export function createMaterialMethods(db: PrismaClient): MaterialMethods {
  return {
    listMaterials: () => withDatabaseErrors(() => readMaterials(db)),
    listMaterialOptions: () => withDatabaseErrors(() => readMaterialOptions(db)),
    findMaterialForCalculation: (id) => withDatabaseErrors(() => readMaterialValues(db, id)),
    lockMaterials: (tx) =>
      withDatabaseErrors(async () => {
        await clientFor(db, tx).$executeRaw`LOCK TABLE materials IN SHARE ROW EXCLUSIVE MODE`;
      }),
    findMaterialForUpdate: (id, tx) => withDatabaseErrors(() => selectMaterialForUpdate(db, id, tx)),
    createMaterial: (material, tx) =>
      withDatabaseErrors(() =>
        enforcingConstraints(async () => toMaterialRecord(await clientFor(db, tx).material.create({ data: material, select: MATERIAL_SELECT }))),
      ),
    updateMaterial: (id, changes, tx) => withDatabaseErrors(() => enforcingConstraints(() => changeMaterial(db, id, changes, tx))),
  };
}
