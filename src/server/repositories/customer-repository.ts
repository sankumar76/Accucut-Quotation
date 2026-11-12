import { z } from 'zod';

import { withDatabaseErrors } from './database-errors';
import { trimDecimalText } from './decimal-text';
import { enforcingConstraints } from './master-constraints';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the Customer Master (STORY-02.02; architecture sections 4.1, 4.9, 5.1 and 6, and section 10 "Master-data storage"). Two tables:
 * `customers` (a name, optional contact details, a soft delete) and `customer_rates` (one row per customer and Process Master item, so the
 * synchronisation of SPEC section 4.2 is plain SQL). Every query of both is here, the Process-item sync statements of AC-4 included; the Process
 * Master's own queries stay in `master-repository.ts`, and this file imports neither it nor another method file.
 *
 * **The default filter** (A-13): every read and every lookup for a change applies `deleted_at IS NULL`, so a deleted customer is never listed and
 * never found by ID. Customers have no hidden row, so there is no `is_hidden` filter.
 *
 * A name is unique ignoring letter case, and that rule belongs to the database (`uq_customers_name_lower`): a write that repeats a name fails with
 * `MasterConstraintError('customer-name')` whatever the caller checked first, so two requests that race for one name cannot both win.
 *
 * **Rates** are decimal text ("0.50"), never numbers (coding standards section 10). A customer's rates load in **one query** with the item's name,
 * unit and current default, in the order of the Process Master (the order of the SCR-12 table); the list of customers counts the rates that differ
 * from the default in one query, never one query per customer.
 *
 * Every method that changes a customer takes the caller's `Transaction`, because every such change is audited in the same one (STORY-01.07;
 * architecture section 6, DEF-017). The runtime role can read, add and change customers, delete a rate row (an unused Process Master item takes its
 * rows with it, AC-4) and cannot delete a customer or truncate either table.
 */

/** A customer's details. A contact field that was not given is `null`. */
export interface CustomerRecord {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
}

/** One of the customer's rates beside the Process Master's current default for the item. Decimal text with at least two decimals. Restricted. */
export interface CustomerRateRecord {
  readonly processItemId: string;
  readonly name: string;
  readonly unit: string;
  readonly defaultValue: string;
  readonly value: string;
}

/** A customer with every rate, in the order of the Process Master. */
export interface CustomerDetailRecord extends CustomerRecord {
  readonly rates: ReadonlyArray<CustomerRateRecord>;
}

/** A row of SCR-12's list: the details and how many rates differ from the default. */
export interface CustomerSummaryRecord extends CustomerRecord {
  readonly differ: number;
}

/** What the estimate form's drop-down needs of a customer, and nothing else: the ID and the name. No contact detail and no rate. */
export interface CustomerOptionRecord {
  readonly id: string;
  readonly name: string;
}

export interface NewCustomer {
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
}

/** The details a change sets. A field that is left out is not written; a contact field given as `null` is cleared. */
export interface CustomerDetailChanges {
  readonly name?: string | undefined;
  readonly phone?: string | null | undefined;
  readonly email?: string | null | undefined;
  readonly address?: string | null | undefined;
}

/** One rate to set: the Process Master item and the value as decimal text. */
export interface CustomerRateValue {
  readonly processItemId: string;
  readonly value: string;
}

