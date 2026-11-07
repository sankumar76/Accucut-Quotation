import { z } from 'zod';

import { uniqueViolationOf, withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the master data the Admin keeps (architecture section 5.1). Today that is the Process Master (STORY-02.01); the
 * stories for customers, materials, exchange rates and treatments add their methods here.
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

/** Which of the rules of the database a write broke. */
export type MasterConstraint = 'process-item-name';

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

/** The constraint a unique violation names, from the column or the index it names; null for anything else. */
function constraintOf(error: unknown): MasterConstraint | null {
  const names = uniqueViolationOf(error);
  if (names === null) return null;
  return names.some((name) => name === 'name' || name === 'uq_process_items_name' || name === 'uq_process_items_name_lower') ? 'process-item-name' : null;
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

/** Builds the repository over a Prisma client. Every method turns a pool or statement timeout into `DatabaseBusyError`. */
// Over 40 lines on purpose (coding standards section 1): one object of seven repository methods, each about 20 lines or fewer.
export function createMasterRepository(db: PrismaClient): MasterRepository {
  return {
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
