import { z } from 'zod';

import { isRecordNotFound, withDatabaseErrors } from './database-errors';
import { STORED_DECIMALS, trimDecimalText } from './decimal-text';
import { ESTIMATE_USE_LIMIT, toEstimateUses, type EstimateUses } from './estimate-use';
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
 * What a calculation reads of a material (STORY-03.03; architecture section 4.2): the three numbers, as decimal text, and the two names the stored record
 * keeps as text (STORY-03.05: Material in Drawing for E, Material Considered for F), so renaming the material later cannot change a stored estimate.
 * Restricted. The hidden "Not applicable" row has the numbers all at 0 (SPEC section 18 D-17) and no Material Considered.
 */
export interface MaterialValuesRecord {
  readonly id: string;
  readonly materialInDrawing: string;
  readonly materialConsidered: string | null;
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
  /**
   * The material with this ID as a choice (ID, name, Material Considered, **no number**), or null (unknown, deleted, or not an ID alike), read `FOR SHARE` until the
   * transaction ends, so a material that is being deleted waits for the part that names it, and one already deleted is not found (STORY-05.03: a part's Material in
   * Drawing is one of these). Unlike the lists it **finds the hidden "Not applicable" row**, which a part may name. A change to a material locks its row `FOR UPDATE`, so
   * the two serialise.
   */
  findMaterialOption(id: string, tx: Transaction): Promise<MaterialOptionRecord | null>;
  /** Takes the lock that serialises changes to the materials until the transaction ends (`SHARE ROW EXCLUSIVE`). Plain reads are not held up. */
  lockMaterials(tx: Transaction): Promise<void>;
  /** The listed material with this ID, or null (unknown, hidden or deleted alike), read **with its row locked** until the transaction ends. */
  findMaterialForUpdate(id: string, tx: Transaction): Promise<MaterialRecord | null>;
  /** Adds a material and returns it. Throws `MasterConstraintError` for a name that is taken. */
  createMaterial(material: NewMaterial, tx: Transaction): Promise<MaterialRecord>;
  /** Changes a listed material and returns it, or null if there is none with this ID. Throws `MasterConstraintError` for a name that is taken. */
  updateMaterial(id: string, changes: MaterialChanges, tx: Transaction): Promise<MaterialRecord | null>;
  /**
   * The Draft and Submitted estimates that have this material in a part (STORY-02.07 AC-3): how many, and the first ten by task code. **Fails closed**: an ID that
   * is not a UUID throws, it is never "no estimate". A plain read: it takes no lock, so it must run **after** `findMaterialForUpdate` in the same transaction. That
   * lock waits for a writer of a part's Material in Drawing (which holds the material `FOR SHARE`, `lockMaterialForUse`) and, once granted, this statement (a new
   * snapshot under READ COMMITTED) sees what that writer committed (AC-5).
   *
   * A part holds its material in `estimate_nodes.inputs`. The shape of that value belongs to the part form (STORY-05.03), so this does not depend on it: a part
   * is a match when the material's ID, as a JSON string, is **anywhere** in its inputs. It can only over-match (an ID typed into free text), never miss a stored
   * material, which is the safe side of a guard that protects data. The query reads the table directly, so a missing table is an error, never "unused".
   */
  findOpenEstimatesOfMaterial(materialId: string, tx: Transaction): Promise<EstimateUses>;
  /**
   * Soft-deletes a listed material (`deleted_at`, A-13) in the caller's transaction; false if there is none with this ID. The hidden "Not applicable" row is never
   * deleted (the statement skips it, and so does a trigger). The runtime role cannot `DELETE` from `materials`; this is an `UPDATE`.
   */
  softDeleteMaterial(id: string, tx: Transaction): Promise<boolean>;
  /**
   * The lock that every **writer of a part's Material in Drawing** must take, in the transaction that writes it and **after** the estimate's row lock: the material
   * `FOR SHARE`, found by ID with `deleted_at IS NULL` (the hidden "Not applicable" row is allowed: it is a choice). True when the material exists and is locked;
   * false for an unknown, deleted or non-UUID ID, and the writer then refuses the choice. The delete takes the same row `FOR UPDATE`, so the two serialise
   * (AC-5): a delete that finds the write first waits and then sees the part; a write that finds the delete first waits and then finds no material.
   */
  lockMaterialForUse(id: string, tx: Transaction): Promise<boolean>;
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
    select: { id: true, materialInDrawing: true, materialConsidered: true, pricePerKg: true, specificGravity: true, scrapRate: true },
  });
  if (row === null) return null;
  return {
    id: row.id,
    materialInDrawing: row.materialInDrawing,
    materialConsidered: row.materialConsidered,
    pricePerKg: decimalText(row.pricePerKg), specificGravity: decimalText(row.specificGravity), scrapRate: decimalText(row.scrapRate),
  };
}

