import { z } from 'zod';

import { withDatabaseErrors } from './database-errors';
import { trimDecimalText } from './decimal-text';
import { clientFor, type Transaction } from './transaction';
import type { PrismaClient } from './prisma-client';

/**
 * Storage for a changed Process Master default reaching the customers (STORY-02.08; architecture sections 5.1 "customer_rates" and 8 "Customers"). Four
 * statements, each one query however many customers there are (NFR-011: up to 500; AC-4 caps one request at 1,000 choices):
 *
 *   - **Move** the customers that hold the old default to the new one (`moveCustomersToDefault`), and say which they were, in name order.
 *   - **List** the customers whose value is not the item's current default, so the ones that were neither moved nor already there (`listCustomersWithOwnValue`).
 *   - **Apply** the new default to a chosen set, **only** where the customer's value is still the one the Admin was shown (`applyDefaultToCustomers`).
 *   - **Count** per item the customers whose value differs from the default (`countCustomersWithOwnValue`), for the column of SCR-11.
 *
 * A deleted customer (`deleted_at`) is never moved, listed, counted or applied to (A-3, A-13). Values are decimal text ("0.47"), compared as numbers
 * by PostgreSQL (`DECIMAL(18,4)` on both sides), never as JavaScript numbers (coding standards section 10). Every write takes the caller's `Transaction`,
 * because every change is audited in the same one (STORY-01.07; DEF-017), and every caller holds the Process Master's table lock first, so none of these
 * statements waits on a customer's save (PRF-01).
 */

/** A customer whose rate was just changed: its ID and name, in the order of the Customer Master (name ignoring letter case, then name, then ID). */
export interface ChangedCustomer {
  readonly customerId: string;
  readonly name: string;
}

/** A customer whose value is not the default: the value is decimal text with at least two decimals. Restricted. */
export interface CustomerWithOwnValue extends ChangedCustomer {
  readonly value: string;
}

/** What the Admin was shown for one customer: its value as listed. The change applies only while the customer still holds it. */
export interface ShownRate {
  readonly customerId: string;
  readonly shownValue: string;
}

export interface PropagationMethods {
  /** Per Process Master item ID, how many listed customers hold a value other than its default. An item no customer differs on may be absent. One query. */
  countCustomersWithOwnValue(): Promise<ReadonlyMap<string, number>>;
  /** Sets `next` on every listed customer whose value for the item equals `previous`; returns those customers, in order. One statement. */
  moveCustomersToDefault(processItemId: string, previous: string, next: string, tx: Transaction): Promise<ReadonlyArray<ChangedCustomer>>;
  /** The listed customers whose value for the item is not the item's current default, with the value, in order. Read in the caller's transaction. */
  listCustomersWithOwnValue(processItemId: string, tx: Transaction): Promise<ReadonlyArray<CustomerWithOwnValue>>;
  /** Of these customer IDs, those that exist at all (a deleted customer exists). Lower case. */
  findExistingCustomerIds(ids: ReadonlyArray<string>, tx: Transaction): Promise<ReadonlySet<string>>;
  /** Sets `next` for each listed customer whose value still equals the `shownValue` it was given with and is not `next` already; returns those customers, in order. One statement. */
  applyDefaultToCustomers(processItemId: string, next: string, shown: ReadonlyArray<ShownRate>, tx: Transaction): Promise<ReadonlyArray<ChangedCustomer>>;
}

const CHANGED_ROWS = z.array(z.strictObject({ customerId: z.string(), name: z.string() }));
const OWN_VALUE_ROWS = z.array(z.strictObject({ customerId: z.string(), name: z.string(), value: z.string() }));
const COUNT_ROWS = z.array(z.strictObject({ processItemId: z.string(), count: z.number().int().nonnegative() }));
const ID_ROWS = z.array(z.strictObject({ id: z.string() }));

const isUuid = (id: string): boolean => z.uuid().safeParse(id).success;

