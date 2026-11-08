import { z } from 'zod';

import { uniqueViolationOf, withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the master data the Admin keeps (architecture section 5.1). Today that is the Process Master (STORY-02.01) and the
 * Material Master (STORY-02.03); the stories for customers, exchange rates and treatments add their methods here.
 *
 * **Materials** (STORY-02.03; architecture sections 4.9 and 5.1): every read and every lookup for a change applies the default filter
 * `is_hidden = false AND deleted_at IS NULL`, so the "Not applicable" row of story 02.06 and a deleted material are never listed and
 * never found by ID: a change to one is "not found", the same as an unknown ID. Story 02.06 adds the one separately named method that
 * reads the hidden row, for the estimate form's drop-down. The three numbers of a material are Restricted: `listMaterialOptions`
 * does not even read their columns.
 *
 * A rate's default value is carried as **decimal text** ("0.37"), never as a JavaScript number (coding standards section 10,
 * "Money and rates"): the column is `Decimal(18,4)`, and the text keeps at least two decimals and drops zeros beyond them.
 *
 * Two rules belong to the database and not to the code that calls it (AC-2): a name is unique ignoring letter case
 * (`uq_process_items_name_lower`, and `uq_process_items_name` for the exact spelling), and a default value is 0 or more. A
 * write that repeats a name fails with `MasterConstraintError` whatever the caller checked first, so two requests that race for
 * one name cannot both win.
 *
 * Every method that changes a rate takes the caller's `Transaction`, because every such change is audited in the same one
 * (STORY-01.07; architecture section 6, DEF-017).
 */

export interface ProcessItemRecord {
  readonly id: string;
  readonly name: string;
  /** One of `PROCESS_UNITS` (`src/lib/masters/process-items.ts`), as the seed items hold it. */
  readonly unit: string;
  /** Decimal text with at least two decimals, for example "0.37". Restricted: never sent to an Engineer. */
  readonly defaultValue: string;
}

export interface NewProcessItem {
  readonly name: string;
  readonly unit: string;
  /** Decimal text, up to two decimals (checked at the route). */
  readonly defaultValue: string;
}

export interface ProcessItemChanges {
  readonly name?: string | undefined;
  readonly unit?: string | undefined;
  readonly defaultValue?: string | undefined;
}

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

/** Which of the rules of the database a write broke. */
export type MasterConstraint = 'process-item-name' | 'material-name';

/** A write that the database refused because it would repeat a rate's name. */
export class MasterConstraintError extends Error {
  constructor(
    readonly constraint: MasterConstraint,
    options: { readonly cause: unknown },
  ) {
    super(`The write broke the ${constraint} rule.`, options);
    this.name = 'MasterConstraintError';
  }
}

export interface MasterRepository {
  /** Every rate, in the order of SPEC section 4.1 (the seed items) and then in the order they were added. */
  listProcessItems(): Promise<ReadonlyArray<ProcessItemRecord>>;
  /**
   * Takes the lock that serialises changes to the rates until the transaction ends (`SHARE ROW EXCLUSIVE`): two changes to the
   * set of names cannot overlap, so the check that a new name cannot be read as a formula (it looks at every other name) judges
   * the set the change is made against. Plain reads are not held up. There are 15 rates and one Admin, so the wait is nil.
   */
  lockProcessItems(tx: Transaction): Promise<void>;
  /** Every rate's ID and name, read in the caller's transaction. */
  listProcessItemNames(tx: Transaction): Promise<ReadonlyArray<Pick<ProcessItemRecord, 'id' | 'name'>>>;
  /** The rate with this ID, or null, read **with its row locked** until the transaction ends, so `before` is the state replaced. */
  findProcessItemForUpdate(id: string, tx: Transaction): Promise<ProcessItemRecord | null>;
  /** Adds a rate and returns it. Throws `MasterConstraintError` for a name that is taken. */
  createProcessItem(item: NewProcessItem, tx: Transaction): Promise<ProcessItemRecord>;
  /** Changes a rate and returns it, or null if there is none with this ID. Throws `MasterConstraintError` for a name that is taken. */
  updateProcessItem(id: string, changes: ProcessItemChanges, tx: Transaction): Promise<ProcessItemRecord | null>;
  /** Deletes a rate; false if there was none with this ID. */
  deleteProcessItem(id: string, tx: Transaction): Promise<boolean>;

  /** Every listed material, in the order they were added. Hidden and deleted materials are not listed. */
  listMaterials(): Promise<ReadonlyArray<MaterialRecord>>;
  /** Every listed material as a choice: ID, name and Material Considered. Reads no number. */
  listMaterialOptions(): Promise<ReadonlyArray<MaterialOptionRecord>>;
  /** Takes the lock that serialises changes to the materials until the transaction ends (`SHARE ROW EXCLUSIVE`). Plain reads are not held up. */
  lockMaterials(tx: Transaction): Promise<void>;
  /** The listed material with this ID, or null (unknown, hidden or deleted alike), read **with its row locked** until the transaction ends. */
  findMaterialForUpdate(id: string, tx: Transaction): Promise<MaterialRecord | null>;
  /** Adds a material and returns it. Throws `MasterConstraintError` for a name that is taken. */
  createMaterial(material: NewMaterial, tx: Transaction): Promise<MaterialRecord>;
  /** Changes a listed material and returns it, or null if there is none with this ID. Throws `MasterConstraintError` for a name that is taken. */
  updateMaterial(id: string, changes: MaterialChanges, tx: Transaction): Promise<MaterialRecord | null>;
}