const OPTION_ROWS = z.array(z.strictObject({ id: z.string(), name: z.string(), materialConsidered: z.string().nullable() }));

async function selectMaterialOption(db: PrismaClient, id: string, tx: Transaction): Promise<MaterialOptionRecord | null> {
  // PostgreSQL would refuse a text that is not a UUID with an error; a material that is asked for by one is not found.
  if (!z.uuid().safeParse(id).success) return null;
  // Only the three columns of a choice are selected: no price, gravity or scrap rate is read (ARCH-R2). The ID is a bound parameter.
  const rows = await clientFor(db, tx).$queryRaw`
    SELECT id::text AS "id", material_in_drawing AS "name", material_considered AS "materialConsidered"
    FROM materials WHERE id = ${id}::uuid AND deleted_at IS NULL FOR SHARE`;
  return OPTION_ROWS.parse(rows)[0] ?? null;
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

const isUuid = (id: string): boolean => z.uuid().safeParse(id).success;

async function readOpenEstimatesOfMaterial(db: PrismaClient, materialId: string, tx: Transaction): Promise<EstimateUses> {
  // Fails closed (SQR-02): an ID that is not a UUID is a programming fault, never "no open estimate", which would let a delete through.
  if (!isUuid(materialId)) throw new Error('The open-estimate check needs a material ID.');
  // The ID as PostgreSQL prints a JSON string: lower case, in double quotes. A UUID holds only hex digits and hyphens, so nothing in it is special to the text search.
  const needle = `"${materialId.toLowerCase()}"`;
  // Open means Draft or Submitted (BR-053). The total is counted over all of them before the limit; only a code and a status are read.
  const rows = await clientFor(db, tx).$queryRaw`
    SELECT t.code AS "code", e.status::text AS "status", (count(*) OVER ())::int AS "total"
    FROM estimates e
    JOIN tasks t ON t.id = e.task_id
    WHERE e.status IN ('DRAFT', 'SUBMITTED')
      AND EXISTS (SELECT 1 FROM estimate_nodes n WHERE n.estimate_id = e.id AND position(${needle}::text IN lower(n.inputs::text)) > 0)
    ORDER BY t.code, e.id
    LIMIT ${ESTIMATE_USE_LIMIT}::int`;
  return toEstimateUses(rows);
}

async function deleteListedMaterial(db: PrismaClient, id: string, tx: Transaction): Promise<boolean> {
  if (!isUuid(id)) return false;
  const changed = await clientFor(db, tx).$executeRaw`
    UPDATE materials SET deleted_at = now(), updated_at = now() WHERE id = ${id}::uuid AND deleted_at IS NULL AND is_hidden = false AND is_system = false`;
  return changed === 1;
}

async function shareMaterialRow(db: PrismaClient, id: string, tx: Transaction): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await clientFor(db, tx).$queryRaw`SELECT id::text AS "id" FROM materials WHERE id = ${id}::uuid AND deleted_at IS NULL FOR SHARE`;
  return z.array(z.strictObject({ id: z.string() })).parse(rows).length === 1;
}

/** Builds the material methods over a Prisma client. Every method turns a pool or statement timeout into `DatabaseBusyError`. */
export function createMaterialMethods(db: PrismaClient): MaterialMethods {
  return {
    listMaterials: () => withDatabaseErrors(() => readMaterials(db)),
    listMaterialOptions: () => withDatabaseErrors(() => readMaterialOptions(db)),
    findMaterialForCalculation: (id) => withDatabaseErrors(() => readMaterialValues(db, id)),
    findMaterialOption: (id, tx) => withDatabaseErrors(() => selectMaterialOption(db, id, tx)),
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
    findOpenEstimatesOfMaterial: (materialId, tx) => withDatabaseErrors(() => readOpenEstimatesOfMaterial(db, materialId, tx)),
    softDeleteMaterial: (id, tx) => withDatabaseErrors(() => deleteListedMaterial(db, id, tx)),
    lockMaterialForUse: (id, tx) => withDatabaseErrors(() => shareMaterialRow(db, id, tx)),
  };
}