export function createPropagationMethods(db: PrismaClient): PropagationMethods {
  return {
    countCustomersWithOwnValue: () =>
      withDatabaseErrors(async () => {
        const rows = await db.$queryRaw`
          SELECT pi.id::text AS "processItemId", (count(c.id) FILTER (WHERE cr.value <> pi.default_value))::int AS "count"
          FROM process_items pi
          JOIN customer_rates cr ON cr.process_item_id = pi.id
          JOIN customers c ON c.id = cr.customer_id AND c.deleted_at IS NULL
          GROUP BY pi.id`;
        return new Map(COUNT_ROWS.parse(rows).map((row) => [row.processItemId, row.count]));
      }),

    moveCustomersToDefault: (processItemId, previous, next, tx) =>
      withDatabaseErrors(async () => {
        if (!isUuid(processItemId)) return [];
        // The data-modifying CTE runs to completion whether or not it is read; the join gives the names, in the order of the Customer Master.
        const rows = await clientFor(db, tx).$queryRaw`
          WITH moved AS (
            UPDATE customer_rates cr SET value = ${next}::numeric, updated_at = now()
            FROM customers c
            WHERE c.id = cr.customer_id AND c.deleted_at IS NULL
              AND cr.process_item_id = ${processItemId}::uuid AND cr.value = ${previous}::numeric
            RETURNING cr.customer_id
          )
          SELECT c.id::text AS "customerId", c.name FROM moved m JOIN customers c ON c.id = m.customer_id
          ORDER BY lower(c.name), c.name, c.id`;
        return CHANGED_ROWS.parse(rows);
      }),

    listCustomersWithOwnValue: (processItemId, tx) =>
      withDatabaseErrors(async () => {
        if (!isUuid(processItemId)) return [];
        const rows = await clientFor(db, tx).$queryRaw`
          SELECT c.id::text AS "customerId", c.name, cr.value::text AS "value"
          FROM customer_rates cr
          JOIN customers c ON c.id = cr.customer_id AND c.deleted_at IS NULL
          JOIN process_items pi ON pi.id = cr.process_item_id
          WHERE cr.process_item_id = ${processItemId}::uuid AND cr.value <> pi.default_value
          ORDER BY lower(c.name), c.name, c.id`;
        return OWN_VALUE_ROWS.parse(rows).map((row) => ({ ...row, value: trimDecimalText(row.value) }));
      }),

    findExistingCustomerIds: (ids, tx) =>
      withDatabaseErrors(async () => {
        const valid = ids.filter(isUuid);
        if (valid.length === 0) return new Set<string>();
        const rows = await clientFor(db, tx).$queryRaw`SELECT id::text AS "id" FROM customers WHERE id = ANY(${valid}::uuid[])`;
        return new Set(ID_ROWS.parse(rows).map((row) => row.id.toLowerCase()));
      }),

    applyDefaultToCustomers: (processItemId, next, shown, tx) =>
      withDatabaseErrors(async () => {
        if (shown.length === 0 || !isUuid(processItemId) || !shown.every((entry) => isUuid(entry.customerId))) return [];
        const customerIds = shown.map((entry) => entry.customerId);
        const shownValues = shown.map((entry) => entry.shownValue);
        // The change is guarded by the value the Admin was shown: a customer edited since keeps its value, and the statement says which ones moved.
        const rows = await clientFor(db, tx).$queryRaw`
          WITH moved AS (
            UPDATE customer_rates cr SET value = ${next}::numeric, updated_at = now()
            FROM unnest(${customerIds}::uuid[], ${shownValues}::numeric[]) AS u(customer_id, shown), customers c
            WHERE c.id = cr.customer_id AND c.deleted_at IS NULL AND cr.customer_id = u.customer_id
              AND cr.process_item_id = ${processItemId}::uuid AND cr.value = u.shown AND cr.value <> ${next}::numeric
            RETURNING cr.customer_id
          )
          SELECT c.id::text AS "customerId", c.name FROM moved m JOIN customers c ON c.id = m.customer_id
          ORDER BY lower(c.name), c.name, c.id`;
        return CHANGED_ROWS.parse(rows);
      }),
  };
}
