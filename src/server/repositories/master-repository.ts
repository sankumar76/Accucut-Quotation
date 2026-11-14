import { z } from 'zod';

import { createCustomerMethods, type CustomerMethods } from './customer-repository';
import { isRecordNotFound, withDatabaseErrors } from './database-errors';
import { STORED_DECIMALS, trimDecimalText } from './decimal-text';
import { createExchangeRateMethods, type ExchangeRateMethods } from './exchange-rate-repository';
import { enforcingConstraints } from './master-constraints';
import { createMaterialMethods, type MaterialMethods } from './material-repository';
import type { PrismaClient } from './prisma-client';
import { createTreatmentMethods, type TreatmentMethods } from './treatment-repository';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the master data the Admin keeps (architecture section 5.1). Today that is the Process Master (STORY-02.01) in this file. The Material
 * Master (STORY-02.03) is `material-repository.ts`, the Exchange Rate Master (STORY-02.04) is `exchange-rate-repository.ts`, the Treatment / Color
 * list (STORY-02.05) is `treatment-repository.ts` and the Customer Master (STORY-02.02) is `customer-repository.ts`; this repository includes all
 * four, so the file stays within its size limit (coding standards section 1).
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

export interface MasterRepository extends CustomerMethods, ExchangeRateMethods, MaterialMethods, TreatmentMethods {
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

const SELECT = { id: true, name: true, unit: true, defaultValue: true } as const;

const LOCKED_ROWS = z.array(z.strictObject({ id: z.string(), name: z.string(), unit: z.string(), defaultValue: z.string() }));

export { MasterConstraintError, type MasterConstraint } from './master-constraints';
export { trimDecimalText };
export type {
  CustomerDetailChanges,
  CustomerDetailRecord,
  CustomerMethods,
  CustomerOptionRecord,
  CustomerRateRecord,
  CustomerRateValue,
  CustomerRecord,
  CustomerSummaryRecord,
  NewCustomer,
} from './customer-repository';
export type { ExchangeRateMethods, ExchangeRateStamp, ExchangeRatesRecord, NewExchangeRateStamp } from './exchange-rate-repository';
export type { MaterialChanges, MaterialMethods, MaterialOptionRecord, MaterialRecord, MaterialValuesRecord, NewMaterial } from './material-repository';
export { TreatmentNameTakenError } from './treatment-repository';
export type { TreatmentMethods, TreatmentOptionRecord, TreatmentRecord } from './treatment-repository';

function toRecord(row: { readonly id: string; readonly name: string; readonly unit: string; readonly defaultValue: { toFixed(places: number): string } }): ProcessItemRecord {
  return { id: row.id, name: row.name, unit: row.unit, defaultValue: trimDecimalText(row.defaultValue.toFixed(STORED_DECIMALS)) };
}

/** Builds the repository over a Prisma client. Every method turns a pool or statement timeout into `DatabaseBusyError`. */
// Over 40 lines on purpose (coding standards section 1): one object of the seven Process Master methods, each about 20 lines or fewer, plus a spread of the customer, material, exchange rate and treatment methods.
export function createMasterRepository(db: PrismaClient): MasterRepository {
  return {
    ...createCustomerMethods(db),
    ...createMaterialMethods(db),
    ...createExchangeRateMethods(db),
    ...createTreatmentMethods(db),

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