export interface CustomerMethods {
  /** Every listed customer by name, ignoring letter case, with how many of its rates differ from the default. One query. */
  listCustomers(): Promise<ReadonlyArray<CustomerSummaryRecord>>;
  /** Every listed customer as a choice: ID and name. */
  listCustomerOptions(): Promise<ReadonlyArray<CustomerOptionRecord>>;
  /** The listed customer with this ID and its rates, or null (unknown, deleted or not an ID alike). A plain read. */
  findCustomer(id: string): Promise<CustomerDetailRecord | null>;
  /** The same, **with the customer's row locked** until the transaction ends, so `before` is the state replaced. */
  findCustomerForUpdate(id: string, tx: Transaction): Promise<CustomerDetailRecord | null>;
  /**
   * Adds a customer and one rate per Process Master item at the item's current default (SPEC section 4.2 rule 1), in the caller's transaction, and
   * returns it with its rates. Throws `MasterConstraintError('customer-name')` for a name that is taken.
   */
  createCustomer(customer: NewCustomer, tx: Transaction): Promise<CustomerDetailRecord>;
  /** Writes the details given to a listed customer; false if there is none with this ID. Throws `MasterConstraintError('customer-name')` for a name that is taken. */
  updateCustomerDetails(id: string, changes: CustomerDetailChanges, tx: Transaction): Promise<boolean>;
  /** Sets these rates of a listed customer; true only if every one of them is a rate that customer has, and then all are set. One statement. */
  setCustomerRates(customerId: string, values: ReadonlyArray<CustomerRateValue>, tx: Transaction): Promise<boolean>;
  /** A new Process Master item: one rate row for **every** customer at the item's current default (SPEC section 4.2 rule 3). One statement. Returns the rows added. */
  addProcessItemToCustomers(processItemId: string, tx: Transaction): Promise<number>;
  /** A deleted Process Master item: its rate row of **every** customer is removed (SPEC section 4.2 rule 5). One statement. Returns the rows removed. */
  removeProcessItemFromCustomers(processItemId: string, tx: Transaction): Promise<number>;
}

/** The order of the SCR-12 table: the Process Master's order. */
const RATE_ROWS = z.array(
  z.strictObject({ processItemId: z.string(), name: z.string(), unit: z.string(), defaultValue: z.string(), value: z.string() }),
);

const CUSTOMER_ROW = z.strictObject({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
});

const CUSTOMER_ROWS = z.array(CUSTOMER_ROW);
const SUMMARY_ROWS = z.array(CUSTOMER_ROW.extend({ differ: z.number().int().nonnegative() }));
const OPTION_ROWS = z.array(z.strictObject({ id: z.string(), name: z.string() }));

const isUuid = (id: string): boolean => z.uuid().safeParse(id).success;

/** The rates of one customer, in one query. */
async function ratesOf(db: PrismaClient, customerId: string, tx?: Transaction): Promise<ReadonlyArray<CustomerRateRecord>> {
  const rows = await clientFor(db, tx).$queryRaw`
    SELECT cr.process_item_id::text AS "processItemId", pi.name, pi.unit, pi.default_value::text AS "defaultValue", cr.value::text AS "value"
    FROM customer_rates cr
    JOIN process_items pi ON pi.id = cr.process_item_id
    WHERE cr.customer_id = ${customerId}::uuid
    ORDER BY pi.created_at, pi.id`;
  return RATE_ROWS.parse(rows).map((row) => ({ ...row, defaultValue: trimDecimalText(row.defaultValue), value: trimDecimalText(row.value) }));
}

async function detailOf(db: PrismaClient, customer: CustomerRecord, tx?: Transaction): Promise<CustomerDetailRecord> {
  return { ...customer, rates: await ratesOf(db, customer.id, tx) };
}

async function selectCustomer(db: PrismaClient, id: string, lock: boolean, tx?: Transaction): Promise<CustomerRecord | null> {
  // PostgreSQL would refuse a text that is not a UUID with an error; a customer that is asked for by one is not found.
  if (!isUuid(id)) return null;
  const client = clientFor(db, tx);
  // Prisma has no row lock, so the locking read is a raw statement: the ID is a bound parameter. The default filter applies (A-13).
  const rows = lock
    ? await client.$queryRaw`SELECT id::text AS "id", name, phone, email, address FROM customers WHERE id = ${id}::uuid AND deleted_at IS NULL FOR UPDATE`
    : await client.$queryRaw`SELECT id::text AS "id", name, phone, email, address FROM customers WHERE id = ${id}::uuid AND deleted_at IS NULL`;
  return CUSTOMER_ROWS.parse(rows)[0] ?? null;
}

async function insertCustomer(db: PrismaClient, customer: NewCustomer, tx: Transaction): Promise<CustomerDetailRecord> {
  const client = clientFor(db, tx);
  const created = await client.customer.create({ data: customer, select: { id: true, name: true, phone: true, email: true, address: true } });
  // SPEC section 4.2 rule 1: one rate per Process Master item at its current default, in one statement.
  await client.$executeRaw`
    INSERT INTO customer_rates (customer_id, process_item_id, value)
    SELECT ${created.id}::uuid, id, default_value FROM process_items`;
  return detailOf(db, created, tx);
}