const RECORD_NOT_FOUND = 'P2025';
const STORED_DECIMALS = 4;
const SHOWN_DECIMALS = 2;

const SELECT = { id: true, name: true, unit: true, defaultValue: true } as const;

const LOCKED_ROWS = z.array(z.strictObject({ id: z.string(), name: z.string(), unit: z.string(), defaultValue: z.string() }));

function isRecordNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === RECORD_NOT_FOUND;
}

/** "0.3700" is "0.37" and "21.3700" is "21.37": at least two decimals, and no zero beyond them. */
export function trimDecimalText(text: string): string {
  const [whole = '0', fraction = ''] = text.split('.');
  const kept = fraction.replace(/0+$/, '').padEnd(SHOWN_DECIMALS, '0');
  return `${whole}.${kept}`;
}

function toRecord(row: { readonly id: string; readonly name: string; readonly unit: string; readonly defaultValue: { toFixed(places: number): string } }): ProcessItemRecord {
  return { id: row.id, name: row.name, unit: row.unit, defaultValue: trimDecimalText(row.defaultValue.toFixed(STORED_DECIMALS)) };
}

const PROCESS_NAME_CONSTRAINTS: ReadonlyArray<string> = ['name', 'uq_process_items_name', 'uq_process_items_name_lower'];
const MATERIAL_NAME_CONSTRAINTS: ReadonlyArray<string> = ['material_in_drawing', 'uq_materials_material_in_drawing', 'uq_materials_material_in_drawing_lower'];

/** The constraint a unique violation names, from the column or the index it names; null for anything else. */
function constraintOf(error: unknown): MasterConstraint | null {
  const names = uniqueViolationOf(error);
  if (names === null) return null;
  if (names.some((name) => PROCESS_NAME_CONSTRAINTS.includes(name))) return 'process-item-name';
  return names.some((name) => MATERIAL_NAME_CONSTRAINTS.includes(name)) ? 'material-name' : null;
}

async function enforcingConstraints<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    const constraint = constraintOf(error);
    if (constraint === null) throw error;
    throw new MasterConstraintError(constraint, { cause: error });
  }
}

// ---- Materials (STORY-02.03) -------------------------------------------------------------------------------------------------

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

/** The material methods of the repository; each turns a pool or statement timeout into `DatabaseBusyError`. */
function createMaterialMethods(db: PrismaClient): Pick<MasterRepository, MaterialMethodName> {
  return {
    listMaterials: () => withDatabaseErrors(() => readMaterials(db)),
    listMaterialOptions: () => withDatabaseErrors(() => readMaterialOptions(db)),
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

type MaterialMethodName = 'listMaterials' | 'listMaterialOptions' | 'lockMaterials' | 'findMaterialForUpdate' | 'createMaterial' | 'updateMaterial';

/** Builds the repository over a Prisma client. Every method turns a pool or statement timeout into `DatabaseBusyError`. */
// Over 40 lines on purpose (coding standards section 1): one object of the seven Process Master methods, each about 20 lines or fewer, plus a spread of the material methods (`createMaterialMethods`).
export function createMasterRepository(db: PrismaClient): MasterRepository {
  return {
    ...createMaterialMethods(db),

    listProcessItems() {
      return withDatabaseErrors(async () => {
        const rows = await db.processItem.findMany({ select: SELECT, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
        return rows.map(toRecord);
      });
    },

    lockProcessItems(tx) {
      return withDatabaseErrors(async () => {
        await clientFor(db, tx).$executeRaw`LOCK TABLE process_items IN SHARE ROW EXCLUSIVE MODE`;
      });
    },

    listProcessItemNames(tx) {
      return withDatabaseErrors(() => clientFor(db, tx).processItem.findMany({ select: { id: true, name: true } }));
    },

    findProcessItemForUpdate(id, tx) {
      return withDatabaseErrors(async () => {
        // PostgreSQL would refuse a text that is not a UUID with an error; a rate that is asked for by one is not found.
        if (!z.uuid().safeParse(id).success) return null;
        // Prisma has no row lock, so this is a raw statement: the ID is a bound parameter.
        const rows = await clientFor(db, tx).$queryRaw`
          SELECT id::text AS "id", name, unit, default_value::text AS "defaultValue"
          FROM process_items WHERE id = ${id}::uuid FOR UPDATE`;
        const found = LOCKED_ROWS.parse(rows)[0];
        return found === undefined ? null : { ...found, defaultValue: trimDecimalText(found.defaultValue) };
      });
    },

    createProcessItem(item, tx) {
      return withDatabaseErrors(() =>
        enforcingConstraints(async () => toRecord(await clientFor(db, tx).processItem.create({ data: item, select: SELECT }))),
      );
    },

    updateProcessItem(id, changes, tx) {
      return withDatabaseErrors(() =>
        enforcingConstraints(async () => {
          try {
            const updated = await clientFor(db, tx).processItem.update({
              where: { id },
              // Only the fields given are written.
              data: {
                ...(changes.name === undefined ? {} : { name: changes.name }),
                ...(changes.unit === undefined ? {} : { unit: changes.unit }),
                ...(changes.defaultValue === undefined ? {} : { defaultValue: changes.defaultValue }),
              },
              select: SELECT,
            });
            return toRecord(updated);
          } catch (error) {
            if (isRecordNotFound(error)) return null;
            throw error;
          }
        }),
      );
    },

    deleteProcessItem(id, tx) {
      return withDatabaseErrors(async () => {
        const { count } = await clientFor(db, tx).processItem.deleteMany({ where: { id } });
        return count === 1;
      });
    },
  };
}