async function setRates(db: PrismaClient, customerId: string, values: ReadonlyArray<CustomerRateValue>, tx: Transaction): Promise<boolean> {
  if (values.length === 0) return true;
  if (!isUuid(customerId) || !values.every((entry) => isUuid(entry.processItemId))) return false;
  const itemIds = values.map((entry) => entry.processItemId);
  const rateValues = values.map((entry) => entry.value);
  const changed = await clientFor(db, tx).$executeRaw`
    UPDATE customer_rates cr SET value = u.value, updated_at = now()
    FROM unnest(${itemIds}::uuid[], ${rateValues}::numeric[]) AS u(process_item_id, value)
    WHERE cr.customer_id = ${customerId}::uuid AND cr.process_item_id = u.process_item_id`;
  return changed === values.length;
}

/** Builds the customer methods over a Prisma client. Every method turns a pool or statement timeout into `DatabaseBusyError`. */
export function createCustomerMethods(db: PrismaClient): CustomerMethods {
  return {
    listCustomers: () =>
      withDatabaseErrors(async () => {
        const rows = await db.$queryRaw`
          SELECT c.id::text AS "id", c.name, c.phone, c.email, c.address,
                 (count(*) FILTER (WHERE cr.value <> pi.default_value))::int AS "differ"
          FROM customers c
          LEFT JOIN customer_rates cr ON cr.customer_id = c.id
          LEFT JOIN process_items pi ON pi.id = cr.process_item_id
          WHERE c.deleted_at IS NULL
          GROUP BY c.id
          ORDER BY lower(c.name), c.name, c.id`;
        return SUMMARY_ROWS.parse(rows);
      }),

    listCustomerOptions: () =>
      withDatabaseErrors(async () => {
        const rows = await db.$queryRaw`SELECT id::text AS "id", name FROM customers WHERE deleted_at IS NULL ORDER BY lower(name), name, id`;
        return OPTION_ROWS.parse(rows);
      }),

    findCustomer: (id) =>
      withDatabaseErrors(async () => {
        const customer = await selectCustomer(db, id, false);
        return customer === null ? null : detailOf(db, customer);
      }),

    findCustomerForUpdate: (id, tx) =>
      withDatabaseErrors(async () => {
        const customer = await selectCustomer(db, id, true, tx);
        return customer === null ? null : detailOf(db, customer, tx);
      }),

    createCustomer: (customer, tx) => withDatabaseErrors(() => enforcingConstraints(() => insertCustomer(db, customer, tx))),

    updateCustomerDetails: (id, changes, tx) =>
      withDatabaseErrors(() =>
        enforcingConstraints(async () => {
          if (!isUuid(id)) return false;
          const { count } = await clientFor(db, tx).customer.updateMany({
            where: { id, deletedAt: null },
            // Only the fields given are written.
            data: {
              ...(changes.name === undefined ? {} : { name: changes.name }),
              ...(changes.phone === undefined ? {} : { phone: changes.phone }),
              ...(changes.email === undefined ? {} : { email: changes.email }),
              ...(changes.address === undefined ? {} : { address: changes.address }),
            },
          });
          return count === 1;
        }),
      ),

    setCustomerRates: (customerId, values, tx) => withDatabaseErrors(() => setRates(db, customerId, values, tx)),

    addProcessItemToCustomers: (processItemId, tx) =>
      withDatabaseErrors(
        () =>
          clientFor(db, tx).$executeRaw`
            INSERT INTO customer_rates (customer_id, process_item_id, value)
            SELECT c.id, pi.id, pi.default_value FROM customers c CROSS JOIN process_items pi WHERE pi.id = ${processItemId}::uuid`,
      ),

    removeProcessItemFromCustomers: (processItemId, tx) =>
      withDatabaseErrors(() => clientFor(db, tx).$executeRaw`DELETE FROM customer_rates WHERE process_item_id = ${processItemId}::uuid`),
  };
}
